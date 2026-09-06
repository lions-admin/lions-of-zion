import { dispatchOutboxMessage } from "@/server/modules/outbox";
import { queueClient } from "@/server/core/queue-client";
import type { OutboxDispatchMessage } from "@/server/core/queue";

/**
 * Triggered by Vercel Queues (the `queue/v2beta` trigger in `vercel.json`,
 * whose `topic` must equal `OUTBOX_QUEUE_TOPIC` — a test pins the two
 * together), never by an ordinary request: a queue trigger makes the route
 * private with no public URL, so there is no auth check to write here.
 *
 * One route for every outbox topic: the message carries which topic it came
 * from, and `consumerFor` looks up the handler the same way the drain would
 * if it were processing synchronously. Retry and redelivery on a thrown error
 * are the SDK's job, not this file's — the backoff below is the same curve
 * the source-ingest route uses, capped at an hour.
 *
 * `maxDuration` is 300 because a package execution can materialize media and
 * apply publication updates; the message lock matches it, so a run that uses
 * its whole budget is not redelivered to a second worker while the first is
 * still inside it. (A redelivery would be harmless anyway — `claim()` refuses
 * a run whose lease is live — but it would be a wasted invocation.) The
 * lighter topics finish in well under a second either way.
 */
export const runtime = "nodejs";
export const maxDuration = 300;

export const POST = queueClient.handleCallback(async (message: OutboxDispatchMessage) => {
  await dispatchOutboxMessage(message);
}, {
  visibilityTimeoutSeconds: 300,
  retry: (_error, metadata) => ({
    afterSeconds: Math.min(3_600, 30 * 2 ** Math.max(0, metadata.deliveryCount - 1)),
  }),
});
