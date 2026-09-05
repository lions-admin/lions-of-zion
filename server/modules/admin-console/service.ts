import "server-only";

/**
 * The operations console's read model and its recovery actions.
 *
 * Every read gathers its aggregates from `repo.ts` in one `Promise.all`,
 * shapes them, and then **parses the result against the contract** in
 * `server/contracts/admin-console.ts`. The parse is the point: a column that
 * drifts, a count that comes back as a string, a date that is not a date —
 * each fails here, in a test, rather than rendering as `NaN` on the console.
 *
 * The actions are deliberately few and deliberately narrow. A job goes back to
 * the ready queue; an alert is marked resolved; a source is switched on or off
 * through its own versioned service; a publication is rolled back by applying
 * an old snapshot through `publications().update()` so `recordVersion()` runs
 * and the change is one more version, never a rewrite of history. Each writes
 * an `audit_log` row in the same transaction as the change.
 */

import {
  archiveChatThreadResultSchema,
  auditEntrySchema,
  auditPageSchema,
  collectSweepResultSchema,
  consoleChatThreadsSchema,
  consoleChatTranscriptSchema,
  consoleEditionDrilldownSchema,
  consoleReportsSchema,
  consoleSourceFetchesSchema,
  consoleCostsSchema,
  consoleEditorialSchema,
  consoleEntityVersionSchema,
  consoleEntityVersionsSchema,
  consoleEvidenceProvenanceSchema,
  consoleIncidentsSchema,
  consoleNarrativesSchema,
  consoleOverviewSchema,
  consolePipelineSchema,
  consolePromptVersionSchema,
  consolePromptsSchema,
  consoleQualityChecksSchema,
  consoleReportSchema,
  consoleSecuritySchema,
  consoleSettingsSchema,
  consoleSourcesSchema,
  consoleSystemInternalsSchema,
  consoleUsersSchema,
  drainOutboxResultSchema,
  maintenanceTickResultSchema,
  PIPELINE_STAGES,
  publicationVersionSchema,
  promptVersionActivatedSchema,
  promptVersionInsertedSchema,
  retryJobResultSchema,
  type ActivatePromptVersion,
  type ArchiveChatThreadResult,
  type AuditEntry,
  type AuditPage,
  type CollectSweepResult,
  type ConsoleAlert,
  type ConsoleChatThread,
  type ConsoleChatThreads,
  type ConsoleChatTranscript,
  type ConsoleCosts,
  type ConsoleEditionArtifact,
  type ConsoleEditionClaim,
  type ConsoleEditionDrilldown,
  type ConsoleEditionRun,
  type ConsoleEditionRunAi,
  type ConsoleEditorial,
  type ConsoleEntityVersion,
  type ConsoleEntityVersions,
  type ConsoleEvidenceProvenance,
  type ConsoleIncidents,
  type ConsoleNarratives,
  type ConsoleOverview,
  type ConsolePipeline,
  type ConsolePromptVersion,
  type ConsolePrompts,
  type ConsoleQualityChecks,
  type ConsoleReport,
  type ConsoleReports,
  type ConsoleSecurity,
  type ConsoleSettings,
  type ConsoleSourceFetches,
  type ConsoleSources,
  type ConsoleSystemInternals,
  type ConsoleUsers,
  type CostSurface,
  type DiscardQuarantine,
  type DrainOutbox,
  type DrainOutboxResult,
  type EditorialCard,
  type ListAudit,
  type ListEditorial,
  type ListChatThreadsQuery,
  type ListConsoleReports,
  type ListEditionDrilldown,
  type ListEntityVersions,
  type ListQualityChecks,
  type ListSourceFetches,
  type InsertPromptVersion,
  type MaintenanceTickResult,
  type PipelineJob,
  type PublicationVersion,
  type PromptVersionActivated,
  type PromptVersionInserted,
  type QualityCheckCandidate,
  type QualityCheckResult,
  type QuarantineOutcome,
  type ResolveAlert,
  type ResolveQuarantine,
  type RetryJob,
  type RetryJobResult,
  type RollbackPublication,
  type SetSourceActive,
  type SourceFetch,
} from "@/server/contracts/admin-console";
import { updatePublicationSchema } from "@/server/contracts/publication";
import {
  agentSearchEstimatedUnitCostUsd,
  agentSearchMonthlyBudgetUsd,
  agentSearchMonthlyLimit,
  aiBudgets,
  appEnv,
  briefingAiBudgets,
  briefingFeatures,
  briefingResourceFingerprints,
  configuredIntegrations,
  cronSecret,
  googleAuthSessionSecretIfConfigured,
  hasXaiApiKey,
  MODEL_PROFILES,
  queueConfigured,
  queueRegion,
  siteUrl,
} from "@/server/core/config";
import { ADMIN_CAPABILITIES } from "@/server/core/auth/actor";
import { writeAudit, type Actor } from "@/server/core/audit";
import { publicReadCacheStats } from "@/server/core/public-read-cache";
import { runMaintenance } from "@/server/core/maintenance";
import { drainOutbox, type DrainResult } from "@/server/core/outbox";
import { withDatabaseRole } from "@/server/db/client";
import { setIdentity } from "@/server/core/versioning";
import { ApiError, notFound } from "@/server/http/responses";
import { publicationService } from "@/server/modules/publications";
import { sourceService } from "@/server/modules/sources";
import { BRIEFING_DISCOVERY_QUERIES } from "@/server/modules/sources/catalog";
import { dispatchBriefingJob, recoverAndDispatchBriefingJobs, enqueueDueCollectionJobs } from "@/server/modules/briefing/jobs";
import { evaluateAndQueueBriefingAlerts } from "@/server/modules/briefing/alerts";
import { REQUIRED_QUALITY_CHECKS } from "@/server/modules/briefing/quality";
import {
  adminConsoleRepo,
  type AlertRow,
  type AuditRow,
  type ChatAiRunRow,
  type ChatMessageRow,
  type ChatThreadRow,
  type ChatToolRunRow,
  type ConsoleJobState,
  type EditionArtifactRow,
  type EditionClaimRow,
  type EditionRunAiRow,
  type EditionRunRow,
  type EntityVersionRow,
  type JobRow,
  type PromptVersionRow,
  type QualityCheckRow,
  type QuarantineEntryRow,
  type ReportDeskRow,
  type SourceFetchRow,
} from "./repo";

/* ── Schedules ──────────────────────────────────────────────────────────────
   Mirrors `vercel.json` `crons`. `tests/admin-console-reads.test.ts` pins the
   two against each other, so a schedule edited in one place fails the suite
   rather than showing the operator a wrong "next run". */
/**
 * The cron table, mirrored from `vercel.json`.
 *
 * `description` is operator-facing and reads in Hebrew, because the only
 * surface that renders it is the console's settings panel. This is the one
 * place a Hebrew string is correct on the server side — everything else here
 * is either an identifier or prompt text a model reads.
 * `tests/admin-console-reads.test.ts` pins these against `vercel.json` so the
 * paths and expressions cannot drift; the descriptions are ours.
 */
export const SCHEDULES = [
  { path: "/api/internal/cron/ingest", schedule: "0,30 * * * *", description: "איסוף מכל מקור פעיל, בכל חצי שעה." },
  { path: "/api/internal/cron/embed", schedule: "10,40 * * * *", description: "הטמעת מסמכים חדשים לצורך חיפוש סמנטי." },
  { path: "/api/internal/cron/outbox-drain", schedule: "*/15 * * * *", description: "מסירת פעולות ממתינות מה-outbox: אינדוקס מחדש וביטול מטמון." },
  { path: "/api/internal/cron/maintenance", schedule: "20 3 * * *", description: "תחזוקת לילה: שחרור משימות תקועות, גיזום נתונים והתראות." },
] as const;

/** The schedule whose tick the overview reports as "next run". */
const COLLECTION_SCHEDULE = SCHEDULES[0];

/**
 * The next tick of a fixed-form cron expression, strictly after `from`.
 *
 * Handles the minute and hour fields as lists (`0,30`), steps (`* /15`) or a
 * wildcard, with day, month and weekday required to be `*` — which is every
 * entry in `vercel.json`. Walking minute by minute for at most a day and a
 * bit is ample for that and avoids a dependency for four lines of config.
 */
export function nextCronTick(expression: string, from: Date): Date | null {
  const fields = expression.trim().split(/\s+/);
  if (fields.length !== 5 || fields.slice(2).some((field) => field !== "*")) return null;
  const minutes = parseField(fields[0]!, 60);
  const hours = parseField(fields[1]!, 24);
  if (!minutes || !hours) return null;
  const cursor = new Date(from.getTime());
  cursor.setUTCSeconds(0, 0);
  for (let step = 0; step <= 25 * 60; step++) {
    cursor.setUTCMinutes(cursor.getUTCMinutes() + 1);
    if (minutes.has(cursor.getUTCMinutes()) && hours.has(cursor.getUTCHours())) return new Date(cursor.getTime());
  }
  return null;
}

function parseField(field: string, modulus: number): Set<number> | null {
  if (field === "*") return new Set(Array.from({ length: modulus }, (_, i) => i));
  const step = /^\*\/(\d+)$/.exec(field);
  if (step) {
    const every = Number(step[1]);
    if (!Number.isInteger(every) || every <= 0) return null;
    return new Set(Array.from({ length: modulus }, (_, i) => i).filter((i) => i % every === 0));
  }
  const values = field.split(",").map((part) => Number(part));
  if (values.some((value) => !Number.isInteger(value) || value < 0 || value >= modulus)) return null;
  return new Set(values);
}

/* ── Sections the briefing composes ─────────────────────────────────────────
   `ARTICLE_SECTIONS` in `briefing/service.ts` is module-private; this mirror
   is pinned against that file's source in the reads test. */
