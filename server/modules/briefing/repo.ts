import "server-only";

import { agentSearchEstimatedUnitCostUsd, agentSearchMonthlyBudgetUsd } from "@/server/core/config";

import { sql } from "drizzle-orm";
import { sourceCategoryForDomain } from "@/server/modules/sources/catalog";
import type { DraftClaim, QualityCheck } from "./quality";

export type BriefingEvidence = {
  id: string;
  title: string;
  excerpt: string | null;
  url: string | null;
  canonicalUrl: string | null;
  publisherDomain: string | null;
  language: string;
  publishedAt: Date | null;
  capturedAt: Date;
  publisher: string;
  sourceFamilyId: string;
  sourceCategory: string | null;
  normalizedContentHash: string | null;
  usableTextLength: number;
  retrievalStatus: string;
  accessState: string;
};

type RawBriefingEvidence = Omit<BriefingEvidence, "publishedAt" | "capturedAt"> & {
  publishedAt: Date | string | null;
  capturedAt: Date | string;
};

type Db = {
  execute: <T>(query: unknown) => Promise<{ rows: T[] }>;
};

/* One projection, two entry points. `recentEvidence` opens the collection
 * window; `recentEvidenceByIds` re-reads the exact packet an edition already
 * closed over. They must return identical shapes, so the column list, the
 * public-and-open filter, and the row mapper are written once. */
const EVIDENCE_COLUMNS = sql`
  e.id,
  e.title,
  e.excerpt,
  e.url,
  e.canonical_url AS "canonicalUrl",
  e.publisher_domain AS "publisherDomain",
  e.language,
  e.published_at AS "publishedAt",
  e.captured_at AS "capturedAt",
  s.name AS publisher,
  s.source_family_id AS "sourceFamilyId",
  s.config->>'category' AS "sourceCategory",
  e.normalized_content_hash AS "normalizedContentHash",
  e.usable_text_length AS "usableTextLength",
  e.retrieval_status AS "retrievalStatus",
  e.access_state AS "accessState"
`;

const EVIDENCE_FROM = sql`FROM evidence e JOIN source s ON s.id = e.source_id`;

const EVIDENCE_IS_USABLE = sql`
  e.data_class = 'public'
  AND e.canonical_url IS NOT NULL
  AND e.access_state = 'open'
  AND e.retrieval_status IN ('fetched', 'partial')
`;

function mapEvidence(rows: RawBriefingEvidence[]): BriefingEvidence[] {
  return rows.map((entry) => ({
    ...entry,
    // Older Google-discovered publisher rows predate category persistence.
    // Derive the same reviewed category from the original publisher domain
    // so historical evidence is subject to the current quality gates too.
    sourceCategory: entry.sourceCategory ?? sourceCategoryForDomain(entry.publisherDomain),
    publishedAt: entry.publishedAt instanceof Date
      ? entry.publishedAt
      : entry.publishedAt ? new Date(entry.publishedAt) : null,
    capturedAt: entry.capturedAt instanceof Date ? entry.capturedAt : new Date(entry.capturedAt),
  }));
}

