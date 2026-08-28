import { handler, parseQuery } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { listPublicPublicationsSchema } from "@/server/contracts/publication";
import { publications } from "@/server/modules/publications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** Anonymous readers see the narrow public projection only. */
export const GET = handler(async (request) => {
  const filters = parseQuery(request, listPublicPublicationsSchema);
  const rows = await publications().listPublic(filters);
  const next = rows.length === filters.limit ? rows.at(-1)?.publishedAt : undefined;
  return ok({ publications: rows, ...(next ? { nextCursor: next } : {}) });
});
