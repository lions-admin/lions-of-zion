import "server-only";

import { createHash } from "node:crypto";

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
  const raw = process.env.VERCEL_ENV ?? process.env.APP_ENV ?? process.env.NODE_ENV;
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

/** Every mutable briefing resource declares the environment it belongs to.
 * Deployed environments fail closed when a label is absent or mismatched, and
 * the news Blob store must never be the October 7 archive store. */
export function assertBriefingResourceIsolation(): void {
  const environment = appEnv();
  if (environment === "development") return;
  const labels = [
    ["DATABASE_RESOURCE_ENV", process.env.DATABASE_RESOURCE_ENV],
    ["BLOB_RESOURCE_ENV", process.env.BLOB_RESOURCE_ENV],
    ["QUEUE_RESOURCE_ENV", process.env.QUEUE_RESOURCE_ENV],
    ["SEARCH_RESOURCE_ENV", process.env.SEARCH_RESOURCE_ENV],
  ] as const;
  for (const [name, value] of labels) {
    if (value !== environment) throw new Error(`${name} must equal ${environment} before briefing mutation is allowed.`);
  }
  const briefingBlob = required("BRIEFING_BLOB_RESOURCE_ID", "briefing storage isolation");
  const archiveBlob = required("OCTOBER7_BLOB_RESOURCE_ID", "October 7 archive storage isolation");
  if (briefingBlob === archiveBlob) throw new Error("Briefing storage must be separate from the October 7 archive store.");
}

/**
 * Safe operator diagnostics for comparing deployments. The values are
 * one-way fingerprints, never connection strings, tokens, or provider IDs.
 * This lets an administrator compare Preview and Production bindings without
 * putting secrets in the dashboard or logs. Queue providers may expose their
 * resource ID separately; when configured it is included in the same report.
 */
export function briefingResourceFingerprints(): Record<string, string | null> {
  const fingerprint = (value: string | undefined): string | null => {
    const trimmed = value?.trim();
    return trimmed
      ? createHash("sha256").update(trimmed).digest("hex").slice(0, 16)
      : null;
  };
  return {
    database: fingerprint(process.env.DATABASE_URL),
    briefingBlob: fingerprint(process.env.BRIEFING_BLOB_RESOURCE_ID),
    october7Blob: fingerprint(process.env.OCTOBER7_BLOB_RESOURCE_ID),
    googleSearch: fingerprint(process.env.GOOGLE_AGENT_SEARCH_ENGINE_ID),
    queue: fingerprint(process.env.BRIEFING_QUEUE_RESOURCE_ID),
  };
}

export function databaseUrl(): string {
  const value = required("DATABASE_URL", "the database client");
  try {
    const parsed = new URL(value);
    if (!parsed.protocol.startsWith("postgres")) throw new Error("unsupported protocol");
    return value;
  } catch {
    // `vercel env pull` intentionally writes `[SENSITIVE]` for protected
    // values. Failing here makes an operator error actionable, rather than
    // letting the database driver fail later with an unhelpful Invalid URL.
    throw new Error(
      "DATABASE_URL is not a PostgreSQL connection URL. A redacted value cannot run maintenance scripts; use an authorized database connection or invoke the protected production route.",
    );
  }
}
export function databasePoolConfig(): { max: number; idleTimeoutMillis: number; connectionTimeoutMillis: number } {
  const positive = (name: string, fallback: number) => {
    const value = Number(process.env[name]);
    return Number.isFinite(value) && value > 0 ? Math.floor(value) : fallback;
  };
  return {
    max: positive("DATABASE_POOL_MAX", 8),
    idleTimeoutMillis: positive("DATABASE_POOL_IDLE_TIMEOUT_MS", 20_000),
    connectionTimeoutMillis: positive("DATABASE_POOL_CONNECTION_TIMEOUT_MS", 8_000),
  };
}
export const testDatabaseUrl = (): string | undefined => process.env.TEST_DATABASE_URL;

/** The briefing capture store has its own token when it is connected through
 * Vercel Storage. Keep the generic token as a local/development fallback so
 * existing archive and RSS workflows do not break while environments migrate. */
export const blobToken = (): string =>
  process.env.BRIEFING_BLOB_READ_WRITE_TOKEN?.trim() || required("BLOB_READ_WRITE_TOKEN", "blob storage");

/**
 * Production raw briefing material is stored in a dedicated private Blob
 * store. Vercel Functions authenticate to it with a short-lived OIDC token,
 * so no second long-lived token is required in Production. Local maintenance
 * scripts retain the explicit-token fallback.
 */
