import { describe, expect, it } from "vitest";
import { sql } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import { opsAgentService, type ToolLoopRunner } from "@/server/modules/ops-agent/service";
import { OPS_TOOL_DEFINITIONS, opsTool } from "@/server/modules/ops-agent/tools";
import { issueConfirmation, verifyConfirmation, canonicalise } from "@/server/modules/ops-agent/confirmations";
import { CONFIRMED_OPS_TOOLS, OPS_TOOLS } from "@/server/contracts/admin-console";
import type { OpsToolContext } from "@/server/modules/ops-agent/context";
import type { ToolGenerateOutput } from "@/server/core/ai/gateway";

/**
 * The guarantee this module exists for: an assistant with real authority over
 * a live site cannot use the irreversible half of it on its own, and whatever
 * it does use is on the record whether or not its own transcript says so.
 *
 * Everything here is a way of trying to get past one of those two.
 */

const PUB_A = "11111111-1111-4111-8111-111111111111";
const PUB_B = "22222222-2222-4222-8222-222222222222";
const SRC = "33333333-3333-4333-8333-333333333333";

const actor = { label: "owner@example.org", userId: null };
const other = { label: "someone-else@example.org", userId: null };

/** A context whose every method records that it was called. Nothing here
 *  touches a real module — the point is what the loop *decided* to do. */
function stubContext(overrides: Partial<OpsToolContext> = {}): OpsToolContext & { calls: string[] } {
  const calls: string[] = [];
  const note = <T>(name: string, value: T) => async (): Promise<T> => {
    calls.push(name);
    return value;
  };
  const ctx = {
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
      /* Deliberately shaped like the real thing: booleans, never values. */
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
    ...overrides,
  } as unknown as OpsToolContext & { calls: string[] };
  return ctx;
}

/**
 * A model that calls the named tools and then answers.
 *
 * It runs the SDK-shaped `execute` the service registered, which is what
 * makes the confirmation behaviour observable: a confirmed tool's execute
 * returns a marker instead of doing anything.
 */
