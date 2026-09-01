import { describe, expect, it } from "vitest";
import { freshDatabase } from "@/server/db/testing";
import { briefingAlert, briefingRun, outbox, source, sourceFamily } from "@/server/db/schema";
import { evaluateAndQueueBriefingAlerts } from "@/server/modules/briefing/alerts";

describe("briefing operational alerts", () => {
  it("creates one durable, deduplicated alert and delivery event for a failed stage", async () => {
    const db = await freshDatabase();
    await db.insert(briefingRun).values({
      localDate: "2026-08-31",
      stage: "triage",
      status: "failed",
      startedAt: new Date(),
      finishedAt: new Date(),
      errorMessage: "Controlled provider failure",
    });

    // The production function accepts the Neon driver type. PGlite executes
    // the same SQL and transactional interface for this integration test.
    const first = await evaluateAndQueueBriefingAlerts(db as never, new Date("2026-08-31T08:00:00.000Z"));
    const second = await evaluateAndQueueBriefingAlerts(db as never, new Date("2026-08-31T08:15:00.000Z"));

    expect(first).toMatchObject({ evaluated: 1, created: 1 });
    expect(second).toMatchObject({ evaluated: 1, created: 0 });
    expect(await db.select().from(briefingAlert)).toHaveLength(1);
    const messages = await db.select().from(outbox);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.topic).toBe("briefing.alert");
  });

  it("does not alert for a deliberately inactive source candidate", async () => {
    const db = await freshDatabase();
    const [family] = await db.insert(sourceFamily).values({ slug: "candidate-source", label: "Candidate source" }).returning();
    await db.insert(source).values({
      sourceFamilyId: family!.id,
      kind: "rss",
      slug: "candidate-source",
      logicalKey: "rss:url:https://example.org/candidate.xml",
      name: "Candidate source",
      feedUrl: "https://example.org/candidate.xml",
      language: "en",
      active: false,
    });

    const result = await evaluateAndQueueBriefingAlerts(db as never, new Date("2026-08-31T08:00:00.000Z"));
    expect(result).toMatchObject({ evaluated: 0, created: 0 });
    expect(await db.select().from(briefingAlert)).toHaveLength(0);
  });

  it("alerts when a source repeatedly fails after being enabled", async () => {
    const db = await freshDatabase();
    const [family] = await db.insert(sourceFamily).values({ slug: "failing-source", label: "Failing source" }).returning();
    await db.insert(source).values({
      sourceFamilyId: family!.id,
      kind: "rss",
      slug: "failing-source",
      logicalKey: "rss:url:https://example.org/failing.xml",
      name: "Failing source",
      feedUrl: "https://example.org/failing.xml",
      language: "en",
      active: false,
      consecutiveFailures: 3,
      disabledReason: "Repeated failed fetches",
    });

    const result = await evaluateAndQueueBriefingAlerts(db as never, new Date("2026-08-31T08:00:00.000Z"));
    expect(result).toMatchObject({ evaluated: 1, created: 1 });
    expect((await db.select().from(briefingAlert))[0]).toMatchObject({ kind: "stale_sources" });
  });
});
