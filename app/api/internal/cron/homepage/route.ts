import { handler } from "@/server/http/handler";
import { requireCron } from "@/server/http/internal-guard";
import { ok } from "@/server/http/responses";
import { ensureHomepageEdition } from "@/server/modules/homepage";

/**
 * The daily homepage edition.
 *
 * `ensureEdition` is idempotent per (date, override revision), so a retried
 * cron tick returns the existing snapshot rather than composing a second one.
 * The external briefing ingest calls the same function after a successful
 * publish, which is what puts a 07:00 edition on the front page at 07:00
 * instead of at the next tick.
 *
 * ⚠️ This route is **not scheduled.** `vercel.json` carries four cron entries
 * and none of them is this path, so nothing calls it in Production — it is a
 * route with no trigger. That makes the external-publish hook the only builder
 * of a homepage edition, and it means a manual `GET` here (with the cron
 * secret) is currently the only way to rebuild the front page out of band.
 * Adding the schedule is an owner decision, not an oversight to fix in
 * passing: a cron entry is a recurring production job, and `AGENTS.md` says
 * those are added only when asked.
 *
 * The three route declarations below are spelled in the house style on
 * purpose. `tests/briefing-runtime.test.ts` matches `export const runtime =
 * "nodejs";` with the spaces, and this file previously wrote `runtime='nodejs'`
 * — a real Node declaration the guard could not see, which is the worst of
 * both: the route behaved correctly and the test that exists to prove it
 * failed anyway.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 60;

export const GET = handler(async (request) => {
  requireCron(request);
  const edition = await ensureHomepageEdition();
  return ok({ editionDate: edition.editionDate, revision: edition.revision });
});
