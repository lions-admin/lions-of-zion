import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { z } from "zod";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const paramsSchema = z.object({ id: z.uuid() });

export const POST = handler(async (request, ctx, { params }: { params: Promise<Record<string, string>> }) => {
  const actor = requireActor(request);
  const { id } = paramsSchema.parse(await params);
  return ok(await adminConsole().archiveChatThread(id, actor, ctx.requestId));
});
