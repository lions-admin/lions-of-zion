import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireChatgptAutomationSecret } from "@/server/http/internal-guard";
import { chatgptActionRequestSchema } from "@/server/contracts/chatgpt-automation";
import { chatgptAutomation } from "@/server/modules/chatgpt-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

/**
 * One operational action, named by the ops registry's own tool name.
 *
 * The guard runs before the body is parsed, so an unauthenticated caller never
 * reaches the schema. Capability is decided in the service, not here and not in
 * the caller's prompt: this route knows how to authenticate and how to
 * serialise, and nothing else.
 */
export const POST = handler(async (request, ctx) => {
  requireChatgptAutomationSecret(request);
  const body = await parseBody(request, chatgptActionRequestSchema);
  return ok(await chatgptAutomation(request).invoke(body.tool, body.args, ctx.requestId));
});
