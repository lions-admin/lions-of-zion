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
import { dispatchToQueue, type Dispatcher } from "./queue";

export const TOPICS = {
  searchReindex: "search.reindex",
  embeddingRefresh: "embedding.refresh",
  itemDetected: "item.detected",
  emailNotification: "email.notification",
  publicationCacheInvalidate: "publication.cache-invalidate",
  briefingAlert: "briefing.alert",
} as const;

export type Topic = (typeof TOPICS)[keyof typeof TOPICS];

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
      where: (w: unknown) => { orderBy: (o: unknown) => { limit: (n: number) => Promise<OutboxRow[]> } };
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
  const limit = opts.limit ?? 25;

  const pending = await d
    .select()
    .from(outbox)
    .where(and(isNull(outbox.publishedAt), lte(outbox.availableAt, new Date())))
    .orderBy(asc(outbox.availableAt))
    .limit(limit);

  let dispatched = 0;
  let failed = 0;

  for (const row of pending) {
    try {
      await dispatch(row);
      await d.update(outbox).set({ publishedAt: new Date() }).where(eq(outbox.id, row.id));
      dispatched++;
    } catch (cause) {
      const attempts = row.attempts + 1;
      const backoffSeconds = BACKOFF_SECONDS[Math.min(attempts - 1, BACKOFF_SECONDS.length - 1)]!;
      await d
        .update(outbox)
        .set({
          attempts,
          lastError: cause instanceof Error ? cause.message : String(cause),
          availableAt: new Date(Date.now() + backoffSeconds * 1000),
        })
        .where(eq(outbox.id, row.id));
      failed++;
    }
  }

  return { attempted: pending.length, dispatched, failed };
}

/** Lazily bound against the live database, so a cron route can drain the
 *  outbox without importing `server/db` itself — the same shape every
 *  module's `index.ts` uses to bind its own connection. */
export const drainPendingOutbox = (opts?: { limit?: number; dispatch?: Dispatcher }): Promise<DrainResult> =>
  drainOutbox(db(), opts);
