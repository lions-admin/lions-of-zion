import { describe, expect, it, vi } from "vitest";
import { freshDatabase } from "@/server/db/testing";
import { briefingEdition, briefingJob } from "@/server/db/schema";

describe("manual briefing execution", () => {
  it("does not create a second edition when two manual requests use the same Israel date", async () => {
    vi.resetModules();
    const database = await freshDatabase();
    const send = vi.fn().mockResolvedValue(undefined);

    vi.doMock("@/server/db/client", () => ({ db: () => database }));
    vi.doMock("@/server/core/config", () => ({
      assertBriefingResourceIsolation: () => undefined,
      briefingFeatures: () => ({ processing: true }),
    }));
    vi.doMock("@/server/core/queue-client", () => ({ queueClient: { send } }));
    vi.doMock("@/server/modules/briefing/service", async () => {
      const actual = await vi.importActual<typeof import("@/server/modules/briefing/service")>("@/server/modules/briefing/service");
      return { ...actual, israelLocalHour: () => 7 };
    });

    const { enqueueEditorialPipeline } = await import("@/server/modules/briefing/jobs");
    const runAt = new Date("2026-08-31T04:00:00.000Z");
    const results = await Promise.all([
      enqueueEditorialPipeline(runAt, { force: true }),
      enqueueEditorialPipeline(runAt, { force: true }),
    ]);

    expect(results.every((result) => result.localDate === "2026-08-31")).toBe(true);
    expect(await database.select().from(briefingEdition)).toHaveLength(1);
    const jobs = await database.select().from(briefingJob);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ stage: "enrich", localDate: "2026-08-31" });
    expect(send).toHaveBeenCalled();
  });

  it("restarts a failed edition from triage before ensureEdition reopens it", async () => {
    vi.resetModules();
    const database = await freshDatabase();
    const send = vi.fn().mockResolvedValue(undefined);
    await database.insert(briefingEdition).values({
      localDate: "2026-08-30",
      status: "failed",
      contractVersion: "test-contract",
      promptVersion: "test-prompt",
      collectionOpenedAt: new Date(),
    });

    vi.doMock("@/server/db/client", () => ({ db: () => database }));
    vi.doMock("@/server/core/config", () => ({
      assertBriefingResourceIsolation: () => undefined,
      briefingFeatures: () => ({ processing: true }),
    }));
    vi.doMock("@/server/core/queue-client", () => ({ queueClient: { send } }));
    vi.doMock("@/server/modules/briefing/service", async () => {
      const actual = await vi.importActual<typeof import("@/server/modules/briefing/service")>("@/server/modules/briefing/service");
      return { ...actual, israelLocalHour: () => 7 };
    });

    const { enqueueEditorialPipeline } = await import("@/server/modules/briefing/jobs");
    const result = await enqueueEditorialPipeline(new Date("2026-08-30T04:00:00.000Z"), { force: true });
    const jobs = await database.select().from(briefingJob);

    expect(result.status).toBe("queued");
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ stage: "triage", localDate: "2026-08-30" });
  });

  it("allows an explicitly requested regeneration of a published edition from triage", async () => {
    vi.resetModules();
    const database = await freshDatabase();
    const send = vi.fn().mockResolvedValue(undefined);
    await database.insert(briefingEdition).values({
      localDate: "2026-08-30",
      status: "published",
      contractVersion: "old-contract",
      promptVersion: "old-prompt",
      collectionOpenedAt: new Date(),
      publishedAt: new Date(),
    });

    vi.doMock("@/server/db/client", () => ({ db: () => database }));
    vi.doMock("@/server/core/config", () => ({
      assertBriefingResourceIsolation: () => undefined,
      briefingFeatures: () => ({ processing: true }),
    }));
    vi.doMock("@/server/core/queue-client", () => ({ queueClient: { send } }));
    vi.doMock("@/server/modules/briefing/service", async () => {
      const actual = await vi.importActual<typeof import("@/server/modules/briefing/service")>("@/server/modules/briefing/service");
      return { ...actual, israelLocalHour: () => 7 };
    });

    const { enqueueEditorialPipeline } = await import("@/server/modules/briefing/jobs");
    const result = await enqueueEditorialPipeline(new Date("2026-08-30T04:00:00.000Z"), {
      force: true,
      regenerateCompleted: true,
    });
    const editions = await database.select().from(briefingEdition);
    const jobs = await database.select().from(briefingJob);

    expect(result.status).toBe("queued");
    expect(editions[0]).toMatchObject({ status: "processing" });
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ stage: "triage", localDate: "2026-08-30", state: "pending" });
    expect(send).toHaveBeenCalledWith("briefing-triage", expect.anything(), expect.anything());
  });
});
