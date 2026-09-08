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
 * see. Database role switching for RLS remains a separate hardening task.
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
  /* `"reader"` names this endpoint's audience; the rule that follows from it
     — a hit with no destination is not a result — lives in the service. This
     is the anonymous reader's search, so a row it cannot open is noise at
     best: see the service for what that was doing to the no-match state. */
  return ok(await search().search(query, "reader"));
});
