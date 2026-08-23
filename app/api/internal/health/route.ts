import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { appEnv, configuredIntegrations, mayActOnTheWorld } from "@/server/core/config";

/**
 * Liveness. Deliberately shallow: it answers "is this deployment running",
 * not "is everything downstream healthy", so it stays useful as a rollout
 * gate when a dependency is degraded.
 *
 * The deep variant lands in Phase 3, once there is something to check.
 * It reports booleans only — never a value, never a host.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_request, ctx) =>
  ok({
    status: "ok",
    env: appEnv(),
    mayActOnTheWorld: mayActOnTheWorld(),
    integrations: configuredIntegrations(),
    requestId: ctx.requestId,
  }),
);
