import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { transitionPublicationSchema } from "@/server/contracts/publication";
import { requireActor } from "@/server/core/auth/actor";
import { publications } from "@/server/modules/publications";

/** Its own endpoint rather than a field on PATCH, for the same reason items
 *  have one: publishing is a different kind of act from fixing a typo. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (request, ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  const input = await parseBody(request, transitionPublicationSchema);
  return ok(await publications().transition(id, input, actor, ctx.requestId));
});
