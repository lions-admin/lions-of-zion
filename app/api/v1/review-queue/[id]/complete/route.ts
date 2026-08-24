import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { completeReviewSchema } from "@/server/contracts/assessment";
import { requireActor } from "@/server/core/auth/actor";
import { reviewQueue } from "@/server/modules/assessments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  const input = await parseBody(request, completeReviewSchema);
  return ok(await reviewQueue().complete(id, input, actor));
});
