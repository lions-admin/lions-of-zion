import "server-only";

import { sql } from "drizzle-orm";
import {
  adminEmail,
  agentSearchEstimatedUnitCostUsd,
  agentSearchMonthlyBudgetUsd,
  agentSearchMonthlyLimit,
  briefingRawStorageWarningBytes,
  databasePoolConfig,
  briefingAiBudgets,
  briefingFeatures,
} from "@/server/core/config";
import { emit, TOPICS } from "@/server/core/outbox";
import { db } from "@/server/db/client";
import { sendWorkspaceEmail } from "@/server/core/email";
import { israelLocalDate, israelLocalHour } from "./service";

type Candidate = { kind: string; severity: "warning" | "critical"; message: string; details: Record<string, unknown> };
type Database = ReturnType<typeof db>;

/** A Postgres array literal, because a JS array bound as a parameter reaches
 *  the driver as a plain string. Alert kinds and ids never contain quotes. */
const pgArray = (values: string[]) => `{${values.map((value) => `"${value.replace(/["\\]/g, "")}"`).join(",")}}`;

/**
 * One reconciliation of the alert table against what is true right now.
 *
 * An alert here is the record of a condition, open for exactly as long as the
 * condition holds. Each evaluation therefore does three things in one
 * transaction: a kind that is firing keeps (or gets) one open row, a kind
 * that is not firing has its open rows resolved, and a kind that somehow has
 * more than one open row keeps only the newest. Only a *newly opened* row is
 * delivered by email, through the outbox; a refreshed one is not, so a
 * condition that holds for a week costs one message, not seven.
 *
 * That is the behaviour the table always implied and never had. Until
 * 2026-09-08 the fingerprint was `${kind}:${localDate}`, `resolved_at` was
 * written by the console's manual action and by nothing else, and evaluation
 * ran once a day from the maintenance cron — so a condition that held for a
 * week produced seven open critical rows and a condition that cleared left
 * every row it had produced open forever. The console counted all of them.
 *
 * The advisory lock is what makes "one open row per kind" true without a
 * unique index: the ingest cron and the maintenance cron can evaluate within
 * seconds of each other, and the second one must see the first one's rows.
 */
