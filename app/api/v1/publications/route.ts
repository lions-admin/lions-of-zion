import { handler, parseBody, parseQuery } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { createPublicationSchema, listPublicationsSchema } from "@/server/contracts/publication";
import { requireActor } from "@/server/core/auth/actor";
import { publications } from "@/server/modules/publications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  const filters = parseQuery(request, listPublicationsSchema);
  const page = await publications().list(filters);
  const next = page.length === filters.limit ? page.at(-1)?.createdAt.toISOString() : undefined;
  return ok({ publications: page, ...(next ? { nextCursor: next } : {}) });
});

export const POST = handler(async (request, ctx) => {
  const actor = requireActor(request);
  const input = await parseBody(request, createPublicationSchema);
  const row = await publications().create(input, actor, ctx.requestId);
  return created(row, `/api/v1/publications/${row.id}`);
});
