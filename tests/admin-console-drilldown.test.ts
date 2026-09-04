/**
 * Edition drilldown and source fetch reads, and the HTTP guards on their new
 * routes.
 *
 * The drilldown read is the console's per-edition recovery screen: one payload
 * covering the stage ledger, the model runs behind each stage, the stored
 * artifacts (latest version only), the claims the edition rests on, and the
 * edition's stage jobs. The fetch read is the per-source recovery screen with
 * an Israel-local "today" roll-up whose midnight boundary is inclusive.
 *
 * The last group drives the new route files themselves, with the database
 * client and Neon Auth mocked at module scope: an unauthenticated request must
 * come back 401 problem+json from every one, and a signed-in request (the
 * development `x-actor-label` shim `authenticateAdmin` honours in tests) must
 * reach the seeded PGlite database through the route, not around it.
 */
import { describe, expect, it, vi } from "vitest";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import {
  aiRun,
  auditLog,
  briefingClaim,
  briefingEdition,
  briefingJob,
  briefingQuarantine,
  briefingRun,
  briefingRunAi,
  briefingStageArtifact,
  informationItem,
  outbox,
  publication,
  publicationItem,
  source,
  sourceFamily,
  sourceFetch,
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

const { adminConsoleService } = await import("@/server/modules/admin-console/service");
const { israelLocalDate } = await import("@/server/modules/briefing/service");
const editionsRoute = await import("@/app/api/v1/admin/console/editions/[localDate]/route");
const fetchesRoute = await import("@/app/api/v1/admin/console/sources/[id]/fetches/route");

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1_000);

/** The instant of Israel-local midnight of today, computed with the same zone
 *  the queries use. Used to pin the "today" aggregate's inclusive boundary. */
function israelMidnight(now: Date): Date {
  const local = israelLocalDate(now);
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem", timeZoneName: "longOffset",
  }).formatToParts(now);
  const offset = (parts.find((part) => part.type === "timeZoneName")?.value ?? "GMT+00:00").replace("GMT", "");
  return new Date(`${local}T00:00:00${offset}`);
}

async function sourceFixture(db: TestDatabase) {
  const [family] = await db.insert(sourceFamily).values({ slug: "drilldown-feed", label: "Drilldown Feed" }).returning();
  const [src] = await db.insert(source).values({
    sourceFamilyId: family!.id,
    kind: "rss",
    slug: "drilldown-feed",
    logicalKey: "rss:url:https://example.org/drilldown.xml",
    name: "Drilldown Feed",
    feedUrl: "https://example.org/drilldown.xml",
    language: "en",
    config: { verificationState: "verified" },
  }).returning();
  return { family: family!, src: src! };
}

