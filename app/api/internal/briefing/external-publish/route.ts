import { handler } from "@/server/http/handler";
import { ApiError } from "@/server/http/responses";
import { requireExternalBriefingSecret } from "@/server/http/internal-guard";

/** Retained authenticated tombstone for old delivery clients. Historical
 * publications remain readable at their existing public URLs. */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (request) => {
  requireExternalBriefingSecret(request);
  throw new ApiError("PRECONDITION_FAILED", "Legacy editorial publishing is retired. Use the whole-site editorial update delivery path.");
});
