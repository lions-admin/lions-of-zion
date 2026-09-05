import { afterEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";
import { freshDatabase } from "@/server/db/testing";
import { briefingAlert } from "@/server/db/schema";
import { listEditorialSchema } from "@/server/contracts/admin-console";
import { AuthRequired, PermissionDenied } from "@/app/admin/auth-required";
import { readConsole, RouteUnavailable, callConsole, CONSOLE_CHANGED } from "@/app/admin/useConsoleRead";

vi.mock("@/server/core/auth/neon", () => ({
  neonAuth: () => ({ getSession: async () => ({ data: null }) }),
}));
const { adminConsoleService } = await import("@/server/modules/admin-console/service");
const { publicationService } = await import("@/server/modules/publications/service");
const actor = { label: "admin:test", userId: null };

afterEach(() => { vi.unstubAllGlobals(); vi.unstubAllEnvs(); });

describe("editorial pagination", () => {
  it("reaches publications beyond both former caps, and keeps filtered counts aligned", async () => {
    const db = await freshDatabase();
    try {
      const publications = publicationService(db);
      for (let index = 0; index < 106; index += 1) {
        await publications.create({ kind: "news_update", section: "israel_update", title: `Desk ${String(index).padStart(3, "0")}`, body: "Test article", language: "en" }, actor);
      }
      const service = adminConsoleService(db, { dispatch: null });
      const ids = new Set<string>();
      for (let number = 1; number <= 5; number += 1) {
        const result = await service.editorial(listEditorialSchema.parse({ page: number }));
        expect(result.counts.draft).toBe(106);
        expect(result.page).toMatchObject({ total: 106, number, pages: 5 });
        for (const row of result.page!.items) { expect(ids.has(row.id)).toBe(false); ids.add(row.id); }
      }
      expect(ids.size).toBe(106);
      const filtered = await service.editorial(listEditorialSchema.parse({ q: "Desk 105", status: "draft" }));
      expect(filtered.counts.draft).toBe(1);
      expect(filtered.page?.total).toBe(1);
      expect(filtered.page?.items[0]?.title).toBe("Desk 105");
      const briefing = await service.editorial(listEditorialSchema.parse({ briefingOnly: "true" }));
      expect(briefing.page?.total).toBe(0);
      expect(briefing.counts.draft).toBe(0);
      const last = await service.editorial(listEditorialSchema.parse({ page: 999 }));
      expect(last.page?.number).toBe(5);
      expect(last.page?.items).toHaveLength(6);
      await publications.remove(filtered.page!.items[0]!.id, actor);
      const deleted = await service.editorial(listEditorialSchema.parse({ q: "Desk 105", page: 9 }));
      expect(deleted.page).toMatchObject({ total: 0, number: 1, pages: 1, items: [] });
    } finally { await db.$client.close(); }
  }, 60_000);

  it("rejects invalid pagination and does not coerce false to true", () => {
    expect(listEditorialSchema.parse({ briefingOnly: "false" }).briefingOnly).toBe(false);
    for (const input of [{ page: 0 }, { limit: 1000 }, { status: "made-up" }, { q: "x".repeat(201) }]) {
      expect(listEditorialSchema.safeParse(input).success).toBe(false);
    }
  });
});

describe("honest operational state", () => {
  it("does not report a global shutdown from an alert alone", async () => {
    const db = await freshDatabase();
    try {
      await db.insert(briefingAlert).values({ fingerprint: "workspace-alert", severity: "critical", kind: "failed_runs", message: "Historical alert" });
      const summary = await adminConsoleService(db, { dispatch: null }).overview();
      expect(summary.attention).toContainEqual({ code: "critical_alerts", severity: "critical", count: 1 });
      expect(summary.health?.collection).toMatchObject({ state: "unknown", observedAt: null });
      expect(summary.health?.processing.reason).not.toBe("critical_alerts");
      expect(summary.nextRun.schedule).toBe("0,30 * * * *");
      expect(typeof summary.systemActive).toBe("boolean"); // legacy contract remains available
    } finally { await db.$client.close(); }
  });

  it("keeps other costs readable on a pre-0052 database without fabricating zero spend", async () => {
    const db = await freshDatabase();
    try {
      await db.execute(sql`ALTER TABLE source_fetch DROP COLUMN actual_cost_usd`);
      const costs = await adminConsoleService(db, { dispatch: null }).costs();
      expect(costs.search.actualSpendUsd).toBeUndefined();
      expect(costs.search.actualSpendStatus).toBe("schema_unavailable");
      expect(costs.warnings.some((warning) => warning.includes("0052"))).toBe(true);
      expect(costs.spend.today).toBe(0);
    } finally { await db.$client.close(); }
  });
});

describe("console HTTP state boundary", () => {
  it.each([[401, AuthRequired], [403, PermissionDenied], [404, RouteUnavailable]] as const)("keeps HTTP %i distinct", async (status, failure) => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status })));
    await expect(readConsole("admin/console/overview")).rejects.toBeInstanceOf(failure);
  });
  it("preserves a server failure detail instead of returning an empty result", async () => {
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response(JSON.stringify({ detail: "Read failed" }), { status: 500 })));
    await expect(readConsole("admin/console/costs")).rejects.toThrow("Read failed");
  });
  it("announces only successful mutations to the active workspace", async () => {
    const dispatchEvent = vi.fn();
    vi.stubGlobal("window", { dispatchEvent });
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 200 })));
    await callConsole("publications/test", { method: "PATCH", body: { title: "Saved" } });
    expect(dispatchEvent.mock.calls[0]?.[0].type).toBe(CONSOLE_CHANGED);
    dispatchEvent.mockClear();
    vi.stubGlobal("fetch", vi.fn().mockResolvedValue(new Response("{}", { status: 403 })));
    await expect(callConsole("publications/test", { method: "DELETE" })).rejects.toBeInstanceOf(PermissionDenied);
    expect(dispatchEvent).not.toHaveBeenCalled();
  });
});
