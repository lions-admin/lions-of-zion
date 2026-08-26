import { afterEach, describe, expect, it, vi } from "vitest";
import { eq, sql } from "drizzle-orm";
import { SQLSTATE, freshDatabase, violation, type TestDatabase } from "@/server/db/testing";
import { aiService, recordEmbeddingRun } from "@/server/modules/ai/service";
import { aiRepo } from "@/server/modules/ai/repo";
import { itemService } from "@/server/modules/items/service";
import { assertSendable, assertWithinBudget } from "@/server/core/ai/gateway";
import { aiRun, aiSuggestion, appUser, entityVersion, informationItem, promptRegistry } from "@/server/db/schema";
import type { GenerateOutput } from "@/server/core/ai/gateway";

/**
 * The whole AI pipeline without a gateway or a credential: the generator is
 * injected, so budget guards, run recording, the suggestion lifecycle and the
 * acceptance path are all exercised against a real database and a stub model.
 */

const stubOutput = (text: string): GenerateOutput => ({
  text,
  model: "anthropic/claude-haiku-4.5",
  inputTokens: 120,
  outputTokens: 40,
  latencyMs: 12,
  inputHash: "a".repeat(64),
  costUsd: 0.00032,
});

const itemInput = {
  type: "claim" as const,
  title: "A claim about the border",
  canonicalText: "The war did not stay at the border.",
  language: "en",
};

async function seedUser(db: TestDatabase, displayName: string, isAutomated = false) {
  const [row] = await db
    .insert(appUser)
    .values({ externalId: `auth|${displayName}`, displayName, isAutomated })
    .returning();
  return row!;
}

afterEach(() => {
  delete process.env.AI_DAILY_BUDGET_USD;
  delete process.env.AI_MONTHLY_BUDGET_USD;
  vi.restoreAllMocks();
});

describe("the classification guard", () => {
  it("refuses to send restricted or secret material to a model", () => {
    for (const dataClass of ["restricted", "secret"] as const) {
      expect(() => assertSendable(dataClass)).toThrow(/may never be sent to a model/);
    }
  });

  it("allows everything else", () => {
    for (const dataClass of ["public", "internal", "confidential"] as const) {
      expect(() => assertSendable(dataClass)).not.toThrow();
    }
  });

  it("is enforced by the database too, not only by the service", async () => {
    /* The service refuses the request; this refuses the record. Both matter:
       if a row can exist, the send already happened. */
    const db = await freshDatabase();
    const v = await violation(
      db.insert(aiRun).values({
        kind: "summarize",
        model: "anthropic/claude-haiku-4.5",
        modelProfile: "fast",
        status: "ok",
        actorLabel: "test",
        inputDataClass: "restricted",
      }),
    );
    expect(v.code).toBe(SQLSTATE.checkViolation);
    expect(v.constraint).toBe("restricted_data_never_reaches_a_model");
  });
});

describe("the budget guard", () => {
  it("passes when no budget is configured", async () => {
    await expect(assertWithinBudget(async () => 9_999)).resolves.toBeUndefined();
  });

  it("refuses once the daily ceiling is reached", async () => {
    process.env.AI_DAILY_BUDGET_USD = "10";
    await expect(assertWithinBudget(async () => 10)).rejects.toThrow(/daily AI budget/);
  });

  it("allows spend below the ceiling", async () => {
    process.env.AI_DAILY_BUDGET_USD = "10";
    await expect(assertWithinBudget(async () => 9.99)).resolves.toBeUndefined();
  });

  it("refuses once the monthly ceiling is reached", async () => {
    process.env.AI_MONTHLY_BUDGET_USD = "100";
    await expect(assertWithinBudget(async () => 100)).rejects.toThrow(/monthly AI budget/);
  });

  it("sums recorded spend from the database, and reports zero for an empty window", async () => {
    const db = await freshDatabase();
    const repo = aiRepo(db);
    expect(await repo.spendSince(new Date(Date.now() - 86_400_000))).toBe(0);

    await db.insert(aiRun).values([
      { kind: "summarize", model: "m", modelProfile: "fast", status: "ok", actorLabel: "t", costUsd: "1.50" },
      { kind: "summarize", model: "m", modelProfile: "fast", status: "ok", actorLabel: "t", costUsd: "2.25" },
      /* A failed run cost nothing to the ledger and must not count. */
      { kind: "summarize", model: "m", modelProfile: "fast", status: "error", actorLabel: "t", costUsd: "9.99" },
    ]);
    expect(await repo.spendSince(new Date(Date.now() - 86_400_000))).toBe(3.75);
  });

  it("preserves a sub-micro-dollar embedding charge", async () => {
    const db = await freshDatabase();
    const id = await recordEmbeddingRun(db, {
      model: "openai/text-embedding-3-small",
      inputTokens: 2,
      inputHash: "b".repeat(64),
      costUsd: 0.00000004,
      actorLabel: "anonymous:test",
    });
    const [row] = await db.select({ costUsd: aiRun.costUsd }).from(aiRun).where(eq(aiRun.id, id));
    expect(row?.costUsd).toBe("0.000000040");
  });
});

