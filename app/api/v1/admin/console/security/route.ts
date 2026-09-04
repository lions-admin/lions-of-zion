import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { adminConsole } from "@/server/modules/admin-console";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/* The request travels down so the AI Gateway check can see the OIDC header
   Vercel injects per request rather than into `process.env`. */
export const GET = handler(async (request) => {
  requireActor(request);
  return ok(await adminConsole().security(request));
});
