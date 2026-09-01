import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { updatePublicationSchema } from "@/server/contracts/publication";
import { requireActor } from "@/server/core/auth/actor";
import { requirePublicMutationEnvironment } from "@/server/core/public-mutation-guard";
import { publications } from "@/server/modules/publications";
import { expirePublicPublicationCache } from "@/server/core/publication-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return ok(await publications().get(id));
});

export const PATCH = handler(async (request, ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  requirePublicMutationEnvironment();
  const input = await parseBody(request, updatePublicationSchema);
  const row = await publications().update(id, input, actor, ctx.requestId);
  expirePublicPublicationCache();
  return ok(row);
});

export const DELETE = handler(async (request, ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  requirePublicMutationEnvironment();
  await publications().remove(id, actor, ctx.requestId);
  expirePublicPublicationCache();
  return ok({ deleted: true, id });
});
