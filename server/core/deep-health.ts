import "server-only";

import { sql } from "drizzle-orm";
import { del, put } from "@vercel/blob";
import { gateway } from "ai";
import { db } from "@/server/db/client";
import {
  briefingBlobOptions,
  briefingFeatures,
  assertBriefingResourceIsolation,
  configuredIntegrations,
  googleAgentSearchConfig,
  MODEL_PROFILES,
  queueConfigured,
  queueRegion,
} from "@/server/core/config";
import { googleCloudAccessToken } from "@/server/core/google-cloud-auth";

type Check = { status: "ok" | "degraded" | "not_configured"; latencyMs: number; detail?: string };

async function timed(name: string, check: () => Promise<void>): Promise<Check> {
  const started = Date.now();
  try {
    await check();
    return { status: "ok", latencyMs: Date.now() - started };
  } catch (cause) {
    console.warn(JSON.stringify({
      level: "warn",
      operation: "deep_health",
      check: name,
      /* Provider errors regularly echo request headers, URLs, or credential
       * fragments. The administrator gets the check name and error class;
       * raw provider text must never become an application log record. */
      errorName: cause instanceof Error ? cause.name : "UnknownError",
    }));
    return {
      status: "degraded",
      latencyMs: Date.now() - started,
      detail: cause instanceof Error ? cause.name : "UnknownError",
    };
  }
}

export async function deepHealth(request?: Request) {
  const configured = configuredIntegrations(request);
  const database = configured.database
    ? timed("database", async () => { await db().execute(sql`SELECT 1 AS ok`); })
    : Promise.resolve<Check>({ status: "not_configured", latencyMs: 0 });
  const resourceIsolation = timed("resourceIsolation", async () => {
    assertBriefingResourceIsolation();
  });
  const blob = configured.blob
    ? timed("blob", async () => {
        const probe = await put(`briefing/health/${crypto.randomUUID()}.txt`, "health", {
          access: "private",
          addRandomSuffix: false,
          allowOverwrite: false,
          contentType: "text/plain",
          ...briefingBlobOptions(),
        });
        await del(probe.url, briefingBlobOptions());
      })
    : Promise.resolve<Check>({ status: "not_configured", latencyMs: 0 });
  const models = configured.aiGateway
    ? timed("aiModels", async () => {
        const available = await gateway.getAvailableModels();
        const ids = new Set(available.models.map((model) => model.id));
        if (!ids.has(MODEL_PROFILES.briefingTriage) || !ids.has(MODEL_PROFILES.briefingDraft)) {
          throw new Error("BriefingModelUnavailable");
        }
      })
    : Promise.resolve<Check>({ status: "not_configured", latencyMs: 0 });
  let google: Promise<Check>;
  try {
    const config = googleAgentSearchConfig();
    google = timed("googleIdentity", async () => { await googleCloudAccessToken(config); });
  } catch {
    google = Promise.resolve({ status: "not_configured", latencyMs: 0 });
  }

  const [resourceIsolationResult, databaseResult, blobResult, modelResult, googleResult] = await Promise.all([
    resourceIsolation, database, blob, models, google,
  ]);
  const checks = {
    resourceIsolation: resourceIsolationResult,
    database: databaseResult,
    blob: blobResult,
    aiModels: modelResult,
    googleIdentity: googleResult,
    queue: { status: queueConfigured() ? "ok" : "not_configured", latencyMs: 0, region: queueRegion() },
  };
  const checkStatuses = Object.values(checks).map((check) => check.status);
  return {
    status: checkStatuses.includes("degraded")
      ? "degraded"
      : checkStatuses.includes("not_configured")
        ? "not_configured"
        : "ok",
    features: briefingFeatures(),
    checks,
  };
}
