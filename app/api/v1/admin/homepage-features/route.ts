import { z } from "zod";
import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { requirePublicMutationEnvironment } from "@/server/core/public-mutation-guard";
import { publications } from "@/server/modules/publications";
import { expirePublicPublicationCache } from "@/server/core/publication-cache";

const bodySchema = z.object({ slot: z.number().int().min(1).max(3), publicationId: z.uuid().nullable() });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  return ok({ features: await publications().homepageFeatures() });
});

export const PUT = handler(async (request) => {
  const actor = requireActor(request);
  requirePublicMutationEnvironment();
  const input = await parseBody(request, bodySchema);
  await publications().setHomepageFeature(input.slot, input.publicationId, actor);
  expirePublicPublicationCache();
  return ok(input);
});
