import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { linkNarrativeItemSchema } from "@/server/contracts/narrative";
import { requireActor } from "@/server/core/auth/actor";
import { narratives } from "@/server/modules/narratives";

/** Links a checked claim into this narrative. The rationale is required:
 *  grouping claims is how a theme gets defined. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const who = requireActor(request);
  const { id } = await params;
  const input = await parseBody(request, linkNarrativeItemSchema);
  await narratives().linkItem(id, input, who);
  return ok({ linked: true, narrativeId: id, itemId: input.itemId });
});
