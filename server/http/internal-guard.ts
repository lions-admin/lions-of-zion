import "server-only";

/**
 * Guards routes nothing outside Vercel's own infrastructure should be able to
 * call: cron ticks and internal triggers.
 *
 * Cron and everything else are deliberately different secrets. Vercel signs
 * every cron invocation with `Authorization: Bearer $CRON_SECRET` on its own,
 * the moment the env var exists — there is nothing to configure beyond
 * setting it. `INTERNAL_API_SECRET` covers routes Vercel does not sign for
 * you (manual internal triggers, workflow callbacks); reusing one secret for
 * both would mean rotating either one silently breaks the other.
 *
 * A third caller class needs its own secret for the same reason: an external
 * composer (an out-of-repo script or Action posting a Daily Brief edition) is
 * neither Vercel nor an internal Next.js-to-Next.js call, so it cannot use
 * `CRON_SECRET` (Vercel-signed, never handed to a caller) or
 * `INTERNAL_API_SECRET` (rotating it to respond to this new, less-trusted
 * caller class would silently break every other internal trigger sharing it).
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { ApiError } from "./responses";
import {
  codexBriefingImportSecret,
  cronSecret,
  editorialUpdateIngestSecret,
  externalBriefingIngestSecret,
  internalApiSecret,
} from "@/server/core/config";

export function requireCron(request: Request): void {
  const expected = cronSecret();
  const header = request.headers.get("authorization");
  if (!expected || header !== `Bearer ${expected}`) {
    throw new ApiError("UNAUTHENTICATED", "This route is invoked by Vercel Cron only.");
  }
}

export function requireInternalSecret(request: Request): void {
  const header = request.headers.get("x-internal-secret");
  if (header !== internalApiSecret()) {
    throw new ApiError("UNAUTHENTICATED", "This route requires the internal secret.");
  }
}

export function requireExternalBriefingSecret(request: Request): void {
  const supplied = request.headers.get("x-external-briefing-secret") ?? "";
  const expected = externalBriefingIngestSecret();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  if (!supplied || !timingSafeEqual(suppliedHash, expectedHash)) {
    throw new ApiError("UNAUTHENTICATED", "This route requires the external briefing ingest secret.");
  }
}

/** GitHub's delivery branch holds this secret, not the application's broader
 * internal guard, so it can be rotated without granting unrelated powers. */
export function requireEditorialUpdateIngestSecret(request: Request): void {
  const supplied = request.headers.get("x-editorial-update-secret") ?? "";
  const expected = editorialUpdateIngestSecret();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  if (!supplied || !timingSafeEqual(suppliedHash, expectedHash)) {
    throw new ApiError("UNAUTHENTICATED", "This route requires the editorial update ingest secret.");
  }
}

export function requireCodexBriefingImportSecret(request: Request): void {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = codexBriefingImportSecret();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  if (!supplied || !timingSafeEqual(suppliedHash, expectedHash)) {
    throw new ApiError("UNAUTHENTICATED", "This route requires the Codex briefing import secret.");
  }
}
