import "server-only";

/**
 * Who is acting — PLACEHOLDER. Real authentication is Phase 8.
 *
 * This deliberately refuses to work in production. A development shim that
 * quietly keeps functioning once deployed is how an API ends up with no
 * authentication at all and nobody noticing, so the failure is loud and the
 * failure is in the environment that matters.
 *
 * Until Phase 8: `x-actor-label` identifies the caller in development, with no
 * verification whatsoever. It is a stand-in for a session, not a weak version
 * of one.
 */

import { ApiError } from "@/server/http/responses";
import { isProduction } from "@/server/core/config";
import type { Actor } from "@/server/core/audit";

export function requireActor(request: Request): Actor {
  if (isProduction()) {
    throw new ApiError(
      "UNAUTHENTICATED",
      "Authentication is not implemented yet; this API is not available in production.",
    );
  }
  const label = request.headers.get("x-actor-label")?.trim();
  if (!label) {
    throw new ApiError(
      "UNAUTHENTICATED",
      "Send x-actor-label to identify yourself. This is a development stand-in, not authentication.",
    );
  }
  return { label, userId: null };
}

/**
 * Capability checks — PLACEHOLDER, and deliberately fail-closed.
 *
 * Returning `true` here until Phase 8 would mean every route silently runs
 * without authorization and every test of a protected path passes for the
 * wrong reason. Refusing means protected routes are visibly unbuilt.
 */
export function requireCapability(_actor: Actor, capability: string): never {
  throw new ApiError(
    "NOT_IMPLEMENTED",
    `Capability "${capability}" cannot be checked yet: role-based access control lands in Phase 8.`,
  );
}
