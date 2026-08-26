import { consumerFor } from "@/server/jobs/consumers";
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

export const POST = queueClient.handleCallback(async (message: OutboxDispatchMessage) => {
  const consumer = consumerFor(message.topic);
  if (!consumer) {
    throw new Error(`No consumer registered for outbox topic "${message.topic}"`);
  }
  await consumer(message.payload, { entityType: message.entityType, entityId: message.entityId });
});
