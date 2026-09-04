import "server-only";

/**
 * The operations agent. Owns policy; owns no SQL and calls no model directly.
 *
 * A turn is: redeem the confirmations the operator decided on → ask the model,
 * with the tool set → record every tool the loop actually ran → record the run
 * → return the new transcript entries.
 *
 * Two rules shape everything here.
 *
 * **An irreversible tool is never executed in the turn the model asks for
 * it.** Confirmed tools are registered with an `execute` that records a
 * pending confirmation and returns a marker; the model sees "confirmation
 * required", tells the operator what it wants to do, and the operation
 * happens on a later turn against a signed token. The model is therefore
 * structurally incapable of publishing, deleting or pausing anything on its
 * own — not discouraged from it by a prompt.
 *
 * **Every executed tool writes an audit row.** Reads included. The console
 * hands an assistant real authority over a live site, and "what did it
 * actually do" has to be answerable from `audit_log` alone, without trusting
 * the transcript the assistant itself produced.
 *
 * `run` is injected, like the generator elsewhere in this codebase, so the
 * whole turn — the confirmation protocol, the audit rows, the recorded spend —
 * is testable against a scripted model with no gateway and no network.
 */

import { randomUUID } from "node:crypto";
import { tool as defineTool, jsonSchema } from "ai";
import type { ModelMessage, ToolSet } from "ai";
import { z } from "zod";
import { ApiError } from "@/server/http/responses";
import { writeAudit } from "@/server/core/audit";
import { integrityHash } from "@/server/core/hash";
import { recordOpsConsoleRun } from "@/server/modules/ai";
import {
  opsChatRequestSchema,
  opsChatResponseSchema,
  type OpsCapabilities,
  type OpsChatRequest,
  type OpsChatResponse,
  type OpsConfirmation,
  type OpsMessage,
} from "@/server/contracts/admin-console";
import { modelFor } from "@/server/core/config";
import { issueConfirmation, verifyConfirmation } from "./confirmations";
import { OPS_TOOL_DEFINITIONS, opsTool, type OpsToolDefinition } from "./tools";
import type { OpsToolContext } from "./context";
import type { Actor } from "@/server/core/audit";
import type { ToolGenerateOutput, ToolGenerateInput } from "@/server/core/ai/gateway";

/** The model call, injected so a test can script the loop. */
export type ToolLoopRunner = (input: ToolGenerateInput) => Promise<ToolGenerateOutput>;

type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };

/**
 * What the assistant is told about itself.
 *
 * Written as constraints rather than encouragement, because the failure that
 * matters is not a rude answer — it is an assistant that reports the pipeline
 * is healthy without having looked.
 */
export const OPS_SYSTEM_PROMPT = [
  "You are the assistant inside the LIONS OF ZION OPERATIONS CONSOLE.",
  "You are speaking to the site's owner and sole administrator, inside an authenticated admin session.",
  "",
  "What this system is: an information-model pipeline that collects sources, attaches evidence to items,",
  "and publishes a daily edition. The pipeline runs in seven stages — collect, enrich, cluster, triage,",
  "draft, quality, publish — as durable queued jobs. The edition serves three jobs, in priority order:",
  "refute anti-Israel narratives (recorded as Narrative Watch), publish one regional geopolitical Daily",
  "Brief, and publish one interesting Israel story. Quality checks are never skipped; a publish gate in",
  "the database enforces that, not a reviewer.",
  "",
  "How you work:",
  "- You act only through your tools. You have no database access, no shell, and no way to read a secret.",
  "- Never state the state of the system from memory or inference. Call a get_* tool and answer from what",
  "  it returned. If a tool fails, say so plainly rather than guessing what it would have said.",
  "- Some tools are irreversible. Those will not run when you call them: you will get back",
  "  'confirmation_required', and the operator is shown exactly what you proposed and decides. Tell them",
  "  plainly what you want to do and why, and wait. Do not call the same tool again in a loop.",
  "- Before proposing anything irreversible, check the current state first. Do not propose republishing",
  "  an article that is already published, or retrying a job that has already completed.",
  "- Never reveal or guess a secret, key, token or connection string. You cannot read them, and no",
  "  legitimate request needs you to.",
  "- Answer in the language the operator writes in. Hebrew questions get Hebrew answers, English gets",
  "  English. Technical identifiers, statuses and tool names stay as they are in either language.",
  "- Be brief. Numbers and specifics, not reassurance.",
].join("\n");

