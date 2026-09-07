import { afterAll, beforeAll, describe, expect, it, vi } from "vitest";

/* The service reaches module singletons for its read paths, and those reach
   Neon Auth, which a node-environment test cannot load. Stubbed the way every
   other internal-route suite here stubs it; nothing in these tests calls it. */
vi.mock("@/server/core/auth/actor", () => ({
  authenticateAdmin: vi.fn(), registerActor: vi.fn(), requireActor: vi.fn(),
}));
import { sql } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import type { Database } from "@/server/db/client";
import { chatgptAutomationService } from "@/server/modules/chatgpt-automation/service";
import { CHATGPT_ACTOR_LABEL, CHATGPT_SUBSTITUTED_TOOLS } from "@/server/contracts/chatgpt-automation";
import { OPS_TOOLS, CONFIRMED_OPS_TOOLS } from "@/server/contracts/admin-console";
import type { OpsToolContext } from "@/server/modules/ops-agent/context";

/**
 * What the scheduled editor may do, decided by the server.
 *
 * The owner granted it every capability the ops console has. That is a real
 * decision with a real edge: of the six tools the console guards behind a human
 * confirmation, five are reversible and one destroys a published record with no
 * undelete. The substitution below is what makes "all of them" survivable, and
 * these tests are what stop it being quietly removed.
 */

let db: TestDatabase;
beforeAll(async () => { db = await freshDatabase(); }, 60000);
afterAll(async () => { await db?.$client.close(); });

/** A stub context: the point here is the policy, not the services beneath it. */
function stubContext(calls: Array<{ method: string; args: unknown[] }>): OpsToolContext {
  const note = (method: string) => (...args: unknown[]) => {
    calls.push({ method, args });
    return Promise.resolve({ id: "publication-1", status: "archived" });
  };
  return {
    console: {
      overview: note("console.overview"), pipeline: note("console.pipeline"), sources: note("console.sources"),
      editorial: note("console.editorial"), narratives: note("console.narratives"), users: note("console.users"),
      costs: note("console.costs"), incidents: note("console.incidents"), qualityChecks: note("console.qualityChecks"),
      editionDrilldown: note("console.editionDrilldown"), sourceFetches: note("console.sourceFetches"),
      security: note("console.security"), settings: note("console.settings"), audit: note("console.audit"),
      auditEntry: note("console.auditEntry"), resolveAlert: note("console.resolveAlert"),
      setSourceActive: note("console.setSourceActive"), publicationVersions: note("console.publicationVersions"),
      rollbackPublication: note("console.rollbackPublication"),
    } as unknown as OpsToolContext["console"],
    publications: {
      get: note("publications.get"), list: note("publications.list"), update: note("publications.update"),
      remove: note("publications.remove"), transition: note("publications.transition"),
      setHomepagePlacement: note("publications.setHomepagePlacement"),
    } as unknown as OpsToolContext["publications"],
    sources: { verify: note("sources.verify"), syncCatalog: note("sources.syncCatalog") } as unknown as OpsToolContext["sources"],
    health: note("health") as unknown as OpsToolContext["health"],
  };
}

const service = (calls: Array<{ method: string; args: unknown[] }>) =>
  chatgptAutomationService(db as unknown as Database, stubContext(calls));

