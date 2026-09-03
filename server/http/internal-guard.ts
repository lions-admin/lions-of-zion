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
 */

import { createHash, timingSafeEqual } from "node:crypto";
import { ApiError } from "./responses";
import { codexBriefingImportSecret, cronSecret, internalApiSecret } from "@/server/core/config";

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

export function requireCodexBriefingImportSecret(request: Request): void {
  const supplied = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const expected = codexBriefingImportSecret();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  if (!supplied || !timingSafeEqual(suppliedHash, expectedHash)) {
    throw new ApiError("UNAUTHENTICATED", "This route requires the Codex briefing import secret.");
  }
}
