/**
 * P2 console reads and actions: the reports desk read (R7), public-chat
 * moderation reads and archival (R8), system internals (R6), the on-demand
 * collection sweep (A3), sign-in refusal telemetry, email delivery telemetry,
 * and the operations agent's per-turn cost linkage (A7).
 *
 * Service reads and actions run directly against seeded PGlite. The last
 * group drives the new route files with the database client, Neon Auth and
 * the queue client mocked at module scope: an unauthenticated request must
 * come back 401 problem+json from every one, and a signed request (the
 * development `x-actor-label` shim) must reach the seeded database through
 * the route, not around it.
 */
import { describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import {
  aiRun,
  auditLog,
  chatMessage,
  chatThread,
  chatToolRun,
  report,
  searchDocument,
  source,
  sourceFamily,
  sourceFetch,
  briefingJob,
} from "@/server/db/schema";

const state = vi.hoisted(() => ({ db: undefined as unknown }));
vi.mock("@/server/db/client", () => ({
  db: () => {
    if (!state.db) throw new Error("No test database registered for this test.");
    return state.db;
  },
  withDatabaseRole: (_role: string, _identity: string, fn: () => Promise<unknown>) => fn(),
  closeDb: async () => {},
}));
vi.mock("@/server/core/auth/neon", () => ({
  neonAuth: () => ({ getSession: async () => ({ data: null }) }),
}));
vi.mock("@/server/core/auth/google-session", () => ({
  readGoogleSession: async (request: Request) => {
    const email = request.headers.get("x-test-google-email");
    return email ? { id: "u-not-owner", email, name: "Not The Owner" } : null;
  },
}));
vi.mock("@vercel/queue", () => ({ QueueClient: class { send = async () => {}; } }));
/* Email telemetry audits only where the send gate is open (production). */
vi.mock("@/server/core/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/core/config")>()),
  mayActOnTheWorld: () => true,
}));

const { adminConsoleService } = await import("@/server/modules/admin-console/service");
const { authenticateAdmin } = await import("@/server/core/auth/actor");
const { sendWorkspaceEmail } = await import("@/server/core/email");
const { publicReadCache } = await import("@/server/core/public-read-cache");

const actor = { label: "admin:test", userId: null };

const auditRows = async (db: TestDatabase) => (await db.select().from(auditLog)).map((row) => ({
  action: row.action,
  entityType: row.entityType,
  entityId: row.entityId,
  actorLabel: row.actorLabel,
  afterState: row.afterState,
}));

async function sourceFixture(db: TestDatabase, slug: string, active = false) {
  const [family] = await db.insert(sourceFamily).values({ slug, label: slug }).returning();
  const [src] = await db.insert(source).values({
    sourceFamilyId: family!.id,
    kind: "rss",
    slug,
    logicalKey: `rss:url:https://example.org/${slug}.xml`,
    name: slug,
    feedUrl: `https://example.org/${slug}.xml`,
    language: "en",
    active,
  }).returning();
  return src!;
}

/* ── R7 — reports desk read ───────────────────────────────────────────────── */

