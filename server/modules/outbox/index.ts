import "server-only";

import { withDatabaseRole } from "@/server/db/client";
import { consumerFor } from "@/server/jobs/consumers";
import { briefingLog } from "@/server/core/log";

type OutboxMessage = { outboxId?: string; topic: string; payload: unknown; entityType: string | null; entityId: string | null };

/** The one identifier a consumer's log line may carry besides the row's own:
 *  editorial topics name the durable run in their payload, and that is what
 *  an operator searches the logs for. Never the payload itself. */
function runIdOf(payload: unknown): string | undefined {
  const runId = (payload as { runId?: unknown } | null)?.runId;
  return typeof runId === "string" ? runId : undefined;
}

/** The outbox module owns the service identity required to execute a durable
 * message. Queue routes only authenticate the callback and hand it here.
 *
 * Both ends of a consumer are logged — selected, then completed or failed —
 * so a queue callback that reached the function but never its consumer is
 * distinguishable from one the queue never made. Until 2026-09-07 there was
 * nothing here to distinguish them by, and the queue had never once called. */
export async function dispatchOutboxMessage(message: OutboxMessage): Promise<void> {
  const context = { runId: runIdOf(message.payload) };
  const fields = { topic: message.topic, outboxId: message.outboxId, entityType: message.entityType, entityId: message.entityId };
  await withDatabaseRole("app_service", "service:outbox-queue", async () => {
    const consumer = consumerFor(message.topic);
    if (!consumer) {
      briefingLog("error", "outbox.dispatch.unregistered", context, fields);
      throw new Error(`No consumer registered for outbox topic "${message.topic}"`);
    }
    briefingLog("info", "outbox.dispatch.start", context, fields);
    const startedAt = Date.now();
    try {
      await consumer(message.payload, { entityType: message.entityType, entityId: message.entityId });
      briefingLog("info", "outbox.dispatch.done", context, { ...fields, durationMs: Date.now() - startedAt });
    } catch (cause) {
      briefingLog("error", "outbox.dispatch.failed", context, {
        ...fields, durationMs: Date.now() - startedAt,
        errorClass: cause instanceof Error ? cause.name : "UnknownError",
        errorMessage: cause instanceof Error ? cause.message.slice(0, 300) : String(cause).slice(0, 300),
      });
      throw cause;
    }
  });
}
