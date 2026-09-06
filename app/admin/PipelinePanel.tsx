"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  PIPELINE_STAGES,
  type ConsoleEditionDrilldown,
  type ConsolePipeline,
  type ConsoleQualityChecks,
  type PipelineJob,
  type QualityCheckCandidate,
} from "@/server/contracts/admin-console";
import type { BriefingStatus, DeepHealth, DraftPreview } from "./briefing-shapes";
import { israelLocalDate } from "./briefing-shapes";
import { PipelineFlow } from "./_command/PipelineFlow";
import cmd from "./command.module.css";
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
  useOperations,
  type PillTone,
} from "./console-primitives";
import {
  ABSENCE,
  AREA_LABEL,
  ASSESSMENT_LABEL,
  CLAIM_LAYER_LABEL,
  EDITION_STATUS_LABEL,
  JOB_STATE_LABEL,
  RUN_STATUS_LABEL,
  SECTION_LABEL,
  STAGE_LABEL,
  T,
} from "./lexicon";
import { readConsole, useConsoleRead } from "./useConsoleRead";
import styles from "./admin.module.css";

/* The lexicon holds the words; the `?? value` fallback keeps an unrecognised
   wire value readable rather than blank. `run.status` and `entry.stage` are
   open `string` on the briefing summary, not the closed enums the pipeline
   route serves, so neither lookup can be assumed to hit. */
const stageWord = (stage: string) => STAGE_LABEL[stage] ?? stage;
const stateWord = (state: string) => JOB_STATE_LABEL[state] ?? state;

/* A candidate's checks, in the order the briefing quality module runs them —
   the payload's `required` list — with a recorded name the list does not know
   (a row from an older contract) following, by name. */
function orderedChecks(candidate: QualityCheckCandidate, required: readonly string[]) {
  return [
    ...required.flatMap((name) => {
      const check = candidate.checks.find((entry) => entry.checkName === name);
      return check ? [check] : [];
    }),
    ...candidate.checks.filter((entry) => !required.includes(entry.checkName)),
  ];
}

/** The draft body is English markdown — the `##` sections the daily body
 *  builder writes, then blank-line-separated passages. Rendered read-only:
 *  the console displays the persisted artifact, it does not re-edit it. */
