import { handler, parseBody } from "@/server/http/handler";
import { created, ok } from "@/server/http/responses";
import { createSourceFamilySchema } from "@/server/contracts/source";
import { sourceFamilies } from "@/server/modules/sources";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => ok({ sourceFamilies: await sourceFamilies().list() }));

export const POST = handler(async (request) => {
  const input = await parseBody(request, createSourceFamilySchema);
  const row = await sourceFamilies().create(input);
  return created(row, `/api/v1/source-families/${row.id}`);
});
