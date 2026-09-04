import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { activatePromptVersionSchema } from "@/server/contracts/admin-console";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * Activating a prompt version changes what every future model call sees. The
 * console UI wires an explicit confirmation in front of this route; the
 * `ops.prompt.activated` audit row records whoever passed it.
 */
export const POST = handler(async (request, ctx) => {
  const actor = requireActor(request);
  const input = await parseBody(request, activatePromptVersionSchema);
  return ok(await adminConsole().activatePromptVersion(input, actor, ctx.requestId));
});
