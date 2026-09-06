import { handler } from '@/server/http/handler';
import { requireCron } from '@/server/http/internal-guard';
import { ok } from '@/server/http/responses';
import { ensureHomepageEdition } from '@/server/modules/homepage';
export const runtime='nodejs';
export const dynamic='force-dynamic';
export const maxDuration=60;
export const GET=handler(async request=>{
  requireCron(request);
  const edition=await ensureHomepageEdition();
  return ok({editionDate:edition.editionDate,revision:edition.revision});
});
