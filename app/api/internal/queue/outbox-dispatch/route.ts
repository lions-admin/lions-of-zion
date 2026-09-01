import { dispatchOutboxMessage } from "@/server/modules/outbox";
import { queueClient } from "@/server/core/queue-client";
import type { OutboxDispatchMessage } from "@/server/core/queue";

/**
 * Triggered by Vercel Queues (the `queue/v2beta` trigger in `vercel.json`),
 * never by an ordinary request — a queue trigger makes the route private with
 * no public URL, so there is no auth check to write here.
 *
 * One route for every outbox topic: the message carries which topic it came
 * from, and `consumerFor` looks up the handler the same way the drain would
 * if it were processing synchronously. Retry and redelivery on a thrown error
 * are the SDK's job, not this file's.
 */
export const runtime = "nodejs";
export const maxDuration = 60;

export const POST = queueClient.handleCallback(async (message: OutboxDispatchMessage) => {
  await dispatchOutboxMessage(message);
});