export const ARTICLE_SECTIONS = ["israel_update", "narrative_watch"] as const;

/** Utilisation at which a budget is called out in plain words. */
export const WARN_AT = 0.8;

/** Environment names the platform depends on, with the read that says
 *  whether each is set. Booleans only — `config.ts` owns the values. */
function secretsReport(request?: Request): ConsoleSecurity["secrets"] {
  const integrations = configuredIntegrations(request);
  const fingerprints = briefingResourceFingerprints();
  return [
    { name: "DATABASE_URL", configured: integrations.database ?? false, purpose: "Neon Postgres connection for every module." },
    { name: "BRIEFING_BLOB_RESOURCE_ID", configured: fingerprints.briefingBlob !== null, purpose: "Raw fetch storage for the briefing; must differ from the October 7 archive store." },
    { name: "OCTOBER7_BLOB_RESOURCE_ID", configured: fingerprints.october7Blob !== null, purpose: "The October 7 archive store, kept separate from briefing captures." },
    { name: "BLOB_READ_WRITE_TOKEN", configured: integrations.blob ?? false, purpose: "Vercel Blob write access." },
    { name: "AI_GATEWAY_API_KEY / VERCEL_OIDC_TOKEN", configured: integrations.aiGateway ?? false, purpose: "AI Gateway access for triage, drafting, chat and embeddings." },
    { name: "XAI_API_KEY", configured: hasXaiApiKey(), purpose: "Direct xAI access for the public chat's fast profile." },
    { name: "NEON_AUTH_BASE_URL / NEON_AUTH_COOKIE_SECRET", configured: integrations.neonAuth ?? false, purpose: "Administrator sign-in through Neon Auth." },
    { name: "GOOGLE_AUTH_SESSION_SECRET", configured: Boolean(googleAuthSessionSecretIfConfigured()), purpose: "Signing key for the public Google identity session." },
    { name: "GOOGLE_AGENT_SEARCH_ENGINE_ID", configured: fingerprints.googleSearch !== null, purpose: "Google Agent Search discovery engine." },
    { name: "BRIEFING_QUEUE_RESOURCE_ID", configured: fingerprints.queue !== null || queueConfigured(), purpose: "Vercel Queue binding for briefing job delivery." },
    { name: "INTERNAL_API_SECRET", configured: integrations.internalSecret ?? false, purpose: "Guard on every /api/internal route." },
    { name: "CRON_SECRET", configured: Boolean(cronSecret()), purpose: "Signature Vercel attaches to cron invocations." },
  ];
}

/* ── Normalisers ──────────────────────────────────────────────────────────── */

type Ts = Date | string | null | undefined;

function iso(value: Ts): string | null {
  if (value == null) return null;
  const date = value instanceof Date ? value : new Date(value);
  return Number.isNaN(date.getTime()) ? String(value) : date.toISOString();
}

const isoRequired = (value: Ts): string => iso(value) ?? new Date(0).toISOString();
const num = (value: string | number | bigint | null | undefined): number => Number(value ?? 0);
const money = (value: string | number | bigint | null | undefined): number => Math.max(0, num(value));

function toJob(row: JobRow): PipelineJob {
  return {
    id: row.id,
    jobKey: row.jobKey,
    stage: row.stage as PipelineJob["stage"],
    localDate: row.localDate,
    sourceId: row.sourceId,
    sourceName: row.sourceName,
    state: row.state as PipelineJob["state"],
    attempts: num(row.attempts),
    maxAttempts: num(row.maxAttempts),
    availableAt: isoRequired(row.availableAt),
    leaseUntil: iso(row.leaseUntil),
    heartbeatAt: iso(row.heartbeatAt),
    startedAt: iso(row.startedAt),
    finishedAt: iso(row.finishedAt),
    lastError: row.lastError,
    createdAt: isoRequired(row.createdAt),
  };
}

function toAlert(row: AlertRow): ConsoleAlert {
  return {
    id: row.id,
    fingerprint: row.fingerprint,
    kind: row.kind,
    severity: row.severity as ConsoleAlert["severity"],
    message: row.message,
    details: row.details ?? null,
    createdAt: isoRequired(row.createdAt),
    notifiedAt: iso(row.notifiedAt),
    resolvedAt: iso(row.resolvedAt),
  };
}

function toAuditEntry(row: AuditRow): AuditEntry {
  return {
    id: String(row.id),
    occurredAt: isoRequired(row.occurredAt),
    actorUserId: row.actorUserId,
    actorLabel: row.actorLabel,
    action: row.action,
    entityType: row.entityType as AuditEntry["entityType"],
    entityId: row.entityId,
    requestId: row.requestId,
    hasBefore: Boolean(row.hasBefore),
    hasAfter: Boolean(row.hasAfter),
  };
}

/** Stages sort in pipeline order; a stage name the pipeline no longer knows
 *  (a row from an older contract) sorts last, by name — the same convention
 *  the quality matrix uses for check names. */
const pipelineOrder = new Map<string, number>(PIPELINE_STAGES.map((stage, index) => [stage, index]));
const byPipelineOrder = (stage: string): number => pipelineOrder.get(stage) ?? PIPELINE_STAGES.length;
const byStage = <T extends { stage: string }>(rows: T[]): T[] =>
  [...rows].sort((a, b) => byPipelineOrder(a.stage) - byPipelineOrder(b.stage));

function toEditionRun(row: EditionRunRow): ConsoleEditionRun {
  return {
    id: row.id,
    stage: row.stage,
    status: row.status,
    inputCount: num(row.inputCount),
    outputCount: num(row.outputCount),
    errorMessage: row.errorMessage,
    startedAt: isoRequired(row.startedAt),
    finishedAt: iso(row.finishedAt),
  };
}

function toEditionRunAi(row: EditionRunAiRow): ConsoleEditionRunAi {
  return {
    stage: row.stage,
    aiRunId: row.aiRunId,
    model: row.model,
    profile: row.profile,
    kind: row.kind,
    inputTokens: row.inputTokens == null ? null : num(row.inputTokens),
    outputTokens: row.outputTokens == null ? null : num(row.outputTokens),
    costUsd: row.costUsd == null ? null : money(row.costUsd),
    latencyMs: row.latencyMs == null ? null : num(row.latencyMs),
    status: row.status,
    createdAt: isoRequired(row.createdAt),
  };
}

function toEditionArtifact(row: EditionArtifactRow): ConsoleEditionArtifact {
  return {
    stage: row.stage,
    artifactVersion: num(row.artifactVersion),
    inputHash: row.inputHash,
    payload: row.payload ?? null,
    createdAt: isoRequired(row.createdAt),
  };
}

function toEditionClaim(row: EditionClaimRow): ConsoleEditionClaim {
  return {
    itemId: row.itemId,
    layer: row.layer as ConsoleEditionClaim["layer"],
    machineAssessment: row.machineAssessment as ConsoleEditionClaim["machineAssessment"],
    attributedTo: row.attributedTo,
    uncertainty: row.uncertainty,
    createdAt: isoRequired(row.createdAt),
  };
}

function toSourceFetch(row: SourceFetchRow): SourceFetch {
  return {
    id: row.id,
    status: row.status as SourceFetch["status"],
    startedAt: isoRequired(row.startedAt),
    finishedAt: isoRequired(row.finishedAt),
    httpStatus: row.httpStatus == null ? null : num(row.httpStatus),
    itemsSeen: num(row.itemsSeen),
    itemsNew: num(row.itemsNew),
    errorMessage: row.errorMessage,
    searchQuery: row.searchQuery,
    rawBlobUrl: row.rawBlobUrl,
    rawByteSize: row.rawByteSize == null ? null : num(row.rawByteSize),
    createdAt: isoRequired(row.createdAt),
  };
}

function toQuarantineOutcome(row: QuarantineEntryRow): QuarantineOutcome {
  return {
    id: row.id,
    candidateKey: row.candidateKey,
    stage: row.stage,
    reason: row.reason,
    status: row.status as QuarantineOutcome["status"],
    resolvedAt: iso(row.resolvedAt),
    createdAt: isoRequired(row.createdAt),
  };
}

function toConsoleReport(row: ReportDeskRow): ConsoleReport {
  return consoleReportSchema.parse({
    id: row.id,
    publicId: row.publicId,
    url: row.url,
    body: row.body,
    reporterEmail: row.reporterEmail,
    reporterNote: row.reporterNote,
    status: row.status,
    resolutionNote: row.resolutionNote,
    itemId: row.itemId,
    createdAt: isoRequired(row.createdAt),
    updatedAt: isoRequired(row.updatedAt),
    trailCount: num(row.trailCount),
    latestTrail: row.latestTrail == null ? null : {
      toStatus: row.latestTrail.toStatus,
      actorLabel: row.latestTrail.actorLabel,
      occurredAt: isoRequired(row.latestTrail.occurredAt),
    },
  });
}

function toChatThread(row: ChatThreadRow): ConsoleChatThread {
  return {
    id: row.id,
    title: row.title,
    createdByLabel: row.createdByLabel,
    createdAt: isoRequired(row.createdAt),
    archivedAt: iso(row.archivedAt),
    messageCount: num(row.messageCount),
    lastMessageAt: iso(row.lastMessageAt),
  };
}

function toConsolePromptVersion(row: PromptVersionRow): ConsolePromptVersion {
  return consolePromptVersionSchema.parse({
    id: row.id,
    slug: row.slug,
    version: num(row.version),
    kind: row.kind as ConsolePromptVersion["kind"],
    template: row.template,
    modelProfile: row.modelProfile,
    notes: row.notes,
    activatedAt: iso(row.activatedAt),
    createdAt: isoRequired(row.createdAt),
  });
}

