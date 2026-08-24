import { handler, parseBody } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { createAssessmentSchema } from "@/server/contracts/assessment";
import { requireActor } from "@/server/core/auth/actor";
import { itemAssessments } from "@/server/modules/assessments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return ok({ assessments: await itemAssessments().history(id) });
});

export const POST = handler(async (request, ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  const input = await parseBody(request, createAssessmentSchema);
  const row = await itemAssessments().create(id, input, actor, ctx.requestId);
  return created(row, `/api/v1/items/${id}/assessments/${row.id}`);
});
