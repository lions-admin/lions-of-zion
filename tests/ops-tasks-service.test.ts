/**
 * The task board's workflow against a real (PGlite) database: a task's life
 * from `start` to `finish`, the rule that nothing completes without a finish,
 * the derived flags with an injected clock, the editorial run appearing
 * read-side, and the audited manual patch.
 */
import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import type { Database } from "@/server/db/client";
import { auditLog, editorialRun, opsTaskEvent } from "@/server/db/schema";
import { opsTasksService } from "@/server/modules/ops-tasks/service";
import { allowedManualTransition, deriveFlags, eventKindFor, israelDayStart, STALE_AFTER_MINUTES } from "@/server/modules/ops-tasks/rules";
import { opsHooksInventorySchema, opsReportSchema, type OpsHooksInventory, type OpsReport } from "@/server/contracts/ops-tasks";

let db: TestDatabase;
let clock = new Date("2026-09-12T10:00:00.000Z");
const store = vi.fn(async (pathname: string, _data: ArrayBuffer | Buffer, contentType: string) => ({
  url: `https://store.public.blob.vercel-storage.com/${pathname}`,
  contentType,
}));

beforeAll(async () => { db = await freshDatabase(); }, 60000);
afterAll(async () => { await db?.$client.close(); });

const service = () => opsTasksService(db as unknown as Database, { now: () => clock, store });
const ACTOR = "service:ops-reporter";
const line = (overrides: Partial<OpsReport> & Pick<OpsReport, "taskKey" | "event">): OpsReport => ({
  agent: "claude",
  environment: "/workspaces/claude",
  ...overrides,
});

