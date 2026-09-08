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
import { evidence, informationItem, narrative, publication } from "@/server/db/schema";
import { searchRepo } from "./repo";
import { isIndexable, projectEvidence, projectItem, projectNarrative, projectPublication } from "./projection";
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
    /**
     * @param audience `"reader"` drops hits with no destination — T-9.
     *
     * Measured on Production 2026-09-08: a query matching nothing returned ten
     * hits and the live region announced "10 results", because the historic
     * site-reference publications (`site-war-update`, `site-we-are`, …) sit in
     * the same table, carry no `briefingRunId`, and so resolve to `href: null`
     * by `destinationFor`'s deliberate rule that a manufactured dead link is
     * worse than none. Their rank-floor scores (~0.016) put them at the bottom
     * of every result set and, when nothing else matched, they *were* the
     * result set — so the client's no-results state was unreachable, the first
     * row was auto-highlighted and `aria-disabled`, and one of them was the
     * retired `war_update` section. They also leaked into genuine result sets.
     *
     * §1b correction 6 of the PUXI plan recorded that these rows "do not
     * render" and closed VA-58.1 on that basis. They render. The correction was
     * measured against the component, which is innocent — it renders what the
     * API hands it.
     *
     * Scoped by audience rather than filtered globally: chat cites by
     * `documentId`, never by `href`, so Ask the Desk may legitimately ground an
     * answer in a record with no public page. Only a *reader* being offered a
     * row they cannot open is the defect.
     */
    async search(query: SearchQuery, audience: "reader" | "internal" = "internal"): Promise<SearchResult> {
      const semantic = await repo.hasSemanticArm();

      /* An embedding is only computed when both halves are actually present:
         a database that can store it and an embedder that can produce it.
         Otherwise the query runs lexical-only against the identical function. */
      const queryEmbedding = semantic && opts.embed ? await opts.embed(query.q) : null;

      /* Over-fetch before dropping the unaddressable, or a page of results
         could come back short simply because dead rows occupied the window. */
      const window = audience === "reader" ? Math.min(query.limit * 2 + 10, 100) : query.limit;
      const found = await repo.search(query.q, queryEmbedding, window, query.entityType);
      const hits = audience === "reader"
        ? found.filter((hit) => hit.href !== null).slice(0, query.limit)
        : found;
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
        if (!row || (row.status !== "published" && row.status !== "updated")) {
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

      if (entityType === "narrative") {
        const [row] = (await loader
          .select()
          .from(narrative)
          .where(eq(narrative.id, entityId))
          .limit(1)) as { id: string; title: string; summary: string | null; language: string }[];
        if (!row) {
          await repo.remove(entityType, entityId);
          return "removed";
        }
        await repo.upsert(projectNarrative(row));
        return "indexed";
      }

      if (["news_update", "brief", "geopolitical_analysis", "scenario"].includes(entityType)) {
        const [row] = (await loader
          .select()
          .from(publication)
          .where(eq(publication.id, entityId))
          .limit(1)) as (typeof publication.$inferSelect)[];
        if (!row || row.kind !== entityType || (row.status !== "published" && row.status !== "updated")) {
          await repo.remove(entityType, entityId);
          return "removed";
        }
        await repo.upsert(projectPublication(row));
        return "indexed";
      }

      /* Every other entity type is queued by `recordVersion` but has no
         projection yet. Removing rather than throwing keeps the consumer
         idempotent for types whose surfaces arrive later. */
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
