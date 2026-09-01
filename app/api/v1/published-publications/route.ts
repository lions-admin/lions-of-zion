import { handler, parseQuery } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { encodePublicPublicationCursor, listPublicPublicationsSchema } from "@/server/contracts/publication";
import { listBriefingPublications } from "@/lib/publications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Anonymous readers see the narrow public projection only. */
export const GET = handler(async (request) => {
  const filters = parseQuery(request, listPublicPublicationsSchema);
  const query = new URL(request.url).search;
  const rows = await listBriefingPublications(query);
  const next = rows.length === filters.limit && rows.at(-1)
    ? encodePublicPublicationCursor(rows.at(-1)!)
    : undefined;
  return ok({ publications: rows, ...(next ? { nextCursor: next } : {}) });
});
