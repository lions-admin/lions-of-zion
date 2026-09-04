/**
 * The console's briefing quality-check matrix.
 *
 * The rows are written by `briefingRepo.recordQualityChecks`, one per
 * (run, candidate, check). No surface read them before this read did; the
 * tests here seed the same shape the briefing pipeline writes and assert what
 * the console would show for it — filtering, the exact-one filter refine,
 * defensive truncation of a long detail, the route guard, and the read tool
 * the operations agent calls (pinned in `ops-agent.test.ts`).
 */
import { describe, expect, it, vi } from "vitest";
import { freshDatabase } from "@/server/db/testing";
import { briefingQualityCheck, briefingRun } from "@/server/db/schema";
import { consoleQualityChecksSchema, listQualityChecksSchema } from "@/server/contracts/admin-console";
import { REQUIRED_QUALITY_CHECKS } from "@/server/modules/briefing/quality";

/* `actor.ts` (imported for `ADMIN_CAPABILITIES` through the service) reaches
   Neon Auth at module scope, which wants `next/headers`. Nothing here touches
   a session. */
vi.mock("@/server/core/auth/neon", () => ({
  neonAuth: () => ({ getSession: async () => ({ data: null }) }),
}));

const mocks = vi.hoisted(() => ({
  requireActor: vi.fn(),
  qualityChecks: vi.fn(async () => ({ candidates: [], required: [], filter: { runId: null, localDate: null }, generatedAt: "x" })),
}));

vi.mock("@/server/http/handler", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/http/handler")>()),
  handler: (fn: unknown) => fn,
}));
vi.mock("@/server/core/auth/actor", () => ({
  requireActor: mocks.requireActor,
  ADMIN_CAPABILITIES: ["assessment.approve", "assessment.publish", "approval.grant", "evidence.restricted.read", "policy.manage"],
}));
vi.mock("@/server/modules/admin-console", () => ({ adminConsole: () => ({ qualityChecks: mocks.qualityChecks }) }));

const { adminConsoleService } = await import("@/server/modules/admin-console/service");
const { GET } = await import("@/app/api/v1/admin/console/quality-checks/route");

const longDetail = "א".repeat(600);

/** Two runs on two Israel-local dates. Run A holds two candidates — one clean
 *  pass, one carrying a single failed check with a detail too long to echo.
 *  Run B holds one candidate, so the localDate filter can be told apart from
 *  the runId one. */
async function fixture() {
  const db = await freshDatabase();
  const [runA] = await db.insert(briefingRun).values({
    localDate: "2026-09-03", stage: "quality", status: "completed",
    startedAt: new Date("2026-09-03T07:00:00.000Z"), finishedAt: new Date("2026-09-03T07:01:00.000Z"),
  }).returning();
  const [runB] = await db.insert(briefingRun).values({
    localDate: "2026-09-04", stage: "publish", status: "failed", errorMessage: "boom",
    startedAt: new Date("2026-09-04T07:00:00.000Z"),
  }).returning();
  await db.insert(briefingQualityCheck).values([
    ...REQUIRED_QUALITY_CHECKS.map((checkName) => ({
      briefingRunId: runA!.id, candidateKey: "daily-brief", checkName, status: "pass", detail: "clean",
    })),
    ...REQUIRED_QUALITY_CHECKS.filter((name) => name !== "specific_title").map((checkName) => ({
      briefingRunId: runA!.id, candidateKey: "watch-1", checkName, status: "pass", detail: "clean",
    })),
    { briefingRunId: runA!.id, candidateKey: "watch-1", checkName: "specific_title", status: "fail", detail: longDetail },
    ...REQUIRED_QUALITY_CHECKS.map((checkName) => ({
      briefingRunId: runB!.id, candidateKey: "watch-1", checkName, status: "pass", detail: "clean",
    })),
  ]);
  return { db, runA: runA!, runB: runB! };
}

