import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { retryJobSchema } from "@/server/contracts/admin-console";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (request, ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  const input = await parseBody(request, retryJobSchema);
  return ok(await adminConsole().retryJob(id, input, actor, ctx.requestId));
});
