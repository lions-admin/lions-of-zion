import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { publications } from "@/server/modules/publications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  requireActor(request);
  const { id } = await params;
  return ok(await publications().traceability(id));
});
