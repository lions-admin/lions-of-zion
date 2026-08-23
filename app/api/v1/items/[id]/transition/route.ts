import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { transitionItemSchema } from "@/server/contracts/item";
import { requireActor } from "@/server/core/auth/actor";
import { items } from "@/server/modules/items";

/**
 * Status moves are their own endpoint rather than a field on PATCH.
 *
 * A transition is a different kind of act from an edit: it has its own
 * legality rules, its own audit line, and its own reason. Folding it into a
 * general update makes "publish this" indistinguishable from "fix a typo".
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (request, ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  const input = await parseBody(request, transitionItemSchema);
  return ok(await items().transition(id, input, actor, ctx.requestId));
});
