import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import { briefingAlert, briefingJob, briefingRun, outbox, source, sourceFamily } from "@/server/db/schema";
import { evaluateAndQueueBriefingAlerts } from "@/server/modules/briefing/alerts";

/* The production function accepts the Neon driver type. PGlite executes the
   same SQL and transactional interface for this integration test. */
const evaluate = (db: TestDatabase, at: string) => evaluateAndQueueBriefingAlerts(db as never, new Date(at));

async function failedRun(db: TestDatabase) {
  await db.insert(briefingRun).values({
    localDate: "2026-08-31",
    stage: "triage",
    status: "failed",
    startedAt: new Date(),
    finishedAt: new Date(),
    errorMessage: "Controlled provider failure",
  });
}

async function rssSource(db: TestDatabase, slug: string, overrides: Record<string, unknown>) {
  const [family] = await db.insert(sourceFamily).values({ slug, label: slug }).returning();
  const [row] = await db.insert(source).values({
    sourceFamilyId: family!.id,
    kind: "rss",
    slug,
    logicalKey: `rss:url:https://example.org/${slug}.xml`,
    name: slug,
    feedUrl: `https://example.org/${slug}.xml`,
    language: "en",
    ...overrides,
  }).returning();
  return row!;
}

describe("briefing operational alerts", () => {
  it("creates one durable, deduplicated alert and delivery event for a failed stage", async () => {
    const db = await freshDatabase();
    await failedRun(db);

    const first = await evaluate(db, "2026-08-31T08:00:00.000Z");
    const second = await evaluate(db, "2026-08-31T08:15:00.000Z");

    expect(first).toMatchObject({ evaluated: 1, created: 1, refreshed: 0, resolved: 0 });
    expect(second).toMatchObject({ evaluated: 1, created: 0, refreshed: 1, resolved: 0 });
    expect(await db.select().from(briefingAlert)).toHaveLength(1);
    const messages = await db.select().from(outbox);
    expect(messages).toHaveLength(1);
    expect(messages[0]?.topic).toBe("briefing.alert");
  });

  /* Until 2026-09-08 the fingerprint was the kind plus the Israel-local date,
     so a condition that held for a week produced seven open critical rows and
     the console counted every one of them. One open row per kind, refreshed
     in place; a new day is not a new incident. */
  it("keeps one open row per kind across days instead of opening a new one each morning", async () => {
    const db = await freshDatabase();
    await failedRun(db);

    await evaluate(db, "2026-08-31T08:00:00.000Z");
    const nextDay = await evaluate(db, "2026-09-01T03:20:00.000Z");

    expect(nextDay).toMatchObject({ created: 0, refreshed: 1 });
    const rows = await db.select().from(briefingAlert);
    expect(rows).toHaveLength(1);
    expect(rows[0]?.resolvedAt).toBeNull();
    expect(await db.select().from(outbox)).toHaveLength(1);
  });

  /* `resolved_at` was written by the console's manual action and by nothing
     else, so every alert ever raised stayed open forever — including the
     historical per-day duplicates. Resolution is the evaluator's job. */
  it("resolves an open alert once its condition no longer holds, and reopens it if it returns", async () => {
    const db = await freshDatabase();
    const [run] = await db.insert(briefingRun).values({
      localDate: "2026-08-31", stage: "triage", status: "failed",
      startedAt: new Date(), finishedAt: new Date(), errorMessage: "Controlled provider failure",
    }).returning();
    await evaluate(db, "2026-08-31T08:00:00.000Z");

    await db.update(briefingRun).set({ status: "completed", errorMessage: null }).where(eq(briefingRun.id, run!.id));
    const cleared = await evaluate(db, "2026-08-31T09:00:00.000Z");
    expect(cleared).toMatchObject({ evaluated: 0, created: 0, resolved: 1 });
    const [closed] = await db.select().from(briefingAlert);
    expect(closed?.resolvedAt).not.toBeNull();

    await db.update(briefingRun).set({ status: "failed", errorMessage: "It failed again" }).where(eq(briefingRun.id, run!.id));
    const reopened = await evaluate(db, "2026-08-31T10:00:00.000Z");
    expect(reopened).toMatchObject({ created: 1 });
    const rows = await db.select().from(briefingAlert);
    expect(rows).toHaveLength(2);
    expect(rows.filter((row) => row.resolvedAt === null)).toHaveLength(1);
    expect(await db.select().from(outbox)).toHaveLength(2);
  });

  it("closes historical duplicate rows of a still-firing kind, keeping the newest", async () => {
    const db = await freshDatabase();
    await failedRun(db);
    for (const day of ["2026-09-02", "2026-09-03", "2026-09-04"]) {
      await db.insert(briefingAlert).values({
        fingerprint: `failed_runs:${day}`, kind: "failed_runs", severity: "critical",
        message: "One or more briefing stages failed in the last 24 hours.", details: { count: 1 },
        createdAt: new Date(`${day}T03:20:00.000Z`), updatedAt: new Date(`${day}T03:20:00.000Z`),
      });
    }

    const result = await evaluate(db, "2026-09-08T08:00:00.000Z");
    expect(result).toMatchObject({ created: 0, refreshed: 1, resolved: 2 });
    const rows = await db.select().from(briefingAlert);
    const open = rows.filter((row) => row.resolvedAt === null);
    expect(open).toHaveLength(1);
    expect(open[0]?.fingerprint).toBe("failed_runs:2026-09-04");
    expect(await db.select().from(outbox)).toHaveLength(0);
  });

  it("does not alert for a deliberately inactive source candidate", async () => {
    const db = await freshDatabase();
    await rssSource(db, "candidate-source", { active: false });

    const result = await evaluate(db, "2026-08-31T08:00:00.000Z");
    expect(result).toMatchObject({ evaluated: 0, created: 0 });
    expect(await db.select().from(briefingAlert)).toHaveLength(0);
  });

  it("alerts when a source the scheduler still fetches keeps failing", async () => {
    const db = await freshDatabase();
    await rssSource(db, "failing-source", { active: true, consecutiveFailures: 3 });

    const result = await evaluate(db, "2026-08-31T08:00:00.000Z");
    expect(result).toMatchObject({ evaluated: 1, created: 1 });
    expect((await db.select().from(briefingAlert))[0]).toMatchObject({ kind: "stale_sources", details: { count: 1 } });
  });

  /* gov-il, times-of-israel and arab-news in Production: taken out of
     rotation by the system itself, and then counted as "repeatedly failing"
     every morning for a week. A source nobody is fetching is not failing;
     it is disabled, which the sources view already says, and the daily
     re-verification sweep is what brings it back. */
  it("does not count a source the system already disabled or retired", async () => {
    const db = await freshDatabase();
    await rssSource(db, "auto-disabled", {
      active: false, consecutiveFailures: 25, disabledAt: new Date(),
      disabledReason: "Repeated failed fetches: Feed returned HTTP 403",
    });
    await rssSource(db, "retired", {
      active: false, consecutiveFailures: 9,
      config: { retired: true, retiredReason: "Removed from the live RSS catalog after endpoint verification failed." },
    });

    const result = await evaluate(db, "2026-08-31T08:00:00.000Z");
    expect(result).toMatchObject({ evaluated: 0, created: 0 });
    expect(await db.select().from(briefingAlert)).toHaveLength(0);
  });

  /* `publish:2026-09-01:v1` in Production: pending, attempts exhausted,
     unclaimable, and reported as a 9,650-minute backlog. Only work a worker
     could actually take counts toward the queue's age. */
  it("measures queue age over claimable work only", async () => {
    const db = await freshDatabase();
    const src = await rssSource(db, "job-feed", { active: true });
    await db.insert(briefingJob).values({
      jobKey: "publish:2026-09-01:v1", contractVersion: 1, stage: "publish", localDate: "2026-09-01",
      state: "pending", attempts: 5, maxAttempts: 5,
      availableAt: new Date("2026-09-03T15:44:46.000Z"), createdAt: new Date("2026-09-01T10:30:37.000Z"),
    });

    expect(await evaluate(db, "2026-09-08T08:00:00.000Z")).toMatchObject({ evaluated: 0 });

    await db.insert(briefingJob).values({
      jobKey: `collect:${src.id}:2026-09-08T01:30`, contractVersion: 1, stage: "collect", localDate: "2026-09-08",
      sourceId: src.id, state: "pending", attempts: 0, maxAttempts: 5,
      availableAt: new Date(Date.now() - 45 * 60_000), createdAt: new Date(Date.now() - 45 * 60_000),
    });
    const result = await evaluate(db, new Date().toISOString());
    expect(result).toMatchObject({ evaluated: 1, created: 1 });
    expect((await db.select().from(briefingAlert))[0]).toMatchObject({ kind: "queue_age" });
  });
});
