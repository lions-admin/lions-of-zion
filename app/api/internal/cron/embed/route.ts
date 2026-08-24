import { handler } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireCron } from "@/server/http/internal-guard";
import { search } from "@/server/modules/search";

/**
 * Works through the embedding backlog.
 *
 * The backlog is `indexed_content_hash IS DISTINCT FROM content_hash` — a
 * comparison, not a queue — so this cron is safe to run at any cadence, safe
 * to run concurrently with itself, and self-healing after a crash: a document
 * whose embedding was never stored simply stays in the backlog.
 *
 * Until Phase 6 wires the AI Gateway there is no embedder, and this reports
 * `skipped` with the backlog size rather than failing. A scheduled job that
 * alarms on a deliberate, known state is one people learn to ignore.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const GET = handler(async (request) => {
  requireCron(request);
  return ok(await search().processEmbeddingBacklog());
});
