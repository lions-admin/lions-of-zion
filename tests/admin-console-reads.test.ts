/**
 * The operations console read model.
 *
 * Every read parses against its contract schema inside the service, so the
 * first group of tests is simply "each read returns on an empty database" —
 * a drifted column or a count that came back as a string would throw there.
 * The rest seed one situation each and check the number the console would
 * show for it: a stuck job, a rising narrative, a cost surface, a keyset page.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import {
  aiRun,
  appUser,
  auditLog,
  briefingAlert,
  briefingControl,
  briefingJob,
  briefingRun,
  capabilityGrant,
  evidence,
  narrative,
  narrativeObservation,
  publicationNarrative,
  source,
  sourceFamily,
  sourceFetch,
} from "@/server/db/schema";
import {
  consoleChatThreadsSchema,
  consoleCostsSchema,
  consoleEditorialSchema,
  consoleIncidentsSchema,
  consoleNarrativesSchema,
  consoleOverviewSchema,
  consolePipelineSchema,
  consolePromptsSchema,
  consoleReportsSchema,
  consoleSecuritySchema,
  consoleSettingsSchema,
  consoleSourcesSchema,
  consoleSystemInternalsSchema,
  consoleUsersSchema,
  listAuditSchema,
  listChatThreadsQuerySchema,
  listConsoleReportsSchema,
} from "@/server/contracts/admin-console";

/* `actor.ts` (imported for `ADMIN_CAPABILITIES`) reaches Neon Auth at module
   scope, which wants `next/headers`. Nothing here touches a session. */
vi.mock("@/server/core/auth/neon", () => ({
  neonAuth: () => ({ getSession: async () => ({ data: null }) }),
}));

const { adminConsoleService, ARTICLE_SECTIONS, classifyTrend, costSurfaceFor, nextCronTick, SCHEDULES } =
  await import("@/server/modules/admin-console/service");
const { ADMIN_CAPABILITIES } = await import("@/server/core/auth/actor");
const { publicationService } = await import("@/server/modules/publications/service");

const daysAgo = (days: number) => new Date(Date.now() - days * 24 * 60 * 60 * 1_000);
const actor = { label: "admin:test", userId: null };

async function sourceFixture(db: TestDatabase) {
  const [family] = await db.insert(sourceFamily).values({ slug: "console-feed", label: "Console Feed" }).returning();
  const [src] = await db.insert(source).values({
    sourceFamilyId: family!.id,
    kind: "rss",
    slug: "console-feed",
    logicalKey: "rss:url:https://example.org/console.xml",
    name: "Console Feed",
    feedUrl: "https://example.org/console.xml",
    language: "en",
    config: { verificationState: "verified" },
  }).returning();
  return { family: family!, src: src! };
}

describe("console configuration pins", () => {
  it("keeps SCHEDULES identical to the crons in vercel.json", () => {
    const vercel = JSON.parse(readFileSync(path.join(process.cwd(), "vercel.json"), "utf8")) as {
      crons: Array<{ path: string; schedule: string }>;
    };
    expect(SCHEDULES.map(({ path: p, schedule }) => ({ path: p, schedule }))).toEqual(vercel.crons);
  });

  it("keeps ARTICLE_SECTIONS identical to the briefing service's private list", () => {
    const text = readFileSync(path.join(process.cwd(), "server", "modules", "briefing", "service.ts"), "utf8");
    const match = /const ARTICLE_SECTIONS = \[([^\]]+)\] as const;/.exec(text);
    expect(match).not.toBeNull();
    const pinned = match![1]!.split(",").map((part) => part.trim().replace(/^"|"$/g, "")).filter(Boolean);
    expect([...ARTICLE_SECTIONS]).toEqual(pinned);
  });

  it("computes the next tick for every fixed cron form in use", () => {
    const from = new Date("2026-09-04T10:07:00.000Z");
    expect(nextCronTick("0,30 * * * *", from)?.toISOString()).toBe("2026-09-04T10:30:00.000Z");
    expect(nextCronTick("10,40 * * * *", from)?.toISOString()).toBe("2026-09-04T10:10:00.000Z");
    expect(nextCronTick("*/15 * * * *", from)?.toISOString()).toBe("2026-09-04T10:15:00.000Z");
    expect(nextCronTick("20 3 * * *", from)?.toISOString()).toBe("2026-09-05T03:20:00.000Z");
    expect(nextCronTick("0,30 * * * *", new Date("2026-09-04T10:30:00.000Z"))?.toISOString()).toBe("2026-09-04T11:00:00.000Z");
    expect(nextCronTick("0 0 1 * *", from)).toBeNull();
    for (const entry of SCHEDULES) expect(nextCronTick(entry.schedule, from)).not.toBeNull();
  });
});

