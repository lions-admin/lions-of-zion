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
  auditEntrySchema,
  auditPageSchema,
  consoleCostsSchema,
  consoleEditorialSchema,
  consoleIncidentsSchema,
  consoleNarrativesSchema,
  consoleOverviewSchema,
  consolePipelineSchema,
  consoleSecuritySchema,
  consoleSettingsSchema,
  consoleSourcesSchema,
  consoleUsersSchema,
  PIPELINE_STAGES,
  publicationVersionSchema,
  retryJobResultSchema,
  type AuditEntry,
  type AuditPage,
  type ConsoleAlert,
  type ConsoleCosts,
  type ConsoleEditorial,
  type ConsoleIncidents,
  type ConsoleNarratives,
  type ConsoleOverview,
  type ConsolePipeline,
  type ConsoleSecurity,
  type ConsoleSettings,
  type ConsoleSources,
  type ConsoleUsers,
  type CostSurface,
  type EditorialCard,
  type ListAudit,
  type PipelineJob,
  type PublicationVersion,
  type ResolveAlert,
  type RetryJob,
  type RetryJobResult,
  type RollbackPublication,
  type SetSourceActive,
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
import { setIdentity } from "@/server/core/versioning";
import { ApiError, notFound } from "@/server/http/responses";
import { publicationService } from "@/server/modules/publications";
import { sourceService } from "@/server/modules/sources";
import { BRIEFING_DISCOVERY_QUERIES } from "@/server/modules/sources/catalog";
import { dispatchBriefingJob } from "@/server/modules/briefing/jobs";
import { adminConsoleRepo, type AuditRow, type AlertRow, type ConsoleJobState, type JobRow } from "./repo";

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
   is pinned against that file's source in the reads test. `war_update` is
   retired from composition and deliberately absent. */
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
  now?: () => Date;
};

export function adminConsoleService(db: unknown, options: AdminConsoleOptions = {}) {
  const repo = adminConsoleRepo(db);
  const run = db as Runner;
  const now = options.now ?? (() => new Date());
  const dispatch = options.dispatch === undefined
    ? (queueConfigured() ? (job: ConsoleJobState) => dispatchBriefingJob(job as never) : null)
    : options.dispatch;

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

    async editorial(): Promise<ConsoleEditorial> {
      const [counts, cards, features] = await Promise.all([
        repo.editorialCounts(), repo.editorialCards(30), publicationService(db).homepageFeatures(),
      ]);
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
      const [spend, byProfile, byDay, byMonth, search] = await Promise.all([
        repo.spend(), repo.spendByProfile(), repo.spendByDay(), repo.spendByMonth(), repo.searchUsage(),
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
