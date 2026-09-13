import { handler, parseQuery } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { opsTaskListQuerySchema } from "@/server/contracts/ops-tasks";
import { requireActor } from "@/server/core/auth/actor";
import { opsTasks } from "@/server/modules/ops-tasks";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  const query = parseQuery(request, opsTaskListQuerySchema);
  return ok(await opsTasks().list(query));
});
