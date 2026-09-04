import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { rollbackPublicationSchema } from "@/server/contracts/admin-console";
import { requireActor } from "@/server/core/auth/actor";
import { requirePublicMutationEnvironment } from "@/server/core/public-mutation-guard";
import { expirePublicPublicationCache } from "@/server/core/publication-cache";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (request, ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  requirePublicMutationEnvironment();
  const input = await parseBody(request, rollbackPublicationSchema);
  const result = await adminConsole().rollbackPublication(id, input, actor, ctx.requestId);
  expirePublicPublicationCache();
  return ok(result);
});
