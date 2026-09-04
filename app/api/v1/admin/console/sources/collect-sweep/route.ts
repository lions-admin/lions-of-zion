import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

/** A plain POST with no body: the sweep takes no arguments, exactly as the
 *  internal cron ingest route runs. Reversible by nature — the sources it
 *  enqueues are the cron's own cadence decisions. */
export const POST = handler(async (request, ctx) => {
  const actor = requireActor(request);
  return ok(await adminConsole().runCollectionSweep(actor, ctx.requestId));
});
