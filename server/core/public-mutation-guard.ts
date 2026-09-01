import "server-only";

import { appEnv } from "@/server/core/config";
import { forbidden } from "@/server/http/responses";

/**
 * A preview must be useful for read-only review, but it must never be able to
 * mutate editorial state that could be backed by a wrongly configured shared
 * database. Local development remains available for integration tests.
 */
export function requirePublicMutationEnvironment(): void {
  if (appEnv() === "preview") {
    throw forbidden("Preview deployments cannot mutate public editorial data.");
  }
}
