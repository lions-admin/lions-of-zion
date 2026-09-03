"use client";

import { useCallback, useEffect, useState } from "react";
import { createAuthClient } from "@neondatabase/auth/next";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/Button";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
import styles from "./admin.module.css";

type Status = { status: string; environment: string; region: string; aiBudgetUsd: number; integrations: Record<string, boolean>; resourceFingerprints?: Record<string, string | null>; publicReadCache: { hits: number; misses: number; hitRatio: number | null; loads: number; averageLoadMs: number | null } };
type UserCount = { registeredUsers: number };
type SourceHealth = {
  id: string; name: string; kind: string; active: boolean; consecutiveFailures: number;
  lastSuccessfulFetchAt: string | null; disabledReason: string | null; verificationError: string | null;
  attempts: number; successfulAttempts: number; itemsSeen: number; itemsNew: number;
};
type BriefingStatus = {
  latestRunAt: string | null; failedRuns: number; unprocessedEvidence: number;
  automaticPublicationPaused: boolean; clustersLast24Hours: number; sources: SourceHealth[];
  jobs: Array<{ state: string; count: number; oldestAt: string | null }>;
  quarantine: Array<{ id: string; candidateKey: string; stage: string; reason: string; createdAt: string }>;
  runs: Array<{ id: string; localDate: string; stage: string; status: string; inputCount: number; outputCount: number; error: string | null; startedAt: string }>;
  spend: { last24HoursUsd: number; last30DaysUsd: number; byModel: Array<{ model: string; stage: string; costUsd: number; calls: number }> };
  googleUsage: { attemptsThisMonth: number; successfulQueriesThisMonth: number; estimatedSpendUsd: number | null; monthlyBudgetUsd: number | null };
  pipelineCounts: { rawResults: number; uniqueResults: number; enrichedEvidence: number; extractedClaims: number; rawBytes30d: number };
  narrativeTrends: Array<{ id: string; title: string; status: string; observationCount: number; lastSeenAt: string | null }>;
  alerts: Array<{ id: string; kind: string; severity: string; message: string; createdAt: string; notifiedAt: string | null }>;
  migration: { available: boolean; applied: number; latestId: number | null; latestAppliedAt: string | null };
};
type DeepHealth = { status: string; checks: Record<string, { status: string; latencyMs: number }> };

const auth = createAuthClient();

