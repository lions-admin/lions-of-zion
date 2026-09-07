import { handler, parseQuery } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireChatgptAutomationSecret } from "@/server/http/internal-guard";
import { listPublicationsSchema } from "@/server/contracts/publication";
import { publications } from "@/server/modules/publications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** The list read, on the same contract the admin console uses. */
export const GET = handler(async request => {
  requireChatgptAutomationSecret(request);
  const filters = parseQuery(request, listPublicationsSchema);
  return ok(await publications().list(filters));
});
