import { handler } from '@/server/http/handler';
import { ok } from '@/server/http/responses';
import { requireEditorialUpdateIngestSecret } from '@/server/http/internal-guard';
import { describeEditorialRunPhase } from '@/server/contracts/editorial-update';
import { editorialUpdate } from '@/server/modules/editorial-update';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * The durable run, as the GitHub poller reads it.
 *
 * `phase` and `delivery` are the two fields that let a poller tell a run
 * waiting for the outbox drain from one the queue keeps refusing from one a
 * worker is inside — three states that all read `queued` on `status`. See
 * `describeEditorialRunPhase` for the derivation; the outbox row is the
 * evidence, read back rather than duplicated onto the run.
 */
export const GET = handler(async (request, _ctx, route: { params: Promise<{ runId: string }> }) => {
  requireEditorialUpdateIngestSecret(request);
  const { runId } = await route.params;
  const service = editorialUpdate();
  const run = await service.getByRunKey(runId);
  const delivery = run.status === 'queued' ? await service.deliveryState(run.id) : null;
  return ok({
    runId: run.runKey,
    status: run.status,
    stage: run.stage,
    phase: describeEditorialRunPhase(run, delivery),
    delivery,
    createdAt: run.createdAt.toISOString(),
    startedAt: run.startedAt?.toISOString() ?? null,
    finishedAt: run.finishedAt?.toISOString() ?? null,
    report: run.report ?? null,
    /* The run-level failure record — the one thing a run that fails outside
     * per-operation processing has to say for itself. It was absent until
     * 2026-09-07, which is why run
     * `chatgpt-test-2026-09-07-0332-k4m9` could only be reported as
     * "finished failed": `created=0 updated=0 failed=0` with the actual
     * exception sitting in a column nothing returned. */
    failure: run.failure ?? null,
    operations: run.operations.map(operation => ({
      key: operation.operationKey,
      status: operation.status,
      stage: operation.stage,
      result: operation.result ?? null,
      failure: operation.failure ?? null,
    })),
  });
});
