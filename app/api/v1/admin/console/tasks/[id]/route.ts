import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { opsTaskPatchSchema } from "@/server/contracts/ops-tasks";
import { requireActor } from "@/server/core/auth/actor";
import { opsTasks } from "@/server/modules/ops-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Route = { params: Promise<{ id: string }> };

export const GET = handler(async (request, _ctx, route: Route) => {
  requireActor(request);
  const { id } = await route.params;
  return ok(await opsTasks().detail(id));
});

/** A human's status override with a note; audited as `ops_task.patch`. */
export const PATCH = handler(async (request, ctx, route: Route) => {
  const actor = requireActor(request);
  const { id } = await route.params;
  const patch = await parseBody(request, opsTaskPatchSchema);
  return ok(await opsTasks().patch(id, patch, actor, ctx.requestId));
});
