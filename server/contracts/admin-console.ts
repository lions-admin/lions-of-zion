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
  entityTypeSchema,
  narrativeStatusSchema,
  publicationSectionSchema,
  publicationStatusSchema,
  sourceKindSchema,
} from "./enums";

const isoDate = z.string();
const nullableIsoDate = isoDate.nullable();
const count = z.number().int().nonnegative();
const usd = z.number().nonnegative();

/* ── 1. Overview ──────────────────────────────────────────────────────────── */

/** The one screen an operator reads first. Every number is for the last 24
 *  hours unless its name says otherwise. */
export const consoleOverviewSchema = z.object({
  generatedAt: isoDate,
  /** False when automatic publication is paused, processing is paused, or a
   *  critical alert is open — the reasons say which. */
  systemActive: z.boolean(),
  inactiveReasons: z.array(z.string()),
  automaticPublicationPaused: z.boolean(),
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

/** Operator actions on the pipeline, beyond what `/admin/briefing/run` and
 *  `/admin/briefing/control` already offer. */
export const retryJobSchema = z.object({
  /** Reset attempts too, so a job that exhausted them can run again. */
  resetAttempts: z.boolean().default(false),
});
export type RetryJob = z.infer<typeof retryJobSchema>;

export const retryJobResultSchema = z.object({
  jobId: z.uuid(),
  previousState: jobStateSchema,
  state: jobStateSchema,
  dispatched: z.boolean(),
});
export type RetryJobResult = z.infer<typeof retryJobResultSchema>;

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

/* ── 4. Editorial desk ────────────────────────────────────────────────────── */

export const editorialCardSchema = z.object({
  id: z.uuid(),
  publicId: z.string(),
  title: z.string(),
  summary: z.string().nullable(),
  section: publicationSectionSchema,
  status: publicationStatusSchema,
  featuredIsraelStory: z.boolean(),
  homepageSlot: z.number().int().min(1).max(3).nullable(),
  briefingRunId: z.uuid().nullable(),
  evidenceCount: count,
  createdAt: isoDate,
  updatedAt: isoDate,
  publishedAt: nullableIsoDate,
});
export type EditorialCard = z.infer<typeof editorialCardSchema>;

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
  homepageFeatures: z.array(z.object({ slot: z.number().int(), publicationId: z.uuid() })),
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
  /** Versions an operator can roll a publication back to. */
  outbox: z.object({ undelivered: count, oldestAt: nullableIsoDate, deadLettered: count }),
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
  "get_security",
  "get_settings",
  "search_audit",
  "get_publication",
  "list_publications",
  /* operate — reversible */
  "run_processing",
  "pause_publication",
  "resume_publication",
  "retry_job",
  "resolve_alert",
  "verify_source",
  "sync_source_catalog",
  "set_source_active",
  "update_publication",
  "set_homepage_feature",
  "run_health_check",
  /* operate — irreversible, always confirmed */
  "force_rerun",
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
  "force_rerun",
  "publish_publication",
  "unpublish_publication",
  "archive_publication",
  "delete_publication",
  "rollback_publication",
  "pause_publication",
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
