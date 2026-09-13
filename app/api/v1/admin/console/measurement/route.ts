import { handler, parseQuery } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { measurementConsoleQuerySchema } from "@/server/contracts/measurement";
import { measurement } from "@/server/modules/measurement";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (request) => {
  requireActor(request);
  const query = parseQuery(request, measurementConsoleQuerySchema);
  const { screen, ...filters } = query;
  return ok(await measurement().consoleScreen(screen, filters));
});
