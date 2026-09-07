import { handler, parseQuery } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireChatgptAutomationSecret } from "@/server/http/internal-guard";
import { chatgptContextQuerySchema } from "@/server/contracts/chatgpt-automation";
import { chatgptAutomation } from "@/server/modules/chatgpt-automation";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * The first call a scheduled editorial run makes.
 *
 * One bounded payload rather than a dozen round trips: today's Israel-local
 * edition date, the homepage as it currently stands, the live records with
 * enough about each to avoid duplicating a developing story, the recent runs,
 * and the warnings a human would notice at a glance. The expensive console
 * reads are opt-in through `?include=` so the default stays one cheap call.
 */
export const GET = handler(async (request, ctx) => {
  requireChatgptAutomationSecret(request);
  const query = parseQuery(request, chatgptContextQuerySchema);
  void ctx;
  return ok(await chatgptAutomation(request).editorialContext(query, request));
});
