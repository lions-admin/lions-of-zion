/**
 * What a hit is called, and what order the kinds appear in.
 *
 * The API's `entityType` is the database's vocabulary — `news_update`,
 * `geopolitical_analysis` — and it is not the reader's. Nor is a CSS
 * `text-transform` enough: "news_update" capitalises to "News_update", and the
 * site has already been bitten once by trusting a transform with an identity
 * (see the `displayName` note on `SITE_NAVIGATION`). So the mapping is written
 * down.
 *
 * All thirteen types are named even though an anonymous reader can only ever
 * be shown five of them — `search_document_public_published_items` (migration
 * 0018) restricts public search to published information items and the four
 * publication kinds. A staff-side surface reusing this list should not
 * discover that eight labels are missing.
 */

/**
 * **The import below must stay type-only.** `server/contracts/enums.ts` builds
 * every one of its Zod schemas at module scope (`enumOf(...)` is a call, so no
 * bundler may treat it as pure), which means a single *value* import from this
 * file — `ENTITY_TYPES` was one until 2026-09-03 — links the whole of `zod`
 * into the client graph. This module is reached from `SearchPanel` →
 * `SearchDialog` → `SearchLauncher` → `SiteHeader`, and `SiteHeader` is on
 * every public route, so that one word cost **62.7 kB gzip / 278.6 kB raw of
 * first-load JS on all thirty of them** (measured, `docs/performance-budgets.md`).
 * A type import is erased and costs nothing.
 */
import type { EntityType } from "@/server/contracts/enums";
import type { SearchState } from "./useSearch";

const LABELS: Record<EntityType, string> = {
  information_item: "Claim",
  item_assessment: "Assessment",
  evidence: "Evidence",
  source: "Source",
  event: "Event",
  actor: "Actor",
  narrative: "Narrative",
  news_update: "Update",
  brief: "Brief",
  geopolitical_analysis: "Analysis",
  scenario: "Scenario",
  translation: "Translation",
  report: "Report",
  system: "System",
};

/**
 * The order groups appear in, and it is an editorial ranking rather than the
 * enum's order: a reader searching this corpus is looking for what the desk
 * concluded before what it holds. Published writing first, then the claims
 * those pieces assess, then everything supporting.
 */
const ORDER: EntityType[] = [
  "brief",
  "geopolitical_analysis",
  "news_update",
  "scenario",
  "information_item",
  "narrative",
  "evidence",
  "item_assessment",
  "event",
  "actor",
  "source",
  "translation",
  "report",
];

export function entityLabel(type: EntityType): string {
  return LABELS[type] ?? type;
}

/** Plural, for a group heading with a count beside it. */
export function entityLabelPlural(type: EntityType): string {
  const label = entityLabel(type);
  return label === "Analysis" ? "Analyses" : `${label}s`;
}

export function entityRank(type: EntityType): number {
  const index = ORDER.indexOf(type);
  if (index !== -1) return index;
  /* The tiebreak for a type `ORDER` forgot. It reads `LABELS`, not the
     `ENTITY_TYPES` array it used to, because `LABELS` is declared
     `Record<EntityType, string>` — TypeScript already refuses to compile it
     unless it names every type — so its key order is an equally complete and
     equally stable fallback that carries no second copy of the enum and no
     import of `zod`. */
  return ORDER.length + Object.keys(LABELS).indexOf(type);
}

export interface HitGroup<T> {
  type: EntityType;
  items: T[];
}

/**
 * Groups hits by kind while keeping relevance order inside each group.
 *
 * Grouping is done here, over the hits already returned, rather than by
 * re-querying with `entityType`. Two reasons: a filter that costs a round trip
 * is not a filter a reader will use twice, and the server applies its type
 * filter *after* fusion, so a filtered request answers a slightly different
 * question than the one the reader thinks they asked.
 */
export function groupByEntity<T extends { entityType: EntityType }>(hits: T[]): HitGroup<T>[] {
  const groups = new Map<EntityType, T[]>();
  for (const hit of hits) {
    const bucket = groups.get(hit.entityType);
    if (bucket) bucket.push(hit);
    else groups.set(hit.entityType, [hit]);
  }
  return [...groups.entries()]
    .map(([type, items]) => ({ type, items }))
    .sort((a, b) => entityRank(a.type) - entityRank(b.type));
}

/* ── What the panel says about the answer, above the answer ───────────────
 *
 * Both sentences below used to be rendered in the panel's footer, under the
 * whole result list. On a phone that is not a footer, it is a deletion: at
 * 375 an eight-result answer put it 2,166px down the document, so the only
 * reader who ever met "semantic matching is unavailable in this deployment"
 * was one who had already scrolled past every result it qualifies. Which
 * matcher answered is a property of the answer, so it is stated with the
 * answer's count and above the list (VA-17).
 *
 * Written here rather than inline in the panel because it is the one part of
 * this that is pure — a function of the state, the count and the query — and
 * so the one part that can be tested without a DOM.
 */

/** Blank where the panel has nothing honest to say; never a placeholder. */
export interface ResultStatus {
  /**
   * `null` when no answer is on screen, and also on an empty result set —
   * the empty state names the query in a full sentence, and "0 results"
   * above it would be the same fact twice in two registers.
   */
  count: string | null;
  /**
   * `null` only on a failed request. A search that did not complete has no
   * matcher to report, and claiming one above "The search failed" would
   * describe a capability the reader did not get.
   */
  matching: string | null;
}

const MATCHING_SEMANTIC = "Matching on words, names and meaning.";
const MATCHING_LEXICAL = "Matching on words and names.";
const MATCHING_FALLBACK =
  "Showing word-and-name matches. Semantic matching is unavailable in this deployment.";

export function resultStatus(
  state: SearchState,
  hitCount: number,
  answered: string,
  semantic: boolean,
): ResultStatus {
  const answering = state === "results" || state === "fallback" || state === "no-results";
  return {
    count:
      answering && hitCount > 0
        ? `${hitCount} ${hitCount === 1 ? "result" : "results"}${answered ? ` for “${answered}”` : ""}`
        : null,
    matching:
      state === "error"
        ? null
        : state === "fallback"
          ? MATCHING_FALLBACK
          : semantic
            ? MATCHING_SEMANTIC
            : MATCHING_LEXICAL,
  };
}
