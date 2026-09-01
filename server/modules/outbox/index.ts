import "server-only";

import { withDatabaseRole } from "@/server/db/client";
import { consumerFor } from "@/server/jobs/consumers";

type OutboxMessage = { topic: string; payload: unknown; entityType: string | null; entityId: string | null };

/** The outbox module owns the service identity required to execute a durable
 * message. Queue routes only authenticate the callback and hand it here. */
export async function dispatchOutboxMessage(message: OutboxMessage): Promise<void> {
  await withDatabaseRole("app_service", "service:outbox-queue", async () => {
    const consumer = consumerFor(message.topic);
    if (!consumer) throw new Error(`No consumer registered for outbox topic "${message.topic}"`);
    await consumer(message.payload, { entityType: message.entityType, entityId: message.entityId });
  });
}
