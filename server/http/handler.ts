import "server-only";

/**
 * The route wrapper.
 *
 * Handlers do three things and no more: parse, call one service, serialize.
 * Anything resembling a policy decision inside a route file is a bug, and the
 * ESLint boundary rules make it a mechanical one — route files may not import
 * `server/db` or a module's internals at all.
 *
 * Every response carries a request id. It is the same id in the log line, the
 * audit row and the error body, which is what turns "it failed for a user
 * yesterday" into one query.
 */

import { ApiError, problem } from "./responses";
import { authenticateAdmin, registerActor } from "@/server/core/auth/actor";
import {
  ADMIN_MUTATIONS,
  bucketFor,
  enforceRateLimit,
  PUBLIC_API_READS,
} from "@/server/core/rate-limit";
import { db, withDatabaseRole, type DatabaseRole } from "@/server/db/client";
import { siteUrl } from "@/server/core/config";
import { briefingLog } from "@/server/core/log";
import { requirePublicMutationEnvironment } from "@/server/core/public-mutation-guard";
import type { ZodType } from "zod";

export type RequestContext = { requestId: string; startedAt: number };

export function requestIdOf(request: Request): string {
  return (
    request.headers.get("x-vercel-id") ??
    request.headers.get("x-request-id") ??
    crypto.randomUUID()
  );
}

/**
 * Wraps a handler with error translation and request-id propagation.
 *
 * An unexpected throw becomes a 500 whose body carries the request id and
 * nothing else. The detail goes to the log, where it belongs; a client that
 * can read a stack trace is a client that can read a file path.
 */
export function handler<T extends unknown[]>(
  fn: (request: Request, ctx: RequestContext, ...rest: T) => Promise<Response>,
) {
  return async (request: Request, ...rest: T): Promise<Response> => {
    const ctx: RequestContext = { requestId: requestIdOf(request), startedAt: Date.now() };
    try {
      const access = await accessFor(request);
      const invoke = async () => {
        if (access?.role === "app_public" && request.method === "GET") {
          await enforceRateLimit(db(), bucketFor(request, "public-read"), PUBLIC_API_READS);
        }
        if (access?.role === "app_staff" && !["GET", "HEAD", "OPTIONS"].includes(request.method)) {
          requirePublicMutationEnvironment();
          assertMutationOrigin(request);
          await enforceRateLimit(db(), bucketFor(request, "admin-mutation"), ADMIN_MUTATIONS);
        }
        return fn(request, ctx, ...rest);
      };
      const response = access
        ? await withDatabaseRole(access.role, access.identity, invoke)
        : await invoke();
      response.headers.set("x-request-id", ctx.requestId);
      return response;
    } catch (cause) {
      if (cause instanceof ApiError) {
        briefingLog("warn", "http.request.rejected", { requestId: ctx.requestId }, {
          method: request.method,
          durationMs: Date.now() - ctx.startedAt,
          code: cause.code,
        });
        return problem(cause, ctx.requestId);
      }
      briefingLog("error", "http.request.failed", { requestId: ctx.requestId }, {
        method: request.method,
        durationMs: Date.now() - ctx.startedAt,
        errorClass: cause instanceof Error ? cause.name : "UnknownError",
        errorMessage: cause instanceof Error ? cause.message.slice(0, 500) : "Unknown error",
      });
      return problem(new ApiError("INTERNAL_ERROR", "Something went wrong"), ctx.requestId);
    }
  };
}

function assertMutationOrigin(request: Request): void {
  const origin = request.headers.get("origin");
  const allowed = new Set([new URL(request.url).origin, new URL(siteUrl()).origin]);
  if (!origin || !allowed.has(origin)) {
    throw new ApiError("FORBIDDEN", "The request origin is not allowed for an administrator mutation.");
  }
  const fetchSite = request.headers.get("sec-fetch-site");
  if (fetchSite && fetchSite !== "same-origin" && fetchSite !== "same-site") {
    throw new ApiError("FORBIDDEN", "Cross-site administrator mutations are not allowed.");
  }
}

