import "server-only";

/**
 * AI operations. Owns policy; owns no SQL.
 *
 * The shape that matters here is that **a model never writes to an entity**.
 * Every generation produces two rows — an `ai_run` and an `ai_suggestion` —
 * and the entity changes only when a named human accepts the suggestion,
 * through `recordVersion` with `change_source = 'ai_suggestion_accepted'` and
 * that run's id. There is no other path, and the `entity_version` CHECK
 * (`ai_change_names_its_run`) refuses an AI-attributed version that cannot
 * name the run behind it.
 *
 * The gateway is injected rather than imported so tests exercise the whole
 * pipeline — budget guard, run recording, suggestion lifecycle, acceptance —
 * without credentials and without a network call.
 */

import { eq } from "drizzle-orm";
import { ApiError, notFound } from "@/server/http/responses";
import { recordVersion, setIdentity } from "@/server/core/versioning";
import { writeAudit } from "@/server/core/audit";
import { assertSendable, assertWithinBudget } from "@/server/core/ai/gateway";
import { informationItem } from "@/server/db/schema";
import { aiRepo } from "./repo";
import { findReviewer } from "@/server/modules/assessments";
import { assertHumanReviewer } from "@/server/modules/assessments";
import type { GenerateInput, GenerateOutput } from "@/server/core/ai/gateway";
import type {
  DecideSuggestion,
  ListSuggestions,
  RequestSuggestion,
  SuggestableField,
} from "@/server/contracts/ai";
import type { Actor } from "@/server/core/audit";
import type { AiSuggestion, InformationItem } from "@/server/db/schema";
import type { DataClass } from "@/server/contracts/enums";

type Tx = Parameters<typeof setIdentity>[0];
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };

/** The gateway's surface, as this module needs it. */
export type Generator = (input: GenerateInput) => Promise<GenerateOutput>;

/** What each suggestable field asks the model for. Prompts live in
 *  `prompt_registry` once seeded; these are the fallbacks used when no
 *  version has been activated, so the feature is never silently unavailable. */
const FALLBACK_PROMPTS: Record<SuggestableField, { system: string; instruction: string }> = {
  summary: {
    system:
      "You summarise contested claims for fact-checkers. Be literal. Do not evaluate whether the claim is true — that is a human's job and a separate record.",
    instruction: "Write a two-sentence neutral summary of this claim.",
  },
  topics: {
    system: "You classify claims into subject topics. Return a comma-separated list, nothing else.",
    instruction: "List up to five subject topics for this claim.",
  },
  relation: {
    system:
      "You assess how a piece of evidence bears on a claim. Answer with exactly one of: supports, partially_supports, contradicts, contextualizes — then a blank line, then one sentence of reasoning.",
    instruction: "State how this evidence bears on the claim.",
  },
  translation: {
    system: "You translate faithfully, preserving hedging and attribution exactly as written.",
    instruction: "Translate the following.",
  },
};

/**
 * Records one chat turn's model call against an open transaction.
 *
 * Chat needs to write an `ai_run` inside its own transaction, alongside the
 * message it belongs to. This exists so it can do that through the AI
 * module's public surface rather than reaching into its repository — a
 * conversation's cost belongs in the same ledger as every other model call,
 * and there should be exactly one way to put it there.
 */
export async function recordChatRun(
  tx: unknown,
  input: {
    model: string;
    inputTokens: number | null;
    outputTokens: number | null;
    latencyMs: number;
    actor: Actor;
  },
): Promise<string> {
  const row = await aiRepo(tx).recordRun({
    kind: "chat",
    model: input.model,
    modelProfile: "reasoning",
    inputTokens: input.inputTokens,
    outputTokens: input.outputTokens,
    latencyMs: input.latencyMs,
    status: "ok",
    /* Chat answers from the search projection, which never contains
       restricted material — `isIndexable()` refuses it a row at all. */
    inputDataClass: "public",
    actorLabel: input.actor.label,
    actorUserId: input.actor.userId ?? null,
  });
  return row.id;
}

