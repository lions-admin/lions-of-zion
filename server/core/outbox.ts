import "server-only";

/**
 * Emitting work to be done later, atomically with the change that caused it.
 *
 * Publishing to a queue after the transaction commits is not atomic: a crash
 * in the gap loses the job with no error and no trace, because the write
 * succeeded. Writing the intent inside the transaction and draining it
 * separately is the only way ingestion → reindex → embed survives a restart.
 */

import { and, asc, eq, isNull, lte } from "drizzle-orm";
import { db } from "@/server/db/client";
import { outbox } from "@/server/db/schema";
import type { OutboxRow } from "@/server/db/schema";
import type { EntityType } from "@/server/contracts/enums";
import { briefingLog } from "./log";
import { dispatchToQueue, type Dispatcher } from "./queue";

export const TOPICS = {
  searchReindex: "search.reindex",
  emailNotification: "email.notification",
  publicationCacheInvalidate: "publication.cache-invalidate",
  briefingAlert: "briefing.alert",
  editorialRunProcess: "editorial.run-process",
  /**
   * The run report, delivered after the run reaches a terminal state.
   *
   * This sat in `RETIRED_TOPICS` from the day the machine-readable status
   * endpoint landed, on the reasoning that polling `/runs/{runKey}` replaced
   * the email. It did not: `deliverEditorialRunReport` stayed wired into the
   * consumer registry with nothing left to produce for it, so the owner's
   * report was written, stored, and never sent. Emitted again from
   * `editorialRepo.finish` and `.fail` — the two transactions that make a run
   * terminal — so the report is the last thing a run does, in both directions.
   */
  editorialRunReport: "editorial.run-report",
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];

/**
 * Topics a past deploy produced and nothing produces any more.
 *
 * They are kept out of `TOPICS` on purpose: `emit()` only accepts a `Topic`,
 * so naming one of these again is a type error rather than a convention
 * someone has to remember. A consumer must nevertheless stay registered for
 * each of them in `server/jobs/consumers`, because rows written before the
 * change may still be undrained in a real database and
 * `dispatchOutboxMessage` throws on an unregistered topic — a queue message
 * for one would then retry against that throw until the queue gives up.
 *
 * Retiring a topic is therefore two deploys, not one: drop the producers and
 * move the topic here, then delete the entry and its consumer once
 * `SELECT count(*) FROM outbox WHERE topic = '<value>' AND published_at IS
 * NULL` reads 0 in Production and the queue has no message left in flight.
 */
export const RETIRED_TOPICS = {
  /**
   * Emitted once per created item — including once per claim by the briefing
   * publish stage, so ~190 rows for an eight-article edition — to run a
   * consumer that was a deliberate no-op from the day it was written. About
   * half of every post-edition outbox backlog was this topic waiting its turn
   * to do nothing. Producers removed 2026-09-01.
   */
  itemDetected: "item.detected",
} as const;

type Inserter = { insert: (table: typeof outbox) => { values: (v: unknown) => Promise<unknown> } };

export async function emit(
  tx: Inserter,
  topic: Topic,
  payload: Record<string, unknown>,
  subject?: { entityType: EntityType; entityId: string },
): Promise<void> {
  await tx.insert(outbox).values({
    topic,
    payload: payload as never,
    entityType: subject?.entityType ?? null,
    entityId: subject?.entityId ?? null,
  });
}

/* Structural, so this runs against both the Neon pool and PGlite. */
type AnyDb = {
  select: (f?: unknown) => {
    from: (t: unknown) => {
      where: (w: unknown) => { orderBy: (...o: unknown[]) => { limit: (n: number) => Promise<OutboxRow[]> } };
    };
  };
  update: (t: unknown) => { set: (v: unknown) => { where: (w: unknown) => Promise<unknown> } };
};

export type DrainResult = { attempted: number; dispatched: number; failed: number };

/** Seconds before a retry, indexed by attempt number. Caps at an hour rather
 *  than growing unbounded — a queue outage should be checked on again, not
 *  quietly abandoned. */
const BACKOFF_SECONDS = [30, 120, 600, 1800, 3600];

