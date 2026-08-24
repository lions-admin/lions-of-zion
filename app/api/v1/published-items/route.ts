import { handler, parseQuery } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { listPublishedItemsSchema } from "@/server/contracts/item";
import { items } from "@/server/modules/items";

/**
 * The public read surface. No `requireActor` — `published_item` (the SQL
 * view underneath this) already filters to `PUBLIC_STATUSES`, so there is
 * nothing here an anonymous reader should not see.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  const { limit } = parseQuery(request, listPublishedItemsSchema);
  return ok({ items: await items().listPublished(limit) });
});
