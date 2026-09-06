/**
 * Operations console — the wire shapes shared by the admin read routes, the
 * operations agent, and the console UI. Zod only.
 *
 * Everything the console shows beyond `briefing().summary()` is described
 * here, so the three surfaces that produce and consume it can be built
 * against one fixed vocabulary. Dates are ISO strings on the wire; bigint
 * identifiers (the audit log) are strings.
 *
 * Nothing here is a secret or a credential. The console shows *whether* a
 * provider is configured and one-way fingerprints, never a value.
 */

import { z } from "zod";
import {
  aiRunKindSchema,
  changeSourceSchema,
  entityTypeSchema,
  fetchStatusSchema,
  narrativeStatusSchema,
  publicationSectionSchema,
  publicationStatusSchema,
  reportStatusSchema,
  sourceKindSchema,
} from "./enums";

const isoDate = z.string();
const nullableIsoDate = isoDate.nullable();
const count = z.number().int().nonnegative();
const usd = z.number().nonnegative();

/* ── 1. Overview ──────────────────────────────────────────────────────────── */

export const consoleSubsystemSchema = z.object({
  state: z.enum(["configured", "observed", "paused", "degraded", "unknown"]),
  reason: z.string(),
  observedAt: nullableIsoDate,
});

/** The one screen an operator reads first. Every number is for the last 24
 *  hours unless its name says otherwise. */
export const consoleOverviewSchema = z.object({
  generatedAt: isoDate,
  /** False when automatic publication is paused, processing is paused, or a
   *  critical alert is open — the reasons say which. */
  systemActive: z.boolean(),
  inactiveReasons: z.array(z.string()),
  automaticPublicationPaused: z.boolean(),
  health: z.object({
    collection: consoleSubsystemSchema,
    processing: consoleSubsystemSchema,
    publication: consoleSubsystemSchema,
  }).optional(),
  attention: z.array(z.object({
    code: z.enum(["critical_alerts", "stuck_jobs", "quarantined_jobs", "processing_disabled", "publication_paused"]),
    severity: z.enum(["critical", "warning", "info"]),
    count,
  })).optional(),
  lastRun: z.object({
    at: nullableIsoDate,
    localDate: z.string().nullable(),
    stage: z.string().nullable(),
    status: z.string().nullable(),
  }),
  /** The next scheduled collection tick, derived from the cron table. */
  nextRun: z.object({ at: nullableIsoDate, schedule: z.string().nullable(), path: z.string().nullable() }),
  counts24h: z.object({
    collected: count,
    processed: count,
    drafted: count,
    published: count,
    failedJobs: count,
  }),
  openAlerts: z.object({ critical: count, warning: count }),
  stuckJobs: count,
  quarantined: count,
});
export type ConsoleOverview = z.infer<typeof consoleOverviewSchema>;

/* ── 2. Pipeline stages ───────────────────────────────────────────────────── */

export const PIPELINE_STAGES = ["collect", "enrich", "cluster", "triage", "draft", "quality", "publish"] as const;
export const pipelineStageSchema = z.enum(PIPELINE_STAGES);
export type PipelineStage = z.infer<typeof pipelineStageSchema>;

export const JOB_STATES = ["pending", "running", "completed", "quarantined"] as const;
export const jobStateSchema = z.enum(JOB_STATES);
export type JobState = z.infer<typeof jobStateSchema>;

export const pipelineStageStatusSchema = z.object({
  stage: pipelineStageSchema,
  pending: count,
  running: count,
  completed24h: count,
  quarantined: count,
  /** A running job whose lease has expired without a heartbeat. */
  stuck: count,
  oldestPendingAt: nullableIsoDate,
  averageDurationMs: z.number().nonnegative().nullable(),
  lastError: z.string().nullable(),
});
export type PipelineStageStatus = z.infer<typeof pipelineStageStatusSchema>;

export const pipelineJobSchema = z.object({
  id: z.uuid(),
  jobKey: z.string(),
  stage: pipelineStageSchema,
  localDate: z.string(),
  sourceId: z.uuid().nullable(),
  sourceName: z.string().nullable(),
  state: jobStateSchema,
  attempts: count,
  maxAttempts: count,
  availableAt: isoDate,
  leaseUntil: nullableIsoDate,
  heartbeatAt: nullableIsoDate,
  startedAt: nullableIsoDate,
  finishedAt: nullableIsoDate,
  lastError: z.string().nullable(),
  createdAt: isoDate,
});
export type PipelineJob = z.infer<typeof pipelineJobSchema>;

export const consolePipelineSchema = z.object({
  generatedAt: isoDate,
  processingPaused: z.boolean(),
  stages: z.array(pipelineStageStatusSchema),
  /** Jobs that need a person: stuck, quarantined, or failing on their last
   *  attempt. Newest first. */
  attention: z.array(pipelineJobSchema),
  recentJobs: z.array(pipelineJobSchema),
  editions: z.array(z.object({
    id: z.uuid(),
    localDate: z.string(),
    status: z.string(),
    collectionOpenedAt: isoDate,
    collectionClosedAt: nullableIsoDate,
    publishedAt: nullableIsoDate,
  })),
});
export type ConsolePipeline = z.infer<typeof consolePipelineSchema>;

/* ── 2b. Briefing quality checks ──────────────────────────────────────────── */

/**
 * The briefing pipeline's own audit rows, one per (run, candidate, check) as
 * `briefingRepo.recordQualityChecks` writes them. The rows carry model-
 * adjacent prose; the detail is truncated defensively to 500 characters by
 * the shaping side so a runaway failure string cannot blow up a console
 * render or a transcript — and the wire bound matches the bound here.
 */
