import "server-only";

import { db } from "@/server/db/client";
import { narrativeService, type NarrativeService } from "./service";

export const narratives = (): NarrativeService => narrativeService(db());

export { narrativeService, type NarrativeService } from "./service";
