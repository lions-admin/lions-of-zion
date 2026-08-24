import { handler, parseBody, parseQuery } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { createNarrativeSchema, listNarrativesSchema } from "@/server/contracts/narrative";
import { requireActor } from "@/server/core/auth/actor";
import { narratives } from "@/server/modules/narratives";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  const filters = parseQuery(request, listNarrativesSchema);
  const page = await narratives().listNarratives(filters);
  const next = page.length === filters.limit ? page.at(-1)?.createdAt.toISOString() : undefined;
  return ok({ narratives: page, ...(next ? { nextCursor: next } : {}) });
});

export const POST = handler(async (request, ctx) => {
  const who = requireActor(request);
  const input = await parseBody(request, createNarrativeSchema);
  const row = await narratives().createNarrative(input, who, ctx.requestId);
  return created(row, `/api/v1/narratives/${row.id}`);
});
