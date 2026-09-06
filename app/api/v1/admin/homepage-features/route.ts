import { z } from "zod";
import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { requirePublicMutationEnvironment } from "@/server/core/public-mutation-guard";
import { publications } from "@/server/modules/publications";
import { expirePublicPublicationCache } from "@/server/core/publication-cache";

const bodySchema = z.object({ area: z.enum(["news", "fakeResistance", "people"]), position: z.enum(["lead", "secondary"]), publicationId: z.uuid().nullable() });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  return ok({ placements: await publications().homepagePlacements() });
});

export const PUT = handler(async (request) => {
  const actor = requireActor(request);
  requirePublicMutationEnvironment();
  const input = await parseBody(request, bodySchema);
  await publications().setHomepagePlacement(input.area, input.position, input.publicationId, actor);
  expirePublicPublicationCache();
  return ok(input);
});
