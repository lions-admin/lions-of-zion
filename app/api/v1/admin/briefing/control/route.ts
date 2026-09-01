import { z } from "zod";
import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { briefing } from "@/server/modules/briefing";

const bodySchema = z.object({ automaticPublicationPaused: z.boolean() });

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const PATCH = handler(async (request) => {
  const actor = requireActor(request);
  const body = await parseBody(request, bodySchema);
  await briefing().setAutomaticPublicationPaused(body.automaticPublicationPaused, actor);
  return ok(body);
});
