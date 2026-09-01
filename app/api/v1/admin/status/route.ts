import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { appEnv, briefingAiBudgets, briefingResourceFingerprints, configuredIntegrations, queueRegion } from "@/server/core/config";
import { publicReadCacheStats } from "@/server/core/public-read-cache";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) =>
  ok({
    status: "ok",
    environment: appEnv(),
    integrations: configuredIntegrations(request),
    region: queueRegion(),
    resourceFingerprints: briefingResourceFingerprints(),
    aiBudgetUsd: briefingAiBudgets().monthly,
    publicReadCache: publicReadCacheStats(),
  }),
);
