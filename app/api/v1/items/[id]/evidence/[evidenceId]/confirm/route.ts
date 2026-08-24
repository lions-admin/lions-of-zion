import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { itemEvidenceLinks } from "@/server/modules/assessments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(
  async (request, ctx, { params }: { params: Promise<{ id: string; evidenceId: string }> }) => {
    const { id, evidenceId } = await params;
    const actor = requireActor(request);
    return ok(await itemEvidenceLinks().confirm(id, evidenceId, actor, ctx.requestId));
  },
);
