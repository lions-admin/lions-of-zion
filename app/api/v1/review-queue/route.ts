import { handler, parseBody, parseQuery } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { enqueueReviewSchema, listReviewQueueSchema } from "@/server/contracts/assessment";
import { reviewQueue } from "@/server/modules/assessments";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  const filters = parseQuery(request, listReviewQueueSchema);
  return ok({ entries: await reviewQueue().list(filters) });
});

export const POST = handler(async (request) => {
  const input = await parseBody(request, enqueueReviewSchema);
  const row = await reviewQueue().enqueue(input);
  return created(row, `/api/v1/review-queue/${row.id}`);
});