describe("console reads on an empty database", () => {
  it("returns every screen, each parsing against its contract", async () => {
    const db = await freshDatabase();
    const console = adminConsoleService(db, { dispatch: null });
    expect(consoleOverviewSchema.safeParse(await console.overview()).success).toBe(true);
    expect(consolePipelineSchema.safeParse(await console.pipeline()).success).toBe(true);
    expect(consoleSourcesSchema.safeParse(await console.sources()).success).toBe(true);
    expect(consoleEditorialSchema.safeParse(await console.editorial()).success).toBe(true);
    expect(consoleNarrativesSchema.safeParse(await console.narratives()).success).toBe(true);
    expect(consoleUsersSchema.safeParse(await console.users()).success).toBe(true);
    expect(consoleCostsSchema.safeParse(await console.costs()).success).toBe(true);
    expect(consoleSecuritySchema.safeParse(await console.security()).success).toBe(true);
    expect(consoleIncidentsSchema.safeParse(await console.incidents()).success).toBe(true);
    expect(consoleSettingsSchema.safeParse(await console.settings()).success).toBe(true);
    /* The final wave's reads, on the same empty database. */
    expect(consoleSystemInternalsSchema.safeParse(await console.systemInternals()).success).toBe(true);
    expect(consolePromptsSchema.safeParse(await console.prompts()).success).toBe(true);
    expect(consoleReportsSchema.safeParse(await console.reports(listConsoleReportsSchema.parse({})))).toMatchObject({ success: true });
    expect(consoleChatThreadsSchema.safeParse(await console.chatThreads(listChatThreadsQuerySchema.parse({})))).toMatchObject({ success: true });
    const audit = await console.audit(listAuditSchema.parse({}));
    expect(audit).toEqual({ entries: [], nextBefore: null });

    const pipeline = await console.pipeline();
    expect(pipeline.stages.map((stage) => stage.stage)).toEqual(["collect", "enrich", "cluster", "triage", "draft", "quality", "publish"]);
    const overview = await console.overview();
    expect(overview.automaticPublicationPaused).toBe(true);
    expect(overview.nextRun.schedule).toBe("0,30 * * * *");
    expect(overview.nextRun.at).not.toBeNull();
    const settings = await console.settings();
    expect(settings.editable).toBe(false);
    expect(settings.searchGroups.map((group) => group.group).sort()).toEqual(["daily_brief", "israel_update", "narrative_watch"]);
    const security = await console.security();
    expect(security.secrets.every((secret) => typeof secret.configured === "boolean")).toBe(true);
    expect(JSON.stringify(security)).not.toMatch(/postgres:\/\//);
  });
});

describe("console region wiring (source)", () => {
  /* The three regions this console added are pinned the way the shell pins
     its structure: structurally over the sources, because the panels render
     skeletons until their effects run. What is pinned here is which payload
     each region surfaces, not which words it labels it with. */

  it("surfaces the costs meters, the status read's integrations and fingerprints, and the outbox backlog on the overview", () => {
    const overview = readFileSync(path.join(process.cwd(), "app/admin/OverviewPanel.tsx"), "utf8");
    /* The budget region reads the costs payload piece by piece — the four
       utilisations, and the search budget it can genuinely be null. */
    for (const piece of [
      "utilisation.aiDaily", "utilisation.aiMonthly", "utilisation.briefingMonthly", "utilisation.searchMonthly",
      "budgets.search.monthlyQueries === null",
    ]) {
      expect(overview, piece).toContain(piece);
    }
    /* Integration readiness and the resource fingerprints come from the
       already-polled status read — nothing new is fetched for them. */
    expect(overview).toContain("status.value.integrations");
    expect(overview).toContain("status.value.resourceFingerprints");
    /* The outbox backlog is the incidents read's `outbox` object. */
    for (const piece of ["outbox.undelivered", "outbox.deadLettered", "outbox.oldestAt"]) {
      expect(overview, piece).toContain(piece);
    }
  });

  it("renders the draft preview from the artifact's daily brief and per-section articles", () => {
    const pipeline = readFileSync(path.join(process.cwd(), "app/admin/PipelinePanel.tsx"), "utf8");
    expect(pipeline).toContain("draft.value.dailyBrief");
    expect(pipeline).toContain("draft.value.articles");
    expect(pipeline).toContain("SECTION_LABEL[article.section]");
    /* Degradation rides the shared absence line, with the two-cause 404
       note under it. */
    expect(pipeline).toContain("<InlineAbsence state={draft.state} what={T.draftWhat} reload={draft.reload} />");
    expect(pipeline).toContain("ABSENCE.draftEditionAbsent");
  });

  it("wires the P1 wave's regions to the contract payloads they surface", () => {
    const pipeline = readFileSync(path.join(process.cwd(), "app/admin/PipelinePanel.tsx"), "utf8");
    const sources = readFileSync(path.join(process.cwd(), "app/admin/SourcesPanel.tsx"), "utf8");
    const system = readFileSync(path.join(process.cwd(), "app/admin/SystemPanel.tsx"), "utf8");

    /* The edition drilldown drawer: the edition's identity, the per-stage
       runs, the model calls, the artifacts, the claims and the jobs. */
    for (const piece of ["drill.value.edition.", "drill.value.runs.map", "drill.value.runAi.map", "drill.value.artifacts.map", "drill.value.claims.map", "drill.value.jobs.length"]) {
      expect(pipeline, piece).toContain(piece);
    }

    /* The fetch log drawer: the per-attempt rows and the same day's rollup
       from the one read. */
    for (const piece of ["fetches.value.fetches.map", "fetches.value.today.attempts", "fetches.value.today.boundaryAt"]) {
      expect(sources, piece).toContain(piece);
    }

    /* The incidents area's recovery controls: the outbox block drains, the
       maintenance block ticks, and the quarantine rows carry both decisions. */
    for (const piece of [
      '"admin/console/outbox/drain"',
      '"admin/console/maintenance/tick"',
      "`admin/console/quarantine/${entry.id}/resolve`",
      "`admin/console/quarantine/${entry.id}/discard`",
      "value.outbox.undelivered",
      "value.outbox.deadLettered",
      "value.outbox.oldestAt",
    ]) {
      expect(system, piece).toContain(piece);
    }

    /* The sources area's sweep surfaces the result counts, whatever the
        status word around them. */
    for (const piece of ["result.enqueued", "result.alreadyCompleted", "result.dispatchFailed"]) {
      expect(sources, piece).toContain(piece);
    }
  });

  it("wires the final wave's regions to the contract payloads they surface", () => {
    const sources = readFileSync(path.join(process.cwd(), "app/admin/SourcesPanel.tsx"), "utf8");
    const system = readFileSync(path.join(process.cwd(), "app/admin/SystemPanel.tsx"), "utf8");
    const reports = readFileSync(path.join(process.cwd(), "app/admin/ReportsSection.tsx"), "utf8");
    const threads = readFileSync(path.join(process.cwd(), "app/admin/ChatThreadsSection.tsx"), "utf8");
    const prompts = readFileSync(path.join(process.cwd(), "app/admin/PromptsSection.tsx"), "utf8");
    const lineage = readFileSync(path.join(process.cwd(), "app/admin/LineageSection.tsx"), "utf8");

    /* The reports desk: the keyset page with status + trail, triaged through
        the staff route that already exists. */
    for (const piece of ["admin/console/reports", "page.reports", "page.nextCursor", "latestTrail", "trailCount", "reports/${report.id}/triage"]) {
      expect(reports, piece).toContain(piece);
    }

    /* Chat moderation: the keyset list, the held transcript with its tool
        runs and model figures, and the archive POST. */
    for (const piece of ["admin/console/chat/threads", "page.threads", "page.nextCursor", "transcript.messages", "entry.toolRuns", "entry.run", "threads/${thread.id}/archive"]) {
      expect(threads, piece).toContain(piece);
    }

    /* The prompt registry: the list, the append-only insert, and the
        activate route behind the shared confirmation. */
    for (const piece of ["admin/console/ai/prompts", "prompt.activeVersion", "prompt.versions", "version.template", "slug: prompt.slug, version: version.version"]) {
      expect(prompts, piece).toContain(piece);
    }

    /* The lineage lookups: the entity-versions pair and the evidence
        provenance read, each held until submitted. */
    for (const piece of ["admin/console/entities/${entityType}/${id}/versions", "admin/console/evidence/${id}/provenance", "version.snapshot", "entry.detail"]) {
      expect(lineage, piece).toContain(piece);
    }

    /* System internals ride the environment sub-area; Agent Search's
        recorded spend surfaces in both places the estimate lives. */
    expect(system).toContain("admin/console/system-internals");
    for (const file of [sources, system]) {
      expect(file).toContain("actualSpendUsd");
    }
  });
});

describe("pipeline health", () => {
  it("counts a running job with a lapsed lease as stuck everywhere it is shown", async () => {
    const db = await freshDatabase();
    const { src } = await sourceFixture(db);
    /* The singleton row is seeded by the migrations, so this is an update,
       not an insert — a plain insert violates `briefing_control_pkey`. */
    await db.insert(briefingControl).values({ id: "global", automaticPublicationPaused: false })
      .onConflictDoUpdate({ target: briefingControl.id, set: { automaticPublicationPaused: false } });
    await db.insert(briefingJob).values([
      { jobKey: "collect:stuck", stage: "collect", localDate: "2026-09-04", sourceId: src.id, state: "running", attempts: 1, leaseUntil: daysAgo(0.01), startedAt: daysAgo(0.02) },
      { jobKey: "collect:live", stage: "collect", localDate: "2026-09-04", sourceId: src.id, state: "running", attempts: 1, leaseUntil: new Date(Date.now() + 5 * 60_000), startedAt: new Date() },
      { jobKey: "enrich:exhausting", stage: "enrich", localDate: "2026-09-04", state: "pending", attempts: 4, maxAttempts: 5, lastError: "provider timeout" },
      { jobKey: "enrich:fine", stage: "enrich", localDate: "2026-09-03", state: "completed", attempts: 1, startedAt: daysAgo(0.1), finishedAt: daysAgo(0.09) },
    ]);
    const console = adminConsoleService(db, { dispatch: null });

    const overview = await console.overview();
    expect(overview.stuckJobs).toBe(1);
    expect(overview.systemActive).toBe(false);
    expect(overview.inactiveReasons.some((reason) => /stuck/.test(reason))).toBe(true);
    expect(overview.counts24h.processed).toBe(1);
    expect(overview.counts24h.failedJobs).toBe(1);

    const pipeline = await console.pipeline();
    const collect = pipeline.stages.find((stage) => stage.stage === "collect")!;
    expect(collect).toMatchObject({ running: 2, stuck: 1 });
    const enrich = pipeline.stages.find((stage) => stage.stage === "enrich")!;
    expect(enrich).toMatchObject({ pending: 1, completed24h: 1, lastError: "provider timeout" });
    expect(enrich.averageDurationMs).toBeGreaterThan(0);
    expect(pipeline.attention.map((job) => job.jobKey).sort()).toEqual(["collect:stuck", "enrich:exhausting"]);
    expect(pipeline.attention.find((job) => job.jobKey === "collect:stuck")?.sourceName).toBe("Console Feed");
    expect(pipeline.recentJobs).toHaveLength(4);

    const incidents = await console.incidents();
    expect(incidents.stuckJobs.map((job) => job.jobKey)).toEqual(["collect:stuck"]);
  });

  it("reports open critical alerts, the last run, and the quarantined count", async () => {
    const db = await freshDatabase();
    await db.insert(briefingAlert).values([
      { fingerprint: "a", kind: "budget", severity: "critical", message: "Budget exhausted" },
      { fingerprint: "b", kind: "source", severity: "warning", message: "Feed failing" },
      { fingerprint: "c", kind: "source", severity: "critical", message: "Old", resolvedAt: daysAgo(1) },
    ]);
    await db.insert(briefingRun).values({ localDate: "2026-09-03", stage: "publish", status: "failed", errorMessage: "boom", startedAt: daysAgo(1) });
    await db.insert(briefingJob).values({ jobKey: "draft:q", stage: "draft", localDate: "2026-09-03", state: "quarantined", attempts: 5, lastError: "exhausted", finishedAt: daysAgo(1) });
    const console = adminConsoleService(db, { dispatch: null });

    const overview = await console.overview();
    expect(overview.openAlerts).toEqual({ critical: 1, warning: 1 });
    expect(overview.quarantined).toBe(1);
    expect(overview.lastRun).toMatchObject({ localDate: "2026-09-03", stage: "publish", status: "failed" });
    expect(overview.inactiveReasons.some((reason) => /critical alert/.test(reason))).toBe(true);

    const incidents = await console.incidents();
    expect(incidents.openAlerts.map((alert) => alert.fingerprint ?? alert.kind)).toHaveLength(2);
    expect(incidents.recentlyResolved).toHaveLength(1);
    expect(incidents.failedRuns).toHaveLength(1);
    expect(incidents.quarantinedJobs.map((job) => job.jobKey)).toEqual(["draft:q"]);
    expect(incidents.outbox.deadLettered).toBe(0);
  });
});

describe("sources", () => {
  it("rolls a week of fetches into the source row and counts duplicates from discovery", async () => {
    const db = await freshDatabase();
    const { src, family } = await sourceFixture(db);
    await db.insert(sourceFetch).values([
      { sourceId: src.id, status: "success", startedAt: daysAgo(1), finishedAt: daysAgo(1), itemsSeen: 10, itemsNew: 6 },
      { sourceId: src.id, status: "failed", startedAt: daysAgo(2), finishedAt: daysAgo(2), errorMessage: "HTTP 503" },
      { sourceId: src.id, status: "success", startedAt: daysAgo(20), finishedAt: daysAgo(20), itemsSeen: 50, itemsNew: 50 },
    ]);
    const console = adminConsoleService(db, { dispatch: null });
    const result = await console.sources();
    const row = result.sources.find((entry) => entry.id === src.id)!;
    expect(row.family).toEqual({ id: family.id, slug: family.slug, label: family.label });
    expect(row.verificationState).toBe("verified");
    expect(row.week).toEqual({ attempts: 2, successes: 1, itemsSeen: 10, itemsNew: 6, duplicates: 0 });
    expect(row.lastError).toBe("HTTP 503");
    expect(row.primarySourceId).toBeNull();
    expect(result.totals).toEqual({ active: 1, disabled: 0, failing: 0 });
    expect(result.families).toEqual([{ id: family.id, slug: family.slug, label: family.label, sourceCount: 1 }]);
  });
});

describe("editorial desk", () => {
  it("lanes publications by status and counts their evidence", async () => {
    const db = await freshDatabase();
    const svc = publicationService(db);
    const draft = await svc.create({ kind: "news_update", section: "israel_update", title: "Draft one", body: "Body", language: "en" }, actor);
    const review = await svc.create({ kind: "news_update", section: "israel_update", title: "In review", body: "Body", language: "en" }, actor);
    await svc.transition(review.id, { to: "under_review" }, actor);
    const console = adminConsoleService(db, { dispatch: null });
    const desk = await console.editorial();
    expect(desk.counts).toMatchObject({ draft: 1, under_review: 1, approved: 0, published: 0 });
    expect(desk.lanes.drafts.map((card) => card.id)).toEqual([draft.id]);
    expect(desk.lanes.inReview.map((card) => card.id)).toEqual([review.id]);
    expect(desk.lanes.drafts[0]).toMatchObject({ evidenceCount: 0, homepageSlot: null, publicId: draft.publicId });
    expect(desk.homepageFeatures).toEqual([]);
  });
});

describe("narratives", () => {
  it("classifies trends from this week against last", () => {
    const now = new Date("2026-09-04T12:00:00.000Z");
    expect(classifyTrend({ firstSeenAt: daysAgo(2), observations7d: 1, observationsPrior7d: 0, now })).toBe("new");
    expect(classifyTrend({ firstSeenAt: daysAgo(30), observations7d: 5, observationsPrior7d: 3, now })).toBe("rising");
    expect(classifyTrend({ firstSeenAt: daysAgo(30), observations7d: 1, observationsPrior7d: 3, now })).toBe("declining");
    expect(classifyTrend({ firstSeenAt: daysAgo(30), observations7d: 3, observationsPrior7d: 3, now })).toBe("stable");
    expect(classifyTrend({ firstSeenAt: daysAgo(30), observations7d: 0, observationsPrior7d: 0, now })).toBe("stable");
    expect(classifyTrend({ firstSeenAt: null, observations7d: 2, observationsPrior7d: 0, now })).toBe("rising");
  });

  it("reads observations, links publications through publication_narrative, and sums cited evidence", async () => {
    const db = await freshDatabase();
    const { src } = await sourceFixture(db);
    const [proof] = await db.insert(evidence).values({
      sourceId: src.id, kind: "article", title: "Proof", language: "en", canonicalUrl: "https://example.org/proof",
    }).returning();
    const [rising] = await db.insert(narrative).values({ publicId: "n-rising", title: "Rising claim", language: "en" }).returning();
    const [fresh] = await db.insert(narrative).values({ publicId: "n-new", title: "Brand new claim", language: "en" }).returning();
    await db.insert(narrativeObservation).values([
      { narrativeId: rising!.id, evidenceId: proof!.id, observedAt: daysAgo(10) },
      { narrativeId: rising!.id, evidenceId: proof!.id, observedAt: daysAgo(2) },
      { narrativeId: rising!.id, evidenceId: proof!.id, observedAt: daysAgo(1) },
      { narrativeId: fresh!.id, evidenceId: proof!.id, observedAt: daysAgo(1) },
    ]);
    const svc = publicationService(db);
    const watch = await svc.create({
      kind: "news_update", section: "narrative_watch", title: "Reported claim: Rising claim", body: "Body", language: "en",
      narrativeIds: [rising!.id],
      narrativeWatchDetails: {
        exactClaim: "The claim", propagators: [], arenas: ["X"], trendDirection: "rising",
        israeliPosition: null, securityContext: null,
        supportingEvidenceIds: [proof!.id], contradictingEvidenceIds: [], verificationState: "disputed", knownUnknowns: [],
        evidenceBasis: "sourced",
      },
    }, actor);
    expect(await db.select().from(publicationNarrative)).toHaveLength(1);

    const console = adminConsoleService(db, { dispatch: null });
    const result = await console.narratives();
    const risingRow = result.narratives.find((row) => row.id === rising!.id)!;
    expect(risingRow).toMatchObject({ trend: "rising", observations7d: 2, observationsPrior7d: 1 });
    expect(risingRow.evidence).toEqual({ supporting: 1, contradicting: 0, verificationState: "disputed" });
    expect(risingRow.linkedPublications.map((row) => row.id)).toEqual([watch.id]);
    const freshRow = result.narratives.find((row) => row.id === fresh!.id)!;
    expect(freshRow.trend).toBe("new");
    expect(freshRow.linkedPublications).toEqual([]);
    expect(result.counts).toEqual({ new: 1, rising: 1, declining: 0 });
  });
});

describe("users and audit", () => {
  it("marks the holder of every admin capability as admin and keeps public readers out of staff", async () => {
    const db = await freshDatabase();
    const [admin] = await db.insert(appUser).values({ externalId: "admin", email: "admin@example.test", displayName: "Admin" }).returning();
    const [reader] = await db.insert(appUser).values({ externalId: "reader", email: "reader@example.test", displayName: "Reader" }).returning();
    await db.insert(capabilityGrant).values(ADMIN_CAPABILITIES.map((capability) => ({ userId: admin!.id, capability, rationale: "test" })));
    await db.insert(auditLog).values({ actorUserId: admin!.id, actorLabel: "Admin", action: "publication.updated", entityType: "news_update" });
    const console = adminConsoleService(db, { dispatch: null });
    const users = await console.users();
    expect(users.registeredPublicUsers).toBe(2);
    expect(users.staff.map((user) => user.id)).toEqual([admin!.id]);
    expect(users.staff[0]).toMatchObject({ isAdmin: true, email: "admin@example.test" });
    expect(users.staff[0]!.capabilities).toHaveLength(ADMIN_CAPABILITIES.length);
    expect(users.staff[0]!.lastActionAt).not.toBeNull();
    expect(users.recentAdminActions).toHaveLength(1);
    expect(users.blockedSignInAttempts).toBeNull();
    expect(reader!.id).toBeTruthy();
  });

  it("pages the audit log by id descending and filters by action prefix", async () => {
    const db = await freshDatabase();
    for (let i = 0; i < 5; i++) {
      await db.insert(auditLog).values({
        actorLabel: "Admin", action: i % 2 === 0 ? "ops.job.retried" : "auth.signin", entityType: "event",
        beforeState: i === 0 ? { state: "x" } : null,
      });
    }
    const console = adminConsoleService(db, { dispatch: null });
    const first = await console.audit(listAuditSchema.parse({ limit: "2" }));
    expect(first.entries).toHaveLength(2);
    expect(first.nextBefore).toBe(first.entries[1]!.id);
    expect(BigInt(first.entries[0]!.id) > BigInt(first.entries[1]!.id)).toBe(true);
    const second = await console.audit(listAuditSchema.parse({ limit: "2", before: first.nextBefore! }));
    expect(second.entries).toHaveLength(2);
    expect(BigInt(second.entries[0]!.id) < BigInt(first.entries[1]!.id)).toBe(true);
    const third = await console.audit(listAuditSchema.parse({ limit: "2", before: second.nextBefore! }));
    expect(third.entries).toHaveLength(1);
    expect(third.nextBefore).toBeNull();
    expect(third.entries[0]!.hasBefore).toBe(true);
    expect("beforeState" in third.entries[0]!).toBe(false);

    const ops = await console.audit(listAuditSchema.parse({ action: "ops." }));
    expect(ops.entries.every((entry) => entry.action.startsWith("ops."))).toBe(true);
    expect(ops.entries).toHaveLength(3);

    const detail = await console.auditEntry(third.entries[0]!.id);
    expect(detail.beforeState).toEqual({ state: "x" });
    await expect(console.auditEntry("999999")).rejects.toThrow(/not found/);

    const security = await console.security();
    expect(security.recentSecurityEvents).toHaveLength(5);
  });
});

describe("costs", () => {
  it("maps profiles to surfaces", () => {
    expect(costSurfaceFor("briefing_triage", "classify")).toBe("briefing");
    expect(costSurfaceFor("briefingDraft", "summarize")).toBe("briefing");
    expect(costSurfaceFor("chat", "chat")).toBe("chat");
    expect(costSurfaceFor("fast", "chat")).toBe("chat");
    expect(costSurfaceFor("opsConsole", "chat")).toBe("ops_console");
    expect(costSurfaceFor("embedding", "embed")).toBe("embedding");
    expect(costSurfaceFor("translation", "translate")).toBe("other");
  });

  it("sums spend by surface, model, kind, day and month", async () => {
    const db = await freshDatabase();
    await db.insert(aiRun).values([
      { kind: "classify", model: "openai/gpt-5-nano", modelProfile: "briefing_triage", status: "ok", actorLabel: "service", costUsd: "0.10" },
      { kind: "summarize", model: "openai/gpt-5-mini", modelProfile: "briefing_draft", status: "ok", actorLabel: "service", costUsd: "0.25" },
      { kind: "chat", model: "xai/grok-4.3", modelProfile: "fast", status: "ok", actorLabel: "anon", costUsd: "0.02" },
      { kind: "embed", model: "openai/text-embedding-3-small", modelProfile: "embedding", status: "ok", actorLabel: "service", costUsd: "0.001" },
      { kind: "chat", model: "anthropic/claude-sonnet-5", modelProfile: "opsConsole", status: "ok", actorLabel: "admin", costUsd: "0.05" },
    ]);
    const console = adminConsoleService(db, { dispatch: null });
    const costs = await console.costs();
    const surface = Object.fromEntries(costs.bySurface.map((row) => [row.surface, row]));
    expect(surface.briefing).toMatchObject({ calls: 2 });
    expect(surface.briefing!.costUsd).toBeCloseTo(0.35, 6);
    expect(surface.chat).toMatchObject({ calls: 1 });
    expect(surface.ops_console).toMatchObject({ calls: 1 });
    expect(surface.embedding).toMatchObject({ calls: 1 });
    expect(costs.spend.last24HoursUsd).toBeCloseTo(0.421, 6);
    expect(costs.spend.today).toBeCloseTo(0.421, 6);
    expect(costs.byModel[0]!.model).toBe("openai/gpt-5-mini");
    expect(costs.byKind.find((row) => row.kind === "chat")?.calls).toBe(2);
    expect(costs.byDay).toHaveLength(1);
    expect(costs.byMonth).toHaveLength(1);
    expect(costs.warnAt).toBe(0.8);
    expect(costs.budgets.briefing.monthlyUsd).toBeGreaterThan(0);
    expect(costs.utilisation.briefingMonthly).toBeCloseTo(0.35 / costs.budgets.briefing.monthlyUsd!, 6);
  });
});