describe("reports desk read", () => {
  it("pages newest first on the bigint keyset with each row's status-trail count and latest entry", async () => {
    const db = await freshDatabase();
    const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);
    const [one, two, three] = await db.insert(report).values([
      { publicId: "r-one", url: "https://example.org/1", body: "First claim", reporterEmail: "v@example.org", createdAt: minutesAgo(3) },
      { publicId: "r-two", body: "Second claim", createdAt: minutesAgo(2) },
      { publicId: "r-three", url: "https://example.org/3", body: "Third claim", createdAt: minutesAgo(1) },
    ]).returning();
    expect(two!.publicId).toBe("r-two");
    expect(three!.publicId).toBe("r-three");
    /* The trail is written by the DB trigger on a status change; the sleeps
       keep the two entries' created_at distinct, as they would be in the
       field. */
    await db.update(report).set({ status: "triaged" }).where(eq(report.id, one!.id));
    await new Promise((resolve) => setTimeout(resolve, 10));
    await db.update(report).set({ status: "investigating" }).where(eq(report.id, one!.id));

    const console = adminConsoleService(db, { dispatch: null });

    const page1 = await console.reports({ limit: 2 });
    expect(page1.reports.map((row) => row.publicId)).toEqual(["r-three", "r-two"]);
    /* The keyset cursor names the boundary row it was cut at. */
    expect(page1.nextCursor).toEqual(expect.stringContaining(page1.reports.at(-1)!.id));
    expect(page1.filter).toEqual({ status: null });

    const page2 = await console.reports({ limit: 2, cursor: page1.nextCursor! });
    expect(page2.reports.map((row) => row.publicId)).toEqual(["r-one"]);
    expect(page2.nextCursor).toBeNull();

    const all = await console.reports({ limit: 50 });
    expect(all.reports.map((row) => row.publicId)).toEqual(["r-three", "r-two", "r-one"]);
    const investigated = all.reports.find((row) => row.publicId === "r-one")!;
    expect(investigated.status).toBe("investigating");
    expect(investigated.trailCount).toBe(2);
    expect(investigated.latestTrail).toMatchObject({ toStatus: "investigating" });
    expect(investigated.latestTrail!.actorLabel.length).toBeGreaterThan(0);
    const untouched = all.reports.find((row) => row.publicId === "r-three")!;
    expect(untouched.status).toBe("received");
    expect(untouched.trailCount).toBe(0);
    expect(untouched.latestTrail).toBeNull();
  });

  it("filters by status and serves the read through its route once signed in", async () => {
    const db = await freshDatabase();
    state.db = db;
    const [triaged, open] = await db.insert(report).values([
      { publicId: "r-triaged", url: "https://example.org/a", body: "A" },
      { publicId: "r-open", url: "https://example.org/b", body: "B" },
    ]).returning();
    await db.update(report).set({ status: "triaged" }).where(eq(report.id, triaged!.id));
    const console = adminConsoleService(db, { dispatch: null });

    const filtered = await console.reports({ limit: 50, status: "triaged" });
    expect(filtered.reports.map((row) => row.publicId)).toEqual(["r-triaged"]);
    expect(filtered.filter).toEqual({ status: "triaged" });
    expect(open!.status).toBe("received");

    const route = await import("@/app/api/v1/admin/console/reports/route");
    const signed = { headers: { "x-actor-label": "admin:test" } };
    const response = await route.GET(
      new Request("http://localhost/api/v1/admin/console/reports?limit=2&status=triaged", signed),
    );
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({
      limit: 2,
      filter: { status: "triaged" },
      reports: [{ publicId: "r-triaged", status: "triaged" }],
    });
  });
});

/* ── R8 — chat moderation ─────────────────────────────────────────────────── */

async function chatFixture(db: TestDatabase) {
  const [run] = await db.insert(aiRun).values({
    kind: "chat", model: "xai/grok-9", modelProfile: "fast", status: "ok",
    actorLabel: "public:reader", inputTokens: 210, outputTokens: 55, costUsd: "0.0009", latencyMs: 320,
  }).returning();
  const [threadA, threadB] = await db.insert(chatThread).values([
    { title: "Which outlet claimed this?", createdByLabel: "public:reader" },
    { createdByLabel: "public:reader-two" },
  ]).returning();
  const [userMsg, assistantMsg] = await db.insert(chatMessage).values([
    { threadId: threadA!.id, seq: 1, role: "user", content: "Which outlet claimed this?" },
    { threadId: threadA!.id, seq: 2, role: "assistant", content: "The answer, with citations.", aiRunId: run!.id },
    { threadId: threadB!.id, seq: 1, role: "user", content: "Hello" },
  ]).returning();
  await db.insert(chatToolRun).values({
    threadId: threadA!.id,
    messageId: assistantMsg!.id,
    tool: "search",
    input: { q: "claim" },
    resultDocumentIds: ["11111111-1111-4111-8111-111111111111", "22222222-2222-4222-8222-222222222222"],
    status: "ok",
    latencyMs: 45,
  });
  return { run: run!, threadA: threadA!, threadB: threadB!, userMsg: userMsg!, assistantMsg: assistantMsg! };
}

