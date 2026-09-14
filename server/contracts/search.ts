/**
 * Search — request and response shapes. Zod only.
 */

import { z } from "zod";
import { entityTypeSchema } from "./enums";
import { uuidSchema } from "./item";

export const searchQuerySchema = z.object({
  q: z.string().trim().min(1).max(500),
  entityType: entityTypeSchema.optional(),
  limit: z.coerce.number().int().min(1).max(50).default(25),
  /**
   * Where the page starts. **Optional and deliberately undefaulted.**
   *
   * `SearchQuery` is the inferred *output* type, and a `.default()` makes a
   * field required in it — which would break the one caller that builds this
   * object by hand rather than parsing it (`retrieve` in
   * `server/modules/chat/index.ts` passes `{ q, limit }`). The service reads
   * `query.offset ?? 0`; a reader's first page therefore costs no parameter.
   *
   * Capped well below the retrieval pool: paging past the candidate ceiling
   * returns nothing, so there is no reason to accept a number that can only
   * describe an empty page.
   */
  offset: z.coerce.number().int().min(0).max(500).optional(),
});
export type SearchQuery = z.infer<typeof searchQuerySchema>;

export const searchHitSchema = z.object({
  documentId: uuidSchema,
  entityType: entityTypeSchema,
  entityId: uuidSchema,
  /** The entity's stable public identifier, where it has one. */
  publicId: z.string().nullable(),
  /**
   * Where a reader goes to read this — the destination the hit resolves to,
   * written into the projection rather than derived by a client from
   * `entityType` + `entityId`, neither of which anything public can resolve.
   *
   * **For the `"reader"` audience this is never null**: a record with no
   * destination is not a result, and the service drops it before answering
   * (owner ruling, 2026-09-14). It stays nullable on the contract because the
   * `"internal"` audience — chat, which cites by `documentId` — is still
   * handed the projection's own answer, null included.
   *
   * A client must still never fabricate a URL from `publicId`. An information
   * item has a public id and no page at all; the historic site-reference
   * publications have neither.
   */
  href: z.string().nullable(),
  title: z.string(),
  /**
   * The record's own standfirst, where it has one, so a result can be read
   * rather than merely identified.
   *
   * **Not a query-derived snippet**, which is why it is not called one: it is
   * the same sentence the record shows on its own page and in every card, so a
   * reader who recognises it in search recognises it again when they arrive.
   * Null is common and must render as nothing — `SearchResults` printed the
   * destination *path* in this slot until 2026-09-14, so a reader met
   * `/articles/how-to-read-the-october-7-archive-…` where prose belongs.
   */
  summary: z.string().nullable(),
  /** Reciprocal Rank Fusion score. Comparable *within* one result set and
   *  meaningless outside it — deliberately not a percentage or a confidence,
   *  and never to be shown to a reader as either. */
  score: z.number(),
});
export type SearchHit = z.infer<typeof searchHitSchema>;

/**
 * How many results of one kind this query has, counted over the whole
 * addressable result set rather than over the page being shown.
 *
 * It exists so the kind filter can offer exactly the kinds that are there,
 * with their real counts. A filter chip that leads to an empty list is a
 * control that lies about the corpus, and this corpus is small enough that it
 * would happen constantly.
 */
export const searchFacetSchema = z.object({
  entityType: entityTypeSchema,
  count: z.number().int().nonnegative(),
});
export type SearchFacet = z.infer<typeof searchFacetSchema>;

export const searchResultSchema = z.object({
  query: z.string(),
  hits: z.array(searchHitSchema),
  /** Whether the semantic arm actually contributed. False means this database
   *  has no pgvector, so these are lexical results only — surfaced rather than
   *  hidden, because "no semantic results" and "semantic search is off" look
   *  identical from the outside and are very different problems. */
  semantic: z.boolean(),
  /**
   * Every result this query has *after* filtering, not the number on this
   * page. The count a reader is shown must describe what they can reach: the
   * panel announced "25 results" while nineteen of them were unopenable.
   */
  total: z.number().int().nonnegative(),
  /**
   * `total` is a floor rather than a total — retrieval hit its candidate
   * ceiling, so there are at least this many and possibly more.
   *
   * Reported rather than hidden for the same reason `semantic` is: "34
   * results" and "at least 34 results" are different claims, and only one of
   * them is true at the ceiling.
   */
  totalIsFloor: z.boolean(),
  /** The window `hits` came from, echoed so a client renders a page number it
   *  knows the server agreed to rather than the one it asked for. */
  offset: z.number().int().nonnegative(),
  limit: z.number().int().positive(),
  /** Counts per kind over the whole filtered set — see `searchFacetSchema`.
   *  Computed *before* `entityType` narrows the set, so selecting a filter
   *  never empties the row of filters that selected it. */
  facets: z.array(searchFacetSchema),
});
export type SearchResult = z.infer<typeof searchResultSchema>;
