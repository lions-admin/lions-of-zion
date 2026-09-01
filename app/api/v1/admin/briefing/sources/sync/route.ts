import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { requirePublicMutationEnvironment } from "@/server/core/public-mutation-guard";
import { syncBriefingSourceCatalog } from "@/server/modules/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (request) => {
  const actor = requireActor(request);
  requirePublicMutationEnvironment();
  return ok(await syncBriefingSourceCatalog(actor));
});