type Access = { role: DatabaseRole; identity: string };

export const PUBLIC_V1 = [
  ["GET", /^\/api\/v1\/search$/],
  ["GET", /^\/api\/v1\/published-items$/],
  ["GET", /^\/api\/v1\/published-publications(?:\/[^/]+)?$/],
  ["POST", /^\/api\/v1\/reports$/],
  ["POST", /^\/api\/v1\/volunteer-interest$/],
  ["GET", /^\/api\/v1\/chat\/threads$/],
  ["POST", /^\/api\/v1\/chat\/threads$/],
  ["GET", /^\/api\/v1\/chat\/threads\/[^/]+\/messages$/],
  ["POST", /^\/api\/v1\/chat\/threads\/[^/]+\/messages$/],
] as const;

async function accessFor(request: Request): Promise<Access | null> {
  const path = new URL(request.url).pathname;
  /* Every internal service path runs as `app_service` with a named identity.
   *
   * `/api/internal/briefing/` was missing here until 2026-09-05, which meant
   * the external-publish ingest — the live path that files a whole externally
   * composed edition — fell through to `access === null` and ran on the
   * ambient owner pool: outside RLS, with no `app.identity`, and unable to
   * trigger the `app_service` branch of `enforce_publication_publish_gate`.
   * Its sibling `/api/internal/codex/`, the same job with a different
   * composer, was wrapped. The asymmetry was an omission, not a design. */
  const SERVICE_PREFIXES = [
    ["/api/internal/cron/", "service:cron"],
    ["/api/internal/queue/", "service:queue"],
    ["/api/internal/codex/", "service:codex"],
    ["/api/internal/briefing/", "service:external-briefing"],
    ["/api/internal/editorial-updates/", "service:editorial-updates"],
  ] as const;
  const service = SERVICE_PREFIXES.find(([prefix]) => path.startsWith(prefix));
  if (service) {
    return { role: "app_service", identity: service[1] };
  }
  if (!path.startsWith("/api/v1/")) return null;

  const isPublic = PUBLIC_V1.some(([method, matcher]) =>
    method === request.method && matcher.test(path),
  );
  if (isPublic) {
    const identity = `anonymous:${bucketFor(request, "identity").split(":").at(-1)}`;
    registerActor(request, { label: identity, userId: null });
    return { role: "app_public", identity };
  }

  /* Authentication may create or reconnect the single human's app_user row.
   * Do that bootstrap lookup under the service role, not the ambient database
   * login. The latter is intentionally not granted application-table access
   * in production, while app_service has the narrow write access needed for
   * identity synchronization. The actual route then runs under app_staff. */
  const actor = await withDatabaseRole(
    "app_service",
    "service:admin-auth-bootstrap",
    () => authenticateAdmin(request),
  );
  return { role: "app_staff", identity: actor.label };
}

/** Validates a JSON body, turning a Zod failure into a 422 with field detail. */
export async function parseBody<T>(request: Request, schema: ZodType<T>): Promise<T> {
  let raw: unknown;
  try {
    raw = await request.json();
  } catch {
    throw new ApiError("VALIDATION_ERROR", "Request body is not valid JSON");
  }
  const result = schema.safeParse(raw);
  if (!result.success) {
    throw new ApiError("VALIDATION_ERROR", "Request body failed validation", result.error.issues);
  }
  return result.data;
}

/** Validates query parameters the same way. */
export function parseQuery<T>(request: Request, schema: ZodType<T>): T {
  const params = Object.fromEntries(new URL(request.url).searchParams);
  const result = schema.safeParse(params);
  if (!result.success) {
    throw new ApiError("VALIDATION_ERROR", "Query parameters failed validation", result.error.issues);
  }
  return result.data;
}