describe("ai_run and prompt_registry are append-only", () => {
  it("refuses to update a recorded run", async () => {
    const db = await freshDatabase();
    const [row] = await db
      .insert(aiRun)
      .values({ kind: "summarize", model: "m", modelProfile: "fast", status: "ok", actorLabel: "t" })
      .returning();
    const v = await violation(db.update(aiRun).set({ costUsd: "0" }).where(eq(aiRun.id, row!.id)));
    expect(v.message).toMatch(/ai_run is append-only/);
  });

  it("refuses to rewrite a prompt template", async () => {
    const db = await freshDatabase();
    const [row] = await db
      .insert(promptRegistry)
      .values({ slug: "suggest.summary", version: 1, kind: "summarize", template: "Original.", modelProfile: "fast" })
      .returning();
    const v = await violation(
      db.update(promptRegistry).set({ template: "Rewritten." }).where(eq(promptRegistry.id, row!.id)),
    );
    expect(v.message).toMatch(/prompt_registry is append-only/);
  });

  it("still allows activation, through the one sanctioned function", async () => {
    const db = await freshDatabase();
    await db.insert(promptRegistry).values([
      { slug: "suggest.summary", version: 1, kind: "summarize", template: "v1", modelProfile: "fast" },
      { slug: "suggest.summary", version: 2, kind: "summarize", template: "v2", modelProfile: "fast" },
    ]);

    await aiRepo(db).activatePrompt("suggest.summary", 1);
    expect((await aiRepo(db).activePrompt("suggest.summary"))!.version).toBe(1);

    /* Switching versions must not leave two active — the partial unique index
       would refuse it, so this also proves the deactivate/activate ordering. */
    await aiRepo(db).activatePrompt("suggest.summary", 2);
    const active = await aiRepo(db).activePrompt("suggest.summary");
    expect(active!.version).toBe(2);

    const stillActive = await db
      .select()
      .from(promptRegistry)
      .where(sql`activated_at IS NOT NULL`);
    expect(stillActive).toHaveLength(1);
  });
});

describe("suggesting", () => {
  it("refuses cleanly when no gateway is configured", async () => {
    const db = await freshDatabase();
    const item = await itemService(db).create(itemInput, { label: "editor", userId: null });
    await expect(
      aiService(db).suggest(
        { subjectType: "information_item", subjectId: item.id, field: "summary" },
        { label: "editor", userId: null },
      ),
    ).rejects.toThrow(/No AI gateway is configured/);
  });

  it("records a run and files a suggestion, and changes nothing on the item", async () => {
    const db = await freshDatabase();
    const actor = { label: "editor@example.org", userId: null };
    const item = await itemService(db).create(itemInput, actor);

    const svc = aiService(db, { generate: async () => stubOutput("A neutral two-sentence summary.") });
    const suggestion = await svc.suggest(
      { subjectType: "information_item", subjectId: item.id, field: "summary" },
      actor,
    );

    expect(suggestion.status).toBe("pending");
    expect((suggestion.proposed as { text: string }).text).toBe("A neutral two-sentence summary.");

    const runs = await db.select().from(aiRun);
    expect(runs).toHaveLength(1);
    expect(runs[0]!.model).toBe("anthropic/claude-haiku-4.5");
    expect(runs[0]!.subjectId).toBe(item.id);

    /* The whole point: nothing reached the entity. */
    const [after] = await db.select().from(informationItem).where(eq(informationItem.id, item.id));
    expect(after!.summary).toBeNull();
  });

  it("supersedes an earlier pending suggestion for the same field", async () => {
    const db = await freshDatabase();
    const actor = { label: "editor@example.org", userId: null };
    const item = await itemService(db).create(itemInput, actor);
    const svc = aiService(db, { generate: async () => stubOutput("A summary.") });

    const first = await svc.suggest({ subjectType: "information_item", subjectId: item.id, field: "summary" }, actor);
    await svc.suggest({ subjectType: "information_item", subjectId: item.id, field: "summary" }, actor);

    const [refetched] = await db.select().from(aiSuggestion).where(eq(aiSuggestion.id, first.id));
    expect(refetched!.status).toBe("superseded");

    const pending = await db.select().from(aiSuggestion).where(eq(aiSuggestion.status, "pending"));
    expect(pending).toHaveLength(1);
  });
});

