import { handler } from '@/server/http/handler';
import { ok } from '@/server/http/responses';
import { requireEditorialUpdateIngestSecret } from '@/server/http/internal-guard';
import { editorialUpdate } from '@/server/modules/editorial-update';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async (request, _ctx, route: { params: Promise<{ runId: string }> }) => {
  requireEditorialUpdateIngestSecret(request);
  const { runId } = await route.params;
  const run = await editorialUpdate().getByRunKey(runId);
  return ok({
    runId: run.runKey,
    status: run.status,
    stage: run.stage,
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    report: run.report ?? null,
    operations: run.operations.map(operation => ({
      key: operation.operationKey,
      status: operation.status,
      stage: operation.stage,
      result: operation.result ?? null,
      failure: operation.failure ?? null,
    })),
  });
});