function DraftBody({ body }: { body: string }) {
  const sections = body.split(/^## /m).map((part) => part.trim()).filter(Boolean);
  return (
    <>
      {sections.map((section, index) => {
        const lines = section.split("\n");
        /* A `##` section carries its own label line; a `##`-less body carries
           none, so the whole section is prose. */
        const label = sections.length > 1 ? lines[0] ?? "" : null;
        const paragraphs = (sections.length > 1 ? lines.slice(1) : lines).join("\n").split(/\n{2,}/).map((text) => text.trim()).filter(Boolean);
        return (
          <div key={index}>
            {label ? <p className={styles.headNote}>{label}</p> : null}
            {paragraphs.length ? paragraphs.map((text, i) => <p key={i}>{text}</p>) : <p className={styles.muted}>—</p>}
          </div>
        );
      })}
    </>
  );
}

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
  function retryActions(job: PipelineJob) {
    if (!onRetry) return null;
    return (
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
    );
  }

  return (
    <>
      <div className={`${styles.tableWrap} ${cmd.desktopOnly}`}>
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
                {onRetry ? <td>{retryActions(job)}</td> : null}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {/* Narrow screens get cards: the job key names the card, the columns
          become facts, and the same retry actions ride along. */}
      <div className={cmd.sourceCards} aria-label={compact ? `${T.jobs} אחרונות` : "משימות שדורשות אדם"}>
        {jobs.map((job) => (
          <article key={job.id} className={cmd.sourceCard} aria-label={job.jobKey}>
            <div className={cmd.sourceCardHead}>
              <h3 className={cmd.sourceCardName}>
                <bdi>{job.jobKey}</bdi>
              </h3>
              <Pill tone={jobTone(job.state)}>{stateWord(job.state)}</Pill>
            </div>
            <p className={cmd.sourceCardMeta}>
              {stageWord(job.stage)} · {T.attempts} <bdi>{job.attempts} / {job.maxAttempts}</bdi>
              {compact ? "" : <> · <bdi>{job.localDate}</bdi></>}
            </p>
            {compact ? null : (
              <p className={cmd.sourceCardMeta}>
                {T.source} {job.sourceName ?? "—"} · התחילה {formatDate(job.startedAt)}
              </p>
            )}
            {compact ? (
              <p className={cmd.sourceCardMeta}>הסתיימה {formatDate(job.finishedAt)}</p>
            ) : job.lastError ? (
              <p className={cmd.sourceCardError}>{job.lastError}</p>
            ) : null}
            {onRetry ? <div className={cmd.sourceCardActions}>{retryActions(job)}</div> : null}
          </article>
        ))}
      </div>
    </>
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
const PIPELINE_POLL_MS = 30_000;

export function PipelinePanel({ signal }: { signal: number }) {
  const pipeline = useConsoleRead<ConsolePipeline>("admin/console/pipeline", { signal, pollInterval: PIPELINE_POLL_MS });
  const briefing = useConsoleRead<BriefingStatus>("admin/briefing", { signal, pollInterval: PIPELINE_POLL_MS });
  /* The quality matrix is opened per edition, so its filter is an
     Israel-local date and the read is held (`enabled: false`) until an
     operator asks for one. A 404 falls to its own unavailable state. */
  const [qualityDate, setQualityDate] = useState<string | null>(null);
  const quality = useConsoleRead<ConsoleQualityChecks>(
    qualityDate ? `admin/console/quality-checks?localDate=${encodeURIComponent(qualityDate)}` : "",
    { signal, enabled: qualityDate !== null },
  );
  /* The edition drilldown is opened per edition row, so its read is held the
     same way — `enabled: localDate !== null` inside the drawer component —
     and a 404 falls to its own unavailable state inside the drawer. */
  const [drillDate, setDrillDate] = useState<string | null>(null);
  /* R9 — the draft preview: the persisted draft artifact for one
     Israel-local date. Held read — `enabled: draftOpen` — so opening the
     console adds no route to the pipeline's 30s poll budget, and the date
     defaults to the way the server computes "today" (mirrored in
     `briefing-shapes.ts`; the server module itself is out of reach under the
     layering boundary). A 404 here names two causes — no edition for the
     chosen date, or a route the deployment does not serve — and both fall
     to the same unavailable state, so the region says so under it. */
  const [draftOpen, setDraftOpen] = useState(false);
  const [draftDate, setDraftDate] = useState<string>(() => israelLocalDate());
  const draft = useConsoleRead<DraftPreview>(
    draftOpen ? `admin/briefing/draft?date=${encodeURIComponent(draftDate)}` : "",
    { signal, enabled: draftOpen },
  );
  const [deepHealth, setDeepHealth] = useState<DeepHealth | null>(null);
  /* STATE-004 — the focus fallback: the area itself, `tabIndex={-1}` and
     named by its heading, which survives every action here. */
  const areaRef = useRef<HTMLElement | null>(null);
  const ops = useOperations();

  return (
    <section className={styles.area} id="console-pipeline" aria-labelledby="console-pipeline-heading" ref={areaRef} tabIndex={-1}>
      <AreaHead id="console-pipeline" label={AREA_LABEL.pipeline} title="שבעה שלבים, ומה ממתין בכל אחד מהם">
        <div className={styles.actionRow}>
          <Button variant="secondary" type="button" disabled={ops.disabled} onClick={runDeepHealth}>
            בדיקת תקינות מעמיקה
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
            <PipelineFlow
              stages={value.stages}
              stageWord={stageWord}
              pendingWord="ממתינות"
              runningWord={(count) => `${count} רצות`}
              stuckWord={(count) => `${count} תקועות`}
              quarantinedWord={(count) => `${count} ${T.quarantined}`}
              okWord={T.ok}
              completedWord={`הושלמו ${T.last24h}`}
              averageWord="משך ממוצע"
              oldestPendingWord="הממתינה הוותיקה ביותר"
            />

            {/* ── Needs a person ────────────────────────────────────────── */}
            <div className={styles.panel}>
              <PanelTitle note={`${value.attention.length} ממתינות`}>משימות שדורשות אדם</PanelTitle>
              <p className={styles.muted}>תקועות, בבידוד, או נכשלות בניסיון האחרון שלהן. הרצה מחדש מחזירה את המשימה לתור; איפוס הניסיונות מאפשר למשימה שמיצתה אותם לרוץ שוב.</p>
              {value.attention.length ? (
                <JobTable jobs={value.attention} disabled={ops.disabled} />
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
                        <div className={styles.cellActions}>
                          <Button
                            variant={qualityDate === edition.localDate ? "primary" : "secondary"}
                            size="sm"
                            type="button"
                            onClick={() => setQualityDate(qualityDate === edition.localDate ? null : edition.localDate)}
                          >
                            {T.qualityChecks}
                          </Button>
                          <Button
                            variant={drillDate === edition.localDate ? "primary" : "secondary"}
                            size="sm"
                            type="button"
                            aria-expanded={drillDate === edition.localDate}
                            onClick={() => setDrillDate(drillDate === edition.localDate ? null : edition.localDate)}
                          >
                            {T.editionDetailToggle}
                          </Button>
                        </div>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>עדיין לא נרשמו מהדורות.</EmptyLine>
                )}
              </div>
            </div>

            {/* ── Quality checks — one matrix per edition row, its own read ── */}
            {qualityDate ? (
              <div className={styles.panel} aria-label="מטריצת בקרות האיכות של המהדורה">
                <PanelTitle note={qualityDate}>{`בקרות האיכות · ${qualityDate}`}</PanelTitle>
                <InlineAbsence state={quality.state} what="מטריצת בקרות האיכות" reload={quality.reload} />
                {quality.state.kind === "ready" && quality.value ? (
                  quality.value.candidates.length ? (
                    <ul className={styles.logList}>
                      {quality.value.candidates.map((candidate) => {
                        const checks = orderedChecks(candidate, quality.value!.required);
                        const failed = checks.filter((check) => check.status === "fail");
                        return (
                          <li key={`${candidate.runId}:${candidate.candidateKey}`}>
                            <span>
                              <Pill tone={candidate.passed ? "ok" : "danger"}>
                                {candidate.passed ? T.checkPassed : T.checkFailed}
                              </Pill>
                            </span>
                            {/* The candidate key is the identifier the quality
                                rows and the quarantine are filed under. */}
                            <strong><bdi>{candidate.candidateKey}</bdi></strong>
                            <small>
                              {candidate.passCount} מתוך {candidate.total} עברו · {stageWord(candidate.stage)}
                            </small>
                            <div className={styles.queueRow} aria-label="מצב הבקרות">
                              {checks.map((check) => (
                                <span key={check.checkName}>
                                  <small><bdi>{check.checkName}</bdi></small> ·{" "}
                                  <Pill tone={check.status === "pass" ? "ok" : "danger"}>
                                    {check.status === "pass" ? T.checkPassed : T.checkFailed}
                                  </Pill>
                                </span>
                              ))}
                            </div>
                            {failed.map((check) =>
                              check.detail ? (
                                <p key={check.checkName} className={styles.error}>
                                  <bdi>{check.checkName}</bdi>: {check.detail}
                                </p>
                              ) : null,
                            )}
                          </li>
                        );
                      })}
                    </ul>
                  ) : (
                    <EmptyLine>אין רשומות בקרות איכות ליום הזה.</EmptyLine>
                  )
                ) : null}
              </div>
            ) : null}

            {/* ── Draft preview — the persisted artifact for one date ───── */}
            <div className={styles.panel}>
              <PanelTitle note={draftDate}>{T.draftPreview}</PanelTitle>
              <p className={styles.muted}>{T.draftPreviewNote}</p>
              <div className={styles.actionRow}>
                <Button variant={draftOpen ? "primary" : "secondary"} type="button" aria-expanded={draftOpen} onClick={() => setDraftOpen(!draftOpen)}>
                  {draftOpen ? T.close : T.draftPreview}
                </Button>
                <Field
                  className={styles.editorField}
                  type="date"
                  label={T.date}
                  value={draftDate}
                  onChange={(event) => setDraftDate(event.currentTarget.value || israelLocalDate())}
                />
              </div>
              <InlineAbsence state={draft.state} what={T.draftWhat} reload={draft.reload} />
              {draft.state.kind === "unavailable" ? <p className={styles.muted}>{ABSENCE.draftEditionAbsent}</p> : null}
              {draft.state.kind === "ready" && draft.value ? (
                <>
                  <article>
                    <p className={styles.sectionLabel}>{SECTION_LABEL.daily_brief}</p>
                    <h4>{draft.value.dailyBrief.title}</h4>
                    <p className={styles.muted}>{draft.value.dailyBrief.summary}</p>
                    <DraftBody body={draft.value.dailyBrief.body} />
                  </article>
                  {draft.value.articles.map((article, index) => (
                    <article key={index}>
                      <p className={styles.sectionLabel}>{SECTION_LABEL[article.section]}</p>
                      <h4>{article.title}</h4>
                      <p className={styles.muted}>{article.summary}</p>
                      <DraftBody body={article.body} />
                    </article>
                  ))}
                </>
              ) : null}
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
                      <td><bdi>{entry.model}</bdi></td>
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

      <EditionDrawer localDate={drillDate} onClose={() => setDrillDate(null)} />
    </section>
  );

  async function runDeepHealth() {
    await ops.run("health", async () => {
      setDeepHealth(await readConsole<DeepHealth>("admin/health/deep"));
      return "בדיקת התקינות המעמיקה הסתיימה. התוצאה שלה מוצגת מעל השלבים.";
    });
  }
}

/**
 * One edition's full recovery payload, in an end-edge drawer — the same
 * shape `VersionsDrawer` uses on the editorial desk. The read is held until
 * an edition is asked for, so opening the console adds no route to the
 * pipeline's poll budget, and a 404 falls to the drawer's own unavailable
 * state rather than to the area's. Everything here is read-only: the runs,
 * the model calls, the artifacts, the claims and the jobs are the record of
 * what the edition did, not controls on it.
 */
function EditionDrawer({ localDate, onClose }: { localDate: string | null; onClose: () => void }) {
  const drill = useConsoleRead<ConsoleEditionDrilldown>(
    localDate ? `admin/console/editions/${encodeURIComponent(localDate)}` : "",
    { enabled: localDate !== null },
  );
  const runWord = (status: string) => RUN_STATUS_LABEL[status] ?? status;
  const assessmentTone = (value: string): PillTone =>
    value === "verified" ? "ok" : value === "refuted" || value === "misleading" ? "danger" : value === "unresolved" ? "neutral" : "warn";
  return (
    <Dialog
      open={localDate !== null}
      onClose={onClose}
      variant="drawer"
      size="wide"
      title={T.editionDetail}
      description={localDate ?? undefined}
      closeLabel={T.editionDetailClose}
    >
      {localDate ? (
        <>
          <InlineAbsence state={drill.state} what={T.editionWhat} reload={drill.reload} />
          {drill.state.kind === "ready" && drill.value ? (
            <>
              {/* The edition's own identity: its status word, its contract
                  and prompt versions, and its three windows. */}
              <div className={styles.compactMetrics}>
                <Metric
                  label={T.colStatus}
                  value={EDITION_STATUS_LABEL[drill.value.edition.status] ?? drill.value.edition.status}
                  tone={drill.value.edition.status === "published" ? "ok" : drill.value.edition.status === "failed" ? "danger" : "warn"}
                />
                <Metric label={T.contractVersion} value={drill.value.edition.contractVersion} />
                <Metric label={T.promptVersion} value={drill.value.edition.promptVersion} />
                <Metric label={T.opened} value={formatDate(drill.value.edition.collectionOpenedAt)} />
                <Metric label={T.closed} value={formatDate(drill.value.edition.collectionClosedAt)} />
                <Metric label={T.publishedWord} value={formatDate(drill.value.edition.publishedAt)} />
              </div>

              <div className={styles.panel}>
                <PanelTitle note={drill.value.localDate}>{T.runsByStage}</PanelTitle>
                {drill.value.runs.length ? (
                  <div className={styles.tableWrap}>
                    <table className={`${styles.table} ${styles.tableCompact}`}>
                      <thead>
                        <tr>
                          <th scope="col">{T.colStage}</th>
                          <th scope="col">{T.colStatus}</th>
                          <th scope="col">{T.input}</th>
                          <th scope="col">{T.output}</th>
                          <th scope="col">{T.duration}</th>
                          <th scope="col">{T.lastError}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drill.value.runs.map((run) => (
                          <tr key={run.id}>
                            <td>{stageWord(run.stage)}</td>
                            <td>
                              <Pill tone={run.status === "completed" ? "ok" : run.status === "failed" ? "danger" : "gold"}>{runWord(run.status)}</Pill>
                            </td>
                            <td>{run.inputCount}</td>
                            <td>{run.outputCount}</td>
                            {/* The duration is derived here, from the two
                                timestamps the row carries — the wire does not
                                carry a duration field. */}
                            <td>{run.finishedAt ? formatDuration(new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) : "—"}</td>
                            <td className={styles.errorCell}>{run.errorMessage ?? "—"}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyLine>עדיין לא נרשמו ריצות למהדורה הזו.</EmptyLine>
                )}
              </div>

              <div className={styles.panel}>
                <PanelTitle>{T.aiRuns}</PanelTitle>
                {drill.value.runAi.length ? (
                  <div className={styles.tableWrap}>
                    <table className={`${styles.table} ${styles.tableCompact}`}>
                      <thead>
                        <tr>
                          <th scope="col">{T.colStage}</th>
                          <th scope="col">{T.model}</th>
                          <th scope="col">{T.profile}</th>
                          <th scope="col">{T.tokensIn}</th>
                          <th scope="col">{T.tokensOut}</th>
                          <th scope="col">{T.cost}</th>
                          <th scope="col">{T.latency}</th>
                          <th scope="col">{T.colStatus}</th>
                        </tr>
                      </thead>
                      <tbody>
                        {drill.value.runAi.map((ai) => (
                          <tr key={ai.aiRunId}>
                            <td>{stageWord(ai.stage)}</td>
                            {/* The model slug and the profile are what the
                                gateway bills against; they stay Latin. */}
                            <td><bdi>{ai.model}</bdi></td>
                            <td><bdi>{ai.profile}</bdi></td>
                            <td>{ai.inputTokens ?? "—"}</td>
                            <td>{ai.outputTokens ?? "—"}</td>
                            <td>{formatUsd(ai.costUsd)}</td>
                            <td>{formatDuration(ai.latencyMs)}</td>
                            <td>
                              <Pill tone={ai.status === "ok" ? "ok" : "warn"}>{ai.status}</Pill>
                            </td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                ) : (
                  <EmptyLine>אין קריאות מודל רשומות למהדורה הזו.</EmptyLine>
                )}
              </div>

              <div className={styles.panel}>
                <PanelTitle note={T.latestVersion}>{T.artifacts}</PanelTitle>
                {drill.value.artifacts.length ? (
                  <ul className={styles.logList}>
                    {drill.value.artifacts.map((artifact) => (
                      <li key={`${artifact.stage}:${artifact.artifactVersion}`}>
                        <span>
                          <Pill tone="neutral">{stageWord(artifact.stage)}</Pill>
                        </span>
                        <strong>{`${T.artifactVersion} ${artifact.artifactVersion}`}</strong>
                        <small>
                          inputHash <bdi>{artifact.inputHash.slice(0, 12)}</bdi> · {formatDate(artifact.createdAt)}
                        </small>
                        {/* The payload is the artifact's own JSON, expandable
                            the way an audit row's before/after is. */}
                        <details className={styles.traceability}>
                          <summary>{T.details}</summary>
                          <pre className={styles.json}>{artifact.payload === undefined ? "—" : JSON.stringify(artifact.payload, null, 2)}</pre>
                        </details>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>אין מוצרי ביניים שמורים למהדורה הזו.</EmptyLine>
                )}
              </div>

              <div className={styles.panel}>
                <PanelTitle note={`${drill.value.claims.length} ${T.claims}`}>{T.claims}</PanelTitle>
                {drill.value.claims.length ? (
                  <ul className={styles.logList}>
                    {drill.value.claims.map((claim) => (
                      <li key={claim.itemId}>
                        <span>
                          <Pill tone="neutral">{CLAIM_LAYER_LABEL[claim.layer] ?? claim.layer}</Pill>
                        </span>
                        <strong>
                          <Pill tone={assessmentTone(claim.machineAssessment)}>{ASSESSMENT_LABEL[claim.machineAssessment] ?? claim.machineAssessment}</Pill>
                        </strong>
                        <small>
                          {T.attributedTo} {claim.attributedTo ?? "—"}
                          {claim.uncertainty ? ` · ${T.uncertainty} ${claim.uncertainty}` : ""}
                          {` · ${formatDate(claim.createdAt)}`}
                        </small>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <EmptyLine>אין טענות משויכות למהדורה הזו.</EmptyLine>
                )}
              </div>

              <div className={styles.panel}>
                <PanelTitle>{T.jobs}</PanelTitle>
                {drill.value.jobs.length ? <JobTable jobs={drill.value.jobs} compact /> : <EmptyLine>אין משימות רשומות למהדורה הזו.</EmptyLine>}
              </div>
            </>
          ) : null}
        </>
      ) : null}
    </Dialog>
  );
}
