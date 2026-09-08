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

/**
 * The site chrome indexed as publications — `site-war-update`, `site-we-are`
 * and the eight others. Historic records that share the publications table,
 * carry neither run id, and have no article to open. They are not in the
 * published set: measured live 2026-09-08, zero of 73 published records carry
 * this prefix, which is what makes the prefix safe to match on.
 *
 * Deliberately not `href === null` — that also catches editorial-run records
 * whose page exists, and matching on it hid 42 of 73 records from search. See
 * `search()` for the full account.
 */
function isSiteReference(hit: { publicId: string | null; href: string | null }): boolean {
  return hit.href === null && (hit.publicId?.startsWith("site-") ?? false);
}

/**
 * The entity types that are publications — the four `publication.kind` values.
 *
 * Spelled here rather than imported from `projection.ts` because that file's
 * copy lives inside `destinationFor`, which is index-time policy and is
 * deliberately left alone by the read-time correction below. `reindex()` uses
 * this same constant, so the two statements of the list in this file cannot
 * drift apart.
 */
const PUBLICATION_ENTITY_TYPES: readonly EntityType[] = [
  "news_update",
  "brief",
  "geopolitical_analysis",
  "scenario",
];

/**
 * Where a *reader* actually goes for this hit, computed now rather than trusted
 * from the stored projection.
 *
 * `href` is written at index time by `destinationFor`, which grants one only to
 * a publication carrying a `briefingRunId`. A record created by the whole-site
 * **editorial** run carries an `editorialRunId` instead and was therefore
 * indexed with `href: null`, even though `/articles/<publicId>` serves it
 * perfectly well. Measured on Production 2026-09-08: 41 of 73 published records
 * rendered as unclickable "Indexed · no public page" rows while their pages
 * answered 200.
 *
 * Fixing it in the projection would mean widening `destinationFor` *and*
 * reindexing every publication — and the reindex path runs through
 * `recordVersion()`, which would append a bogus version row and a fake public
 * correction entry for each one. So the correction is applied on read, and the
 * stored projection is left exactly as it is.
 *
 * **Why deriving here cannot manufacture a dead link:**
 *
 *  * Public search only ever returns *published* records — the
 *    `search_document_public_published_items` view (migration 0018) restricts
 *    it — and a published publication is precisely what `/articles/[publicId]`
 *    serves.
 *  * The site-reference publications, the one publication family that genuinely
 *    has no article, are dropped by `isSiteReference` before this runs.
 *  * Non-publication types keep whatever the projection gave them. There is no
 *    `/items/[publicId]` route, and inventing one here would not create it.
 */
function readerDestination(hit: { entityType: EntityType; publicId: string | null; href: string | null }): string | null {
  if (hit.href !== null) return hit.href;
  if (!PUBLICATION_ENTITY_TYPES.includes(hit.entityType) || !hit.publicId) return hit.href;
  return `/articles/${hit.publicId}`;
}

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
     *
     * ## Why this matches on the publicId and not on `href === null`
     *
     * The first version of this filter dropped every hit with no `href`, and
     * that hid **42 of 73 published records** from search within minutes of
     * deploying — caught by re-measuring Production rather than by any test.
     *
     * The reason is that `href` is written into the projection at *index* time
     * by `destinationFor`, which grants one only to a publication carrying a
     * `briefingRunId`. Records created by the whole-site **editorial** run
     * carry an `editorialRunId` instead, so they were indexed with
     * `href: null` even though `/articles/<publicId>` serves them perfectly
     * well — verified: the BGU aerogel record answers 200 while its search hit
     * says it has nowhere to go.
     *
     * So `href === null` conflates two different things: "there is no page"
     * and "this row was indexed before the editorial path existed". Matching
     * the site-reference prefix separates them, and it is safe to rely on
     * because those records are not in the published set at all — measured
     * live, **zero** of the 73 published records carry a `site-` publicId.
     *
     * Keeping such a record *findable* was the first half of the repair.
     * Making it clickable is the second, and it is done by
     * `readerDestination` below rather than by widening `destinationFor`:
     * the stored `href` is written at index time, so correcting it there
     * would require reindexing every publication through `recordVersion()`
     * — 41 bogus version rows and 41 fake public corrections. The reader's
     * destination is computed on read instead, and the projection is left
     * alone.
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
      /* Reader: drop the genuinely unaddressable, then repair the href of the
         records the projection understated. Internal is handed the repo's rows
         untouched — chat cites by `documentId` and must keep seeing exactly
         what it sees today. */
      const hits = audience === "reader"
        ? found
            .filter((hit) => !isSiteReference(hit))
            .slice(0, query.limit)
            .map((hit) => ({ ...hit, href: readerDestination(hit) }))
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

      if (PUBLICATION_ENTITY_TYPES.includes(entityType)) {
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
