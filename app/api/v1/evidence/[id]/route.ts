import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { evidenceItems } from "@/server/modules/evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* Evidence carries a classification, and the RLS policy that filters on it
   does not apply to application traffic yet (the app connects as owner).
   Until real sessions exist, this route is the only thing standing between an
   anonymous caller and internal material. */
export const GET = handler(async (request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  requireActor(request);
  const { id } = await params;
  return ok(await evidenceItems().get(id));
});
