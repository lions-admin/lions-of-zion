import "server-only";

/**
 * Console reads and the few recovery writes, as raw SQL.
 *
 * Every read here is an aggregate over tables other modules own. Following
 * `briefing/repo.ts` `summary()`, they are written as plain `sql` and
 * gathered with `Promise.all` in the service — the console is a read model,
 * not a domain, and a Drizzle query builder would only make thirty joins
 * longer to read. Rows come back with driver-native types (Date, bigint as
 * string, numeric as string); `service.ts` normalises and parses them against
 * the contract, so a drifted column fails loudly rather than rendering wrong.
 *
 * Nothing in this file UPDATEs a versioned table. Sources and publications go
 * through their own services so `recordVersion()` runs.
 */

import { sql, type SQL } from "drizzle-orm";
import type {
  ListAudit,
  ListEditorial,
  ListChatThreadsQuery,
  ListConsoleReports,
  ListEntityVersions,
  ListQualityChecks,
  ListSourceFetches,
} from "@/server/contracts/admin-console";

type Db = {
  execute: <T>(query: unknown) => Promise<{ rows: T[] }>;
};

type Count = string | number;
type Ts = Date | string | null;

export type OverviewRow = {
  lastCollectedAt: Ts;
  lastProcessedAt: Ts;
  lastPublishedAt: Ts;
  automaticPublicationPaused: boolean | null;
  criticalAlerts: Count;
  warningAlerts: Count;
  stuckJobs: Count;
  quarantined: Count;
  collected: Count;
  processed: Count;
  drafted: Count;
  published: Count;
  failedJobs: Count;
};

export type LastRunRow = { at: Ts; localDate: string; stage: string; status: string };

export type StageRow = {
  stage: string;
  pending: Count;
  running: Count;
  completed24h: Count;
  quarantined: Count;
  stuck: Count;
  oldestPendingAt: Ts;
  averageDurationMs: string | number | null;
  lastError: string | null;
};

export type JobRow = {
  id: string;
  jobKey: string;
  stage: string;
  localDate: string;
  sourceId: string | null;
  sourceName: string | null;
  state: string;
  attempts: number;
  maxAttempts: number;
  availableAt: Ts;
  leaseUntil: Ts;
  heartbeatAt: Ts;
  startedAt: Ts;
  finishedAt: Ts;
  lastError: string | null;
  createdAt: Ts;
};

export type EditionRow = {
  id: string;
  localDate: string;
  status: string;
  collectionOpenedAt: Ts;
  collectionClosedAt: Ts;
  publishedAt: Ts;
};

export type SourceRow = {
  id: string;
  slug: string;
  name: string;
  kind: string;
  active: boolean;
  familyId: string | null;
  familySlug: string | null;
  familyLabel: string | null;
  feedUrl: string | null;
  homepageUrl: string | null;
  language: string | null;
  country: string | null;
  verificationState: string | null;
  verificationError: string | null;
  disabledReason: string | null;
  consecutiveFailures: number;
  lastFetchAt: Ts;
  lastSuccessfulFetchAt: Ts;
  lastError: string | null;
  attempts: Count;
  successes: Count;
  itemsSeen: Count;
  itemsNew: Count;
  duplicates: Count;
};

export type FamilyRow = { id: string; slug: string; label: string; sourceCount: Count };

export type EditorialCountRow = { status: string; count: Count };

export type EditorialCardRow = {
  id: string;
  publicId: string;
  title: string;
  summary: string | null;
  section: string;
  status: string;
  featuredIsraelStory: boolean;
  homepageArea: string | null;
  homepagePosition: string | null;
  briefingRunId: string | null;
  editorialRunId: string | null;
  evidenceCount: Count;
  createdAt: Ts;
  updatedAt: Ts;
  publishedAt: Ts;
  lane: string;
};

export type NarrativeRow = {
  id: string;
  title: string;
  status: string;
  firstSeenAt: Ts;
  lastSeenAt: Ts;
  observations7d: Count;
  observationsPrior7d: Count;
};

export type NarrativePublicationRow = {
  narrativeId: string;
  id: string;
  publicId: string;
  title: string;
  status: string;
  section: string;
  narrativeWatchDetails: unknown;
  createdAt: Ts;
};

export type UserRow = {
  id: string;
  email: string | null;
  displayName: string;
  isAutomated: boolean;
  disabledAt: Ts;
  createdAt: Ts;
  lastActionAt: Ts;
};

export type GrantRow = { userId: string; capability: string; grantedAt: Ts; rationale: string };

export type AuditRow = {
  id: string | number | bigint;
  occurredAt: Ts;
  actorUserId: string | null;
  actorLabel: string;
  action: string;
  entityType: string;
  entityId: string | null;
  requestId: string | null;
  hasBefore: boolean;
  hasAfter: boolean;
};

export type AuditDetailRow = AuditRow & { beforeState: unknown; afterState: unknown };

export type SpendRow = {
  today: Count;
  last24HoursUsd: Count;
  monthToDateUsd: Count;
  last30DaysUsd: Count;
  briefing30DaysUsd: Count;
};

export type ProfileSpendRow = { model: string; profile: string; kind: string; calls: Count; costUsd: Count };
export type BucketSpendRow = { bucket: string; calls: Count; costUsd: Count };
export type SearchUsageRow = { attempts: Count; successful: Count };

export type AlertRow = {
  id: string;
  fingerprint: string;
  kind: string;
  severity: string;
  message: string;
  details: unknown;
  createdAt: Ts;
  notifiedAt: Ts;
  resolvedAt: Ts;
};

export type FailedRunRow = { id: string; localDate: string; stage: string; error: string | null; startedAt: Ts };
export type QuarantineRow = { id: string; candidateKey: string; stage: string; reason: string; createdAt: Ts };
export type OutboxRow = { undelivered: Count; oldestAt: Ts; deadLettered: Count; lastPublishedAt: Ts; lastError: string | null };
export type OutboxTopicRow = { topic: string; pending: Count; oldestAt: Ts; maxAttempts: Count; nextAvailableAt: Ts };

export type QuarantineEntryRow = {
  id: string;
  candidateKey: string;
  stage: string;
  reason: string;
  status: string;
  resolvedAt: Ts;
  createdAt: Ts;
};

export type EditionDetailRow = {
  id: string;
  localDate: string;
  status: string;
  contractVersion: string;
  promptVersion: string;
  collectionOpenedAt: Ts;
  collectionClosedAt: Ts;
  publishedAt: Ts;
};

export type EditionRunRow = {
  id: string;
  stage: string;
  status: string;
  inputCount: number;
  outputCount: number;
  errorMessage: string | null;
  startedAt: Ts;
  finishedAt: Ts;
};

