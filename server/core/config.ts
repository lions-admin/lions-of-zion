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
export const aiGatewayKey = (): string => required("AI_GATEWAY_API_KEY", "the AI gateway");
export const internalApiSecret = (): string =>
  required("INTERNAL_API_SECRET", "the internal route guard");

/** Ceilings in USD. Unset means unbounded, which is only acceptable locally. */
export function aiBudgets(): { daily?: number; monthly?: number } {
  const num = (name: string) => {
    const raw = process.env[name];
    if (!raw) return undefined;
    const n = Number(raw);
    return Number.isFinite(n) && n > 0 ? n : undefined;
  };
  return { daily: num("AI_DAILY_BUDGET_USD"), monthly: num("AI_MONTHLY_BUDGET_USD") };
}

/**
 * What is actually configured, for `/api/internal/health/deep`.
 *
 * Returns booleans, never values — a health endpoint that leaks the shape of a
 * connection string is a health endpoint that leaks.
 */
export function configuredIntegrations(): Record<string, boolean> {
  return {
    database: Boolean(process.env.DATABASE_URL),
    blob: Boolean(process.env.BLOB_READ_WRITE_TOKEN),
    aiGateway: Boolean(process.env.AI_GATEWAY_API_KEY),
    internalSecret: Boolean(process.env.INTERNAL_API_SECRET),
  };
}