describe("report()", () => {
  it("carries a task from start through progress to finish", async () => {
    clock = new Date("2026-09-12T10:00:00.000Z");
    const started = await service().report({ reports: [line({
      taskKey: "claude:s1", event: "start", title: "Build the board", request: "Make one page for every task", kind: "code",
      hostname: "mac", reporterVersion: "1.0.0", meta: { branch: "ai/claude" },
    })] }, ACTOR);
    expect(started.accepted).toBe(1);
    const [id] = started.taskIds;

    let detail = await service().detail(id!);
    expect(detail.task).toMatchObject({ taskKey: "claude:s1", status: "running", title: "Build the board", reportedFinish: false, kind: "code" });
    expect(detail.task.startedAt).toBe("2026-09-12T10:00:00.000Z");
    expect(detail.events.map((event) => event.kind)).toEqual(["started"]);

    clock = new Date("2026-09-12T10:10:00.000Z");
    await service().report({ reports: [line({ taskKey: "claude:s1", event: "progress", message: "migration written", summary: "half way" })] }, ACTOR);
    detail = await service().detail(id!);
    expect(detail.task).toMatchObject({ status: "running", summary: "half way", lastUpdateAt: "2026-09-12T10:10:00.000Z" });
    expect(detail.events.map((event) => event.kind)).toEqual(["progress", "started"]);

    clock = new Date("2026-09-12T10:20:00.000Z");
    await service().report({ reports: [line({ taskKey: "claude:s1", event: "finish", changes: "4 tables", remaining: "none", links: [{ label: "PR", url: "https://github.com/x/y/pull/1" }] })] }, ACTOR);
    detail = await service().detail(id!);
    expect(detail.task).toMatchObject({ status: "completed", reportedFinish: true, changes: "4 tables", finishedAt: "2026-09-12T10:20:00.000Z" });
    expect(detail.task.links).toEqual([{ label: "PR", url: "https://github.com/x/y/pull/1" }]);
    /* The service wrote `finished` with the transition; the trigger did not add a second row. */
    expect(detail.events.map((event) => [event.kind, event.fromStatus, event.toStatus])).toEqual([
      ["finished", "running", "completed"], ["progress", null, null], ["started", null, "running"],
    ]);

    const list = await service().list({});
    expect(list.coverage.find((reporter) => reporter.agent === "claude")).toMatchObject({ hostname: "mac", reporterVersion: "1.0.0", lastTaskId: id });
  });

  it("never completes a task without a finish report", async () => {
    clock = new Date("2026-09-12T11:00:00.000Z");
    const { taskIds: [id] } = await service().report({ reports: [line({ taskKey: "claude:s2", event: "start", title: "Silent" })] }, ACTOR);
    await service().report({ reports: [
      line({ taskKey: "claude:s2", event: "progress", summary: "all done, really" }),
      line({ taskKey: "claude:s2", event: "note", message: "session ended without finish", meta: { sessionEnded: true } }),
    ] }, ACTOR);
    const detail = await service().detail(id!);
    expect(detail.task.status).toBe("running");
    expect(detail.task.reportedFinish).toBe(false);
    expect(detail.task.derived.unreported).toBe(true);
    expect(detail.task.meta).toMatchObject({ sessionEnded: true });

    /* A finish with an explicit outcome keeps that outcome. */
    await service().report({ reports: [line({ taskKey: "claude:s2", event: "finish", status: "failed", blockers: "tests red" })] }, ACTOR);
    expect((await service().detail(id!)).task).toMatchObject({ status: "failed", reportedFinish: true, blockers: "tests red" });
  });

  it("creates a parent on first sight and files the child under it", async () => {
    clock = new Date("2026-09-12T11:30:00.000Z");
    const { taskIds } = await service().report({ reports: [line({ taskKey: "claude:child", parentKey: "claude:parent", event: "start", title: "Sub-agent" })] }, ACTOR);
    const child = await service().detail(taskIds[0]!);
    expect(child.task.parentId).not.toBeNull();
    const parent = await service().detail(child.task.parentId!);
    expect(parent.task).toMatchObject({ taskKey: "claude:parent", title: "claude:parent", status: "queued" });
    expect(parent.children.map((task) => task.taskKey)).toEqual(["claude:child"]);
  });

  it("treats a replayed eventKey as a no-op for the task as well as the timeline", async () => {
    clock = new Date("2026-09-12T12:00:00.000Z");
    const { taskIds: [id] } = await service().report({ reports: [line({ taskKey: "claude:replay", event: "start", eventKey: "k-start" })] }, ACTOR);
    clock = new Date("2026-09-12T12:05:00.000Z");
    await service().report({ reports: [line({ taskKey: "claude:replay", event: "finish", eventKey: "k-finish", summary: "first" })] }, ACTOR);
    clock = new Date("2026-09-12T12:30:00.000Z");
    await service().report({ reports: [line({ taskKey: "claude:replay", event: "finish", eventKey: "k-finish", summary: "replayed" })] }, ACTOR);
    const detail = await service().detail(id!);
    expect(detail.task).toMatchObject({ summary: "first", lastUpdateAt: "2026-09-12T12:05:00.000Z" });
    expect(detail.events).toHaveLength(2);
  });

  it("refuses a status report that names no status", async () => {
    await expect(service().report({ reports: [line({ taskKey: "claude:no-status", event: "status" })] }, ACTOR)).rejects.toThrow(/must carry a status/);
  });

  it("accepts a whole batch or none of it", async () => {
    clock = new Date("2026-09-12T12:40:00.000Z");
    await expect(service().report({ reports: [
      line({ taskKey: "claude:batch-ok", event: "start" }),
      line({ taskKey: "claude:batch-bad", event: "status" }),
    ] }, ACTOR)).rejects.toThrow();
    const list = await service().list({ q: "batch-ok" });
    expect(list.tasks).toHaveLength(0);
  });
});