export const qualityCheckResultSchema = z.object({
  checkName: z.string().min(1),
  status: z.enum(["pass", "fail"]),
  detail: z.string().max(500).nullable(),
});
export type QualityCheckResult = z.infer<typeof qualityCheckResultSchema>;

export const qualityCheckCandidateSchema = z.object({
  runId: z.uuid(),
  /** The run's Israel-local calendar date, echoed so a date-filtered read
   *  names the day without the caller holding it. */
  localDate: z.string(),
  candidateKey: z.string().min(1),
  stage: z.string(),
  passCount: count,
  failCount: count,
  total: count,
  /** True when every recorded check passed. */
  passed: z.boolean(),
  checks: z.array(qualityCheckResultSchema),
});
export type QualityCheckCandidate = z.infer<typeof qualityCheckCandidateSchema>;

/** Filter by exactly one of a run or an Israel-local calendar date. */
export const listQualityChecksSchema = z.object({
  runId: z.uuid().optional(),
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional(),
}).refine(
  (input) => (input.runId === undefined) !== (input.localDate === undefined),
  { message: "Filter by exactly one of runId or localDate." },
);
export type ListQualityChecks = z.infer<typeof listQualityChecksSchema>;

export const consoleQualityChecksSchema = z.object({
  generatedAt: isoDate,
  /** The check names the briefing quality module requires, in the order it
   *  runs them; a candidate's matrix is read against this list. */
  required: z.array(z.string().min(1)),
  filter: z.object({ runId: z.uuid().nullable(), localDate: z.string().nullable() }),
  candidates: z.array(qualityCheckCandidateSchema),
});
export type ConsoleQualityChecks = z.infer<typeof consoleQualityChecksSchema>;

/* ── 2c. Edition drilldown ────────────────────────────────────────────────── */

/** Filter by the edition's Israel-local calendar date — the same key the
 *  pipeline screens show, unique on `briefing_edition`. */
export const listEditionDrilldownSchema = z.object({
  localDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
});
export type ListEditionDrilldown = z.infer<typeof listEditionDrilldownSchema>;

export const consoleEditionRunSchema = z.object({
  id: z.uuid(),
  stage: z.string(),
  status: z.string(),
  inputCount: count,
  outputCount: count,
  errorMessage: z.string().nullable(),
  startedAt: isoDate,
  finishedAt: nullableIsoDate,
});
export type ConsoleEditionRun = z.infer<typeof consoleEditionRunSchema>;

export const consoleEditionRunAiSchema = z.object({
  stage: z.string(),
  aiRunId: z.uuid(),
  model: z.string(),
  profile: z.string(),
  kind: z.string(),
  inputTokens: count.nullable(),
  outputTokens: count.nullable(),
  costUsd: usd.nullable(),
  latencyMs: z.number().int().nonnegative().nullable(),
  status: z.string(),
  createdAt: isoDate,
});
export type ConsoleEditionRunAi = z.infer<typeof consoleEditionRunAiSchema>;

export const consoleEditionArtifactSchema = z.object({
  stage: z.string(),
  /** Only the latest version per stage travels on the wire. */
  artifactVersion: z.number().int().positive(),
  inputHash: z.string(),
  payload: z.unknown(),
  createdAt: isoDate,
});
export type ConsoleEditionArtifact = z.infer<typeof consoleEditionArtifactSchema>;

export const consoleEditionClaimSchema = z.object({
  itemId: z.uuid(),
  layer: z.enum(["source_claim", "observed_fact", "model_inference", "editorial_conclusion"]),
  machineAssessment: z.enum(["verified", "refuted", "misleading", "unsupported", "disputed", "unresolved"]),
  attributedTo: z.string().nullable(),
  uncertainty: z.string().nullable(),
  createdAt: isoDate,
});
export type ConsoleEditionClaim = z.infer<typeof consoleEditionClaimSchema>;

/** One edition's full recovery payload. The claims come back through the
 *  edition's publications (`publication_item` → `briefing_claim`), the only
 *  relation that scopes the item-keyed claim table to a calendar date. */
export const consoleEditionDrilldownSchema = z.object({
  generatedAt: isoDate,
  localDate: z.string(),
  edition: z.object({
    id: z.uuid(),
    localDate: z.string(),
    status: z.string(),
    contractVersion: z.string(),
    promptVersion: z.string(),
    collectionOpenedAt: isoDate,
    collectionClosedAt: nullableIsoDate,
    publishedAt: nullableIsoDate,
  }),
  runs: z.array(consoleEditionRunSchema),
  runAi: z.array(consoleEditionRunAiSchema),
  artifacts: z.array(consoleEditionArtifactSchema),
  claims: z.array(consoleEditionClaimSchema),
  jobs: z.array(pipelineJobSchema),
});
export type ConsoleEditionDrilldown = z.infer<typeof consoleEditionDrilldownSchema>;

/* ── 3. Sources ───────────────────────────────────────────────────────────── */

export const consoleSourceSchema = z.object({
  id: z.uuid(),
  slug: z.string(),
  name: z.string(),
  kind: sourceKindSchema,
  active: z.boolean(),
  family: z.object({ id: z.uuid(), slug: z.string(), label: z.string() }).nullable(),
  /** The publisher this source is a wire or syndication of, when known. */
  primarySourceId: z.uuid().nullable(),
  feedUrl: z.string().nullable(),
  homepageUrl: z.string().nullable(),
  language: z.string().nullable(),
  country: z.string().nullable(),
  verificationState: z.string().nullable(),
  verificationError: z.string().nullable(),
  disabledReason: z.string().nullable(),
  consecutiveFailures: count,
  lastFetchAt: nullableIsoDate,
  lastSuccessfulFetchAt: nullableIsoDate,
  lastError: z.string().nullable(),
  week: z.object({
    attempts: count,
    successes: count,
    itemsSeen: count,
    itemsNew: count,
    /** Items whose normalised content matched something already stored. */
    duplicates: count,
  }),
});
export type ConsoleSource = z.infer<typeof consoleSourceSchema>;

