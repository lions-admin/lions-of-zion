import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { drainOutboxSchema } from "@/server/contracts/admin-console";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = handler(async (request, ctx) => {
  const actor = requireActor(request);
  /* The body is optional: a bare POST drains with the drain's own default
     ceiling, the same way the internal cron route runs with no arguments. */
  const raw = await request.json().catch(() => ({}));
  const input = drainOutboxSchema.parse(raw);
  return ok(await adminConsole().drainOutbox(input, actor, ctx.requestId));
});
