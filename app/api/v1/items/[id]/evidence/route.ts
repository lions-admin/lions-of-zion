import { handler, parseBody } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { linkEvidenceSchema } from "@/server/contracts/assessment";
import { requireActor } from "@/server/core/auth/actor";
import { itemEvidenceLinks } from "@/server/modules/assessments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return ok({ evidence: await itemEvidenceLinks().list(id) });
});

export const POST = handler(async (request, ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  const input = await parseBody(request, linkEvidenceSchema);
  const row = await itemEvidenceLinks().link(id, input, actor, ctx.requestId);
  return created(row, `/api/v1/items/${id}/evidence`);
});
