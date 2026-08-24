import { handler, parseBody, parseQuery } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { createEvidenceSchema, listEvidenceSchema } from "@/server/contracts/evidence";
import { requireActor } from "@/server/core/auth/actor";
import { evidenceItems } from "@/server/modules/evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  const filters = parseQuery(request, listEvidenceSchema);
  const page = await evidenceItems().list(filters);
  const next = page.length === filters.limit ? page.at(-1)?.createdAt.toISOString() : undefined;
  return ok({ evidence: page, ...(next ? { nextCursor: next } : {}) });
});

/** For evidence a human enters directly rather than a connector finding —
 *  the `manual` source kind exists for exactly this. */
export const POST = handler(async (request, ctx) => {
  const actor = requireActor(request);
  const input = await parseBody(request, createEvidenceSchema);
  const row = await evidenceItems().create(input, actor, ctx.requestId);
  return created(row, `/api/v1/evidence/${row.id}`);
});
