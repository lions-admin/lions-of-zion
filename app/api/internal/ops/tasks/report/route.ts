import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireOpsReportSecret } from "@/server/http/internal-guard";
import { opsReportBatchSchema } from "@/server/contracts/ops-tasks";
import { requireActor } from "@/server/core/auth/actor";
import { opsTasks } from "@/server/modules/ops-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A batch of report lines from one reporter. Accepted whole or not at all. */
export const POST = handler(async (request) => {
  requireOpsReportSecret(request);
  const actor = requireActor(request);
  const batch = await parseBody(request, opsReportBatchSchema);
  return ok(await opsTasks().report(batch, actor.label), { status: 202 });
});
