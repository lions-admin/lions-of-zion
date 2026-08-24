import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { itemAssessments } from "@/server/modules/assessments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(
  async (request, ctx, { params }: { params: Promise<{ id: string; assessmentId: string }> }) => {
    const { assessmentId } = await params;
    const actor = requireActor(request);
    return ok(await itemAssessments().approve(assessmentId, actor, ctx.requestId));
  },
);
