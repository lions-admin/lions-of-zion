import 'server-only';
import { db, withDatabaseRole } from '@/server/db/client';
import { homepageService } from './service';
export const homepage = () => homepageService(db());
export async function ensureHomepageEdition(){
  return withDatabaseRole('app_service','cron:homepage',()=>homepage().ensureEdition());
}
