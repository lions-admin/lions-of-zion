"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton, SkeletonRegion } from "@/components/ui/Skeleton";
import { StatusState, absenceStatus } from "@/components/ui/StatusState";
import { assertiveLive, politeLive } from "@/components/ui/live-region";
import { AuthRequired, refusedForAuth } from "./auth-required";
import { ConfirmDialog, type ConfirmIntent } from "./ConfirmDialog";
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

/**
 * ADMIN-002 — the console's three read-and-operate areas.
 *
 * The page used to be one undifferentiated column: a seventeen-cell metric
 * grid that mixed deployment identity, user counts, search spend and
 * pipeline throughput, then panels in the order they were written, with
 * "force a rerun of today's edition" sitting in the same row as a health
 * check. It is now three named areas, each holding the numbers, the panels
 * and the operations that belong to it:
 *
 * - **System status** — what this deployment is, what it is connected to,
 *   and the one switch that decides whether anything reaches readers.
 * - **Pipeline** — runs, queues, cost, and the operations that move them.
 * - **Sources** — collection health and throughput, and per-source recovery.
 *
 * Anything irreversible or publicly visible lives in a `dangerZone` at the
 * end of its area and opens the shared confirmation, never a bare button in
 * a row of routine ones.
 */
export function AdminStatus() {
  const [status, setStatus] = useState<Status | null>(null);
  const [userCount, setUserCount] = useState<UserCount | null>(null);
  const [briefing, setBriefing] = useState<BriefingStatus | null>(null);
  const [deepHealth, setDeepHealth] = useState<DeepHealth | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  /** The read was refused for want of a session, not because anything broke. */
  const [authRequired, setAuthRequired] = useState(false);
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  const controlBar = useRef<HTMLDivElement | null>(null);

  const load = useCallback(async () => {
    const responses = await Promise.all([
      fetch("/api/v1/admin/status", { cache: "no-store" }),
      fetch("/api/v1/admin/user-count", { cache: "no-store" }),
      fetch("/api/v1/admin/briefing", { cache: "no-store" }),
    ]);
    /* STATE-005. A signed-out or expired session answers 401/403 to all three
       of these, and reporting that as "Unable to load system status" tells an
       operator the console is broken when the console is fine and they are
       simply not signed in — two different problems with two different first
       moves. `authenticateAdmin()` fails closed on every route under
       `/api/v1/admin`, so this is the ordinary state after a session lapses,
       not an edge case. */
    if (refusedForAuth(responses)) throw new AuthRequired();
    if (responses.some((response) => !response.ok)) throw new Error("Unable to load system status.");
    const [nextStatus, nextCount, nextBriefing] = await Promise.all(responses.map((response) => response.json()));
    setStatus(nextStatus as Status); setUserCount(nextCount as UserCount); setBriefing(nextBriefing as BriefingStatus);
  }, []);

  const fail = useCallback((cause: Error) => {
    if (cause instanceof AuthRequired) { setAuthRequired(true); return; }
    setError(cause.message);
  }, []);

  const reload = useCallback(() => {
    setError(null);
    setAuthRequired(false);
    void load().catch(fail);
  }, [load, fail]);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch(fail); }, 0);
    return () => window.clearTimeout(timer);
  }, [load, fail]);

  if (authRequired && !(status && userCount && briefing)) {
    return (
      <StatusState
        status={absenceStatus("auth-required")}
        className={styles.consoleState}
        eyebrow="SESSION"
        title="Sign in to open the console"
        description="This session is not signed in, or it has expired. Nothing is wrong with the console — it refuses to answer an unauthenticated read, which is what it is supposed to do."
        actionText="Go to sign-in"
        actionHref="/admin/login"
      />
    );
  }

  if (error && !(status && userCount && briefing)) {
    return (
      <StatusState
        status={absenceStatus("unavailable")}
        className={styles.consoleState}
        title="The console could not be loaded"
        description={error}
        actionText="Try again"
        onAction={reload}
      />
    );
  }

  if (!status || !userCount || !briefing) {
    return (
      <SkeletonRegion label="Loading the operations console" className={styles.consoleState}>
        <Skeleton shape="block" height="5.5rem" />
        <div className={styles.skeletonGrid}>
          {[0, 1, 2, 3, 4, 5, 6, 7].map((cell) => <Skeleton key={cell} shape="block" height="4rem" />)}
        </div>
        <Skeleton shape="block" height="12rem" />
      </SkeletonRegion>
    );
  }

  const totalAttempts = briefing.sources.reduce((sum, source) => sum + source.attempts, 0);
  const totalSuccess = briefing.sources.reduce((sum, source) => sum + source.successfulAttempts, 0);
  const controlsDisabled = busy !== null;
  const paused = briefing.automaticPublicationPaused;
  const searchCost = briefing.googleUsage.estimatedSpendUsd === null
    ? "Not set"
    : `$${briefing.googleUsage.estimatedSpendUsd.toFixed(4)}${briefing.googleUsage.monthlyBudgetUsd === null ? "" : ` / $${briefing.googleUsage.monthlyBudgetUsd.toFixed(2)}`}`;
  const cacheHits = status.publicReadCache.hitRatio === null
    ? "No data"
    : `${(status.publicReadCache.hitRatio * 100).toFixed(1)}% · ${status.publicReadCache.averageLoadMs ?? 0}ms`;
  const migrationStatus = briefing.migration.available
    ? `${briefing.migration.applied} migrations applied · latest version ${briefing.migration.latestId ?? "unknown"}${briefing.migration.latestAppliedAt ? ` · ${formatDate(briefing.migration.latestAppliedAt)}` : ""}`
    : "Migration status is not available in this environment.";

  return (
    <>
      {error ? <p className={styles.error} {...assertiveLive}>{error}</p> : null}
      {message ? <p className={styles.notice} {...politeLive}>{message}</p> : null}
      {/* Mounted at all times so the polite region exists before it speaks. */}
      <p className={styles.consolePending} {...politeLive}>
        {busy ? "Running an operation. Controls stay disabled until it finishes." : ""}
      </p>

      {/* ── System status ────────────────────────────────────────────── */}
      <section className={styles.section} id="console-status" aria-labelledby="console-status-heading">
        <div className={styles.panelHead}>
          <div>
            <p className={styles.sectionLabel}>System status</p>
            <h2 id="console-status-heading">This deployment and what it is connected to</h2>
          </div>
          <p className={styles.headNote}>{status.environment} · {status.region}</p>
        </div>

        <div className={styles.controlBar} ref={controlBar}>
          <div>
            <p className={styles.sectionLabel}>Publication control</p>
            <h3>{paused ? "Automatic publication is paused" : "Automatic publication is active"}</h3>
            <p className={styles.muted}>
              {paused
                ? "Approved editions wait for a person. Collection and processing continue, so nothing is lost while this is off."
                : "Approved editions publish to the public site on their own. Collection and processing run independently of this switch."}
            </p>
          </div>
          <div className={styles.actionRow}>
            <Button
              variant={paused ? "primary" : "secondary"}
              type="button"
              disabled={controlsDisabled}
              onClick={() => requestPublicationControl(!paused)}
            >
              {paused ? "Resume automatic publication" : "Pause automatic publication"}
            </Button>
            {!paused ? (
              <Button variant="primary" type="button" disabled={controlsDisabled} onClick={requestEditionPublication}>
                Publish today&apos;s approved edition
              </Button>
            ) : null}
          </div>
        </div>

        <div className={styles.summary}>
          <Metric label="Environment" value={status.environment} />
          <Metric label="Queue region" value={status.region} />
          <Metric label="Monthly briefing cap" value={`$${status.aiBudgetUsd.toFixed(2)}`} />
          <Metric label="Registered users" value={String(userCount.registeredUsers)} />
          <Metric label="Public cache hits" value={cacheHits} />
          <Metric label="Sign-in" value="Google identity active" />
        </div>

        <div className={styles.grid}>
          {Object.entries(status.integrations).map(([name, active]) => (
            <article className={styles.service} key={name}>
              <span className={active ? styles.ok : styles.wait}>{active ? "Ready" : "Waiting"}</span>
              <h3>{name}</h3>
            </article>
          ))}
        </div>

        <div className={styles.twoColumns}>
          <div className={styles.panel}>
            <p className={styles.sectionLabel}>Resource identity</p>
            <p className={styles.muted}>One-way fingerprints only, for comparing environments. Secrets and full identifiers are never shown here.</p>
            <div className={styles.compactMetrics}>
              {Object.entries(status.resourceFingerprints ?? {}).map(([name, fingerprint]) => (
                <Metric key={name} label={name} value={fingerprint ?? "Not set"} />
              ))}
            </div>
          </div>
          <div className={styles.panel}>
            <p className={styles.sectionLabel}>Database schema</p>
            <p className={styles.muted}>{migrationStatus}</p>
            <p className={styles.sectionLabel}>Operational alerts</p>
            {briefing.alerts.length ? (
              <ul className={styles.logList}>{briefing.alerts.map((entry) => <li key={entry.id}><span className={entry.severity === "critical" ? styles.wait : styles.ok}>{entry.severity}</span><strong>{entry.kind}</strong><small>{entry.message} · {entry.notifiedAt ? "notification sent" : "notification pending"}</small></li>)}</ul>
            ) : <p className={styles.muted}>No open alerts.</p>}
          </div>
        </div>
      </section>

      {/* ── Pipeline ─────────────────────────────────────────────────── */}
      <section className={styles.section} id="console-pipeline" aria-labelledby="console-pipeline-heading">
        <div className={styles.panelHead}>
          <div>
            <p className={styles.sectionLabel}>Daily pipeline</p>
            <h2 id="console-pipeline-heading">Runs, queues, and cost</h2>
          </div>
          <div className={styles.actionRow}>
            <Button variant="secondary" type="button" disabled={controlsDisabled} onClick={runDeepHealth}>Deep health check</Button>
            <Button variant="primary" type="button" disabled={controlsDisabled} onClick={runBriefing}>Run processing now</Button>
          </div>
        </div>

        <div className={styles.compactMetrics}>
          <Metric label="Cost in 24 hours" value={`$${briefing.spend.last24HoursUsd.toFixed(4)}`} />
          <Metric label="Cost in 30 days" value={`$${briefing.spend.last30DaysUsd.toFixed(4)}`} />
          <Metric label="Failures this week" value={String(briefing.failedRuns)} />
          <Metric label="Open quarantine" value={String(briefing.quarantine.length)} />
          <Metric label="Story clusters in 24 hours" value={String(briefing.clustersLast24Hours)} />
          <Metric label="Pending evidence" value={String(briefing.unprocessedEvidence)} />
          <Metric label="Raw results in 24 hours" value={String(briefing.pipelineCounts.rawResults)} />
          <Metric label="Unique results in 24 hours" value={String(briefing.pipelineCounts.uniqueResults)} />
          <Metric label="Enriched evidence in 24 hours" value={String(briefing.pipelineCounts.enrichedEvidence)} />
          <Metric label="Extracted claims in 24 hours" value={String(briefing.pipelineCounts.extractedClaims)} />
          <Metric label="Raw volume (30 days)" value={`${(briefing.pipelineCounts.rawBytes30d / 1024 / 1024).toFixed(2)} MB`} />
          <Metric label="Latest run" value={briefing.latestRunAt ? formatDate(briefing.latestRunAt) : "None recorded"} />
        </div>

        {deepHealth ? (
          <div className={styles.healthStrip}>
            {Object.entries(deepHealth.checks).map(([name, check]) => (
              <span key={name} className={check.status === "ok" ? styles.ok : styles.wait}>{name} · {check.status} · {check.latencyMs}ms</span>
            ))}
          </div>
        ) : null}
        <div className={styles.queueRow}>{briefing.jobs.map((job) => <span key={job.state}><strong>{job.count}</strong> {job.state}</span>)}</div>

        <div className={styles.twoColumns}>
          <div className={styles.panel}>
            <p className={styles.sectionLabel}>Recent runs</p>
            {briefing.runs.length ? (
              <ul className={styles.logList}>{briefing.runs.map((run) => <li key={run.id}><span className={run.status === "completed" ? styles.ok : styles.wait}>{run.status}</span><strong>{run.localDate} · {run.stage}</strong><small>{run.inputCount} in, {run.outputCount} out{run.error ? ` · ${run.error}` : ""}</small></li>)}</ul>
            ) : <p className={styles.muted}>No runs recorded yet.</p>}
          </div>
          <div className={styles.panel}>
            <p className={styles.sectionLabel}>Quality quarantine</p>
            {briefing.quarantine.length ? (
              <ul className={styles.logList}>{briefing.quarantine.map((entry) => <li key={entry.id}><span className={styles.wait}>{entry.stage}</span><strong>{entry.candidateKey}</strong><small>{entry.reason}</small></li>)}</ul>
            ) : <p className={styles.muted}>No items in quarantine.</p>}
          </div>
        </div>

        <div className={styles.twoColumns}>
          <div className={styles.panel}>
            <p className={styles.sectionLabel}>Narrative trends</p>
            {briefing.narrativeTrends.length ? (
              <ul className={styles.logList}>{briefing.narrativeTrends.map((entry) => <li key={entry.id}><span className={styles.wait}>{entry.status}</span><strong>{entry.title}</strong><small>{entry.observationCount} observations{entry.lastSeenAt ? ` · ${formatDate(entry.lastSeenAt)}` : ""}</small></li>)}</ul>
            ) : <p className={styles.muted}>No active trends.</p>}
          </div>
          <div className={styles.panel}>
            <p className={styles.sectionLabel}>Cost by model and stage</p>
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.tableCompact}`}>
                <thead><tr><th>Model</th><th>Stage</th><th>Calls</th><th>Cost</th></tr></thead>
                <tbody>{briefing.spend.byModel.map((entry) => <tr key={`${entry.model}:${entry.stage}`}><td>{entry.model}</td><td>{entry.stage}</td><td>{entry.calls}</td><td>${entry.costUsd.toFixed(4)}</td></tr>)}</tbody>
              </table>
            </div>
          </div>
        </div>

        <div className={styles.dangerZone}>
          <p className={styles.dangerLabel}>Irreversible actions</p>
          <p className={styles.muted}>A forced rerun regenerates today&apos;s edition from the start and spends model budget again. It names its consequence before it runs.</p>
          <div className={styles.actionRow}>
            <Button variant="danger" type="button" disabled={controlsDisabled} onClick={requestForcedRerun}>
              Force today&apos;s edition rerun
            </Button>
          </div>
        </div>
      </section>

      {/* ── Sources ──────────────────────────────────────────────────── */}
      <section className={styles.section} id="console-sources" aria-labelledby="console-sources-heading">
        <div className={styles.panelHead}>
          <div>
            <p className={styles.sectionLabel}>Sources</p>
            <h2 id="console-sources-heading">Collection health and throughput</h2>
          </div>
          <div className={styles.actionRow}>
            <Button variant="secondary" type="button" disabled={controlsDisabled} onClick={syncRssCatalog}>Sync source URLs</Button>
          </div>
        </div>

        <div className={styles.compactMetrics}>
          <Metric label="Collection attempts this week" value={String(totalAttempts)} />
          <Metric label="Successful collections this week" value={String(totalSuccess)} />
          <Metric label="Search attempts this month" value={String(briefing.googleUsage.attemptsThisMonth)} />
          <Metric label="Successful searches this month" value={String(briefing.googleUsage.successfulQueriesThisMonth)} />
          <Metric label="Estimated search cost" value={searchCost} />
          <Metric label="Sources configured" value={String(briefing.sources.length)} />
        </div>

        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption className={styles.tableCaption}>Health and throughput over the last seven days. A disabled source stays disabled until a live check returns a valid feed.</caption>
            <thead>
              <tr>
                <th scope="col">Source</th>
                <th scope="col">Kind</th>
                <th scope="col">Status</th>
                <th scope="col">Attempts</th>
                <th scope="col">Successes</th>
                <th scope="col">Seen</th>
                <th scope="col">New</th>
                <th scope="col">Last success</th>
                <th scope="col">Recovery</th>
              </tr>
            </thead>
            <tbody>{briefing.sources.map((source) => <tr key={source.id}>
              <th scope="row"><strong>{source.name}</strong>{source.disabledReason || source.verificationError ? <small>{source.disabledReason ?? source.verificationError}</small> : null}</th>
              <td>{source.kind}</td>
              <td>
                <span className={source.active && source.consecutiveFailures === 0 ? styles.ok : styles.wait}>
                  {source.active ? `Active · ${source.consecutiveFailures} failures` : "Disabled"}
                </span>
              </td>
              <td>{source.attempts}</td>
              <td>{source.successfulAttempts}</td>
              <td>{source.itemsSeen}</td>
              <td>{source.itemsNew}</td>
              <td>{source.lastSuccessfulFetchAt ? formatDate(source.lastSuccessfulFetchAt) : "—"}</td>
              <td>
                {["rss", "api", "agent_search"].includes(source.kind) && !source.active ? (
                  <Button variant="secondary" size="sm" type="button" disabled={controlsDisabled} onClick={() => verifySource(source)}>
                    Verify and enable
                  </Button>
                ) : "—"}
              </td>
            </tr>)}</tbody>
          </table>
        </div>
      </section>

      <ConfirmDialog
        intent={confirmIntent}
        onClose={() => setConfirmIntent(null)}
        fallbackFocusRef={controlBar}
      />
    </>
  );

  /* ── Confirmed operations ───────────────────────────────────────────
     Everything that changes what the public sees, or spends the budget
     again, states its consequence first. */

  function requestPublicationControl(nextPaused: boolean) {
    setConfirmIntent(nextPaused
      ? {
        action: "Pause automatic publication",
        target: "Automatic publication for this deployment",
        consequence: "Approved editions stop reaching the public site until this is resumed. Collection and processing continue, so nothing is lost — but nothing new is published either.",
        confirmLabel: "Pause automatic publication",
        tone: "danger",
        run: () => mutateControl(true),
      }
      : {
        action: "Resume automatic publication",
        target: "Automatic publication for this deployment",
        consequence: "Approved editions publish themselves to the public site again, with no further prompt before each one.",
        confirmLabel: "Resume automatic publication",
        tone: "primary",
        run: () => mutateControl(false),
      });
  }

  function requestEditionPublication() {
    setConfirmIntent({
      action: "Publish today's approved edition now",
      target: "Today's edition",
      targetDetail: new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(new Date()),
      consequence: "Every approved article in today's edition becomes readable on public pages and available to search engines immediately. Taking one down again means archiving it, which readers may already have seen.",
      confirmLabel: "Publish the edition",
      tone: "primary",
      run: resumePausedEdition,
    });
  }

  function requestForcedRerun() {
    setConfirmIntent({
      action: "Force a full rerun of today's edition",
      target: "Today's briefing edition",
      targetDetail: new Intl.DateTimeFormat("en-GB", { dateStyle: "full" }).format(new Date()),
      consequence: "Today's edition is regenerated from the start and model budget is spent again. New output that passes the quality gates publishes automatically and replaces what readers see now.",
      confirmLabel: "Force the rerun",
      tone: "danger",
      run: forceFullBriefingRerun,
    });
  }

  async function mutateControl(nextPaused: boolean) {
    setBusy("control"); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/briefing/control", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ automaticPublicationPaused: nextPaused }) });
      if (!response.ok) throw new Error("Unable to update publication control.");
      await load(); setMessage(nextPaused ? "Automatic publication is paused." : "Automatic publication is active.");
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
