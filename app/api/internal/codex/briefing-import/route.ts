import { handler } from "@/server/http/handler";
import { requireCodexBriefingImportSecret } from "@/server/http/internal-guard";
import { ApiError } from "@/server/http/responses";

/** Authenticated tombstone for the retired scheduled briefing importer. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (request) => {
  requireCodexBriefingImportSecret(request);
  throw new ApiError("PRECONDITION_FAILED", "Legacy editorial publishing is retired. Use the whole-site editorial update delivery path.");
});
