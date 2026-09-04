import { handler, parseQuery } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { listQualityChecksSchema } from "@/server/contracts/admin-console";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  const input = parseQuery(request, listQualityChecksSchema);
  return ok(await adminConsole().qualityChecks(input));
});
