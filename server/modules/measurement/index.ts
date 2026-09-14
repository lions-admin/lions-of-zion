import "server-only";

import { db } from "@/server/db/client";
import { enforceRateLimit, type RateLimitPolicy } from "@/server/core/rate-limit";
import { measurementService, type MeasurementService } from "./service";

export const measurement = (): MeasurementService => measurementService(db());

export const rateLimit = (bucket: string, policy: RateLimitPolicy) =>
  enforceRateLimit(db(), bucket, policy);

export {
  measurementService,
  resolveTrafficSource,
  redactQuery,
  hashQuery,
  isBotUserAgent,
  type MeasurementService,
} from "./service";
