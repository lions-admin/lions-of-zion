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
        /* Inactive sources are candidates, not incidents. A source may remain
         * intentionally disabled until a human verifies it; alert only for a
         * real repeated fetch failure, whether that source has since been
         * automatically disabled or is still active. */
        (SELECT count(*) FROM source WHERE consecutive_failures >= 3) AS "staleSources",
        (SELECT extract(epoch FROM (now() - min(created_at))) / 60 FROM briefing_job WHERE state = 'pending') AS "oldestPendingMinutes",
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
  await database.transaction(async (tx) => {
    for (const candidate of candidates) {
      const fingerprint = `${candidate.kind}:${localDate}`;
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
  return { evaluated: candidates.length, created };
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
