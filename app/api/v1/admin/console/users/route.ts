import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";
import { registeredPublicUsers } from "@/server/modules/public-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  const [users, publicReaders] = await Promise.all([
    adminConsole().users(),
    registeredPublicUsers(),
  ]);
  return ok({
    ...users,
    registeredPublicUsers: publicReaders.length,
    publicReaders,
  });
});
