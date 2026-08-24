import { handler, parseBody } from "@/server/http/handler";
import { created } from "@/server/http/responses";
import { recordObservationSchema } from "@/server/contracts/narrative";
import { requireActor } from "@/server/core/auth/actor";
import { narratives } from "@/server/modules/narratives";

/**
 * Records one sighting of this narrative in the wild.
 *
 * `evidenceId` is required and always will be. Every count downstream — the
 * family tally, the amplification reading — is only as trustworthy as the
 * fact that each row points at something a person can go and look at.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = handler(async (request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const who = requireActor(request);
  const { id } = await params;
  const input = await parseBody(request, recordObservationSchema);
  return created(await narratives().observe(id, input, who), `/api/v1/narratives/${id}`);
});
