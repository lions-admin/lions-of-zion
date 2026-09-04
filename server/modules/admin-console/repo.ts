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
import type { ListAudit } from "@/server/contracts/admin-console";

type Db = {
  execute: <T>(query: unknown) => Promise<{ rows: T[] }>;
};

type Count = string | number;
type Ts = Date | string | null;

export type OverviewRow = {
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
  homepageSlot: number | null;
  briefingRunId: string | null;
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
export type OutboxRow = { undelivered: Count; oldestAt: Ts; deadLettered: Count };

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

    /* ── editorial ────────────────────────────────────────────────────────── */

    editorialCounts: () => many<EditorialCountRow>(sql`
      SELECT status::text AS status, count(*) AS count FROM publication GROUP BY status
    `),

    /** Every lane in one read: newest first, `perLane` rows per lane. The
     *  `published` lane holds both `published` and `updated`. */
    editorialCards: (perLane = 30) => many<EditorialCardRow>(sql`
      SELECT * FROM (
        SELECT p.id, p.public_id AS "publicId", p.title, p.summary,
               p.section::text AS section, p.status::text AS status,
               p.featured_israel_story AS "featuredIsraelStory",
               hf.slot AS "homepageSlot",
               p.briefing_run_id AS "briefingRunId",
               (SELECT count(*) FROM publication_evidence pe WHERE pe.publication_id = p.id) AS "evidenceCount",
               p.created_at AS "createdAt", p.updated_at AS "updatedAt", p.published_at AS "publishedAt",
               CASE WHEN p.status IN ('published', 'updated') THEN 'published' ELSE p.status::text END AS lane,
               row_number() OVER (
                 PARTITION BY (CASE WHEN p.status IN ('published', 'updated') THEN 'published' ELSE p.status::text END)
                 ORDER BY p.created_at DESC
               ) AS rn
        FROM publication p
        LEFT JOIN homepage_feature hf ON hf.publication_id = p.id
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
     *  capped backoff forever — so `deadLettered` is always zero here. */
    outbox: () => one<OutboxRow>(sql`
      SELECT count(*) AS undelivered, min(created_at) AS "oldestAt", 0 AS "deadLettered"
      FROM outbox WHERE published_at IS NULL
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
  };
}

/** `LIKE` treats `%` and `_` as wildcards; a prefix filter must not. */
function escapeLike(value: string): string {
  return value.replace(/[\\%_]/g, (match) => `\\${match}`);
}

export type AdminConsoleRepo = ReturnType<typeof adminConsoleRepo>;
