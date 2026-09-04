"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { PIPELINE_STAGES, type ConsolePipeline, type PipelineJob, type RetryJobResult } from "@/server/contracts/admin-console";
import type { BriefingStatus, DeepHealth } from "./briefing-shapes";
import { ConfirmDialog, type ConfirmIntent } from "./ConfirmDialog";
import {
  AreaHead,
  ConsoleNotices,
  EmptyLine,
  InlineAbsence,
  Metric,
  PanelTitle,
  Pill,
  ReadGate,
  formatDate,
  formatDuration,
  formatUsd,
  jobTone,
  stageLabel,
  today,
  useOperations,
} from "./console-primitives";
import { callConsole, readConsole, useConsoleRead } from "./useConsoleRead";
import styles from "./admin.module.css";

function JobTable({
  jobs,
  compact = false,
  disabled = false,
  onRetry,
}: {
  jobs: PipelineJob[];
  compact?: boolean;
  disabled?: boolean;
  onRetry?: (job: PipelineJob, resetAttempts: boolean) => void;
}) {
  return (
    <div className={styles.tableWrap}>
      <table className={compact ? `${styles.table} ${styles.tableCompact}` : styles.table}>
        <thead>
          <tr>
            <th scope="col">Job</th>
            <th scope="col">Stage</th>
            <th scope="col">State</th>
            <th scope="col">Attempts</th>
            {compact ? null : <th scope="col">Source</th>}
            <th scope="col">{compact ? "Finished" : "Started"}</th>
            {compact ? null : <th scope="col">Last error</th>}
            {onRetry ? <th scope="col">Recovery</th> : null}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <th scope="row">
                <strong>{job.jobKey}</strong>
                {compact ? null : <small className={styles.plainSmall}>{job.localDate}</small>}
              </th>
              <td>{stageLabel(job.stage)}</td>
              <td>
                <Pill tone={jobTone(job.state)}>{job.state}</Pill>
              </td>
              <td>
                {job.attempts} / {job.maxAttempts}
              </td>
              {compact ? null : <td>{job.sourceName ?? "—"}</td>}
              <td>{formatDate(compact ? job.finishedAt : job.startedAt)}</td>
              {compact ? null : <td className={styles.errorCell}>{job.lastError ?? "—"}</td>}
              {onRetry ? (
                <td>
                  <div className={styles.cellActions}>
                    <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onRetry(job, false)}>
                      Retry
                    </Button>
                    {job.attempts >= job.maxAttempts ? (
                      <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onRetry(job, true)}>
                        Reset attempts and retry
                      </Button>
                    ) : null}
                  </div>
                </td>
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Pipeline — the seven stages, what is waiting in each, and the operations
 * that move them.
 *
 * The stage strip is the one place the whole pipeline is visible at once:
 * seven columns under one rule, a column's rule turning to the warning or
 * danger colour when it holds stuck or quarantined work. Below it, the jobs
 * that need a person, then the record — recent jobs, editions, cost, and
 * quarantine. The pause switch is here as well as on the overview because it
 * is the pipeline's stop switch. The forced rerun is last, in its own zone.
 */
export function PipelinePanel({ signal }: { signal: number }) {
  const pipeline = useConsoleRead<ConsolePipeline>("admin/console/pipeline", { signal });
  const briefing = useConsoleRead<BriefingStatus>("admin/briefing", { signal });
  const [deepHealth, setDeepHealth] = useState<DeepHealth | null>(null);
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  /* STATE-004 — the focus fallback: the area itself, `tabIndex={-1}` and
     named by its heading, which survives every action here. */
  const areaRef = useRef<HTMLElement | null>(null);
  const ops = useOperations();

  const paused = briefing.value?.automaticPublicationPaused ?? null;

  function reloadAll() {
    pipeline.reload();
    briefing.reload();
  }

  return (
    <section className={styles.area} id="console-pipeline" aria-labelledby="console-pipeline-heading" ref={areaRef} tabIndex={-1}>
      <AreaHead id="console-pipeline" label="Pipeline" title="Seven stages, and what is waiting in each">
        <div className={styles.actionRow}>
          <Button variant="secondary" type="button" disabled={ops.disabled} onClick={runDeepHealth}>
            Deep health check
          </Button>
          <Button
            variant={paused ? "primary" : "secondary"}
            type="button"
            disabled={ops.disabled || paused === null}
            onClick={() => requestPublicationControl(!paused)}
          >
            {paused ? "Resume automatic publication" : "Pause automatic publication"}
          </Button>
        </div>
      </AreaHead>
      <ConsoleNotices busy={ops.busy} notice={ops.notice} />

      {deepHealth ? (
        <div className={styles.healthStrip} aria-label="Deep health check result">
          <span>
            <Pill tone={deepHealth.status === "ok" ? "ok" : "danger"}>overall {deepHealth.status}</Pill>
          </span>
          {Object.entries(deepHealth.checks).map(([name, check]) => (
            <span key={name}>
              {name} · <Pill tone={check.status === "ok" ? "ok" : "danger"}>{check.status}</Pill> · {check.latencyMs} ms
            </span>
          ))}
        </div>
      ) : null}

      {/* ── The stage strip ───────────────────────────────────────────── */}
      <ReadGate
        state={pipeline.state}
        what="the pipeline"
        reload={pipeline.reload}
        skeleton={
          <>
            <div className={styles.stageSkeleton}>
              {PIPELINE_STAGES.map((stage) => (
                <Skeleton key={stage} shape="block" height="7rem" />
              ))}
            </div>
            <Skeleton shape="block" height="10rem" />
          </>
        }
      >
        {(value) => (
          <>
            {value.processingPaused ? (
              <p className={styles.warnNote}>Processing is paused. Jobs accumulate as pending until it resumes.</p>
            ) : null}
            <div className={styles.stageWrap}>
              <ol className={styles.stageStrip} aria-label="Pipeline stages">
                {PIPELINE_STAGES.map((stage) => {
                  const cell = value.stages.find((entry) => entry.stage === stage);
                  const tone = !cell ? "" : cell.quarantined ? styles.stageDanger : cell.stuck ? styles.stageWarn : cell.running ? styles.stageLive : "";
                  return (
                    <li key={stage} className={`${styles.stage} ${tone}`}>
                      <h3>{stageLabel(stage)}</h3>
                      {cell ? (
                        <>
                          <p className={styles.stageCount}>
                            <strong>{cell.pending}</strong> <span>pending</span>
                          </p>
                          <p className={styles.stageRow}>
                            {cell.running ? <Pill tone="gold">{cell.running} running</Pill> : null}
                            {cell.stuck ? <Pill tone="warn">{cell.stuck} stuck</Pill> : null}
                            {cell.quarantined ? <Pill tone="danger">{cell.quarantined} quarantined</Pill> : null}
                            {!cell.running && !cell.stuck && !cell.quarantined ? <Pill tone="ok">clear</Pill> : null}
                          </p>
                          <dl className={styles.stageFacts}>
                            <dt>Done in 24 h</dt>
                            <dd>{cell.completed24h}</dd>
                            <dt>Average</dt>
                            <dd>{formatDuration(cell.averageDurationMs)}</dd>
                            <dt>Oldest pending</dt>
                            <dd>{cell.oldestPendingAt ? formatDate(cell.oldestPendingAt) : "—"}</dd>
                          </dl>
                          {cell.lastError ? <p className={styles.stageError}>{cell.lastError}</p> : null}
                        </>
                      ) : (
                        <p className={styles.muted}>Not reported.</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* ── Needs a person ────────────────────────────────────────── */}
            <div className={styles.panel}>
              <PanelTitle note={`${value.attention.length} waiting`}>Jobs that need a person</PanelTitle>
              <p className={styles.muted}>Stuck, quarantined, or failing on their last attempt. Retry re-queues the job; resetting attempts lets one that has exhausted them run again.</p>
              {value.attention.length ? (
                <JobTable jobs={value.attention} disabled={ops.disabled} onRetry={requestRetry} />
              ) : (
                <EmptyLine>Nothing is waiting for a person. The read succeeded and the list is genuinely empty.</EmptyLine>
              )}
            </div>

            <div className={styles.twoColumns}>
              <div className={styles.panel}>
                <PanelTitle>Recent jobs</PanelTitle>
                {value.recentJobs.length ? <JobTable jobs={value.recentJobs} compact /> : <EmptyLine>No jobs recorded yet.</EmptyLine>}
              </div>
              <div className={styles.panel}>
                <PanelTitle>Editions</PanelTitle>
                {value.editions.length ? (
                  <ul className={styles.logList}>
                    {value.editions.map((edition) => (
                      <li key={edition.id}>
                        <span>
                          <Pill tone={edition.status === "published" ? "ok" : edition.status === "failed" ? "danger" : "warn"}>{edition.status}</Pill>
                        </span>
                        <strong>{edition.localDate}</strong>
                        <small>
                          opened {formatDate(edition.collectionOpenedAt)}
                          {edition.collectionClosedAt ? ` · closed ${formatDate(edition.collectionClosedAt)}` : ""}
                          {edition.publishedAt ? ` · published ${formatDate(edition.publishedAt)}` : ""}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>No editions recorded yet.</EmptyLine>
                )}
              </div>
            </div>
          </>
        )}
      </ReadGate>

      {/* ── The record the briefing summary carries ───────────────────── */}
      <InlineAbsence state={briefing.state} what="the briefing summary" reload={briefing.reload} />
      {briefing.value ? (
        <>
          <div className={styles.compactMetrics}>
            <Metric label="Cost in 24 hours" value={formatUsd(briefing.value.spend.last24HoursUsd)} />
            <Metric label="Cost in 30 days" value={formatUsd(briefing.value.spend.last30DaysUsd)} />
            <Metric label="Failures this week" value={String(briefing.value.failedRuns)} tone={briefing.value.failedRuns ? "danger" : "ok"} />
            <Metric label="Open quarantine" value={String(briefing.value.quarantine.length)} tone={briefing.value.quarantine.length ? "warn" : "ok"} />
            <Metric label="Story clusters in 24 h" value={String(briefing.value.clustersLast24Hours)} />
            <Metric label="Pending evidence" value={String(briefing.value.unprocessedEvidence)} />
            <Metric label="Raw results in 24 h" value={String(briefing.value.pipelineCounts.rawResults)} />
            <Metric label="Unique results in 24 h" value={String(briefing.value.pipelineCounts.uniqueResults)} />
            <Metric label="Enriched evidence in 24 h" value={String(briefing.value.pipelineCounts.enrichedEvidence)} />
            <Metric label="Extracted claims in 24 h" value={String(briefing.value.pipelineCounts.extractedClaims)} />
            <Metric label="Raw volume (30 days)" value={`${(briefing.value.pipelineCounts.rawBytes30d / 1024 / 1024).toFixed(2)} MB`} />
            <Metric label="Latest run" value={briefing.value.latestRunAt ? formatDate(briefing.value.latestRunAt) : "None recorded"} />
          </div>
          <div className={styles.queueRow} aria-label="Job queue by state">
            {briefing.value.jobs.map((job) => (
              <span key={job.state}>
                <strong>{job.count}</strong> {job.state}
              </span>
            ))}
          </div>

          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <PanelTitle>Recent runs</PanelTitle>
              {briefing.value.runs.length ? (
                <ul className={styles.logList}>
                  {briefing.value.runs.map((run) => (
                    <li key={run.id}>
                      <span>
                        <Pill tone={run.status === "completed" ? "ok" : "warn"}>{run.status}</Pill>
                      </span>
                      <strong>
                        {run.localDate} · {stageLabel(run.stage)}
                      </strong>
                      <small>
                        {run.inputCount} in, {run.outputCount} out{run.error ? ` · ${run.error}` : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>No runs recorded yet.</EmptyLine>
              )}
            </div>
            <div className={styles.panel}>
              <PanelTitle>Quality quarantine</PanelTitle>
              {briefing.value.quarantine.length ? (
                <ul className={styles.logList}>
                  {briefing.value.quarantine.map((entry) => (
                    <li key={entry.id}>
                      <span>
                        <Pill tone="warn">{stageLabel(entry.stage)}</Pill>
                      </span>
                      <strong>{entry.candidateKey}</strong>
                      <small>{entry.reason}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>No items in quarantine.</EmptyLine>
              )}
            </div>
          </div>

          <div className={styles.panel}>
            <PanelTitle>Cost by model and stage</PanelTitle>
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.tableCompact}`}>
                <thead>
                  <tr>
                    <th scope="col">Model</th>
                    <th scope="col">Stage</th>
                    <th scope="col">Calls</th>
                    <th scope="col">Cost</th>
                  </tr>
                </thead>
                <tbody>
                  {briefing.value.spend.byModel.map((entry) => (
                    <tr key={`${entry.model}:${entry.stage}`}>
                      <td>{entry.model}</td>
                      <td>{stageLabel(entry.stage)}</td>
                      <td>{entry.calls}</td>
                      <td>{formatUsd(entry.costUsd)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </>
      ) : null}

      {/* ADMIN-002: the irreversible control is its own zone, last in reading
          order and last in tab order for this area. */}
      <div className={styles.dangerZone}>
        <p className={styles.dangerLabel}>Irreversible actions</p>
        <p className={styles.muted}>A forced rerun regenerates today&apos;s edition from the start and spends model budget again. It names its consequence before it runs.</p>
        <div className={styles.actionRow}>
          <Button variant="danger" type="button" disabled={ops.disabled} onClick={requestForcedRerun}>
            Force today&apos;s edition rerun
          </Button>
        </div>
      </div>

      <ConfirmDialog intent={confirmIntent} onClose={() => setConfirmIntent(null)} fallbackFocusRef={areaRef} />
    </section>
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

  function requestForcedRerun() {
    setConfirmIntent({
      action: "Force a full rerun of today's edition",
      target: "Today's briefing edition",
      targetDetail: today(),
      consequence: "Today's edition is regenerated from the start and model budget is spent again. New output that passes the quality gates publishes automatically and replaces what readers see now.",
      confirmLabel: "Force the rerun",
      tone: "danger",
      run: forceFullBriefingRerun,
    });
  }

  /* A plain retry re-queues the job and is asked for nothing. Resetting the
     attempt counter is the one that can loop a job that keeps failing, so
     that branch confirms. */
  function requestRetry(job: PipelineJob, resetAttempts: boolean) {
    if (!resetAttempts) {
      void retryJob(job, false);
      return;
    }
    setConfirmIntent({
      action: "Retry this job with its attempts reset",
      target: job.jobKey,
      targetDetail: `${stageLabel(job.stage)} · ${job.localDate} · ${job.attempts} of ${job.maxAttempts} attempts used`,
      consequence: "The attempt counter goes back to zero and the job runs again from its stage. A job that fails for the same reason will use its full attempt budget once more before it stops.",
      confirmLabel: "Reset and retry",
      tone: "danger",
      run: () => retryJob(job, true),
    });
  }

  async function retryJob(job: PipelineJob, resetAttempts: boolean) {
    await ops.run(`retry:${job.id}`, async () => {
      const result = await callConsole<RetryJobResult>(`admin/console/jobs/${job.id}/retry`, {
        method: "POST",
        body: { resetAttempts },
        failure: "Unable to retry the job.",
      });
      reloadAll();
      return result.dispatched
        ? `Job ${job.jobKey} was re-queued and dispatched (${result.previousState} → ${result.state}).`
        : `Job ${job.jobKey} was re-queued (${result.previousState} → ${result.state}); it runs on the next tick.`;
    });
  }

  async function mutateControl(nextPaused: boolean) {
    await ops.run("control", async () => {
      await callConsole("admin/briefing/control", {
        method: "PATCH",
        body: { automaticPublicationPaused: nextPaused },
        failure: "Unable to update publication control.",
      });
      reloadAll();
      return nextPaused ? "Automatic publication is paused." : "Automatic publication is active.";
    });
  }

  async function forceFullBriefingRerun() {
    await ops.run("force-rerun", async () => {
      const result = await callConsole<{ status: string }>("admin/briefing/run", {
        method: "POST",
        body: { forceFullRerun: true },
        failure: "Unable to start a forced rerun.",
      });
      reloadAll();
      return result.status === "queued" ? "The forced rerun was queued." : "The forced rerun was not queued.";
    });
  }

  async function runDeepHealth() {
    await ops.run("health", async () => {
      setDeepHealth(await readConsole<DeepHealth>("admin/health/deep"));
      return "The deep health check finished. Its result is shown above the stages.";
    });
  }
}
