import { handler, parseBody, parseQuery } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { createSourceSchema, listSourcesSchema } from "@/server/contracts/source";
import { requireActor } from "@/server/core/auth/actor";
import { sources } from "@/server/modules/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  const filters = parseQuery(request, listSourcesSchema);
  const page = await sources().list(filters);
  const next = page.length === filters.limit ? page.at(-1)?.createdAt.toISOString() : undefined;
  return ok({ sources: page, ...(next ? { nextCursor: next } : {}) });
});

export const POST = handler(async (request, ctx) => {
  const actor = requireActor(request);
  const input = await parseBody(request, createSourceSchema);
  const row = await sources().create(input, actor, ctx.requestId);
  return created(row, `/api/v1/sources/${row.id}`);
});