describe("the automation's capabilities", () => {
  it("may run an ordinary read", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const result = await service(calls).invoke("get_overview", {});
    expect(calls.map(call => call.method)).toContain("console.overview");
    expect(result.ranAs).toBeNull();
    expect(result.substitutionNote).toBeNull();
  });

  it("may run a reversible write without any human confirmation", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    await service(calls).invoke("set_homepage_placement", { area: "news", position: "lead", publicationId: "11111111-1111-4111-8111-111111111111" });
    expect(calls.map(call => call.method)).toContain("publications.setHomepagePlacement");
  });

  /* The heart of it. `delete_publication` remains callable — the owner granted
     every capability — but `publications.remove` is not reachable from this
     identity, and the caller is told plainly what ran instead. */
  it("archives instead of deleting, and says so", async () => {
    const calls: Array<{ method: string; args: unknown[] }> = [];
    const result = await service(calls).invoke("delete_publication", { id: "11111111-1111-4111-8111-111111111111" });

    const methods = calls.map(call => call.method);
    expect(methods).toContain("publications.transition");
    expect(methods).not.toContain("publications.remove");
    expect(calls.find(call => call.method === "publications.transition")?.args[1]).toEqual({ to: "archived" });

    expect(result.tool).toBe("delete_publication");
    expect(result.ranAs).toBe("archive_publication");
    expect(result.substitutionNote).toMatch(/reversible/i);
  });

  it("has exactly one substitution, and it is the only irreversible tool", () => {
    expect(Object.keys(CHATGPT_SUBSTITUTED_TOOLS)).toEqual(["delete_publication"]);
    /* The other five confirmed tools run as themselves precisely because each
       one can be undone: a status transition, a rollback that keeps history, a
       source switched back on. */
    for (const tool of CONFIRMED_OPS_TOOLS) {
      if (tool === "delete_publication") continue;
      expect(CHATGPT_SUBSTITUTED_TOOLS).not.toHaveProperty(tool);
    }
  });

  it("refuses arguments the tool's own schema rejects", async () => {
    await expect(service([]).invoke("get_publication", {})).rejects.toThrow(/Invalid arguments/i);
  });

  it("refuses a name that is not a tool", async () => {
    await expect(service([]).invoke("not_a_tool" as never, {})).rejects.toThrow(/No such operation/i);
  });

  /* Three ways this system changes, three actor labels. A reviewer asking
     "who did this" must never have to guess between a human at the console,
     this automation, and an editorial package. */
  it("files every call under its own actor, reads included", async () => {
    await service([]).invoke("get_overview", {}, "request-abc");
    const rows = await db.execute<{ action: string; actorLabel: string; requestId: string | null }>(sql`
      SELECT action, actor_label AS "actorLabel", request_id AS "requestId"
      FROM audit_log WHERE action LIKE 'chatgpt.tool.%' ORDER BY id DESC LIMIT 1
    `);
    expect(rows.rows[0]).toMatchObject({
      action: "chatgpt.tool.get_overview",
      actorLabel: CHATGPT_ACTOR_LABEL,
      requestId: "request-abc",
    });
    expect(rows.rows[0]!.actorLabel).not.toBe("service:editorial-updates");
  });

  it("records a failed call rather than losing it", async () => {
    const failing = chatgptAutomationService(db as unknown as Database, {
      ...stubContext([]),
      console: { overview: () => Promise.reject(new Error("boom")) } as unknown as OpsToolContext["console"],
    });
    await expect(failing.invoke("get_overview", {})).rejects.toThrow("boom");
    const rows = await db.execute<{ action: string }>(sql`
      SELECT action FROM audit_log WHERE action = 'chatgpt.tool.get_overview.failed' LIMIT 1
    `);
    expect(rows.rows).toHaveLength(1);
  });

  it("permits every tool the console defines, so the two cannot drift apart", async () => {
    const { CHATGPT_AUTOMATION_TOOLS } = await import("@/server/contracts/chatgpt-automation");
    expect([...CHATGPT_AUTOMATION_TOOLS]).toEqual([...OPS_TOOLS]);
  });

  /* The duplicate check is the one read whose failure mode is publishing.
     A swallowed infrastructure error answers "this story does not exist", and
     the caller's next move on that answer is to create it again. Caught live
     on 2026-09-07 against a Preview database that was behind on migrations and
     therefore reported every lookup as a miss. */
  it("reports a genuine miss as null, and refuses to call a database failure a miss", async () => {
    const service_ = chatgptAutomationService(db as unknown as Database, stubContext([]));
    await expect(service_.findPublication("no-such-record")).resolves.toBeNull();

    /* A broken database, which must propagate rather than flatten into null. */
    const broken = chatgptAutomationService(
      { transaction: () => Promise.reject(new Error("unused")) } as unknown as Database,
      stubContext([]),
    );
    await expect(broken.findPublication("anything")).rejects.toThrow();
  });
});
