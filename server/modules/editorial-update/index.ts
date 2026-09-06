import 'server-only';

import { db } from '@/server/db/client';
import { deliverEditorialRunReport, editorialUpdateService, processEditorialRun } from './service';

export const editorialUpdate = () => editorialUpdateService(db());
export { processEditorialRun, deliverEditorialRunReport, editorialUpdateService };
