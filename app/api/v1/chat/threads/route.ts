import { handler, parseBody } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { createThreadSchema } from "@/server/contracts/chat";
import { requireActor } from "@/server/core/auth/actor";
import { chat } from "@/server/modules/chat";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => ok({ threads: await chat().listThreads() }));

export const POST = handler(async (request) => {
  const actor = requireActor(request);
  const input = await parseBody(request, createThreadSchema);
  const thread = await chat().createThread(input, actor);
  return created(thread, `/api/v1/chat/threads/${thread.id}`);
});
