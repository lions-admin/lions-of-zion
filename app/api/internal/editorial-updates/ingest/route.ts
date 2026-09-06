import { handler, parseBody } from '@/server/http/handler';
import { ok } from '@/server/http/responses';
import { requireEditorialUpdateIngestSecret } from '@/server/http/internal-guard';
import { wholeSiteUpdatePackageSchema } from '@/server/contracts/whole-site-update';
import { editorialUpdate } from '@/server/modules/editorial-update';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** Accepts only content/placement data, queues the durable run, and returns
 * a stable status URL for GitHub Actions to poll. */
export const POST = handler(async request => {
  requireEditorialUpdateIngestSecret(request);
  const pkg = await parseBody(request, wholeSiteUpdatePackageSchema);
  const run = await editorialUpdate().startWholeSite(pkg, `external:${pkg.composer}`);
  return ok({
    id: run.id,
    runId: run.runKey,
    status: run.status,
    statusUrl: `/api/internal/editorial-updates/runs/${encodeURIComponent(run.runKey)}`,
  }, { status: run.status === 'queued' ? 202 : 200 });
});
