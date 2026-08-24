import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { transitionNarrativeSchema } from "@/server/contracts/narrative";
import { requireActor } from "@/server/core/auth/actor";
import { narratives } from "@/server/modules/narratives";

/** The narrative, the checked claims composing it, and who has been pushing it. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  requireActor(request);
  const { id } = await params;
  return ok(await narratives().narrativeDetail(id));
});

export const PATCH = handler(async (request, ctx, { params }: { params: Promise<{ id: string }> }) => {
  const who = requireActor(request);
  const { id } = await params;
  const input = await parseBody(request, transitionNarrativeSchema);
  return ok(await narratives().transition(id, input, who, ctx.requestId));
});