describe("chatThreads", () => {
  it("lists threads newest first with message counts, last-message-at and creator label", async () => {
    const db = await freshDatabase();
    const { threadA, threadB } = await chatFixture(db);
    const console = adminConsoleService(db, { dispatch: null });

    const page = await console.chatThreads({ limit: 50 });
    expect(page.threads).toHaveLength(2);
    expect(page.threads.map((row) => row.id)).toContain(threadA.id);
    expect(page.threads.map((row) => row.id)).toContain(threadB.id);
    const a = page.threads.find((row) => row.id === threadA.id)!;
    expect(a.createdByLabel).toBe("public:reader");
    expect(a.messageCount).toBe(2);
    expect(a.lastMessageAt).toBeTruthy();
    expect(a.archivedAt).toBeNull();
    const b = page.threads.find((row) => row.id === threadB.id)!;
    expect(b.messageCount).toBe(1);
  });

  it("pages on the (createdAt, id) keyset without skipping a thread", async () => {
    const db = await freshDatabase();
    const { threadA, threadB } = await chatFixture(db);
    const console = adminConsoleService(db, { dispatch: null });

    const page1 = await console.chatThreads({ limit: 1 });
    expect(page1.threads).toHaveLength(1);
    expect(page1.nextCursor).toBeTruthy();
    const page2 = await console.chatThreads({ limit: 50, cursor: page1.nextCursor! });
    expect(page2.threads).toHaveLength(1);
    expect(page2.nextCursor).toBeNull();
    const seen = [page1.threads[0]!.id, page2.threads[0]!.id].sort();
    expect(seen).toEqual([threadA.id, threadB.id].sort());
  });
});

describe("chatTranscript", () => {
  it("returns ordered messages with tool runs and the assistant message's ai_run linkage", async () => {
    const db = await freshDatabase();
    const { run, threadA } = await chatFixture(db);
    const console = adminConsoleService(db, { dispatch: null });

    const transcript = await console.chatTranscript(threadA.id);
    expect(transcript.thread).toMatchObject({ id: threadA.id, createdByLabel: "public:reader" });
    expect(transcript.messages.map((m) => [m.seq, m.role])).toEqual([[1, "user"], [2, "assistant"]]);
    const assistant = transcript.messages.find((m) => m.role === "assistant")!;
    expect(assistant.run).toMatchObject({
      aiRunId: run.id, model: "xai/grok-9", profile: "fast",
      inputTokens: 210, outputTokens: 55, costUsd: 0.0009,
    });
    expect(assistant.toolRuns).toEqual([{ tool: "search", status: "ok", resultCount: 2, latencyMs: 45 }]);
    const user = transcript.messages.find((m) => m.role === "user")!;
    expect(user.run).toBeNull();
    expect(user.toolRuns).toEqual([]);

    await expect(console.chatTranscript("00000000-0000-0000-0000-000000000000")).rejects.toThrow(/not found/);
  });
});

