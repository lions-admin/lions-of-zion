import { handler } from '@/server/http/handler';
import { ok } from '@/server/http/responses';
import { requireCron } from '@/server/http/internal-guard';
import { editorialUpdate } from '@/server/modules/editorial-update';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
export const maxDuration = 60;

/** Vercel invokes this every fifteen minutes. The module evaluates Jerusalem
 * time, so the first tick at or after 07:00 handles DST and missed ticks. */
export const GET = handler(async request => {
  requireCron(request);
  return ok(await editorialUpdate().startDailyDue());
});