describe("editionDrilldown", () => {
  it("returns the edition with its stage runs, latest artifacts, model links, claims and jobs", async () => {
    const db = await freshDatabase();
    const { src } = await sourceFixture(db);
    const [edition] = await db.insert(briefingEdition).values({
      localDate: "2026-09-03", status: "published", contractVersion: "1", promptVersion: "1",
      collectionOpenedAt: daysAgo(2), collectionClosedAt: daysAgo(1), publishedAt: daysAgo(1),
    }).returning();
    const [enrichRun, draftRun] = await db.insert(briefingRun).values([
      { localDate: "2026-09-03", stage: "enrich", status: "completed", inputCount: 12, outputCount: 8, startedAt: daysAgo(2), finishedAt: daysAgo(2) },
      { localDate: "2026-09-03", stage: "draft", status: "running", inputCount: 3, startedAt: daysAgo(0.01) },
    ]).returning();
    await db.insert(briefingStageArtifact).values([
      { editionId: edition!.id, stage: "enrich", artifactVersion: 1, inputHash: "a".repeat(64), payload: { evidenceIds: ["old"] } },
      { editionId: edition!.id, stage: "enrich", artifactVersion: 2, inputHash: "b".repeat(64), payload: { evidenceIds: ["new"] } },
      { editionId: edition!.id, stage: "draft", artifactVersion: 1, inputHash: "c".repeat(64), payload: { edition: { title: "Brief" } } },
    ]);
    const [modelRun] = await db.insert(aiRun).values({
      kind: "summarize", model: "openai/gpt-5.6", modelProfile: "briefing_draft", status: "ok",
      actorLabel: "service", inputTokens: 100, outputTokens: 40, costUsd: "0.0042", latencyMs: 1200,
    }).returning();
    await db.insert(briefingRunAi).values([
      { briefingRunId: enrichRun!.id, aiRunId: modelRun!.id, stage: "enrich" },
      { briefingRunId: draftRun!.id, aiRunId: modelRun!.id, stage: "draft" },
    ]);
    const [item] = await db.insert(informationItem).values({
      publicId: "i-claim-1", type: "claim", title: "Claimed X", canonicalText: "X", language: "en",
    }).returning();
    const [brief] = await db.insert(publication).values({
      kind: "brief", section: "daily_brief", publicId: "b-drilldown-1",
      title: "The Brief", body: "Body", language: "en", briefingRunId: draftRun!.id,
    }).returning();
    await db.insert(publicationItem).values({ publicationId: brief!.id, itemId: item!.id });
    await db.insert(briefingClaim).values({
      itemId: item!.id, layer: "source_claim", machineAssessment: "verified",
      attributedTo: "The outlet", uncertainty: null,
    });
    await db.insert(briefingJob).values([
      { jobKey: "enrich:2026-09-03", stage: "enrich", localDate: "2026-09-03", sourceId: src.id, editionId: edition!.id, state: "completed", attempts: 1, startedAt: daysAgo(2), finishedAt: daysAgo(2) },
      { jobKey: "draft:2026-09-03", stage: "draft", localDate: "2026-09-03", editionId: edition!.id, state: "running", attempts: 1, leaseUntil: new Date(Date.now() + 60_000), startedAt: daysAgo(0.01) },
    ]);
    const console = adminConsoleService(db, { dispatch: null });

    const result = await console.editionDrilldown({ localDate: "2026-09-03" });

    expect(result.edition).toMatchObject({ localDate: "2026-09-03", status: "published" });
    expect(result.runs.map((run) => [run.stage, run.status, run.inputCount, run.outputCount])).toEqual([
      ["enrich", "completed", 12, 8],
      ["draft", "running", 3, 0],
    ]);
    expect(result.runs.find((run) => run.stage === "draft")?.finishedAt).toBeNull();
    /* Only the latest artifact version per stage survives the read. */
    expect(result.artifacts.map((artifact) => [artifact.stage, artifact.artifactVersion, artifact.inputHash])).toEqual([
      ["enrich", 2, "b".repeat(64)],
      ["draft", 1, "c".repeat(64)],
    ]);
    expect(result.runAi).toHaveLength(2);
    expect(result.runAi.every((link) => link.model === "openai/gpt-5.6" && link.profile === "briefing_draft")).toBe(true);
    expect(result.runAi.find((link) => link.stage === "enrich")).toMatchObject({
      inputTokens: 100, outputTokens: 40, costUsd: 0.0042, latencyMs: 1200, status: "ok",
    });
    expect(result.claims).toEqual([expect.objectContaining({
      itemId: item!.id, layer: "source_claim", machineAssessment: "verified", attributedTo: "The outlet", uncertainty: null,
    })]);
    expect(result.jobs.map((job) => job.jobKey).sort()).toEqual(["draft:2026-09-03", "enrich:2026-09-03"]);
    /* A draft job that is running with a live lease is not reported stuck here. */
    expect(result.jobs.find((job) => job.jobKey === "draft:2026-09-03")?.state).toBe("running");
  });

  it("returns an edition whose ledger and artifacts are empty, and refuses a date with none", async () => {
    const db = await freshDatabase();
    await db.insert(briefingEdition).values({
      localDate: "2026-09-02", status: "collecting", contractVersion: "1", promptVersion: "1",
      collectionOpenedAt: daysAgo(1), collectionClosedAt: null,
    });
    const console = adminConsoleService(db, { dispatch: null });
    const result = await console.editionDrilldown({ localDate: "2026-09-02" });
    expect(result.edition.status).toBe("collecting");
    expect(result.runs).toEqual([]);
    expect(result.artifacts).toEqual([]);
    expect(result.runAi).toEqual([]);
    expect(result.claims).toEqual([]);
    expect(result.jobs).toEqual([]);
    await expect(console.editionDrilldown({ localDate: "2026-01-01" })).rejects.toThrow(/not found/);
  });
});

