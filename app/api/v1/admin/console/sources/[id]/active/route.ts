import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { setSourceActiveSchema } from "@/server/contracts/admin-console";
import { requireActor } from "@/server/core/auth/actor";
import { requirePublicMutationEnvironment } from "@/server/core/public-mutation-guard";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Enabling a source changes what the public briefing collects from the next
   tick, so it is held to the same environment guard as an editorial edit. */
export const PATCH = handler(async (request, ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  requirePublicMutationEnvironment();
  const input = await parseBody(request, setSourceActiveSchema);
  return ok(await adminConsole().setSourceActive(id, input, actor, ctx.requestId));
});
