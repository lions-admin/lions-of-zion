import { z } from "zod";
import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { briefing } from "@/server/modules/briefing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const querySchema = z.object({ date: z.string().date().optional() });

export const GET = handler(async (request) => {
  requireActor(request);
  const query = querySchema.parse(Object.fromEntries(new URL(request.url).searchParams));
  return ok(await briefing().draftPreview(query.date));
});
