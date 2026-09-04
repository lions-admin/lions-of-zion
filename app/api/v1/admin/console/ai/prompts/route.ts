import { handler, parseBody } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { insertPromptVersionSchema } from "@/server/contracts/admin-console";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  return ok(await adminConsole().prompts());
});

export const POST = handler(async (request, ctx) => {
  const actor = requireActor(request);
  const input = await parseBody(request, insertPromptVersionSchema);
  const result = await adminConsole().insertPromptVersion(input, actor, ctx.requestId);
  return created(result, `/api/v1/admin/console/ai/prompts`);
});
