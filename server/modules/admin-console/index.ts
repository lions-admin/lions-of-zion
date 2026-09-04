import "server-only";

import { db } from "@/server/db/client";
import { adminConsoleService, type AdminConsoleService } from "./service";

/** Lazily bound, so importing this module does not demand a DATABASE_URL. */
export const adminConsole = (): AdminConsoleService => adminConsoleService(db());

export {
  adminConsoleService,
  ARTICLE_SECTIONS,
  classifyTrend,
  costSurfaceFor,
  nextCronTick,
  SCHEDULES,
  WARN_AT,
  type AdminConsoleService,
} from "./service";
