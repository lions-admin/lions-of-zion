import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { opsAgent } from "@/server/modules/ops-agent";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  return ok(opsAgent(request).capabilities());
});