describe("archiveChatThread", () => {
  it("archives once, audits, and refuses an already-archived thread", async () => {
    const db = await freshDatabase();
    const { threadA } = await chatFixture(db);
    const console = adminConsoleService(db, { dispatch: null });

    const result = await console.archiveChatThread(threadA.id, actor, "req-arch");
    expect(result.wasArchived).toBe(true);
    const [stored] = await db.select().from(chatThread).where(eq(chatThread.id, threadA.id));
    expect(stored!.archivedAt).not.toBeNull();
    expect(result.archivedAt).toBeTruthy();

    const rows = await auditRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "ops.chat.thread_archived", entityType: "system", entityId: threadA.id });

    await expect(console.archiveChatThread(threadA.id, actor)).rejects.toThrow(/already archived/);
    await expect(console.archiveChatThread("00000000-0000-0000-0000-000000000000", actor)).rejects.toThrow(/not found/);
    expect((await auditRows(db)).map((row) => row.action)).toEqual(["ops.chat.thread_archived"]);
  });
});

describe("chat routes", () => {
  it("refuses every chat route with 401 problem+json when nobody is signed in", async () => {
    state.db = await freshDatabase();
    const threads = await import("@/app/api/v1/admin/console/chat/threads/route");
    const transcript = await import("@/app/api/v1/admin/console/chat/threads/[id]/transcript/route");
    const archive = await import("@/app/api/v1/admin/console/chat/threads/[id]/archive/route");

    const list = await threads.GET(new Request("http://localhost/api/v1/admin/console/chat/threads"));
    expect(list.status).toBe(401);
    expect((await list.json()).error.code).toBe("UNAUTHENTICATED");

    const read = await transcript.GET(
      new Request("http://localhost/api/v1/admin/console/chat/threads/x/transcript"),
      { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) },
    );
    expect(read.status).toBe(401);

    const post = await archive.POST(
      new Request("http://localhost/api/v1/admin/console/chat/threads/x/archive", { method: "POST" }),
      { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) },
    );
    expect(post.status).toBe(401);
  });

  it("serves the thread list, transcript and archive through their routes once signed in", async () => {
    const db = await freshDatabase();
    state.db = db;
    const { threadA } = await chatFixture(db);
    const threads = await import("@/app/api/v1/admin/console/chat/threads/route");
    const transcript = await import("@/app/api/v1/admin/console/chat/threads/[id]/transcript/route");
    const archive = await import("@/app/api/v1/admin/console/chat/threads/[id]/archive/route");
    const signed = { headers: { "x-actor-label": "admin:test", origin: "http://localhost", "sec-fetch-site": "same-origin" } };

    const list = await threads.GET(
      new Request("http://localhost/api/v1/admin/console/chat/threads?limit=10", signed),
    );
    expect(list.status).toBe(200);
    expect((await list.json()).threads).toHaveLength(2);

    const read = await transcript.GET(
      new Request(`http://localhost/api/v1/admin/console/chat/threads/${threadA.id}/transcript`, signed),
      { params: Promise.resolve({ id: threadA.id }) },
    );
    expect(read.status).toBe(200);
    const body = await read.json();
    expect(body.messages).toHaveLength(2);

    const post = await archive.POST(
      new Request(`http://localhost/api/v1/admin/console/chat/threads/${threadA.id}/archive`, { method: "POST", ...signed }),
      { params: Promise.resolve({ id: threadA.id }) },
    );
    expect(post.status).toBe(200);
    expect(await post.json()).toMatchObject({ id: threadA.id, wasArchived: true });
  });
});

/* ── R6 — system internals ────────────────────────────────────────────────── */