describe("derived flags", () => {
  const base = { status: "running" as const, reportedFinish: false, meta: {}, lastUpdateAt: new Date("2026-09-12T10:00:00Z") };

  it("marks a live task stale after the threshold and never a finished one", () => {
    const fresh = new Date(base.lastUpdateAt.getTime() + (STALE_AFTER_MINUTES - 1) * 60_000);
    const late = new Date(base.lastUpdateAt.getTime() + (STALE_AFTER_MINUTES + 1) * 60_000);
    expect(deriveFlags(base, fresh)).toEqual({ stale: false, unreported: false });
    expect(deriveFlags(base, late)).toEqual({ stale: true, unreported: false });
    expect(deriveFlags({ ...base, status: "waiting" }, late).stale).toBe(true);
    expect(deriveFlags({ ...base, status: "completed" }, late).stale).toBe(false);
    expect(deriveFlags({ ...base, status: "blocked" }, late).stale).toBe(false);
  });

  it("marks unreported only when the session ended without a finish", () => {
    const now = base.lastUpdateAt;
    expect(deriveFlags({ ...base, meta: { sessionEnded: true } }, now).unreported).toBe(true);
    expect(deriveFlags({ ...base, meta: { sessionEnded: true }, reportedFinish: true }, now).unreported).toBe(false);
    expect(deriveFlags({ ...base, meta: { sessionEnded: true }, status: "completed" }, now).unreported).toBe(false);
    expect(deriveFlags({ ...base, meta: { sessionEnded: "yes" } }, now).unreported).toBe(false);
  });

  it("surfaces the flags on listed rows with the injected clock", async () => {
    clock = new Date("2026-09-12T13:00:00.000Z");
    await service().report({ reports: [line({ taskKey: "claude:stale", event: "start", title: "Went quiet" })] }, ACTOR);
    clock = new Date("2026-09-12T13:10:00.000Z");
    expect((await service().list({ q: "Went quiet" })).tasks[0]!.derived.stale).toBe(false);
    clock = new Date("2026-09-12T14:00:00.000Z");
    expect((await service().list({ q: "Went quiet" })).tasks[0]!.derived.stale).toBe(true);
  });

  it("maps reporter events to timeline kinds and gates manual transitions", () => {
    expect(eventKindFor("start")).toBe("started");
    expect(eventKindFor("finish")).toBe("finished");
    expect(eventKindFor("commit")).toBe("commit");
    expect(allowedManualTransition("running", "cancelled")).toBe(true);
    expect(allowedManualTransition("completed", "cancelled")).toBe(true);
    expect(allowedManualTransition("cancelled", "cancelled")).toBe(false);
    expect(allowedManualTransition("completed", "completed")).toBe(false);
    expect(allowedManualTransition("failed", "blocked")).toBe(false);
    expect(allowedManualTransition("running", "waiting")).toBe(true);
    expect(allowedManualTransition("waiting", "waiting")).toBe(false);
  });

  it("starts an Israel-local day at local midnight", () => {
    expect(israelDayStart("2026-09-12").toISOString()).toBe("2026-09-11T21:00:00.000Z");
    expect(israelDayStart("2026-01-15").toISOString()).toBe("2026-01-14T22:00:00.000Z");
  });
});

describe("list()", () => {
  it("merges editorial runs read-side as chatgpt-editorial tasks", async () => {
    clock = new Date("2026-09-12T15:00:00.000Z");
    const [run] = await db.insert(editorialRun).values({
      runKey: "chatgpt-daily-2026-09-12-0700-a1b2", requestHash: "a".repeat(64), mode: "operations", localDate: "2026-09-12",
      requestedBy: "external:chatgpt", request: { runId: "x", mode: "operations", operations: [], delivery: { composer: "chatgpt-daily" } } as never,
      status: "running", stage: "media", startedAt: new Date("2026-09-12T14:50:00Z"), updatedAt: new Date("2026-09-12T14:55:00Z"),
    }).returning();

    const list = await service().list({ agent: "chatgpt-editorial" });
    expect(list.tasks).toHaveLength(1);
    expect(list.tasks[0]).toMatchObject({
      id: run!.id, taskKey: "editorial:chatgpt-daily-2026-09-12-0700-a1b2", agent: "chatgpt-editorial", kind: "editorial",
      status: "running", title: "chatgpt-daily · 2026-09-12", links: [{ label: "מערכת העריכה", url: "/admin?area=editorial-runs" }],
    });
    expect(list.summary.running).toBeGreaterThanOrEqual(1);

    /* A filter that excludes the editorial agent excludes the merge. */
    expect((await service().list({ agent: "codex" })).tasks.some((task) => task.agent === "chatgpt-editorial")).toBe(false);
    expect((await service().list({ kind: "code" })).tasks.some((task) => task.agent === "chatgpt-editorial")).toBe(false);

    /* And detail resolves the run's own id. */
    const detail = await service().detail(run!.id);
    expect(detail.task.taskKey).toBe("editorial:chatgpt-daily-2026-09-12-0700-a1b2");
    expect(detail.events).toEqual([]);
  });

  it("filters, counts and pages by last update", async () => {
    clock = new Date("2026-09-12T16:00:00.000Z");
    for (let i = 0; i < 3; i += 1) {
      clock = new Date(clock.getTime() + 60_000);
      await service().report({ reports: [line({ taskKey: `codex:page-${i}`, agent: "codex", event: "start", title: `Page ${i}`, kind: "review" })] }, ACTOR);
    }
    const first = await service().list({ agent: "codex", kind: "review", limit: "2" });
    expect(first.tasks.map((task) => task.title)).toEqual(["Page 2", "Page 1"]);
    expect(first.nextBefore).toBe(first.tasks[1]!.lastUpdateAt);
    const second = await service().list({ agent: "codex", kind: "review", limit: "2", before: first.nextBefore! });
    expect(second.tasks.map((task) => task.title)).toEqual(["Page 0"]);
    expect(second.nextBefore).toBeNull();

    const byStatus = await service().list({ status: "running,waiting", q: "Page" });
    expect(byStatus.tasks.length).toBeGreaterThanOrEqual(3);
    expect((await service().list({ from: "2026-09-13" })).tasks).toHaveLength(0);
    expect((await service().list({ to: "2026-09-12", q: "Page 1" })).tasks).toHaveLength(1);
    expect(byStatus.summary.completedToday).toBeGreaterThanOrEqual(1);
  });
});

