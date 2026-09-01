import { afterEach, describe, expect, it, vi } from "vitest";
import { assertBriefingWithinBudget } from "@/server/modules/briefing/service";

afterEach(() => vi.unstubAllEnvs());

describe("briefing-specific AI budget", () => {
  it("stops drafting when the daily briefing ceiling is reached", async () => {
    vi.stubEnv("BRIEFING_AI_DAILY_BUDGET_USD", "0.50");
    vi.stubEnv("BRIEFING_AI_MONTHLY_BUDGET_USD", "10");

    await expect(assertBriefingWithinBudget(async () => 0.5, new Date("2026-08-31T07:00:00Z")))
      .rejects.toThrow(/briefing-specific AI budget is exhausted/);
  });

  it("keeps collection-eligible processing below the separate monthly ceiling", async () => {
    vi.stubEnv("BRIEFING_AI_DAILY_BUDGET_USD", "0.50");
    vi.stubEnv("BRIEFING_AI_MONTHLY_BUDGET_USD", "10");
    let calls = 0;

    await expect(assertBriefingWithinBudget(async () => (++calls === 1 ? 0.49 : 9.99)))
      .resolves.toBeUndefined();
  });
});
