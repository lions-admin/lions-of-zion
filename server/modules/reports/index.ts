import "server-only";

import { db } from "@/server/db/client";
import { enforceRateLimit, type RateLimitPolicy } from "@/server/core/rate-limit";
import { reportService, type ReportService } from "./service";

export const reports = (): ReportService => reportService(db());

/** Bound against the live database, so a route can rate limit without
 *  importing `server/db` — the same shape every module uses for its own
 *  connection. */
export const rateLimit = (bucket: string, policy: RateLimitPolicy) =>
  enforceRateLimit(db(), bucket, policy);

export { reportService, type ReportService } from "./service";
