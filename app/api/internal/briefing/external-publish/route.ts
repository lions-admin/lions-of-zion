import { handler, parseBody } from "@/server/http/handler";
import { ok } from "@/server/http/responses";
import { requireExternalBriefingSecret } from "@/server/http/internal-guard";
import { externalBriefingPackageSchema } from "@/server/contracts/external-briefing";
import { externalBriefingPublish } from "@/server/modules/briefing";

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
 * pinned service signature this route codes against.
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
  return ok(result);
});
