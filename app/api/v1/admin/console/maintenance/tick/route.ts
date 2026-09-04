import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = handler(async (request, ctx) => {
  const actor = requireActor(request);
  return ok(await adminConsole().runMaintenanceTick(actor, ctx.requestId));
});
