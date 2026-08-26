import { handler, parseQuery } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { searchQuerySchema } from "@/server/contracts/search";
import { search } from "@/server/modules/search";
import { bucketFor, SEARCH_QUERIES } from "@/server/core/rate-limit";
import { rateLimit } from "@/server/modules/reports";

/**
 * Hybrid retrieval over the search projection.
 *
 * No `requireActor`: the projection contains only indexable material —
 * restricted and secret evidence is refused a row at all by
 * `isIndexable()` — so there is nothing here an anonymous reader should not
 * see. Row-level filtering by role arrives with RLS in Phase 8.
 *
 * The response carries `semantic: false` when this deployment has no
 * pgvector, rather than quietly returning lexical results as though they were
 * the whole answer.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  await rateLimit(bucketFor(request, "search"), SEARCH_QUERIES);
  const query = parseQuery(request, searchQuerySchema);
  return ok(await search().search(query));
});
