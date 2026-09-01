import "server-only";

/**
 * The only file that calls a model.
 *
 * Everything else asks for a profile and gets back text plus a recorded run.
 * That is what makes "which model wrote this, what did it cost, and was it
 * allowed to see this input" answerable by reading one file rather than
 * auditing every call site.
 *
 * Three things are refused here, before any request leaves the process:
 *
 *   1. **Restricted input.** Checked in TypeScript *and* by a CHECK on
 *      `ai_run` — but the CHECK can only refuse the record, and by the time a
 *      row is being written the send has already happened. This is the one
 *      that has to be first.
 *   2. **A budget that is already spent.** Checked before the call, from
 *      recorded spend, so the ceiling is a ceiling rather than a report.
 *   3. **An unconfigured gateway.** Loudly, naming the variable.
 */

import { generateText, embed, APICallError, gateway, RetryError } from "ai";
import { xai } from "@ai-sdk/xai";
import { toJSONSchema, ZodError, type ZodType } from "zod";
import { ApiError } from "@/server/http/responses";
import { integrityHash } from "@/server/core/hash";
import { aiBudgets, modelFor, type ModelProfile } from "@/server/core/config";
import type { DataClass, AiRunKind } from "@/server/contracts/enums";

export type GenerateInput = {
  profile: ModelProfile;
  kind: AiRunKind;
  prompt: string;
  system?: string;
  /** The highest classification present in `prompt`. Defaults to the safest
   *  reading, not the most convenient one. */
  dataClass?: DataClass;
  maxOutputTokens?: number;
  /** A bounded override for an unusually large, still server-side generation.
   * Briefing editions need more time than chat replies, but may never exceed
   * the function-level timeout. */
  timeoutMs?: number;
  /** Cost attribution in the gateway's own dashboards. */
  tags?: string[];
  /** Give Grok access to its server-side live X search tool for this call. */
  xSearch?: boolean;
};

export type GenerateOutput = {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  inputHash: string;
  costUsd: number;
};

export type StructuredGenerateOutput<T> = GenerateOutput & { output: T };

/** Classifications that may never be sent to a model, mirroring the CHECK on
 *  `ai_run`. Duplicated deliberately: the database refuses the record, this
 *  refuses the request. */
const NEVER_SENT: readonly DataClass[] = ["restricted", "secret"];

/** Explicit provider limits rather than AI SDK defaults. A bounded retry is
 * enough for transient Gateway failures; the durable briefing job owns any
 * later stage retry so a model request is never multiplied uncontrollably. */
const AI_GENERATION_TIMEOUT_MS = 45_000;
const AI_GENERATION_RETRIES = 1;
const AI_EMBEDDING_TIMEOUT_MS = 20_000;
const AI_EMBEDDING_RETRIES = 1;

export function assertSendable(dataClass: DataClass): void {
  if (NEVER_SENT.includes(dataClass)) {
    throw new ApiError(
      "FORBIDDEN",
      `Material classified "${dataClass}" may never be sent to a model.`,
    );
  }
}

/** Everything the module needs to know about recorded spend, injected so the
 *  guard is testable without a gateway or a clock. */
export type SpendReader = (since: Date) => Promise<number>;

export async function assertWithinBudget(spendSince: SpendReader): Promise<void> {
  const { daily, monthly } = aiBudgets();
  const now = Date.now();

  if (daily !== undefined) {
    const spent = await spendSince(new Date(now - 24 * 60 * 60 * 1000));
    if (spent >= daily) {
      throw new ApiError(
        "RATE_LIMITED",
        `The daily AI budget of $${daily} is exhausted ($${spent.toFixed(2)} spent).`,
      );
    }
  }

  if (monthly !== undefined) {
    const spent = await spendSince(new Date(now - 30 * 24 * 60 * 60 * 1000));
    if (spent >= monthly) {
      throw new ApiError(
        "RATE_LIMITED",
        `The monthly AI budget of $${monthly} is exhausted ($${spent.toFixed(2)} spent).`,
      );
    }
  }
}

/**
 * One text generation.
 *
 * Deliberately does NOT write `ai_run` — `server/modules/ai/service.ts` does,
 * inside its own transaction, because the run and whatever it produced must
 * commit together. This function's job ends at "the model answered".
 */
