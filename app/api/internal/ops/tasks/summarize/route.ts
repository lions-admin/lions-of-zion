import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireOpsReportSecret } from "@/server/http/internal-guard";
import { opsTaskDigestSchema } from "@/server/contracts/ops-tasks";
import { requireActor } from "@/server/core/auth/actor";
import { opsTasks } from "@/server/modules/ops-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** A session digest; the server writes the Hebrew summary onto the task. */
export const POST = handler(async (request) => {
  requireOpsReportSecret(request);
  const actor = requireActor(request);
  const digest = await parseBody(request, opsTaskDigestSchema);
  return ok({ task: await opsTasks().summarize(digest, actor.label) });
});
