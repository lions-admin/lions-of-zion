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
};

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
  };
}

/** A narrative is searchable by its theme, not by its verdict — it has none.
 *  What a person searches for here is the framing itself ("staged footage",
 *  "crisis actors"), which lives in the title and summary. */
export function projectNarrative(narrative: {
  id: string;
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
  };
}

export function projectEvidence(evidence: Evidence): Projection {
  return {
    entityType: "evidence",
    entityId: evidence.id,
    title: evidence.title,
    body: join(evidence.excerpt),
    language: evidence.language,
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