export const consoleSourcesSchema = z.object({
  generatedAt: isoDate,
  sources: z.array(consoleSourceSchema),
  families: z.array(z.object({ id: z.uuid(), slug: z.string(), label: z.string(), sourceCount: count })),
  totals: z.object({ active: count, disabled: count, failing: count }),
});
export type ConsoleSources = z.infer<typeof consoleSourcesSchema>;

/** Enable or disable a source from the console. Enabling without a
 *  verification fetch is refused for feed-backed kinds. */
export const setSourceActiveSchema = z.object({
  active: z.boolean(),
  reason: z.string().trim().min(1).max(500),
});
export type SetSourceActive = z.infer<typeof setSourceActiveSchema>;

/* ── 3b. Source fetch log ─────────────────────────────────────────────────── */

export const sourceFetchesQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type SourceFetchesQuery = z.infer<typeof sourceFetchesQuerySchema>;

/** One fetch attempt, newest first per source. Insert-only rows: the log is
 *  append-only evidence of what the source did, never a mutable status. */
export const sourceFetchSchema = z.object({
  id: z.uuid(),
  status: fetchStatusSchema,
  startedAt: isoDate,
  finishedAt: isoDate,
  httpStatus: count.nullable(),
  itemsSeen: count,
  itemsNew: count,
  errorMessage: z.string().nullable(),
  searchQuery: z.string().nullable(),
  rawBlobUrl: z.string().nullable(),
  rawByteSize: count.nullable(),
  createdAt: isoDate,
});
export type SourceFetch = z.infer<typeof sourceFetchSchema>;

export const listSourceFetchesSchema = sourceFetchesQuerySchema.extend({ id: z.uuid() });
export type ListSourceFetches = z.infer<typeof listSourceFetchesSchema>;

export const consoleSourceFetchesSchema = z.object({
  generatedAt: isoDate,
  sourceId: z.uuid(),
  limit: count,
  fetches: z.array(sourceFetchSchema),
  /** The same day as Israel-local midnight — boundary inclusive, so a fetch
   *  that started exactly at midnight counts. Failed fetches contribute their
   *  attempt and error but no items. */
  today: z.object({
    boundaryAt: isoDate,
    attempts: count,
    successes: count,
    partial: count,
    failed: count,
    itemsSeen: count,
    itemsNew: count,
    lastError: z.string().nullable(),
  }),
});
export type ConsoleSourceFetches = z.infer<typeof consoleSourceFetchesSchema>;

/* ── 4. Editorial desk ────────────────────────────────────────────────────── */

export const editorialCardSchema = z.object({
  id: z.uuid(),
  publicId: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  section: publicationSectionSchema,
  status: publicationStatusSchema,
  featuredIsraelStory: z.boolean(),
  homepagePlacement: z.object({ area: z.enum(["news", "fakeResistance", "people"]), position: z.enum(["lead", "secondary"]) }).nullable(),
  briefingRunId: z.uuid().nullable(),
  editorialRunId: z.uuid().nullable(),
  evidenceCount: count,
  createdAt: isoDate,
  updatedAt: isoDate,
  publishedAt: nullableIsoDate,
});
export type EditorialCard = z.infer<typeof editorialCardSchema>;

export const listEditorialSchema = z.object({
  page: z.coerce.number().int().min(1).max(100000).default(1),
  limit: z.coerce.number().int().min(1).max(100).default(25),
  status: publicationStatusSchema.optional(),
  briefingOnly: z.enum(["true", "false"]).default("false").transform((value) => value === "true"),
  q: z.string().trim().max(200).default(""),
});
export type ListEditorial = z.infer<typeof listEditorialSchema>;

export const consoleEditorialSchema = z.object({
  generatedAt: isoDate,
  counts: z.object({
    draft: count,
    under_review: count,
    approved: count,
    published: count,
    updated: count,
    archived: count,
  }),
  /** Newest first, capped per lane so the desk loads in one read. */
  lanes: z.object({
    drafts: z.array(editorialCardSchema),
    inReview: z.array(editorialCardSchema),
    ready: z.array(editorialCardSchema),
    published: z.array(editorialCardSchema),
    archived: z.array(editorialCardSchema),
  }),
  homepagePlacements: z.array(z.object({ area: z.enum(["news", "fakeResistance", "people"]), position: z.enum(["lead", "secondary"]), publicationId: z.uuid() })),
  page: z.object({
    items: z.array(editorialCardSchema),
    number: count,
    limit: count,
    total: count,
    pages: count,
  }).optional(),
});
export type ConsoleEditorial = z.infer<typeof consoleEditorialSchema>;

/* ── 5. Narratives ────────────────────────────────────────────────────────── */

export const TREND_DIRECTIONS = ["new", "rising", "stable", "declining"] as const;
export const trendDirectionSchema = z.enum(TREND_DIRECTIONS);

export const consoleNarrativeSchema = z.object({
  id: z.uuid(),
  title: z.string(),
  status: narrativeStatusSchema,
  trend: trendDirectionSchema,
  observations7d: count,
  observationsPrior7d: count,
  firstSeenAt: nullableIsoDate,
  lastSeenAt: nullableIsoDate,
  evidence: z.object({ supporting: count, contradicting: count, verificationState: z.string().nullable() }),
  linkedPublications: z.array(z.object({
    id: z.uuid(),
    publicId: z.string(),
    title: z.string(),
    status: publicationStatusSchema,
  })),
});
export type ConsoleNarrative = z.infer<typeof consoleNarrativeSchema>;