export async function generate(input: GenerateInput): Promise<GenerateOutput> {
  assertSendable(input.dataClass ?? "public");

  const model = modelFor(input.profile);
  const startedAt = Date.now();
  const timeoutMs = input.timeoutMs ?? AI_GENERATION_TIMEOUT_MS;

  let decoded: unknown;
  try {
    const result = model.startsWith("xai/")
      ? await generateText({
          model: xai.responses(model.slice("xai/".length)),
          system: input.system,
          prompt: input.prompt,
          maxOutputTokens: input.maxOutputTokens,
          timeout: timeoutMs,
          maxRetries: AI_GENERATION_RETRIES,
          /* The provider tool is implemented by xAI, not by our server. The
             installed AI SDK 6 types predate provider-executed tools, while
             the xAI provider exposes the correct runtime contract. */
          tools: input.xSearch ? ({ x_search: xai.tools.xSearch() } as never) : undefined,
        })
      : await generateText({
          model: gateway(model),
          system: input.system,
          prompt: input.prompt,
          maxOutputTokens: input.maxOutputTokens,
          timeout: timeoutMs,
          maxRetries: AI_GENERATION_RETRIES,
          providerOptions: {
            gateway: {
              tags: input.tags ?? [`kind:${input.kind}`],
              only: model.startsWith("anthropic/") ? ["anthropic"] : ["openai"],
              disallowPromptTraining: true,
            },
          },
        });

    const inputTokens = result.usage?.inputTokens ?? null;
    const outputTokens = result.usage?.outputTokens ?? null;

    return {
      text: result.text,
      model,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startedAt,
      inputHash: integrityHash(input.prompt),
      costUsd: await generationCost(
        result.providerMetadata,
        estimateCost(model, inputTokens ?? 0, outputTokens ?? 0),
      ),
    };
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw translateGatewayError(cause, model);
  }
}

/** A schema-validated generation for automation. A malformed response throws
 * before the editorial pipeline can create a publication. */
export async function generateStructured<T>(
  input: GenerateInput & { schema: ZodType<T> },
): Promise<StructuredGenerateOutput<T>> {
  assertSendable(input.dataClass ?? "public");
  const model = modelFor(input.profile);
  const timeoutMs = input.timeoutMs ?? AI_GENERATION_TIMEOUT_MS;
  if (model.startsWith("xai/")) {
    throw new ApiError("NOT_IMPLEMENTED", "Structured briefing output must use the configured OpenAI model.");
  }
  const startedAt = Date.now();
  try {
    const result = await generateText({
      model: gateway(model),
      system: input.system,
      /* The Gateway currently returns an empty structured-output event for
         gpt-5-nano. Ask for plain JSON, then validate it locally. This keeps
         the same strict contract — malformed output is rejected — while
         avoiding the provider's incompatible structured-event transport. */
      prompt: `${input.prompt}\n\nReturn one JSON object only, without markdown or commentary. It must validate against this JSON Schema:\n${JSON.stringify(toJSONSchema(input.schema))}`,
      maxOutputTokens: input.maxOutputTokens,
      timeout: timeoutMs,
      maxRetries: AI_GENERATION_RETRIES,
      providerOptions: {
        gateway: {
          tags: input.tags ?? [`kind:${input.kind}`],
          only: model.startsWith("anthropic/") ? ["anthropic"] : ["openai"],
          disallowPromptTraining: true,
        },
        /* GPT-5 otherwise may consume the whole bounded response on hidden
           reasoning before emitting the required JSON object. */
        openai: { reasoningEffort: "minimal", textVerbosity: "low" },
      },
    });
    const inputTokens = result.usage?.inputTokens ?? null;
    const outputTokens = result.usage?.outputTokens ?? null;
    const parsedOutput = parseStructuredJson(input.schema, result.text, result.finishReason, result.rawFinishReason);
    return {
      output: parsedOutput,
      text: result.text,
      model,
      inputTokens,
      outputTokens,
      latencyMs: Date.now() - startedAt,
      inputHash: integrityHash(input.prompt),
      costUsd: await generationCost(
        result.providerMetadata,
        estimateCost(model, inputTokens ?? 0, outputTokens ?? 0),
      ),
    };
  } catch (cause) {
    if (cause instanceof ApiError) throw cause;
    throw translateGatewayError(cause, model);
  }
}

/** Parses plain model JSON into the same runtime contract previously enforced
 * by the SDK's structured transport. No repair or partial acceptance occurs. */
export function parseStructuredJson<T>(
  schema: ZodType<T>,
  text: string,
  finishReason: string,
  rawFinishReason: string | undefined,
): T {
  if (!text.trim()) {
    const rawFinish = rawFinishReason ? `/${rawFinishReason}` : "";
    throw new ApiError("INTERNAL_ERROR", `The model returned an empty JSON response (finish: ${finishReason}${rawFinish}).`);
  }
  let decoded: unknown;
  try {
    /* OpenAI occasionally adds a short sentence outside one complete JSON
     * fence. That wrapper carries no editorial meaning, so accept exactly one
     * fenced payload while still schema-validating the entire JSON object.
     * Unfenced prose is never mined for embedded JSON. */
    const trimmed = text.trim();
    const fenced = [...trimmed.matchAll(/```(?:json)?\s*\n([\s\S]*?)\n?```/gi)];
    const payload = fenced.length === 1 ? fenced[0]?.[1] : trimmed;
    decoded = JSON.parse(payload);
  } catch {
    const rawFinish = rawFinishReason ? `/${rawFinishReason}` : "";
    throw new ApiError(
      "VALIDATION_ERROR",
      `The model response was not valid JSON (finish: ${finishReason}${rawFinish}).`,
    );
  }
  try {
    return schema.parse(decoded);
  } catch (cause) {
    const rawFinish = rawFinishReason ? `/${rawFinishReason}` : "";
    const detail = cause instanceof ZodError
      ? cause.issues.slice(0, 4).map((issue) => `${issue.path.join(".") || "root"}: ${issue.message}`).join("; ")
      : "unknown schema validation error";
    throw new ApiError(
      "VALIDATION_ERROR",
      `The model JSON did not satisfy the structured contract (finish: ${finishReason}${rawFinish}; ${detail}).`,
    );
  }
}

