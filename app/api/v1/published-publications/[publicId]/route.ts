import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { publications } from "@/server/modules/publications";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_request, _ctx, { params }: { params: Promise<{ publicId: string }> }) => {
  const { publicId } = await params;
  return ok(await publications().getBriefingPublicDetail(publicId));
});