describe("systemInternals", () => {
  it("reports figures from seeded rows: the hash backlog, the semantic arm, cache stats and embed runs", async () => {
    const db = await freshDatabase();
    await db.insert(searchDocument).values({
      entityType: "information_item",
      entityId: "33333333-3333-4333-8333-333333333333",
      title: "A projected item",
      body: "Its projection body.",
      language: "en",
    });
    await db.insert(aiRun).values({
      kind: "embed", model: "openai/text-embedding-9", modelProfile: "embedding", status: "ok",
      actorLabel: "service:cron", inputTokens: 30, outputTokens: 0, costUsd: "0.00001",
      createdAt: new Date(Date.now() - 60_000),
    });
    await db.insert(aiRun).values({
      kind: "embed", model: "openai/text-embedding-9", modelProfile: "embedding", status: "ok",
      actorLabel: "service:cron", inputTokens: 30, outputTokens: 0, costUsd: "0.00001",
      createdAt: new Date(Date.now() - 3 * 24 * 60 * 60 * 1_000),
    });

    /* Prime the real process counter: one miss with a load, then one hit. */
    await publicReadCache("p2-test", async () => "loaded");
    await publicReadCache("p2-test", async () => "loaded");

    const console = adminConsoleService(db, { dispatch: null });
    const internals = await console.systemInternals();

    /* The seeded row carries no indexed hash, so the whole projection row is
       stale until an embed stamps it — backlog 1 of 1 indexed. */
    expect(internals.embeddingBacklog).toEqual({ stale: 1, indexed: 1 });
    /* PGlite ships no pgvector, so the semantic arm is honestly false here. */
    expect(internals.semanticArm).toBe(false);
    expect(internals.embeddingRuns.last24h).toBe(1);
    expect(internals.embeddingRuns.lastRunAt).toBeTruthy();
    /* The cache block comes from the real counter, not a stub. */
    const { publicReadCacheStats } = await import("@/server/core/public-read-cache");
    expect(internals.publicReadCache).toEqual(publicReadCacheStats());
    expect(internals.publicReadCache).toMatchObject({ hits: expect.any(Number), misses: expect.any(Number) });
    expect(internals.publicReadCache.hits).toBeGreaterThanOrEqual(1);
    expect(internals.publicReadCache.loads).toBeGreaterThanOrEqual(1);
  });
});

describe("system-internals route", () => {
  it("answers 401 unauthenticated and 200 signed", async () => {
    state.db = await freshDatabase();
    const route = await import("@/app/api/v1/admin/console/system-internals/route");

    const refused = await route.GET(new Request("http://localhost/api/v1/admin/console/system-internals"));
    expect(refused.status).toBe(401);
    expect((await refused.json()).error.code).toBe("UNAUTHENTICATED");

    const served = await route.GET(
      new Request("http://localhost/api/v1/admin/console/system-internals", { headers: { "x-actor-label": "admin:test" } }),
    );
    expect(served.status).toBe(200);
    const body = await served.json();
    expect(body).toMatchObject({
      embeddingBacklog: { stale: 0, indexed: 0 },
      semanticArm: false,
      embeddingRuns: { last24h: 0, lastRunAt: null },
    });
  });
});

/* ── A3 — collection sweep on demand ──────────────────────────────────────── */

