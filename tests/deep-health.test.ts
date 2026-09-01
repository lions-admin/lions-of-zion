import { afterEach, describe, expect, it, vi } from "vitest";

const state = vi.hoisted(() => ({ databaseError: new Error("token super-secret-provider-value") }));

vi.mock("@/server/core/config", () => ({
  briefingBlobOptions: () => ({}),
  assertBriefingResourceIsolation: () => undefined,
  briefingFeatures: () => ({ collection: true, processing: true, autoPublish: true }),
  configuredIntegrations: () => ({ database: true, blob: false, aiGateway: false }),
  googleAgentSearchConfig: () => { throw new Error("not configured"); },
  MODEL_PROFILES: { briefingTriage: "openai/gpt-5-nano", briefingDraft: "openai/gpt-5-mini" },
  queueConfigured: () => false,
  queueRegion: () => "iad1",
}));
vi.mock("@/server/db/client", () => ({
  db: () => ({ execute: async () => { throw state.databaseError; } }),
}));

import { deepHealth } from "@/server/core/deep-health";

afterEach(() => vi.restoreAllMocks());

describe("deep health logging", () => {
  it("reports a degraded check without logging raw provider error text", async () => {
    const warning = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const result = await deepHealth();

    expect(result.checks.database).toMatchObject({ status: "degraded", detail: "Error" });
    expect(result.checks.resourceIsolation.status).toBe("ok");
    expect(warning).toHaveBeenCalledOnce();
    const log = String(warning.mock.calls[0]?.[0]);
    expect(log).toContain('"errorName":"Error"');
    expect(log).not.toContain("super-secret-provider-value");
  });
});
