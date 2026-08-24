import { handler, parseBody } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { postMessageSchema } from "@/server/contracts/chat";
import { requireActor } from "@/server/core/auth/actor";
import { chat } from "@/server/modules/chat";

/**
 * The transcript, and one turn.
 *
 * POST is deliberately **not** a token stream. A streamed answer has to be
 * persisted after the fact, and the citation guarantee — that every cited
 * document was actually retrieved — is enforced when the answer is written.
 * Streaming first and validating afterwards means the reader has already seen
 * a fabricated citation by the time the database refuses it.
 *
 * The retrieval that constrains the answer happens before the model is asked
 * and is recorded first, so a client that wants progressive output can poll
 * the tool run while the turn completes. Token streaming can be added on top
 * of this without weakening the guarantee; it could not be added underneath.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 120;

export const GET = handler(async (_request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return ok({ messages: await chat().transcript(id) });
});

export const POST = handler(async (request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  const input = await parseBody(request, postMessageSchema);
  const message = await chat().ask(id, input, actor);
  return created(message, `/api/v1/chat/threads/${id}/messages`);
});
