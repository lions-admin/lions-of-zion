import { handler, parseQuery } from "@/server/http/handler";
import { listEditorialSchema } from "@/server/contracts/admin-console";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  const input = new URL(request.url).search ? parseQuery(request, listEditorialSchema) : undefined;
  return ok(await adminConsole().editorial(input));
});
