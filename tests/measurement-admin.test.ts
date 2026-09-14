/**
 * Measurement admin wiring: nav group, route guard, empty-state honesty.
 */
import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it, vi } from "vitest";
import { freshDatabase } from "@/server/db/testing";
import { measurementService } from "@/server/modules/measurement/service";

const state = vi.hoisted(() => ({
  db: undefined as unknown,
}));

vi.mock("@/server/db/client", () => ({
  db: () => {
    if (!state.db) throw new Error("No test database registered for this test.");
    return state.db;
  },
  withDatabaseRole: async (_role: string, _identity: string, fn: () => Promise<unknown>) => fn(),
  databaseIdentity: () => "test",
}));

vi.mock("@/server/core/auth/neon", () => ({
  neonAuth: () => ({ getSession: async () => ({ data: null }) }),
}));

describe("measurement admin wiring", () => {
  it("adds the מדידה nav group with ten screens", () => {
    const source = readFileSync(path.join(process.cwd(), "app/admin/OperationsConsole.tsx"), "utf8");
    expect(source).toContain('title: "מדידה"');
    for (const key of [
      "measure-now",
      "measure-today",
      "measure-content",
      "measure-home",
      "measure-audience",
      "measure-paths",
      "measure-search",
      "measure-ux",
      "measure-errors",
      "measure-insights",
    ]) {
      expect(source).toContain(`"${key}"`);
    }
  });

  it("mounts the collector outside admin-only code paths", () => {
    const layout = readFileSync(path.join(process.cwd(), "app/layout.tsx"), "utf8");
    expect(layout).toContain("MeasurementRoot");
    const collector = readFileSync(path.join(process.cwd(), "components/measurement/collector.ts"), "utf8");
    expect(collector).toContain("data-surface='admin'");
  });

  it("lists collect on PUBLIC_V1", () => {
    const handler = readFileSync(path.join(process.cwd(), "server/http/handler.ts"), "utf8");
    expect(handler).toMatch(/measurement\\\/collect/);
  });

  it("refuses unauthenticated console measurement reads with 401", async () => {
    state.db = await freshDatabase();
    const { GET } = await import("@/app/api/v1/admin/console/measurement/route");
    const response = await GET(
      new Request("http://localhost/api/v1/admin/console/measurement?screen=now"),
    );
    expect(response.status).toBe(401);
    expect((await response.json()).error.code).toBe("UNAUTHENTICATED");
  });

  it("reports honest empty state before any events", async () => {
    const db = await freshDatabase();
    const service = measurementService(db as never);
    const screen = await service.consoleScreen("now", { includeStaff: false, includeBots: false });
    expect(screen.empty).toBe("no_data_yet");
    expect(screen.messageHe).toContain("אין עדיין נתונים");
  });
});
