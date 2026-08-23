import { handler, parseBody, parseQuery } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { createItemSchema, listItemsSchema } from "@/server/contracts/item";
import { requireActor } from "@/server/core/auth/actor";
import { items } from "@/server/modules/items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  const filters = parseQuery(request, listItemsSchema);
  const page = await items().list(filters);
  /* The cursor is the last row's timestamp — keyset, so it is stable while
     rows are being inserted ahead of it. Absent when the page is not full. */
  const next = page.length === filters.limit ? page.at(-1)?.createdAt.toISOString() : undefined;
  return ok({ items: page, ...(next ? { nextCursor: next } : {}) });
});

export const POST = handler(async (request, ctx) => {
  const actor = requireActor(request);
  const input = await parseBody(request, createItemSchema);
  const item = await items().create(input, actor, ctx.requestId);
  return created(item, `/api/v1/items/${item.id}`);
});
