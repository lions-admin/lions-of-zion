import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireCron } from "@/server/http/internal-guard";
import { briefing } from "@/server/modules/briefing";
import type { Actor } from "@/server/core/audit";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_ACTOR: Actor = { label: "cron:briefing", userId: null };

export const GET = handler(async (request, ctx) => {
  requireCron(request);
  return ok(await briefing().runScheduled(CRON_ACTOR, ctx.requestId));
});
