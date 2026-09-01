import { afterEach, describe, expect, it, vi } from "vitest";
import {
  assertBriefingResourceIsolation,
  briefingFeatures,
  briefingEnabledStages,
  briefingCollectionSourceAllowlist,
  databaseUrl,
  mayActOnTheWorld,
  queueConfigured,
} from "@/server/core/config";

afterEach(() => vi.unstubAllEnvs());

function declareResources(environment: "preview" | "production") {
  vi.stubEnv("DATABASE_RESOURCE_ENV", environment);
  vi.stubEnv("BLOB_RESOURCE_ENV", environment);
  vi.stubEnv("QUEUE_RESOURCE_ENV", environment);
  vi.stubEnv("SEARCH_RESOURCE_ENV", environment);
  vi.stubEnv("BRIEFING_BLOB_RESOURCE_ID", `${environment}-briefing-blob`);
  vi.stubEnv("OCTOBER7_BLOB_RESOURCE_ID", `${environment}-october7-blob`);
}

describe("briefing environment isolation", () => {
  it("forces preview collection, processing and publication off even when flags are set", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("BRIEFING_COLLECTION_ENABLED", "true");
    vi.stubEnv("BRIEFING_PROCESSING_ENABLED", "true");
    vi.stubEnv("BRIEFING_AUTO_PUBLISH_ENABLED", "true");
    declareResources("preview");

    expect(mayActOnTheWorld()).toBe(false);
    expect(briefingFeatures()).toEqual({ collection: false, processing: false, autoPublish: false });
    expect(() => assertBriefingResourceIsolation()).not.toThrow();
  });

  it("refuses a deployment whose mutable resource labels cross environments", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    declareResources("production");

    expect(() => assertBriefingResourceIsolation()).toThrow(/DATABASE_RESOURCE_ENV must equal preview/);
  });

  it("refuses a briefing store that is also the October 7 archive store", () => {
    vi.stubEnv("VERCEL_ENV", "production");
    declareResources("production");
    vi.stubEnv("OCTOBER7_BLOB_RESOURCE_ID", "production-briefing-blob");

    expect(() => assertBriefingResourceIsolation()).toThrow(/must be separate from the October 7 archive/);
  });

  it("rejects a redacted database value before a maintenance script can connect", () => {
    vi.stubEnv("DATABASE_URL", "[SENSITIVE]");

    expect(() => databaseUrl()).toThrow(/redacted value cannot run maintenance scripts/);
  });

  it("supports source and stage canary allowlists without changing global flags", () => {
    vi.stubEnv("BRIEFING_COLLECTION_SOURCE_IDS", "official-israel, source-2");
    vi.stubEnv("BRIEFING_ENABLED_STAGES", "enrich,quality,publish");

    expect([...briefingCollectionSourceAllowlist()!]).toEqual(["official-israel", "source-2"]);
    expect([...briefingEnabledStages()]).toEqual(["enrich", "quality", "publish"]);
  });

  it("does not mistake an AI or OIDC token for a configured queue", () => {
    vi.stubEnv("AI_GATEWAY_API_KEY", "present");
    vi.stubEnv("VERCEL_OIDC_TOKEN", "present");

    expect(queueConfigured()).toBe(false);
  });

  it("reports a queue only when its explicit resource binding is present", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("QUEUE_RESOURCE_ENV", "preview");

    expect(queueConfigured()).toBe(true);
  });

  it("does not report a cross-environment queue as available", () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    vi.stubEnv("QUEUE_RESOURCE_ENV", "production");

    expect(queueConfigured()).toBe(false);
  });
});
