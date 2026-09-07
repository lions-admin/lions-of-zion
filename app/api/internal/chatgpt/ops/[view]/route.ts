import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireChatgptAutomationSecret } from "@/server/http/internal-guard";
import { chatgptAutomation } from "@/server/modules/chatgpt-automation";
import { chatgptOpsViewSchema } from "@/server/contracts/chatgpt-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The read-only operational views, one route rather than one per view.
 *
 * Each name maps to the console read of the same name — no second
 * implementation, and nothing here that mutates. `CHATGPT_OPS_VIEWS` is the
 * allowlist, so a view is reachable because it was named, never because a path
 * segment happened to match a method.
 */
export const GET = handler(async (request, _ctx, route: { params: Promise<{ view: string }> }) => {
  requireChatgptAutomationSecret(request);
  const { view } = await route.params;
  const parsed = chatgptOpsViewSchema.parse(view);
  return ok(await chatgptAutomation(request).opsView(parsed, request));
});