const scripted = (
  calls: Array<{ tool: string; args?: Record<string, unknown> }>,
  text = "Done.",
): ToolLoopRunner => async (input): Promise<ToolGenerateOutput> => {
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

const auditRows = async (db: TestDatabase) =>
  (await db.execute<{ action: string; entityType: string; entityId: string | null }>(sql`
    SELECT action, entity_type AS "entityType", entity_id AS "entityId"
    FROM audit_log WHERE action LIKE 'ops.%' ORDER BY id
  `)).rows;

const agentOn = (db: TestDatabase, ctx: OpsToolContext, run: ToolLoopRunner) =>
  opsAgentService(db, ctx, { run });

describe("the tool registry", () => {
  it("defines exactly the contract's tools, with the contract's confirmation flags", () => {
    expect(OPS_TOOL_DEFINITIONS.map((tool) => tool.name).sort()).toEqual([...OPS_TOOLS].sort());
    const confirmed = OPS_TOOL_DEFINITIONS.filter((tool) => tool.requiresConfirmation).map((tool) => tool.name);
    expect(confirmed.sort()).toEqual([...CONFIRMED_OPS_TOOLS].sort());
  });

  it("labels every tool in Hebrew for the operator and describes it in English for the model", () => {
    /* The two strings serve two readers and must not collapse into one.
       `description` is prompt text — the model reads it to decide when to
       call the tool, and the loop was built and tested against the English.
       `label` is what a person reads in the console's capability list.
       Translating the description would change the model's inputs, not just
       the interface; dropping the label would put English in a Hebrew
       console. Both directions are failures, so both are pinned. */
    const HEBREW = /[\u0590-\u05FF]/;
    for (const tool of OPS_TOOL_DEFINITIONS) {
      expect(HEBREW.test(tool.label), `${tool.name} has a Hebrew label`).toBe(true);
      expect(HEBREW.test(tool.description), `${tool.name} keeps an English description`).toBe(false);
      expect(tool.label.length, `${tool.name}'s label is short enough to read in a list`)
        .toBeLessThanOrEqual(40);
    }
  });

  it("gives every tool a description, a consequence and a target", () => {
    for (const tool of OPS_TOOL_DEFINITIONS) {
      expect(tool.description.length, tool.name).toBeGreaterThan(40);
      expect(tool.consequence({ id: "x", slot: 1, publicationId: null, changeSummary: "s" }).length, tool.name)
        .toBeGreaterThan(10);
      expect(tool.target({ id: "x", slot: 1 }).length, tool.name).toBeGreaterThan(2);
    }
  });

  it("files an operation that touches no single record under the system entity", () => {
    expect(opsTool("run_processing")?.entityType).toBe("system");
    expect(opsTool("publish_publication")?.entityType).toBe("brief");
    expect(opsTool("verify_source")?.entityType).toBe("source");
  });
});

describe("confirmation tokens", () => {
  const issue = (overrides: Partial<Parameters<typeof issueConfirmation>[0]> = {}) =>
    issueConfirmation({ tool: "publish_publication", args: { id: PUB_A }, actorLabel: actor.label, ...overrides });

  it("round-trips a token it issued", () => {
    const issued = issue();
    const payload = verifyConfirmation({ token: issued.token, id: issued.id, actorLabel: actor.label });
    expect(payload.tool).toBe("publish_publication");
    expect(payload.args).toEqual({ id: PUB_A });
  });

  it("refuses a token whose body was edited to name a different publication", () => {
    const issued = issue();
    const [, signature] = issued.token.split(".");
    const forgedBody = Buffer.from(
      canonicalise({ id: issued.id, tool: "publish_publication", args: { id: PUB_B }, actorLabel: actor.label, exp: Date.now() + 60_000 }),
    ).toString("base64url");
    expect(() => verifyConfirmation({ token: `${forgedBody}.${signature}`, id: issued.id, actorLabel: actor.label }))
      .toThrowError(/not valid/i);
  });

  it("refuses a token presented by a different operator", () => {
    const issued = issue();
    expect(() => verifyConfirmation({ token: issued.token, id: issued.id, actorLabel: other.label }))
      .toThrowError(/not valid/i);
  });

  it("refuses a token presented under a different confirmation id", () => {
    const issued = issue();
    expect(() => verifyConfirmation({ token: issued.token, id: crypto.randomUUID(), actorLabel: actor.label }))
      .toThrowError(/not valid/i);
  });

  it("refuses an expired token, and says so distinctly", () => {
    const issued = issue({ now: new Date(Date.now() - 60 * 60 * 1_000) });
    expect(() => verifyConfirmation({ token: issued.token, id: issued.id, actorLabel: actor.label }))
      .toThrowError(/expired/i);
  });

  it("signs the meaning of the arguments, not the order they were written in", () => {
    const a = issueConfirmation({ tool: "set_source_active", args: { active: false, id: SRC, reason: "quiet" }, actorLabel: actor.label });
    const b = issueConfirmation({ tool: "set_source_active", args: { reason: "quiet", id: SRC, active: false }, actorLabel: actor.label });
    /* Different ids, so different tokens — but the signed argument bodies
       must match, or a legitimate approval built a different way is refused. */
    expect(canonicalise({ active: false, id: SRC, reason: "quiet" }))
      .toBe(canonicalise({ reason: "quiet", id: SRC, active: false }));
    expect(a.token).not.toBe(b.token);
  });
});

describe("a turn", () => {
  it("runs a read tool, records it, and leaves state unchanged", async () => {
    const db = await freshDatabase();
    const ctx = stubContext();
    const response = await agentOn(db, ctx, scripted([{ tool: "get_overview" }])).turn(
      { history: [], message: "How are things?", confirmations: [] },
      actor,
      "req-1",
    );

    expect(ctx.calls).toEqual(["overview"]);
    expect(response.stateChanged).toBe(false);
    expect(response.pendingConfirmations).toEqual([]);
    expect(response.messages.at(-1)?.role).toBe("assistant");
    expect(await auditRows(db)).toEqual([
      { action: "ops.tool.get_overview", entityType: "system", entityId: null },
    ]);
  });

  it("records the turn's spend against the operations console profile", async () => {
    const db = await freshDatabase();
    await agentOn(db, stubContext(), scripted([])).turn(
      { history: [], message: "Hello", confirmations: [] },
      actor,
    );
    const runs = await db.execute<{ modelProfile: string; kind: string; model: string }>(sql`
      SELECT model_profile AS "modelProfile", kind, model FROM ai_run
    `);
    expect(runs.rows).toEqual([
      { modelProfile: "opsConsole", kind: "chat", model: "openai/gpt-5.6-sol" },
    ]);
  });

  it("runs a reversible operation and reports the state as changed", async () => {
    const db = await freshDatabase();
    const ctx = stubContext();
    const response = await agentOn(db, ctx, scripted([{ tool: "run_processing" }])).turn(
      { history: [], message: "Run processing now", confirmations: [] },
      actor,
    );
    expect(ctx.calls).toEqual(["briefing.runProcessing"]);
    expect(response.stateChanged).toBe(true);
  });

  it("does not run an irreversible tool the model asked for — it asks the operator", async () => {
    const db = await freshDatabase();
    const ctx = stubContext();
    const id = crypto.randomUUID();
    const response = await agentOn(db, ctx, scripted([{ tool: "publish_publication", args: { id } }])).turn(
      { history: [], message: "Publish it", confirmations: [] },
      actor,
    );

    /* Nothing was published. */
    expect(ctx.calls).toEqual([]);
    expect(response.stateChanged).toBe(false);
    expect(await auditRows(db)).toEqual([]);

    expect(response.pendingConfirmations).toHaveLength(1);
    const [confirmation] = response.pendingConfirmations;
    expect(confirmation.tool).toBe("publish_publication");
    expect(confirmation.args).toEqual({ id });
    expect(confirmation.consequence).toMatch(/search engines/i);
    expect(confirmation.token).toContain(".");
  });

  it("runs it on the next turn once the operator approves, and records it", async () => {
    const db = await freshDatabase();
    const ctx = stubContext();
    const agent = agentOn(db, ctx, scripted([{ tool: "publish_publication", args: { id: PUB_A } }]));
    const first = await agent.turn({ history: [], message: "Publish it", confirmations: [] }, actor);
    const [proposal] = first.pendingConfirmations;

    const second = await agentOn(db, ctx, scripted([])).turn(
      {
        history: [],
        message: "Confirmed.",
        confirmations: [{ id: proposal.id, token: proposal.token, approved: true }],
      },
      actor,
    );

    expect(ctx.calls).toEqual(["publications.transition"]);
    expect(second.stateChanged).toBe(true);
    expect((await auditRows(db)).map((row) => row.action)).toEqual(["ops.tool.publish_publication"]);
  });

  it("records a decline and runs nothing", async () => {
    const db = await freshDatabase();
    const ctx = stubContext();
    const proposal = issueConfirmation({ tool: "delete_publication", args: { id: PUB_A }, actorLabel: actor.label });

    const response = await agentOn(db, ctx, scripted([])).turn(
      { history: [], message: "No.", confirmations: [{ id: proposal.id, token: proposal.token, approved: false }] },
      actor,
    );

    expect(ctx.calls).toEqual([]);
    expect(response.stateChanged).toBe(false);
    expect((await auditRows(db)).map((row) => row.action)).toEqual(["ops.tool.delete_publication.declined"]);
  });

  it("refuses an approval that arrives with another operator's label", async () => {
    const db = await freshDatabase();
    const ctx = stubContext();
    const proposal = issueConfirmation({ tool: "delete_publication", args: { id: PUB_A }, actorLabel: actor.label });

    await expect(agentOn(db, ctx, scripted([])).turn(
      { history: [], message: "Confirmed.", confirmations: [{ id: proposal.id, token: proposal.token, approved: true }] },
      other,
    )).rejects.toThrowError(/not valid/i);

    expect(ctx.calls).toEqual([]);
    expect(await auditRows(db)).toEqual([]);
  });

  it("keeps answering when a tool throws, and records the failure by error class", async () => {
    const db = await freshDatabase();
    const ctx = stubContext({
      console: {
        ...stubContext().console,
        pipeline: async () => { throw new Error("the database went away"); },
      } as OpsToolContext["console"],
    });

    const response = await agentOn(db, ctx, scripted([{ tool: "get_pipeline" }], "I could not read the pipeline."))
      .turn({ history: [], message: "Pipeline?", confirmations: [] }, actor);

    expect(response.messages.at(-1)?.content).toBe("I could not read the pipeline.");
    const rows = await db.execute<{ action: string; after: unknown }>(sql`
      SELECT action, after_state AS after FROM audit_log WHERE action LIKE 'ops.%'
    `);
    expect(rows.rows[0]?.action).toBe("ops.tool.get_pipeline.failed");
    /* The provider's message can echo the input back; the class cannot. */
    expect(JSON.stringify(rows.rows[0]?.after)).not.toContain("went away");
  });

  it("never puts a secret value in what the security tool returns", async () => {
    const db = await freshDatabase();
    const ctx = stubContext();
    await agentOn(db, ctx, scripted([{ tool: "get_security" }])).turn(
      { history: [], message: "Are the keys set?", confirmations: [] },
      actor,
    );
    const rows = await db.execute<{ after: unknown }>(sql`
      SELECT after_state AS after FROM audit_log WHERE action = 'ops.tool.get_security'
    `);
    /* The audit row carries a summary, never the tool's payload — so a
       secret cannot reach the log even if a read tool one day returned one.
       The word "secrets" appears in the summary; a secret *value* must not,
       which is what these patterns look for. */
    const recorded = JSON.stringify(rows.rows[0]?.after);
    expect(recorded).toContain("ok");
    expect(recorded).not.toMatch(/sk-[A-Za-z0-9_-]{8}|postgres(ql)?:\/\/|Bearer\s+\S/i);
    expect(recorded).not.toContain("OPENAI_API_KEY");
  });
});

describe("capabilities", () => {
  it("reports the configured model and every tool, flagged", async () => {
    const db = await freshDatabase();
    const capabilities = agentOn(db, stubContext(), scripted([])).capabilities();
    expect(capabilities.model).toBe("openai/gpt-5.6-sol");
    expect(capabilities.tools).toHaveLength(OPS_TOOLS.length);
    expect(capabilities.tools.find((tool) => tool.name === "delete_publication")?.requiresConfirmation).toBe(true);
    expect(capabilities.tools.find((tool) => tool.name === "get_overview")?.requiresConfirmation).toBe(false);
    /* The capability list the console renders carries the Hebrew label. */
    expect(capabilities.tools.find((tool) => tool.name === "delete_publication")?.label)
      .toBe("מחיקת כתבה לצמיתות");
  });
});