describe("hooks inventory", () => {
  const inventory = (agent: OpsHooksInventory["agent"], collectedAt: string, note: string): OpsHooksInventory => ({
    collectedAt,
    hostname: "mac",
    agent,
    tools: [{
      id: "claude-code", label: "Claude Code", status: "active", configPath: "~/.claude/settings.json", note,
      hooks: [{ event: "Stop", command: "node scripts/ops/report.mjs finish", source: "~/.claude/settings.json", timeout: 60, enabled: true }],
    }],
  });

  it("stores the inventory on the reporter and the list returns it", async () => {
    clock = new Date("2026-09-12T16:30:00.000Z");
    const first = inventory("claude", "2026-09-12T16:29:00.000Z", "first");
    await service().report({ reports: [line({ taskKey: "claude:hooks", event: "note", message: "inventory", hooksInventory: first })] }, ACTOR);
    const list = await service().list({});
    expect(list.hooksInventory).toEqual(first);
    expect(list.coverage.find((reporter) => reporter.agent === "claude")?.meta).toMatchObject({ hooksInventory: first });

    /* A line without one leaves the stored inventory in place. */
    await service().report({ reports: [line({ taskKey: "claude:hooks", event: "progress", message: "no inventory" })] }, ACTOR);
    expect((await service().list({})).hooksInventory).toEqual(first);
  });

  it("returns the newest collectedAt across agents and replaces, never deep-merges, per agent", async () => {
    clock = new Date("2026-09-12T16:40:00.000Z");
    const codex = inventory("codex", "2026-09-12T16:39:00.000Z", "codex newer");
    await service().report({ reports: [line({ taskKey: "codex:hooks", agent: "codex", event: "start", hooksInventory: codex })] }, ACTOR);
    expect((await service().list({})).hooksInventory).toEqual(codex);

    /* An older inventory from another agent does not win. */
    const stale = inventory("grok", "2026-09-12T16:00:00.000Z", "grok older");
    await service().report({ reports: [line({ taskKey: "grok:hooks", agent: "grok", event: "start", hooksInventory: stale })] }, ACTOR);
    expect((await service().list({})).hooksInventory).toEqual(codex);

    /* The same agent reporting again replaces its inventory whole. */
    const replaced: OpsHooksInventory = { ...inventory("codex", "2026-09-12T16:41:00.000Z", "codex replaced"), tools: [{ id: "codex", label: "Codex", status: "none", hooks: [] }] };
    await service().report({ reports: [line({ taskKey: "codex:hooks", agent: "codex", event: "progress", hooksInventory: replaced })] }, ACTOR);
    const list = await service().list({});
    expect(list.hooksInventory).toEqual(replaced);
    expect(list.coverage.find((reporter) => reporter.agent === "codex")?.meta).toEqual({ hooksInventory: replaced });
  });

  it("rejects an oversized or malformed inventory at the contract", () => {
    const huge = { ...inventory("claude", "2026-09-12T16:00:00.000Z", "x"), tools: Array.from({ length: 20 }, (_, i) => ({
      id: `tool-${i}`, label: "Tool", status: "active" as const, note: "n".repeat(600),
      hooks: Array.from({ length: 10 }, () => ({ event: "Stop", command: "c".repeat(600), source: "s".repeat(300), note: "m".repeat(300) })),
    })) };
    expect(JSON.stringify(huge).length).toBeGreaterThan(65_536);
    expect(opsHooksInventorySchema.safeParse(huge).success).toBe(false);
    expect(opsReportSchema.safeParse(line({ taskKey: "k", event: "note", hooksInventory: huge })).success).toBe(false);
    expect(opsHooksInventorySchema.safeParse({ ...inventory("claude", "2026-09-12T16:00:00.000Z", "x"), tools: [] }).success).toBe(false);
    expect(opsHooksInventorySchema.safeParse({ ...inventory("claude", "2026-09-12T16:00:00.000Z", "x"), extra: 1 }).success).toBe(false);
    expect(opsHooksInventorySchema.safeParse({ ...inventory("claude", "2026-09-12T16:00:00.000Z", "x"), tools: [{ id: "t", label: "T", status: "off", hooks: [] }] }).success).toBe(false);
  });
});

