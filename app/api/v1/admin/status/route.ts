import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { appEnv, configuredIntegrations } from "@/server/core/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) =>
  ok({
    status: "ok",
    environment: appEnv(),
    integrations: configuredIntegrations(request),
    region: "iad1",
    aiBudgetUsd: 4.5,
  }),
);
