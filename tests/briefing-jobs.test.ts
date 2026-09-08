import { describe, expect, it } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase } from "@/server/db/testing";
import { briefingEdition, briefingJob, briefingJobDelivery, source, sourceFamily } from "@/server/db/schema";
import { BRIEFING_QUEUE_RETENTION_SECONDS, briefingJobStore, israelCollectionWindow } from "@/server/modules/briefing/jobs";

async function sourceFixture() {
  const db = await freshDatabase();
  const [family] = await db.insert(sourceFamily).values({ slug: "job-feed", label: "Job Feed" }).returning();
  const [src] = await db.insert(source).values({
    sourceFamilyId: family!.id,
    kind: "rss",
    slug: "job-feed",
    logicalKey: "rss:url:https://example.org/job.xml",
    name: "Job Feed",
    feedUrl: "https://example.org/job.xml",
    language: "en",
  }).returning();
  return { db, src: src! };
}

describe("briefing job ledger", () => {
  it("keeps queue message retention within the provider maximum", () => {
    expect(BRIEFING_QUEUE_RETENTION_SECONDS).toBe(86_400);
  });

  it("keeps Israel-local collection dates and windows stable across DST changes", () => {
    expect(israelCollectionWindow(new Date("2026-03-26T23:30:00.000Z"))).toEqual({
      localDate: "2026-03-27",
      windowKey: "2026-03-27T01:30",
    });
    expect(israelCollectionWindow(new Date("2026-03-27T00:30:00.000Z"))).toEqual({
      localDate: "2026-03-27",
      windowKey: "2026-03-27T03:30",
    });
    expect(israelCollectionWindow(new Date("2026-10-24T23:30:00.000Z"))).toEqual({
      localDate: "2026-10-25",
      windowKey: "2026-10-25T01:30",
    });
    expect(israelCollectionWindow(new Date("2026-10-25T00:30:00.000Z"))).toEqual({
      localDate: "2026-10-25",
      windowKey: "2026-10-25T02:30",
    });
  });

  it("creates one idempotent collection job per source window", async () => {
    const { db, src } = await sourceFixture();
    const store = briefingJobStore(db);
    const first = await store.createCollectJob(src, "2026-08-30", "2026-08-30T15:00");
    const second = await store.createCollectJob(src, "2026-08-30", "2026-08-30T15:00");
    expect(second.id).toBe(first.id);
    const rows = await db.select().from(briefingJob);
    expect(rows).toHaveLength(1);
  });

  it("allows only one of two concurrent deliveries to claim the same job", async () => {
    const { db, src } = await sourceFixture();
    const store = briefingJobStore(db);
    const job = await store.createCollectJob(src, "2026-08-30", "2026-08-30T15:00");

    const claims = await Promise.all([
      store.claim(job.id, "message-concurrent-a", 1),
      store.claim(job.id, "message-concurrent-b", 1),
    ]);

    expect(claims.filter((claim) => claim.status === "claimed")).toHaveLength(1);
    expect(claims.filter((claim) => claim.status === "busy")).toHaveLength(1);
  });

  it("acknowledges a completed redelivery without running it twice", async () => {
    const { db, src } = await sourceFixture();
    const store = briefingJobStore(db);
    const job = await store.createCollectJob(src, "2026-08-30", "2026-08-30T15:00");
    const first = await store.claim(job.id, "message-1", 1);
    expect(first.status).toBe("claimed");
    await store.complete(job.id, "message-1", { evidenceCreated: 2 });
    const duplicate = await store.claim(job.id, "message-1", 2);
    expect(duplicate.status).toBe("duplicate");
    const deliveries = await db.select().from(briefingJobDelivery);
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.status).toBe("completed");
  });

  it("retries with a lease and moves the fifth failure to permanent quarantine", async () => {
    const { db, src } = await sourceFixture();
    const store = briefingJobStore(db);
    const job = await store.createCollectJob(src, "2026-08-30", "2026-08-30T15:00");

    for (let delivery = 1; delivery <= 5; delivery++) {
      await db.update(briefingJob).set({ state: "pending", availableAt: new Date(0) }).where(eq(briefingJob.id, job.id));
      const claim = await store.claim(job.id, "message-retry", delivery);
      expect(claim.status).toBe("claimed");
      const failed = await store.fail(claim.job!, "message-retry", new Error("controlled provider failure"));
      expect(failed.quarantined).toBe(delivery === 5);
    }

    const [stored] = await db.select().from(briefingJob).where(eq(briefingJob.id, job.id));
    expect(stored).toMatchObject({ state: "quarantined", attempts: 5 });
    expect(stored?.lastError).toBe("controlled provider failure");
  });

  it("defers a claimed job without consuming its retry budget", async () => {
    const { db, src } = await sourceFixture();
    const store = briefingJobStore(db);
    const job = await store.createCollectJob(src, "2026-08-30", "2026-08-30T15:00");
    const claim = await store.claim(job.id, "message-paused", 1);
    expect(claim.status).toBe("claimed");

    await store.defer(job.id, "message-paused", "processing_paused");
    const [stored] = await db.select().from(briefingJob).where(eq(briefingJob.id, job.id));
    const [delivery] = await db.select().from(briefingJobDelivery);
    expect(stored).toMatchObject({ state: "pending", attempts: 0 });
    expect(stored?.availableAt.getTime()).toBeGreaterThan(Date.now());
    expect(delivery).toMatchObject({ status: "deferred" });
  });

  it("can explicitly restart a completed editorial stage without deleting its delivery history", async () => {
    const { db } = await sourceFixture();
    const store = briefingJobStore(db);
    const [edition] = await db.insert(briefingEdition).values({
      localDate: "2026-08-28",
      contractVersion: "test-contract",
      promptVersion: "test-prompt",
      collectionOpenedAt: new Date(),
    }).returning();
    const job = await store.createStageJob(edition!.id, "2026-08-28", "triage");
    await store.claim(job.id, "message-regenerate", 1);
    await store.complete(job.id, "message-regenerate", { stories: 2 });

    const restarted = await store.restartStageJob(job.id);
    const deliveries = await db.select().from(briefingJobDelivery);
    expect(restarted).toMatchObject({ id: job.id, state: "pending", attempts: 0 });
    expect(deliveries).toHaveLength(1);
    expect(deliveries[0]?.status).toBe("completed");
  });

  it("can explicitly restart an editorial stage only after its worker lease is stale", async () => {
    const { db } = await sourceFixture();
    const store = briefingJobStore(db);
    const [edition] = await db.insert(briefingEdition).values({
      localDate: "2026-08-28",
      contractVersion: "test-contract",
      promptVersion: "test-prompt",
      collectionOpenedAt: new Date(),
    }).returning();
    const job = await store.createStageJob(edition!.id, "2026-08-28", "draft");
    await db.update(briefingJob).set({ state: "running", leaseUntil: new Date(Date.now() - 1_000) })
      .where(eq(briefingJob.id, job.id));

    const restarted = await store.restartStageJob(job.id);
    expect(restarted).toMatchObject({ id: job.id, state: "pending", attempts: 0 });
  });

  it("retries a quarantined configuration failure once and preserves the original cause", async () => {
    const { db, src } = await sourceFixture();
    const store = briefingJobStore(db);
    const job = await store.createCollectJob(src, "2026-08-30", "2026-08-30T15:00");
    await db.update(briefingJob).set({
      state: "quarantined",
      attempts: 5,
      lastError: "Vercel Blob: Access denied, please provide a valid token for this resource.",
      finishedAt: new Date(),
    }).where(eq(briefingJob.id, job.id));

    const recovered = await store.recoverConfigurationFailures();
    expect(recovered).toHaveLength(1);
    const [stored] = await db.select().from(briefingJob).where(eq(briefingJob.id, job.id));
    expect(stored).toMatchObject({ state: "pending", attempts: 0 });
    expect(stored?.checkpoint).toMatchObject({
      configurationRecovery: { error: expect.stringContaining("Vercel Blob: Access denied") },
    });

    await db.update(briefingJob).set({ state: "quarantined", attempts: 5 }).where(eq(briefingJob.id, job.id));
    expect(await store.recoverConfigurationFailures()).toHaveLength(0);
  });

  /* The Israel Hayom quarantines of 2026-09-08: a storage-idempotency defect,
     never the source's fault, so the same one-shot revival applies. */
  it("retries a job quarantined by the content-addressed blob collision once", async () => {
    const { db, src } = await sourceFixture();
    const store = briefingJobStore(db);
    const job = await store.createCollectJob(src, "2026-09-08", "2026-09-08T01:30");
    await db.update(briefingJob).set({
      state: "quarantined",
      attempts: 5,
      lastError: "Vercel Blob: This blob already exists, use `allowOverwrite: true` if you want to overwrite it.",
      finishedAt: new Date(),
    }).where(eq(briefingJob.id, job.id));

    expect(await store.recoverConfigurationFailures()).toHaveLength(1);
    const [stored] = await db.select().from(briefingJob).where(eq(briefingJob.id, job.id));
    expect(stored).toMatchObject({ state: "pending", attempts: 0 });
    expect(stored?.checkpoint).toMatchObject({
      configurationRecovery: { error: expect.stringContaining("This blob already exists") },
    });
  });

  /* `publish:2026-09-01:v1` in Production: `fail()` decided from a row that
     under-reported the attempt count and wrote `pending` back onto a job
     whose stored counter was already exhausted. `claim` requires
     `attempts < max_attempts`, so nothing could ever take it, and it aged
     the queue metric for a week. The database's counter is the authority. */
  it("quarantines from the stored attempt counter, not the caller's stale row", async () => {
    const { db, src } = await sourceFixture();
    const store = briefingJobStore(db);
    const job = await store.createCollectJob(src, "2026-08-30", "2026-08-30T15:00");
    const claim = await store.claim(job.id, "message-stale", 1);
    expect(claim.status).toBe("claimed");
    await db.update(briefingJob).set({ attempts: 5 }).where(eq(briefingJob.id, job.id));

    const failed = await store.fail({ ...claim.job!, attempts: 1 }, "message-stale", new Error("late failure"));
    expect(failed.quarantined).toBe(true);
    const [stored] = await db.select().from(briefingJob).where(eq(briefingJob.id, job.id));
    expect(stored).toMatchObject({ state: "quarantined", attempts: 5 });
    const [delivery] = await db.select().from(briefingJobDelivery);
    expect(delivery).toMatchObject({ status: "quarantined" });
  });

  it("sweeps a pending collect job with a spent attempt budget into quarantine", async () => {
    const { db, src } = await sourceFixture();
    const store = briefingJobStore(db);
    const job = await store.createCollectJob(src, "2026-08-30", "2026-08-30T15:00");
    await db.update(briefingJob).set({ state: "pending", attempts: 5, lastError: "Failed query: insert into narrative" })
      .where(eq(briefingJob.id, job.id));

    const recovered = await store.recoverStale();
    expect(recovered.map((row) => row.id)).toEqual([job.id]);
    const [stored] = await db.select().from(briefingJob).where(eq(briefingJob.id, job.id));
    expect(stored).toMatchObject({ state: "quarantined", attempts: 5, lastError: "Failed query: insert into narrative" });
    expect(stored?.finishedAt).not.toBeNull();
  });

  /* The internal briefing initiator was retired on 2026-09-06. A draft or
     publish row left pending or quarantined from before that date is not
     work any worker will run, yet it counted as such for a week. */
  it("discards retired-stage jobs while leaving collection jobs alone", async () => {
    const { db, src } = await sourceFixture();
    const store = briefingJobStore(db);
    const [edition] = await db.insert(briefingEdition).values({
      localDate: "2026-09-02",
      contractVersion: "test-contract",
      promptVersion: "test-prompt",
      collectionOpenedAt: new Date(),
    }).returning();
    const draft = await store.createStageJob(edition!.id, "2026-09-02", "draft");
    await db.update(briefingJob).set({
      state: "quarantined", attempts: 5, finishedAt: new Date("2026-09-02T04:34:23.000Z"),
      lastError: "The model response was not valid JSON (finish: length/max_output_tokens).",
    }).where(eq(briefingJob.id, draft.id));
    const publish = await store.createStageJob(edition!.id, "2026-09-01", "publish");
    await db.update(briefingJob).set({ state: "pending", attempts: 5, checkpoint: { completed: true } })
      .where(eq(briefingJob.id, publish.id));
    const collect = await store.createCollectJob(src, "2026-09-08", "2026-09-08T09:00");
    await db.update(briefingJob).set({ state: "quarantined", attempts: 5 }).where(eq(briefingJob.id, collect.id));

    const discarded = await store.retireLegacyStageJobs();
    expect(discarded.map((row) => row.state)).toEqual(["discarded", "discarded"]);
    expect(await store.retireLegacyStageJobs()).toHaveLength(0);

    const rows = await db.select().from(briefingJob);
    const byId = new Map(rows.map((row) => [row.id, row]));
    expect(byId.get(draft.id)).toMatchObject({
      state: "discarded",
      lastError: "The model response was not valid JSON (finish: length/max_output_tokens).",
      finishedAt: new Date("2026-09-02T04:34:23.000Z"),
    });
    expect(byId.get(draft.id)?.checkpoint).toMatchObject({ retired: { previousState: "quarantined" } });
    expect(byId.get(publish.id)).toMatchObject({ state: "discarded" });
    expect(byId.get(publish.id)?.checkpoint).toMatchObject({ completed: true, retired: { previousState: "pending" } });
    expect(byId.get(publish.id)?.finishedAt).not.toBeNull();
    expect(byId.get(collect.id)).toMatchObject({ state: "quarantined" });
  });

});