describe("summarize()", () => {
  const generate = vi.fn();
  const summarizer = () => opsTasksService(db as unknown as Database, { now: () => clock, store, generate });
  const output = (text: string) => ({ text, model: "test/fast", inputTokens: 100, outputTokens: 50, latencyMs: 10, inputHash: "h", costUsd: 0.0001 });

  it("writes the model's Hebrew fields onto the task, translates an English title and request, and notes the run", async () => {
    clock = new Date("2026-09-12T16:50:00.000Z");
    const { taskIds: [id] } = await service().report({ reports: [line({ taskKey: "claude:digest", event: "start", title: "Build the summariser" })] }, ACTOR);
    generate.mockResolvedValueOnce(output('```json\n{"title":"כותרת מהמודל","request":"בנה את זה","summary":"התבקש סיכום. בוצע.","changes":"- server/x.ts","remaining":"לא נותר דבר","blockers":null}\n```'));
    clock = new Date("2026-09-12T16:55:00.000Z");
    const task = await summarizer().summarize({
      taskKey: "claude:digest", request: "build it", lastAssistant: "done", filesEdited: ["server/x.ts"],
      commits: [{ sha: "abc1234", subject: "feat: x" }], toolCounts: { Edit: 3 }, language: "mixed", source: "claude-stop-hook",
    }, ACTOR);
    expect(task).toMatchObject({
      id, title: "כותרת מהמודל", request: "בנה את זה", summary: "התבקש סיכום. בוצע.", changes: "- server/x.ts", remaining: "לא נותר דבר", blockers: null,
      lastUpdateAt: "2026-09-12T16:55:00.000Z",
    });
    expect(task.meta).toMatchObject({ summarized: { at: "2026-09-12T16:55:00.000Z", model: "test/fast", costUsd: 0.0001, parsed: true } });
    const call = generate.mock.calls[0]![0] as { profile: string; kind: string; prompt: string; system: string; tags: string[] };
    expect(call).toMatchObject({ profile: "fast", kind: "summarize", tags: ["ops-tasks", "summarize"] });
    expect(call.prompt).toContain("abc1234 feat: x");
    expect(call.system).toContain("JSON");
    const detail = await service().detail(id!);
    expect(detail.events[0]).toMatchObject({ kind: "note", message: "סוכם אוטומטית (test/fast)", actorLabel: ACTOR });
  });

  it("replaces a placeholder title, falls back to raw text on malformed output, and refuses an unknown task", async () => {
    clock = new Date("2026-09-12T17:05:00.000Z");
    await service().report({ reports: [line({ taskKey: "codex:untitled", agent: "codex", event: "start" })] }, ACTOR);
    generate.mockResolvedValueOnce(output("I could not produce JSON, sorry."));
    const task = await summarizer().summarize({ taskKey: "codex:untitled", lastAssistant: "whatever" }, ACTOR);
    expect(task.title).toBe("codex:untitled");
    expect(task.summary).toContain("I could not produce JSON, sorry.");
    expect(task.summary).toMatch(/JSON/);
    expect(task.meta).toMatchObject({ summarized: { parsed: false } });

    generate.mockResolvedValueOnce(output('{"title":"כותרת","summary":"סיכום","changes":"- a","remaining":"לא נותר דבר"}'));
    const retitled = await summarizer().summarize({ taskKey: "codex:untitled" }, ACTOR);
    expect(retitled.title).toBe("כותרת");
    expect(retitled.blockers).toBeNull();

    await expect(summarizer().summarize({ taskKey: "nobody:here" }, ACTOR)).rejects.toThrow(/not found/);
    await expect(summarizer().summarize({ taskKey: "codex:untitled", extra: 1 }, ACTOR)).rejects.toThrow();
  });
});