export type EditionRunAiRow = {
  stage: string;
  aiRunId: string;
  model: string;
  profile: string;
  kind: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: Count | null;
  latencyMs: number | null;
  status: string;
  createdAt: Ts;
};

export type EditionArtifactRow = {
  stage: string;
  artifactVersion: number;
  inputHash: string;
  payload: unknown;
  createdAt: Ts;
};

export type EditionClaimRow = {
  itemId: string;
  layer: string;
  machineAssessment: string;
  attributedTo: string | null;
  uncertainty: string | null;
  createdAt: Ts;
};

export type SourceFetchRow = {
  id: string;
  status: string;
  startedAt: Ts;
  finishedAt: Ts;
  httpStatus: number | null;
  itemsSeen: number;
  itemsNew: number;
  errorMessage: string | null;
  searchQuery: string | null;
  rawBlobUrl: string | null;
  rawByteSize: number | null;
  createdAt: Ts;
};

export type SourceFetchTodayRow = {
  boundaryAt: Ts;
  attempts: Count;
  successes: Count;
  partial: Count;
  failed: Count;
  itemsSeen: Count;
  itemsNew: Count;
  lastError: string | null;
};

export type QualityCheckRow = {
  runId: string;
  localDate: string;
  candidateKey: string;
  stage: string;
  checkName: string;
  status: string;
  detail: string;
};

export type VersionRow = {
  versionId: string;
  versionNumber: number;
  createdAt: Ts;
  actorLabel: string;
  changeSummary: string | null;
  snapshot: unknown;
};

export type ConsoleJobState = {
  id: string;
  jobKey: string;
  stage: string;
  state: string;
  attempts: number;
  maxAttempts: number;
  leaseUntil: Ts;
  lastError: string | null;
  contractVersion: number;
  localDate: string;
  sourceId: string | null;
  editionId: string | null;
  checkpoint: unknown;
};

export type ReportDeskRow = {
  id: string;
  publicId: string;
  url: string | null;
  body: string | null;
  reporterEmail: string | null;
  reporterNote: string | null;
  status: string;
  resolutionNote: string | null;
  itemId: string | null;
  createdAt: Ts;
  updatedAt: Ts;
  trailCount: Count;
  latestTrail: { toStatus: string; actorLabel: string; occurredAt: Ts } | null;
};

export type ChatThreadRow = {
  id: string;
  title: string | null;
  createdByLabel: string;
  createdAt: Ts;
  archivedAt: Ts;
  messageCount: Count;
  lastMessageAt: Ts;
};

export type ChatThreadByIdRow = {
  id: string;
  title: string | null;
  createdByLabel: string;
  createdAt: Ts;
  archivedAt: Ts;
};

export type ArchivedChatThreadRow = { id: string; archivedAt: Ts };

export type ChatMessageRow = {
  id: string;
  seq: number;
  role: string;
  content: string;
  createdAt: Ts;
  aiRunId: string | null;
};

export type ChatToolRunRow = {
  messageId: string;
  tool: string;
  status: string;
  latencyMs: number | null;
  resultCount: Count;
};

export type ChatAiRunRow = {
  aiRunId: string;
  model: string;
  profile: string;
  inputTokens: number | null;
  outputTokens: number | null;
  costUsd: Count | null;
};

export type SystemInternalsRow = {
  staleBacklog: Count;
  indexed: Count;
  embeddingRuns24h: Count;
  embeddingLastRunAt: Ts;
};

export type PromptVersionRow = {
  id: string;
  slug: string;
  version: number;
  kind: string;
  template: string;
  modelProfile: string;
  notes: string | null;
  activatedAt: Ts;
  createdAt: Ts;
};

export type EntityVersionRow = {
  versionId: string;
  versionNumber: number;
  createdAt: Ts;
  actorLabel: string;
  changeSummary: string;
  changeSource: string;
  snapshot: unknown;
};

export type ProvenanceRow = {
  id: string;
  action: string;
  actorLabel: string;
  actorUserId: string | null;
  detail: unknown;
  occurredAt: Ts;
};

const JOB_COLUMNS = sql`
  j.id,
  j.job_key AS "jobKey",
  j.stage,
  j.local_date AS "localDate",
  j.source_id AS "sourceId",
  s.name AS "sourceName",
  j.state,
  j.attempts,
  j.max_attempts AS "maxAttempts",
  j.available_at AS "availableAt",
  j.lease_until AS "leaseUntil",
  j.heartbeat_at AS "heartbeatAt",
  j.started_at AS "startedAt",
  j.finished_at AS "finishedAt",
  j.last_error AS "lastError",
  j.created_at AS "createdAt"
`;
const JOB_FROM = sql`FROM briefing_job j LEFT JOIN source s ON s.id = j.source_id`;

/** The one definition of "stuck": running, and the worker lease has lapsed
 *  with no heartbeat renewing it. `recoverStale` in `briefing/jobs.ts` uses
 *  the same predicate to recover them. */
const JOB_IS_STUCK = sql`j.state = 'running' AND j.lease_until < now()`;

const ALERT_COLUMNS = sql`
  id, fingerprint, kind, severity, message, details,
  created_at AS "createdAt", notified_at AS "notifiedAt", resolved_at AS "resolvedAt"
`;

const AUDIT_COLUMNS = sql`
  id,
  created_at AS "occurredAt",
  actor_user_id AS "actorUserId",
  actor_label AS "actorLabel",
  action,
  entity_type AS "entityType",
  entity_id AS "entityId",
  request_id AS "requestId",
  (before_state IS NOT NULL) AS "hasBefore",
  (after_state IS NOT NULL) AS "hasAfter"
`;

const PUBLICATION_ENTITY_TYPES = sql`('news_update', 'brief', 'geopolitical_analysis', 'scenario')`;