export const consoleNarrativesSchema = z.object({
  generatedAt: isoDate,
  narratives: z.array(consoleNarrativeSchema),
  counts: z.object({ new: count, rising: count, declining: count }),
});
export type ConsoleNarratives = z.infer<typeof consoleNarrativesSchema>;

/* ── 6. Users and permissions ─────────────────────────────────────────────── */

export const consoleUserSchema = z.object({
  id: z.uuid(),
  email: z.string().nullable(),
  displayName: z.string(),
  isAutomated: z.boolean(),
  isAdmin: z.boolean(),
  disabledAt: nullableIsoDate,
  createdAt: isoDate,
  capabilities: z.array(z.object({ capability: z.string(), grantedAt: isoDate, rationale: z.string() })),
  /** Latest audit row attributed to this user, which is the closest thing to
   *  "last active" the schema records. */
  lastActionAt: nullableIsoDate,
});
export type ConsoleUser = z.infer<typeof consoleUserSchema>;

export const consoleUsersSchema = z.object({
  generatedAt: isoDate,
  /** Public readers registered through the site sign-in. */
  registeredPublicUsers: count,
  staff: z.array(consoleUserSchema),
  recentAdminActions: z.array(z.object({
    id: z.string(),
    occurredAt: isoDate,
    actorLabel: z.string(),
    action: z.string(),
    entityType: entityTypeSchema,
    entityId: z.uuid().nullable(),
  })),
  /** Sign-in refusals are logged, not stored; null means "not recorded in
   *  the database", never zero. */
  blockedSignInAttempts: count.nullable(),
});
export type ConsoleUsers = z.infer<typeof consoleUsersSchema>;

/* ── 7. Costs and usage ───────────────────────────────────────────────────── */

export const COST_SURFACES = ["briefing", "chat", "ops_console", "embedding", "other"] as const;
export const costSurfaceSchema = z.enum(COST_SURFACES);
export type CostSurface = z.infer<typeof costSurfaceSchema>;

export const consoleCostsSchema = z.object({
  generatedAt: isoDate,
  budgets: z.object({
    ai: z.object({ dailyUsd: usd.nullable(), monthlyUsd: usd.nullable() }),
    briefing: z.object({ dailyUsd: usd.nullable(), monthlyUsd: usd.nullable() }),
    search: z.object({ monthlyQueries: count.nullable(), monthlyUsd: usd.nullable() }),
  }),
  spend: z.object({
    today: usd,
    last24HoursUsd: usd,
    monthToDateUsd: usd,
    last30DaysUsd: usd,
  }),
  /** Fraction of each budget consumed, for the warning threshold. */
  utilisation: z.object({
    aiDaily: z.number().nullable(),
    aiMonthly: z.number().nullable(),
    briefingMonthly: z.number().nullable(),
    searchMonthly: z.number().nullable(),
  }),
  /** True when any utilisation crosses `warnAt`. */
  warnAt: z.number().min(0).max(1),
  warnings: z.array(z.string()),
  byModel: z.array(z.object({ model: z.string(), profile: z.string(), calls: count, costUsd: usd })),
  bySurface: z.array(z.object({ surface: costSurfaceSchema, calls: count, costUsd: usd })),
  byKind: z.array(z.object({ kind: aiRunKindSchema, calls: count, costUsd: usd })),
  byDay: z.array(z.object({ day: z.string(), calls: count, costUsd: usd })),
  byMonth: z.array(z.object({ month: z.string(), calls: count, costUsd: usd })),
  search: z.object({
    attemptsThisMonth: count,
    successfulQueriesThisMonth: count,
    estimatedSpendUsd: usd.nullable(),
    /** What Agent Search fetches recorded themselves costing (30-day sum of
     *  `source_fetch.actual_cost_usd`): the per-query estimate written at
     *  fetch time when the unit rate is configured. Additive and optional —
     *  absent rather than zero when nothing reported a cost. */
    actualSpendUsd: usd.optional(),
    actualSpendStatus: z.enum(["recorded", "unrecorded", "schema_unavailable"]).optional(),
  }),
});
export type ConsoleCosts = z.infer<typeof consoleCostsSchema>;

/* ── 8. Audit ─────────────────────────────────────────────────────────────── */

export const auditEntrySchema = z.object({
  /** bigint on the wire. */
  id: z.string(),
  occurredAt: isoDate,
  actorUserId: z.uuid().nullable(),
  actorLabel: z.string(),
  action: z.string(),
  entityType: entityTypeSchema,
  entityId: z.uuid().nullable(),
  requestId: z.string().nullable(),
  /** Present only on a single-entry read; the list carries flags. */
  beforeState: z.unknown().optional(),
  afterState: z.unknown().optional(),
  hasBefore: z.boolean(),
  hasAfter: z.boolean(),
});
export type AuditEntry = z.infer<typeof auditEntrySchema>;

export const listAuditSchema = z.object({
  limit: z.coerce.number().int().min(1).max(200).default(50),
  /** The `id` of the last entry seen; entries older than it follow. */
  before: z.string().regex(/^\d+$/).optional(),
  entityType: entityTypeSchema.optional(),
  entityId: z.uuid().optional(),
  actor: z.string().trim().min(1).max(200).optional(),
  /** Prefix match on `action`, so `publication.` finds every publication event. */
  action: z.string().trim().min(1).max(120).optional(),
});
export type ListAudit = z.infer<typeof listAuditSchema>;

export const auditPageSchema = z.object({
  entries: z.array(auditEntrySchema),
  nextBefore: z.string().nullable(),
});
export type AuditPage = z.infer<typeof auditPageSchema>;

/* ── 9. Security and connections ─────────────────────────────────────────── */

