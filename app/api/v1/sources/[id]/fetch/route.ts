import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireActor } from "@/server/core/auth/actor";
import { ingest } from "@/server/modules/sources";

/**
 * Runs a source's connector right now, outside the cron schedule.
 *
 * The same `ingestSource` path the cron uses — this is not a preview or a
 * dry run, it writes a real `source_fetch` row and any evidence it finds.
 * Useful for standing a new source up without waiting for the next tick.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const POST = handler(async (request, _ctx, { params }: { params: Promise<{ id: string }> }) => {
  const { id } = await params;
  const actor = requireActor(request);
  return ok(await ingest(id, actor));
});