export function briefingBlobOptions(): { storeId?: string; token?: string } {
  const storeId = process.env.BRIEFING_BLOB_RESOURCE_ID?.trim();
  if (storeId && process.env.VERCEL) return { storeId };
  return { token: blobToken() };
}
export const xOAuthClientId = (): string => required("X_OAUTH_CLIENT_ID", "X OAuth");
export const xOAuthClientSecret = (): string => required("X_OAUTH_CLIENT_SECRET", "X OAuth");
export const xAuthSessionSecret = (): string =>
  required("X_AUTH_SESSION_SECRET", "public X authentication session cookies");
/**
 * The same three values, asked rather than demanded.
 *
 * A deployment without X credentials is not a broken deployment; it is a
 * deployment where the reader is told X sign-in is unavailable. Answering that
 * question with `required()` would mean throwing to find out, so the session
 * endpoint gets accessors that return `undefined` instead — the
 * `googleAuthSessionSecretIfConfigured` precedent, applied to X.
 */
export const xOAuthClientIdIfConfigured = (): string | undefined =>
  process.env.X_OAUTH_CLIENT_ID?.trim() || undefined;
export const xOAuthClientSecretIfConfigured = (): string | undefined =>
  process.env.X_OAUTH_CLIENT_SECRET?.trim() || undefined;
export const xAuthSessionSecretIfConfigured = (): string | undefined =>
  process.env.X_AUTH_SESSION_SECRET?.trim() || undefined;
export const hasXaiApiKey = (): boolean => Boolean(process.env.XAI_API_KEY);
/** The operations console calls OpenAI directly when this is set, the way
 *  `xai/` profiles bypass the gateway; unset, it falls back to the gateway
 *  path. The value is returned to the provider constructor and nowhere else. */
export const openaiApiKey = (): string | undefined => process.env.OPENAI_API_KEY?.trim() || undefined;
export type GoogleAgentSearchConfig = {
  project: string;
  location: string;
  servingConfig: string;
  workloadIdentityProvider: string;
  serviceAccountEmail: string;
};

/** Agent Search uses Vercel OIDC -> Google STS -> service-account
 * impersonation. No static Google key is accepted by this configuration. */
export function googleAgentSearchConfig(): GoogleAgentSearchConfig {
  if (appEnv() !== "development" && process.env.GOOGLE_SEARCH_API_KEY?.trim()) {
    throw new Error("GOOGLE_SEARCH_API_KEY is forbidden outside development; use Workload Identity Federation.");
  }
  const project = required("GOOGLE_CLOUD_PROJECT", "Google Agent Search");
  const location = process.env.GOOGLE_CLOUD_LOCATION?.trim() || "global";
  const explicit = process.env.GOOGLE_AGENT_SEARCH_SERVING_CONFIG?.trim();
  const engineId = process.env.GOOGLE_AGENT_SEARCH_ENGINE_ID?.trim();
  const servingConfig = explicit || (engineId
    ? `projects/${project}/locations/${location}/collections/default_collection/engines/${engineId}/servingConfigs/default_search`
    : required("GOOGLE_AGENT_SEARCH_ENGINE_ID", "Google Agent Search"));
  return {
    project,
    location,
    servingConfig,
    workloadIdentityProvider: required(
      "GOOGLE_WORKLOAD_IDENTITY_PROVIDER",
      "Google Workload Identity Federation",
    ),
    serviceAccountEmail: required(
      "GOOGLE_SERVICE_ACCOUNT_EMAIL",
      "Google service-account impersonation",
    ),
  };
}
/** Vercel supplies `VERCEL_OIDC_TOKEN` automatically to linked deployments.
 * A static key remains a local-development fallback, not the production path. */
export const hasAiGateway = (): boolean =>
  Boolean(process.env.VERCEL_OIDC_TOKEN || process.env.AI_GATEWAY_API_KEY || process.env.XAI_API_KEY);
export const internalApiSecret = (): string =>
  required("INTERNAL_API_SECRET", "the internal route guard");
export const externalBriefingIngestSecret = (): string =>
  required("EXTERNAL_BRIEFING_INGEST_SECRET", "the external briefing ingest guard");
export const editorialUpdateIngestSecret = (): string =>
  required("EDITORIAL_UPDATE_INGEST_SECRET", "the whole-site editorial update ingest guard");
export const codexBriefingImportSecret = (): string =>
  required("CODEX_BRIEFING_IMPORT_SECRET", "the Codex briefing import route");
/** Vercel sets this automatically once the env var of the same name is
 *  configured, and signs every cron invocation with it. Unset locally, which
 *  is why the guard treats "unset" as "refuse", never as "allow". */