export const consoleSecuritySchema = z.object({
  generatedAt: isoDate,
  /** Configured or not. Never the value. */
  secrets: z.array(z.object({ name: z.string(), configured: z.boolean(), purpose: z.string() })),
  integrations: z.record(z.string(), z.boolean()),
  resourceFingerprints: z.record(z.string(), z.string().nullable()),
  /** The last deep health probe, if one ran in this process. */
  lastProbe: z.object({
    at: isoDate,
    status: z.string(),
    checks: z.record(z.string(), z.object({ status: z.string(), latencyMs: z.number() })),
  }).nullable(),
  recentSecurityEvents: z.array(z.object({
    id: z.string(),
    occurredAt: isoDate,
    actorLabel: z.string(),
    action: z.string(),
  })),
  capabilityChanges: z.array(z.object({
    id: z.string(),
    occurredAt: isoDate,
    actorLabel: z.string(),
    action: z.string(),
    entityId: z.uuid().nullable(),
  })),
});
export type ConsoleSecurity = z.infer<typeof consoleSecuritySchema>;

/* ── 10. Incidents and recovery ───────────────────────────────────────────── */

export const consoleAlertSchema = z.object({
  id: z.uuid(),
  /** The alert's dedupe identity — the same recurring condition keeps one
   *  row and one fingerprint, so an operator can tell "this is still the
   *  Tuesday feed failure" from "this is a second, different failure". */
  fingerprint: z.string(),
  kind: z.string(),
  severity: z.enum(["warning", "critical"]),
  message: z.string(),
  details: z.unknown().nullable(),
  createdAt: isoDate,
  notifiedAt: nullableIsoDate,
  resolvedAt: nullableIsoDate,
});
export type ConsoleAlert = z.infer<typeof consoleAlertSchema>;

export const consoleIncidentsSchema = z.object({
  generatedAt: isoDate,
  openAlerts: z.array(consoleAlertSchema),
  recentlyResolved: z.array(consoleAlertSchema),
  stuckJobs: z.array(pipelineJobSchema),
  quarantinedJobs: z.array(pipelineJobSchema),
  failedRuns: z.array(z.object({
    id: z.uuid(),
    localDate: z.string(),
    stage: z.string(),
    error: z.string().nullable(),
    startedAt: isoDate,
  })),
  quarantine: z.array(z.object({
    id: z.uuid(),
    candidateKey: z.string(),
    stage: z.string(),
    reason: z.string(),
    createdAt: isoDate,
  })),
  /**
   * The outbox as the drain sees it. `byTopic` and `lastError` are what a
   * `count(*)` could not say for two days: 3,348 rows were undelivered and
   * the panel showed the number, while the reason — the queue refusing the
   * topic name on every send — sat in `last_error` on each of them.
   * `lastPublishedAt` null means no row has ever been handed to the queue.
   */
  outbox: z.object({
    undelivered: count,
    oldestAt: nullableIsoDate,
    deadLettered: count,
    lastPublishedAt: nullableIsoDate,
    lastError: z.string().nullable(),
    byTopic: z.array(z.object({
      topic: z.string(),
      pending: count,
      oldestAt: nullableIsoDate,
      maxAttempts: count,
      nextAvailableAt: nullableIsoDate,
    })),
  }),
});
export type ConsoleIncidents = z.infer<typeof consoleIncidentsSchema>;

export const resolveAlertSchema = z.object({ note: z.string().trim().max(500).optional() });
export type ResolveAlert = z.infer<typeof resolveAlertSchema>;

export const publicationVersionSchema = z.object({
  versionId: z.uuid(),
  versionNumber: z.number().int().positive(),
  createdAt: isoDate,
  actorLabel: z.string(),
  changeSummary: z.string().nullable(),
  isHead: z.boolean(),
});
export type PublicationVersion = z.infer<typeof publicationVersionSchema>;

export const rollbackPublicationSchema = z.object({ versionId: z.uuid() });
export type RollbackPublication = z.infer<typeof rollbackPublicationSchema>;

/* ── 10b. Manual outbox drain and maintenance tick ────────────────────────── */

export const drainOutboxSchema = z.object({
  /** Rows handed to the queue per call; the same ceiling `drainOutbox` itself
   *  applies. Omit to use that default. */
  limit: z.coerce.number().int().min(1).max(250).optional(),
});
export type DrainOutbox = z.infer<typeof drainOutboxSchema>;

export const drainOutboxResultSchema = z.object({
  attempted: count,
  dispatched: count,
  failed: count,
});
export type DrainOutboxResult = z.infer<typeof drainOutboxResultSchema>;

export const maintenanceTickResultSchema = z.object({
  maintenance: z.object({ rateLimits: count, idempotencyKeys: count }),
  briefingJobs: z.object({
    recovered: count,
    configurationRecovered: count,
    /** Compatibility-only: no legacy editorial processing can resume. */
    processingResumed: count,
    dispatched: count,
    quarantined: count,
  }),
  briefingAlerts: z.object({ evaluated: count, created: count }),
});
export type MaintenanceTickResult = z.infer<typeof maintenanceTickResultSchema>;

/* ── 10c. Quality quarantine decisions ───────────────────────────────────── */

export const resolveQuarantineSchema = z.object({ note: z.string().trim().max(500).optional() });
export type ResolveQuarantine = z.infer<typeof resolveQuarantineSchema>;

/** A note is required to discard: discarding a candidate removes it from the
 *  recovery queue with no re-run, so the reason must be stated. */
export const discardQuarantineSchema = z.object({ note: z.string().trim().min(1).max(500) });
export type DiscardQuarantine = z.infer<typeof discardQuarantineSchema>;

export const quarantineOutcomeSchema = z.object({
  id: z.uuid(),
  candidateKey: z.string(),
  stage: z.string(),
  reason: z.string(),
  status: z.enum(["open", "resolved", "discarded"]),
  resolvedAt: nullableIsoDate,
  createdAt: isoDate,
});
export type QuarantineOutcome = z.infer<typeof quarantineOutcomeSchema>;

