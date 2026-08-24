import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { updatePublicationSchema } from "@/server/contracts/publication";
import { requireActor } from "@/server/core/auth/actor";
import { publications } from "@/server/modules/publications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return ok(await publications().get(id));
});

export const PATCH = handler(async (request, ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  const input = await parseBody(request, updatePublicationSchema);
  return ok(await publications().update(id, input, actor, ctx.requestId));
});
