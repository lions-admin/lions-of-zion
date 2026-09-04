"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import type { ConsoleOverview } from "@/server/contracts/admin-console";
import type { BriefingStatus, Status } from "./briefing-shapes";
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
  formatAgo,
  formatDate,
  formatUsd,
  stageLabel,
  today,
  useOperations,
} from "./console-primitives";
import { callConsole, useConsoleRead } from "./useConsoleRead";
import styles from "./admin.module.css";

/**
 * Overview — the one screen an operator reads first.
 *
 * It answers four questions in the order they are asked: is the system
 * active (and if not, why); when did it last run and when will it next; what
 * moved through it in the last day; and what is waiting for a person. The
 * two controls that decide whether anything reaches readers live here as the
 * primary controls: the publication switch and "Run processing now".
 *
 * `console/overview` is the summary; `briefing` and `status` still carry the
 * numbers this route does not, and the area degrades to those when the
 * summary is not served.
 */
export function OverviewPanel({ signal }: { signal: number }) {
  const overview = useConsoleRead<ConsoleOverview>("admin/console/overview", { signal });
  const briefing = useConsoleRead<BriefingStatus>("admin/briefing", { signal });
  const status = useConsoleRead<Status>("admin/status", { signal });
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  /**
   * STATE-004 — where focus lands when the control that opened a confirmation
   * is gone by the time it closes. The area itself is `tabIndex={-1}` and
   * named by its own heading, so landing there announces where the operator
   * is rather than an anonymous group.
   */
  const areaRef = useRef<HTMLElement | null>(null);

  const reloadAll = useCallback(() => {
    overview.reload();
    briefing.reload();
    status.reload();
  }, [overview, briefing, status]);
  const ops = useOperations();

  const paused = overview.value?.automaticPublicationPaused ?? briefing.value?.automaticPublicationPaused ?? null;

  return (
    <section className={styles.area} id="console-overview" aria-labelledby="console-overview-heading" ref={areaRef} tabIndex={-1}>
      <AreaHead id="console-overview" label="Overview" title="Is the system running, and what needs a person">
        <div className={styles.actionRow}>
          <Button variant="primary" type="button" disabled={ops.disabled || paused === null} onClick={runBriefing}>
            Run processing now
          </Button>
        </div>
      </AreaHead>
      <ConsoleNotices busy={ops.busy} notice={ops.notice} />

      {/* ── The verdict ──────────────────────────────────────────────── */}
      <ReadGate
        state={overview.state}
        what="the overview"
        reload={overview.reload}
        skeleton={
          <>
            <Skeleton shape="block" height="9rem" />
            <div className={styles.skeletonGrid}>
              {[0, 1, 2, 3].map((cell) => (
                <Skeleton key={cell} shape="block" height="5rem" />
              ))}
            </div>
          </>
        }
      >
        {(value) => (
          <>
            <div className={value.systemActive ? styles.verdict : `${styles.verdict} ${styles.verdictOff}`}>
              <p className={styles.verdictWord}>{value.systemActive ? "Active." : "Not active."}</p>
              <div className={styles.verdictBody}>
                {value.systemActive ? (
                  <p>Collection, processing and publication are all running on their own. Generated {formatDate(value.generatedAt)}.</p>
                ) : (
                  <ul className={styles.reasonList}>
                    {value.inactiveReasons.length ? value.inactiveReasons.map((reason) => <li key={reason}>{reason}</li>) : <li>No reason was recorded.</li>}
                  </ul>
                )}
                <dl className={styles.runFacts}>
                  <dt>Last run</dt>
                  <dd>
                    {value.lastRun.at ? (
                      <>
                        {formatAgo(value.lastRun.at)} · {value.lastRun.localDate ?? ""} {value.lastRun.stage ? stageLabel(value.lastRun.stage) : ""}{" "}
                        {value.lastRun.status ? <Pill tone={value.lastRun.status === "completed" ? "ok" : "warn"}>{value.lastRun.status}</Pill> : null}
                      </>
                    ) : (
                      "none recorded"
                    )}
                  </dd>
                  <dt>Next run</dt>
                  <dd>
                    {value.nextRun.at ? formatDate(value.nextRun.at) : "not scheduled"}
                    {value.nextRun.schedule ? <small>{value.nextRun.schedule}{value.nextRun.path ? ` · ${value.nextRun.path}` : ""}</small> : null}
                  </dd>
                </dl>
              </div>
            </div>

            <div className={styles.summary}>
              <Metric label="Collected in 24 h" value={String(value.counts24h.collected)} />
              <Metric label="Processed in 24 h" value={String(value.counts24h.processed)} />
              <Metric label="Drafted in 24 h" value={String(value.counts24h.drafted)} />
              <Metric label="Published in 24 h" value={String(value.counts24h.published)} />
            </div>

            <div className={styles.compactMetrics}>
              <Metric label="Failed jobs in 24 h" value={String(value.counts24h.failedJobs)} tone={value.counts24h.failedJobs ? "danger" : "ok"} />
              <Metric label="Critical alerts open" value={String(value.openAlerts.critical)} tone={value.openAlerts.critical ? "danger" : "ok"} />
              <Metric label="Warnings open" value={String(value.openAlerts.warning)} tone={value.openAlerts.warning ? "warn" : "ok"} />
              <Metric label="Stuck jobs" value={String(value.stuckJobs)} tone={value.stuckJobs ? "warn" : "ok"} />
              <Metric label="Quarantined" value={String(value.quarantined)} tone={value.quarantined ? "warn" : "ok"} />
            </div>
          </>
        )}
      </ReadGate>

      {/* ── Publication control ───────────────────────────────────────── */}
      <div className={styles.controlBar}>
        <div>
          <p className={styles.sectionLabel}>Publication control</p>
          <h3>
            {paused === null ? "Publication state unknown" : paused ? "Automatic publication is paused" : "Automatic publication is active"}
          </h3>
          <p className={styles.muted}>
            {paused === null
              ? "The switch reads from the briefing summary, which has not loaded."
              : paused
                ? "Approved editions wait for a person. Collection and processing continue, so nothing is lost while this is off."
                : "Approved editions publish to the public site on their own. Collection and processing run independently of this switch."}
          </p>
        </div>
        <div className={styles.actionRow}>
          <Button
            variant={paused ? "primary" : "secondary"}
            type="button"
            disabled={ops.disabled || paused === null}
            onClick={() => requestPublicationControl(!paused)}
          >
            {paused ? "Resume automatic publication" : "Pause automatic publication"}
          </Button>
          {paused === false ? (
            <Button variant="primary" type="button" disabled={ops.disabled} onClick={requestEditionPublication}>
              Publish today&apos;s approved edition
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── What the summary does not carry ───────────────────────────── */}
      <div className={styles.twoColumns}>
        <div className={styles.panel}>
          <PanelTitle>This deployment</PanelTitle>
          <InlineAbsence state={status.state} what="the deployment status" reload={status.reload} />
          {status.value ? (
            <div className={styles.compactMetrics}>
              <Metric label="Environment" value={status.value.environment} />
              <Metric label="Region" value={status.value.region} />
              <Metric label="Monthly briefing cap" value={formatUsd(status.value.aiBudgetUsd, 2)} />
              <Metric
                label="Public cache hits"
                value={
                  status.value.publicReadCache.hitRatio === null
                    ? "No data"
                    : `${(status.value.publicReadCache.hitRatio * 100).toFixed(1)}% · ${status.value.publicReadCache.averageLoadMs ?? 0} ms`
                }
              />
            </div>
          ) : null}
        </div>
        <div className={styles.panel}>
          <PanelTitle>Open alerts</PanelTitle>
          <InlineAbsence state={briefing.state} what="the briefing summary" reload={briefing.reload} />
          {briefing.value ? (
            briefing.value.alerts.length ? (
              <ul className={styles.logList}>
                {briefing.value.alerts.map((entry) => (
                  <li key={entry.id}>
                    <span>
                      <Pill tone={entry.severity === "critical" ? "danger" : "warn"}>{entry.severity}</Pill>
                    </span>
                    <strong>{entry.kind}</strong>
                    <small>
                      {entry.message} · {entry.notifiedAt ? "notification sent" : "notification pending"}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>No open alerts. The read succeeded and the list is genuinely empty.</EmptyLine>
            )
          ) : null}
        </div>
      </div>

      <ConfirmDialog intent={confirmIntent} onClose={() => setConfirmIntent(null)} fallbackFocusRef={areaRef} />
    </section>
  );

  /* ── Confirmed operations ───────────────────────────────────────────
     Everything that changes what the public sees states its consequence
     first. */

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
      targetDetail: today(),
      consequence: "Every approved article in today's edition becomes readable on public pages and available to search engines immediately. Taking one down again means archiving it, which readers may already have seen.",
      confirmLabel: "Publish the edition",
      tone: "primary",
      run: resumePausedEdition,
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

  async function runBriefing() {
    await ops.run("run", async () => {
      const result = await callConsole<{
        status: string;
        activeCollectionJobs?: number;
        recovery?: { dispatched: number; configurationRecovered?: number; processingResumed?: number };
      }>("admin/briefing/run", { method: "POST", body: {}, failure: "Unable to start processing now." });
      reloadAll();
      const recovered = result.recovery?.dispatched ?? 0;
      const repaired = result.recovery?.configurationRecovered ?? 0;
      const resumed = result.recovery?.processingResumed ?? 0;
      const recoveryMessage = recovered > 0
        ? `${repaired > 0 ? `${repaired} configuration-blocked jobs were repaired, and ` : ""}${resumed > 0 ? `${resumed} processing jobs waiting for release were resumed, and ` : ""}${recovered} waiting jobs were re-dispatched. `
        : "";
      return result.status === "queued"
        ? `${recoveryMessage}Processing was queued.`
        : result.status === "waiting_for_collection"
          ? `${recoveryMessage}Processing is waiting for ${result.activeCollectionJobs ?? 0} collection jobs.`
          : "Today's run has already completed.";
    });
  }

  async function resumePausedEdition() {
    await ops.run("resume-paused-edition", async () => {
      const result = await callConsole<{ status: string; publications: number; reason?: string }>("admin/briefing/run", {
        method: "POST",
        body: { resumePausedEdition: true },
        failure: "Unable to complete edition publication.",
      });
      reloadAll();
      return result.status === "completed"
        ? `Today's edition was published automatically with ${result.publications} publications.`
        : result.status === "already_run"
          ? "Today's edition is already published."
          : "There is no approved edition to complete today.";
    });
  }
}
