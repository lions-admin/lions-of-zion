import "server-only";

import { db } from "@/server/db/client";
import { narrativeService, type NarrativeService } from "./service";

let bound: NarrativeService | undefined;

export const narratives = (): NarrativeService => (bound ??= narrativeService(db()));

export { narrativeService, type NarrativeService } from "./service";
