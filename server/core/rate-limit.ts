import "server-only";

/**
 * Fixed-window rate limiting, counted in Postgres.
 *
 * In-process counters do not work here. Vercel Functions are per-region and
 * recycled, so a counter in module scope is a limit *per instance* — which
 * under load is no limit at all, and worse, looks like one in the code.
 *
 * `bump_rate_limit` increments and returns the new count in a single
 * statement, so two concurrent requests cannot both read a stale value and
 * both conclude they are under the ceiling.
 *
 * The bucket is always hashed. Storing raw IPs would turn this table into a
 * visitor log, which is a thing to protect rather than a thing to keep.
 */

import { createHmac } from "node:crypto";
import { sql } from "drizzle-orm";
import { ApiError } from "@/server/http/responses";
import { rateLimitHmacSecret } from "@/server/core/config";

export type RateLimitPolicy = { limit: number; windowSeconds: number };

/** Public submission is the one surface anonymous users can write to, so it
 *  is the one that needs a real ceiling rather than a courtesy one. */
export const REPORT_SUBMISSION: RateLimitPolicy = { limit: 10, windowSeconds: 3600 };
export const VOLUNTEER_SUBMISSION: RateLimitPolicy = { limit: 5, windowSeconds: 3600 };
export const SEARCH_QUERIES: RateLimitPolicy = { limit: 120, windowSeconds: 60 };
export const CHAT_MESSAGES: RateLimitPolicy = { limit: 10, windowSeconds: 60 };
export const CHAT_MESSAGES_DAILY: RateLimitPolicy = { limit: 100, windowSeconds: 86_400 };
export const PUBLIC_API_READS: RateLimitPolicy = { limit: 600, windowSeconds: 60 };
export const ADMIN_MUTATIONS: RateLimitPolicy = { limit: 30, windowSeconds: 60 };
/** Outbound collection is deliberately constrained independently from public
 * traffic. These are shared Postgres buckets, so concurrent Functions cannot
 * accidentally turn a per-instance courtesy limit into unlimited traffic. */
export const OUTBOUND_SOURCE_GLOBAL: RateLimitPolicy = { limit: 240, windowSeconds: 60 };
export const OUTBOUND_SOURCE_DOMAIN: RateLimitPolicy = { limit: 15, windowSeconds: 60 };

/** Derives a stable, non-reversible bucket from whatever identifies the
 *  caller. Vercel sets `x-forwarded-for`; absent that, everything shares one
 *  bucket, which is the safe direction to fail. */
export function bucketFor(request: Request, scope: string): string {
  const forwarded = request.headers.get("x-forwarded-for")?.split(",")[0]?.trim();
  const subject = forwarded || request.headers.get("x-real-ip") || "unknown";
  return bucketForSubject(scope, subject);
}

/** Identical privacy properties to request buckets, for outbound provider and
 * publisher limits. Raw hostnames never enter the rate-limit table. */
export function bucketForSubject(scope: string, subject: string): string {
  return `${scope}:${createHmac("sha256", rateLimitHmacSecret())
    .update(subject)
    .digest("hex")
    .slice(0, 32)}`;
}

type Db = { execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }> };

/**
 * Counts this request and throws once the ceiling is passed.
 *
 * Counts *before* deciding, so a rejected request still contributes to the
 * window — otherwise a caller who is over the limit gets a free retry every
 * time, which is the opposite of a rate limit.
 */
export async function enforceRateLimit(
  db: unknown,
  bucket: string,
  policy: RateLimitPolicy,
): Promise<{ count: number; remaining: number }> {
  const result = await (db as Db).execute(
    sql`SELECT bump_rate_limit(${bucket}, ${policy.windowSeconds}) AS n`,
  );
  const count = Number((result.rows[0] as { n: number | string } | undefined)?.n ?? 0);

  if (count > policy.limit) {
    throw new ApiError(
      "RATE_LIMITED",
      `Too many requests. The limit is ${policy.limit} per ${policy.windowSeconds} seconds.`,
    );
  }
  return { count, remaining: Math.max(0, policy.limit - count) };
}