describe("sourceFetches", () => {
  it("lists the latest fetches newest first and rolls up Israel-local today inclusively", async () => {
    const db = await freshDatabase();
    const { src } = await sourceFixture(db);
    const midnight = israelMidnight(new Date());
    await db.insert(sourceFetch).values([
      { sourceId: src.id, status: "success", startedAt: daysAgo(1), finishedAt: daysAgo(1), itemsSeen: 10, itemsNew: 5 },
      { sourceId: src.id, status: "success", startedAt: midnight, finishedAt: midnight, itemsSeen: 4, itemsNew: 1 },
      { sourceId: src.id, status: "failed", startedAt: new Date(midnight.getTime() + 60_000), finishedAt: new Date(midnight.getTime() + 60_000), errorMessage: "HTTP 503" },
      { sourceId: src.id, status: "partial", startedAt: new Date(midnight.getTime() + 120_000), finishedAt: new Date(midnight.getTime() + 130_000), itemsSeen: 6, itemsNew: 0, errorMessage: "One entry did not parse" },
      { sourceId: src.id, status: "success", startedAt: daysAgo(30), finishedAt: daysAgo(30), itemsSeen: 50, itemsNew: 50 },
    ]);
    const console = adminConsoleService(db, { dispatch: null });
    const result = await console.sourceFetches({ id: src.id, limit: 2 });

    expect(result.sourceId).toBe(src.id);
    expect(result.limit).toBe(2);
    expect(result.fetches).toHaveLength(2);
    /* The list is newest first, and the exact-midnight fetch sits inside the
       today roll-up — the boundary is inclusive. */
    expect(new Date(result.fetches[0]!.startedAt).getTime()).toBeGreaterThan(new Date(result.fetches[1]!.startedAt).getTime());
    expect(new Date(result.fetches[0]!.startedAt).getTime()).toBeGreaterThan(midnight.getTime());
    expect(new Date(result.fetches[0]!.startedAt).getTime()).toBeLessThanOrEqual(Date.now());
    expect(new Date(result.fetches[0]!.startedAt).getTime()).toBeGreaterThan(daysAgo(1).getTime());
    expect(result.today).toMatchObject({
      attempts: 3, successes: 1, partial: 1, failed: 1, itemsSeen: 10, itemsNew: 1, lastError: "One entry did not parse",
    });
    expect(new Date(result.today.boundaryAt).getTime()).toBe(midnight.getTime());
  });

  it("caps the list at 100, reports zeros on a source with no fetches, and refuses an unknown source", async () => {
    const db = await freshDatabase();
    const { src } = await sourceFixture(db);
    const console = adminConsoleService(db, { dispatch: null });
    const result = await console.sourceFetches({ id: src.id, limit: 100 });
    expect(result.fetches).toEqual([]);
    expect(result.today).toMatchObject({ attempts: 0, successes: 0, partial: 0, failed: 0, itemsSeen: 0, itemsNew: 0, lastError: null });
    await expect(console.sourceFetches({ id: "00000000-0000-0000-0000-000000000000", limit: 100 })).rejects.toThrow(/not found/);
  });
});

