import "server-only";

/**
 * Search and reindexing. Owns policy; owns no SQL.
 *
 * The embedder is a constructor parameter, defaulting to none. Phase 5 ships
 * the whole retrieval and backlog machinery with no way to compute an
 * embedding — that arrives in Phase 6 with the AI Gateway client, and is
 * injected here rather than imported, so this module never depends on the
 * gateway and the tests never need one.
 */

import { eq } from "drizzle-orm";
import { evidence, informationItem } from "@/server/db/schema";
import { searchRepo } from "./repo";
import { isIndexable, projectEvidence, projectItem } from "./projection";
import type { EntityType } from "@/server/contracts/enums";
import type { SearchQuery, SearchResult } from "@/server/contracts/search";
import type { Evidence, InformationItem } from "@/server/db/schema";

/** What Phase 6 will supply: text in, one vector out. */
export type Embedder = (text: string) => Promise<number[]>;

type Loader = {
  select: (f?: unknown) => {
    from: (t: unknown) => { where: (w: unknown) => { limit: (n: number) => Promise<unknown[]> } };
  };
};

export function searchService(db: unknown, opts: { embed?: Embedder } = {}) {
  const repo = searchRepo(db);
  const loader = db as Loader;

  return {
    async search(query: SearchQuery): Promise<SearchResult> {
      const semantic = await repo.hasSemanticArm();

      /* An embedding is only computed when both halves are actually present:
         a database that can store it and an embedder that can produce it.
         Otherwise the query runs lexical-only against the identical function. */
      const queryEmbedding = semantic && opts.embed ? await opts.embed(query.q) : null;

      const hits = await repo.search(query.q, queryEmbedding, query.limit, query.entityType);
      return { query: query.q, hits, semantic: semantic && queryEmbedding !== null };
    },

    /**
     * Rebuilds one entity's projection.
     *
     * Called by the `search.reindex` consumer, which is fed by the outbox —
     * so every versioned write already queues this, and has since Phase 2.
     * An entity that has become unindexable (reclassified restricted, or
     * deleted) is removed rather than skipped: leaving a stale row would keep
     * the old title searchable forever.
     */
    async reindex(entityType: EntityType, entityId: string): Promise<"indexed" | "removed"> {
      if (entityType === "information_item") {
        const [row] = (await loader
          .select()
          .from(informationItem)
          .where(eq(informationItem.id, entityId))
          .limit(1)) as InformationItem[];
        if (!row) {
          await repo.remove(entityType, entityId);
          return "removed";
        }
        await repo.upsert(projectItem(row));
        return "indexed";
      }

      if (entityType === "evidence") {
        const [row] = (await loader
          .select()
          .from(evidence)
          .where(eq(evidence.id, entityId))
          .limit(1)) as Evidence[];
        if (!row || !isIndexable(row)) {
          await repo.remove(entityType, entityId);
          return "removed";
        }
        await repo.upsert(projectEvidence(row));
        return "indexed";
      }

      /* Every other entity type is queued by `recordVersion` but has no
         projection yet. Removing rather than throwing keeps the consumer
         idempotent for types whose surfaces arrive in Phase 8. */
      await repo.remove(entityType, entityId);
      return "removed";
    },

    /**
     * Embeds as much of the backlog as it can, and reports honestly when it
     * cannot embed at all.
     *
     * Never throws for "not configured" — the cron that calls this runs every
     * few minutes whether or not the gateway exists, and a scheduled job that
     * alarms on a known, chosen state is a job people learn to ignore.
     */
    async processEmbeddingBacklog(
      limit = 50,
    ): Promise<{ pending: number; embedded: number; skipped: string | null }> {
      if (!(await repo.hasSemanticArm())) {
        return { pending: 0, embedded: 0, skipped: "this database has no pgvector" };
      }
      if (!opts.embed) {
        const pending = (await repo.embeddingBacklog(limit)).length;
        return { pending, embedded: 0, skipped: "no embedder is configured (Phase 6)" };
      }

      const batch = await repo.embeddingBacklog(limit);
      let embedded = 0;
      for (const doc of batch) {
        const vector = await opts.embed(`${doc.title}\n${doc.body}`);
        await repo.storeEmbedding(doc.id, vector);
        embedded++;
      }
      return { pending: batch.length, embedded, skipped: null };
    },

    /** For the health endpoint and the tests. */
    hasSemanticArm: () => repo.hasSemanticArm(),
  };
}

export type SearchService = ReturnType<typeof searchService>;
