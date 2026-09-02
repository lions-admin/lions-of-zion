import "server-only";

/**
 * What each entity looks like once flattened for search.
 *
 * Pure functions over already-loaded rows — no database, no I/O — so the
 * "what text is actually searchable" decision is testable on its own and does
 * not have to be inferred from an index that looks plausible.
 *
 * The rule for every projection: include the words a person would search for,
 * exclude the words that would match everything. Status names, verdict labels
 * and UUIDs are deliberately absent — a search for `verified` should not
 * return every verified item ahead of an article about verification.
 */

import type { EntityType } from "@/server/contracts/enums";
import type { Evidence, InformationItem } from "@/server/db/schema";

export type Projection = {
  entityType: EntityType;
  entityId: string;
  title: string;
  body: string;
  language: string;
  /** The entity's stable public identifier, where it has one. Stored even
   *  when nothing can yet be addressed with it, so the day a route exists is
   *  a backfill and not a schema change. */
  publicId: string | null;
  /** Where a reader goes to read this — or null when there is nowhere. See
   *  `destinationFor` below. */
  href: string | null;
};

/**
 * The one place that knows what a search hit resolves to.
 *
 * Held as a function rather than inlined per projection so that the set of
 * addressable entity types is readable in one screen, and so the answer for
 * an unaddressable one is written down rather than implied by omission:
 *
 *   * **publications** live at `/articles/[publicId]` — but only when they
 *     carry a `briefingRunId`. That route is deliberately briefing-only
 *     (`getBriefingPublicDetail`), and the historic site-reference
 *     publications share the table and 404 there. A href for one of those
 *     would be a manufactured dead link, which is worse than no href.
 *   * **information items** have a public id and no public page. There is no
 *     `/items/[publicId]`, and inventing one here would not create it.
 *   * **evidence and narratives** are never returned to an anonymous reader
 *     at all — `search_document_public_published_items` (migration 0018)
 *     restricts public search to published items and publications — so their
 *     destination is moot rather than missing.
 */
export function destinationFor(
  entityType: EntityType,
  entity: { publicId?: string | null; briefingRunId?: string | null },
): { publicId: string | null; href: string | null } {
  const publicId = entity.publicId ?? null;
  const isPublication =
    entityType === "news_update" ||
    entityType === "brief" ||
    entityType === "geopolitical_analysis" ||
    entityType === "scenario";

  if (isPublication && publicId && entity.briefingRunId) {
    return { publicId, href: `/articles/${publicId}` };
  }
  return { publicId, href: null };
}

/** Joins the parts that carry meaning, dropping blanks so the body never
 *  contains a stray double newline that shifts nothing but the hash. */
const join = (...parts: (string | null | undefined)[]): string =>
  parts.map((p) => p?.trim()).filter((p): p is string => Boolean(p)).join("\n");

export function projectItem(item: InformationItem): Projection {
  return {
    entityType: "information_item",
    entityId: item.id,
    title: item.title,
    /* `canonical_text` is the claim as it was actually made — the thing a
       reader is most likely to paste into a search box, so it leads. */
    body: join(item.canonicalText, item.summary),
    language: item.language,
    ...destinationFor("information_item", item),
  };
}

/** A narrative is searchable by its theme, not by its verdict — it has none.
 *  What a person searches for here is the framing itself ("staged footage",
 *  "crisis actors"), which lives in the title and summary. */
export function projectNarrative(narrative: {
  id: string;
  publicId?: string | null;
  title: string;
  summary: string | null;
  language: string;
}): Projection {
  return {
    entityType: "narrative",
    entityId: narrative.id,
    title: narrative.title,
    body: join(narrative.summary),
    language: narrative.language,
    ...destinationFor("narrative", narrative),
  };
}

export function projectEvidence(evidence: Evidence): Projection {
  return {
    entityType: "evidence",
    entityId: evidence.id,
    title: evidence.title,
    body: join(evidence.excerpt),
    language: evidence.language,
    /* Evidence carries no public identifier at all — it is reached through
       the item it supports, never on its own. */
    publicId: null,
    href: null,
  };
}

export function projectPublication(publication: {
  id: string;
  publicId: string;
  briefingRunId?: string | null;
  kind: "news_update" | "brief" | "geopolitical_analysis" | "scenario";
  title: string;
  summary: string | null;
  body: string;
  language: string;
}): Projection {
  return {
    entityType: publication.kind,
    entityId: publication.id,
    title: publication.title,
    body: join(publication.summary, publication.body),
    language: publication.language,
    ...destinationFor(publication.kind, publication),
  };
}

/**
 * Whether this entity may be projected at all.
 *
 * Restricted and secret evidence is never indexed. The database already
 * refuses it a `url` or a `blob_url`, and an index entry is the same kind of
 * leak by a different route: a search result is a link, and a title is often
 * the whole disclosure.
 */
export function isIndexable(entity: { dataClass?: string | null }): boolean {
  const dataClass = entity.dataClass;
  return dataClass !== "restricted" && dataClass !== "secret";
}
