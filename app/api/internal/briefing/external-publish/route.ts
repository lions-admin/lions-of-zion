import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireExternalBriefingSecret } from "@/server/http/internal-guard";
import { externalBriefingPackageSchema } from "@/server/contracts/external-briefing";
import { externalBriefingPublish } from "@/server/modules/briefing";
import { ensureHomepageEdition } from "@/server/modules/homepage";

/**
 * Ingest endpoint for an externally composed Daily Brief edition.
 *
 * The caller is an out-of-repo composer (a scheduled GitHub Action, an
 * operator script) — not Vercel, not an internal Next.js-to-Next.js call —
 * so it authenticates with its own shared secret via
 * `requireExternalBriefingSecret`, checked before the body is even parsed:
 * an unauthenticated caller should never learn anything about why its
 * package would or wouldn't validate.
 *
 * This route is deliberately thin. It parses, calls
 * `externalBriefingPublish().publish(...)` through the module's `index.ts`
 * (the ESLint layering rule forbids reaching into
 * `server/modules/briefing/service.ts` or `repo.ts` directly), and
 * serializes the result. Every quality gate, the idempotency check on
 * `runId`, and the publish transaction itself live in the service — see
 * `server/contracts/external-briefing.ts` for the wire contract and the
 * pinned service signature this route codes against. The one thing it does
 * beyond that is refresh the homepage snapshot after a successful publish,
 * which is a derived read-model concern rather than part of the edition, and
 * is therefore best-effort; see the comment at the call.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = handler(async (request, ctx) => {
  requireExternalBriefingSecret(request);

  const pkg = await parseBody(request, externalBriefingPackageSchema);

  /* Namespaced like the codebase's other machine actors ("service:...",
     "anonymous:..."): "external:" marks this as an out-of-repo composer, and
     `pkg.composer` (free text, never trusted for authorization — the secret
     already did that) keeps the audit trail readable across composers. */
  const actor = { label: `external:${pkg.composer}`, userId: null };

  const result = await externalBriefingPublish().publish(pkg, actor, ctx.requestId);

  /* The edition is live but the homepage still shows yesterday's, because the
     homepage edition is a snapshot built from published rows rather than a
     query over them. Rebuilding it here is what makes a 07:00 submission
     visible on the front page at 07:00 instead of at the next cron tick.
     Deliberately after the publish and deliberately non-fatal: the publication
     transaction has already committed, so turning a snapshot failure into a
     4xx/5xx would tell the composer its edition did not land when it did — and
     invite a resend that only replays the ledger.

     Do NOT read this as "the cron will pick it up". `/api/internal/cron/homepage`
     exists as a route but is **not** in `vercel.json`'s `crons` array, so
     nothing schedules it: after this change, this call is the only thing in
     the system that builds a homepage edition. A failure here therefore
     strands the front page on the previous edition until something calls
     `ensureHomepageEdition()` again, rather than costing one cycle. It stays
     non-fatal anyway — a stale homepage is a smaller harm than telling a
     composer its edition did not land — but the warning below is the only
     signal that it happened, so it names the run. */
  if (result.status === "published") {
    try {
      await ensureHomepageEdition();
    } catch (cause) {
      console.warn(
        `[external-briefing] run ${pkg.runId}: published, but the homepage edition could not be refreshed — `
        + `${cause instanceof Error ? cause.message : String(cause)}`,
      );
    }
  }

  return ok(result);
});
