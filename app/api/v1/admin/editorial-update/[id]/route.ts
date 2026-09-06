import { z } from 'zod';
import { handler, parseBody } from '@/server/http/handler';
import { ok } from '@/server/http/responses';
import { requireActor } from '@/server/core/auth/actor';
import { editorialUpdate } from '@/server/modules/editorial-update';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const paramsSchema = z.object({ id: z.uuid() });
const actionSchema = z.object({ action: z.literal('resume') });

export const GET = handler(async (request, _ctx, context: { params: Promise<{ id: string }> }) => {
  requireActor(request);
  const { id } = paramsSchema.parse(await context.params);
  return ok(await editorialUpdate().get(id));
});

export const POST = handler(async (request, _ctx, context: { params: Promise<{ id: string }> }) => {
  requireActor(request);
  const { id } = paramsSchema.parse(await context.params);
  await parseBody(request, actionSchema);
  const run = await editorialUpdate().resume(id);
  return ok({ id: run.id, runKey: run.runKey, status: run.status, stage: run.stage });
});
