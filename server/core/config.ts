import "server-only";

/**
 * The only file in the codebase that reads `process.env`.
 *
 * Everything else asks this module. That is what makes "no secret in source"
 * and "preview never touches production" auditable by grep rather than by
 * hope: one file to read, one list of names.
 *
 * Nothing here throws at import time. A missing `DATABASE_URL` must not stop
 * the test suite, which runs entirely against in-process PGlite — so the
 * accessors throw at the point of use, naming the variable and what wanted it.
 */

export type AppEnv = "development" | "preview" | "production";

function required(name: string, wantedBy: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(
      `${name} is not set, and ${wantedBy} needs it. ` +
        `See .env.example. If this is a test, it should be using the PGlite client instead.`,
    );
  }
  return value;
}

/**
 * `VERCEL_ENV` is authoritative where it exists; `APP_ENV` is the local
 * override. Anything unrecognised is treated as development, never as
 * production — guessing "production" wrong is the expensive direction.
 */
export function appEnv(): AppEnv {
  const raw = process.env.APP_ENV ?? process.env.VERCEL_ENV ?? process.env.NODE_ENV;
  return raw === "production" || raw === "preview" ? raw : "development";
}

export const isProduction = (): boolean => appEnv() === "production";

/**
 * Whether this deployment may take actions the outside world can see:
 * publishing, sending, or mutating shared storage.
 *
 * Preview deployments run the same code against the same integrations, so the
 * only thing standing between a preview build and a published assessment is a
 * check like this one. It is deliberately a positive test for production
 * rather than a negative test for preview — a new environment name that nobody
 * anticipated lands on "not allowed" instead of "allowed by omission".
 */
export const mayActOnTheWorld = (): boolean => isProduction();

export const databaseUrl = (): string => required("DATABASE_URL", "the database client");
export const testDatabaseUrl = (): string | undefined => process.env.TEST_DATABASE_URL;

export const blobToken = (): string => required("BLOB_READ_WRITE_TOKEN", "blob storage");
/** Vercel supplies `VERCEL_OIDC_TOKEN` automatically to linked deployments.
 * A static key remains a local-development fallback, not the production path. */
export const hasAiGateway = (): boolean =>
  Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY);
export const internalApiSecret = (): string =>
  required("INTERNAL_API_SECRET", "the internal route guard");
/** Vercel sets this automatically once the env var of the same name is
 *  configured, and signs every cron invocation with it. Unset locally, which
 *  is why the guard treats "unset" as "refuse", never as "allow". */
export const cronSecret = (): string | undefined => process.env.CRON_SECRET;

export const neonAuthBaseUrl = (): string =>
  required("NEON_AUTH_BASE_URL", "Neon Auth");
export const neonAuthCookieSecret = (): string =>
  required("NEON_AUTH_COOKIE_SECRET", "Neon Auth session cookies");
export const adminEmail = (): string =>
  required("ADMIN_EMAIL", "the single-admin allowlist").trim().toLowerCase();
export const siteUrl = (): string => process.env.NEXT_PUBLIC_SITE_URL ?? "https://lionsofzion.io";

/** Keyed hashing prevents a leaked bucket value from becoming a reusable IP
 * fingerprint. Production must provide a dedicated secret; local tests use a
 * conspicuous non-secret fallback. */
export const rateLimitHmacSecret = (): string =>
  appEnv() === "development"
    ? process.env.RATE_LIMIT_HMAC_SECRET ?? "development-only-rate-limit-key"
    : required("RATE_LIMIT_HMAC_SECRET", "anonymous rate-limit buckets");

/**
 * Model profiles — the only place a provider model id appears.
 *
 * Application code asks for `"fast"` or `"reasoning"`, never for a slug. That
 * is what makes swapping a model a one-line change here rather than a grep,
 * and what stops a prompt from quietly depending on one vendor's behaviour.
 *
 * **Verify these against `gateway.getAvailableModels()` when provisioning.**
 * Gateway slugs move — versioned ones use dots, not hyphens
 * (`claude-sonnet-4.6`, not `claude-sonnet-4-6`) — and a stale slug fails at
 * call time with a 400, not at deploy time. `/api/internal/ai/models` lists
 * what the gateway actually offers, for exactly this check.
 *
 * `embedding` is load-bearing in a way the others are not: its dimension is
 * baked into `search_document.embedding` as `vector(1536)`, and changing it is
 * a full table rewrite. A different embedding model must be added as a second
 * column, never swapped into this one.
 */
export const MODEL_PROFILES = {
  /** High volume, low stakes: classification, routing, short extraction. */
  fast: "anthropic/claude-haiku-4.5",
  /** Anything a human will be asked to approve. */
  reasoning: "anthropic/claude-sonnet-5",
  /** Translation, where fluency matters more than speed. */
  translation: "anthropic/claude-sonnet-5",
  /** 1536 dimensions — must match the vector column. */
  embedding: "openai/text-embedding-3-small",
} as const;

export type ModelProfile = keyof typeof MODEL_PROFILES;

export const EMBEDDING_DIMENSIONS = 1536;

export const modelFor = (profile: ModelProfile): string => MODEL_PROFILES[profile];

/** Ceilings in USD. Unset means unbounded, which is only acceptable locally. */
export function aiBudgets(): { daily?: number; monthly?: number } {
  const num = (name: string) => {
    const raw = process.env[name];
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return {
    daily: num("AI_DAILY_BUDGET_USD") ?? (appEnv() === "development" ? undefined : 0.75),
    monthly: num("AI_MONTHLY_BUDGET_USD") ?? (appEnv() === "development" ? undefined : 4.5),
  };
}

/**
 * What is actually configured, for `/api/internal/health/deep`.
 *
 * Returns booleans, never values — a health endpoint that leaks the shape of a
 * connection string is a health endpoint that leaks.
 */
export function configuredIntegrations(request?: Request): Record<string, boolean> {
  return {
    database: Boolean(process.env.DATABASE_URL),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    // In Vercel Functions the short-lived token is injected into the request
    // context, not process.env. The Gateway SDK reads this same header through
    // @vercel/oidc, so the health check must mirror the runtime behaviour.
    aiGateway:
      hasAiGateway() || Boolean(request?.headers.get("x-vercel-oidc-token")),
    neonAuth: Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET),
    internalSecret: Boolean(process.env.INTERNAL_API_SECRET),
  };
}
