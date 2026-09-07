import "server-only";

import { db, withDatabaseRole, type Database } from "@/server/db/client";
import { eq } from "drizzle-orm";
import { consumerFor } from "@/server/jobs/consumers";
import { briefingLog } from "@/server/core/log";
import { outbox } from "@/server/db/schema";

type OutboxMessage = { outboxId?: string; topic: string; payload: unknown; entityType: string | null; entityId: string | null };
type DeliveryMetadata = { deliveryCount: number };

/** Queue delivery is at-least-once, but a permanent consumer fault must not
 * occupy a queue slot forever. The final failure remains visible in outbox. */
export const MAX_OUTBOX_CONSUMER_DELIVERIES = 8;

export function outboxRetry(metadata: DeliveryMetadata) {
  if (metadata.deliveryCount >= MAX_OUTBOX_CONSUMER_DELIVERIES) return { acknowledge: true } as const;
  return { afterSeconds: Math.min(3_600, 30 * 2 ** Math.max(0, metadata.deliveryCount - 1)) } as const;
}

function parseOutboxId(value: string | undefined): bigint | null {
  if (!value || !/^\d+$/.test(value)) return null;
  return BigInt(value);
}

function failureMessage(cause: unknown): string {
  return (cause instanceof Error ? cause.message : String(cause)).slice(0, 1_000);
}

async function recordConsumerSuccess(database: unknown, id: bigint, deliveryCount: number): Promise<void> {
  await (database as Database).update(outbox).set({
    consumerAttempts: deliveryCount,
    consumerLastError: null,
    consumedAt: new Date(),
    deadLetteredAt: null,
  }).where(eq(outbox.id, id));
}

async function recordConsumerFailure(database: unknown, id: bigint, deliveryCount: number, cause: unknown): Promise<void> {
  await (database as Database).update(outbox).set({
    consumerAttempts: deliveryCount,
    consumerLastError: failureMessage(cause),
    consumedAt: null,
    deadLetteredAt: deliveryCount >= MAX_OUTBOX_CONSUMER_DELIVERIES ? new Date() : null,
  }).where(eq(outbox.id, id));
}

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
export async function dispatchOutboxMessage(
  message: OutboxMessage,
  metadata?: DeliveryMetadata,
  database?: unknown,
): Promise<void> {
  const context = { runId: runIdOf(message.payload) };
  const fields = { topic: message.topic, outboxId: message.outboxId, entityType: message.entityType, entityId: message.entityId };
  const outboxId = parseOutboxId(message.outboxId);
  await withDatabaseRole("app_service", "service:outbox-queue", async () => {
    const consumer = consumerFor(message.topic);
    briefingLog("info", "outbox.dispatch.start", context, fields);
    const startedAt = Date.now();
    try {
      if (!consumer) {
        briefingLog("error", "outbox.dispatch.unregistered", context, fields);
        throw new Error(`No consumer registered for outbox topic "${message.topic}"`);
      }
      await consumer(message.payload, { entityType: message.entityType, entityId: message.entityId });
      if (outboxId !== null && metadata) {
        await recordConsumerSuccess(database ?? db(), outboxId, metadata.deliveryCount);
      }
      briefingLog("info", "outbox.dispatch.done", context, { ...fields, durationMs: Date.now() - startedAt });
    } catch (cause) {
      if (outboxId !== null && metadata) {
        try {
          await recordConsumerFailure(database ?? db(), outboxId, metadata.deliveryCount, cause);
        } catch (trackingCause) {
          briefingLog("error", "outbox.dispatch.tracking_failed", context, {
            ...fields,
            errorClass: trackingCause instanceof Error ? trackingCause.name : "UnknownError",
            errorMessage: failureMessage(trackingCause),
          });
        }
      }
      briefingLog("error", "outbox.dispatch.failed", context, {
        ...fields, durationMs: Date.now() - startedAt,
        errorClass: cause instanceof Error ? cause.name : "UnknownError",
        errorMessage: cause instanceof Error ? cause.message.slice(0, 300) : String(cause).slice(0, 300),
      });
      throw cause;
    }
  });
}