export const cronSecret = (): string | undefined => process.env.CRON_SECRET;
export const queueRegion = (): string => process.env.BRIEFING_QUEUE_REGION?.trim() || process.env.VERCEL_REGION?.trim() || "iad1";
/** Queue resource bindings are provisioned independently of the AI gateway.
 * A model token or a Vercel OIDC token says nothing about queue delivery, so
 * neither may make the health check report a queue that is not configured.
 * The explicit environment label is the required binding marker; region is
 * optional because Vercel can supply it at request time. */
export const queueConfigured = (): boolean => Boolean(
  process.env.QUEUE_RESOURCE_ENV?.trim() === appEnv() && appEnv() !== "development",
);

export const neonAuthBaseUrl = (): string =>
  required("NEON_AUTH_BASE_URL", "Neon Auth");
export const neonAuthCookieSecret = (): string =>
  required("NEON_AUTH_COOKIE_SECRET", "Neon Auth session cookies");
/** Separate, server-only signing key for the site's Google identity session.
 * It is intentionally not the Google client secret and never reaches the browser. */
export const googleAuthSessionSecret = (): string =>
  required("GOOGLE_AUTH_SESSION_SECRET", "Google identity sessions");
export const googleAuthSessionSecretIfConfigured = (): string | undefined =>
  process.env.GOOGLE_AUTH_SESSION_SECRET?.trim() || undefined;
export const googleIdentityClientId = (): string =>
  required("NEXT_PUBLIC_GOOGLE_IDENTITY_CLIENT_ID", "Google identity verification");
export const googleIdentityClientIdIfConfigured = (): string | undefined =>
  process.env.NEXT_PUBLIC_GOOGLE_IDENTITY_CLIENT_ID?.trim() || undefined;
export const adminEmail = (): string =>
  required("ADMIN_EMAIL", "the single-admin allowlist").trim().toLowerCase();
export const siteUrl = (): string => process.env.NEXT_PUBLIC_SITE_URL ?? "https://lionsofzion.io";
export const googleWorkspaceSmtpUser = (): string =>
  required("GOOGLE_WORKSPACE_SMTP_USER", "Google Workspace email delivery").trim().toLowerCase();
export const googleWorkspaceSmtpAppPassword = (): string =>
  required("GOOGLE_WORKSPACE_SMTP_APP_PASSWORD", "Google Workspace email delivery");

/** Keyed hashing prevents a leaked bucket value from becoming a reusable IP
 * fingerprint. Production must provide a dedicated secret; local tests use a
 * conspicuous non-secret fallback. */
export const rateLimitHmacSecret = (): string =>
  appEnv() === "development"
    ? process.env.RATE_LIMIT_HMAC_SECRET ?? "development-only-rate-limit-key"
    : required("RATE_LIMIT_HMAC_SECRET", "anonymous rate-limit buckets");

/**
 * The key the operations console signs its confirmation tokens with.
 *
 * Reuses `INTERNAL_API_SECRET` rather than adding a variable: a confirmation
 * token lives ten minutes and binds one proposed tool call to one operator,
 * so a rotation of the internal secret costs at most the confirmations
 * pending at that moment. The token module derives its own HMAC key from
 * this value with a purpose label, so the raw secret is never the key.
 * Production fails loudly like every other accessor; development falls
 * back to a conspicuous non-secret so the console works without setup.
 */
export const opsConfirmationSecret = (): string =>
  appEnv() === "development"
    ? process.env.INTERNAL_API_SECRET ?? "development-only-ops-confirmation-key"
    : required("INTERNAL_API_SECRET", "operations console confirmation tokens");

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
  fast: "xai/grok-4.3",
  /** Anything a human will be asked to approve. */
  reasoning: "anthropic/claude-sonnet-5",
  /** Translation, where fluency matters more than speed. */
  translation: "anthropic/claude-sonnet-5",
  /** Google-discovered public material only. Kept separate from Grok chat. */
  briefingTriage: "openai/gpt-5-nano",
  /** Publication-ready English drafts. Kept separate from Grok chat. */
  briefingDraft: "openai/gpt-5-mini",
  /** The operations console's tool-calling assistant — the admin-only chat
   *  that reads and operates the system through a fixed tool set. Verified
   *  against `gateway.getAvailableModels()` via `/api/internal/ai/models`. */
  opsConsole: "openai/gpt-5.6-sol",
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

/** The briefing has a separate ceiling so it cannot spend the chat budget. */
export function briefingAiBudgets(): { daily: number; monthly: number } {
  const num = (name: string, fallback: number) => {
    const parsed = Number(process.env[name]);
    return Number.isFinite(parsed) && parsed > 0 ? parsed : fallback;
  };
  return {
    daily: num("BRIEFING_AI_DAILY_BUDGET_USD", 0.5),
    monthly: num("BRIEFING_AI_MONTHLY_BUDGET_USD", 10),
  };
}

