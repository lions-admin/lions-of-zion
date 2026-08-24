import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireCron } from "@/server/http/internal-guard";
import { drainPendingOutbox } from "@/server/core/outbox";

/**
 * The reliable half of the outbox: this runs with no dependency on Vercel
 * Queues at all. A row that fails to dispatch (queue unconfigured, queue
 * down) simply stays pending with a backoff and gets picked up again next
 * tick — the fast path is the queue, this is the path that cannot lose a job.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = handler(async (request) => {
  requireCron(request);
  return ok(await drainPendingOutbox());
});