export function briefingRepo(db: unknown) {
  const d = db as Db;

  return {
    async control(): Promise<{ automaticPublicationPaused: boolean; updatedAt: string | null }> {
      const result = await d.execute<{ automaticPublicationPaused: boolean; updatedAt: string | null }>(sql`
        SELECT automatic_publication_paused AS "automaticPublicationPaused",
               updated_at::text AS "updatedAt"
        FROM briefing_control
        WHERE id = 'global'
      `);
      return result.rows[0] ?? { automaticPublicationPaused: true, updatedAt: null };
    },

    async setAutomaticPublicationPaused(paused: boolean, actorLabel: string): Promise<void> {
      await d.execute(sql`
        INSERT INTO briefing_control (id, automatic_publication_paused, updated_by)
        VALUES ('global', ${paused}, ${actorLabel})
        ON CONFLICT (id) DO UPDATE
        SET automatic_publication_paused = EXCLUDED.automatic_publication_paused,
            updated_by = EXCLUDED.updated_by,
            updated_at = now()
      `);
    },

    async acquire(localDate: string, stage: string): Promise<string | null> {
      const result = await d.execute<{ id: string }>(sql`
        INSERT INTO briefing_run (local_date, stage, status, started_at)
        VALUES (${localDate}, ${stage}, 'running', now())
        ON CONFLICT (local_date, stage) DO UPDATE
        SET status = 'running',
            started_at = now(),
            finished_at = NULL,
            input_count = 0,
            output_count = 0,
            error_message = NULL
        WHERE briefing_run.status = 'failed'
        RETURNING id
      `);
      return result.rows[0]?.id ?? null;
    },

    async reopenRunForManualRetry(localDate: string, stage: string): Promise<void> {
      await d.execute(sql`
        UPDATE briefing_run
        SET status = 'failed', error_message = 'Manual regeneration requested',
            finished_at = now()
        WHERE local_date = ${localDate} AND stage = ${stage} AND status <> 'failed'
      `);
    },

    async ensureEdition(localDate: string, contractVersion: string, promptVersion: string): Promise<string> {
      const result = await d.execute<{ id: string }>(sql`
        INSERT INTO briefing_edition (
          local_date, status, contract_version, prompt_version, collection_opened_at
        ) VALUES (${localDate}, 'processing', ${contractVersion}, ${promptVersion}, now())
        ON CONFLICT (local_date) DO UPDATE
        SET status = CASE
              WHEN briefing_edition.status IN ('published', 'quarantined') THEN briefing_edition.status
              ELSE 'processing'
            END,
            contract_version = CASE
              WHEN briefing_edition.status IN ('published', 'quarantined') THEN briefing_edition.contract_version
              ELSE EXCLUDED.contract_version
            END,
            prompt_version = CASE
              WHEN briefing_edition.status IN ('published', 'quarantined') THEN briefing_edition.prompt_version
              ELSE EXCLUDED.prompt_version
            END,
            collection_closed_at = coalesce(briefing_edition.collection_closed_at, now()),
            updated_at = now()
        RETURNING id
      `);
      return result.rows[0]!.id;
    },

    async editionByDate(localDate: string): Promise<{ id: string; status: string; publishedAt: Date | null } | undefined> {
      const result = await d.execute<{ id: string; status: string; publishedAt: Date | null }>(sql`
        SELECT id, status, published_at AS "publishedAt"
        FROM briefing_edition WHERE local_date = ${localDate} LIMIT 1
      `);
      return result.rows[0];
    },

    async saveArtifact(
      editionId: string,
      stage: "enrich" | "cluster" | "triage" | "draft" | "quality",
      inputHash: string,
      payload: unknown,
    ): Promise<void> {
      await d.execute(sql`
        INSERT INTO briefing_stage_artifact (edition_id, stage, artifact_version, input_hash, payload)
        VALUES (${editionId}, ${stage}, 1, ${inputHash}, ${JSON.stringify(payload)}::jsonb)
        ON CONFLICT (edition_id, stage, artifact_version) DO UPDATE
        SET input_hash = EXCLUDED.input_hash,
            payload = EXCLUDED.payload
      `);
    },

    async artifact(editionId: string, stage: string): Promise<unknown | undefined> {
      const result = await d.execute<{ payload: unknown }>(sql`
        SELECT payload
        FROM briefing_stage_artifact
        WHERE edition_id = ${editionId} AND stage = ${stage}
        ORDER BY artifact_version DESC
        LIMIT 1
      `);
      return result.rows[0]?.payload;
    },

    async markEdition(localDate: string, status: "quarantined" | "published" | "failed"): Promise<void> {
      await d.execute(sql`
        UPDATE briefing_edition
        SET status = ${status},
            collection_closed_at = coalesce(collection_closed_at, now()),
            published_at = CASE WHEN ${status} = 'published' THEN now() ELSE published_at END,
            updated_at = now()
        WHERE local_date = ${localDate}
      `);
    },

    async markEditionById(editionId: string, status: "quarantined" | "published" | "failed"): Promise<void> {
      await d.execute(sql`
        UPDATE briefing_edition
        SET status = ${status},
            collection_closed_at = coalesce(collection_closed_at, now()),
            published_at = CASE WHEN ${status} = 'published' THEN now() ELSE published_at END,
            updated_at = now()
        WHERE id = ${editionId}
      `);
    },

    async reopenQuarantinedEdition(editionId: string): Promise<void> {
      await d.execute(sql`
        UPDATE briefing_edition
        SET status = 'processing', updated_at = now()
        WHERE id = ${editionId} AND status = 'quarantined'
      `);
    },

    /** A deliberate operator regeneration preserves the prior edition's
     * immutable artifacts and audit trail, but makes the current edition
     * eligible to produce a new triage/draft/quality/publication chain. */
    async reopenPublishedEdition(
      editionId: string,
      contractVersion: string,
      promptVersion: string,
    ): Promise<void> {
      await d.execute(sql`
        UPDATE briefing_edition
        SET status = 'processing',
            contract_version = ${contractVersion},
            prompt_version = ${promptVersion},
            updated_at = now()
        WHERE id = ${editionId} AND status = 'published'
      `);
    },

    async linkAiRun(briefingRunId: string, aiRunId: string, stage: string): Promise<void> {
      await d.execute(sql`
        INSERT INTO briefing_run_ai (briefing_run_id, ai_run_id, stage)
        VALUES (${briefingRunId}, ${aiRunId}, ${stage})
        ON CONFLICT DO NOTHING
      `);
    },

    async recordStoryClusters(
      editionId: string,
      stories: readonly { title: string; evidenceIds: readonly string[] }[],
      evidenceById: ReadonlyMap<string, BriefingEvidence>,
    ): Promise<void> {
      for (const [storyIndex, story] of stories.entries()) {
        const rows = story.evidenceIds.flatMap((id) => {
          const evidence = evidenceById.get(id);
          return evidence ? [evidence] : [];
        });
        if (!rows.length) continue;
        const primary = rows[0]!;
        const cluster = await d.execute<{ id: string }>(sql`
          INSERT INTO briefing_story_cluster (edition_id, story_key, title, primary_evidence_id)
          VALUES (${editionId}, ${`story-${storyIndex + 1}`}, ${story.title}, ${primary.id})
          ON CONFLICT (edition_id, story_key) DO UPDATE
          SET title = EXCLUDED.title,
              primary_evidence_id = EXCLUDED.primary_evidence_id
          RETURNING id
        `);
        const primaryFamily = primary.sourceFamilyId;
        for (const [evidenceIndex, evidence] of rows.entries()) {
          const role = evidenceIndex === 0
            ? "primary"
            : evidence.sourceFamilyId === primaryFamily ? "syndicated" : "independent";
          await d.execute(sql`
            INSERT INTO briefing_story_evidence (cluster_id, evidence_id, role, source_family_id)
            VALUES (${cluster.rows[0]!.id}, ${evidence.id}, ${role}, ${evidence.sourceFamilyId})
            ON CONFLICT (cluster_id, evidence_id) DO UPDATE SET role = EXCLUDED.role
          `);
        }
      }
    },

    async recordQualityChecks(
      briefingRunId: string,
      candidateKey: string,
      checks: readonly QualityCheck[],
    ): Promise<void> {
      for (const check of checks) {
        await d.execute(sql`
          INSERT INTO briefing_quality_check (
            briefing_run_id, candidate_key, check_name, status, detail
          ) VALUES (${briefingRunId}, ${candidateKey}, ${check.name}, ${check.status}, ${check.detail})
          ON CONFLICT (briefing_run_id, candidate_key, check_name) DO UPDATE
          SET status = EXCLUDED.status,
              detail = EXCLUDED.detail
        `);
      }
    },

    async quarantine(
      briefingRunId: string,
      candidateKey: string,
      stage: string,
      reason: string,
      payload: unknown,
    ): Promise<void> {
      await d.execute(sql`
        INSERT INTO briefing_quarantine (
          briefing_run_id, candidate_key, stage, reason, payload
        ) VALUES (${briefingRunId}, ${candidateKey}, ${stage}, ${reason}, ${JSON.stringify(payload)}::jsonb)
        ON CONFLICT (briefing_run_id, candidate_key) WHERE status = 'open' DO UPDATE
        SET stage = EXCLUDED.stage,
            reason = EXCLUDED.reason,
            payload = EXCLUDED.payload
      `);
    },

    async resolveQuarantine(briefingRunId: string, candidateKeys: readonly string[]): Promise<void> {
      if (!candidateKeys.length) return;
      await d.execute(sql`
        UPDATE briefing_quarantine
        SET status = 'resolved', resolved_at = now()
        WHERE briefing_run_id = ${briefingRunId}
          AND candidate_key IN (${sql.join(candidateKeys.map((key) => sql`${key}`), sql`, `)})
          AND status = 'open'
      `);
    },

    async recordClaim(
      itemId: string,
      claim: DraftClaim,
      aiRunId: string,
    ): Promise<void> {
      await d.execute(sql`
        INSERT INTO briefing_claim (
          item_id, layer, machine_assessment, attributed_to, uncertainty, ai_run_id
        ) VALUES (
          ${itemId}, ${claim.layer}, ${claim.assessment}, ${claim.attributedTo}, ${claim.uncertainty}, ${aiRunId}
        )
        ON CONFLICT (item_id) DO NOTHING
      `);
    },

    async complete(id: string, inputCount: number, outputCount: number): Promise<void> {
      await d.execute(sql`
        UPDATE briefing_run
        SET status = 'completed',
            input_count = ${inputCount},
            output_count = ${outputCount},
            finished_at = now(),
            error_message = NULL
        WHERE id = ${id}
      `);
    },

    async fail(id: string, inputCount: number, errorMessage: string): Promise<void> {
      await d.execute(sql`
        UPDATE briefing_run
        SET status = 'failed',
            input_count = ${inputCount},
            finished_at = now(),
            error_message = ${errorMessage.slice(0, 1_000)}
        WHERE id = ${id}
      `);
    },

    async recentEvidence(since: Date, limit = 80): Promise<BriefingEvidence[]> {
      const result = await d.execute<RawBriefingEvidence>(sql`
        SELECT ${EVIDENCE_COLUMNS}
        ${EVIDENCE_FROM}
        WHERE ${EVIDENCE_IS_USABLE}
          AND e.captured_at >= ${since}
        ORDER BY coalesce(e.published_at, e.captured_at) DESC
        LIMIT ${limit}
      `);
      return mapEvidence(result.rows);
    },

    /**
     * The evidence an edition's enrich artifact actually named.
     *
     * Every later stage needs exactly this set. Reading it by id rather than
     * re-opening a time window and filtering in memory is not only cheaper —
     * it is the correct behaviour. A window read drops rows whenever the
     * edition is processed outside the window (a retry the next day) or the
     * day produced more rows than the limit, and the loss is silent right up
     * until `validateDraftEvidence` throws on an id the model was legitimately
     * given. The recorded packet is closed; read it as such.
     */
    async recentEvidenceByIds(ids: readonly string[]): Promise<BriefingEvidence[]> {
      if (!ids.length) return [];
      const result = await d.execute<RawBriefingEvidence>(sql`
        SELECT ${EVIDENCE_COLUMNS}
        ${EVIDENCE_FROM}
        WHERE ${EVIDENCE_IS_USABLE}
          AND e.id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
        ORDER BY coalesce(e.published_at, e.captured_at) DESC
      `);
      return mapEvidence(result.rows);
    },

    /**
     * Which of these rows the enrich stage has already fetched in full.
     *
     * `retrieval_status` cannot answer this: ingestion writes `'fetched'` for
     * any feed item that arrived with an excerpt, so the status says "we have
     * some text", not "we have been to the page". The `retrieved` provenance
     * entry is written only by `evidenceService.enrich`, so it says exactly
     * what is being asked, and a genuinely short article is therefore fetched
     * once rather than on every day it stays inside the collection window.
     */
    async enrichedEvidenceIds(ids: readonly string[]): Promise<Set<string>> {
      if (!ids.length) return new Set();
      const result = await d.execute<{ evidenceId: string }>(sql`
        SELECT DISTINCT evidence_id AS "evidenceId"
        FROM evidence_provenance
        WHERE action = 'retrieved'
          AND evidence_id IN (${sql.join(ids.map((id) => sql`${id}`), sql`, `)})
      `);
      return new Set(result.rows.map((row) => row.evidenceId));
    },

    async summary(): Promise<{
      latestRunAt: string | null;
      failedRuns: number;
      unprocessedEvidence: number;
      automaticPublicationPaused: boolean;
      sources: Array<{
        id: string; name: string; kind: string; active: boolean; consecutiveFailures: number;
        lastSuccessfulFetchAt: string | null; disabledReason: string | null; verificationError: string | null;
        attempts: number; successfulAttempts: number; itemsSeen: number; itemsNew: number;
      }>;
      jobs: Array<{ state: string; count: number; oldestAt: string | null }>;
      quarantine: Array<{ id: string; candidateKey: string; stage: string; reason: string; createdAt: string }>;
      runs: Array<{ id: string; localDate: string; stage: string; status: string; inputCount: number; outputCount: number; error: string | null; startedAt: string }>;
      spend: { last24HoursUsd: number; last30DaysUsd: number; byModel: Array<{ model: string; stage: string; costUsd: number; calls: number }> };
      clustersLast24Hours: number;
      googleUsage: { attemptsThisMonth: number; successfulQueriesThisMonth: number; estimatedSpendUsd: number | null; monthlyBudgetUsd: number | null };
      pipelineCounts: { rawResults: number; uniqueResults: number; enrichedEvidence: number; extractedClaims: number; rawBytes30d: number };
      narrativeTrends: Array<{ id: string; title: string; status: string; observationCount: number; lastSeenAt: string | null }>;
      alerts: Array<{ id: string; kind: string; severity: string; message: string; createdAt: string; notifiedAt: string | null }>;
      migration: { available: boolean; applied: number; latestId: number | null; latestAppliedAt: string | null };
    }> {
      const [result, sources, jobs, quarantine, runs, spend, byModel, clusters, googleUsage, pipelineCounts, narrativeTrends, alerts, control, migration] = await Promise.all([
      d.execute<{
        latestRunAt: string | null;
        failedRuns: string | number;
        unprocessedEvidence: string | number;
      }>(sql`
        SELECT
          (SELECT max(created_at)::text FROM briefing_run) AS "latestRunAt",
          (SELECT count(*) FROM briefing_run
             WHERE status = 'failed' AND created_at >= now() - interval '7 days') AS "failedRuns",
          (SELECT count(*) FROM evidence e
             WHERE e.data_class = 'public'
               AND e.captured_at >= now() - interval '48 hours'
               AND NOT EXISTS (
                 SELECT 1 FROM publication_evidence pe WHERE pe.evidence_id = e.id
               )) AS "unprocessedEvidence"
      `),
      d.execute<{
        id: string; name: string; kind: string; active: boolean; consecutiveFailures: number;
        lastSuccessfulFetchAt: string | null; disabledReason: string | null; verificationError: string | null;
        attempts: string | number; successfulAttempts: string | number; itemsSeen: string | number; itemsNew: string | number;
      }>(sql`
        SELECT s.id, s.name, s.kind, s.active,
               s.consecutive_failures AS "consecutiveFailures",
               s.last_successful_fetch_at::text AS "lastSuccessfulFetchAt",
               s.disabled_reason AS "disabledReason",
               s.config ->> 'verificationError' AS "verificationError",
               count(sf.id) FILTER (WHERE sf.started_at >= now() - interval '7 days') AS attempts,
               count(sf.id) FILTER (WHERE sf.status = 'success' AND sf.started_at >= now() - interval '7 days') AS "successfulAttempts",
               coalesce(sum(sf.items_seen) FILTER (WHERE sf.started_at >= now() - interval '7 days'), 0) AS "itemsSeen",
               coalesce(sum(sf.items_new) FILTER (WHERE sf.started_at >= now() - interval '7 days'), 0) AS "itemsNew"
        FROM source s
        LEFT JOIN source_fetch sf ON sf.source_id = s.id
        WHERE s.kind IN ('rss', 'api', 'gdelt', 'agent_search')
        GROUP BY s.id
        ORDER BY s.active DESC, s.name
      `),
      d.execute<{ state: string; count: string | number; oldestAt: string | null }>(sql`
        SELECT state, count(*) AS count, min(created_at)::text AS "oldestAt"
        FROM briefing_job GROUP BY state ORDER BY state
      `),
      d.execute<{ id: string; candidateKey: string; stage: string; reason: string; createdAt: string }>(sql`
        SELECT bq.id, bq.candidate_key AS "candidateKey", bq.stage, bq.reason,
               bq.created_at::text AS "createdAt"
        FROM briefing_quarantine bq
        JOIN briefing_run br ON br.id = bq.briefing_run_id
        WHERE bq.status = 'open'
          AND br.id = (
            SELECT id FROM briefing_run
            WHERE stage = 'quality'
            ORDER BY created_at DESC
            LIMIT 1
          )
          AND EXISTS (
            SELECT 1 FROM briefing_quality_check bqc
            WHERE bqc.briefing_run_id = bq.briefing_run_id
              AND bqc.candidate_key = bq.candidate_key
              AND bqc.status = 'fail'
          )
        ORDER BY bq.created_at DESC LIMIT 25
      `),
      d.execute<{ id: string; localDate: string; stage: string; status: string; inputCount: number; outputCount: number; error: string | null; startedAt: string }>(sql`
        SELECT id, local_date AS "localDate", stage, status,
               input_count AS "inputCount", output_count AS "outputCount",
               error_message AS error, started_at::text AS "startedAt"
        FROM briefing_run ORDER BY created_at DESC LIMIT 25
      `),
      d.execute<{ last24HoursUsd: string | number; last30DaysUsd: string | number }>(sql`
        SELECT coalesce(sum(ar.cost_usd) FILTER (WHERE ar.created_at >= now() - interval '24 hours'), 0) AS "last24HoursUsd",
               coalesce(sum(ar.cost_usd) FILTER (WHERE ar.created_at >= now() - interval '30 days'), 0) AS "last30DaysUsd"
        FROM ai_run ar WHERE ar.model_profile IN ('briefing_triage', 'briefing_draft')
      `),
      d.execute<{ model: string; stage: string; costUsd: string | number; calls: string | number }>(sql`
        SELECT ar.model, bra.stage, coalesce(sum(ar.cost_usd), 0) AS "costUsd", count(*) AS calls
        FROM briefing_run_ai bra JOIN ai_run ar ON ar.id = bra.ai_run_id
        WHERE ar.created_at >= now() - interval '30 days'
        GROUP BY ar.model, bra.stage ORDER BY "costUsd" DESC
      `),
      d.execute<{ count: string | number }>(sql`
        SELECT count(*) AS count FROM briefing_story_cluster WHERE created_at >= now() - interval '24 hours'
      `),
      d.execute<{ attempts: string | number; successful: string | number }>(sql`
        SELECT count(*) AS attempts,
               count(*) FILTER (WHERE sf.status = 'success') AS successful
        FROM source_fetch sf JOIN source s ON s.id = sf.source_id
        WHERE s.kind = 'agent_search' AND sf.started_at >= date_trunc('month', now())
      `),
      d.execute<{ rawResults: string | number; uniqueResults: string | number; enrichedEvidence: string | number; extractedClaims: string | number; rawBytes30d: string | number }>(sql`
        SELECT
          (SELECT coalesce(sum(items_seen), 0) FROM source_fetch WHERE started_at >= now() - interval '24 hours') AS "rawResults",
          (SELECT coalesce(sum(items_new), 0) FROM source_fetch WHERE started_at >= now() - interval '24 hours') AS "uniqueResults",
          (SELECT count(*) FROM evidence WHERE updated_at >= now() - interval '24 hours' AND usable_text_length >= 1000 AND retrieval_status = 'fetched') AS "enrichedEvidence",
          (SELECT count(*) FROM briefing_claim WHERE created_at >= now() - interval '24 hours') AS "extractedClaims",
          (SELECT coalesce(sum(coalesce((to_jsonb(source_fetch)->>'raw_byte_size')::bigint, 0)), 0) FROM source_fetch WHERE started_at >= now() - interval '30 days') AS "rawBytes30d"
      `),
      d.execute<{ id: string; title: string; status: string; observationCount: string | number; lastSeenAt: string | null }>(sql`
        SELECT id, title, status, observation_count AS "observationCount", last_seen_at::text AS "lastSeenAt"
        FROM narrative
        WHERE last_seen_at >= now() - interval '30 days'
        ORDER BY observation_count DESC, last_seen_at DESC
        LIMIT 12
      `),
      d.execute<{ id: string; kind: string; severity: string; message: string; createdAt: string; notifiedAt: string | null }>(sql`
        SELECT id, kind, severity, message, created_at::text AS "createdAt", notified_at::text AS "notifiedAt"
        FROM briefing_alert WHERE resolved_at IS NULL ORDER BY created_at DESC LIMIT 20
      `),
      this.control(),
      d.execute<{ applied: string | number; latestId: string | number | null; latestAppliedAt: string | null }>(sql`
        SELECT count(*) AS applied,
               max(id) AS "latestId",
               to_timestamp(max(created_at) / 1000.0)::text AS "latestAppliedAt"
        FROM drizzle.__drizzle_migrations
      `).catch(() => ({ rows: [], unavailable: true })),
      ]);
      const row = result.rows[0];
      return {
        latestRunAt: row?.latestRunAt ?? null,
        failedRuns: Number(row?.failedRuns ?? 0),
        unprocessedEvidence: Number(row?.unprocessedEvidence ?? 0),
        automaticPublicationPaused: control.automaticPublicationPaused,
        sources: sources.rows.map((source) => ({
          ...source,
          consecutiveFailures: Number(source.consecutiveFailures),
          attempts: Number(source.attempts), successfulAttempts: Number(source.successfulAttempts),
          itemsSeen: Number(source.itemsSeen), itemsNew: Number(source.itemsNew),
        })),
        jobs: jobs.rows.map((job) => ({ ...job, count: Number(job.count) })),
        quarantine: quarantine.rows,
        runs: runs.rows.map((run) => ({ ...run, inputCount: Number(run.inputCount), outputCount: Number(run.outputCount) })),
        spend: {
          last24HoursUsd: Number(spend.rows[0]?.last24HoursUsd ?? 0),
          last30DaysUsd: Number(spend.rows[0]?.last30DaysUsd ?? 0),
          byModel: byModel.rows.map((entry) => ({ ...entry, costUsd: Number(entry.costUsd), calls: Number(entry.calls) })),
        },
        clustersLast24Hours: Number(clusters.rows[0]?.count ?? 0),
        googleUsage: {
          attemptsThisMonth: Number(googleUsage.rows[0]?.attempts ?? 0),
          successfulQueriesThisMonth: Number(googleUsage.rows[0]?.successful ?? 0),
          estimatedSpendUsd: agentSearchEstimatedUnitCostUsd() === undefined
            ? null
            : Number(googleUsage.rows[0]?.successful ?? 0) * agentSearchEstimatedUnitCostUsd()!,
          monthlyBudgetUsd: agentSearchMonthlyBudgetUsd() ?? null,
        },
        pipelineCounts: {
          rawResults: Number(pipelineCounts.rows[0]?.rawResults ?? 0),
          uniqueResults: Number(pipelineCounts.rows[0]?.uniqueResults ?? 0),
          enrichedEvidence: Number(pipelineCounts.rows[0]?.enrichedEvidence ?? 0),
          extractedClaims: Number(pipelineCounts.rows[0]?.extractedClaims ?? 0),
          rawBytes30d: Number(pipelineCounts.rows[0]?.rawBytes30d ?? 0),
        },
        narrativeTrends: narrativeTrends.rows.map((entry) => ({ ...entry, observationCount: Number(entry.observationCount) })),
        alerts: alerts.rows,
        migration: {
          available: !("unavailable" in migration),
          applied: Number(migration.rows[0]?.applied ?? 0),
          latestId: migration.rows[0]?.latestId == null ? null : Number(migration.rows[0].latestId),
          latestAppliedAt: migration.rows[0]?.latestAppliedAt ?? null,
        },
      };
    },
  };
}

export type BriefingRepo = ReturnType<typeof briefingRepo>;
