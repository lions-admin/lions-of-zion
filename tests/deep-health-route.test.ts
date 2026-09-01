import { describe, expect, it, vi } from "vitest";

const mocks = vi.hoisted(() => ({
  requireActor: vi.fn(),
  deepHealth: vi.fn(async () => ({ status: "degraded", checks: { database: { status: "degraded" } } })),
}));

vi.mock("@/server/http/handler", () => ({ handler: (fn: unknown) => fn }));
vi.mock("@/server/http/responses", () => ({ ok: (body: unknown) => new Response(JSON.stringify(body), { status: 200 }) }));
vi.mock("@/server/core/auth/actor", () => ({ requireActor: mocks.requireActor }));
vi.mock("@/server/core/deep-health", () => ({ deepHealth: mocks.deepHealth }));

import { GET } from "@/app/api/v1/admin/health/deep/route";

describe("administrator deep-health route", () => {
  it("requires an authenticated actor before it runs dependency probes", async () => {
    mocks.requireActor.mockImplementationOnce(() => { throw new Error("forbidden"); });
    await expect(GET(new Request("https://lionsofzion.io/api/v1/admin/health/deep"))).rejects.toThrow("forbidden");
    expect(mocks.deepHealth).not.toHaveBeenCalled();
  });

  it("returns the real probe status to an authenticated administrator", async () => {
    mocks.requireActor.mockImplementationOnce(() => undefined);
    const response = await GET(new Request("https://lionsofzion.io/api/v1/admin/health/deep"));
    expect(response.status).toBe(200);
    expect(await response.json()).toMatchObject({ status: "degraded", checks: { database: { status: "degraded" } } });
    expect(mocks.deepHealth).toHaveBeenCalledOnce();
  });
});