export function aiService(db: unknown, opts: { generate?: Generator } = {}) {
  const run = db as unknown as Runner;
  const repo = aiRepo(db);

  /** Refuses before the request leaves the process, not after. */
  async function guard(dataClass: DataClass): Promise<void> {
    assertSendable(dataClass);
    await assertWithinBudget((since) => repo.spendSince(since));
  }

  function requireGenerator(): Generator {
    if (!opts.generate) {
      throw new ApiError(
        "NOT_IMPLEMENTED",
        "No AI gateway is configured. Set AI_GATEWAY_API_KEY, or run `vercel env pull` for an OIDC token.",
      );
    }
    return opts.generate;
  }

  return {
    /**
     * Asks the model for one suggestion, records the run, and files the
     * proposal for review. Writes nothing to the subject entity.
     */
    async suggest(input: RequestSuggestion, actor: Actor): Promise<AiSuggestion> {
      const generate = requireGenerator();

      const subject = await loadSubject(db, input);
      if (!subject) throw notFound("Subject");

      await guard(subject.dataClass);

      const prompt = await repo.activePrompt(`suggest.${input.field}`);
      const fallback = FALLBACK_PROMPTS[input.field];
      const system = prompt?.template ?? fallback.system;

      const output = await generate({
        profile: input.field === "translation" ? "translation" : "fast",
        kind: input.field === "translation" ? "translate" : "summarize",
        system,
        prompt: `${fallback.instruction}\n\n${subject.text}`,
        dataClass: subject.dataClass,
        tags: [`field:${input.field}`, `entity:${input.subjectType}`],
      });

      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const txRepo = aiRepo(tx);

        const recorded = await txRepo.recordRun({
          kind: input.field === "translation" ? "translate" : "summarize",
          model: output.model,
          modelProfile: input.field === "translation" ? "translation" : "fast",
          promptId: prompt?.id ?? null,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          inputTokens: output.inputTokens,
          outputTokens: output.outputTokens,
          latencyMs: output.latencyMs,
          status: "ok",
          inputHash: output.inputHash,
          inputDataClass: subject.dataClass,
          actorLabel: actor.label,
          actorUserId: actor.userId ?? null,
        });

        /* One live proposal per field: an older pending one is superseded
           rather than left to compete with this. */
        await txRepo.supersedePending(input.subjectType, input.subjectId, input.field);

        const suggestion = await txRepo.insertSuggestion({
          aiRunId: recorded.id,
          subjectType: input.subjectType,
          subjectId: input.subjectId,
          field: input.field,
          proposed: { text: output.text },
          baseline: { text: subject.baseline },
          rationale: `Generated by ${output.model} from prompt "${prompt?.slug ?? `fallback:${input.field}`}".`,
        });

        await writeAudit(tx as never, {
          actor,
          action: "ai_suggestion.created",
          entityType: input.subjectType,
          entityId: input.subjectId,
          after: { suggestionId: suggestion.id, field: input.field },
        });

        return suggestion;
      });
    },

    list: (filters: ListSuggestions) => repo.listSuggestions(filters),

    async get(id: string): Promise<AiSuggestion> {
      const row = await repo.suggestionById(id);
      if (!row) throw notFound("Suggestion");
      return row;
    },

    /**
     * A human decides. Accepting is the only thing that writes to the entity,
     * and it does so through the ordinary versioned path — so an AI-derived
     * change is a normal version with an unusual `change_source`, not a
     * special case anything downstream has to know about.
     */
    async decide(id: string, input: DecideSuggestion, actor: Actor): Promise<AiSuggestion> {
      if (!actor.userId) {
        throw new ApiError(
          "FORBIDDEN",
          "Deciding on an AI suggestion requires a known reviewer identity, not just a label.",
        );
      }

      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const txRepo = aiRepo(tx);

        const suggestion = await txRepo.suggestionById(id);
        if (!suggestion) throw notFound("Suggestion");
        if (suggestion.status !== "pending") {
          throw new ApiError(
            "PRECONDITION_FAILED",
            `This suggestion is already "${suggestion.status}" and cannot be decided again.`,
          );
        }

        const reviewer = await findReviewer(tx, actor.userId!);
        if (!reviewer) throw new ApiError("VALIDATION_ERROR", "Unknown reviewer identity.");
        /* No author to compare against: a model is not an app_user, so the
           only rule that applies is that a machine cannot approve itself. */
        assertHumanReviewer(reviewer, null);

        const decided = await txRepo.decideSuggestion(
          id,
          input.decision,
          actor.userId!,
          input.note ?? null,
        );

        if (input.decision === "accepted") {
          await applyToEntity(tx, suggestion, actor);
        }

        await writeAudit(tx as never, {
          actor,
          action: `ai_suggestion.${input.decision}`,
          entityType: suggestion.subjectType,
          entityId: suggestion.subjectId,
          before: suggestion,
          after: decided,
        });

        return decided;
      });
    },

    /** Exposed for the health endpoint and the budget tests. */
    spendSince: (since: Date) => repo.spendSince(since),
  };
}

