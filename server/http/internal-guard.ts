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
import { CHATGPT_ACTOR_LABEL } from "@/server/contracts/chatgpt-automation";
import { registerActor } from "@/server/core/auth/actor";
import {
  chatgptAutomationSecret,
  codexBriefingImportSecret,
  cronSecret,
  editorialUpdateIngestSecret,
  externalBriefingIngestSecret,
  internalApiSecret,
  opsReportSecret,
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

/**
 * The scheduled ChatGPT editor.
 *
 * Its own header and its own secret, for the reason this file exists: the
 * automation reads site state and operates on it, which is a different power
 * from delivering a package, and one must be rotatable without the other.
 *
 * It registers the actor as well as authenticating, so a route can use the
 * ordinary `requireActor(request)` re-check and every audit row the automation
 * writes carries `service:chatgpt-editorial` rather than a human's label. The
 * label is fixed here and never read from the request: a caller that could
 * name its own actor could file its actions under someone else.
 */
export function requireChatgptAutomationSecret(request: Request): void {
  const supplied = request.headers.get("x-chatgpt-automation-secret") ?? "";
  const expected = chatgptAutomationSecret();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  if (!supplied || !timingSafeEqual(suppliedHash, expectedHash)) {
    throw new ApiError("UNAUTHENTICATED", "This route requires the ChatGPT automation secret.");
  }
  registerActor(request, { label: CHATGPT_ACTOR_LABEL, userId: null });
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

/**
 * The task-board reporters.
 *
 * Every agent hook, the git post-commit hook, the CI job and the reporter CLI
 * post here with one secret that can do exactly one thing: append to the
 * operations board. It is deliberately not any of the secrets above — those
 * deliver packages or operate on editorial state, and a reporter lives on a
 * developer machine where it can leak.
 *
 * The actor label is fixed here, never read from the request, for the same
 * reason as the ChatGPT guard: a caller that could name its own actor could
 * file its events under someone else. Which *agent* reported is a field in
 * the report body, validated against the contract's enum, and recorded on
 * the task — not on the actor.
 */
export function requireOpsReportSecret(request: Request): void {
  const supplied = request.headers.get("x-ops-report-secret") ?? "";
  const expected = opsReportSecret();
  const suppliedHash = createHash("sha256").update(supplied).digest();
  const expectedHash = createHash("sha256").update(expected).digest();
  if (!supplied || !timingSafeEqual(suppliedHash, expectedHash)) {
    throw new ApiError("UNAUTHENTICATED", "This route requires the operations report secret.");
  }
  registerActor(request, { label: "service:ops-reporter", userId: null });
}
