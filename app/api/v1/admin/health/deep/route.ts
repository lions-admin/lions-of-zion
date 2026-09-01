import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { deepHealth } from "@/server/core/deep-health";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = handler(async (request) => {
  requireActor(request);
  return ok(await deepHealth(request));
});
