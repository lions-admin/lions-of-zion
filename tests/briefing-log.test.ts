import { describe, expect, it, vi } from "vitest";

vi.mock("server-only", () => ({}));
import { briefingLog } from "@/server/core/log";

describe("briefingLog", () => {
  it("keeps every correlation identifier in one structured event", () => {
    const spy = vi.spyOn(console, "info").mockImplementation(() => undefined);
    briefingLog("info", "briefing.stage.completed", {
      requestId: "request-1", runId: "run-1", stage: "triage", sourceId: "source-1",
      editionId: "edition-1", provider: "google_agent_search", model: "gpt-5-mini",
    }, { durationMs: 42 });
    expect(JSON.parse(String(spy.mock.calls[0]?.[0]))).toEqual({
      level: "info", event: "briefing.stage.completed", requestId: "request-1", runId: "run-1",
      stage: "triage", sourceId: "source-1", editionId: "edition-1",
      provider: "google_agent_search", model: "gpt-5-mini", durationMs: 42,
    });
    spy.mockRestore();
  });

  it("does not emit absent optional fields", () => {
    const spy = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    briefingLog("warn", "briefing.source.failed", { sourceId: "source-1" }, { errorClass: "Error" });
    expect(JSON.parse(String(spy.mock.calls[0]?.[0]))).not.toHaveProperty("model");
    spy.mockRestore();
  });
});