describe("deciding", () => {
  async function pendingSuggestion(db: TestDatabase) {
    const actor = { label: "editor@example.org", userId: null };
    const item = await itemService(db).create(itemInput, actor);
    const svc = aiService(db, { generate: async () => stubOutput("An accepted summary.") });
    const suggestion = await svc.suggest(
      { subjectType: "information_item", subjectId: item.id, field: "summary" },
      actor,
    );
    return { item, suggestion, svc };
  }

  it("requires a known reviewer identity, not just a label", async () => {
    const db = await freshDatabase();
    const { suggestion, svc } = await pendingSuggestion(db);
    await expect(
      svc.decide(suggestion.id, { decision: "accepted" }, { label: "someone", userId: null }),
    ).rejects.toThrow(/known reviewer identity/);
  });

  it("refuses an automated identity", async () => {
    const db = await freshDatabase();
    const { suggestion, svc } = await pendingSuggestion(db);
    const robot = await seedUser(db, "Ingest Worker", true);
    await expect(
      svc.decide(suggestion.id, { decision: "accepted" }, { label: robot.displayName, userId: robot.id }),
    ).rejects.toThrow(/automated/);
  });

  it("writes the accepted text through the versioned path, attributed to the run", async () => {
    const db = await freshDatabase();
    const { item, suggestion, svc } = await pendingSuggestion(db);
    const reviewer = await seedUser(db, "A Reviewer");

    const decided = await svc.decide(
      suggestion.id,
      { decision: "accepted" },
      { label: reviewer.displayName, userId: reviewer.id },
    );
    expect(decided.status).toBe("accepted");
    expect(decided.decidedBy).toBe(reviewer.id);

    const [after] = await db.select().from(informationItem).where(eq(informationItem.id, item.id));
    expect(after!.summary).toBe("An accepted summary.");

    const versions = await db.select().from(entityVersion);
    const aiVersion = versions.find((v) => v.changeSource === "ai_suggestion_accepted");
    expect(aiVersion, "an AI-derived change must be a normal version").toBeDefined();
    expect(aiVersion!.aiRunId).toBe(suggestion.aiRunId);
  });

  it("leaves the item alone when the suggestion is rejected", async () => {
    const db = await freshDatabase();
    const { item, suggestion, svc } = await pendingSuggestion(db);
    const reviewer = await seedUser(db, "A Reviewer");

    await svc.decide(
      suggestion.id,
      { decision: "rejected", note: "Loses the hedging." },
      { label: reviewer.displayName, userId: reviewer.id },
    );

    const [after] = await db.select().from(informationItem).where(eq(informationItem.id, item.id));
    expect(after!.summary).toBeNull();
  });

  it("refuses to decide the same suggestion twice", async () => {
    const db = await freshDatabase();
    const { suggestion, svc } = await pendingSuggestion(db);
    const reviewer = await seedUser(db, "A Reviewer");
    const actor = { label: reviewer.displayName, userId: reviewer.id };

    await svc.decide(suggestion.id, { decision: "accepted" }, actor);
    await expect(svc.decide(suggestion.id, { decision: "rejected" }, actor)).rejects.toThrow(
      /already "accepted"/,
    );
  });
});

describe("the suggestion table's own guarantees", () => {
  it("refuses an accepted or rejected suggestion with no decider", async () => {
    const db = await freshDatabase();
    const [row] = await db
      .insert(aiRun)
      .values({ kind: "summarize", model: "m", modelProfile: "fast", status: "ok", actorLabel: "t" })
      .returning();
    const v = await violation(
      db.insert(aiSuggestion).values({
        aiRunId: row!.id,
        subjectType: "information_item",
        subjectId: crypto.randomUUID(),
        field: "summary",
        proposed: { text: "x" },
        rationale: "because",
        status: "accepted",
      }),
    );
    expect(v.constraint).toBe("human_decision_is_attributed");
  });

  it("allows superseded with no decider, because nobody decided it", async () => {
    const db = await freshDatabase();
    const [row] = await db
      .insert(aiRun)
      .values({ kind: "summarize", model: "m", modelProfile: "fast", status: "ok", actorLabel: "t" })
      .returning();
    const [suggestion] = await db
      .insert(aiSuggestion)
      .values({
        aiRunId: row!.id,
        subjectType: "information_item",
        subjectId: crypto.randomUUID(),
        field: "summary",
        proposed: { text: "x" },
        rationale: "because",
        status: "superseded",
        decidedAt: new Date(),
      })
      .returning();
    expect(suggestion!.decidedBy).toBeNull();
  });

  it("refuses a suggestion with no stated reasoning", async () => {
    const db = await freshDatabase();
    const [row] = await db
      .insert(aiRun)
      .values({ kind: "summarize", model: "m", modelProfile: "fast", status: "ok", actorLabel: "t" })
      .returning();
    const v = await violation(
      db.insert(aiSuggestion).values({
        aiRunId: row!.id,
        subjectType: "information_item",
        subjectId: crypto.randomUUID(),
        field: "summary",
        proposed: { text: "x" },
        rationale: "   ",
      }),
    );
    expect(v.constraint).toBe("ai_suggestion_states_its_reasoning");
  });
});
