import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireCron } from "@/server/http/internal-guard";
import { runMaintenance } from "@/server/core/maintenance";
import { recoverAndDispatchSourceCollectionJobs } from "@/server/modules/briefing/jobs";
import { evaluateAndQueueBriefingAlerts } from "@/server/modules/briefing/alerts";
import { reverifyDisabledSources } from "@/server/modules/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = handler(async (request) => {
  requireCron(request);
  const [maintenance, briefingJobs, sourceReverification] = await Promise.all([
    runMaintenance(),
    recoverAndDispatchSourceCollectionJobs(),
    reverifyDisabledSources(),
  ]);
  /* After the sweeps, so a job discarded or a source reactivated a moment
   * ago is already reflected in what the alerts say. */
  const briefingAlerts = await evaluateAndQueueBriefingAlerts();
  return ok({ maintenance, briefingJobs, sourceReverification, briefingAlerts });
});