describe("attach()", () => {
  it("stores the object under ops/attachments/<taskId>/<sha256>, records the row and the event", async () => {
    clock = new Date("2026-09-12T17:00:00.000Z");
    const { taskIds: [id] } = await service().report({ reports: [line({ taskKey: "claude:shot", event: "start", title: "Visual" })] }, ACTOR);
    const png = Buffer.from("89504e470d0a1a0a", "hex");
    const attachment = await service().attach({
      taskKey: "claude:shot", kind: "after", pairKey: "hero", caption: "After", contentType: "image/png",
      dataBase64: png.toString("base64"), width: 1280, height: 800, eventKey: "shot-1",
    }, ACTOR);
    expect(store).toHaveBeenCalledTimes(1);
    const [pathname] = store.mock.calls[0]!;
    expect(pathname).toMatch(new RegExp(`^ops/attachments/${id}/[a-f0-9]{64}\\.png$`));
    expect(attachment).toMatchObject({ kind: "after", pairKey: "hero", byteSize: png.length, width: 1280, height: 800 });
    const detail = await service().detail(id!);
    expect(detail.attachments).toHaveLength(1);
    expect(detail.task.derived.attachmentCount).toBe(1);
    expect(detail.events[0]).toMatchObject({ kind: "attachment", message: "After" });
    expect(detail.task.lastUpdateAt).toBe("2026-09-12T17:00:00.000Z");
  });

  it("refuses an unknown task, an empty body and an oversize body", async () => {
    await expect(service().attach({ taskKey: "nobody", kind: "file", contentType: "text/plain", dataBase64: "aGk=" }, ACTOR)).rejects.toThrow(/not found/);
    await expect(service().attach({ taskKey: "claude:shot", kind: "file", contentType: "text/plain", dataBase64: "====" }, ACTOR)).rejects.toThrow(/empty/);
    await expect(service().attach({ taskKey: "claude:shot", kind: "file", contentType: "text/plain", dataBase64: "aGk=", width: 10 }, ACTOR)).rejects.toThrow(/together/);
  });
});

describe("patch()", () => {
  it("applies an allowed manual status with a note and writes the audit row in the same transaction", async () => {
    clock = new Date("2026-09-12T18:00:00.000Z");
    const { taskIds: [id] } = await service().report({ reports: [line({ taskKey: "claude:manual", event: "start", title: "Abandoned" })] }, ACTOR);
    const actor = { label: "human:owner", userId: null };
    const patched = await service().patch(id!, { status: "cancelled", note: "superseded by the redesign" }, actor, "req-1");
    expect(patched).toMatchObject({ status: "cancelled", finishedAt: "2026-09-12T18:00:00.000Z", reportedFinish: false });
    expect(patched.meta).toMatchObject({ manualStatus: { by: "human:owner", note: "superseded by the redesign" } });

    const events = await db.select().from(opsTaskEvent).where(eq(opsTaskEvent.taskId, id!));
    expect(events.filter((event) => event.toStatus === "cancelled")).toHaveLength(1);
    expect(events.find((event) => event.toStatus === "cancelled")).toMatchObject({ kind: "note", actorLabel: "human:owner", message: "superseded by the redesign" });

    const audits = await db.select().from(auditLog).where(eq(auditLog.action, "ops_task.patch"));
    expect(audits).toHaveLength(1);
    expect(audits[0]).toMatchObject({ entityType: "system", entityId: id, actorLabel: "human:owner", requestId: "req-1" });

    await expect(service().patch(id!, { status: "cancelled", note: "again" }, actor)).rejects.toThrow(/cannot be set/);
    await expect(service().patch("00000000-0000-0000-0000-000000000000", { status: "completed", note: "x" }, actor)).rejects.toThrow(/not found/);
    expect((await db.execute(sql`SELECT count(*)::int AS n FROM audit_log WHERE action = 'ops_task.patch'`)).rows[0]).toEqual({ n: 1 });
  });
});
