import { handler, parseBody, parseQuery } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { enqueueReviewSchema, listReviewQueueSchema } from "@/server/contracts/assessment";
import { requireActor } from "@/server/core/auth/actor";
import { reviewQueue } from "@/server/modules/assessments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* The review queue is internal work-in-progress: what is still being checked,
   and what nobody has picked up. That is not a public reading. */
export const GET = handler(async (request) => {
  requireActor(request);
  const filters = parseQuery(request, listReviewQueueSchema);
  return ok({ entries: await reviewQueue().list(filters) });
});

export const POST = handler(async (request) => {
  requireActor(request);
  const input = await parseBody(request, enqueueReviewSchema);
  const row = await reviewQueue().enqueue(input);
  return created(row, `/api/v1/review-queue/${row.id}`);
});