/* ── 11. Settings (read-only in this phase) ───────────────────────────────── */

export const consoleSettingsSchema = z.object({
  generatedAt: isoDate,
  environment: z.string(),
  region: z.string(),
  siteUrl: z.string(),
  schedules: z.array(z.object({ path: z.string(), schedule: z.string(), description: z.string() })),
  models: z.array(z.object({ profile: z.string(), slug: z.string() })),
  budgets: consoleCostsSchema.shape.budgets,
  sections: z.array(z.string()),
  searchGroups: z.array(z.object({ group: z.string(), queries: count })),
  /** Where each value is set, so an operator knows what to change. */
  editable: z.literal(false),
  source: z.string(),
});
export type ConsoleSettings = z.infer<typeof consoleSettingsSchema>;

/* ── 12. The operations agent ─────────────────────────────────────────────── */

/**
 * Tool names are the vocabulary the model, the audit log and the UI share.
 * Each is one defined operation over a module's public index — the agent
 * has no other way to touch the system.
 */
export const OPS_TOOLS = [
  /* read */
  "get_overview",
  "get_pipeline",
  "get_sources",
  "get_editorial",
  "get_narratives",
  "get_users",
  "get_costs",
  "get_incidents",
  "get_quality_checks",
  "get_edition",
  "get_source_fetches",
  "get_security",
  "get_settings",
  "search_audit",
  "get_publication",
  "list_publications",
  /* operate — reversible */
  "resolve_alert",
  "verify_source",
  "sync_source_catalog",
  "set_source_active",
  "update_publication",
  "set_homepage_placement",
  "run_health_check",
  /* operate — irreversible, always confirmed */
  "publish_publication",
  "unpublish_publication",
  "archive_publication",
  "delete_publication",
  "rollback_publication",
] as const;
export const opsToolSchema = z.enum(OPS_TOOLS);
export type OpsTool = z.infer<typeof opsToolSchema>;

/** Tools that change what the public sees, spend budget again, or cannot be
 *  undone. The server refuses to run these without a confirmation token. */
export const CONFIRMED_OPS_TOOLS = [
  "publish_publication",
  "unpublish_publication",
  "archive_publication",
  "delete_publication",
  "rollback_publication",
  "set_source_active",
] as const satisfies readonly OpsTool[];

export const opsMessageRoleSchema = z.enum(["user", "assistant", "tool"]);

/** One transcript entry as the client holds it. The server is stateless
 *  across turns; the client sends the transcript back each time. */
export const opsMessageSchema = z.object({
  id: z.string(),
  role: opsMessageRoleSchema,
  content: z.string(),
  createdAt: isoDate,
  toolCalls: z.array(z.object({
    id: z.string(),
    tool: opsToolSchema,
    args: z.record(z.string(), z.unknown()),
    /** A summary the UI can show; the full result stays server-side. */
    resultSummary: z.string().nullable(),
    ok: z.boolean(),
    /* Optional and additive, so a client built before this field existed
       still parses. `aiRunId` is the turn's own `ai_run` row and `costUsd`
       its whole-turn figure — turn-attributed, never a per-tool split. */
    aiRunId: z.string().optional(),
    costUsd: usd.optional(),
  })).optional(),
});
export type OpsMessage = z.infer<typeof opsMessageSchema>;

/** A confirmation the server issued and the client must send back before an
 *  irreversible tool runs. `token` is signed server-side and expires. */
export const opsConfirmationSchema = z.object({
  id: z.string(),
  tool: opsToolSchema,
  args: z.record(z.string(), z.unknown()),
  /** Plain words: what happens if this is approved. */
  consequence: z.string(),
  target: z.string(),
  expiresAt: isoDate,
  token: z.string(),
});
export type OpsConfirmation = z.infer<typeof opsConfirmationSchema>;

export const opsChatRequestSchema = z.object({
  /** Prior turns, oldest first, without the message being sent now. */
  history: z.array(opsMessageSchema).max(200).default([]),
  message: z.string().trim().min(1).max(8_000),
  /** Decisions on confirmations issued by the previous turn. */
  confirmations: z.array(z.object({
    id: z.string(),
    token: z.string(),
    approved: z.boolean(),
  })).max(10).default([]),
});
export type OpsChatRequest = z.infer<typeof opsChatRequestSchema>;

export const opsChatResponseSchema = z.object({
  /** New entries to append to the transcript: tool turns and the reply. */
  messages: z.array(opsMessageSchema),
  pendingConfirmations: z.array(opsConfirmationSchema),
  model: z.string(),
  costUsd: usd,
  latencyMs: z.number().nonnegative(),
  /** True when the reply changed state the console should reload. */
  stateChanged: z.boolean(),
});
export type OpsChatResponse = z.infer<typeof opsChatResponseSchema>;

/** What the console reads to render the chat's capabilities honestly. */
export const opsCapabilitiesSchema = z.object({
  model: z.string(),
  tools: z.array(z.object({
    name: opsToolSchema,
    /**
     * What the operator reads, in Hebrew — a short name for the operation.
     *
     * Separate from `description` because the two serve different readers.
     * `description` is prompt text: the model reads it to decide when to call
     * the tool, and it stays in English, which is what the tool loop was
     * built and tested against. Translating it would change the model's
     * inputs, not just the interface. This is the console's label and nothing
     * reads it but a person.
     */
    label: z.string(),
    description: z.string(),
    requiresConfirmation: z.boolean(),
  })),
});
export type OpsCapabilities = z.infer<typeof opsCapabilitiesSchema>;

/* ── 13. Reports desk ─────────────────────────────────────────────────────── */