describe("runCollectionSweep", () => {
  it("enqueues due sources only: a fresh fetch waits, a cadence-stale source collects, with the audit row", async () => {
    const db = await freshDatabase();
    state.db = db;
    const fresh = await sourceFixture(db, "sweep-fresh", true);
    const due = await sourceFixture(db, "sweep-due", true);
    const minutesAgo = (n: number) => new Date(Date.now() - n * 60_000);
    /* RSS cadence is one fetch per hour; a ten-minute-old fetch is not due. */
    await db.insert(sourceFetch).values([
      { sourceId: fresh.id, status: "success", startedAt: minutesAgo(10), finishedAt: minutesAgo(9), itemsSeen: 3, itemsNew: 3 },
      { sourceId: due.id, status: "success", startedAt: minutesAgo(3 * 60), finishedAt: minutesAgo(3 * 60 - 1), itemsSeen: 5, itemsNew: 2 },
    ]);
    const console = adminConsoleService(db, { dispatch: null });

    const result = await console.runCollectionSweep(actor, "req-sweep");

    expect(result.status).toBe("ran");
    expect(result.enqueued).toBe(1);
    expect(result.alreadyCompleted).toBe(0);
    expect(result.dispatchFailed).toBe(0);
    expect(result.results).toEqual([
      { sourceId: due.id, jobId: expect.any(String), status: "queued", error: null },
    ]);
    /* A collect job exists for the due source and for nothing else. */
    const jobs = await db.select().from(briefingJob);
    expect(jobs).toHaveLength(1);
    expect(jobs[0]).toMatchObject({ stage: "collect", sourceId: due.id, state: "pending" });

    const rows = await auditRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "ops.collection.sweep", entityType: "system" });
    expect(rows[0]!.afterState).toMatchObject({ enqueued: 1, alreadyCompleted: 0, dispatchFailed: 0 });
  });

  it("is window-idempotent: a second sweep inside the same window reports the same source without duplicating the ledger", async () => {
    const db = await freshDatabase();
    state.db = db;
    const src = await sourceFixture(db, "sweep-repeat", true);
    const console = adminConsoleService(db, { dispatch: null });

    const first = await console.runCollectionSweep(actor);
    expect(first.results[0]!.status).toBe("queued");
    /* The job ledger dedupes on `collect:<source>:<window>`: the second sweep
       inside the same half-hour window re-reports the one source rather than
       creating a second collect job. */
    const second = await console.runCollectionSweep(actor);
    expect(second.results[0]!.sourceId).toBe(src.id);
    expect(second.alreadyCompleted + second.enqueued).toBe(1);
    const jobs = await db.select().from(briefingJob);
    expect(jobs).toHaveLength(1);
    const actions = (await auditRows(db)).map((row) => row.action);
    expect(actions.filter((action) => action === "ops.collection.sweep")).toHaveLength(2);
  });
});

describe("collect-sweep route", () => {
  it("refuses unauthenticated and serves signed", async () => {
    state.db = await freshDatabase();
    const route = await import("@/app/api/v1/admin/console/sources/collect-sweep/route");

    const refused = await route.POST(
      new Request("http://localhost/api/v1/admin/console/sources/collect-sweep", { method: "POST" }),
    );
    expect(refused.status).toBe(401);
    expect((await refused.json()).error.code).toBe("UNAUTHENTICATED");

    const signed = { headers: { "x-actor-label": "admin:test", origin: "http://localhost", "sec-fetch-site": "same-origin" } };
    const served = await route.POST(
      new Request("http://localhost/api/v1/admin/console/sources/collect-sweep", { method: "POST", ...signed }),
    );
    expect(served.status).toBe(200);
    expect(await served.json()).toMatchObject({ status: "ran" });
  });
});

/* ── sign-in refusal telemetry ────────────────────────────────────────────── */

describe("authenticateAdmin refusal audit", () => {
  it("audits a 403 mismatch with the attempted email, once, with no actor label bypass", async () => {
    const db = await freshDatabase();
    state.db = db;
    process.env.ADMIN_EMAIL = "owner@example.org";

    await expect(
      authenticateAdmin(new Request("http://localhost/api/v1/admin/console/overview", {
        headers: { "x-test-google-email": "someone@example.org" },
      })),
    ).rejects.toThrowError(/not authorized for the admin area/);

    const rows = await auditRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "auth.refused",
      entityType: "system",
      entityId: null,
      actorLabel: "someone@example.org",
    });
    expect(rows[0]!.afterState).toEqual({ reason: "admin_email_mismatch" });
  });

  it("does not audit the development x-actor-label bypass, or a 401 with no session", async () => {
    const db = await freshDatabase();
    state.db = db;
    process.env.ADMIN_EMAIL = "owner@example.org";

    const bypassed = await authenticateAdmin(new Request("http://localhost/api/v1/admin/console/overview", {
      headers: { "x-actor-label": "admin:dev-bypass" },
    }));
    expect(bypassed.label).toBe("admin:dev-bypass");
    expect(await auditRows(db)).toEqual([]);

    await expect(
      authenticateAdmin(new Request("http://localhost/api/v1/admin/console/overview")),
    ).rejects.toThrowError(/Please sign in/);
    expect(await auditRows(db)).toEqual([]);
  });
});

