import "server-only";

/**
 * Emitting work to be done later, atomically with the change that caused it.
 *
 * Publishing to a queue after the transaction commits is not atomic: a crash
 * in the gap loses the job with no error and no trace, because the write
 * succeeded. Writing the intent inside the transaction and draining it
 * separately is the only way ingestion → reindex → embed survives a restart.
 */

import { outbox } from "@/server/db/schema";
import type { EntityType } from "@/server/contracts/enums";

export const TOPICS = {
  searchReindex: "search.reindex",
  embeddingRefresh: "embedding.refresh",
  itemDetected: "item.detected",
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