/** Filter by an optional status; page newest first on a
 *  `(created_at, id)` keyset — `report.id` is a random uuid, so the bigint
 *  `auditPage` cursor does not apply and the composite is what keeps
 *  same-millisecond inserts ordered. */
export const listConsoleReportsSchema = z.object({
  status: reportStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(50),
  /** `"<createdAt ISO>|<report id>"` — the keyset cursor `reports` serves. */
  cursor: z.string().optional(),
});
export type ListConsoleReports = z.infer<typeof listConsoleReportsSchema>;

export const consoleReportSchema = z.object({
  id: z.uuid(),
  publicId: z.string(),
  url: z.string().nullable(),
  body: z.string().nullable(),
  reporterEmail: z.string().nullable(),
  reporterNote: z.string().nullable(),
  status: reportStatusSchema,
  resolutionNote: z.string().nullable(),
  itemId: z.uuid().nullable(),
  createdAt: isoDate,
  updatedAt: isoDate,
  /** How many entries the append-only status trail holds for this report. */
  trailCount: count,
  /** The trail's latest entry, or null when the report was never moved. */
  latestTrail: z.object({
    toStatus: reportStatusSchema,
    actorLabel: z.string(),
    occurredAt: isoDate,
  }).nullable(),
});
export type ConsoleReport = z.infer<typeof consoleReportSchema>;

export const consoleReportsSchema = z.object({
  generatedAt: isoDate,
  filter: z.object({ status: reportStatusSchema.nullable() }),
  limit: count,
  reports: z.array(consoleReportSchema),
  nextCursor: z.string().nullable(),
});
export type ConsoleReports = z.infer<typeof consoleReportsSchema>;

/* ── 14. Public-chat moderation ───────────────────────────────────────────── */

export const listChatThreadsQuerySchema = z.object({
  limit: z.coerce.number().int().min(1).max(50).default(25),
  /** `"<createdAt ISO>|<thread id>"` — the keyset cursor `chatThreads` serves. */
  cursor: z.string().optional(),
});
export type ListChatThreadsQuery = z.infer<typeof listChatThreadsQuerySchema>;

export const consoleChatThreadSchema = z.object({
  id: z.uuid(),
  title: z.string().nullable(),
  createdByLabel: z.string(),
  createdAt: isoDate,
  archivedAt: nullableIsoDate,
  messageCount: count,
  lastMessageAt: nullableIsoDate,
});
export type ConsoleChatThread = z.infer<typeof consoleChatThreadSchema>;

export const consoleChatThreadsSchema = z.object({
  generatedAt: isoDate,
  limit: count,
  threads: z.array(consoleChatThreadSchema),
  nextCursor: z.string().nullable(),
});
export type ConsoleChatThreads = z.infer<typeof consoleChatThreadsSchema>;

/** One tool invocation from the thread's evidence trail. */
export const consoleChatToolRunSchema = z.object({
  tool: z.string(),
  status: z.string(),
  /** How many documents retrieval actually returned. */
  resultCount: count,
  latencyMs: z.number().int().nonnegative().nullable(),
});
export type ConsoleChatToolRun = z.infer<typeof consoleChatToolRunSchema>;

/** The recorded model call behind an assistant message, when it has one. */
export const consoleChatRunSchema = z.object({
  aiRunId: z.uuid(),
  model: z.string(),
  profile: z.string(),
  inputTokens: count.nullable(),
  outputTokens: count.nullable(),
  costUsd: usd,
});
export type ConsoleChatRun = z.infer<typeof consoleChatRunSchema>;

export const consoleChatMessageSchema = z.object({
  id: z.uuid(),
  seq: z.number().int().positive(),
  role: z.enum(["user", "assistant", "system"]),
  content: z.string(),
  createdAt: isoDate,
  toolRuns: z.array(consoleChatToolRunSchema),
  run: consoleChatRunSchema.nullable(),
});
export type ConsoleChatMessage = z.infer<typeof consoleChatMessageSchema>;

export const consoleChatTranscriptSchema = z.object({
  generatedAt: isoDate,
  thread: z.object({
    id: z.uuid(),
    title: z.string().nullable(),
    createdByLabel: z.string(),
    createdAt: isoDate,
    archivedAt: nullableIsoDate,
  }),
  messages: z.array(consoleChatMessageSchema),
});
export type ConsoleChatTranscript = z.infer<typeof consoleChatTranscriptSchema>;

export const archiveChatThreadResultSchema = z.object({
  id: z.uuid(),
  archivedAt: isoDate,
  wasArchived: z.literal(true),
});
export type ArchiveChatThreadResult = z.infer<typeof archiveChatThreadResultSchema>;

/* ── 15. System internals ─────────────────────────────────────────────────── */

/**
 * The read-only figures the operator needs to tell whether the machine is
 * keeping up: the embedding backlog (documents whose text has moved since
 * their embedding was computed), whether the semantic arm is live in this
 * database, the public-read cache's process counters, and the embedding model
 * runs of the last day. Only figures the underlying stores actually expose.
 */
export const consoleSystemInternalsSchema = z.object({
  generatedAt: isoDate,
  embeddingBacklog: z.object({
    /** Documents awaiting a re-embed. */
    stale: count,
    /** All documents in the search projection. */
    indexed: count,
  }),
  /** The SQL function's own answer — never inferred from results. */
  semanticArm: z.boolean(),
  publicReadCache: z.object({
    hits: count,
    misses: count,
    loads: count,
    hitRatio: z.number().min(0).max(1).nullable(),
    averageLoadMs: z.number().nonnegative().nullable(),
  }),
  embeddingRuns: z.object({ last24h: count, lastRunAt: nullableIsoDate }),
});
export type ConsoleSystemInternals = z.infer<typeof consoleSystemInternalsSchema>;

