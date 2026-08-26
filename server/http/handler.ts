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
import { bucketFor } from "@/server/core/rate-limit";
import { withDatabaseRole, type DatabaseRole } from "@/server/db/client";
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
      const invoke = () => fn(request, ctx, ...rest);
      const response = access
        ? await withDatabaseRole(access.role, access.identity, invoke)
        : await invoke();
      response.headers.set("x-request-id", ctx.requestId);
      return response;
    } catch (cause) {
      if (cause instanceof ApiError) return problem(cause, ctx.requestId);
      console.error(
        JSON.stringify({
          level: "error",
          requestId: ctx.requestId,
          url: request.url,
          method: request.method,
          durationMs: Date.now() - ctx.startedAt,
          message: cause instanceof Error ? cause.message : String(cause),
          stack: cause instanceof Error ? cause.stack : undefined,
        }),
      );
      return problem(new ApiError("INTERNAL_ERROR", "Something went wrong"), ctx.requestId);
    }
  };
}

type Access = { role: DatabaseRole; identity: string };

const PUBLIC_V1 = [
  ["GET", /^\/api\/v1\/search$/],
  ["GET", /^\/api\/v1\/published-items$/],
  ["POST", /^\/api\/v1\/reports$/],
  ["GET", /^\/api\/v1\/chat\/threads$/],
  ["POST", /^\/api\/v1\/chat\/threads$/],
  ["GET", /^\/api\/v1\/chat\/threads\/[^/]+\/messages$/],
  ["POST", /^\/api\/v1\/chat\/threads\/[^/]+\/messages$/],
] as const;

async function accessFor(request: Request): Promise<Access | null> {
  const path = new URL(request.url).pathname;
  if (path.startsWith("/api/internal/cron/") || path.startsWith("/api/internal/queue/")) {
    return { role: "app_service", identity: path.startsWith("/api/internal/cron/") ? "service:cron" : "service:queue" };
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

  const actor = await authenticateAdmin(request);
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