describe("quality checks read", () => {
  it("filters by runId and orders candidates then checks in the required order", async () => {
    const { db, runA } = await fixture();
    const console = adminConsoleService(db, { dispatch: null });
    const input = listQualityChecksSchema.parse({ runId: runA.id });
    const result = await console.qualityChecks(input);

    expect(consoleQualityChecksSchema.safeParse(result).success).toBe(true);
    expect(result.filter).toEqual({ runId: runA.id, localDate: null });
    expect(result.required).toEqual([...REQUIRED_QUALITY_CHECKS]);

    const clean = result.candidates.find((candidate) => candidate.candidateKey === "daily-brief")!;
    expect(clean.runId).toBe(runA.id);
    expect(clean.stage).toBe("quality");
    expect(clean.localDate).toBe("2026-09-03");
    expect(clean).toMatchObject({ passCount: REQUIRED_QUALITY_CHECKS.length, failCount: 0, total: REQUIRED_QUALITY_CHECKS.length, passed: true });
    expect(clean.checks.map((check) => check.checkName)).toEqual([...REQUIRED_QUALITY_CHECKS]);
    expect(clean.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("filters by Israel-local date across runs and keeps the check order within the matrix", async () => {
    const { db, runB } = await fixture();
    const console = adminConsoleService(db, { dispatch: null });
    const result = await console.qualityChecks(listQualityChecksSchema.parse({ localDate: "2026-09-04" }));

    expect(result.filter).toEqual({ runId: null, localDate: "2026-09-04" });
    expect(result.candidates.map((candidate) => [candidate.runId, candidate.candidateKey])).toEqual([[runB.id, "watch-1"]]);

    const failed = await console.qualityChecks(listQualityChecksSchema.parse({ localDate: "2026-09-03" }));
    const watch = failed.candidates.find((candidate) => candidate.candidateKey === "watch-1")!;
    expect(watch).toMatchObject({ failCount: 1, passed: false });
    expect(watch.checks.find((check) => check.checkName === "specific_title")).toMatchObject({
      checkName: "specific_title", status: "fail",
    });
  });

  it("refuses a filter that is not exactly one of runId and localDate", () => {
    expect(listQualityChecksSchema.safeParse({}).success).toBe(false);
    expect(listQualityChecksSchema.safeParse({ localDate: "2026-09-04" }).success).toBe(true);
    expect(listQualityChecksSchema.safeParse({ runId: crypto.randomUUID() }).success).toBe(true);
    expect(listQualityChecksSchema.safeParse({
      runId: crypto.randomUUID(), localDate: "2026-09-04",
    }).success).toBe(false);
  });

  it("truncates a long detail defensively to at most 500 characters", async () => {
    const { db, runA } = await fixture();
    const console = adminConsoleService(db, { dispatch: null });
    const result = await console.qualityChecks(listQualityChecksSchema.parse({ runId: runA.id }));
    const watch = result.candidates.find((candidate) => candidate.candidateKey === "watch-1")!;
    const failed = watch.checks.find((check) => check.checkName === "specific_title")!;
    expect(failed.status).toBe("fail");
    expect(failed.detail).not.toBeNull();
    expect(failed.detail!.length).toBeLessThanOrEqual(500);
    expect(failed.detail!.endsWith("…")).toBe(true);
    expect(failed.detail!.startsWith("א")).toBe(true);
  });

  it("reads on an empty database", async () => {
    const console = adminConsoleService(await freshDatabase(), { dispatch: null });
    const result = await console.qualityChecks(listQualityChecksSchema.parse({ localDate: "2026-09-04" }));
    expect(consoleQualityChecksSchema.safeParse(result).success).toBe(true);
    expect(result.candidates).toEqual([]);
    expect(result.required).toEqual([...REQUIRED_QUALITY_CHECKS]);
  });
});

describe("the quality-checks route", () => {
  it("refuses an unauthenticated read before the console is consulted", async () => {
    mocks.requireActor.mockImplementationOnce(() => { throw new Error("unauthenticated"); });
    await expect(
      GET(new Request("https://lionsofzion.io/api/v1/admin/console/quality-checks?localDate=2026-09-04")),
    ).rejects.toThrow("unauthenticated");
    expect(mocks.qualityChecks).not.toHaveBeenCalled();
  });

  it("serves the read from query parameters once the actor is known", async () => {
    mocks.requireActor.mockImplementationOnce(() => undefined);
    const runId = crypto.randomUUID();
    const response = await GET(new Request(`https://lionsofzion.io/api/v1/admin/console/quality-checks?runId=${runId}`));
    expect(response.status).toBe(200);
    expect(mocks.qualityChecks).toHaveBeenCalledWith({ runId, localDate: undefined });
  });
});