/* ── 16. Collection sweep on demand ───────────────────────────────────────── */

export const collectSweepResultSchema = z.object({
  ranAt: isoDate,
  status: z.enum(["ran", "paused"]),
  enqueued: count,
  alreadyCompleted: count,
  dispatchFailed: count,
  results: z.array(z.object({
    sourceId: z.uuid(),
    jobId: z.uuid(),
    status: z.enum(["queued", "already_completed", "dispatch_failed"]),
    error: z.string().nullable(),
  })),
});
export type CollectSweepResult = z.infer<typeof collectSweepResultSchema>;

/* ── 17. Prompt registry management ──────────────────────────────────────── */

/**
 * One prompt version as the registry holds it. The template travels in full:
 * the console's prompt desk is where an operator reads what every future
 * model call will see, and truncating it here would invite someone to fetch
 * the text from the database directly instead.
 */
export const consolePromptVersionSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  version: z.number().int().positive(),
  kind: aiRunKindSchema,
  template: z.string().min(1),
  modelProfile: z.string().min(1),
  notes: z.string().nullable(),
  activatedAt: nullableIsoDate,
  createdAt: isoDate,
});
export type ConsolePromptVersion = z.infer<typeof consolePromptVersionSchema>;

/** A slug with all of its versions, newest first, and which one is active. */
export const consolePromptSchema = z.object({
  slug: z.string().min(1),
  kind: aiRunKindSchema,
  activeVersion: z.number().int().positive().nullable(),
  versions: z.array(consolePromptVersionSchema),
});
export type ConsolePrompt = z.infer<typeof consolePromptSchema>;

export const consolePromptsSchema = z.object({
  generatedAt: isoDate,
  prompts: z.array(consolePromptSchema),
});
export type ConsolePrompts = z.infer<typeof consolePromptsSchema>;

/**
 * Appends one version to the registry. Append-only by trigger: an inserted
 * version starts inactive, and nothing can ever rewrite it — activating it
 * later is the one sanctioned mutation, via `activate_prompt()`.
 */
export const insertPromptVersionSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  kind: aiRunKindSchema,
  template: z.string().trim().min(1).max(20_000),
  /** The profile this prompt expects (`fast`, `reasoning`, …), not a provider
   *  slug — those live in `server/core/config.ts` alone. */
  modelProfile: z.string().trim().min(1).max(100).default("fast"),
  notes: z.string().trim().max(2_000).optional(),
});
export type InsertPromptVersion = z.infer<typeof insertPromptVersionSchema>;

export const promptVersionInsertedSchema = z.object({
  id: z.uuid(),
  slug: z.string().min(1),
  version: z.number().int().positive(),
  activatedAt: nullableIsoDate,
});
export type PromptVersionInserted = z.infer<typeof promptVersionInsertedSchema>;

/**
 * Activates one version of a slug through the SQL function
 * `activate_prompt()` — the only path the append-only trigger permits. This
 * changes what every future model call sees from the next call on, so the
 * UI wires an explicit confirmation before calling this route.
 */
export const activatePromptVersionSchema = z.object({
  slug: z.string().trim().min(1).max(200),
  version: z.number().int().positive(),
});
export type ActivatePromptVersion = z.infer<typeof activatePromptVersionSchema>;

export const promptVersionActivatedSchema = z.object({
  slug: z.string().min(1),
  version: z.number().int().positive(),
  activatedAt: isoDate,
});
export type PromptVersionActivated = z.infer<typeof promptVersionActivatedSchema>;

/* ── 18. Generic entity version reads ────────────────────────────────────── */

/** Any versioned entity, keyed by the same `entity_type` + `entity_id` the
 *  `entity_version` table indexes — the publication drilldown generalised. */
export const listEntityVersionsSchema = z.object({
  entityType: entityTypeSchema,
  entityId: z.uuid(),
  limit: z.coerce.number().int().min(1).max(100).default(20),
});
export type ListEntityVersions = z.infer<typeof listEntityVersionsSchema>;

export const consoleEntityVersionSchema = z.object({
  versionId: z.uuid(),
  versionNumber: z.number().int().positive(),
  createdAt: isoDate,
  actorLabel: z.string(),
  changeSummary: z.string(),
  changeSource: changeSourceSchema,
  /** The entity as it was, verbatim — the same jsonb `recordVersion()` wrote. */
  snapshot: z.unknown(),
});
export type ConsoleEntityVersion = z.infer<typeof consoleEntityVersionSchema>;

export const consoleEntityVersionsSchema = z.object({
  generatedAt: isoDate,
  entityType: entityTypeSchema,
  entityId: z.uuid(),
  limit: count,
  /** Newest first by version number. */
  versions: z.array(consoleEntityVersionSchema),
});
export type ConsoleEntityVersions = z.infer<typeof consoleEntityVersionsSchema>;

/* ── 19. Evidence provenance trail ───────────────────────────────────────── */

/**
 * One evidence row's provenance trail, newest first — the captured/retrieved
 * entries, each naming what happened, who acted, and a detail. The detail is
 * jsonb in the database; it travels serialised and truncated to the same 500
 * bound the quality-check details use, so a verbose detail cannot blow up a
 * console render.
 */
export const consoleEvidenceProvenanceSchema = z.object({
  generatedAt: isoDate,
  evidenceId: z.uuid(),
  entries: z.array(z.object({
    id: z.uuid(),
    action: z.string().min(1),
    actorLabel: z.string(),
    actorUserId: z.uuid().nullable(),
    detail: z.string().max(500).nullable(),
    occurredAt: isoDate,
  })),
});
export type ConsoleEvidenceProvenance = z.infer<typeof consoleEvidenceProvenanceSchema>;
