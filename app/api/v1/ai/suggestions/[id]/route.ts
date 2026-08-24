import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { decideSuggestionSchema } from "@/server/contracts/ai";
import { requireActor } from "@/server/core/auth/actor";
import { ai } from "@/server/modules/ai";

/**
 * The human approval gate.
 *
 * POST with `accepted` is the only path by which a model's output reaches an
 * entity, and it writes through the ordinary versioned path with
 * `change_source = 'ai_suggestion_accepted'` and the run's id attached.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return ok(await ai().get(id));
});

export const POST = handler(async (request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  const input = await parseBody(request, decideSuggestionSchema);
  return ok(await ai().decide(id, input, actor));
});
