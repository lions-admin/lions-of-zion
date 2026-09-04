import { handler, parseQuery } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { listSourceFetchesSchema, sourceFetchesQuerySchema } from "@/server/contracts/admin-console";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request, ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  requireActor(request);
  const { limit } = parseQuery(request, sourceFetchesQuerySchema);
  return ok(await adminConsole().sourceFetches(listSourceFetchesSchema.parse({ id, limit })));
});
