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
   * **Null is a real answer and must be rendered as one.** A publication is
   * addressable only through `/articles/[publicId]`, which is briefing-only;
   * an information item has a public id and no page at all. A client that
   * fabricates a URL from `publicId` will manufacture 404s. Show an
   * unreachable hit as unreachable, or do not show it.
   */
  href: z.string().nullable(),
  title: z.string(),
  /** Reciprocal Rank Fusion score. Comparable *within* one result set and
   *  meaningless outside it — deliberately not a percentage or a confidence,
   *  and never to be shown to a reader as either. */
  score: z.number(),
});
export type SearchHit = z.infer<typeof searchHitSchema>;

export const searchResultSchema = z.object({
  query: z.string(),
  hits: z.array(searchHitSchema),
  /** Whether the semantic arm actually contributed. False means this database
   *  has no pgvector, so these are lexical results only — surfaced rather than
   *  hidden, because "no semantic results" and "semantic search is off" look
   *  identical from the outside and are very different problems. */
  semantic: z.boolean(),
});
export type SearchResult = z.infer<typeof searchResultSchema>;
