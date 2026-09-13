/**
 * The task-board routes with the module mocked: the reporter guard, the
 * batch contract, and the admin reads behind `requireActor`.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  report: vi.fn(),
  attach: vi.fn(),
  list: vi.fn(),
  detail: vi.fn(),
  patch: vi.fn(),
  registerActor: vi.fn(),
  requireActor: vi.fn(),
  authenticateAdmin: vi.fn(),
}));

vi.mock("@/server/modules/ops-tasks", () => ({
  opsTasks: () => ({ report: mocks.report, attach: mocks.attach, list: mocks.list, detail: mocks.detail, patch: mocks.patch }),
}));
vi.mock("@/server/core/auth/actor", () => ({
  authenticateAdmin: mocks.authenticateAdmin,
  registerActor: mocks.registerActor,
  requireActor: mocks.requireActor,
}));
/* The wrapper rate-limits staff mutations against the database; the routes
   under test are what matters here, so the limiter is a pass-through. */
vi.mock("@/server/core/rate-limit", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/core/rate-limit")>()),
  enforceRateLimit: async () => ({ count: 1 }),
}));
vi.mock("@/server/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db/client")>()),
  db: () => ({}),
  withDatabaseRole: (_role: string, _identity: string, fn: () => Promise<unknown>) => fn(),
}));

import { ApiError } from "@/server/http/responses";
import { POST as report } from "@/app/api/internal/ops/tasks/report/route";
import { POST as attach } from "@/app/api/internal/ops/tasks/attachments/route";
import { GET as list } from "@/app/api/v1/admin/console/tasks/route";
import { GET as detail, PATCH as patch } from "@/app/api/v1/admin/console/tasks/[id]/route";

const secret = "ops-report-test-secret";
const origin = "https://lionsofzion.io";
const reporterActor = { label: "service:ops-reporter", userId: null };

function post(path: string, body: unknown, supplied: string | null = secret): Request {
  const headers: Record<string, string> = { "content-type": "application/json" };
  if (supplied !== null) headers["x-ops-report-secret"] = supplied;
  return new Request(`${origin}${path}`, { method: "POST", headers, body: JSON.stringify(body) });
}

const batch = { reports: [{ taskKey: "claude:abc", agent: "claude", environment: "/ws/claude", event: "start", title: "Route test" }] };

beforeEach(() => {
  process.env.OPS_REPORT_SECRET = secret;
  for (const fn of Object.values(mocks)) fn.mockReset();
  mocks.registerActor.mockImplementation(() => {});
  mocks.requireActor.mockImplementation(() => reporterActor);
  mocks.authenticateAdmin.mockResolvedValue({ label: "human:owner", userId: "u1" });
});
afterEach(() => { delete process.env.OPS_REPORT_SECRET; });