export async function evaluateAndQueueBriefingAlerts(database: Database = db(), now = new Date()) {
  const localDate = israelLocalDate(now);
  const [metrics, control, connections] = await Promise.all([
    database.execute<{
      failedRuns: number | string; quarantinedJobs: number | string; staleSources: number | string;
      oldestPendingMinutes: number | string | null; dailySpend: number | string; monthlySpend: number | string;
      publishedEdition: boolean; searchAttempts: number | string; searchSuccesses: number | string;
      rawBytes: number | string;
    }>(sql`
      SELECT
        (SELECT count(*) FROM briefing_run WHERE status = 'failed' AND created_at >= now() - interval '24 hours') AS "failedRuns",
        (SELECT count(*) FROM briefing_job WHERE state = 'quarantined') AS "quarantinedJobs",
        /* A source the scheduler is still fetching and that keeps failing is
         * an incident. A source the system has already taken out of rotation
         * — auto-disabled after five failures, or retired from the catalog —
         * is not: it is visible as such in the sources view, and the daily
         * re-verification sweep is what brings it back. Counting it here made
         * three dead feeds a permanent warning nobody could act on. */
        (SELECT count(*) FROM source
          WHERE consecutive_failures >= 3
            AND active
            AND coalesce(config ->> 'retired', 'false') <> 'true') AS "staleSources",
        /* Age of the oldest job a worker could actually claim. A row whose
         * attempt budget is spent is recoverStale's to quarantine, not this
         * metric's to report as a backlog. */
        (SELECT extract(epoch FROM (now() - min(created_at))) / 60 FROM briefing_job
          WHERE state = 'pending' AND attempts < max_attempts) AS "oldestPendingMinutes",
        (SELECT coalesce(sum(cost_usd), 0) FROM ai_run WHERE model_profile IN ('briefing_triage','briefing_draft') AND created_at >= now() - interval '24 hours') AS "dailySpend",
        (SELECT coalesce(sum(cost_usd), 0) FROM ai_run WHERE model_profile IN ('briefing_triage','briefing_draft') AND created_at >= now() - interval '30 days') AS "monthlySpend",
        EXISTS (SELECT 1 FROM briefing_edition WHERE local_date = ${localDate} AND status = 'published') AS "publishedEdition",
        (SELECT count(*) FROM source_fetch sf JOIN source s ON s.id = sf.source_id
          WHERE s.kind = 'agent_search' AND sf.started_at >= date_trunc('month', now())) AS "searchAttempts",
        (SELECT count(*) FROM source_fetch sf JOIN source s ON s.id = sf.source_id
          WHERE s.kind = 'agent_search' AND sf.status = 'success'
            AND sf.started_at >= date_trunc('month', now())) AS "searchSuccesses",
        (SELECT coalesce(sum(coalesce((to_jsonb(source_fetch)->>'raw_byte_size')::bigint, 0)), 0) FROM source_fetch
          WHERE started_at >= now() - interval '30 days') AS "rawBytes"
    `),
    database.execute<{ paused: boolean }>(sql`
      SELECT automatic_publication_paused AS paused FROM briefing_control WHERE id = 'global'
    `),
    database.execute<{ total: number | string; active: number | string; waiting: number | string }>(sql`
      SELECT count(*) AS total,
             count(*) FILTER (WHERE state = 'active') AS active,
             count(*) FILTER (WHERE wait_event IS NOT NULL) AS waiting
      FROM pg_stat_activity
      WHERE datname = current_database()
    `).catch(() => ({ rows: [] })),
  ]);
  const row = metrics.rows[0]!;
  const candidates: Candidate[] = [];
  const add = (condition: boolean, candidate: Candidate) => { if (condition) candidates.push(candidate); };
  add(Number(row.failedRuns) > 0, { kind: "failed_runs", severity: "critical", message: "One or more briefing stages failed in the last 24 hours.", details: { count: Number(row.failedRuns) } });
  add(Number(row.quarantinedJobs) > 0, { kind: "quarantined_jobs", severity: "critical", message: "Briefing jobs reached permanent quarantine.", details: { count: Number(row.quarantinedJobs) } });
  add(Number(row.staleSources) > 0, { kind: "stale_sources", severity: "warning", message: "One or more briefing sources are repeatedly failing.", details: { count: Number(row.staleSources) } });
  add(Number(row.oldestPendingMinutes ?? 0) > 30, { kind: "queue_age", severity: "critical", message: "The oldest pending briefing job is more than 30 minutes old.", details: { ageMinutes: Math.round(Number(row.oldestPendingMinutes)) } });
  const budgets = briefingAiBudgets();
  add(Number(row.dailySpend) >= budgets.daily * 0.8 || Number(row.monthlySpend) >= budgets.monthly * 0.8, {
    kind: "budget_near_limit", severity: "warning", message: "Briefing model spend reached at least 80 percent of a configured ceiling.",
    details: { dailyUsd: Number(row.dailySpend), monthlyUsd: Number(row.monthlySpend) },
  });
  const searchSuccesses = Number(row.searchSuccesses);
  const searchLimit = agentSearchMonthlyLimit();
  add(searchSuccesses >= searchLimit, {
    kind: "search_limit_exhausted", severity: "critical",
    message: "Google Agent Search reached its monthly query limit; new searches are stopped.",
    details: { successfulQueries: searchSuccesses, monthlyLimit: searchLimit },
  });
  add(searchSuccesses < searchLimit && searchSuccesses >= searchLimit * 0.8, {
    kind: "search_limit_near", severity: "warning",
    message: "Google Agent Search reached at least 80 percent of its monthly query limit.",
    details: { successfulQueries: searchSuccesses, monthlyLimit: searchLimit },
  });
  const searchBudget = agentSearchMonthlyBudgetUsd();
  const searchUnitCost = agentSearchEstimatedUnitCostUsd();
  if (searchBudget !== undefined && searchUnitCost !== undefined) {
    const searchSpend = searchSuccesses * searchUnitCost;
    add(searchSpend >= searchBudget, {
      kind: "search_budget_exhausted", severity: "critical",
      message: "Google Agent Search reached its configured monthly budget; new searches are stopped.",
      details: { estimatedSpendUsd: searchSpend, monthlyBudgetUsd: searchBudget },
    });
    add(searchSpend < searchBudget && searchSpend >= searchBudget * 0.8, {
      kind: "search_budget_near", severity: "warning",
      message: "Google Agent Search reached at least 80 percent of its configured monthly budget.",
      details: { estimatedSpendUsd: searchSpend, monthlyBudgetUsd: searchBudget },
    });
  }
  const storageWarning = briefingRawStorageWarningBytes();
  add(storageWarning !== undefined && Number(row.rawBytes) >= storageWarning, {
    kind: "raw_storage_near_limit", severity: "warning",
    message: "Briefing raw capture storage reached its configured warning threshold.",
    details: { rawBytes30d: Number(row.rawBytes), warningBytes: storageWarning },
  });
  const pool = databasePoolConfig();
  const totalConnections = Number(connections.rows[0]?.total ?? 0);
  add(totalConnections >= pool.max * 0.8, {
    kind: "database_connection_pressure", severity: "warning",
    message: "Briefing database connection usage reached at least 80 percent of the configured pool size.",
    details: { totalConnections, activeConnections: Number(connections.rows[0]?.active ?? 0), waitingConnections: Number(connections.rows[0]?.waiting ?? 0), poolMax: pool.max },
  });
  const publishExpected = briefingFeatures().autoPublish && !control.rows[0]?.paused;
  add(publishExpected && israelLocalHour(now) >= 10 && !row.publishedEdition, {
    kind: "edition_missing", severity: "critical", message: "No valid daily edition was published by 10:00 Israel time.", details: { localDate },
  });

  let created = 0;
  let refreshed = 0;
  let resolved = 0;
  await database.transaction(async (tx) => {
    await tx.execute(sql`SELECT pg_advisory_xact_lock(hashtext('briefing_alert'))`);
    const firing = candidates.map((candidate) => candidate.kind);

    /* Conditions that no longer hold: close every open row of that kind. An
       empty `firing` list means everything open is closed. */
    const closed = await tx.execute<{ id: string }>(sql`
      UPDATE briefing_alert
      SET resolved_at = now(), updated_at = now()
      WHERE resolved_at IS NULL
        AND kind <> ALL(${pgArray(firing)}::text[])
      RETURNING id
    `);
    resolved += closed.rows.length;

    for (const candidate of candidates) {
      /* One open row per kind. Older duplicates of a still-firing kind are the
         per-day rows the previous fingerprint produced; the newest stays open,
         carrying today's numbers. */
      const open = await tx.execute<{ id: string }>(sql`
        SELECT id FROM briefing_alert
        WHERE kind = ${candidate.kind} AND resolved_at IS NULL
        ORDER BY created_at DESC
        FOR UPDATE
      `);
      const [keep, ...duplicates] = open.rows;
      if (duplicates.length) {
        const closedDuplicates = await tx.execute<{ id: string }>(sql`
          UPDATE briefing_alert
          SET resolved_at = now(), updated_at = now()
          WHERE id = ANY(${pgArray(duplicates.map((row) => row.id))}::uuid[])
          RETURNING id
        `);
        resolved += closedDuplicates.rows.length;
      }
      if (keep) {
        await tx.execute(sql`
          UPDATE briefing_alert
          SET severity = ${candidate.severity},
              message = ${candidate.message},
              details = ${JSON.stringify(candidate.details)}::jsonb,
              updated_at = now()
          WHERE id = ${keep.id}
        `);
        refreshed += 1;
        continue;
      }
      /* The fingerprint stays unique per opening rather than per day so a
         condition that clears and returns inside one day opens again. */
      const fingerprint = `${candidate.kind}:${now.toISOString()}`;
      const inserted = await tx.execute<{ id: string }>(sql`
        INSERT INTO briefing_alert (fingerprint, kind, severity, message, details)
        VALUES (${fingerprint}, ${candidate.kind}, ${candidate.severity}, ${candidate.message}, ${JSON.stringify(candidate.details)}::jsonb)
        ON CONFLICT (fingerprint) DO NOTHING
        RETURNING id
      `);
      const id = inserted.rows[0]?.id;
      if (!id) continue;
      created += 1;
      await emit(tx as never, TOPICS.briefingAlert, { alertId: id });
    }
  });
  return { evaluated: candidates.length, created, refreshed, resolved };
}

export async function deliverBriefingAlert(alertId: string): Promise<void> {
  const database = db();
  const result = await database.execute<{ kind: string; severity: string; message: string; details: unknown; notifiedAt: string | null }>(sql`
    SELECT kind, severity, message, details, notified_at::text AS "notifiedAt"
    FROM briefing_alert WHERE id = ${alertId}
  `);
  const alert = result.rows[0];
  if (!alert || alert.notifiedAt) return;
  await sendWorkspaceEmail({
    to: adminEmail(),
    subject: `[Lions of Zion briefing] ${alert.severity}: ${alert.kind}`,
    text: `${alert.message}\n\n${JSON.stringify(alert.details ?? {})}`,
  });
  await database.execute(sql`UPDATE briefing_alert SET notified_at = now(), updated_at = now() WHERE id = ${alertId}`);
}
