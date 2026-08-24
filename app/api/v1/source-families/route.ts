import { handler, parseBody } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { createSourceFamilySchema } from "@/server/contracts/source";
import { requireActor } from "@/server/core/auth/actor";
import { sourceFamilies } from "@/server/modules/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* How independence is grouped is a description of our own method, and it
   tells an adversary exactly which outlets we treat as one voice. */
export const GET = handler(async (request) => {
  requireActor(request);
  return ok({ sourceFamilies: await sourceFamilies().list() });
});

export const POST = handler(async (request) => {
  requireActor(request);
  const input = await parseBody(request, createSourceFamilySchema);
  const row = await sourceFamilies().create(input);
  return created(row, `/api/v1/source-families/${row.id}`);
});
