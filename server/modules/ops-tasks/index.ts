import "server-only";

import { db } from "@/server/db/client";
import { opsTasksService } from "./service";

export const opsTasks = () => opsTasksService(db());
export type { OpsTasksService } from "./service";