/**
 * Rows handed to the queue per tick.
 *
 * The cron runs every 15 minutes (`vercel.json`), so this number is really a
 * throughput: 250 rows per tick is 1,000 an hour. The load that sets it is a
 * briefing edition, which materializes roughly one claim per paragraph and
 * emits a `search.reindex` for each — about 190 rows arriving at once. At the
 * previous default of 25 that edition took eight ticks, so a story published
 * at 05:00 was not searchable until nearly 07:00; at 250 it drains on the
 * first tick with room for a double-length edition and the ordinary traffic
 * that accumulated in the same window.
 *
 * The ceiling is `maxDuration = 60` on the drain route. Each row costs one
 * queue `send` plus one single-row `UPDATE` — tens of milliseconds — so 250
 * finishes in well under half the budget even at a pessimistic 150ms a row.
 * Overshooting is not destructive in any case: `published_at` is committed
 * per row, so a timeout mid-drain leaves the remainder pending and the next
 * tick resumes from there.
 */
const DEFAULT_DRAIN_LIMIT = 250;

/**
 * Hands pending outbox rows to the queue, and records what happened.
 *
 * `dispatch` defaults to the real Vercel Queues client but is a parameter
 * precisely so a test never has to authenticate against it — the same
 * separation `itemService(db)` uses for persistence. A row that fails to
 * dispatch keeps its `published_at` null and becomes eligible again after a
 * backoff; nothing is lost, the next drain just tries later.
 */
export async function drainOutbox(
  db: unknown,
  opts: { limit?: number; dispatch?: Dispatcher } = {},
): Promise<DrainResult> {
  const d = db as AnyDb;
  const dispatch = opts.dispatch ?? dispatchToQueue;
  const limit = opts.limit ?? DEFAULT_DRAIN_LIMIT;

  /* Fresh rows before retries, then oldest first. Ordered by `available_at`
     alone, a backlog of rows that keep failing owns the whole batch: while
     every send was rejected, 3,348 retried rows with `available_at` inside
     their capped one-hour backoff always outnumbered the 250-row limit, so
     the three `editorial.run-process` rows behind them — `attempts` 0, never
     once handed to `dispatch` — could not reach the queue even after the
     underlying fault was fixed until the backlog had drained through. A row
     that has never been tried goes first; a row that has waited its backoff
     is not lost, only behind new work. */
  const pending = await d
    .select()
    .from(outbox)
    .where(and(isNull(outbox.publishedAt), lte(outbox.availableAt, new Date())))
    .orderBy(asc(outbox.attempts), asc(outbox.availableAt))
    .limit(limit);

  let dispatched = 0;
  let failed = 0;
  let firstError: { topic: string; outboxId: string; message: string } | null = null;

  for (const row of pending) {
    try {
      await dispatch(row);
      await d.update(outbox).set({ publishedAt: new Date() }).where(eq(outbox.id, row.id));
      dispatched++;
    } catch (cause) {
      const attempts = row.attempts + 1;
      const backoffSeconds = BACKOFF_SECONDS[Math.min(attempts - 1, BACKOFF_SECONDS.length - 1)]!;
      const message = cause instanceof Error ? cause.message : String(cause);
      firstError ??= { topic: row.topic, outboxId: row.id.toString(), message };
      await d
        .update(outbox)
        .set({
          attempts,
          lastError: message,
          availableAt: new Date(Date.now() + backoffSeconds * 1000),
        })
        .where(eq(outbox.id, row.id));
      failed++;
    }
  }

  /* The cron's 200 says only that the drain ran. What it did — and the first
     reason a send was refused — is the line an operator needs, and the one
     that was missing for two days of green ticks. Message text only: an
     outbox row carries no secret, and the queue's refusal names the topic. */
  if (pending.length) {
    briefingLog(failed ? "warn" : "info", "outbox.drain", {}, {
      attempted: pending.length, dispatched, failed,
      firstErrorTopic: firstError?.topic, firstErrorOutboxId: firstError?.outboxId, firstError: firstError?.message?.slice(0, 300),
    });
  }

  return { attempted: pending.length, dispatched, failed };
}

/** Lazily bound against the live database, so a cron route can drain the
 *  outbox without importing `server/db` itself — the same shape every
 *  module's `index.ts` uses to bind its own connection. */
export const drainPendingOutbox = (opts?: { limit?: number; dispatch?: Dispatcher }): Promise<DrainResult> =>
  drainOutbox(db(), opts);
