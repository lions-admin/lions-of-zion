import { handler, parseBody, parseQuery } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { listSuggestionsSchema, requestSuggestionSchema } from "@/server/contracts/ai";
import { requireActor } from "@/server/core/auth/actor";
import { ai } from "@/server/modules/ai";

/**
 * Asking a model for a proposal, and reading the proposals awaiting review.
 *
 * POST here never changes the subject entity — it records a run and files a
 * suggestion. The entity moves only when someone accepts it at
 * `/api/v1/ai/suggestions/[id]`.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = handler(async (request) => {
  const filters = parseQuery(request, listSuggestionsSchema);
  return ok({ suggestions: await ai().list(filters) });
});

export const POST = handler(async (request) => {
  const actor = requireActor(request);
  const input = await parseBody(request, requestSuggestionSchema);
  const suggestion = await ai().suggest(input, actor);
  return created(suggestion, `/api/v1/ai/suggestions/${suggestion.id}`);
});