/* ── email delivery telemetry ─────────────────────────────────────────────── */

describe("sendWorkspaceEmail telemetry", () => {
  it("writes email.sent after a successful send with the subject length and never the body", async () => {
    const db = await freshDatabase();
    state.db = db;
    const sent: Record<string, unknown>[] = [];

    await sendWorkspaceEmail(
      { to: "admin@lionsofzion.io", subject: "New public report — r-abc", text: "The body must never be audited." },
      async (mail) => { sent.push(mail as Record<string, unknown>); },
    );

    expect(sent).toHaveLength(1);
    expect(sent[0]).toMatchObject({ to: "admin@lionsofzion.io", subject: "New public report — r-abc" });
    const rows = await auditRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "email.sent", entityType: "system", entityId: null });
    expect(rows[0]!.afterState).toEqual({ to: "admin@lionsofzion.io", subjectLength: "New public report — r-abc".length });
    expect(JSON.stringify(rows[0])).not.toContain("must never be audited");
  });

  it("writes email.failed by error class only when the send throws, and rethrows", async () => {
    const db = await freshDatabase();
    state.db = db;

    await expect(
      sendWorkspaceEmail(
        { to: "admin@lionsofzion.io", subject: "Briefing alert", text: "x" },
        async () => { throw new Error("535 Authentication failed: SMTP secret rotated"); },
      ),
    ).rejects.toThrowError(/Authentication failed/);

    const rows = await auditRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({ action: "email.failed", entityType: "system" });
    expect(rows[0]!.afterState).toEqual({ to: "admin@lionsofzion.io", errorClass: "Error" });
    expect(JSON.stringify(rows[0])).not.toContain("535");
  });
});

/* ── A7 — per-tool cost linkage ───────────────────────────────────────────── */

type OpsCtx = import("@/server/modules/ops-agent/context").OpsToolContext;

function stubContext(): OpsCtx & { calls: string[] } {
  const calls: string[] = [];
  const note = <T>(name: string, value: T) => async (): Promise<T> => {
    calls.push(name);
    return value;
  };
  return {
    calls,
    console: {
      overview: note("overview", { systemActive: true, counts24h: { published: 3 } }),
      pipeline: note("pipeline", { stages: [] }),
      sources: note("sources", { totals: { active: 2, disabled: 1, failing: 0 } }),
      editorial: note("editorial", { counts: { draft: 1 } }),
      narratives: note("narratives", { counts: { new: 0, rising: 1, declining: 0 } }),
      users: note("users", { staff: [], registeredPublicUsers: 4 }),
      costs: note("costs", { spend: { monthToDateUsd: 1.5 }, warnings: [] }),
      incidents: note("incidents", { openAlerts: [], stuckJobs: [] }),
      editionDrilldown: note("editionDrilldown", { localDate: "2026-09-04", runs: [], artifacts: [], runAi: [], claims: [], jobs: [] }),
      sourceFetches: note("sourceFetches", { sourceId: "s", fetches: [], today: { attempts: 0, successes: 0, partial: 0, failed: 0, itemsSeen: 0, itemsNew: 0, lastError: null, boundaryAt: "2026-09-04T00:00:00.000Z" } }),
      qualityChecks: note("qualityChecks", { candidates: [], required: [], filter: { runId: null, localDate: null } }),
      security: note("security", { secrets: [{ name: "OPENAI_API_KEY", configured: true }] }),
      settings: note("settings", {}),
      audit: note("audit", { entries: [] }),
      auditEntry: note("auditEntry", {}),
      retryJob: note("retryJob", { previousState: "running", state: "pending", dispatched: true }),
      resolveAlert: note("resolveAlert", { kind: "source_failure" }),
      setSourceActive: note("setSourceActive", { id: "s", active: false }),
      publicationVersions: note("publicationVersions", []),
      rollbackPublication: note("rollbackPublication", { versionNumber: 4 }),
    },
    publications: {
      get: note("publications.get", { title: "A brief", status: "draft" }),
      list: note("publications.list", []),
      update: note("publications.update", { title: "A brief" }),
      remove: note("publications.remove", undefined),
      transition: note("publications.transition", { title: "A brief" }),
      setHomepageFeature: note("publications.setHomepageFeature", undefined),
    },
    briefing: {
      setAutomaticPublicationPaused: note("briefing.pause", { paused: true }),
      runProcessing: note("briefing.runProcessing", { status: "queued" }),
    },
    sources: {
      verify: note("sources.verify", { fetch: { status: "success", itemsSeen: 12 } }),
      syncCatalog: note("sources.syncCatalog", { created: 1, updated: 0 }),
    },
    health: note("health", { status: "ok" }),
  } as unknown as OpsCtx & { calls: string[] };
}

