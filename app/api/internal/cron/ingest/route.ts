import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireCron } from "@/server/http/internal-guard";
import { CONNECTORS, activeSources, ingest, shouldCollectGoogleSource } from "@/server/modules/sources";
import type { Actor } from "@/server/core/audit";

/**
 * Walks every active source of every registered connector kind and runs it.
 *
 * One route rather than one per source: `vercel.json` only has to know about
 * this schedule, and adding a source is an INSERT, never a new cron entry.
 * A failure on one source is caught and reported per-source — one dead feed
 * must not take the rest of the run down with it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

const CRON_ACTOR: Actor = { label: "cron:ingest", userId: null };

export const GET = handler(async (request) => {
  requireCron(request);

  const results: Array<{ sourceId: string; status: string; evidenceCreated?: number; error?: string }> = [];

  for (const connector of CONNECTORS) {
    const due = await activeSources(connector.kind);
    for (const src of due) {
      if (connector.kind === "google_search") {
        if (!(await shouldCollectGoogleSource(src.id))) {
          results.push({ sourceId: src.id, status: "skipped: Google query limit or already collected today" });
          continue;
        }
      }
      try {
        const result = await ingest(src.id, CRON_ACTOR);
        results.push({
          sourceId: src.id,
          status: result.fetch.status,
          evidenceCreated: result.evidenceCreated,
        });
      } catch (cause) {
        results.push({
          sourceId: src.id,
          status: "failed",
          error: cause instanceof Error ? cause.message : String(cause),
        });
      }
    }
  }

  return ok({ ranAt: new Date().toISOString(), results });
});
