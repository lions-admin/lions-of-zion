import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";

/**
 * Liveness. Deliberately shallow: it answers "is this deployment running",
 * not "is everything downstream healthy", so it stays useful as a rollout
 * gate when a dependency is degraded.
 *
 * The authenticated admin deep-health route performs dependency probes; this
 * liveness route intentionally stays shallow so a degraded dependency does
 * not make the deployment appear dead to the platform.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_request, ctx) =>
  ok({
    status: "ok",
    requestId: ctx.requestId,
  }),
);
