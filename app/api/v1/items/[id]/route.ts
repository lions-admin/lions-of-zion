import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { updateItemSchema } from "@/server/contracts/item";
import { requireActor } from "@/server/core/auth/actor";
import { items } from "@/server/modules/items";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Params = { params: Promise<{ id: string }> };

export const GET = handler(async (_request, _ctx, { params }: Params) => {
  const { id } = await params;
  return ok(await items().get(id));
});

export const PATCH = handler(async (request, ctx, { params }: Params) => {
  const { id } = await params;
  const actor = requireActor(request);
  const input = await parseBody(request, updateItemSchema);
  return ok(await items().update(id, input, actor, ctx.requestId));
});
