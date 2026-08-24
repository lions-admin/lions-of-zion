import { handler, parseBody, parseQuery } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { createActorSchema, listActorsSchema } from "@/server/contracts/narrative";
import { requireActor } from "@/server/core/auth/actor";
import { narratives } from "@/server/modules/narratives";

/** Staff-only. Naming someone as a spreader is an allegation before it is a
 *  finding, which is why actors default to the `internal` classification. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  const filters = parseQuery(request, listActorsSchema);
  return ok({ actors: await narratives().listActors(filters) });
});

export const POST = handler(async (request, ctx) => {
  const who = requireActor(request);
  const input = await parseBody(request, createActorSchema);
  const row = await narratives().createActor(input, who, ctx.requestId);
  return created(row, `/api/v1/actors/${row.id}`);
});
