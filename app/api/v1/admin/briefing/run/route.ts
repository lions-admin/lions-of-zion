import { z } from "zod";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { enqueueEditorialPipeline } from "@/server/modules/briefing/jobs";
import { briefing } from "@/server/modules/briefing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const bodySchema = z.object({
  resumePausedEdition: z.literal(true).optional(),
  forceFullRerun: z.literal(true).optional(),
}).refine((body) => body.resumePausedEdition || body.forceFullRerun, {
  message: "An explicit briefing action is required.",
});

export const POST = handler(async (request) => {
  const actor = requireActor(request);
  const body = await request.clone().text();
  if (body) {
    const parsed = bodySchema.parse(JSON.parse(body));
    if (parsed.resumePausedEdition) return ok(await briefing().resumePausedEdition(actor));
    if (parsed.forceFullRerun) {
      return ok(await enqueueEditorialPipeline(new Date(), { force: true, regenerateCompleted: true }));
    }
  }
  const pipeline = await enqueueEditorialPipeline(new Date(), { force: true });
  return ok(pipeline);
});
