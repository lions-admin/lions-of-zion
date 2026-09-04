import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { opsChatRequestSchema } from "@/server/contracts/admin-console";
import { opsAgent } from "@/server/modules/ops-agent";

/** A tool loop makes several model round-trips and runs real operations
 *  between them; the gateway ceiling stays well under this. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = handler(async (request, ctx) => {
  const actor = requireActor(request);
  const body = await parseBody(request, opsChatRequestSchema);
  return ok(await opsAgent(request).turn(body, actor, ctx.requestId));
});