/** The marker a confirmed tool returns to the model instead of running. */
const CONFIRMATION_REQUIRED = "confirmation_required";

const message = (role: OpsMessage["role"], content: string, extra: Partial<OpsMessage> = {}): OpsMessage => ({
  id: randomUUID(),
  role,
  content,
  createdAt: new Date().toISOString(),
  ...extra,
});

/** The model's own error text can echo the input back; the class cannot. */
const errorClass = (cause: unknown): string =>
  cause instanceof ApiError ? cause.code : cause instanceof Error ? cause.name : "UnknownError";

const errorMessageFor = (cause: unknown): string =>
  cause instanceof ApiError ? cause.message : "The operation failed.";

export function opsAgentService(
  database: unknown,
  ctx: OpsToolContext,
  options: { run: ToolLoopRunner; now?: () => Date },
) {
  const run = database as Runner;
  const now = options.now ?? (() => new Date());

  /** One audit row per executed tool, in its own transaction so a later
   *  failure in the loop cannot erase the record of what already ran. */
  async function audit(input: {
    tool: OpsToolDefinition;
    args: Record<string, unknown>;
    actor: Actor;
    requestId?: string;
    outcome: "ran" | "failed" | "declined";
    detail: unknown;
  }): Promise<void> {
    const suffix = input.outcome === "ran" ? "" : `.${input.outcome}`;
    await run.transaction(async (tx) => {
      await writeAudit(tx as never, {
        actor: input.actor,
        action: `ops.tool.${input.tool.name}${suffix}`,
        entityType: input.tool.entityType,
        entityId: input.tool.entityId(input.args),
        before: input.args,
        after: input.detail,
        requestId: input.requestId ?? null,
      });
    });
  }

  async function execute(
    tool: OpsToolDefinition,
    args: Record<string, unknown>,
    actor: Actor,
    requestId?: string,
  ): Promise<{ ok: boolean; summary: string; result: unknown }> {
    try {
      const result = await tool.run(ctx, args, actor, requestId);
      const summary = tool.summarise(result);
      await audit({ tool, args, actor, requestId, outcome: "ran", detail: { ok: true, summary } });
      return { ok: true, summary, result };
    } catch (cause) {
      const summary = `${errorClass(cause)}: ${errorMessageFor(cause)}`;
      await audit({ tool, args, actor, requestId, outcome: "failed", detail: { ok: false, error: errorClass(cause) } });
      return { ok: false, summary, result: { error: errorClass(cause), message: errorMessageFor(cause) } };
    }
  }

  return {
    capabilities(): OpsCapabilities {
      return {
        model: modelFor("opsConsole"),
        tools: OPS_TOOL_DEFINITIONS.map((tool) => ({
          name: tool.name,
          label: tool.label,
          description: tool.description,
          requiresConfirmation: tool.requiresConfirmation,
        })),
      };
    },

    async turn(input: OpsChatRequest, actor: Actor, requestId?: string): Promise<OpsChatResponse> {
      const body = opsChatRequestSchema.parse(input);
      const produced: OpsMessage[] = [];
      const pending: OpsConfirmation[] = [];
      let stateChanged = false;

      /* 1. The decisions the operator made on the previous turn's proposals.
            These run before the model is asked anything, so the model's next
            answer is written knowing what actually happened. */
      for (const decision of body.confirmations) {
        const payload = verifyConfirmation({
          token: decision.token,
          id: decision.id,
          actorLabel: actor.label,
          now: now(),
        });
        const tool = opsTool(payload.tool);
        if (!tool) throw new ApiError("VALIDATION_ERROR", "This confirmation names an operation that no longer exists.");

        if (!decision.approved) {
          await audit({ tool, args: payload.args, actor, requestId, outcome: "declined", detail: { approved: false } });
          produced.push(message("tool", `${tool.name} was declined by the operator and did not run.`, {
            toolCalls: [{ id: decision.id, tool: tool.name, args: payload.args, resultSummary: "declined", ok: false }],
          }));
          continue;
        }

        const outcome = await execute(tool, payload.args, actor, requestId);
        stateChanged = stateChanged || outcome.ok;
        produced.push(message("tool", `${tool.name}: ${outcome.summary}`, {
          toolCalls: [{ id: decision.id, tool: tool.name, args: payload.args, resultSummary: outcome.summary, ok: outcome.ok }],
        }));
      }

      /* 2. The tool set handed to the model. A confirmed tool's `execute`
            deliberately performs nothing — it records a proposal. */
      const tools: ToolSet = {};
      for (const definition of OPS_TOOL_DEFINITIONS) {
        tools[definition.name] = defineTool({
          description: definition.description,
          /* `io: "input"` because the model produces the *input* side: two
             tool schemas carry a coercion or a transform, and the output
             shape would ask the model for the already-parsed value. Zod
             refuses to represent a transform at all without it. */
          inputSchema: jsonSchema(
            z.toJSONSchema(definition.input, { io: "input", unrepresentable: "any" }) as Record<string, unknown>,
          ),
          execute: async (args: unknown) => {
            const parsed = (args ?? {}) as Record<string, unknown>;
            if (definition.requiresConfirmation) {
              const issued = issueConfirmation({
                tool: definition.name,
                args: parsed,
                actorLabel: actor.label,
                now: now(),
              });
              pending.push({
                id: issued.id,
                tool: definition.name,
                args: parsed,
                consequence: definition.consequence(parsed),
                target: definition.target(parsed),
                expiresAt: issued.expiresAt.toISOString(),
                token: issued.token,
              });
              return {
                status: CONFIRMATION_REQUIRED,
                id: issued.id,
                consequence: definition.consequence(parsed),
                note: "The operator has been asked. Explain what you propose and stop; do not call this again.",
              };
            }
            const outcome = await execute(definition, parsed, actor, requestId);
            stateChanged = stateChanged || (outcome.ok && !definition.name.startsWith("get_") && definition.name !== "search_audit");
            return outcome.result;
          },
        });
      }

      /* 3. The model. */
      const messages: ModelMessage[] = [
        ...body.history
          .filter((entry) => entry.role !== "tool")
          .map((entry) => ({
            role: entry.role === "assistant" ? ("assistant" as const) : ("user" as const),
            content: entry.content,
          })),
        { role: "user", content: body.message },
      ];

      const result = await options.run({
        profile: "opsConsole",
        kind: "chat",
        system: OPS_SYSTEM_PROMPT,
        messages,
        tools,
        /* Console material is operational state, never public copy, and the
           CHECK on `ai_run` still refuses anything restricted. */
        dataClass: "internal",
      });

      /* 4. The turn's spend, recorded like every other model call here. */
      await run.transaction(async (tx) => {
        await recordOpsConsoleRun(tx, {
          model: result.model,
          inputTokens: result.inputTokens,
          outputTokens: result.outputTokens,
          costUsd: result.costUsd,
          latencyMs: result.latencyMs,
          inputHash: result.inputHash || integrityHash(body.message),
          actor,
        });
      });

      /* 5. The reply, with a chip per tool the loop actually called. */
      const toolCalls = result.steps.map((step) => {
        const definition = opsTool(step.toolName);
        const output = step.result as { status?: string; error?: string } | null;
        return {
          id: step.toolCallId,
          tool: (definition?.name ?? step.toolName) as OpsMessage["toolCalls"] extends undefined ? never : OpsConfirmation["tool"],
          args: (step.args ?? {}) as Record<string, unknown>,
          resultSummary: output?.status === CONFIRMATION_REQUIRED
            ? "awaiting confirmation"
            : definition && output && !output.error
              ? definition.summarise(step.result)
              : output?.error ?? null,
          ok: !output?.error,
        };
      });

      produced.push(message("assistant", result.text, toolCalls.length ? { toolCalls } : {}));

      return opsChatResponseSchema.parse({
        messages: produced,
        pendingConfirmations: pending,
        model: result.model,
        costUsd: result.costUsd,
        latencyMs: result.latencyMs,
        stateChanged,
      });
    },
  };
}

export type OpsAgentService = ReturnType<typeof opsAgentService>;