/**
 * Writes an accepted suggestion into its entity.
 *
 * Only `summary` is applied automatically. `topics` and `relation` propose
 * links that carry their own review semantics (a confirmed evidence edge is a
 * human act with a rationale, per Phase 4), and quietly writing them here
 * would route around that. They are recorded as accepted so the decision is
 * on the record, and left for the reviewer to apply through the proper
 * endpoint.
 */
async function applyToEntity(tx: unknown, suggestion: AiSuggestion, actor: Actor): Promise<void> {
  if (suggestion.field !== "summary" || suggestion.subjectType !== "information_item") return;

  const proposed = (suggestion.proposed as { text?: unknown }).text;
  if (typeof proposed !== "string" || !proposed.trim()) return;

  const d = tx as {
    select: (f?: unknown) => {
      from: (t: unknown) => { where: (w: unknown) => { limit: (n: number) => Promise<InformationItem[]> } };
    };
    update: (t: unknown) => { set: (v: unknown) => { where: (w: unknown) => { returning: () => Promise<InformationItem[]> } } };
  };

  const [before] = await d
    .select()
    .from(informationItem)
    .where(eq(informationItem.id, suggestion.subjectId))
    .limit(1);
  if (!before) return;

  const [after] = await d
    .update(informationItem)
    .set({ summary: proposed.trim(), updatedAt: new Date() })
    .where(eq(informationItem.id, suggestion.subjectId))
    .returning();

  await recordVersion(tx as Tx, informationItem, after as never, {
    entityType: "information_item",
    entityId: suggestion.subjectId,
    actor,
    changeSummary: `Accepted AI suggestion for ${suggestion.field}`,
    changeSource: "ai_suggestion_accepted",
    aiRunId: suggestion.aiRunId,
    before,
  });
}

/** The text a suggestion is generated from, plus the classification that
 *  decides whether it may be sent at all. */
async function loadSubject(
  db: unknown,
  input: RequestSuggestion,
): Promise<{ text: string; baseline: string | null; dataClass: DataClass } | undefined> {
  if (input.subjectType !== "information_item") return undefined;

  const d = db as {
    select: (f?: unknown) => {
      from: (t: unknown) => { where: (w: unknown) => { limit: (n: number) => Promise<InformationItem[]> } };
    };
  };
  const [item] = await d
    .select()
    .from(informationItem)
    .where(eq(informationItem.id, input.subjectId))
    .limit(1);
  if (!item) return undefined;

  return {
    text: `${item.title}\n\n${item.canonicalText}`,
    baseline: item.summary,
    /* Items carry no classification of their own; evidence does. An item is
       public by construction — it is the thing being published about. */
    dataClass: "public",
  };
}

export type AiService = ReturnType<typeof aiService>;