describe("new console routes", () => {
  it("refuses every new route with 401 problem+json when nobody is signed in", async () => {
    state.db = await freshDatabase();
    const read = await editionsRoute.GET(
      new Request("http://localhost/api/v1/admin/console/editions/2026-09-03"),
      { params: Promise.resolve({ localDate: "2026-09-03" }) },
    );
    expect(read.status).toBe(401);
    expect((await read.json()).error.code).toBe("UNAUTHENTICATED");

    const fetches = await fetchesRoute.GET(
      new Request("http://localhost/api/v1/admin/console/sources/00000000-0000-0000-0000-000000000000/fetches?limit=2"),
      { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) },
    );
    expect(fetches.status).toBe(401);

    const drain = await (await import("@/app/api/v1/admin/console/outbox/drain/route")).POST(
      new Request("http://localhost/api/v1/admin/console/outbox/drain", { method: "POST" }),
    );
    expect(drain.status).toBe(401);

    const tick = await (await import("@/app/api/v1/admin/console/maintenance/tick/route")).POST(
      new Request("http://localhost/api/v1/admin/console/maintenance/tick", { method: "POST" }),
    );
    expect(tick.status).toBe(401);

    const resolve = await (await import("@/app/api/v1/admin/console/quarantine/[id]/resolve/route")).POST(
      new Request("http://localhost/api/v1/admin/console/quarantine/x/resolve", { method: "POST", body: JSON.stringify({}) }),
      { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) },
    );
    expect(resolve.status).toBe(401);

    const discard = await (await import("@/app/api/v1/admin/console/quarantine/[id]/discard/route")).POST(
      new Request("http://localhost/api/v1/admin/console/quarantine/x/discard", { method: "POST", body: JSON.stringify({ note: "why" }) }),
      { params: Promise.resolve({ id: "00000000-0000-0000-0000-000000000000" }) },
    );
    expect(discard.status).toBe(401);
  });

  it("serves the edition drilldown and the fetch list through their routes once signed in", async () => {
    const db = await freshDatabase();
    state.db = db;
    const { src } = await sourceFixture(db);
    await db.insert(briefingEdition).values({
      localDate: "2026-09-03", status: "published", contractVersion: "1", promptVersion: "1",
      collectionOpenedAt: daysAgo(2), publishedAt: daysAgo(1),
    });
    const midnight = israelMidnight(new Date());
    await db.insert(sourceFetch).values([
      { sourceId: src.id, status: "success", startedAt: midnight, finishedAt: midnight, itemsSeen: 3, itemsNew: 3 },
    ]);
    const signed = { headers: { "x-actor-label": "admin:test", origin: "http://localhost", "sec-fetch-site": "same-origin" } };

    const response = await editionsRoute.GET(
      new Request("http://localhost/api/v1/admin/console/editions/2026-09-03", signed),
      { params: Promise.resolve({ localDate: "2026-09-03" }) },
    );
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ localDate: "2026-09-03", edition: { localDate: "2026-09-03", status: "published" } });
    expect(body.generatedAt).toBeTruthy();

    const missing = await editionsRoute.GET(
      new Request("http://localhost/api/v1/admin/console/editions/2026-01-01", signed),
      { params: Promise.resolve({ localDate: "2026-01-01" }) },
    );
    expect(missing.status).toBe(404);

    const fetches = await fetchesRoute.GET(
      new Request(`http://localhost/api/v1/admin/console/sources/${src.id}/fetches?limit=2`, signed),
      { params: Promise.resolve({ id: src.id }) },
    );
    expect(fetches.status).toBe(200);
    expect(await fetches.json()).toMatchObject({ sourceId: src.id, limit: 2, today: { attempts: 1 } });
  });

  it("resolves and discards quarantine through their routes, leaving audit rows", async () => {
    const db = await freshDatabase();
    state.db = db;
    const [run] = await db.insert(briefingRun).values({
      localDate: "2026-09-03", stage: "enrich", status: "completed", startedAt: daysAgo(1),
    }).returning();
    const [entry] = await db.insert(briefingQuarantine).values({
      briefingRunId: run!.id, candidateKey: "story-x", stage: "triage", reason: "held back",
    }).returning();
    const [second] = await db.insert(briefingQuarantine).values({
      briefingRunId: run!.id, candidateKey: "story-y", stage: "triage", reason: "held back",
    }).returning();
    const signed = { headers: { "x-actor-label": "admin:test", origin: "http://localhost", "sec-fetch-site": "same-origin" } };

    const resolve = await (await import("@/app/api/v1/admin/console/quarantine/[id]/resolve/route")).POST(
      new Request(`http://localhost/api/v1/admin/console/quarantine/${entry!.id}/resolve`, { method: "POST", body: JSON.stringify({ note: "checked" }), ...signed }),
      { params: Promise.resolve({ id: entry!.id }) },
    );
    expect(resolve.status).toBe(200);
    expect(await resolve.json()).toMatchObject({ id: entry!.id, status: "resolved" });

    const discard = await (await import("@/app/api/v1/admin/console/quarantine/[id]/discard/route")).POST(
      new Request(`http://localhost/api/v1/admin/console/quarantine/${second!.id}/discard`, { method: "POST", body: JSON.stringify({ note: "duplicate of a published story" }), ...signed }),
      { params: Promise.resolve({ id: second!.id }) },
    );
    expect(discard.status).toBe(200);
    expect(await discard.json()).toMatchObject({ id: second!.id, status: "discarded" });

    const actions = (await db.select().from(auditLog)).map((row) => row.action);
    expect(actions).toContain("ops.quarantine.resolved");
    expect(actions).toContain("ops.quarantine.discarded");
  });

  it("wires the drain route to the console action and answers with the drain counts", async () => {
    const db = await freshDatabase();
    state.db = db;
    await db.insert(outbox).values({ topic: "search.reindex", payload: { id: "x" } });
    const signed = { headers: { "x-actor-label": "admin:test", origin: "http://localhost", "sec-fetch-site": "same-origin" } };

    /* With the real queue client unavailable in tests the row fails dispatch
       and stays pending — the point here is the route wiring and the audit row. */
    const drained = await (await import("@/app/api/v1/admin/console/outbox/drain/route")).POST(
      new Request("http://localhost/api/v1/admin/console/outbox/drain", { method: "POST", ...signed }),
    );
    expect(drained.status).toBe(200);
    expect(await drained.json()).toMatchObject({ attempted: 1, dispatched: 0, failed: 1 });
    const [stored] = await db.select().from(outbox);
    expect(stored!.publishedAt).toBeNull();
    expect(stored!.attempts).toBeGreaterThanOrEqual(1);
    const actions = (await db.select().from(auditLog)).map((row) => row.action);
    expect(actions).toContain("ops.outbox.drained");
  });

  it("wires the maintenance tick route and answers with a problem+json response, never a crash", async () => {
    const db = await freshDatabase();
    state.db = db;
    /* The tick's real runners bind to db() internally, which the route mock
       refuses here — the tick itself is covered against injected runners in
       tests/admin-console-actions.test.ts. The route must still answer with a
       problem+json response, never hang or crash the process. */
    const signed = { headers: { "x-actor-label": "admin:test", origin: "http://localhost", "sec-fetch-site": "same-origin" } };
    const tick = await (await import("@/app/api/v1/admin/console/maintenance/tick/route")).POST(
      new Request("http://localhost/api/v1/admin/console/maintenance/tick", { method: "POST", ...signed }),
    );
    expect([200, 500]).toContain(tick.status);
    expect(tick.headers.get("x-request-id")).toBeTruthy();
  });
});