/** Provenance detail is jsonb in the database; it travels serialised, then
 *  through the same 500-bound truncation the quality details use. */
function serialiseProvenanceDetail(detail: unknown): string | null {
  if (detail == null) return null;
  if (typeof detail === "string") return detail;
  try {
    return JSON.stringify(detail);
  } catch {
    return String(detail);
  }
}

/** The keyset cursor both desk reads serve: the boundary row's instant and
 *  id, joined by `|`. The instant is ISO — it never carries the separator. */
const keysetCursor = (row: { createdAt: Ts; id: string }): string =>
  `${isoRequired(row.createdAt)}|${row.id}`;

function decodeKeyset(cursor: string): { at: string; id: string } {
  const index = cursor.indexOf("|");
  const at = index > 0 ? cursor.slice(0, index) : "";
  const id = index > 0 ? cursor.slice(index + 1) : "";
  if (!at || !/^\d{4}-\d{2}-\d{2}T/.test(at) || !id) {
    throw new ApiError("VALIDATION_ERROR", "The cursor is not a keyset cursor this read served.");
  }
  return { at, id };
}

/** The detail bound the contract serves (`≤ 500`); one "…" marks the cut. */
const MAX_CHECK_DETAIL = 500;

function truncateCheckDetail(detail: string | null): string | null {
  if (detail == null) return null;
  return detail.length > MAX_CHECK_DETAIL
    ? `${detail.slice(0, MAX_CHECK_DETAIL - 1)}…`
    : detail;
}

/** Which console surface an `ai_run` belongs to. Profiles are the primary
 *  key; `kind` breaks the tie for the public chat, which records its calls
 *  under the `fast` profile with `kind = 'chat'`. */
export function costSurfaceFor(profile: string, kind: string): CostSurface {
  if (profile.startsWith("briefing")) return "briefing";
  if (profile === "opsConsole" || profile === "ops_console") return "ops_console";
  if (profile === "chat" || kind === "chat") return "chat";
  if (profile === "embedding" || kind === "embed") return "embedding";
  return "other";
}

export type TrendInput = { firstSeenAt: Ts; observations7d: number; observationsPrior7d: number; now?: Date };

/** New when first seen inside the week; rising or declining on a quarter's
 *  movement against the prior week; otherwise stable. */
export function classifyTrend(input: TrendInput): "new" | "rising" | "stable" | "declining" {
  const now = input.now ?? new Date();
  const firstSeen = input.firstSeenAt ? new Date(input.firstSeenAt) : null;
  if (firstSeen && !Number.isNaN(firstSeen.getTime()) && now.getTime() - firstSeen.getTime() <= 7 * 24 * 60 * 60 * 1_000) {
    return "new";
  }
  if (input.observations7d > input.observationsPrior7d * 1.25) return "rising";
  if (input.observations7d < input.observationsPrior7d * 0.75) return "declining";
  return "stable";
}

/* ── The service ──────────────────────────────────────────────────────────── */

type Tx = Parameters<typeof setIdentity>[0];
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };

export type AdminConsoleOptions = {
  /** How a requeued job reaches the worker. Defaults to the briefing queue
   *  when one is bound; otherwise the next cron recovery tick picks it up. */
  dispatch?: ((job: ConsoleJobState) => Promise<void>) | null;
  /** How a manual outbox drain dispatches one row. Defaults to the real queue
   *  client; tests inject a stub so they never authenticate against it. */
  outboxDispatch?: ((row: unknown) => Promise<void>) | null;
  /** The runners behind `drainOutbox()` and `runMaintenanceTick()`. Defaults
   *  to the live exports, bound to `db()` exactly as the internal cron routes
   *  call them; tests inject stubs, because those exports bind their own
   *  connection and a test database is never reachable through `db()`. */
  drain?: (opts: { limit?: number }) => Promise<DrainResult>;
  runPrune?: () => Promise<{ rateLimits: number; idempotencyKeys: number }>;
  recoverBriefingJobs?: () => Promise<{
    recovered: number;
    configurationRecovered: number;
    processingResumed: number;
    dispatched: number;
    quarantined: number;
  }>;
  evaluateBriefingAlerts?: () => Promise<{ evaluated: number; created: number }>;
  /** The runner behind `runCollectionSweep()`. Defaults to the real export,
   *  bound to `db()` exactly as the internal cron ingest route calls it;
   *  tests inject a stub, because that export binds its own connection. */
  collectionSweep?: () => Promise<
    Array<{ sourceId: string; jobId: string; status: "queued" | "already_completed" | "dispatch_failed"; error?: string }>
  >;
  now?: () => Date;
};

