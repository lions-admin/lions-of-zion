import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { evidenceItems } from "@/server/modules/evidence";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return ok(await evidenceItems().get(id));
});