const scripted = (
  calls: Array<{ tool: string; args?: Record<string, unknown> }>,
  text = "Done.",
): import("@/server/modules/ops-agent/service").ToolLoopRunner => async (input) => {
  const steps = [];
  for (const [index, call] of calls.entries()) {
    const registered = input.tools[call.tool] as { execute?: (args: unknown) => Promise<unknown> } | undefined;
    if (!registered?.execute) throw new Error(`The loop was offered no tool named ${call.tool}`);
    const result = await registered.execute(call.args ?? {});
    steps.push({ toolCallId: `call-${index}`, toolName: call.tool, args: call.args ?? {}, result });
  }
  return {
    text,
    model: "openai/gpt-5.6-sol",
    inputTokens: 900,
    outputTokens: 120,
    latencyMs: 42,
    inputHash: "a".repeat(64),
    costUsd: 0.0064,
    steps,
  };
};

describe("ops agent per-tool cost linkage (A7)", () => {
  it("carries the turn's aiRunId and turn-attributed costUsd in tool-execution audit rows", async () => {
    const db = await freshDatabase();
    const agent = await import("@/server/modules/ops-agent/service");
    const response = await agent.opsAgentService(db, stubContext(), {
      run: scripted([{ tool: "get_overview" }]),
    }).turn({ history: [], message: "How are things?", confirmations: [] }, actor, "req-a7");

    const rows = await db.execute<{ action: string; after: unknown }>(sql`
      SELECT action, after_state AS after FROM audit_log WHERE action = 'ops.tool.get_overview'
    `);
    const after = rows.rows[0]!.after as { turn?: { aiRunId: string; costUsd: number } };
    expect(after.turn?.aiRunId).toBeTruthy();
    expect(after.turn?.costUsd).toBeCloseTo(0.0064);
    /* The linked row is the turn's own recorded spend. */
    const runs = await db.execute<{ id: string }>(sql`SELECT id FROM ai_run`);
    expect(runs.rows).toHaveLength(1);
    expect(after.turn?.aiRunId).toBe(runs.rows[0]!.id);

    const assistant = response.messages.at(-1)!;
    expect(assistant.toolCalls?.[0]).toMatchObject({
      tool: "get_overview",
      aiRunId: after.turn!.aiRunId,
      costUsd: 0.0064,
    });
  });

  it("records a turn's spend exactly once, after the model call", async () => {
    const db = await freshDatabase();
    const agent = await import("@/server/modules/ops-agent/service");
    await agent.opsAgentService(db, stubContext(), { run: scripted([]) }).turn(
      { history: [], message: "Hello", confirmations: [] },
      actor,
    );
    const runs = await db.execute<{ modelProfile: string; kind: string }>(sql`
      SELECT model_profile AS "modelProfile", kind FROM ai_run
    `);
    expect(runs.rows).toEqual([{ modelProfile: "opsConsole", kind: "chat" }]);
  });
});
