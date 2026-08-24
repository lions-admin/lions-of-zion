import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { triageReportSchema } from "@/server/contracts/report";
import { requireActor } from "@/server/core/auth/actor";
import { reports } from "@/server/modules/reports";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  const input = await parseBody(request, triageReportSchema);
  return ok(await reports().triage(id, input, actor));
});