export const agentSearchMonthlyLimit = (): number => {
  const parsed = Number(process.env.GOOGLE_SEARCH_MONTHLY_LIMIT);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : 5_000;
};
export const agentSearchMonthlyBudgetUsd = (): number | undefined => {
  const parsed = Number(process.env.GOOGLE_SEARCH_MONTHLY_BUDGET_USD);
  return Number.isFinite(parsed) && parsed > 0 ? parsed : undefined;
};
export const agentSearchEstimatedUnitCostUsd = (): number | undefined => {
  const parsed = Number(process.env.GOOGLE_SEARCH_ESTIMATED_COST_PER_QUERY_USD);
  return Number.isFinite(parsed) && parsed >= 0 ? parsed : undefined;
};

export const briefingRawStorageWarningBytes = (): number | undefined => {
  const parsed = Number(process.env.BRIEFING_RAW_STORAGE_WARNING_BYTES);
  return Number.isFinite(parsed) && parsed > 0 ? Math.floor(parsed) : undefined;
};

function featureFlag(name: string, fallback: boolean): boolean {
  const raw = process.env[name]?.trim().toLowerCase();
  if (!raw) return fallback;
  if (["1", "true", "yes", "on"].includes(raw)) return true;
  if (["0", "false", "no", "off"].includes(raw)) return false;
  return fallback;
}

/** Independent controls keep collection useful while editorial processing or
 * public release is paused. Automatic publication is fail-closed and can only
 * be enabled in Production after the acceptance gates have passed. */
export function briefingFeatures(): {
  collection: boolean;
  processing: boolean;
  autoPublish: boolean;
} {
  return {
    collection: appEnv() !== "preview" && featureFlag("BRIEFING_COLLECTION_ENABLED", true),
    processing: appEnv() !== "preview" && featureFlag("BRIEFING_PROCESSING_ENABLED", false),
    autoPublish: isProduction() && featureFlag("BRIEFING_AUTO_PUBLISH_ENABLED", false),
  };
}

const BRIEFING_STAGES = ["enrich", "cluster", "triage", "draft", "publish"] as const;
export type BriefingStageName = (typeof BRIEFING_STAGES)[number];

function csvSet(name: string): Set<string> | undefined {
  const raw = process.env[name]?.trim();
  if (!raw) return undefined;
  const values = new Set(raw.split(",").map((value) => value.trim()).filter(Boolean));
  return values.size > 0 ? values : undefined;
}

/** Optional rollout allowlists. An unset list means all registered sources or
 * stages; an explicit list makes it possible to canary one source or pause a
 * single editorial stage without changing the broader pipeline flags. */
export const briefingCollectionSourceAllowlist = (): Set<string> | undefined =>
  csvSet("BRIEFING_COLLECTION_SOURCE_IDS");

export const briefingEnabledStages = (): Set<BriefingStageName> => {
  const configured = csvSet("BRIEFING_ENABLED_STAGES");
  if (!configured) return new Set(BRIEFING_STAGES);
  return new Set(BRIEFING_STAGES.filter((stage) => configured.has(stage)));
};

export const briefingStageEnabled = (stage: BriefingStageName): boolean =>
  briefingEnabledStages().has(stage);

/**
 * What is actually configured, for `/api/internal/health/deep`.
 *
 * Returns booleans, never values — a health endpoint that leaks the shape of a
 * connection string is a health endpoint that leaks.
 */
export function configuredIntegrations(request?: Request): Record<string, boolean> {
  return {
    database: Boolean(process.env.DATABASE_URL),
    blob: Boolean(
      process.env.BRIEFING_BLOB_RESOURCE_ID ||
      process.env.BRIEFING_BLOB_READ_WRITE_TOKEN ||
      process.env.BLOB_READ_WRITE_TOKEN,
    ),
    // In Vercel Functions the short-lived token is injected into the request
    // context, not process.env. The Gateway SDK reads this same header through
    // @vercel/oidc, so the health check must mirror the runtime behaviour.
    aiGateway:
      hasAiGateway() || Boolean(request?.headers.get("x-vercel-oidc-token")),
    neonAuth: Boolean(process.env.NEON_AUTH_BASE_URL && process.env.NEON_AUTH_COOKIE_SECRET),
    internalSecret: Boolean(process.env.INTERNAL_API_SECRET),
    /* The operations console's direct provider path. Absent means the
       console routes through the gateway, not that it is unavailable. */
    openai: Boolean(process.env.OPENAI_API_KEY),
  };
}

/** A checked-in local edition is never a production fallback, even with local Vercel env copies. */
export const homepageLocalPreview = (): boolean => process.env.NODE_ENV === 'development';
