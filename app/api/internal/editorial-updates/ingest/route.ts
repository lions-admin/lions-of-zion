import { handler, parseBody } from '@/server/http/handler';
import { ok } from '@/server/http/responses';
import { requireEditorialUpdateIngestSecret } from '@/server/http/internal-guard';
import { wholeSiteUpdatePackageSchema } from '@/server/contracts/whole-site-update';
import { editorialUpdate } from '@/server/modules/editorial-update';
import { drainPendingOutbox } from '@/server/core/outbox';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Rows to hand the queue on the way out.
 *
 * Enough to cover this run's own `editorial.run-process` row and whatever
 * ordinary traffic accumulated alongside it, and small enough that the 202
 * is not held behind an unusual backlog — the drain reads oldest-first, so a
 * deep backlog is the cron's job, not this request's.
 */
const KICK_LIMIT = 100;

/** Accepts only content/placement data, queues the durable run, and returns
 * a stable status URL for GitHub Actions to poll. */
export const POST = handler(async request => {
  requireEditorialUpdateIngestSecret(request);
  const pkg = await parseBody(request, wholeSiteUpdatePackageSchema);
  const run = await editorialUpdate().startWholeSite(pkg, `external:${pkg.composer}`);

  /* Hand the just-committed row to the queue now instead of waiting for the
   * next quarter-hour drain tick.
   *
   * This is not a bypass of the durable architecture and deliberately does
   * not call `processEditorialRun`: the outbox row was already written inside
   * `startWholeSite`'s transaction, and all this does is the same `send` the
   * cron would do, earlier. Every guarantee is untouched — if the queue is
   * unavailable the row keeps `published_at` null, takes its backoff, and the
   * cron drains it on the next tick exactly as before.
   *
   * The wait it removes was the whole remaining defect. A package accepted at
   * :46 sat until :00 doing nothing, and because the delivery workflow runs
   * one package at a time, a second package queued behind the first inherited
   * that dead time on top of its own — which is how runs blew the publisher's
   * 20-minute poll budget while nothing was actually wrong.
   *
   * Failure here is logged by the handler's own error translation and never
   * fails the ingest: the package is accepted and durable either way, and
   * reporting a 500 for a slow queue would make the Action retry a run that
   * is already safely recorded. */
  try {
    await drainPendingOutbox({ limit: KICK_LIMIT });
  } catch {
    /* The cron is the safety net, and it is the reason this is swallowed. */
  }

  return ok({
    id: run.id,
    runId: run.runKey,
    status: run.status,
    statusUrl: `/api/internal/editorial-updates/runs/${encodeURIComponent(run.runKey)}`,
  }, { status: run.status === 'queued' ? 202 : 200 });
});
