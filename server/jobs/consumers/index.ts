import "server-only";

/**
 * What happens when an outbox message is actually delivered.
 *
 * One entry per topic in `server/core/outbox.ts::TOPICS`. A topic with no
 * entry here is a bug — the queue route throws loudly rather than silently
 * acknowledging a message nothing handled. A topic whose real work has not
 * been built yet gets an explicit placeholder instead of being left out, so
 * "not implemented" and "forgotten" cannot look the same from the queue's
 * side.
 *
 * Handlers call module services, never `server/db` directly — this registry
 * is orchestration, and an editorial `if` inside it would put policy in the
 * one file that is supposed to have none.
 */

import { TOPICS } from "@/server/core/outbox";

export type ConsumerContext = { entityType: string | null; entityId: string | null };
export type Consumer = (payload: unknown, ctx: ConsumerContext) => Promise<void>;

const CONSUMERS: Record<string, Consumer> = {
  [TOPICS.searchReindex]: async () => {
    // Reindexing arrives in Phase 5 with search_document and its projections.
  },
  [TOPICS.embeddingRefresh]: async () => {
    // Embeddings arrive in Phase 6 with the AI Gateway client.
  },
  [TOPICS.itemDetected]: async () => {
    // Reserved for a future notification job; nothing subscribes yet.
  },
};

export function consumerFor(topic: string): Consumer | undefined {
  return CONSUMERS[topic];
}
