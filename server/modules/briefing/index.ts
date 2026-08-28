import "server-only";

import { db } from "@/server/db/client";
import { briefingService, type BriefingService } from "./service";

export const briefing = (): BriefingService => briefingService(db());

export { briefingService, israelLocalDate, israelLocalHour, type BriefingService } from "./service";
