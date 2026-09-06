import "server-only";

/**
 * The outbox's only consumer: one Vercel Queue topic, fanning out by the
 * outbox row's own `topic` column.
 *
 * One queue topic rather than one per outbox topic, because opening a new
 * kind of background work should be "add a case to a registry", not
 * "add a route, a `vercel.json` trigger, and a redeploy". The queue consumer
 * (`app/api/internal/queue/outbox-dispatch/route.ts`) reads `payload.topic`
 * and looks up the handler the same way the drain would.
 *
 * `send` is real network I/O against the provisioned Vercel Queue
 * (it authenticates via OIDC, set up by `vercel link && vercel env pull`, per
 * the Vercel Queues quickstart). The outbox drain therefore takes a `dispatch`
 * function as a parameter with this as its default — tests inject a stub and
 * never touch the real SDK, exactly like `db()` is never called by a test that
 * builds its own PGlite instance.
 */

import type { OutboxRow } from "@/server/db/schema";
import { queueClient } from "./queue-client";

/**
 * What Vercel Queues accepts as a topic name.
 *
 * The queue API (`/api/v3/topic/<name>`) refuses anything outside this set
 * with `Invalid V3 queue name. Must be 1-256 alphanumeric characters,
 * hyphens, or underscores.` — and it refuses it at `send()`, not at deploy.
 * The SDK does not check locally, and a `vercel.json` trigger naming an
 * invalid topic deploys without complaint. So from 2026-09-05 to 2026-09-07
 * this file said `"outbox.dispatch"`, every deploy was green, the drain cron
 * returned 200 every fifteen minutes, and not one outbox row was ever handed
 * to the queue: 3,348 rows carried that error and `attempts` in the sixties,
 * and every whole-site editorial run sat `queued` until the GitHub poller
 * gave up. The rule is held here as a regex and asserted at import, so the
 * next wrong name fails the test suite and the build instead of Production.
 */
export const QUEUE_TOPIC_NAME = /^[A-Za-z0-9_-]{1,256}$/;

export function assertQueueTopicName(name: string): string {
  if (!QUEUE_TOPIC_NAME.test(name)) {
    throw new Error(
      `"${name}" is not a valid Vercel Queue topic: 1-256 alphanumeric characters, hyphens or underscores only.`,
    );
  }
  return name;
}

/** Hyphen, not dot — see `QUEUE_TOPIC_NAME`. `vercel.json` must say the same. */
export const OUTBOX_QUEUE_TOPIC = assertQueueTopicName("outbox-dispatch");

export type OutboxDispatchMessage = {
  outboxId: string;
  topic: string;
  payload: unknown;
  entityType: string | null;
  entityId: string | null;
};

export type Dispatcher = (row: OutboxRow) => Promise<void>;

/**
 * Hands one outbox row to the queue. Never throws for "the queue said no" in
 * a way the caller has to special-case — every failure surfaces as a rejected
 * promise, and the drain's job is to catch it, record it, and retry on the
 * next tick. A queue outage is therefore a slower drain, not a lost job.
 */
export const dispatchToQueue: Dispatcher = async (row) => {
  const message: OutboxDispatchMessage = {
    outboxId: row.id.toString(),
    topic: row.topic,
    payload: row.payload,
    entityType: row.entityType,
    entityId: row.entityId,
  };
  await queueClient.send(OUTBOX_QUEUE_TOPIC, message, {
    idempotencyKey: `outbox-${row.id}`,
  });
};
