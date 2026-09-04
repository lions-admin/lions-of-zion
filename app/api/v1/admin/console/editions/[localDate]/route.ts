import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { listEditionDrilldownSchema } from "@/server/contracts/admin-console";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request, ctx, { params }: { params: Promise<{ localDate: string }> }) => {
  const { localDate } = await params;
  requireActor(request);
  const input = listEditionDrilldownSchema.parse({ localDate });
  return ok(await adminConsole().editionDrilldown(input));
});