export function AdminStatus() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [userCount, setUserCount] = useState<UserCount | null>(null);
  const [briefing, setBriefing] = useState<BriefingStatus | null>(null);
  const [deepHealth, setDeepHealth] = useState<DeepHealth | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const responses = await Promise.all([
      fetch("/api/v1/admin/status", { cache: "no-store" }),
      fetch("/api/v1/admin/user-count", { cache: "no-store" }),
      fetch("/api/v1/admin/briefing", { cache: "no-store" }),
    ]);
    if (responses.some((response) => !response.ok)) throw new Error("Unable to load system status.");
    const [nextStatus, nextCount, nextBriefing] = await Promise.all(responses.map((response) => response.json()));
    setStatus(nextStatus as Status); setUserCount(nextCount as UserCount); setBriefing(nextBriefing as BriefingStatus);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((cause: Error) => setError(cause.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (error && !status) return <p className={styles.error} {...assertiveLive}>{error}</p>;
  if (!status || !userCount || !briefing) return <p className={styles.muted}>Loading status…</p>;

  const totalAttempts = briefing.sources.reduce((sum, source) => sum + source.attempts, 0);
  const totalSuccess = briefing.sources.reduce((sum, source) => sum + source.successfulAttempts, 0);
  const controlsDisabled = busy !== null;
  const searchCost = briefing.googleUsage.estimatedSpendUsd === null
    ? "Not set"
    : `$${briefing.googleUsage.estimatedSpendUsd.toFixed(4)}${briefing.googleUsage.monthlyBudgetUsd === null ? "" : ` / $${briefing.googleUsage.monthlyBudgetUsd.toFixed(2)}`}`;
  const cacheHits = status.publicReadCache.hitRatio === null
    ? "No data"
    : `${(status.publicReadCache.hitRatio * 100).toFixed(1)}% · ${status.publicReadCache.averageLoadMs ?? 0}ms`;
  const migrationStatus = briefing.migration.available
    ? `Migrations applied: ${briefing.migration.applied} · latest version: ${briefing.migration.latestId ?? "unknown"}${briefing.migration.latestAppliedAt ? ` · ${formatDate(briefing.migration.latestAppliedAt)}` : ""}`
    : "Migration status is not available in this environment.";

  return (
    <>
      {error ? <p className={styles.error} {...assertiveLive}>{error}</p> : null}
      {message ? <p className={styles.notice} {...politeLive}>{message}</p> : null}

      <div className={styles.summary}>
        <Metric label="Environment" value={status.environment} />
        <Metric label="Queue region" value={status.region} />
        <Metric label="Monthly briefing cap" value={`$${status.aiBudgetUsd.toFixed(2)}`} />
        <Metric label="Registered users" value={String(userCount.registeredUsers)} />
        <Metric label="Collection attempts this week" value={String(totalAttempts)} />
        <Metric label="Successful collections this week" value={String(totalSuccess)} />
        <Metric label="Pending evidence" value={String(briefing.unprocessedEvidence)} />
        <Metric label="Story clusters in 24 hours" value={String(briefing.clustersLast24Hours)} />
        <Metric label="Search attempts this month" value={String(briefing.googleUsage.attemptsThisMonth)} />
        <Metric label="Successful searches this month" value={String(briefing.googleUsage.successfulQueriesThisMonth)} />
        <Metric label="Estimated search cost" value={searchCost} />
        <Metric label="Public cache hits" value={cacheHits} />
        <Metric label="Raw results in 24 hours" value={String(briefing.pipelineCounts.rawResults)} />
        <Metric label="Unique results in 24 hours" value={String(briefing.pipelineCounts.uniqueResults)} />
        <Metric label="Enriched evidence in 24 hours" value={String(briefing.pipelineCounts.enrichedEvidence)} />
        <Metric label="Extracted claims in 24 hours" value={String(briefing.pipelineCounts.extractedClaims)} />
        <Metric label="Raw volume (30 days)" value={`${(briefing.pipelineCounts.rawBytes30d / 1024 / 1024).toFixed(2)} MB`} />
      </div>

      <section className={styles.panel}>
        <p className={styles.sectionLabel}>Resource identity</p>
        <p className={styles.muted}>One-way fingerprints only, for comparing environments. Secrets and full identifiers are not shown.</p>
        <div className={styles.compactMetrics}>
          {Object.entries(status.resourceFingerprints ?? {}).map(([name, fingerprint]) => (
            <Metric key={name} label={name} value={fingerprint ?? "Not set"} />
          ))}
        </div>
      </section>

      <section className={styles.controlBar}>
        <div>
          <p className={styles.sectionLabel}>Publication control</p>
          <h2>{briefing.automaticPublicationPaused ? "Automatic publication is paused" : "Automatic publication is active"}</h2>
          <p className={styles.muted}>Collection and processing continue independently. This pause does not stop them.</p>
        </div>
        <div className={styles.actionRow}>
          <span className={styles.ok}>Google sign-in is active</span>
          <Button
            variant={briefing.automaticPublicationPaused ? "primary" : "secondary"}
            type="button"
            disabled={controlsDisabled}
            onClick={() => mutateControl(!briefing.automaticPublicationPaused)}
          >
            {briefing.automaticPublicationPaused ? "Resume automatic publication" : "Pause automatic publication"}
          </Button>
          {!briefing.automaticPublicationPaused ? (
            <Button variant="primary" type="button" disabled={controlsDisabled} onClick={resumePausedEdition}>
              Publish today&apos;s approved edition
            </Button>
          ) : null}
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.sectionLabel}>Database schema</p>
        <p className={styles.muted}>{migrationStatus}</p>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <p className={styles.sectionLabel}>Daily pipeline</p>
            <h2>Runs, queues, and costs</h2>
          </div>
          <div className={styles.actionRow}>
            <Button variant="secondary" type="button" disabled={controlsDisabled} onClick={runDeepHealth}>Deep health check</Button>
            <Button variant="secondary" type="button" disabled={controlsDisabled} onClick={syncRssCatalog}>Sync source URLs</Button>
            <Button variant="primary" type="button" disabled={controlsDisabled} onClick={runBriefing}>Run processing now</Button>
            <Button variant="danger" type="button" disabled={controlsDisabled} onClick={forceFullBriefingRerun}>Force today&apos;s edition rerun</Button>
          </div>
        </div>
        <div className={styles.compactMetrics}>
          <Metric label="Cost in 24 hours" value={`$${briefing.spend.last24HoursUsd.toFixed(4)}`} />
          <Metric label="Cost in 30 days" value={`$${briefing.spend.last30DaysUsd.toFixed(4)}`} />
          <Metric label="Failures this week" value={String(briefing.failedRuns)} />
          <Metric label="Open quarantine" value={String(briefing.quarantine.length)} />
        </div>
        {deepHealth ? <div className={styles.healthStrip}>{Object.entries(deepHealth.checks).map(([name, check]) => <span key={name} className={check.status === "ok" ? styles.ok : styles.wait}>{name} · {check.status} · {check.latencyMs}ms</span>)}</div> : null}
        <div className={styles.queueRow}>{briefing.jobs.map((job) => <span key={job.state}><strong>{job.count}</strong> {job.state}</span>)}</div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div>
            <p className={styles.sectionLabel}>Sources</p>
            <h2>Health and throughput, last seven days</h2>
          </div>
        </div>
        <div className={styles.tableWrap}><table className={styles.table}>
          <thead>
            <tr>
              <th>Source</th>
              <th>Kind</th>
              <th>Status</th>
              <th>Attempts</th>
              <th>Successes</th>
              <th>Seen</th>
              <th>New</th>
              <th>Last success</th>
              <th>Action</th>
            </tr>
          </thead>
          <tbody>{briefing.sources.map((source) => <tr key={source.id}>
            <td><strong>{source.name}</strong>{source.disabledReason || source.verificationError ? <small>{source.disabledReason ?? source.verificationError}</small> : null}</td>
            <td>{source.kind}</td>
            <td>
              <span className={source.active && source.consecutiveFailures === 0 ? styles.ok : styles.wait}>
                {source.active ? `${source.consecutiveFailures} failures` : "Disabled"}
              </span>
            </td>
            <td>{source.attempts}</td>
            <td>{source.successfulAttempts}</td>
            <td>{source.itemsSeen}</td>
            <td>{source.itemsNew}</td>
            <td>{source.lastSuccessfulFetchAt ? formatDate(source.lastSuccessfulFetchAt) : "—"}</td>
            <td>
              {["rss", "api", "agent_search"].includes(source.kind) && !source.active ? (
                <Button variant="secondary" type="button" disabled={controlsDisabled} onClick={() => verifySource(source)}>
                  Verify and enable
                </Button>
              ) : "—"}
            </td>
          </tr>)}</tbody>
        </table></div>
      </section>

      <section className={styles.twoColumns}>
        <div className={styles.panel}>
          <p className={styles.sectionLabel}>Recent runs</p>
          <ul className={styles.logList}>{briefing.runs.map((run) => <li key={run.id}><span className={run.status === "completed" ? styles.ok : styles.wait}>{run.status}</span><strong>{run.localDate} · {run.stage}</strong><small>{run.inputCount} ← {run.outputCount}{run.error ? ` · ${run.error}` : ""}</small></li>)}</ul>
        </div>
        <div className={styles.panel}>
          <p className={styles.sectionLabel}>Quality quarantine</p>
          {briefing.quarantine.length ? (
            <ul className={styles.logList}>{briefing.quarantine.map((entry) => <li key={entry.id}><span className={styles.wait}>{entry.stage}</span><strong>{entry.candidateKey}</strong><small>{entry.reason}</small></li>)}</ul>
          ) : <p className={styles.muted}>No items in quarantine.</p>}
        </div>
      </section>

      <section className={styles.twoColumns}>
        <div className={styles.panel}>
          <p className={styles.sectionLabel}>Narrative trends</p>
          {briefing.narrativeTrends.length ? (
            <ul className={styles.logList}>{briefing.narrativeTrends.map((entry) => <li key={entry.id}><span className={styles.wait}>{entry.status}</span><strong>{entry.title}</strong><small>{entry.observationCount} observations{entry.lastSeenAt ? ` · ${formatDate(entry.lastSeenAt)}` : ""}</small></li>)}</ul>
          ) : <p className={styles.muted}>No active trends.</p>}
        </div>
        <div className={styles.panel}>
          <p className={styles.sectionLabel}>Operational alerts</p>
          {briefing.alerts.length ? (
            <ul className={styles.logList}>{briefing.alerts.map((entry) => <li key={entry.id}><span className={entry.severity === "critical" ? styles.wait : styles.ok}>{entry.severity}</span><strong>{entry.kind}</strong><small>{entry.message} · {entry.notifiedAt ? "sent" : "pending"}</small></li>)}</ul>
          ) : <p className={styles.muted}>No open alerts.</p>}
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.sectionLabel}>Cost by model and stage</p>
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <thead><tr><th>Model</th><th>Stage</th><th>Calls</th><th>Cost</th></tr></thead>
            <tbody>{briefing.spend.byModel.map((entry) => <tr key={`${entry.model}:${entry.stage}`}><td>{entry.model}</td><td>{entry.stage}</td><td>{entry.calls}</td><td>${entry.costUsd.toFixed(4)}</td></tr>)}</tbody>
          </table>
        </div>
      </section>

      <div className={styles.grid}>{Object.entries(status.integrations).map(([name, active]) => <article className={styles.service} key={name}><span className={active ? styles.ok : styles.wait}>{active ? "Ready" : "Waiting"}</span><h2>{name}</h2></article>)}</div>
      <Button
        variant="secondary"
        type="button"
        onClick={async () => { await auth.signOut(); router.replace("/admin/login"); router.refresh(); }}
      >
        Sign out
      </Button>
    </>
  );

  async function mutateControl(paused: boolean) {
    setBusy("control"); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/briefing/control", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ automaticPublicationPaused: paused }) });
      if (!response.ok) throw new Error("Unable to update publication control.");
      await load(); setMessage(paused ? "Automatic publication is paused." : "Automatic publication is active.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The operation failed."); } finally { setBusy(null); }
  }
  async function runBriefing() {
    setBusy("run"); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/briefing/run", { method: "POST" });
      if (!response.ok) throw new Error("Unable to start processing now.");
      const result = await response.json() as { status: string; jobId?: string; activeCollectionJobs?: number; recovery?: { dispatched: number; configurationRecovered?: number; processingResumed?: number } };
      await load();
      const recovered = result.recovery?.dispatched ?? 0;
      const repaired = result.recovery?.configurationRecovered ?? 0;
      const resumed = result.recovery?.processingResumed ?? 0;
      const recoveryMessage = recovered > 0
        ? `${repaired > 0 ? `${repaired} configuration-blocked jobs were repaired, and ` : ""}${resumed > 0 ? `${resumed} processing jobs waiting for release were resumed, and ` : ""}${recovered} waiting jobs were re-dispatched. `
        : "";
      setMessage(
        result.status === "queued"
          ? `${recoveryMessage}Processing was queued.`
          : result.status === "waiting_for_collection"
            ? `${recoveryMessage}Processing is waiting for ${result.activeCollectionJobs ?? 0} collection jobs.`
            : "Today's run has already completed.",
      );
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The operation failed."); } finally { setBusy(null); }
  }
  async function forceFullBriefingRerun() {
    if (!window.confirm("Rerun today's edition? New output will pass the quality gates and publish automatically if approved.")) return;
    setBusy("force-rerun"); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/briefing/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ forceFullRerun: true }),
      });
      if (!response.ok) throw new Error("Unable to start a forced rerun.");
      const result = await response.json() as { status: string };
      await load();
      setMessage(result.status === "queued" ? "The forced rerun was queued." : "The forced rerun was not queued.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The operation failed."); } finally { setBusy(null); }
  }
  async function resumePausedEdition() {
    setBusy("resume-paused-edition"); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/briefing/run", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({ resumePausedEdition: true }),
      });
      const result = await response.json() as { status: string; publications: number; reason?: string };
      if (!response.ok) throw new Error("Unable to complete edition publication.");
      await load();
      setMessage(
        result.status === "completed"
          ? `Today's edition was published automatically with ${result.publications} publications.`
          : result.status === "already_run"
            ? "Today's edition is already published."
            : "There is no approved edition to complete today.",
      );
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The operation failed."); } finally { setBusy(null); }
  }
  async function runDeepHealth() {
    setBusy("health"); setError(null);
    try {
      const response = await fetch("/api/v1/admin/health/deep", { cache: "no-store" });
      if (!response.ok) throw new Error("The health check failed.");
      setDeepHealth(await response.json() as DeepHealth);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The operation failed."); } finally { setBusy(null); }
  }
  async function syncRssCatalog() {
    setBusy("sync-rss-catalog"); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/briefing/sources/sync", { method: "POST" });
      const result = await response.json() as { created?: number; updated?: number };
      if (!response.ok) throw new Error("Unable to update source URLs.");
      await load();
      const changed = (result.created ?? 0) + (result.updated ?? 0);
      setMessage(changed
        ? `Added ${result.created ?? 0} sources and updated ${result.updated ?? 0}; all remain disabled until a live check.`
        : "Source URLs are already up to date.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "The operation failed."); } finally { setBusy(null); }
  }
  async function verifySource(source: SourceHealth) {
    setBusy(`source:${source.id}`); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/v1/sources/${source.id}/fetch`, { method: "POST" });
      const result = await response.json() as { fetch?: { status?: string; itemsSeen?: number; errorMessage?: string | null }; evidenceCreated?: number; message?: string };
      if (!response.ok || result.fetch?.status !== "success" || !result.fetch.itemsSeen) {
        throw new Error(result.message || result.fetch?.errorMessage || "The source did not return a valid feed and remains disabled.");
      }
      await load();
      setMessage(`Source ${source.name} was verified and enabled with ${result.fetch.itemsSeen} items.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Source verification failed."); } finally { setBusy(null); }
  }
}

function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("en-GB", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
