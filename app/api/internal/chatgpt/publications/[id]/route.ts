import { handler } from "@/server/http/handler";
import { notFound, ok } from "@/server/http/responses";
import { requireChatgptAutomationSecret } from "@/server/http/internal-guard";
import { publications } from "@/server/modules/publications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/**
 * One record, by whichever identifier the caller happens to hold.
 *
 * A composer working outside the repository knows a `publicId` or a
 * `canonicalStoryId`, never an internal uuid, and the question it asks here is
 * "does this developing story already exist" — so both resolve, and a miss is a
 * 404 rather than a silent empty result that would read as "safe to create".
 */
export const GET = handler(async (request, _ctx, route: { params: Promise<{ id: string }> }) => {
  requireChatgptAutomationSecret(request);
  const { id } = await route.params;
  const store = publications();
  const found = await store.resolveEditorialTarget({ publicId: id }).catch(() => null)
    ?? await store.resolveEditorialTarget({ canonicalStoryId: id }).catch(() => null);
  if (!found) throw notFound("Publication");
  return ok(found);
});
