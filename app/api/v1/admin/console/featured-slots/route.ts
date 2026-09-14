import { z } from "zod";
import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { requirePublicMutationEnvironment } from "@/server/core/public-mutation-guard";
import { featuredSlotNameSchema } from "@/server/contracts/featured-slots";
import { featuredSlots } from "@/server/modules/featured-slots";

/**
 * The six evergreen homepage slots with no `homepage_placement` area of
 * their own — October 7 testimony/documentation, Courage & service, Fallen,
 * History & context primary/secondary. See `server/modules/featured-slots`.
 */
const bodySchema = z.discriminatedUnion("action", [
  z.object({
    slot: featuredSlotNameSchema,
    action: z.literal("pin"),
    key: z.string().trim().min(1).max(200),
    reason: z.string().trim().min(1).max(2000),
    expires: z.string().date().optional(),
  }),
  z.object({
    slot: featuredSlotNameSchema,
    action: z.literal("release"),
  }),
]);

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  return ok({ slots: await featuredSlots().state() });
});

export const PUT = handler(async (request) => {
  const actor = requireActor(request);
  requirePublicMutationEnvironment();
  const input = await parseBody(request, bodySchema);
  if (input.action === "pin") {
    await featuredSlots().pin(input.slot, input.key, input.reason, input.expires, actor.label);
  } else {
    await featuredSlots().release(input.slot);
  }
  return ok(input);
});
