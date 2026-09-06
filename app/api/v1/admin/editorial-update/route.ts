import { handler, parseBody } from '@/server/http/handler';
import { ok } from '@/server/http/responses';
import { requireActor } from '@/server/core/auth/actor';
import { startEditorialRunSchema } from '@/server/contracts/editorial-update';
import { editorialUpdate } from '@/server/modules/editorial-update';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export const GET = handler(async request => {
  requireActor(request);
  return ok({ runs: await editorialUpdate().listRecent() });
});

/** Starts durable editorial work and returns its identifier before the queue runs. */
export const POST = handler(async request => {
  const actor = requireActor(request);
  const input = await parseBody(request, startEditorialRunSchema);
  const run = await editorialUpdate().start(input, actor.label);
  return ok({ id: run.id, runKey: run.runKey, status: run.status, stage: run.stage });
});
