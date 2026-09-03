import { codexBriefingImportSchema } from "@/server/contracts/codex-briefing-import";
import { handler } from "@/server/http/handler";
import { requireCodexBriefingImportSecret } from "@/server/http/internal-guard";
import { ApiError, created } from "@/server/http/responses";
import { receiveCodexBriefing } from "@/server/modules/briefing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = handler(async (request, ctx) => {
  requireCodexBriefingImportSecret(request);
  const text = await request.text();
  if (text.length > 1_000_000) throw new ApiError("VALIDATION_ERROR", "The Codex briefing import exceeds the 1 MB request limit.");
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new ApiError("VALIDATION_ERROR", "The Codex briefing import must be valid JSON.");
  }
  const parsed = codexBriefingImportSchema.safeParse(json);
  if (!parsed.success) {
    throw new ApiError("VALIDATION_ERROR", "The Codex briefing import does not match the required schema.", parsed.error.flatten());
  }
  const input = parsed.data;
  const result = await receiveCodexBriefing(
    input,
    { label: "service:codex", userId: null },
    ctx.requestId,
  );
  return created(result);
});
