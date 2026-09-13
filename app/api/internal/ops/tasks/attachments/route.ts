import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireOpsReportSecret } from "@/server/http/internal-guard";
import { opsAttachmentUploadSchema } from "@/server/contracts/ops-tasks";
import { requireActor } from "@/server/core/auth/actor";
import { opsTasks } from "@/server/modules/ops-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/** One screenshot or file, base64 in the body, stored under `ops/attachments/`. */
export const POST = handler(async (request) => {
  requireOpsReportSecret(request);
  const actor = requireActor(request);
  const upload = await parseBody(request, opsAttachmentUploadSchema);
  return ok({ attachment: await opsTasks().attach(upload, actor.label) }, { status: 201 });
});
