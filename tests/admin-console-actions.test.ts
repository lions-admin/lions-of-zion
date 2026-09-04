/**
 * The operations console's recovery actions.
 *
 * Each action is checked for three things: the state it leaves behind, the
 * `audit_log` row it writes in the same transaction, and the refusal it gives
 * when the precondition is not met. Rollback is additionally held to the
 * versioning rule — it must appear as a new version, never as a rewrite.
 */
import { describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import {
  auditLog,
  briefingAlert,
  briefingJob,
  entityVersion,
  publication,
  source,
  sourceFamily,
} from "@/server/db/schema";

vi.mock("@/server/core/auth/neon", () => ({
  neonAuth: () => ({ getSession: async () => ({ data: null }) }),
}));

const { adminConsoleService } = await import("@/server/modules/admin-console/service");
const { publicationService } = await import("@/server/modules/publications/service");

const actor = { label: "admin:test", userId: null };

async function sourceFixture(db: TestDatabase, config: Record<string, unknown> | null, active = false) {
  const [family] = await db.insert(sourceFamily).values({ slug: "action-feed", label: "Action Feed" }).returning();
  const [src] = await db.insert(source).values({
    sourceFamilyId: family!.id,
    kind: "rss",
    slug: "action-feed",
    logicalKey: "rss:url:https://example.org/action.xml",
    name: "Action Feed",
    feedUrl: "https://example.org/action.xml",
    language: "en",
    active,
    config,
  }).returning();
  return src!;
}

const auditActions = async (db: TestDatabase) => (await db.select().from(auditLog)).map((row) => row.action);

describe("retryJob", () => {
  it("returns a quarantined job to pending, resets attempts on request, audits, and dispatches", async () => {
    const db = await freshDatabase();
    const [job] = await db.insert(briefingJob).values({
      jobKey: "draft:2026-09-03:v1", stage: "draft", localDate: "2026-09-03", state: "quarantined",
      attempts: 5, maxAttempts: 5, lastError: "exhausted", finishedAt: new Date(),
    }).returning();
    const dispatched: string[] = [];
    const console = adminConsoleService(db, { dispatch: async (next) => { dispatched.push(next.id); } });

    await expect(console.retryJob(job!.id, { resetAttempts: false }, actor)).rejects.toThrow(/resetAttempts/);

    const result = await console.retryJob(job!.id, { resetAttempts: true }, actor, "req-1");
    expect(result).toEqual({ jobId: job!.id, previousState: "quarantined", state: "pending", dispatched: true });
    expect(dispatched).toEqual([job!.id]);
    const [stored] = await db.select().from(briefingJob).where(eq(briefingJob.id, job!.id));
    expect(stored).toMatchObject({ state: "pending", attempts: 0, leaseUntil: null, finishedAt: null });
    expect(stored!.availableAt.getTime()).toBeLessThanOrEqual(Date.now() + 2_000);
    const [audit] = await db.select().from(auditLog);
    expect(audit).toMatchObject({ action: "ops.job.retried", entityType: "event", entityId: job!.id, actorLabel: "admin:test", requestId: "req-1" });
    expect(audit!.beforeState).toMatchObject({ state: "quarantined", attempts: 5 });
  });

  it("requeues a stuck job without a queue and refuses a live or completed one", async () => {
    const db = await freshDatabase();
    const [stuck] = await db.insert(briefingJob).values({
      jobKey: "enrich:stuck", stage: "enrich", localDate: "2026-09-03", state: "running", attempts: 2, leaseUntil: new Date(Date.now() - 1_000),
    }).returning();
    const [live] = await db.insert(briefingJob).values({
      jobKey: "enrich:live", stage: "enrich", localDate: "2026-09-04", state: "running", attempts: 1, leaseUntil: new Date(Date.now() + 60_000),
    }).returning();
    const [done] = await db.insert(briefingJob).values({
      jobKey: "enrich:done", stage: "enrich", localDate: "2026-09-02", state: "completed", attempts: 1, finishedAt: new Date(),
    }).returning();
    const console = adminConsoleService(db, { dispatch: null });

    expect(await console.retryJob(stuck!.id, { resetAttempts: false }, actor)).toMatchObject({ previousState: "running", state: "pending", dispatched: false });
    const [stored] = await db.select().from(briefingJob).where(eq(briefingJob.id, stuck!.id));
    expect(stored).toMatchObject({ state: "pending", attempts: 2, leaseUntil: null });
    await expect(console.retryJob(live!.id, { resetAttempts: false }, actor)).rejects.toThrow(/live worker lease/);
    await expect(console.retryJob(done!.id, { resetAttempts: false }, actor)).rejects.toThrow(/completed job/i);
    await expect(console.retryJob("00000000-0000-0000-0000-000000000000", { resetAttempts: false }, actor)).rejects.toThrow(/not found/);
  });

  it("reports dispatched:false when the queue send fails, leaving the job ready for cron recovery", async () => {
    const db = await freshDatabase();
    const [job] = await db.insert(briefingJob).values({ jobKey: "collect:q", stage: "collect", localDate: "2026-09-03", state: "quarantined", attempts: 5 }).returning();
    const console = adminConsoleService(db, { dispatch: async () => { throw new Error("queue unavailable"); } });
    const result = await console.retryJob(job!.id, { resetAttempts: true }, actor);
    expect(result.dispatched).toBe(false);
    const [stored] = await db.select().from(briefingJob).where(eq(briefingJob.id, job!.id));
    expect(stored?.state).toBe("pending");
  });
});

describe("resolveAlert", () => {
  it("sets resolved_at once, with the note in the audit trail", async () => {
    const db = await freshDatabase();
    const [alert] = await db.insert(briefingAlert).values({ fingerprint: "f", kind: "budget", severity: "critical", message: "Budget exhausted" }).returning();
    const console = adminConsoleService(db, { dispatch: null });
    const resolved = await console.resolveAlert(alert!.id, { note: "Raised the ceiling" }, actor);
    expect(resolved.resolvedAt).not.toBeNull();
    const [stored] = await db.select().from(briefingAlert).where(eq(briefingAlert.id, alert!.id));
    expect(stored?.resolvedAt).not.toBeNull();
    const [audit] = await db.select().from(auditLog);
    expect(audit).toMatchObject({ action: "ops.alert.resolved", entityType: "event", entityId: alert!.id });
    expect(audit!.afterState).toMatchObject({ note: "Raised the ceiling" });
    await expect(console.resolveAlert(alert!.id, {}, actor)).rejects.toThrow(/already resolved/);
    await expect(console.resolveAlert("00000000-0000-0000-0000-000000000000", {}, actor)).rejects.toThrow(/not found/);
  });
});

describe("setSourceActive", () => {
  it("refuses to enable an unverified feed and tells the operator to verify first", async () => {
    const db = await freshDatabase();
    const src = await sourceFixture(db, { verificationState: "pending" });
    const console = adminConsoleService(db, { dispatch: null });
    await expect(console.setSourceActive(src.id, { active: true, reason: "Looks fine" }, actor)).rejects.toThrow(/[Vv]erify.*before enabling/);
    const [stored] = await db.select().from(source).where(eq(source.id, src.id));
    expect(stored?.active).toBe(false);
    expect(await db.select().from(auditLog)).toHaveLength(0);
  });

  it("enables a verified feed through the versioned source service and audits the reason", async () => {
    const db = await freshDatabase();
    const src = await sourceFixture(db, { verificationState: "verified" });
    const console = adminConsoleService(db, { dispatch: null });
    expect(await console.setSourceActive(src.id, { active: true, reason: "Verified by live fetch" }, actor)).toEqual({ id: src.id, active: true });
    const [stored] = await db.select().from(source).where(eq(source.id, src.id));
    expect(stored?.active).toBe(true);
    const versions = await db.select().from(entityVersion).where(eq(entityVersion.entityId, src.id));
    expect(versions).toHaveLength(1);
    expect(versions[0]).toMatchObject({ entityType: "source", changeSummary: "Verified by live fetch" });
    expect(stored?.currentVersionId).toBe(versions[0]!.id);
    expect(await auditActions(db)).toEqual(["source.created", "ops.source.enabled"]);
    await expect(console.setSourceActive(src.id, { active: true, reason: "again" }, actor)).rejects.toThrow(/already enabled/);
  });

  it("disables any source regardless of verification", async () => {
    const db = await freshDatabase();
    const src = await sourceFixture(db, { verificationState: "pending" }, true);
    const console = adminConsoleService(db, { dispatch: null });
    expect(await console.setSourceActive(src.id, { active: false, reason: "Feed is a duplicate" }, actor)).toEqual({ id: src.id, active: false });
    expect(await auditActions(db)).toContain("ops.source.disabled");
  });
});

describe("publication versions and rollback", () => {
  it("lists versions with the head marked and rolls back as a new version", async () => {
    const db = await freshDatabase();
    const svc = publicationService(db);
    const created = await svc.create({ kind: "news_update", section: "israel_update", title: "Original title", summary: "Original standfirst", body: "Original body", language: "en" }, actor);
    await svc.update(created.id, { title: "Edited title", body: "Edited body", changeSummary: "Edited" }, actor);
    const console = adminConsoleService(db, { dispatch: null });

    const before = await console.publicationVersions(created.id);
    expect(before.map((version) => [version.versionNumber, version.isHead])).toEqual([[2, true], [1, false]]);
    const first = before.find((version) => version.versionNumber === 1)!;

    await expect(console.rollbackPublication(created.id, { versionId: before[0]!.versionId }, actor)).rejects.toThrow(/already the current/);

    const result = await console.rollbackPublication(created.id, { versionId: first.versionId }, actor, "req-rb");
    expect(result).toMatchObject({ id: created.id, versionNumber: 3, restoredFrom: first.versionId });

    const after = await console.publicationVersions(created.id);
    expect(after.map((version) => [version.versionNumber, version.isHead])).toEqual([[3, true], [2, false], [1, false]]);
    expect(after[0]!.changeSummary).toBe("Rolled back to version 1");

    const [head] = await db.select().from(publication).where(eq(publication.id, created.id));
    expect(head).toMatchObject({ title: "Original title", body: "Original body", summary: "Original standfirst", status: "draft" });
    expect(head!.currentVersionId).toBe(after[0]!.versionId);
    const [snapshotRow] = await db.select().from(entityVersion).where(eq(entityVersion.id, first.versionId));
    const snapshot = snapshotRow!.snapshot as { title: string; body: string };
    expect(head!.title).toBe(snapshot.title);
    expect(head!.body).toBe(snapshot.body);

    const actions = await auditActions(db);
    expect(actions.filter((action) => action === "news_update.updated")).toHaveLength(2);
    expect(actions).toContain("ops.publication.rolled_back");
    const rollbackAudit = (await db.select().from(auditLog)).find((row) => row.action === "ops.publication.rolled_back")!;
    expect(rollbackAudit).toMatchObject({ entityType: "news_update", entityId: created.id, requestId: "req-rb" });
    expect(rollbackAudit.afterState).toMatchObject({ restoredFromVersionNumber: 1 });
  });

  it("refuses a version that belongs to another publication", async () => {
    const db = await freshDatabase();
    const svc = publicationService(db);
    const one = await svc.create({ kind: "news_update", section: "israel_update", title: "One", body: "One", language: "en" }, actor);
    const two = await svc.create({ kind: "news_update", section: "israel_update", title: "Two", body: "Two", language: "en" }, actor);
    const console = adminConsoleService(db, { dispatch: null });
    const [foreign] = await console.publicationVersions(two.id);
    await expect(console.rollbackPublication(one.id, { versionId: foreign!.versionId }, actor)).rejects.toThrow(/not found/);
    await expect(console.publicationVersions("00000000-0000-0000-0000-000000000000")).rejects.toThrow(/not found/);
  });
});
