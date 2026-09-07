import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";
import { registeredUserCount } from "@/server/modules/public-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  const [users, registeredPublicUsers] = await Promise.all([
    adminConsole().users(),
    registeredUserCount(),
  ]);
  return ok({ ...users, registeredPublicUsers });
});
