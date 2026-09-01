import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireCron } from "@/server/http/internal-guard";
import { enqueueEditorialPipeline } from "@/server/modules/briefing/jobs";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = handler(async (request) => {
  requireCron(request);
  return ok(await enqueueEditorialPipeline());
});
