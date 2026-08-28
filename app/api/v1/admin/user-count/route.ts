import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { registeredUserCount } from "@/server/modules/public-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async () => ok({ registeredUsers: await registeredUserCount() }));
