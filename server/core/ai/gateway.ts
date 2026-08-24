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

import { generateText, embed, APICallError } from "ai";
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
  /** Cost attribution in the gateway's own dashboards. */
  tags?: string[];
};

export type GenerateOutput = {
  text: string;
  model: string;
  inputTokens: number | null;
  outputTokens: number | null;
  latencyMs: number;
  inputHash: string;
};

/** Classifications that may never be sent to a model, mirroring the CHECK on
 *  `ai_run`. Duplicated deliberately: the database refuses the record, this
 *  refuses the request. */
const NEVER_SENT: readonly DataClass[] = ["restricted", "secret"];

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

  try {
    const result = await generateText({
      model,
      system: input.system,
      prompt: input.prompt,
      maxOutputTokens: input.maxOutputTokens,
      providerOptions: {
        gateway: { tags: input.tags ?? [`kind:${input.kind}`] },
      },
    });

    return {
      text: result.text,
      model,
      inputTokens: result.usage?.inputTokens ?? null,
      outputTokens: result.usage?.outputTokens ?? null,
      latencyMs: Date.now() - startedAt,
      inputHash: integrityHash(input.prompt),
    };
  } catch (cause) {
    throw translateGatewayError(cause, model);
  }
}

/**
 * One embedding.
 *
 * The dimension is not asserted here — it is asserted by the database, where
 * `vector(1536)` refuses anything else outright. A length check in TypeScript
 * would only tell us the same thing later and less reliably.
 */
export async function embedText(text: string): Promise<{ embedding: number[]; model: string }> {
  const model = modelFor("embedding");
  try {
    const result = await embed({ model, value: text });
    return { embedding: result.embedding, model };
  } catch (cause) {
    throw translateGatewayError(cause, model);
  }
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
  if (!APICallError.isInstance(cause)) {
    return new ApiError("INTERNAL_ERROR", `The model call to ${model} failed.`);
  }
  switch (cause.statusCode) {
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