/**
 * One embedding.
 *
 * The dimension is not asserted here — it is asserted by the database, where
 * `vector(1536)` refuses anything else outright. A length check in TypeScript
 * would only tell us the same thing later and less reliably.
 */
export async function embedText(text: string): Promise<{
  embedding: number[];
  model: string;
  inputTokens: number;
  inputHash: string;
  costUsd: number;
}> {
  const model = modelFor("embedding");
  try {
    const result = await embed({
      model: gateway.embeddingModel(model),
      value: text,
      abortSignal: AbortSignal.timeout(AI_EMBEDDING_TIMEOUT_MS),
      maxRetries: AI_EMBEDDING_RETRIES,
      providerOptions: {
        gateway: { only: ["openai"], tags: ["feature:embedding"], disallowPromptTraining: true },
      },
    });
    const inputTokens = result.usage?.tokens ?? Math.ceil(text.length / 4);
    return {
      embedding: result.embedding,
      model,
      inputTokens,
      inputHash: integrityHash(text),
      costUsd: await generationCost(
        result.providerMetadata,
        estimateCost(model, inputTokens, 0),
      ),
    };
  } catch (cause) {
    throw translateGatewayError(cause, model);
  }
}

/** Prefer the Gateway ledger's exact amount; fall back to a conservative
 * token estimate if the generation detail has not propagated yet. */
export async function generationCost(metadata: unknown, fallback: number): Promise<number> {
  const generationId = (
    metadata as { gateway?: { generationId?: unknown; generation_id?: unknown } } | undefined
  )?.gateway;
  const id = generationId?.generationId ?? generationId?.generation_id;
  if (typeof id === "string" && id.startsWith("gen_")) {
    try {
      return (await gateway.getGenerationInfo({ id })).totalCost;
    } catch {
      // The ledger can briefly lag the response. The estimate still enforces a ceiling.
    }
  }
  return fallback;
}

export function estimateCost(model: string, inputTokens: number, outputTokens: number): number {
  const rates = model === "xai/grok-4.3"
    ? { input: 1.25, output: 2.5 }
    : model === "xai/grok-4.6"
      ? { input: 2, output: 6 }
    : model === "anthropic/claude-haiku-4.5"
    ? { input: 1, output: 5 }
    : model === "anthropic/claude-sonnet-5"
      ? { input: 3, output: 15 }
      : model === "openai/gpt-5-nano"
        ? { input: 0.05, output: 0.4 }
        : model === "openai/gpt-5-mini"
          ? { input: 0.25, output: 2 }
      : model === "openai/text-embedding-3-small"
        ? { input: 0.02, output: 0 }
        : { input: 5, output: 25 };
  return (inputTokens * rates.input + outputTokens * rates.output) / 1_000_000;
}

/**
 * Turns a gateway failure into something a caller can act on, without
 * forwarding the provider's message.
 *
 * A provider error frequently echoes the prompt back. Passing it through to an
 * API response is how the input — which may be an unpublished claim under
 * review — ends up in a client's error log.
 */
function translateGatewayError(cause: unknown, model: string): ApiError {
  const statusCode = gatewayStatusCode(cause);
  if (statusCode === null) {
    const failureType = cause instanceof Error ? cause.name : "UnknownError";
    return new ApiError("INTERNAL_ERROR", `The model call to ${model} failed (${failureType}).`);
  }
  switch (statusCode) {
    case 402:
      return new ApiError("RATE_LIMITED", "The AI Gateway budget has been reached.");
    case 429:
      return new ApiError("RATE_LIMITED", "The AI Gateway is rate limiting this project.");
    case 400:
      /* Most often a model slug the gateway does not recognise — see the
         note on MODEL_PROFILES about verifying slugs at provisioning. */
      return new ApiError(
        "INTERNAL_ERROR",
        `The gateway rejected the request for "${model}". Check the slug against gateway.getAvailableModels().`,
      );
    case 503:
      return new ApiError("INTERNAL_ERROR", "The AI Gateway is temporarily unavailable.");
    default:
      return new ApiError("INTERNAL_ERROR", `The model call to ${model} failed.`);
  }
}

function gatewayStatusCode(cause: unknown): number | null {
  if (APICallError.isInstance(cause)) return cause.statusCode ?? null;
  if (RetryError.isInstance(cause)) return gatewayStatusCode(cause.lastError);
  if (cause && typeof cause === "object" && "statusCode" in cause) {
    const statusCode = (cause as { statusCode?: unknown }).statusCode;
    return typeof statusCode === "number" ? statusCode : null;
  }
  return null;
}
