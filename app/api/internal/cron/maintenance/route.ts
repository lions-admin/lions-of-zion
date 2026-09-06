import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireCron } from "@/server/http/internal-guard";
import { runMaintenance } from "@/server/core/maintenance";
import { recoverAndDispatchSourceCollectionJobs } from "@/server/modules/briefing/jobs";
import { evaluateAndQueueBriefingAlerts } from "@/server/modules/briefing/alerts";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = handler(async (request) => {
  requireCron(request);
  const [maintenance, briefingJobs, briefingAlerts] = await Promise.all([
    runMaintenance(),
    recoverAndDispatchSourceCollectionJobs(),
    evaluateAndQueueBriefingAlerts(),
  ]);
  return ok({ maintenance, briefingJobs, briefingAlerts });
});
