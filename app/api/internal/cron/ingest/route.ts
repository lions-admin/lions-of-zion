import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireCron } from "@/server/http/internal-guard";
import { briefingFeatures } from "@/server/core/config";
import { enqueueDueCollectionJobs, recoverAndDispatchSourceCollectionJobs } from "@/server/modules/briefing/jobs";

/**
 * Walks every active source of every registered connector kind and runs it.
 *
 * One route rather than one per source: `vercel.json` only has to know about
 * this schedule, and adding a source is an INSERT, never a new cron entry.
 * A failure on one source is caught and reported per-source — one dead feed
 * must not take the rest of the run down with it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = handler(async (request) => {
  requireCron(request);
  if (!briefingFeatures().collection) {
    return ok({ ranAt: new Date().toISOString(), status: "paused", results: [] });
  }

  /* Queue redelivery is not our only recovery path. A transient provider
   * failure leaves the durable job pending with its own retry time, and the
   * next ingestion tick must pick it up even if the queue provider never
   * redelivered its original message. */
  const recovery = await recoverAndDispatchSourceCollectionJobs();
  const results = await enqueueDueCollectionJobs();

  return ok({ ranAt: new Date().toISOString(), recovery, results });
});
