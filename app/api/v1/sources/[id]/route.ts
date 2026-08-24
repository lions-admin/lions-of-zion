import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { updateSourceSchema } from "@/server/contracts/source";
import { requireActor } from "@/server/core/auth/actor";
import { sources } from "@/server/modules/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return ok(await sources().get(id));
});

export const PATCH = handler(async (request, ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  const input = await parseBody(request, updateSourceSchema);
  return ok(await sources().update(id, input, actor, ctx.requestId));
});
