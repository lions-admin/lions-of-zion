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
  today,
  useOperations,
} from "./console-primitives";
import { AREA_LABEL, EDITION_STATUS_LABEL, JOB_STATE_LABEL, STAGE_LABEL, T } from "./lexicon";
import { callConsole, readConsole, useConsoleRead } from "./useConsoleRead";
import styles from "./admin.module.css";

/* The lexicon holds the words; the `?? value` fallback keeps an unrecognised
   wire value readable rather than blank. `run.status` and `entry.stage` are
   open `string` on the briefing summary, not the closed enums the pipeline
   route serves, so neither lookup can be assumed to hit. */
const stageWord = (stage: string) => STAGE_LABEL[stage] ?? stage;
const stateWord = (state: string) => JOB_STATE_LABEL[state] ?? state;

/* A briefing edition runs through its own five states, which are neither job
   states nor publication statuses. They belong in `lexicon.ts` next to the
   other state maps; they are here because that file is owned elsewhere while
   this translation lands. */
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
            <th scope="col">{T.job}</th>
            <th scope="col">שלב</th>
            <th scope="col">מצב</th>
            <th scope="col">{T.attempts}</th>
            {compact ? null : <th scope="col">{T.source}</th>}
            <th scope="col">{compact ? "הסתיימה" : "התחילה"}</th>
            {compact ? null : <th scope="col">{T.lastError}</th>}
            {onRetry ? <th scope="col">שחזור</th> : null}
          </tr>
        </thead>
        <tbody>
          {jobs.map((job) => (
            <tr key={job.id}>
              <th scope="row">
                {/* The job key is the identifier the logs and the queue use. */}
                <strong>{job.jobKey}</strong>
                {compact ? null : <small className={styles.plainSmall}>{job.localDate}</small>}
              </th>
              <td>{stageWord(job.stage)}</td>
              <td>
                <Pill tone={jobTone(job.state)}>{stateWord(job.state)}</Pill>
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
                      {T.retry}
                    </Button>
                    {job.attempts >= job.maxAttempts ? (
                      <Button variant="secondary" size="sm" type="button" disabled={disabled} onClick={() => onRetry(job, true)}>
                        איפוס ניסיונות והרצה מחדש
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
 *
 * The strip's DOM order is collect → publish and stays that way: under the
 * console's `dir="rtl"` it reads right to left, which is the direction a
 * Hebrew reader follows a flow in.
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
      <AreaHead id="console-pipeline" label={AREA_LABEL.pipeline} title="שבעה שלבים, ומה ממתין בכל אחד מהם">
        <div className={styles.actionRow}>
          <Button variant="secondary" type="button" disabled={ops.disabled} onClick={runDeepHealth}>
            בדיקת תקינות מעמיקה
          </Button>
          <Button
            variant={paused ? "primary" : "secondary"}
            type="button"
            disabled={ops.disabled || paused === null}
            onClick={() => requestPublicationControl(!paused)}
          >
            {paused ? "חידוש הפרסום האוטומטי" : "השהיית הפרסום האוטומטי"}
          </Button>
        </div>
      </AreaHead>
      <ConsoleNotices busy={ops.busy} notice={ops.notice} />

      {deepHealth ? (
        /* The check names and their statuses are the health endpoint's own
           identifiers, and stay as it reports them. */
        <div className={styles.healthStrip} aria-label="תוצאת בדיקת התקינות המעמיקה">
          <span>
            <Pill tone={deepHealth.status === "ok" ? "ok" : "danger"}>מצב כולל {deepHealth.status}</Pill>
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
        what={AREA_LABEL.pipeline}
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
              <p className={styles.warnNote}>העיבוד מושהה. משימות נערמות במצב ממתין עד שהוא יחודש.</p>
            ) : null}
            <div className={styles.stageWrap}>
              <ol className={styles.stageStrip} aria-label="שלבי תהליך העיבוד">
                {PIPELINE_STAGES.map((stage) => {
                  const cell = value.stages.find((entry) => entry.stage === stage);
                  const tone = !cell ? "" : cell.quarantined ? styles.stageDanger : cell.stuck ? styles.stageWarn : cell.running ? styles.stageLive : "";
                  return (
                    <li key={stage} className={`${styles.stage} ${tone}`}>
                      <h3>{stageWord(stage)}</h3>
                      {cell ? (
                        <>
                          <p className={styles.stageCount}>
                            <strong>{cell.pending}</strong> <span>ממתינות</span>
                          </p>
                          <p className={styles.stageRow}>
                            {cell.running ? <Pill tone="gold">{cell.running} רצות</Pill> : null}
                            {cell.stuck ? <Pill tone="warn">{cell.stuck} תקועות</Pill> : null}
                            {cell.quarantined ? <Pill tone="danger">{cell.quarantined} {T.quarantined}</Pill> : null}
                            {!cell.running && !cell.stuck && !cell.quarantined ? <Pill tone="ok">{T.ok}</Pill> : null}
                          </p>
                          <dl className={styles.stageFacts}>
                            <dt>{`הושלמו ${T.last24h}`}</dt>
                            <dd>{cell.completed24h}</dd>
                            <dt>משך ממוצע</dt>
                            <dd>{formatDuration(cell.averageDurationMs)}</dd>
                            <dt>הממתינה הוותיקה ביותר</dt>
                            <dd>{cell.oldestPendingAt ? formatDate(cell.oldestPendingAt) : "—"}</dd>
                          </dl>
                          {cell.lastError ? <p className={styles.stageError}>{cell.lastError}</p> : null}
                        </>
                      ) : (
                        <p className={styles.muted}>לא דווח.</p>
                      )}
                    </li>
                  );
                })}
              </ol>
            </div>

            {/* ── Needs a person ────────────────────────────────────────── */}
            <div className={styles.panel}>
              <PanelTitle note={`${value.attention.length} ממתינות`}>משימות שדורשות אדם</PanelTitle>
              <p className={styles.muted}>תקועות, בבידוד, או נכשלות בניסיון האחרון שלהן. הרצה מחדש מחזירה את המשימה לתור; איפוס הניסיונות מאפשר למשימה שמיצתה אותם לרוץ שוב.</p>
              {value.attention.length ? (
                <JobTable jobs={value.attention} disabled={ops.disabled} onRetry={requestRetry} />
              ) : (
                <EmptyLine>שום דבר לא ממתין לאדם. הקריאה הצליחה והרשימה באמת ריקה.</EmptyLine>
              )}
            </div>

            <div className={styles.twoColumns}>
              <div className={styles.panel}>
                <PanelTitle>{`${T.jobs} אחרונות`}</PanelTitle>
                {value.recentJobs.length ? <JobTable jobs={value.recentJobs} compact /> : <EmptyLine>עדיין לא נרשמו משימות.</EmptyLine>}
              </div>
              <div className={styles.panel}>
                <PanelTitle>מהדורות</PanelTitle>
                {value.editions.length ? (
                  <ul className={styles.logList}>
                    {value.editions.map((edition) => (
                      <li key={edition.id}>
                        <span>
                          <Pill tone={edition.status === "published" ? "ok" : edition.status === "failed" ? "danger" : "warn"}>
                            {EDITION_STATUS_LABEL[edition.status] ?? edition.status}
                          </Pill>
                        </span>
                        <strong>{edition.localDate}</strong>
                        <small>
                          נפתחה {formatDate(edition.collectionOpenedAt)}
                          {edition.collectionClosedAt ? ` · נסגרה ${formatDate(edition.collectionClosedAt)}` : ""}
                          {edition.publishedAt ? ` · פורסמה ${formatDate(edition.publishedAt)}` : ""}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>עדיין לא נרשמו מהדורות.</EmptyLine>
                )}
              </div>
            </div>
          </>
        )}
      </ReadGate>

      {/* ── The record the briefing summary carries ───────────────────── */}
      <InlineAbsence state={briefing.state} what="סיכום הבריף" reload={briefing.reload} />
      {briefing.value ? (
        <>
          <div className={styles.compactMetrics}>
            <Metric label={`${T.cost} ${T.last24h}`} value={formatUsd(briefing.value.spend.last24HoursUsd)} />
            <Metric label={`${T.cost} ${T.last30d}`} value={formatUsd(briefing.value.spend.last30DaysUsd)} />
            <Metric label={`כשלים ${T.last7d}`} value={String(briefing.value.failedRuns)} tone={briefing.value.failedRuns ? "danger" : "ok"} />
            <Metric label="פריטים בבידוד" value={String(briefing.value.quarantine.length)} tone={briefing.value.quarantine.length ? "warn" : "ok"} />
            <Metric label={`אשכולות סיפורים ${T.last24h}`} value={String(briefing.value.clustersLast24Hours)} />
            <Metric label={`${T.evidence} ממתינות`} value={String(briefing.value.unprocessedEvidence)} />
            <Metric label={`תוצאות גולמיות ${T.last24h}`} value={String(briefing.value.pipelineCounts.rawResults)} />
            <Metric label={`תוצאות ייחודיות ${T.last24h}`} value={String(briefing.value.pipelineCounts.uniqueResults)} />
            <Metric label={`${T.evidence} מועשרות ${T.last24h}`} value={String(briefing.value.pipelineCounts.enrichedEvidence)} />
            <Metric label={`טענות שחולצו ${T.last24h}`} value={String(briefing.value.pipelineCounts.extractedClaims)} />
            <Metric label={`נפח גולמי ${T.last30d}`} value={`${(briefing.value.pipelineCounts.rawBytes30d / 1024 / 1024).toFixed(2)} MB`} />
            <Metric label="ריצה אחרונה" value={briefing.value.latestRunAt ? formatDate(briefing.value.latestRunAt) : "לא נרשמה"} />
          </div>
          <div className={styles.queueRow} aria-label="תור המשימות לפי מצב">
            {briefing.value.jobs.map((job) => (
              <span key={job.state}>
                <strong>{job.count}</strong> {stateWord(job.state)}
              </span>
            ))}
          </div>

          <div className={styles.twoColumns}>
            <div className={styles.panel}>
              <PanelTitle>{`${T.runs} אחרונות`}</PanelTitle>
              {briefing.value.runs.length ? (
                <ul className={styles.logList}>
                  {briefing.value.runs.map((run) => (
                    <li key={run.id}>
                      <span>
                        <Pill tone={run.status === "completed" ? "ok" : "warn"}>{stateWord(run.status)}</Pill>
                      </span>
                      <strong>
                        {run.localDate} · {stageWord(run.stage)}
                      </strong>
                      <small>
                        {run.inputCount} נכנסו, {run.outputCount} יצאו{run.error ? ` · ${run.error}` : ""}
                      </small>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>עדיין לא נרשמו ריצות.</EmptyLine>
              )}
            </div>
            <div className={styles.panel}>
              <PanelTitle>{`בידוד ${STAGE_LABEL.quality}`}</PanelTitle>
              {briefing.value.quarantine.length ? (
                <ul className={styles.logList}>
                  {briefing.value.quarantine.map((entry) => (
                    <li key={entry.id}>
                      <span>
                        <Pill tone="warn">{stageWord(entry.stage)}</Pill>
                      </span>
                      {/* The candidate key is the identifier the quarantine row is filed under. */}
                      <strong>{entry.candidateKey}</strong>
                      <small>{entry.reason}</small>
                    </li>
                  ))}
                </ul>
              ) : (
                <EmptyLine>אין פריטים בבידוד.</EmptyLine>
              )}
            </div>
          </div>

          <div className={styles.panel}>
            <PanelTitle>עלות לפי מודל ושלב</PanelTitle>
            <div className={styles.tableWrap}>
              <table className={`${styles.table} ${styles.tableCompact}`}>
                <thead>
                  <tr>
                    <th scope="col">מודל</th>
                    <th scope="col">שלב</th>
                    <th scope="col">קריאות</th>
                    <th scope="col">{T.cost}</th>
                  </tr>
                </thead>
                <tbody>
                  {briefing.value.spend.byModel.map((entry) => (
                    <tr key={`${entry.model}:${entry.stage}`}>
                      {/* The model slug is what the gateway bills against. */}
                      <td>{entry.model}</td>
                      <td>{stageWord(entry.stage)}</td>
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
        <p className={styles.dangerLabel}>פעולות בלתי הפיכות</p>
        <p className={styles.muted}>הרצה כפויה מייצרת מחדש את מהדורת היום מההתחלה ומוציאה שוב מתקציב המודל. היא מפרטת את ההשלכה שלה לפני שהיא רצה.</p>
        <div className={styles.actionRow}>
          <Button variant="danger" type="button" disabled={ops.disabled} onClick={requestForcedRerun}>
            כפיית הרצה מחדש של מהדורת היום
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
        action: "השהיית הפרסום האוטומטי",
        target: "הפרסום האוטומטי של הפריסה הזו",
        consequence: "מהדורות מאושרות יפסיקו להגיע לאתר הציבורי עד שהפרסום יחודש. האיסוף והעיבוד ממשיכים, ולכן שום דבר לא הולך לאיבוד — אבל גם שום דבר חדש לא מתפרסם.",
        confirmLabel: "השהיית הפרסום האוטומטי",
        tone: "danger",
        run: () => mutateControl(true),
      }
      : {
        action: "חידוש הפרסום האוטומטי",
        target: "הפרסום האוטומטי של הפריסה הזו",
        consequence: "מהדורות מאושרות יתפרסמו שוב לאתר הציבורי מעצמן, בלי אישור נוסף לפני כל אחת מהן.",
        confirmLabel: "חידוש הפרסום האוטומטי",
        tone: "primary",
        run: () => mutateControl(false),
      });
  }

  function requestForcedRerun() {
    setConfirmIntent({
      action: "כפיית הרצה מלאה מחדש של מהדורת היום",
      target: "מהדורת הבריף של היום",
      targetDetail: today(),
      consequence: "מהדורת היום נוצרת מחדש מההתחלה ותקציב המודל מוצא שוב. פלט חדש שעובר את בקרות האיכות מתפרסם אוטומטית ומחליף את מה שהקוראים רואים עכשיו.",
      confirmLabel: "כפיית ההרצה מחדש",
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
      action: "הרצת המשימה מחדש עם איפוס הניסיונות",
      target: job.jobKey,
      targetDetail: `${stageWord(job.stage)} · ${job.localDate} · ${job.attempts} מתוך ${job.maxAttempts} ניסיונות נוצלו`,
      consequence: "מונה הניסיונות חוזר לאפס והמשימה רצה שוב מהשלב שלה. משימה שנכשלת מאותה סיבה תנצל שוב את מלוא מכסת הניסיונות שלה לפני שתיעצר.",
      confirmLabel: "איפוס והרצה מחדש",
      tone: "danger",
      run: () => retryJob(job, true),
    });
  }

  async function retryJob(job: PipelineJob, resetAttempts: boolean) {
    await ops.run(`retry:${job.id}`, async () => {
      const result = await callConsole<RetryJobResult>(`admin/console/jobs/${job.id}/retry`, {
        method: "POST",
        body: { resetAttempts },
        failure: "לא ניתן להריץ את המשימה מחדש.",
      });
      reloadAll();
      return result.dispatched
        ? `המשימה ${job.jobKey} הוחזרה לתור ונשלחה (${result.previousState} → ${result.state}).`
        : `המשימה ${job.jobKey} הוחזרה לתור (${result.previousState} → ${result.state}); היא תרוץ בסבב הבא.`;
    });
  }

  async function mutateControl(nextPaused: boolean) {
    await ops.run("control", async () => {
      await callConsole("admin/briefing/control", {
        method: "PATCH",
        body: { automaticPublicationPaused: nextPaused },
        failure: "לא ניתן לעדכן את בקרת הפרסום.",
      });
      reloadAll();
      return nextPaused ? "הפרסום האוטומטי מושהה." : "הפרסום האוטומטי פעיל.";
    });
  }

  async function forceFullBriefingRerun() {
    await ops.run("force-rerun", async () => {
      const result = await callConsole<{ status: string }>("admin/briefing/run", {
        method: "POST",
        body: { forceFullRerun: true },
        failure: "לא ניתן להתחיל הרצה כפויה.",
      });
      reloadAll();
      return result.status === "queued" ? "ההרצה הכפויה נכנסה לתור." : "ההרצה הכפויה לא נכנסה לתור.";
    });
  }

  async function runDeepHealth() {
    await ops.run("health", async () => {
      setDeepHealth(await readConsole<DeepHealth>("admin/health/deep"));
      return "בדיקת התקינות המעמיקה הסתיימה. התוצאה שלה מוצגת מעל השלבים.";
    });
  }
}
