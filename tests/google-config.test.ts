import { afterEach, describe, expect, it } from "vitest";
import { briefingResourceFingerprints, googleAgentSearchConfig } from "@/server/core/config";

const saved = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, saved);
});

describe("Google Agent Search authentication", () => {
  it("rejects a static Google key outside development", () => {
    process.env.VERCEL_ENV = "production";
    process.env.GOOGLE_SEARCH_API_KEY = "should-not-be-used";
    expect(() => googleAgentSearchConfig()).toThrow(/GOOGLE_SEARCH_API_KEY is forbidden/);
  });

  it("uses the federated configuration when no static key exists", () => {
    process.env.VERCEL_ENV = "production";
    process.env.GOOGLE_CLOUD_PROJECT = "lionsai-506616";
    process.env.GOOGLE_CLOUD_LOCATION = "global";
    process.env.GOOGLE_AGENT_SEARCH_ENGINE_ID = "briefing";
    process.env.GOOGLE_WORKLOAD_IDENTITY_PROVIDER = "projects/1/locations/global/workloadIdentityPools/vercel/providers/vercel";
    process.env.GOOGLE_SERVICE_ACCOUNT_EMAIL = "briefing-search@lionsai-506616.iam.gserviceaccount.com";
    expect(googleAgentSearchConfig()).toMatchObject({
      project: "lionsai-506616",
      serviceAccountEmail: "briefing-search@lionsai-506616.iam.gserviceaccount.com",
    });
  });

  it("exposes only one-way resource fingerprints", () => {
    process.env.DATABASE_URL = "postgresql://user:secret@db.example/briefing";
    process.env.BRIEFING_BLOB_RESOURCE_ID = "store_private_briefing";
    process.env.OCTOBER7_BLOB_RESOURCE_ID = "store_october7_archive";
    process.env.GOOGLE_AGENT_SEARCH_ENGINE_ID = "engine_private";
    const result = briefingResourceFingerprints();
    expect(result.database).toMatch(/^[a-f0-9]{16}$/);
    expect(result.briefingBlob).toMatch(/^[a-f0-9]{16}$/);
    expect(result.october7Blob).toMatch(/^[a-f0-9]{16}$/);
    expect(result.googleSearch).toMatch(/^[a-f0-9]{16}$/);
    expect(JSON.stringify(result)).not.toContain("secret");
    expect(JSON.stringify(result)).not.toContain("store_private_briefing");
  });
});
