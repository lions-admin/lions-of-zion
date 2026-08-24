import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { itemEvidenceLinks } from "@/server/modules/assessments";

/**
 * Transparency, not a decision: what verdicts the confirmed evidence
 * currently supports, and why — the same reasoning `canAssignVerdict()`
 * freezes onto an assessment at write time, available before anyone writes one.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = handler(async (_request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  return ok(await itemEvidenceLinks().eligibility(id));
});