describe("POST /api/internal/ops/tasks/report", () => {
  it("rejects a missing secret before parsing", async () => {
    const response = await report(post("/api/internal/ops/tasks/report", batch, null));
    expect(response.status).toBe(401);
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("rejects a wrong secret", async () => {
    const response = await report(post("/api/internal/ops/tasks/report", batch, "nope"));
    expect(response.status).toBe(401);
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("answers 500, not 200, when the secret is not configured", async () => {
    delete process.env.OPS_REPORT_SECRET;
    const response = await report(post("/api/internal/ops/tasks/report", batch));
    expect(response.status).toBe(500);
    expect(mocks.report).not.toHaveBeenCalled();
  });

  it("registers the fixed reporter actor and accepts a batch with 202", async () => {
    mocks.report.mockResolvedValue({ accepted: 1, taskIds: ["11111111-1111-4111-8111-111111111111"] });
    const response = await report(post("/api/internal/ops/tasks/report", batch));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toEqual({ accepted: 1, taskIds: ["11111111-1111-4111-8111-111111111111"] });
    expect(mocks.registerActor).toHaveBeenCalledWith(expect.any(Request), { label: "service:ops-reporter", userId: null });
    expect(mocks.report).toHaveBeenCalledWith(batch, "service:ops-reporter");
  });

  it("refuses an empty batch, an unknown field and an unknown agent with 422", async () => {
    for (const body of [
      { reports: [] },
      { reports: [{ ...batch.reports[0], extra: true }] },
      { reports: [{ ...batch.reports[0], agent: "copilot" }] },
      { reports: [{ ...batch.reports[0], links: [{ label: "x", url: "ftp://nope" }] }] },
    ]) {
      const response = await report(post("/api/internal/ops/tasks/report", body));
      expect(response.status, JSON.stringify(body)).toBe(422);
    }
    expect(mocks.report).not.toHaveBeenCalled();
  });
});

describe("POST /api/internal/ops/tasks/attachments", () => {
  it("guards, validates and returns the stored attachment with 201", async () => {
    const upload = { taskKey: "claude:abc", kind: "screenshot", contentType: "image/png", dataBase64: "iVBORw0KGgo=" };
    expect((await attach(post("/api/internal/ops/tasks/attachments", upload, "wrong"))).status).toBe(401);
    expect((await attach(post("/api/internal/ops/tasks/attachments", { ...upload, contentType: "image/svg+xml" }))).status).toBe(422);
    mocks.attach.mockResolvedValue({ id: "a1", kind: "screenshot", url: "https://x.public.blob.vercel-storage.com/ops/attachments/t/h.png" });
    const response = await attach(post("/api/internal/ops/tasks/attachments", upload));
    expect(response.status).toBe(201);
    await expect(response.json()).resolves.toMatchObject({ attachment: { id: "a1" } });
    expect(mocks.attach).toHaveBeenCalledWith(upload, "service:ops-reporter");
  });
});

describe("admin console reads", () => {
  /* `/api/v1/` paths authenticate in the wrapper before the route runs, so
     a signed-out read is refused there; the route's own `requireActor` is the
     second lock. Both answer 401. */
  it("requires an actor for the list", async () => {
    mocks.authenticateAdmin.mockRejectedValue(new ApiError("UNAUTHENTICATED", "Please sign in to continue."));
    mocks.requireActor.mockImplementation(() => { throw new ApiError("UNAUTHENTICATED", "Please sign in to continue."); });
    const response = await list(new Request(`${origin}/api/v1/admin/console/tasks`));
    expect(response.status).toBe(401);
    expect(mocks.list).not.toHaveBeenCalled();
  });

  it("parses the query and returns the list", async () => {
    mocks.requireActor.mockImplementation(() => ({ label: "human:owner", userId: "u1" }));
    mocks.list.mockResolvedValue({ summary: { running: 1, blocked: 0, waiting: 0, unreported: 0, completedToday: 0 }, tasks: [], nextBefore: null, coverage: [] });
    const response = await list(new Request(`${origin}/api/v1/admin/console/tasks?status=running,blocked&agent=claude&limit=5`));
    expect(response.status).toBe(200);
    expect(mocks.list).toHaveBeenCalledWith(expect.objectContaining({ status: ["running", "blocked"], agent: ["claude"], limit: 5 }));
    expect((await list(new Request(`${origin}/api/v1/admin/console/tasks?status=done`))).status).toBe(422);
  });

  /* A staff mutation is origin-asserted by the wrapper like every console
     mutation; a PATCH without `Origin` is a 403 before the route runs. */
  it("reads one task and patches it through the actor", async () => {
    const actor = { label: "human:owner", userId: "u1" };
    mocks.requireActor.mockImplementation(() => actor);
    mocks.detail.mockResolvedValue({ task: { id: "t1" }, events: [], attachments: [], children: [] });
    const read = await detail(new Request(`${origin}/api/v1/admin/console/tasks/t1`), { params: Promise.resolve({ id: "t1" }) });
    expect(read.status).toBe(200);
    expect(mocks.detail).toHaveBeenCalledWith("t1");

    mocks.patch.mockResolvedValue({ id: "t1", status: "cancelled" });
    const request = new Request(`${origin}/api/v1/admin/console/tasks/t1`, {
      method: "PATCH", headers: { "content-type": "application/json", "x-request-id": "req-9", origin },
      body: JSON.stringify({ status: "cancelled", note: "superseded" }),
    });
    const updated = await patch(request, { params: Promise.resolve({ id: "t1" }) });
    expect(updated.status).toBe(200);
    expect(mocks.patch).toHaveBeenCalledWith("t1", { status: "cancelled", note: "superseded" }, actor, "req-9");

    const bad = new Request(`${origin}/api/v1/admin/console/tasks/t1`, {
      method: "PATCH", headers: { "content-type": "application/json", origin }, body: JSON.stringify({ status: "running", note: "x" }),
    });
    expect((await patch(bad, { params: Promise.resolve({ id: "t1" }) })).status).toBe(422);
  });
});