export function adminConsoleRepo(db: unknown) {
  const d = db as Db;
  const one = async <T>(query: SQL): Promise<T | undefined> => (await d.execute<T>(query)).rows[0];
  const many = async <T>(query: SQL): Promise<T[]> => (await d.execute<T>(query)).rows;

  return {
    /* ── overview ─────────────────────────────────────────────────────────── */

    overview: () => one<OverviewRow>(sql`
      SELECT
        (SELECT max(captured_at) FROM evidence) AS "lastCollectedAt",
        (SELECT max(finished_at) FROM briefing_job WHERE state = 'completed' AND stage IN ('enrich', 'cluster', 'triage', 'draft')) AS "lastProcessedAt",
        (SELECT max(published_at) FROM publication) AS "lastPublishedAt",
        (SELECT automatic_publication_paused FROM briefing_control WHERE id = 'global') AS "automaticPublicationPaused",
        (SELECT count(*) FROM briefing_alert WHERE resolved_at IS NULL AND severity = 'critical') AS "criticalAlerts",
        (SELECT count(*) FROM briefing_alert WHERE resolved_at IS NULL AND severity = 'warning') AS "warningAlerts",
        (SELECT count(*) FROM briefing_job j WHERE ${JOB_IS_STUCK}) AS "stuckJobs",
        (SELECT count(*) FROM briefing_job WHERE state = 'quarantined') AS quarantined,
        (SELECT count(*) FROM evidence WHERE captured_at >= now() - interval '24 hours') AS collected,
        (SELECT count(*) FROM briefing_job
           WHERE state = 'completed'
             AND stage IN ('enrich', 'cluster', 'triage', 'draft')
             AND finished_at >= now() - interval '24 hours') AS processed,
        (SELECT count(*) FROM publication
           WHERE briefing_run_id IS NOT NULL AND created_at >= now() - interval '24 hours') AS drafted,
        (SELECT count(*) FROM publication WHERE published_at >= now() - interval '24 hours') AS published,
        (SELECT count(*) FROM briefing_job
           WHERE (state = 'quarantined' AND coalesce(finished_at, updated_at) >= now() - interval '24 hours')
              OR (last_error IS NOT NULL AND updated_at >= now() - interval '24 hours')) AS "failedJobs"
    `),

    lastRun: () => one<LastRunRow>(sql`
      SELECT started_at AS at, local_date AS "localDate", stage, status
      FROM briefing_run ORDER BY created_at DESC LIMIT 1
    `),

    /* ── pipeline ─────────────────────────────────────────────────────────── */

    stages: () => many<StageRow>(sql`
      SELECT j.stage,
        count(*) FILTER (WHERE j.state = 'pending') AS pending,
        count(*) FILTER (WHERE j.state = 'running') AS running,
        count(*) FILTER (WHERE j.state = 'completed' AND j.finished_at >= now() - interval '24 hours') AS "completed24h",
        count(*) FILTER (WHERE j.state = 'quarantined') AS quarantined,
        count(*) FILTER (WHERE ${JOB_IS_STUCK}) AS stuck,
        min(j.available_at) FILTER (WHERE j.state = 'pending') AS "oldestPendingAt",
        avg(extract(epoch FROM (j.finished_at - j.started_at)) * 1000)
          FILTER (WHERE j.state = 'completed' AND j.started_at IS NOT NULL AND j.finished_at IS NOT NULL) AS "averageDurationMs",
        (array_agg(j.last_error ORDER BY j.updated_at DESC) FILTER (WHERE j.last_error IS NOT NULL))[1] AS "lastError"
      FROM briefing_job j
      GROUP BY j.stage
    `),

    attentionJobs: (limit = 50) => many<JobRow>(sql`
      SELECT ${JOB_COLUMNS} ${JOB_FROM}
      WHERE (${JOB_IS_STUCK})
         OR j.state = 'quarantined'
         OR (j.state = 'pending' AND j.attempts >= j.max_attempts - 1 AND j.last_error IS NOT NULL)
      ORDER BY j.updated_at DESC
      LIMIT ${limit}
    `),

    recentJobs: (limit = 50) => many<JobRow>(sql`
      SELECT ${JOB_COLUMNS} ${JOB_FROM}
      ORDER BY j.created_at DESC
      LIMIT ${limit}
    `),

    stuckJobs: (limit = 50) => many<JobRow>(sql`
      SELECT ${JOB_COLUMNS} ${JOB_FROM}
      WHERE ${JOB_IS_STUCK}
      ORDER BY j.lease_until ASC
      LIMIT ${limit}
    `),

    quarantinedJobs: (limit = 50) => many<JobRow>(sql`
      SELECT ${JOB_COLUMNS} ${JOB_FROM}
      WHERE j.state = 'quarantined'
      ORDER BY coalesce(j.finished_at, j.updated_at) DESC
      LIMIT ${limit}
    `),

    editions: (limit = 14) => many<EditionRow>(sql`
      SELECT id, local_date AS "localDate", status,
             collection_opened_at AS "collectionOpenedAt",
             collection_closed_at AS "collectionClosedAt",
             published_at AS "publishedAt"
      FROM briefing_edition
      ORDER BY local_date DESC
      LIMIT ${limit}
    `),

    /** The briefing pipeline's own quality audit rows, one join deep: the
     *  run is the only relation the matrix needs, because `briefing_run`
     *  already carries the Israel-local `local_date` and `stage` — no
     *  `briefing_edition` detour. EXPLAIN could not be run on PGlite, so the
     *  query stays trivially cheap: both filter columns sit inside the one
     *  relation and both filter paths hit a real index (`briefing_run`'s
     *  primary id, or `briefing_run_by_date`'s leading `local_date`).
     *  Ordering by `(runId, candidateKey)` here; the REQUIRED ordinal is
     *  applied in `service.ts`, which owns the check-name list. */
    qualityChecks: (input: ListQualityChecks) => many<QualityCheckRow>(sql`
      SELECT q.briefing_run_id AS "runId",
             r.local_date AS "localDate",
             q.candidate_key AS "candidateKey",
             r.stage,
             q.check_name AS "checkName",
             q.status,
             q.detail
      FROM briefing_quality_check q
      JOIN briefing_run r ON r.id = q.briefing_run_id
      WHERE ${input.runId !== undefined ? sql`r.id = ${input.runId}` : sql`r.local_date = ${input.localDate}`}
      ORDER BY q.briefing_run_id, q.candidate_key, q.created_at, q.check_name
    `),

    /* ── edition drilldown ─────────────────────────────────────────────────── */

    /** One read per relation, keyed by the edition's unique Israel-local
     *  date. The claims are the one relation needing a detour: `briefing_claim`
     *  is keyed by item, so it is scoped through the edition's publications
     *  (`briefing_run` → `publication_item`), the same join
     *  `publications/repo.ts` makes for a single publication. */
    edition: (localDate: string) => one<EditionDetailRow>(sql`
      SELECT id, local_date AS "localDate", status, contract_version AS "contractVersion",
             prompt_version AS "promptVersion", collection_opened_at AS "collectionOpenedAt",
             collection_closed_at AS "collectionClosedAt", published_at
      FROM briefing_edition WHERE local_date = ${localDate}
    `),

    editionRuns: (localDate: string) => many<EditionRunRow>(sql`
      SELECT id, stage, status, input_count AS "inputCount", output_count AS "outputCount",
             error_message AS "errorMessage", started_at AS "startedAt", finished_at AS "finishedAt"
      FROM briefing_run WHERE local_date = ${localDate}
      ORDER BY created_at, stage
    `),

    editionRunAi: (localDate: string) => many<EditionRunAiRow>(sql`
      SELECT bra.stage, bra.ai_run_id AS "aiRunId", ar.model, ar.model_profile AS profile,
             ar.kind::text AS kind, ar.input_tokens AS "inputTokens", ar.output_tokens AS "outputTokens",
             ar.cost_usd AS "costUsd", ar.latency_ms AS "latencyMs", ar.status, bra.created_at AS "createdAt"
      FROM briefing_run_ai bra
      JOIN briefing_run r ON r.id = bra.briefing_run_id
      JOIN ai_run ar ON ar.id = bra.ai_run_id
      WHERE r.local_date = ${localDate}
      ORDER BY bra.created_at, bra.stage
    `),

    editionArtifacts: (localDate: string) => many<EditionArtifactRow>(sql`
      SELECT DISTINCT ON (a.stage) a.stage, a.artifact_version AS "artifactVersion",
             a.input_hash AS "inputHash", a.payload, a.created_at AS "createdAt"
      FROM briefing_stage_artifact a
      JOIN briefing_edition e ON e.id = a.edition_id
      WHERE e.local_date = ${localDate}
      ORDER BY a.stage, a.artifact_version DESC
    `),

    editionClaims: (localDate: string) => many<EditionClaimRow>(sql`
      SELECT bc.item_id AS "itemId", bc.layer, bc.machine_assessment AS "machineAssessment",
             bc.attributed_to AS "attributedTo", bc.uncertainty, bc.created_at AS "createdAt"
      FROM briefing_claim bc
      JOIN information_item ii ON ii.id = bc.item_id
      JOIN publication_item pi ON pi.item_id = ii.id
      JOIN publication p ON p.id = pi.publication_id
      JOIN briefing_run r ON r.id = p.briefing_run_id
      WHERE r.local_date = ${localDate}
      ORDER BY bc.created_at, ii.created_at
    `),

    editionJobs: (localDate: string, limit = 200) => many<JobRow>(sql`
      SELECT ${JOB_COLUMNS} ${JOB_FROM}
      WHERE j.local_date = ${localDate}
      ORDER BY j.created_at DESC
      LIMIT ${limit}
    `),

    /* ── sources ──────────────────────────────────────────────────────────── */

    sources: () => many<SourceRow>(sql`
      SELECT s.id, s.slug, s.name, s.kind, s.active,
             f.id AS "familyId", f.slug AS "familySlug", f.label AS "familyLabel",
             s.feed_url AS "feedUrl", s.homepage_url AS "homepageUrl",
             s.language, s.country,
             s.config ->> 'verificationState' AS "verificationState",
             s.config ->> 'verificationError' AS "verificationError",
             s.disabled_reason AS "disabledReason",
             s.consecutive_failures AS "consecutiveFailures",
             (SELECT max(started_at) FROM source_fetch WHERE source_id = s.id) AS "lastFetchAt",
             s.last_successful_fetch_at AS "lastSuccessfulFetchAt",
             (SELECT error_message FROM source_fetch
                WHERE source_id = s.id AND error_message IS NOT NULL
                ORDER BY started_at DESC LIMIT 1) AS "lastError",
             count(sf.id) AS attempts,
             count(sf.id) FILTER (WHERE sf.status = 'success') AS successes,
             coalesce(sum(sf.items_seen), 0) AS "itemsSeen",
             coalesce(sum(sf.items_new), 0) AS "itemsNew",
             (SELECT count(*) FROM evidence_discovery ed
                JOIN source_fetch dsf ON dsf.id = ed.source_fetch_id
                WHERE ed.discovery_source_id = s.id
                  AND ed.deduplication_method <> 'new'
                  AND dsf.started_at >= now() - interval '7 days') AS duplicates
      FROM source s
      JOIN source_family f ON f.id = s.source_family_id
      LEFT JOIN source_fetch sf ON sf.source_id = s.id AND sf.started_at >= now() - interval '7 days'
      GROUP BY s.id, f.id
      ORDER BY s.active DESC, s.name
    `),

    families: () => many<FamilyRow>(sql`
      SELECT f.id, f.slug, f.label, count(s.id) AS "sourceCount"
      FROM source_family f
      LEFT JOIN source s ON s.source_family_id = f.id
      GROUP BY f.id
      ORDER BY f.label
    `),

    /* ── source fetch log ─────────────────────────────────────────────────── */

    sourceExists: (id: string) => one<{ id: string }>(sql`SELECT id FROM source WHERE id = ${id}`),

    sourceFetches: (input: ListSourceFetches) => many<SourceFetchRow>(sql`
      SELECT f.id, f.status::text AS status, f.started_at AS "startedAt", f.finished_at AS "finishedAt",
             f.http_status AS "httpStatus", f.items_seen AS "itemsSeen", f.items_new AS "itemsNew",
             f.error_message AS "errorMessage", f.search_query AS "searchQuery",
             f.raw_blob_url AS "rawBlobUrl", f.raw_byte_size AS "rawByteSize", f.created_at AS "createdAt"
      FROM source_fetch f
      WHERE f.source_id = ${input.id}
      ORDER BY f.started_at DESC
      LIMIT ${input.limit}
    `),

    /** Israel-local "today": `date_trunc` runs on the wall-clock time in
     *  Asia/Jerusalem — the zone `briefing/service.ts` `israelLocalDate` and
     *  `israelCollectionWindow` use — and converts back to an instant, so the
     *  boundary is the true midnight and DST is Postgres's problem. The
     *  comparison is inclusive. */
    sourceFetchesToday: (sourceId: string) => one<SourceFetchTodayRow>(sql`
      SELECT
        (date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem') AS "boundaryAt",
        count(*) AS attempts,
        count(*) FILTER (WHERE f.status = 'success') AS successes,
        count(*) FILTER (WHERE f.status = 'partial') AS partial,
        count(*) FILTER (WHERE f.status = 'failed') AS failed,
        coalesce(sum(f.items_seen) FILTER (WHERE f.status <> 'failed'), 0) AS "itemsSeen",
        coalesce(sum(f.items_new) FILTER (WHERE f.status <> 'failed'), 0) AS "itemsNew",
        (array_agg(f.error_message ORDER BY f.started_at DESC) FILTER (WHERE f.error_message IS NOT NULL))[1] AS "lastError"
      FROM source_fetch f
      WHERE f.source_id = ${sourceId}
        AND f.started_at >= (date_trunc('day', now() AT TIME ZONE 'Asia/Jerusalem') AT TIME ZONE 'Asia/Jerusalem')
    `),

    /* ── editorial ────────────────────────────────────────────────────────── */

    editorialCounts: (input?: ListEditorial) => many<EditorialCountRow>(sql`
      SELECT p.status::text AS status, count(*) AS count FROM publication p
      WHERE ${editorialScope(input)} GROUP BY p.status
    `),

    editorialPage: (input: ListEditorial) => many<EditorialCardRow>(sql`
      SELECT p.id, p.public_id AS "publicId", p.title, p.summary,
        p.section::text AS section, p.status::text AS status,
        p.featured_israel_story AS "featuredIsraelStory", hp.area AS "homepageArea", hp.position AS "homepagePosition",
        p.briefing_run_id AS "briefingRunId", p.editorial_run_id AS "editorialRunId",
        (SELECT count(*) FROM publication_evidence pe WHERE pe.publication_id = p.id) AS "evidenceCount",
        p.created_at AS "createdAt", p.updated_at AS "updatedAt", p.published_at AS "publishedAt",
        CASE WHEN p.status IN ('published', 'updated') THEN 'published' ELSE p.status::text END AS lane
      FROM publication p LEFT JOIN homepage_placement hp ON hp.publication_id = p.id
      WHERE ${editorialScope(input)} ${input.status ? sql`AND p.status = ${input.status}` : sql``}
      ORDER BY p.created_at DESC, p.id DESC
      LIMIT ${input.limit} OFFSET ${(input.page - 1) * input.limit}
    `),

    /** Every lane in one read: newest first, `perLane` rows per lane. The
     *  `published` lane holds both `published` and `updated`. */
    editorialCards: (perLane = 30) => many<EditorialCardRow>(sql`
      SELECT * FROM (
        SELECT p.id, p.public_id AS "publicId", p.title, p.summary,
               p.section::text AS section, p.status::text AS status,
               p.featured_israel_story AS "featuredIsraelStory",
               hp.area AS "homepageArea", hp.position AS "homepagePosition",
               p.briefing_run_id AS "briefingRunId", p.editorial_run_id AS "editorialRunId",
               (SELECT count(*) FROM publication_evidence pe WHERE pe.publication_id = p.id) AS "evidenceCount",
               p.created_at AS "createdAt", p.updated_at AS "updatedAt", p.published_at AS "publishedAt",
               CASE WHEN p.status IN ('published', 'updated') THEN 'published' ELSE p.status::text END AS lane,
               row_number() OVER (
                 PARTITION BY (CASE WHEN p.status IN ('published', 'updated') THEN 'published' ELSE p.status::text END)
                 ORDER BY p.created_at DESC
               ) AS rn
        FROM publication p
        LEFT JOIN homepage_placement hp ON hp.publication_id = p.id
      ) ranked
      WHERE rn <= ${perLane}
      ORDER BY "createdAt" DESC
    `),

    /* ── narratives ───────────────────────────────────────────────────────── */

    narratives: (limit = 100) => many<NarrativeRow>(sql`
      SELECT n.id, n.title, n.status::text AS status,
             n.first_seen_at AS "firstSeenAt", n.last_seen_at AS "lastSeenAt",
             count(o.id) FILTER (WHERE o.observed_at >= now() - interval '7 days') AS "observations7d",
             count(o.id) FILTER (WHERE o.observed_at >= now() - interval '14 days'
                                   AND o.observed_at < now() - interval '7 days') AS "observationsPrior7d"
      FROM narrative n
      LEFT JOIN narrative_observation o ON o.narrative_id = n.id
      GROUP BY n.id
      ORDER BY n.last_seen_at DESC NULLS LAST, n.created_at DESC
      LIMIT ${limit}
    `),

    /** Publications linked through `publication_narrative` — the one real
     *  relation between the two tables. */
    narrativePublications: () => many<NarrativePublicationRow>(sql`
      SELECT pn.narrative_id AS "narrativeId", p.id, p.public_id AS "publicId", p.title,
             p.status::text AS status, p.section::text AS section,
             p.narrative_watch_details AS "narrativeWatchDetails", p.created_at AS "createdAt"
      FROM publication_narrative pn
      JOIN publication p ON p.id = pn.publication_id
      ORDER BY p.created_at DESC
    `),

    /* ── users ────────────────────────────────────────────────────────────── */

    users: () => many<UserRow>(sql`
      SELECT u.id, u.email, u.display_name AS "displayName", u.is_automated AS "isAutomated",
             u.disabled_at AS "disabledAt", u.created_at AS "createdAt",
             (SELECT max(created_at) FROM audit_log a WHERE a.actor_user_id = u.id) AS "lastActionAt"
      FROM app_user u
      ORDER BY u.created_at
    `),

    grants: () => many<GrantRow>(sql`
      SELECT user_id AS "userId", capability, created_at AS "grantedAt", rationale
      FROM capability_grant
      ORDER BY created_at
    `),

    registeredUserCount: async () => Number((await one<{ count: Count }>(sql`SELECT count(*) AS count FROM app_user`))?.count ?? 0),

    adminActions: (limit = 50) => many<AuditRow>(sql`
      SELECT ${AUDIT_COLUMNS} FROM audit_log
      WHERE actor_user_id IS NOT NULL
      ORDER BY id DESC LIMIT ${limit}
    `),

    /* ── costs ────────────────────────────────────────────────────────────── */

    spend: () => one<SpendRow>(sql`
      SELECT
        coalesce(sum(cost_usd) FILTER (WHERE created_at >= date_trunc('day', now())), 0) AS today,
        coalesce(sum(cost_usd) FILTER (WHERE created_at >= now() - interval '24 hours'), 0) AS "last24HoursUsd",
        coalesce(sum(cost_usd) FILTER (WHERE created_at >= date_trunc('month', now())), 0) AS "monthToDateUsd",
        coalesce(sum(cost_usd) FILTER (WHERE created_at >= now() - interval '30 days'), 0) AS "last30DaysUsd",
        coalesce(sum(cost_usd) FILTER (WHERE created_at >= now() - interval '30 days' AND model_profile LIKE 'briefing%'), 0) AS "briefing30DaysUsd"
      FROM ai_run
    `),

    spendByProfile: () => many<ProfileSpendRow>(sql`
      SELECT model, model_profile AS profile, kind::text AS kind, count(*) AS calls, coalesce(sum(cost_usd), 0) AS "costUsd"
      FROM ai_run
      WHERE created_at >= now() - interval '30 days'
      GROUP BY model, model_profile, kind
      ORDER BY "costUsd" DESC
    `),

    spendByDay: () => many<BucketSpendRow>(sql`
      SELECT to_char(date_trunc('day', created_at), 'YYYY-MM-DD') AS bucket, count(*) AS calls, coalesce(sum(cost_usd), 0) AS "costUsd"
      FROM ai_run
      WHERE created_at >= date_trunc('day', now()) - interval '29 days'
      GROUP BY 1 ORDER BY 1
    `),

    spendByMonth: () => many<BucketSpendRow>(sql`
      SELECT to_char(date_trunc('month', created_at), 'YYYY-MM') AS bucket, count(*) AS calls, coalesce(sum(cost_usd), 0) AS "costUsd"
      FROM ai_run
      WHERE created_at >= date_trunc('month', now()) - interval '11 months'
      GROUP BY 1 ORDER BY 1
    `),

    /** The same month-to-date read `briefing/repo.ts` `summary()` makes for
     *  `googleUsage`. */
    searchUsage: () => one<SearchUsageRow>(sql`
      SELECT count(*) AS attempts,
             count(*) FILTER (WHERE sf.status = 'success') AS successful
      FROM source_fetch sf JOIN source s ON s.id = sf.source_id
      WHERE s.kind = 'agent_search' AND sf.started_at >= date_trunc('month', now())
    `),

    /** What Agent Search fetches themselves reported costing: the 30-day sum
     *  of `source_fetch.actual_cost_usd` — the per-query estimate each
     *  successful query wrote at fetch time, not a Google billing feed. */
    agentSearchActualSpend: () => one<{ actual30d: Count | null; recorded: Count; available: boolean }>(sql`
      SELECT sum((to_jsonb(f)->>'actual_cost_usd')::numeric) AS "actual30d",
        count(to_jsonb(f)->>'actual_cost_usd') AS recorded,
        EXISTS (SELECT 1 FROM pg_attribute
          WHERE attrelid = 'source_fetch'::regclass AND attname = 'actual_cost_usd' AND NOT attisdropped) AS available
      FROM source_fetch f JOIN source s ON s.id = f.source_id
      WHERE s.kind = 'agent_search'
        AND f.started_at >= now() - interval '30 days'
    `),

    /* ── audit ────────────────────────────────────────────────────────────── */

    auditPage: (input: ListAudit) => {
      const where: SQL[] = [sql`true`];
      if (input.before) where.push(sql`id < ${input.before}::bigint`);
      if (input.entityType) where.push(sql`entity_type = ${input.entityType}`);
      if (input.entityId) where.push(sql`entity_id = ${input.entityId}`);
      if (input.actor) where.push(sql`actor_label ILIKE ${`%${input.actor}%`}`);
      if (input.action) where.push(sql`action LIKE ${`${escapeLike(input.action)}%`}`);
      return many<AuditRow>(sql`
        SELECT ${AUDIT_COLUMNS} FROM audit_log
        WHERE ${sql.join(where, sql` AND `)}
        ORDER BY id DESC
        LIMIT ${input.limit + 1}
      `);
    },

    auditEntry: (id: string) => one<AuditDetailRow>(sql`
      SELECT ${AUDIT_COLUMNS}, before_state AS "beforeState", after_state AS "afterState"
      FROM audit_log WHERE id = ${id}::bigint
    `),

    auditByActionPrefixes: (prefixes: readonly string[], limit = 50) => many<AuditRow>(sql`
      SELECT ${AUDIT_COLUMNS} FROM audit_log
      WHERE ${sql.join(prefixes.map((prefix) => sql`action LIKE ${`${escapeLike(prefix)}%`}`), sql` OR `)}
      ORDER BY id DESC LIMIT ${limit}
    `),

    /* ── reports desk ────────────────────────────────────────────────────── */

    /** Newest first on the `(created_at, id)` keyset — `report.id` is a
     *  random uuid, so a plain `id DESC` is not an order. Each row carries
     *  its append-only status-trail count and the trail's latest entry — the
     *  read a triage decision is made against. `LIMIT + 1` marks the cursor
     *  boundary; the service slices and shapes. */
    reports: (input: ListConsoleReports) => {
      const where: SQL[] = [sql`true`];
      if (input.cursor) {
        const [at, id] = input.cursor.split("|");
        where.push(sql`(r.created_at, r.id) < (${at}::timestamptz, ${id}::uuid)`);
      }
      if (input.status) where.push(sql`r.status = ${input.status}`);
      return many<ReportDeskRow>(sql`
        SELECT r.id, r.public_id AS "publicId", r.url, r.body,
               r.reporter_email AS "reporterEmail", r.reporter_note AS "reporterNote",
               r.status::text AS status, r.resolution_note AS "resolutionNote",
               r.item_id AS "itemId",
               r.created_at AS "createdAt", r.updated_at AS "updatedAt",
               count(h.id) AS "trailCount",
               (SELECT jsonb_build_object(
                  'toStatus', hh.to_status::text,
                  'actorLabel', hh.actor_label,
                  'occurredAt', hh.created_at
                )
                FROM report_status_history hh
                WHERE hh.report_id = r.id
                ORDER BY hh.created_at DESC, hh.id DESC
                LIMIT 1) AS "latestTrail"
        FROM report r
        LEFT JOIN report_status_history h ON h.report_id = r.id
        WHERE ${sql.join(where, sql` AND `)}
        GROUP BY r.id
        ORDER BY r.created_at DESC, r.id DESC
        LIMIT ${input.limit + 1}
      `);
    },

    /* ── public-chat moderation ──────────────────────────────────────────── */

    /** Newest first on the `(created_at, id)` keyset — `id` breaks the ties
     *  a same-millisecond insert pair would otherwise race for. */
    chatThreads: (input: ListChatThreadsQuery) => {
      const where: SQL[] = [sql`true`];
      if (input.cursor) {
        const [at, id] = input.cursor.split("|");
        where.push(sql`(t.created_at, t.id) < (${at}::timestamptz, ${id}::uuid)`);
      }
      return many<ChatThreadRow>(sql`
        SELECT t.id, t.title, t.created_by_label AS "createdByLabel",
               t.created_at AS "createdAt", t.archived_at AS "archivedAt",
               count(m.id) AS "messageCount", max(m.created_at) AS "lastMessageAt"
        FROM chat_thread t
        LEFT JOIN chat_message m ON m.thread_id = t.id
        WHERE ${sql.join(where, sql` AND `)}
        GROUP BY t.id
        ORDER BY t.created_at DESC, t.id DESC
        LIMIT ${input.limit + 1}
      `);
    },

    chatThreadById: (id: string) => one<ChatThreadByIdRow>(sql`
      SELECT t.id, t.title, t.created_by_label AS "createdByLabel",
             t.created_at AS "createdAt", t.archived_at AS "archivedAt"
      FROM chat_thread t WHERE t.id = ${id}
    `),

    /** Ordered the way the transcript reads: `seq` is monotonic within the
     *  thread (`chat_message_is_sequential`), `created_at` breaks nothing. */
    chatMessages: (threadId: string) => many<ChatMessageRow>(sql`
      SELECT m.id, m.seq, m.role, m.content, m.created_at AS "createdAt", m.ai_run_id AS "aiRunId"
      FROM chat_message m
      WHERE m.thread_id = ${threadId}
      ORDER BY m.seq
    `),

    /** The thread's evidence trail, grouped by the message it belongs to.
     *  `result_document_ids` is what retrieval actually returned — the same
     *  list the citation trigger reads. */
    chatToolRuns: (threadId: string) => many<ChatToolRunRow>(sql`
      SELECT t.message_id AS "messageId", t.tool, t.status,
             t.latency_ms AS "latencyMs",
             coalesce(cardinality(t.result_document_ids), 0) AS "resultCount"
      FROM chat_tool_run t
      WHERE t.thread_id = ${threadId}
      ORDER BY t.created_at, t.id
    `),

    /** The `ai_run` linkage of the assistant messages, resolved in one read
     *  from the ids the messages name — the cost ledger of the conversation. */
    chatAiRuns: (runIds: readonly string[]) => {
      if (runIds.length === 0) return Promise.resolve<ChatAiRunRow[]>([]);
      return many<ChatAiRunRow>(sql`
        SELECT ar.id AS "aiRunId", ar.model, ar.model_profile AS profile,
               ar.input_tokens AS "inputTokens", ar.output_tokens AS "outputTokens",
               ar.cost_usd AS "costUsd"
        FROM ai_run ar
        WHERE ar.id IN (${sql.join(runIds.map((id) => sql`${id}::uuid`), sql`, `)})
      `);
    },

    /** Archives a thread the way `closeQuarantine` closes an entry: only an
     *  unarchived row, refusing already-archived ones by returning nothing. */
    archiveChatThread: (id: string) => one<ArchivedChatThreadRow>(sql`
      UPDATE chat_thread SET archived_at = now()
      WHERE id = ${id} AND archived_at IS NULL
      RETURNING id, archived_at AS "archivedAt"
    `),

    /* ── system internals ────────────────────────────────────────────────── */

    /** The embedding backlog is the exact comparison
     *  `search/repo.ts` `embeddingBacklog` lists — two hashes, no "pending"
     *  column — mirrored here as a count so the console never restates it
     *  differently. The embed-run figures come from the same `ai_run` ledger
     *  every other cost figure reads. */
    systemInternals: () => one<SystemInternalsRow>(sql`
      SELECT
        (SELECT count(*) FROM search_document
           WHERE indexed_content_hash IS DISTINCT FROM content_hash) AS "staleBacklog",
        (SELECT count(*) FROM search_document) AS "indexed",
        (SELECT count(*) FROM ai_run
           WHERE kind = 'embed' AND created_at >= now() - interval '24 hours') AS "embeddingRuns24h",
        (SELECT max(created_at) FROM ai_run WHERE kind = 'embed') AS "embeddingLastRunAt"
    `),

    /** The semantic arm is live in this database only where the column the
     *  migration conditionally adds actually exists — never inferred. */
    systemSemanticArm: () => one<{ ok: boolean }>(sql`SELECT search_has_semantic_arm() AS ok`),

    /* ── incidents ────────────────────────────────────────────────────────── */

    openAlerts: (limit = 50) => many<AlertRow>(sql`
      SELECT ${ALERT_COLUMNS} FROM briefing_alert
      WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT ${limit}
    `),

    recentlyResolvedAlerts: (limit = 50) => many<AlertRow>(sql`
      SELECT ${ALERT_COLUMNS} FROM briefing_alert
      WHERE resolved_at >= now() - interval '7 days' ORDER BY resolved_at DESC LIMIT ${limit}
    `),

    failedRuns: (limit = 50) => many<FailedRunRow>(sql`
      SELECT id, local_date AS "localDate", stage, error_message AS error, started_at AS "startedAt"
      FROM briefing_run
      WHERE status = 'failed' AND created_at >= now() - interval '7 days'
      ORDER BY created_at DESC LIMIT ${limit}
    `),

    openQuarantine: (limit = 50) => many<QuarantineRow>(sql`
      SELECT id, candidate_key AS "candidateKey", stage, reason, created_at AS "createdAt"
      FROM briefing_quarantine
      WHERE status = 'open' ORDER BY created_at DESC LIMIT ${limit}
    `),

    /** The outbox has no dead-letter state — `drainOutbox` retries with a
     *  capped backoff forever — so `deadLettered` is always zero here.
     *  `lastError` is the newest refusal, which is the drain's diagnosis. */
    outbox: () => one<OutboxRow>(sql`
      SELECT count(*) FILTER (WHERE published_at IS NULL) AS undelivered,
             min(created_at) FILTER (WHERE published_at IS NULL) AS "oldestAt",
             0 AS "deadLettered",
             max(published_at) AS "lastPublishedAt",
             (SELECT last_error FROM outbox WHERE published_at IS NULL AND last_error IS NOT NULL
              ORDER BY available_at DESC LIMIT 1) AS "lastError"
      FROM outbox
    `),

    /** Per topic, so a backlog of one kind cannot hide a stuck row of another. */
    outboxByTopic: () => many<OutboxTopicRow>(sql`
      SELECT topic, count(*) AS pending, min(created_at) AS "oldestAt",
             max(attempts) AS "maxAttempts", min(available_at) AS "nextAvailableAt"
      FROM outbox WHERE published_at IS NULL
      GROUP BY topic ORDER BY pending DESC, topic
    `),

    /* ── recovery writes ──────────────────────────────────────────────────── */

    jobById: (id: string) => one<ConsoleJobState>(sql`
      SELECT id, job_key AS "jobKey", stage, state, attempts, max_attempts AS "maxAttempts",
             lease_until AS "leaseUntil", last_error AS "lastError",
             contract_version AS "contractVersion", local_date AS "localDate",
             source_id AS "sourceId", edition_id AS "editionId", checkpoint
      FROM briefing_job WHERE id = ${id}
    `),

    /** Returns a job to the ready queue. Stays inside the ledger's own
     *  invariants: a lease is only cleared once it has lapsed, and attempts
     *  reset only when the operator asked. */
    requeueJob: (id: string, resetAttempts: boolean) => one<ConsoleJobState>(sql`
      UPDATE briefing_job
      SET state = 'pending',
          available_at = now(),
          lease_until = NULL,
          heartbeat_at = NULL,
          finished_at = NULL,
          attempts = CASE WHEN ${resetAttempts} THEN 0 ELSE attempts END,
          updated_at = now()
      WHERE id = ${id}
        AND (state <> 'running' OR lease_until < now())
        AND state <> 'completed'
      RETURNING id, job_key AS "jobKey", stage, state, attempts, max_attempts AS "maxAttempts",
                lease_until AS "leaseUntil", last_error AS "lastError",
                contract_version AS "contractVersion", local_date AS "localDate",
                source_id AS "sourceId", edition_id AS "editionId", checkpoint
    `),

    alertById: (id: string) => one<AlertRow>(sql`SELECT ${ALERT_COLUMNS} FROM briefing_alert WHERE id = ${id}`),

    /** One quarantine entry in full, open or closed — the `before` read a
     *  resolve/discard decision audits against. */
    quarantineById: (id: string) => one<QuarantineEntryRow>(sql`
      SELECT id, candidate_key AS "candidateKey", stage, reason, status,
             resolved_at AS "resolvedAt", created_at AS "createdAt"
      FROM briefing_quarantine WHERE id = ${id}
    `),

    /** Closes an entry the way `resolveAlert` closes an alert: only an open
     *  row, only to the status asked, refusing already-closed rows by
     *  returning nothing. */
    closeQuarantine: (id: string, status: "resolved" | "discarded") => one<QuarantineEntryRow>(sql`
      UPDATE briefing_quarantine SET status = ${status}, resolved_at = now()
      WHERE id = ${id} AND status = 'open'
      RETURNING id, candidate_key AS "candidateKey", stage, reason, status,
                resolved_at AS "resolvedAt", created_at AS "createdAt"
    `),

    resolveAlert: (id: string) => one<AlertRow>(sql`
      UPDATE briefing_alert SET resolved_at = now(), updated_at = now()
      WHERE id = ${id} AND resolved_at IS NULL
      RETURNING ${ALERT_COLUMNS}
    `),

    publicationVersions: (publicationId: string) => many<VersionRow>(sql`
      SELECT id AS "versionId", version_number AS "versionNumber", created_at AS "createdAt",
             changed_by_label AS "actorLabel", change_summary AS "changeSummary", snapshot
      FROM entity_version
      WHERE entity_id = ${publicationId} AND entity_type IN ${PUBLICATION_ENTITY_TYPES}
      ORDER BY version_number DESC
    `),

    publicationVersion: (publicationId: string, versionId: string) => one<VersionRow>(sql`
      SELECT id AS "versionId", version_number AS "versionNumber", created_at AS "createdAt",
             changed_by_label AS "actorLabel", change_summary AS "changeSummary", snapshot
      FROM entity_version
      WHERE id = ${versionId} AND entity_id = ${publicationId} AND entity_type IN ${PUBLICATION_ENTITY_TYPES}
    `),

    publicationHead: (publicationId: string) => one<{ id: string; currentVersionId: string | null }>(sql`
      SELECT id, current_version_id AS "currentVersionId" FROM publication WHERE id = ${publicationId}
    `),

    /* ── prompt registry, entity versions, evidence provenance ──────────── */

    /** The whole registry, one read. Versions come back newest first per
     *  slug; the active flag is whatever the partial unique index permits —
     *  at most one `activated_at` per slug. */
    promptVersions: () => many<PromptVersionRow>(sql`
      SELECT id, slug, version, kind::text AS kind, template,
             model_profile AS "modelProfile", notes,
             activated_at AS "activatedAt", created_at AS "createdAt"
      FROM prompt_registry
      ORDER BY slug, version DESC
    `),

    nextPromptVersion: (slug: string) => one<{ next: Count }>(sql`
      SELECT coalesce(max(version), 0) + 1 AS next FROM prompt_registry WHERE slug = ${slug}
    `),

    promptVersion: (slug: string, version: number) => one<PromptVersionRow>(sql`
      SELECT id, slug, version, kind::text AS kind, template,
             model_profile AS "modelProfile", notes,
             activated_at AS "activatedAt", created_at AS "createdAt"
      FROM prompt_registry
      WHERE slug = ${slug} AND version = ${version}
    `),

    /** The insert the append-only table allows: a new, inactive version. The
     *  `activate_prompt()` function below is the only thing that may set
     *  `activated_at`. */
    insertPromptVersion: (values: {
      slug: string;
      version: number;
      kind: string;
      template: string;
      modelProfile: string;
      notes: string | null;
    }) => one<PromptVersionRow>(sql`
      INSERT INTO prompt_registry (slug, version, kind, template, model_profile, notes, created_by)
      VALUES (${values.slug}, ${values.version}, ${values.kind}::ai_run_kind, ${values.template},
              ${values.modelProfile}, ${values.notes}, NULL)
      RETURNING id, slug, version, kind::text AS kind, template,
                model_profile AS "modelProfile", notes,
                activated_at AS "activatedAt", created_at AS "createdAt"
    `),

    /** The one sanctioned mutation of `prompt_registry`: the SQL function
     *  `activate_prompt()` (migration 0011) deactivates the previous version
     *  and activates the requested one inside the caller's transaction. It
     *  raises `no_data_found` for a version that does not exist. */
    activatePrompt: (slug: string, version: number) => one<{ id: string }>(sql`
      SELECT activate_prompt(${slug}, ${version}) AS id
    `),

    /** Every version of one entity, newest first — `publicationVersions`
     *  generalised over the whole `entity_type` vocabulary. */
    entityVersions: (input: ListEntityVersions) => many<EntityVersionRow>(sql`
      SELECT id AS "versionId", version_number AS "versionNumber", created_at AS "createdAt",
             changed_by_label AS "actorLabel", change_summary AS "changeSummary",
             change_source::text AS "changeSource", snapshot
      FROM entity_version
      WHERE entity_type = ${input.entityType}::entity_type AND entity_id = ${input.entityId}
      ORDER BY version_number DESC
      LIMIT ${input.limit}
    `),

    evidenceExists: (id: string) => one<{ id: string }>(sql`SELECT id FROM evidence WHERE id = ${id}`),

    /** The evidence's provenance trail, newest first — the append-only
     *  captured/retrieved entries `evidence/service.ts` opens and extends. */
    evidenceProvenance: (evidenceId: string) => many<ProvenanceRow>(sql`
      SELECT id, action, actor_label AS "actorLabel", actor_user_id AS "actorUserId",
             detail, created_at AS "occurredAt"
      FROM evidence_provenance
      WHERE evidence_id = ${evidenceId}
      ORDER BY created_at DESC, id DESC
    `),
  };
}

/** `LIKE` treats `%` and `_` as wildcards; a prefix filter must not. */
function editorialScope(input?: ListEditorial): SQL {
  const clauses: SQL[] = [sql`true`];
  if (input?.briefingOnly) clauses.push(sql`p.briefing_run_id IS NOT NULL`);
  if (input?.q) clauses.push(sql`(p.title ILIKE ${`%${escapeLike(input.q)}%`} OR p.public_id ILIKE ${`%${escapeLike(input.q)}%`})`);
  return sql.join(clauses, sql` AND `);
}

function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export type AdminConsoleRepo = ReturnType<typeof adminConsoleRepo>;
