import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { briefing } from "@/server/modules/briefing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = handler(async (request, ctx) => {
  const actor = requireActor(request);
  return ok(await briefing().run(actor, ctx.requestId));
});