export function adminConsoleService(db: unknown, options: AdminConsoleOptions = {}) {
  const repo = adminConsoleRepo(db);
  const run = db as Runner;
  const now = options.now ?? (() => new Date());
  const dispatch = options.dispatch === undefined
    ? (queueConfigured() ? (job: ConsoleJobState) => dispatchBriefingJob(job as never) : null)
    : options.dispatch;
  const drain = options.drain ?? ((opts: { limit?: number }) =>
    drainOutbox(db, { limit: opts.limit, dispatch: options.outboxDispatch ?? undefined }));
  /* The default runners are the cron's, which run as `app_service` — see the
   * note on `runMaintenanceTick`. An injected runner (tests) keeps the
   * caller's role, so a stub needs no database at all. */
  const asService = <T>(fn: () => Promise<T>) =>
    withDatabaseRole("app_service", "service:admin-console-maintenance", fn);
  const pruneRunner = options.runPrune ?? (() => asService(runMaintenance));
  const recoverRunner = options.recoverBriefingJobs ?? (() => asService(recoverAndDispatchBriefingJobs));
  const alertsRunner = options.evaluateBriefingAlerts ?? (() => asService(() => evaluateAndQueueBriefingAlerts()));
  const collectionSweep = options.collectionSweep ?? (() => enqueueDueCollectionJobs());

  return {
    async overview(): Promise<ConsoleOverview> {
      const [row, lastRun] = await Promise.all([repo.overview(), repo.lastRun()]);
      const at = now();
      const paused = row?.automaticPublicationPaused ?? true;
      const processing = briefingFeatures().processing;
      const critical = num(row?.criticalAlerts);
      const stuck = num(row?.stuckJobs);
      const reasons: string[] = [];
      if (paused) reasons.push("Automatic publication is paused.");
      if (!processing) reasons.push("Editorial processing is disabled for this deployment (BRIEFING_PROCESSING_ENABLED).");
      if (critical > 0) reasons.push(`${critical} critical alert${critical === 1 ? " is" : "s are"} open.`);
      if (stuck > 0) reasons.push(`${stuck} job${stuck === 1 ? " is" : "s are"} stuck with an expired lease.`);
      const nextTick = nextCronTick(COLLECTION_SCHEDULE.schedule, at);
      return consoleOverviewSchema.parse({
        generatedAt: at.toISOString(),
        systemActive: reasons.length === 0,
        inactiveReasons: reasons,
        automaticPublicationPaused: paused,
        health: {
          collection: {
            state: row?.lastCollectedAt ? "observed" : "unknown",
            reason: row?.lastCollectedAt ? "collection_observed" : "no_collection_observation",
            observedAt: iso(row?.lastCollectedAt),
          },
          processing: {
            state: !processing ? "paused" : stuck > 0 || num(row?.quarantined) > 0 ? "degraded" : row?.lastProcessedAt ? "observed" : "configured",
            reason: !processing ? "processing_disabled" : stuck > 0 || num(row?.quarantined) > 0 ? "jobs_need_attention" : row?.lastProcessedAt ? "processing_observed" : "processing_configured",
            observedAt: iso(row?.lastProcessedAt),
          },
          publication: {
            state: row?.automaticPublicationPaused == null ? "unknown" : paused ? "paused" : row?.lastPublishedAt ? "observed" : "configured",
            reason: row?.automaticPublicationPaused == null ? "publication_unknown" : paused ? "publication_paused" : "publication_configured",
            observedAt: iso(row?.lastPublishedAt),
          },
        },
        attention: [
          ...(critical > 0 ? [{ code: "critical_alerts", severity: "critical", count: critical }] : []),
          ...(stuck > 0 ? [{ code: "stuck_jobs", severity: "critical", count: stuck }] : []),
          ...(num(row?.quarantined) > 0 ? [{ code: "quarantined_jobs", severity: "warning", count: num(row?.quarantined) }] : []),
          ...(!processing ? [{ code: "processing_disabled", severity: "warning", count: 1 }] : []),
          ...(paused ? [{ code: "publication_paused", severity: "info", count: 1 }] : []),
        ],
        lastRun: {
          at: iso(lastRun?.at),
          localDate: lastRun?.localDate ?? null,
          stage: lastRun?.stage ?? null,
          status: lastRun?.status ?? null,
        },
        nextRun: {
          at: nextTick ? nextTick.toISOString() : null,
          schedule: COLLECTION_SCHEDULE.schedule,
          path: COLLECTION_SCHEDULE.path,
        },
        counts24h: {
          collected: num(row?.collected),
          processed: num(row?.processed),
          drafted: num(row?.drafted),
          published: num(row?.published),
          failedJobs: num(row?.failedJobs),
        },
        openAlerts: { critical, warning: num(row?.warningAlerts) },
        stuckJobs: stuck,
        quarantined: num(row?.quarantined),
      });
    },

    async pipeline(): Promise<ConsolePipeline> {
      const [stages, attention, recent, editions] = await Promise.all([
        repo.stages(), repo.attentionJobs(50), repo.recentJobs(50), repo.editions(14),
      ]);
      const byStage = new Map(stages.map((row) => [row.stage, row]));
      return consolePipelineSchema.parse({
        generatedAt: now().toISOString(),
        processingPaused: !briefingFeatures().processing,
        stages: PIPELINE_STAGES.map((stage) => {
          const row = byStage.get(stage);
          return {
            stage,
            pending: num(row?.pending),
            running: num(row?.running),
            completed24h: num(row?.completed24h),
            quarantined: num(row?.quarantined),
            stuck: num(row?.stuck),
            oldestPendingAt: iso(row?.oldestPendingAt),
            averageDurationMs: row?.averageDurationMs == null ? null : Math.max(0, Math.round(num(row.averageDurationMs))),
            lastError: row?.lastError ?? null,
          };
        }),
        attention: attention.map(toJob),
        recentJobs: recent.map(toJob),
        editions: editions.map((row) => ({
          id: row.id,
          localDate: row.localDate,
          status: row.status,
          collectionOpenedAt: isoRequired(row.collectionOpenedAt),
          collectionClosedAt: iso(row.collectionClosedAt),
          publishedAt: iso(row.publishedAt),
        })),
      });
    },

    /**
     * The briefing pipeline's own quality audit rows, shaped into a per-
     * candidate matrix. The check-name list and its order come from
     * `REQUIRED_QUALITY_CHECKS` — the same frozen list the SQL publish gate
     * counts — so the console can never show a check the pipeline stopped
     * recording, and a check the pipeline adds appears in the required list
     * without this file ever changing. A check name the list does not know
     * (a row from an older contract) sorts after the known ones, by name.
     */
    async qualityChecks(input: ListQualityChecks): Promise<ConsoleQualityChecks> {
      const rows = await repo.qualityChecks(input);
      const ordinal = new Map<string, number>(REQUIRED_QUALITY_CHECKS.map((name, index) => [name, index]));
      const grouped = new Map<string, QualityCheckRow[]>();
      for (const row of rows) {
        const key = `${row.runId}\u0000${row.candidateKey}`;
        const list = grouped.get(key);
        if (list) list.push(row);
        else grouped.set(key, [row]);
      }
      const candidates: QualityCheckCandidate[] = [...grouped.values()].map((list) => {
        const head = list[0]!;
        const checks: QualityCheckResult[] = list
          .map((row) => ({
            checkName: row.checkName,
            status: row.status as QualityCheckResult["status"],
            detail: truncateCheckDetail(row.detail),
          }))
          .sort((a, b) => {
            const at = (check: QualityCheckResult) => ordinal.get(check.checkName);
            if (at(a) !== undefined && at(b) !== undefined) return at(a)! - at(b)!;
            if (at(a) !== undefined) return -1;
            if (at(b) !== undefined) return 1;
            return a.checkName.localeCompare(b.checkName);
          });
        const failCount = checks.filter((check) => check.status === "fail").length;
        return {
          runId: head.runId,
          localDate: head.localDate,
          candidateKey: head.candidateKey,
          stage: head.stage,
          passCount: checks.length - failCount,
          failCount,
          total: checks.length,
          passed: failCount === 0,
          checks,
        };
      });
      return consoleQualityChecksSchema.parse({
        generatedAt: now().toISOString(),
        required: [...REQUIRED_QUALITY_CHECKS],
        filter: { runId: input.runId ?? null, localDate: input.localDate ?? null },
        candidates,
      });
    },

    /**
     * One edition's full recovery payload: the stage ledger, the model runs
     * behind each stage, the stored artifacts (latest version per stage), the
     * claims the edition rests on, and the edition's stage jobs. Read-only —
     * the same aggregates `publications/repo.ts` serves for a single
     * publication, scoped here to the whole Israel-local calendar date.
     */
    async editionDrilldown(input: ListEditionDrilldown): Promise<ConsoleEditionDrilldown> {
      const [edition, runs, runAi, artifacts, claims, jobs] = await Promise.all([
        repo.edition(input.localDate), repo.editionRuns(input.localDate), repo.editionRunAi(input.localDate),
        repo.editionArtifacts(input.localDate), repo.editionClaims(input.localDate), repo.editionJobs(input.localDate),
      ]);
      if (!edition) throw notFound("Edition");
      return consoleEditionDrilldownSchema.parse({
        generatedAt: now().toISOString(),
        localDate: input.localDate,
        edition: {
          id: edition.id,
          localDate: edition.localDate,
          status: edition.status,
          contractVersion: edition.contractVersion,
          promptVersion: edition.promptVersion,
          collectionOpenedAt: isoRequired(edition.collectionOpenedAt),
          collectionClosedAt: iso(edition.collectionClosedAt),
          publishedAt: iso(edition.publishedAt),
        },
        runs: byStage(runs.map(toEditionRun)),
        runAi: byStage(runAi.map(toEditionRunAi)),
        artifacts: byStage(artifacts.map(toEditionArtifact)),
        claims: claims.map(toEditionClaim),
        jobs: jobs.map(toJob),
      });
    },

    /**
     * A source's fetch log, newest first, with the same day's roll-up. The
     * boundary comes back from the database, so the read and the aggregate
     * agree on one instant even around a DST change.
     */
    async sourceFetches(input: ListSourceFetches): Promise<ConsoleSourceFetches> {
      const exists = await repo.sourceExists(input.id);
      if (!exists) throw notFound("Source");
      const [fetches, today] = await Promise.all([repo.sourceFetches(input), repo.sourceFetchesToday(input.id)]);
      return consoleSourceFetchesSchema.parse({
        generatedAt: now().toISOString(),
        sourceId: input.id,
        limit: input.limit,
        fetches: fetches.map(toSourceFetch),
        today: {
          boundaryAt: isoRequired(today?.boundaryAt),
          attempts: num(today?.attempts),
          successes: num(today?.successes),
          partial: num(today?.partial),
          failed: num(today?.failed),
          itemsSeen: num(today?.itemsSeen),
          itemsNew: num(today?.itemsNew),
          lastError: today?.lastError ?? null,
        },
      });
    },

    /**
     * The reports desk read: inbound submissions newest first, each with its
     * append-only status-trail count and latest entry. Cross-domain by
     * design — the console is a read model over tables other modules own,
     * the same direct-SQL pattern `quarantineById` follows. The triage
     * writes stay with the reports module's own staff routes.
     */
    async reports(input: ListConsoleReports): Promise<ConsoleReports> {
      if (input.cursor) decodeKeyset(input.cursor);
      const rows = await repo.reports(input);
      const page = rows.slice(0, input.limit);
      const more = rows.length > input.limit;
      return consoleReportsSchema.parse({
        generatedAt: now().toISOString(),
        filter: { status: input.status ?? null },
        limit: input.limit,
        reports: page.map(toConsoleReport),
        nextCursor: more && page.length ? keysetCursor(page[page.length - 1]!) : null,
      });
    },

    /**
     * The moderation list for public chat: threads newest first with their
     * message counts and last-message-at, `(created_at, id)` keyset, ceiling
     * 50 on the wire — the same bound `chatThreads`' own keyset applies.
     */
    async chatThreads(input: ListChatThreadsQuery): Promise<ConsoleChatThreads> {
      if (input.cursor) decodeKeyset(input.cursor);
      const rows = await repo.chatThreads(input);
      const page = rows.slice(0, input.limit);
      const more = rows.length > input.limit;
      return consoleChatThreadsSchema.parse({
        generatedAt: now().toISOString(),
        limit: input.limit,
        threads: page.map(toChatThread),
        nextCursor: more && page.length ? keysetCursor(page[page.length - 1]!) : null,
      });
    },

    /**
     * One thread's full transcript in reading order: the messages, the tool
     * runs retrieval made behind each message, and — via the assistant
     * message's `ai_run_id` — the recorded model call with its cost. The
     * assistant linkage is the point: a conversation whose turns cannot be
     * attributed to a recorded run is one whose citations cannot be checked.
     */
    async chatTranscript(threadId: string): Promise<ConsoleChatTranscript> {
      const thread = await repo.chatThreadById(threadId);
      if (!thread) throw notFound("Chat thread");
      const [messages, toolRuns] = await Promise.all([
        repo.chatMessages(threadId), repo.chatToolRuns(threadId),
      ]);
      const runsByMessage = new Map<string, ChatToolRunRow[]>();
      for (const row of toolRuns) {
        const list = runsByMessage.get(row.messageId) ?? [];
        list.push(row);
        runsByMessage.set(row.messageId, list);
      }
      const runIds = [...new Set(messages.map((m) => m.aiRunId).filter((id): id is string => id !== null))];
      const aiRuns = await repo.chatAiRuns(runIds);
      const aiRunsById = new Map<string, ChatAiRunRow>(aiRuns.map((row) => [row.aiRunId, row]));
      return consoleChatTranscriptSchema.parse({
        generatedAt: now().toISOString(),
        thread: {
          id: thread.id,
          title: thread.title,
          createdByLabel: thread.createdByLabel,
          createdAt: isoRequired(thread.createdAt),
          archivedAt: iso(thread.archivedAt),
        },
        messages: messages.map((m: ChatMessageRow) => {
          const run = m.aiRunId ? aiRunsById.get(m.aiRunId) : undefined;
          return {
            id: m.id,
            seq: num(m.seq),
            role: m.role as "user" | "assistant" | "system",
            content: m.content,
            createdAt: isoRequired(m.createdAt),
            toolRuns: (runsByMessage.get(m.id) ?? []).map((row) => ({
              tool: row.tool,
              status: row.status,
              resultCount: num(row.resultCount),
              latencyMs: row.latencyMs == null ? null : num(row.latencyMs),
            })),
            run: run == null ? null : {
              aiRunId: run.aiRunId,
              model: run.model,
              profile: run.profile,
              inputTokens: run.inputTokens == null ? null : num(run.inputTokens),
              outputTokens: run.outputTokens == null ? null : num(run.outputTokens),
              costUsd: money(run.costUsd),
            },
          };
        }),
      });
    },

    /**
     * The machine's own internals, read-only: the embedding backlog (the
     * exact two-hash comparison `search/repo.ts` serves), the semantic arm's
     * honest answer from the SQL function, the public-read cache's process
     * counters, and the embedding ledger's day. Only figures those stores
     * actually expose.
     */
    async systemInternals(): Promise<ConsoleSystemInternals> {
      const [row, semanticArm] = await Promise.all([
        repo.systemInternals(), repo.systemSemanticArm(),
      ]);
      return consoleSystemInternalsSchema.parse({
        generatedAt: now().toISOString(),
        embeddingBacklog: {
          stale: num(row?.staleBacklog),
          indexed: num(row?.indexed),
        },
        semanticArm: semanticArm?.ok ?? false,
        publicReadCache: publicReadCacheStats(),
        embeddingRuns: {
          last24h: num(row?.embeddingRuns24h),
          lastRunAt: iso(row?.embeddingLastRunAt),
        },
      });
    },

    async sources(): Promise<ConsoleSources> {
      const [rows, families] = await Promise.all([repo.sources(), repo.families()]);
      const sources = rows.map((row) => ({
        id: row.id,
        slug: row.slug,
        name: row.name,
        kind: row.kind,
        active: row.active,
        family: row.familyId ? { id: row.familyId, slug: row.familySlug ?? "", label: row.familyLabel ?? "" } : null,
        /* The schema records no upstream/wire relation between sources;
           families are the independence unit. Always null until it does. */
        primarySourceId: null,
        feedUrl: row.feedUrl,
        homepageUrl: row.homepageUrl,
        language: row.language,
        country: row.country,
        verificationState: row.verificationState,
        verificationError: row.verificationError,
        disabledReason: row.disabledReason,
        consecutiveFailures: num(row.consecutiveFailures),
        lastFetchAt: iso(row.lastFetchAt),
        lastSuccessfulFetchAt: iso(row.lastSuccessfulFetchAt),
        lastError: row.lastError,
        week: {
          attempts: num(row.attempts),
          successes: num(row.successes),
          itemsSeen: num(row.itemsSeen),
          itemsNew: num(row.itemsNew),
          duplicates: num(row.duplicates),
        },
      }));
      return consoleSourcesSchema.parse({
        generatedAt: now().toISOString(),
        sources,
        families: families.map((family) => ({ id: family.id, slug: family.slug, label: family.label, sourceCount: num(family.sourceCount) })),
        totals: {
          active: sources.filter((source) => source.active).length,
          disabled: sources.filter((source) => !source.active).length,
          failing: sources.filter((source) => source.active && source.consecutiveFailures > 0).length,
        },
      });
    },

    async editorial(input?: ListEditorial): Promise<ConsoleEditorial> {
      const [counts, features] = await Promise.all([
        repo.editorialCounts(input), publicationService(db).homepageFeatures(),
      ]);
      const total = counts.filter((row) => !input?.status || row.status === input.status).reduce((sum, row) => sum + num(row.count), 0);
      const pages = input ? Math.max(1, Math.ceil(total / input.limit)) : 1;
      const page = input ? Math.min(input.page, pages) : 1;
      const cards = input ? await repo.editorialPage({ ...input, page }) : await repo.editorialCards(30);
      const countFor = (status: string) => num(counts.find((row) => row.status === status)?.count);
      const lane = (name: string): EditorialCard[] => cards
        .filter((row) => row.lane === name)
        .map((row) => ({
          id: row.id,
          publicId: row.publicId,
          title: row.title,
          summary: row.summary,
          section: row.section as EditorialCard["section"],
          status: row.status as EditorialCard["status"],
          featuredIsraelStory: row.featuredIsraelStory,
          homepageSlot: row.homepageSlot == null ? null : num(row.homepageSlot),
          briefingRunId: row.briefingRunId,
          evidenceCount: num(row.evidenceCount),
          createdAt: isoRequired(row.createdAt),
          updatedAt: isoRequired(row.updatedAt),
          publishedAt: iso(row.publishedAt),
        }));
      return consoleEditorialSchema.parse({
        generatedAt: now().toISOString(),
        counts: {
          draft: countFor("draft"),
          under_review: countFor("under_review"),
          approved: countFor("approved"),
          published: countFor("published"),
          updated: countFor("updated"),
          archived: countFor("archived"),
        },
        lanes: {
          drafts: lane("draft"),
          inReview: lane("under_review"),
          ready: lane("approved"),
          published: lane("published"),
          archived: lane("archived"),
        },
        homepageFeatures: features.map((feature) => ({ slot: num(feature.slot), publicationId: feature.publicationId })),
        ...(input ? { page: {
          items: cards.map((row) => ({
            id: row.id, publicId: row.publicId, title: row.title, summary: row.summary,
            section: row.section, status: row.status, featuredIsraelStory: row.featuredIsraelStory,
            homepageSlot: row.homepageSlot == null ? null : num(row.homepageSlot), briefingRunId: row.briefingRunId,
            evidenceCount: num(row.evidenceCount), createdAt: isoRequired(row.createdAt),
            updatedAt: isoRequired(row.updatedAt), publishedAt: iso(row.publishedAt),
          })), number: page, limit: input.limit, total, pages,
        } } : {}),
      });
    },

    async narratives(): Promise<ConsoleNarratives> {
      const [rows, links] = await Promise.all([repo.narratives(100), repo.narrativePublications()]);
      const at = now();
      const linksByNarrative = new Map<string, typeof links>();
      for (const link of links) {
        const list = linksByNarrative.get(link.narrativeId) ?? [];
        list.push(link);
        linksByNarrative.set(link.narrativeId, list);
      }
      const narratives = rows.map((row) => {
        const linked = linksByNarrative.get(row.id) ?? [];
        let supporting = 0;
        let contradicting = 0;
        let verificationState: string | null = null;
        for (const link of linked) {
          if (link.section !== "narrative_watch") continue;
          const details = link.narrativeWatchDetails as {
            supportingEvidenceIds?: unknown; contradictingEvidenceIds?: unknown; verificationState?: unknown;
          } | null;
          if (!details || typeof details !== "object") continue;
          supporting += Array.isArray(details.supportingEvidenceIds) ? details.supportingEvidenceIds.length : 0;
          contradicting += Array.isArray(details.contradictingEvidenceIds) ? details.contradictingEvidenceIds.length : 0;
          /* Links arrive newest first, so the first state seen is the latest. */
          if (verificationState === null && typeof details.verificationState === "string") {
            verificationState = details.verificationState;
          }
        }
        const observations7d = num(row.observations7d);
        const observationsPrior7d = num(row.observationsPrior7d);
        return {
          id: row.id,
          title: row.title,
          status: row.status,
          trend: classifyTrend({ firstSeenAt: row.firstSeenAt, observations7d, observationsPrior7d, now: at }),
          observations7d,
          observationsPrior7d,
          firstSeenAt: iso(row.firstSeenAt),
          lastSeenAt: iso(row.lastSeenAt),
          evidence: { supporting, contradicting, verificationState },
          linkedPublications: linked.map((link) => ({ id: link.id, publicId: link.publicId, title: link.title, status: link.status })),
        };
      });
      return consoleNarrativesSchema.parse({
        generatedAt: at.toISOString(),
        narratives,
        counts: {
          new: narratives.filter((row) => row.trend === "new").length,
          rising: narratives.filter((row) => row.trend === "rising").length,
          declining: narratives.filter((row) => row.trend === "declining").length,
        },
      });
    },

    async users(): Promise<ConsoleUsers> {
      const [users, grants, registered, actions] = await Promise.all([
        repo.users(), repo.grants(), repo.registeredUserCount(), repo.adminActions(50),
      ]);
      const grantsByUser = new Map<string, typeof grants>();
      for (const grant of grants) {
        const list = grantsByUser.get(grant.userId) ?? [];
        list.push(grant);
        grantsByUser.set(grant.userId, list);
      }
      /* Public readers share `app_user` with the administrator; what makes a
         row staff is holding a capability. */
      const staff = users
        .filter((user) => (grantsByUser.get(user.id) ?? []).length > 0)
        .map((user) => {
          const held = grantsByUser.get(user.id) ?? [];
          const names = new Set(held.map((grant) => grant.capability));
          return {
            id: user.id,
            email: user.email,
            displayName: user.displayName,
            isAutomated: user.isAutomated,
            isAdmin: ADMIN_CAPABILITIES.every((capability) => names.has(capability)),
            disabledAt: iso(user.disabledAt),
            createdAt: isoRequired(user.createdAt),
            capabilities: held.map((grant) => ({
              capability: grant.capability,
              grantedAt: isoRequired(grant.grantedAt),
              rationale: grant.rationale,
            })),
            lastActionAt: iso(user.lastActionAt),
          };
        });
      return consoleUsersSchema.parse({
        generatedAt: now().toISOString(),
        registeredPublicUsers: registered,
        staff,
        recentAdminActions: actions.map((row) => ({
          id: String(row.id),
          occurredAt: isoRequired(row.occurredAt),
          actorLabel: row.actorLabel,
          action: row.action,
          entityType: row.entityType,
          entityId: row.entityId,
        })),
        /* Sign-in refusals are logged by `authenticateAdmin`, not stored. */
        blockedSignInAttempts: null,
      });
    },

    async costs(): Promise<ConsoleCosts> {
      const [spend, byProfile, byDay, byMonth, search, searchActual] = await Promise.all([
        repo.spend(), repo.spendByProfile(), repo.spendByDay(), repo.spendByMonth(), repo.searchUsage(),
        repo.agentSearchActualSpend(),
      ]);
      const budgets = costBudgets();
      const last24HoursUsd = money(spend?.last24HoursUsd);
      const last30DaysUsd = money(spend?.last30DaysUsd);
      const briefing30DaysUsd = money(spend?.briefing30DaysUsd);
      const successfulQueries = num(search?.successful);
      const unitCost = agentSearchEstimatedUnitCostUsd();
      const estimatedSearchSpend = unitCost === undefined ? null : successfulQueries * unitCost;

      const ratio = (spent: number, budget: number | null): number | null =>
        budget && budget > 0 ? spent / budget : null;
      const utilisation = {
        aiDaily: ratio(last24HoursUsd, budgets.ai.dailyUsd),
        aiMonthly: ratio(last30DaysUsd, budgets.ai.monthlyUsd),
        briefingMonthly: ratio(briefing30DaysUsd, budgets.briefing.monthlyUsd),
        searchMonthly: budgets.search.monthlyUsd !== null && estimatedSearchSpend !== null
          ? ratio(estimatedSearchSpend, budgets.search.monthlyUsd)
          : ratio(successfulQueries, budgets.search.monthlyQueries),
      };
      const warnings: string[] = [];
      const warn = (value: number | null, label: string) => {
        if (value !== null && value >= WARN_AT) warnings.push(`${label} is at ${Math.round(value * 100)}% of its budget.`);
      };
      warn(utilisation.aiDaily, "The daily AI budget");
      warn(utilisation.aiMonthly, "The monthly AI budget");
      warn(utilisation.briefingMonthly, "The monthly briefing AI budget");
      warn(utilisation.searchMonthly, "The monthly Agent Search allowance");
      if (!searchActual?.available) warnings.push("נתוני עלות החיפוש אינם זמינים: מסד הנתונים אינו כולל את עדכון 0052. שאר העלויות מוצגות כרגיל.");
      else if (num(searchActual.recorded) === 0) warnings.push("לא נרשמו עלויות חיפוש ב־30 הימים האחרונים; זה אינו סכום של אפס.");

      const surfaces = new Map<CostSurface, { calls: number; costUsd: number }>();
      const kinds = new Map<string, { calls: number; costUsd: number }>();
      const models = new Map<string, { model: string; profile: string; calls: number; costUsd: number }>();
      for (const row of byProfile) {
        const calls = num(row.calls);
        const costUsd = money(row.costUsd);
        const surface = surfaces.get(costSurfaceFor(row.profile, row.kind)) ?? { calls: 0, costUsd: 0 };
        surface.calls += calls; surface.costUsd += costUsd;
        surfaces.set(costSurfaceFor(row.profile, row.kind), surface);
        const kind = kinds.get(row.kind) ?? { calls: 0, costUsd: 0 };
        kind.calls += calls; kind.costUsd += costUsd;
        kinds.set(row.kind, kind);
        const key = `${row.model} ${row.profile}`;
        const model = models.get(key) ?? { model: row.model, profile: row.profile, calls: 0, costUsd: 0 };
        model.calls += calls; model.costUsd += costUsd;
        models.set(key, model);
      }
      const byCost = <T extends { costUsd: number }>(rows: T[]) => rows.sort((a, b) => b.costUsd - a.costUsd);

      return consoleCostsSchema.parse({
        generatedAt: now().toISOString(),
        budgets,
        spend: {
          today: money(spend?.today),
          last24HoursUsd,
          monthToDateUsd: money(spend?.monthToDateUsd),
          last30DaysUsd,
        },
        utilisation,
        warnAt: WARN_AT,
        warnings,
        byModel: byCost([...models.values()]),
        bySurface: byCost([...surfaces.entries()].map(([surface, totals]) => ({ surface, ...totals }))),
        byKind: byCost([...kinds.entries()].map(([kind, totals]) => ({ kind, ...totals }))),
        byDay: byDay.map((row) => ({ day: row.bucket, calls: num(row.calls), costUsd: money(row.costUsd) })),
        byMonth: byMonth.map((row) => ({ month: row.bucket, calls: num(row.calls), costUsd: money(row.costUsd) })),
        search: {
          attemptsThisMonth: num(search?.attempts),
          successfulQueriesThisMonth: successfulQueries,
          estimatedSpendUsd: estimatedSearchSpend,
          ...(searchActual?.available && num(searchActual.recorded) > 0 ? { actualSpendUsd: money(searchActual.actual30d) } : {}),
          actualSpendStatus: !searchActual?.available ? "schema_unavailable" : num(searchActual.recorded) > 0 ? "recorded" : "unrecorded",
        },
      });
    },

    async audit(input: ListAudit): Promise<AuditPage> {
      const rows = await repo.auditPage(input);
      const page = rows.slice(0, input.limit);
      const more = rows.length > input.limit;
      return auditPageSchema.parse({
        entries: page.map(toAuditEntry),
        nextBefore: more && page.length ? String(page[page.length - 1]!.id) : null,
      });
    },

    async auditEntry(id: string): Promise<AuditEntry> {
      if (!/^\d+$/.test(id)) throw notFound("Audit entry");
      const row = await repo.auditEntry(id);
      if (!row) throw notFound("Audit entry");
      return auditEntrySchema.parse({
        ...toAuditEntry(row),
        beforeState: row.beforeState ?? null,
        afterState: row.afterState ?? null,
      });
    },

    async security(request?: Request): Promise<ConsoleSecurity> {
      const [events, changes] = await Promise.all([
        repo.auditByActionPrefixes(["auth.", "security.", "ops."], 50),
        repo.auditByActionPrefixes(["capability."], 50),
      ]);
      return consoleSecuritySchema.parse({
        generatedAt: now().toISOString(),
        secrets: secretsReport(request),
        integrations: configuredIntegrations(request),
        resourceFingerprints: briefingResourceFingerprints(),
        /* Deep health has its own route; nothing in this process holds its
           last result. */
        lastProbe: null,
        recentSecurityEvents: events.map((row) => ({
          id: String(row.id), occurredAt: isoRequired(row.occurredAt), actorLabel: row.actorLabel, action: row.action,
        })),
        capabilityChanges: changes.map((row) => ({
          id: String(row.id), occurredAt: isoRequired(row.occurredAt), actorLabel: row.actorLabel, action: row.action, entityId: row.entityId,
        })),
      });
    },

    async incidents(): Promise<ConsoleIncidents> {
      const [open, resolved, stuck, quarantined, failedRuns, quarantine, outbox] = await Promise.all([
        repo.openAlerts(50), repo.recentlyResolvedAlerts(50), repo.stuckJobs(50), repo.quarantinedJobs(50),
        repo.failedRuns(50), repo.openQuarantine(50), repo.outbox(),
      ]);
      return consoleIncidentsSchema.parse({
        generatedAt: now().toISOString(),
        openAlerts: open.map(toAlert),
        recentlyResolved: resolved.map(toAlert),
        stuckJobs: stuck.map(toJob),
        quarantinedJobs: quarantined.map(toJob),
        failedRuns: failedRuns.map((row) => ({
          id: row.id, localDate: row.localDate, stage: row.stage, error: row.error, startedAt: isoRequired(row.startedAt),
        })),
        quarantine: quarantine.map((row) => ({
          id: row.id, candidateKey: row.candidateKey, stage: row.stage, reason: row.reason, createdAt: isoRequired(row.createdAt),
        })),
        outbox: {
          undelivered: num(outbox?.undelivered),
          oldestAt: iso(outbox?.oldestAt),
          deadLettered: num(outbox?.deadLettered),
        },
      });
    },

    async settings(): Promise<ConsoleSettings> {
      const groups = new Map<string, number>();
      for (const query of BRIEFING_DISCOVERY_QUERIES) groups.set(query.group, (groups.get(query.group) ?? 0) + 1);
      return consoleSettingsSchema.parse({
        generatedAt: now().toISOString(),
        environment: appEnv(),
        region: queueRegion(),
        siteUrl: siteUrl(),
        schedules: SCHEDULES.map((entry) => ({ ...entry })),
        models: Object.entries(MODEL_PROFILES).map(([profile, slug]) => ({ profile, slug })),
        budgets: costBudgets(),
        sections: [...ARTICLE_SECTIONS],
        searchGroups: [...groups.entries()].map(([group, queries]) => ({ group, queries })),
        editable: false,
        source: "server/core/config.ts and Vercel environment variables",
      });
    },

    /* ── actions ──────────────────────────────────────────────────────────── */

    async retryJob(id: string, input: RetryJob, actor: Actor, requestId?: string): Promise<RetryJobResult> {
      const outcome = await run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = adminConsoleRepo(tx);
        const before = await r.jobById(id);
        if (!before) throw notFound("Briefing job");
        if (before.state === "completed") {
          throw new ApiError("PRECONDITION_FAILED", "A completed job is not retried from the console. Use the briefing run controls to regenerate an edition.");
        }
        const leaseLive = before.state === "running" && before.leaseUntil !== null && new Date(before.leaseUntil).getTime() >= Date.now();
        if (leaseLive) {
          throw new ApiError("PRECONDITION_FAILED", "This job is still running under a live worker lease. Retry it once the lease lapses.");
        }
        if (!input.resetAttempts && before.attempts >= before.maxAttempts) {
          throw new ApiError("PRECONDITION_FAILED", `This job has used all ${before.maxAttempts} attempts. Retry with resetAttempts to run it again.`);
        }
        const after = await r.requeueJob(id, input.resetAttempts);
        if (!after) throw new ApiError("CONFLICT", "The job changed state while it was being retried.");
        await writeAudit(tx as never, {
          actor,
          action: "ops.job.retried",
          entityType: "event",
          entityId: id,
          before: { state: before.state, attempts: before.attempts, lastError: before.lastError },
          after: { state: after.state, attempts: after.attempts, resetAttempts: input.resetAttempts },
          requestId,
        });
        return { before, after };
      });

      let dispatched = false;
      if (dispatch) {
        try {
          await dispatch(outcome.after);
          dispatched = true;
        } catch {
          /* The ledger is the authority: the job is pending and available,
             so the next recovery tick dispatches it even if the queue send
             failed here. */
          dispatched = false;
        }
      }
      return retryJobResultSchema.parse({
        jobId: id,
        previousState: outcome.before.state,
        state: outcome.after.state,
        dispatched,
      });
    },

    async resolveAlert(id: string, input: ResolveAlert, actor: Actor, requestId?: string): Promise<ConsoleAlert> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = adminConsoleRepo(tx);
        const before = await r.alertById(id);
        if (!before) throw notFound("Alert");
        if (before.resolvedAt) throw new ApiError("PRECONDITION_FAILED", "This alert is already resolved.");
        const after = await r.resolveAlert(id);
        if (!after) throw new ApiError("CONFLICT", "The alert changed while it was being resolved.");
        await writeAudit(tx as never, {
          actor,
          action: "ops.alert.resolved",
          entityType: "event",
          entityId: id,
          before: { kind: before.kind, severity: before.severity, message: before.message },
          after: { resolvedAt: iso(after.resolvedAt), note: input.note?.trim() || null },
          requestId,
        });
        return toAlert(after);
      });
    },

    async setSourceActive(id: string, input: SetSourceActive, actor: Actor, requestId?: string): Promise<{ id: string; active: boolean }> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const sources = sourceService(tx);
        const before = await sources.get(id);
        const config = before.config && typeof before.config === "object" ? before.config as Record<string, unknown> : {};
        const feedBacked = before.kind === "rss" || before.kind === "api" || before.kind === "agent_search";
        if (input.active && feedBacked && config.verificationState !== "verified") {
          throw new ApiError(
            "PRECONDITION_FAILED",
            `Verify this ${before.kind} source with a live fetch before enabling it (verification state: ${String(config.verificationState ?? "none")}).`,
          );
        }
        if (before.active === input.active) {
          throw new ApiError("PRECONDITION_FAILED", `This source is already ${input.active ? "enabled" : "disabled"}.`);
        }
        /* `sourceService.update` opens a savepoint inside this transaction, so
           the version, its audit row, and the console's own row commit as one. */
        const after = await sources.update(id, { active: input.active, changeSummary: input.reason }, actor, requestId);
        await writeAudit(tx as never, {
          actor,
          action: input.active ? "ops.source.enabled" : "ops.source.disabled",
          entityType: "source",
          entityId: id,
          before: { active: before.active },
          after: { active: after.active, reason: input.reason },
          requestId,
        });
        return { id: after.id, active: after.active };
      });
    },

    async publicationVersions(id: string): Promise<PublicationVersion[]> {
      const [head, rows] = await Promise.all([repo.publicationHead(id), repo.publicationVersions(id)]);
      if (!head) throw notFound("Publication");
      return rows.map((row) => publicationVersionSchema.parse({
        versionId: row.versionId,
        versionNumber: num(row.versionNumber),
        createdAt: isoRequired(row.createdAt),
        actorLabel: row.actorLabel,
        changeSummary: row.changeSummary,
        isHead: row.versionId === head.currentVersionId,
      }));
    },

    async rollbackPublication(id: string, input: RollbackPublication, actor: Actor, requestId?: string): Promise<{ id: string; versionNumber: number; restoredFrom: string }> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = adminConsoleRepo(tx);
        const head = await r.publicationHead(id);
        if (!head) throw notFound("Publication");
        const version = await r.publicationVersion(id, input.versionId);
        if (!version) throw notFound("Publication version");
        if (version.versionId === head.currentVersionId) {
          throw new ApiError("PRECONDITION_FAILED", "That version is already the current one.");
        }
        const snapshot = (version.snapshot ?? {}) as Record<string, unknown>;
        const versionNumber = num(version.versionNumber);
        /* Only the fields an editor may set travel back; status, approval,
           provenance and identifiers are not editorial content and stay as
           they are. The update contract strips `evidenceBasis`, and the
           publication service merges the stored value back in. */
        const fields = updatePublicationSchema.parse(prune({
          section: snapshot.section,
          editorialTopic: snapshot.editorialTopic ?? null,
          primaryActor: snapshot.primaryActor ?? null,
          arena: snapshot.arena ?? null,
          featuredIsraelStory: snapshot.featuredIsraelStory,
          narrativeWatchDetails: snapshot.narrativeWatchDetails ?? null,
          title: snapshot.title,
          summary: snapshot.summary ?? undefined,
          body: snapshot.body,
          scenarioIndicators: snapshot.scenarioIndicators ?? undefined,
          changeSummary: `Rolled back to version ${versionNumber}`,
        }));
        const after = await publicationService(tx).update(id, fields, actor, requestId);
        await writeAudit(tx as never, {
          actor,
          action: "ops.publication.rolled_back",
          entityType: after.kind,
          entityId: id,
          before: { currentVersionId: head.currentVersionId },
          after: { restoredFromVersionId: version.versionId, restoredFromVersionNumber: versionNumber, currentVersionId: after.currentVersionId },
          requestId,
        });
        const versions = await r.publicationVersions(id);
        return { id, versionNumber: num(versions[0]?.versionNumber ?? 0), restoredFrom: version.versionId };
      });
    },

    /**
     * Drains pending outbox rows through `drainOutbox` — the same export the
     * internal cron route runs, so a stuck backlog needs no cron wait. The
     * drain dispatches per row with autocommit updates: no single transaction
     * wraps it, so the audit row goes in its own transaction after the fact,
     * the same separation `retryJob` draws between its commit and its queue
     * send. Idempotent by nature — a second call drains whatever remains.
     */
    async drainOutbox(input: DrainOutbox, actor: Actor, requestId?: string): Promise<DrainOutboxResult> {
      const outcome = await drain({ limit: input.limit });
      await run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        await writeAudit(tx as never, {
          actor,
          action: "ops.outbox.drained",
          entityType: "system",
          entityId: null,
          after: outcome,
          requestId,
        });
      });
      return drainOutboxResultSchema.parse(outcome);
    },

    /**
     * The maintenance cron's sequence, on demand: prune first, then job
     * recovery, then alert evaluation — the order the internal cron route
     * lists its runners. Read the returned counts against the audit row.
     */
    async runMaintenanceTick(actor: Actor, requestId?: string): Promise<MaintenanceTickResult> {
      /* The runners are the cron's, and the cron reaches them as
       * `app_service` — migration 0022 grants the prune functions to that
       * role alone, so under the console route's `app_staff` role the prune
       * call was denied and this button answered 500 everywhere. Defaults
       * escalate to the service role; an injected runner (tests) keeps the
       * caller's role. The operator's audit row below still runs as the
       * staff actor. */
      const maintenance = await pruneRunner();
      const briefingJobs = await recoverRunner();
      const briefingAlerts = await alertsRunner();
      await run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        await writeAudit(tx as never, {
          actor,
          action: "ops.maintenance.tick",
          entityType: "system",
          entityId: null,
          after: { maintenance, briefingJobs, briefingAlerts },
          requestId,
        });
      });
      return maintenanceTickResultSchema.parse({ maintenance, briefingJobs, briefingAlerts });
    },

    /**
     * Archives a public-chat thread from the moderation desk. `archived_at`
     * had no write path anywhere before this: the chat module owns no
     * archival of its own, so the recovery write lives with the console's
     * other by-id recovery writes, refusing an already-archived thread and
     * auditing in the same transaction.
     */
    async archiveChatThread(id: string, actor: Actor, requestId?: string): Promise<ArchiveChatThreadResult> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = adminConsoleRepo(tx);
        const before = await r.chatThreadById(id);
        if (!before) throw notFound("Chat thread");
        if (before.archivedAt) {
          throw new ApiError("PRECONDITION_FAILED", "This chat thread is already archived.");
        }
        const after = await r.archiveChatThread(id);
        if (!after) throw new ApiError("CONFLICT", "The thread changed while it was being archived.");
        await writeAudit(tx as never, {
          actor,
          action: "ops.chat.thread_archived",
          entityType: "system",
          entityId: id,
          before: { archivedAt: null },
          after: { title: before.title, createdByLabel: before.createdByLabel, createdAt: isoRequired(before.createdAt) },
          requestId,
        });
        return archiveChatThreadResultSchema.parse({
          id: after.id,
          archivedAt: isoRequired(after.archivedAt),
          wasArchived: true,
        });
      });
    },

    /**
     * The ingest cron's collection half, on demand. The runner is exactly
     * what the cron route calls — `enqueueDueCollectionJobs`, whose gates
     * (`briefingFeatures().collection`, the source allowlist, the Agent
     * Search ceilings and `shouldCollectSource`) enqueue only due sources,
     * nothing more. Like the drain and the maintenance tick, the sweep
     * itself dispatches outside any single transaction, so its audit row
     * goes in its own transaction after the fact.
     */
    async runCollectionSweep(actor: Actor, requestId?: string): Promise<CollectSweepResult> {
      const paused = !briefingFeatures().collection;
      const results = paused ? [] : await collectionSweep();
      const outcome = {
        ranAt: now().toISOString(),
        status: (paused ? "paused" : "ran") as "ran" | "paused",
        enqueued: results.filter((row) => row.status === "queued").length,
        alreadyCompleted: results.filter((row) => row.status === "already_completed").length,
        dispatchFailed: results.filter((row) => row.status === "dispatch_failed").length,
        results: results.map((row) => ({
          sourceId: row.sourceId,
          jobId: row.jobId,
          status: row.status,
          error: row.error ?? null,
        })),
      };
      await run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        await writeAudit(tx as never, {
          actor,
          action: "ops.collection.sweep",
          entityType: "system",
          entityId: null,
          after: { status: outcome.status, enqueued: outcome.enqueued, alreadyCompleted: outcome.alreadyCompleted, dispatchFailed: outcome.dispatchFailed },
          requestId,
        });
      });
      return collectSweepResultSchema.parse(outcome);
    },

    /** Marks a quality-quarantine candidate resolved once its cause is dealt
     *  with — the recovery twin of `resolveAlert`, refusing an entry that is
     *  already closed. */
    async resolveQuarantine(id: string, input: ResolveQuarantine, actor: Actor, requestId?: string): Promise<QuarantineOutcome> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = adminConsoleRepo(tx);
        const before = await r.quarantineById(id);
        if (!before) throw notFound("Quarantine entry");
        if (before.status !== "open") {
          throw new ApiError("PRECONDITION_FAILED", `This quarantine entry is already ${before.status}.`);
        }
        const after = await r.closeQuarantine(id, "resolved");
        if (!after) throw new ApiError("CONFLICT", "The quarantine entry changed while it was being resolved.");
        await writeAudit(tx as never, {
          actor,
          action: "ops.quarantine.resolved",
          entityType: "event",
          entityId: id,
          before: { status: before.status, reason: before.reason },
          after: { status: "resolved", note: input.note?.trim() || null },
          requestId,
        });
        return toQuarantineOutcome(after);
      });
    },

    /** Removes a quarantine candidate from the recovery queue with no re-run.
     *  A note is required on the wire — discarding without a stated reason is
     *  a contract failure at the route boundary, never here. */
    async discardQuarantine(id: string, input: DiscardQuarantine, actor: Actor, requestId?: string): Promise<QuarantineOutcome> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = adminConsoleRepo(tx);
        const before = await r.quarantineById(id);
        if (!before) throw notFound("Quarantine entry");
        if (before.status !== "open") {
          throw new ApiError("PRECONDITION_FAILED", `This quarantine entry is already ${before.status}.`);
        }
        const after = await r.closeQuarantine(id, "discarded");
        if (!after) throw new ApiError("CONFLICT", "The quarantine entry changed while it was being discarded.");
        await writeAudit(tx as never, {
          actor,
          action: "ops.quarantine.discarded",
          entityType: "event",
          entityId: id,
          before: { status: before.status, reason: before.reason },
          after: { status: "discarded", note: input.note },
          requestId,
        });
        return toQuarantineOutcome(after);
      });
    },

    /* ── prompt registry ──────────────────────────────────────────────────── */

    /**
     * The whole prompt registry, grouped by slug: every version with its
     * active flag and the exact template text. This is the read an operator
     * checks before activating — activation changes what every future model
     * call sees, and the change is invisible unless the current text is
     * visible first.
     */
    async prompts(): Promise<ConsolePrompts> {
      const rows = await repo.promptVersions();
      const bySlug = new Map<string, PromptVersionRow[]>();
      for (const row of rows) {
        const list = bySlug.get(row.slug) ?? [];
        list.push(row);
        bySlug.set(row.slug, list);
      }
      return consolePromptsSchema.parse({
        generatedAt: now().toISOString(),
        prompts: [...bySlug.values()].map((versions) => {
          const head = versions[0]!;
          const active = versions.find((row) => row.activatedAt != null);
          return {
            slug: head.slug,
            kind: head.kind as ConsolePrompts["prompts"][number]["kind"],
            activeVersion: active == null ? null : num(active.version),
            versions: versions.map(toConsolePromptVersion),
          };
        }),
      });
    },

    /**
     * Appends one inactive version to the registry. The version number is
     * computed in the transaction the same way `recordVersion()` computes
     * its own, so a concurrent insert collides on the `(slug, version)`
     * unique index rather than silently skipping a number. Append-only:
     * nothing here can rewrite an existing version.
     */
    async insertPromptVersion(input: InsertPromptVersion, actor: Actor, requestId?: string): Promise<PromptVersionInserted> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = adminConsoleRepo(tx);
        const next = Math.max(1, num((await r.nextPromptVersion(input.slug))?.next));
        const row = await r.insertPromptVersion({
          slug: input.slug,
          version: next,
          kind: input.kind,
          template: input.template,
          modelProfile: input.modelProfile?.trim() || "fast",
          notes: input.notes?.trim() || null,
        });
        await writeAudit(tx as never, {
          actor,
          action: "ops.prompt.inserted",
          entityType: "system",
          entityId: row!.id,
          after: { slug: row!.slug, version: row!.version, kind: row!.kind, modelProfile: row!.modelProfile },
          requestId,
        });
        return promptVersionInsertedSchema.parse({
          id: row!.id,
          slug: row!.slug,
          version: row!.version,
          activatedAt: iso(row!.activatedAt),
        });
      });
    },

    /**
     * Activates one version of a slug through the SQL function
     * `activate_prompt()` — the only path the append-only trigger permits,
     * and the path direct database activation used before this route
     * existed. Refuses a version that does not exist, and refuses one that
     * is already active. DANGEROUS BY DESIGN: every future model call for
     * the slug reads this text from the next call on. The UI wires an
     * explicit confirmation; the audit row is the record of who chose to.
     */
    async activatePromptVersion(input: ActivatePromptVersion, actor: Actor, requestId?: string): Promise<PromptVersionActivated> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const r = adminConsoleRepo(tx);
        const before = await r.promptVersion(input.slug, input.version);
        if (!before) throw notFound("Prompt version");
        if (before.activatedAt != null) {
          throw new ApiError("PRECONDITION_FAILED", `Prompt "${input.slug}" is already at version ${input.version}.`);
        }
        await r.activatePrompt(input.slug, input.version);
        const after = await r.promptVersion(input.slug, input.version);
        if (!after?.activatedAt) throw new ApiError("CONFLICT", "The prompt changed while it was being activated.");
        await writeAudit(tx as never, {
          actor,
          action: "ops.prompt.activated",
          entityType: "system",
          entityId: after.id,
          before: { activatedAt: iso(before.activatedAt) },
          after: { slug: after.slug, version: after.version, modelProfile: after.modelProfile },
          requestId,
        });
        return promptVersionActivatedSchema.parse({
          slug: after.slug,
          version: after.version,
          activatedAt: isoRequired(after.activatedAt),
        });
      });
    },

    /* ── generic entity version reads ────────────────────────────────────── */

    /**
     * Any versioned entity's history, newest first — `publicationVersions`
     * generalised over the whole `entity_type` vocabulary. No head lookup:
     * unlike a publication, a generic entity's table is not known here, so
     * `isHead` is not offered and the newest row simply sorts first.
     */
    async entityVersions(input: ListEntityVersions): Promise<ConsoleEntityVersions> {
      const limit = Math.min(100, Math.max(1, Number(input.limit) || 20));
      const rows = await repo.entityVersions({ ...input, limit });
      if (rows.length === 0) throw notFound("Entity versions");
      return consoleEntityVersionsSchema.parse({
        generatedAt: now().toISOString(),
        entityType: input.entityType,
        entityId: input.entityId,
        limit,
        versions: rows.map((row: EntityVersionRow) => consoleEntityVersionSchema.parse({
          versionId: row.versionId,
          versionNumber: num(row.versionNumber),
          createdAt: isoRequired(row.createdAt),
          actorLabel: row.actorLabel,
          changeSummary: row.changeSummary,
          changeSource: row.changeSource as ConsoleEntityVersion["changeSource"],
          snapshot: row.snapshot ?? null,
        })),
      });
    },

    /**
     * One evidence row's provenance trail, newest first — the captured and
     * retrieved entries the evidence module opened, each naming its action,
     * its actor, and a detail serialised to the same 500 bound the quality
     * details use. The read a "where did this come from, and who touched it"
     * question is answered from.
     */
    async evidenceProvenance(evidenceId: string): Promise<ConsoleEvidenceProvenance> {
      const exists = await repo.evidenceExists(evidenceId);
      if (!exists) throw notFound("Evidence");
      const rows = await repo.evidenceProvenance(evidenceId);
      return consoleEvidenceProvenanceSchema.parse({
        generatedAt: now().toISOString(),
        evidenceId,
        entries: rows.map((row) => ({
          id: row.id,
          action: row.action,
          actorLabel: row.actorLabel,
          actorUserId: row.actorUserId,
          detail: truncateCheckDetail(serialiseProvenanceDetail(row.detail)),
          occurredAt: isoRequired(row.occurredAt),
        })),
      });
    },
  };
}

function costBudgets(): ConsoleCosts["budgets"] {
  const ai = aiBudgets();
  const briefing = briefingAiBudgets();
  return {
    ai: { dailyUsd: ai.daily ?? null, monthlyUsd: ai.monthly ?? null },
    briefing: { dailyUsd: briefing.daily, monthlyUsd: briefing.monthly },
    search: { monthlyQueries: agentSearchMonthlyLimit(), monthlyUsd: agentSearchMonthlyBudgetUsd() ?? null },
  };
}

const prune = (o: Record<string, unknown>) =>
  Object.fromEntries(Object.entries(o).filter(([, v]) => v !== undefined));

export type AdminConsoleService = ReturnType<typeof adminConsoleService>;
