"use client";

import { useCallback, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/Skeleton";
import { politeLive } from "@/components/ui/live-region";
import type { ConsoleCosts, ConsoleIncidents, ConsoleOverview, OpsCapabilities } from "@/server/contracts/admin-console";
import type { BriefingStatus, Status } from "./briefing-shapes";
import { ConfirmDialog, type ConfirmIntent } from "./ConfirmDialog";
import { AlertList, CommandCard, Stat, StatGrid, VerdictBanner } from "./_command/StatusCards";
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
  formatPercent,
  formatUsd,
  today,
  useOperations,
  type PillTone,
} from "./console-primitives";
import { AREA_LABEL, JOB_STATE_LABEL, SEVERITY_LABEL, STAGE_LABEL, T } from "./lexicon";
import { callConsole, useConsoleRead } from "./useConsoleRead";
import styles from "./admin.module.css";

/**
 * Overview — the one screen an operator reads first.
 *
 * It answers four questions in the order they are asked: is the system
 * active (and if not, why); when did it last run and when will it next; what
 * moved through it in the last day; and what is waiting for a person. The
 * two controls that decide whether anything reaches readers live here as the
 * primary controls: the publication switch and "run processing now".
 *
 * `console/overview` is the summary; `briefing` and `status` still carry the
 * numbers this route does not, and the area degrades to those when the
 * summary is not served.
 */
const OVERVIEW_POLL_MS = 30_000;

export function OverviewPanel({ signal }: { signal: number }) {
  const overview = useConsoleRead<ConsoleOverview>("admin/console/overview", { signal, pollInterval: OVERVIEW_POLL_MS });
  const briefing = useConsoleRead<BriefingStatus>("admin/briefing", { signal, pollInterval: OVERVIEW_POLL_MS });
  const status = useConsoleRead<Status>("admin/status", { signal, pollInterval: OVERVIEW_POLL_MS });
  /* What the console can do, from the same capability list the operations
    * chat renders — read here rather than copied, so the two never disagree.
    * Static enough to skip polling; the shell signal still refreshes it. */
  const capabilities = useConsoleRead<OpsCapabilities>("admin/ops/capabilities", { signal });
  /* The costs meters and the inner delivery queue: mount + signal only, no
    * new poll — the 30s budget above is the area's whole poll spend, and the
    * shell signal refreshes these with everything else. `status` already
    * carries the integrations and the resource fingerprints; the regions
    * below only surface them. */
  const costs = useConsoleRead<ConsoleCosts>("admin/console/costs", { signal });
  const incidents = useConsoleRead<ConsoleIncidents>("admin/console/incidents", { signal });
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
      <AreaHead id="console-overview" label={AREA_LABEL.overview} title="האם המערכת פועלת, ומה דורש אדם">
        <div className={styles.actionRow}>
          <Button variant="primary" type="button" disabled={ops.disabled || paused === null} onClick={runBriefing}>
            הרצת עיבוד עכשיו
          </Button>
        </div>
      </AreaHead>
      <ConsoleNotices busy={ops.busy} notice={ops.notice} />

      {/* ── The verdict ──────────────────────────────────────────────── */}
      <ReadGate
        state={overview.state}
        what="תמונת המצב"
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
            <VerdictBanner active={value.systemActive} word={value.systemActive ? "פעילה." : "אינה פעילה."}>
              {value.systemActive ? (
                <p>האיסוף, העיבוד והפרסום פועלים כולם מעצמם. נכון ל־{formatDate(value.generatedAt)}.</p>
              ) : (
                <ul className={styles.reasonList}>
                  {value.inactiveReasons.length ? value.inactiveReasons.map((reason) => <li key={reason}>{reason}</li>) : <li>לא נרשמה סיבה.</li>}
                </ul>
              )}
              <dl className={styles.runFacts}>
                <dt>ריצה אחרונה</dt>
                <dd>
                  {value.lastRun.at ? (
                    <>
                      {formatAgo(value.lastRun.at)} · <bdi>{value.lastRun.localDate ?? ""}</bdi>{" "}
                      {value.lastRun.stage ? STAGE_LABEL[value.lastRun.stage] ?? value.lastRun.stage : ""}{" "}
                      {value.lastRun.status ? (
                        <Pill tone={value.lastRun.status === "completed" ? "ok" : "warn"}>
                          {JOB_STATE_LABEL[value.lastRun.status] ?? value.lastRun.status}
                        </Pill>
                      ) : null}
                    </>
                  ) : (
                    "לא נרשמה"
                  )}
                </dd>
                <dt>הריצה הבאה</dt>
                <dd>
                  {value.nextRun.at ? formatDate(value.nextRun.at) : "לא מתוזמנת"}
                  {value.nextRun.schedule ? <small><bdi>{value.nextRun.schedule}</bdi>{value.nextRun.path ? <> · <bdi>{value.nextRun.path}</bdi></> : ""}</small> : null}
                </dd>
              </dl>
            </VerdictBanner>

            <StatGrid>
              <Stat label={`נאספו ${T.last24h}`} value={String(value.counts24h.collected)} />
              <Stat label={`עובדו ${T.last24h}`} value={String(value.counts24h.processed)} />
              <Stat label={`נוסחו ${T.last24h}`} value={String(value.counts24h.drafted)} />
              <Stat label={`פורסמו ${T.last24h}`} value={String(value.counts24h.published)} />
              <Stat label={`${T.jobs} שנכשלו ${T.last24h}`} value={String(value.counts24h.failedJobs)} tone={value.counts24h.failedJobs ? "danger" : "ok"} />
              <Stat label="התראות קריטיות פתוחות" value={String(value.openAlerts.critical)} tone={value.openAlerts.critical ? "danger" : "ok"} />
              <Stat label="אזהרות פתוחות" value={String(value.openAlerts.warning)} tone={value.openAlerts.warning ? "warn" : "ok"} />
              <Stat label={`${T.jobs} תקועות`} value={String(value.stuckJobs)} tone={value.stuckJobs ? "warn" : "ok"} />
              <Stat label={T.quarantined} value={String(value.quarantined)} tone={value.quarantined ? "warn" : "ok"} />
            </StatGrid>
          </>
        )}
      </ReadGate>

      {/* ── Publication control ───────────────────────────────────────── */}
      <div className={styles.controlBar}>
        <div>
          <p className={styles.sectionLabel}>בקרת פרסום</p>
          <h3>
            {paused === null ? "מצב הפרסום אינו ידוע" : paused ? "הפרסום האוטומטי מושהה" : "הפרסום האוטומטי פעיל"}
          </h3>
          <p className={styles.muted}>
            {paused === null
              ? "המתג נקרא מסיכום הבריף, שעדיין לא נטען."
              : paused
                ? "מהדורות מאושרות ממתינות לאדם. האיסוף והעיבוד ממשיכים, ולכן שום דבר לא הולך לאיבוד בזמן שהמתג כבוי."
                : "מהדורות מאושרות מתפרסמות לאתר הציבורי מעצמן. האיסוף והעיבוד פועלים ללא תלות במתג הזה."}
          </p>
        </div>
        <div className={styles.actionRow}>
          <Button
            variant={paused ? "primary" : "secondary"}
            type="button"
            disabled={ops.disabled || paused === null}
            onClick={() => requestPublicationControl(!paused)}
          >
            {paused ? "חידוש הפרסום האוטומטי" : "השהיית הפרסום האוטומטי"}
          </Button>
          {paused === false ? (
            <Button variant="primary" type="button" disabled={ops.disabled} onClick={requestEditionPublication}>
              פרסום המהדורה המאושרת של היום
            </Button>
          ) : null}
        </div>
      </div>

      {/* ── Runtime model and capabilities ─────────────────────────── */}
      <CommandCard
        label="מודל והרשאות"
        title={capabilities.value ? "המוח התורן של הקונסולה" : "מודל והרשאות"}
        tone={capabilities.value ? "accent" : "warn"}
        note="אותה רשימת יכולות שעוזר התפעול מציג — נקראת מאותו מסלול, לא מועתקת."
      >
        <InlineAbsence state={capabilities.state} what="יכולות העוזר" reload={capabilities.reload} />
        {capabilities.value ? (
          <StatGrid>
            <Stat label="מודל פעיל" value={capabilities.value.model} tone="ok" />
            <Stat label="כלים זמינים" value={String(capabilities.value.tools.length)} />
            <Stat
              label="כלים ששואלים קודם"
              value={String(capabilities.value.tools.filter((tool) => tool.requiresConfirmation).length)}
              tone="warn"
            />
          </StatGrid>
        ) : null}
      </CommandCard>

      {/* ── What the summary does not carry ───────────────────────────── */}
      <div className={styles.twoColumns}>
        <div className={styles.panel}>
          <PanelTitle>הפריסה הזו</PanelTitle>
          <InlineAbsence state={status.state} what="מצב הפריסה" reload={status.reload} />
          {status.value ? (
            <div className={styles.compactMetrics}>
              <Metric label="סביבה" value={status.value.environment} />
              <Metric label="אזור" value={status.value.region} />
              <Metric label="תקרת התקציב החודשית לבריף" value={formatUsd(status.value.aiBudgetUsd, 2)} />
              <Metric
                label="פגיעות במטמון הציבורי"
                value={
                  status.value.publicReadCache.hitRatio === null
                    ? "אין נתונים"
                    : `${(status.value.publicReadCache.hitRatio * 100).toFixed(1)}% · ${status.value.publicReadCache.averageLoadMs ?? 0} ms`
                }
              />
            </div>
          ) : null}
        </div>
        <div className={styles.panel}>
          <PanelTitle>{`${T.alerts} פתוחות`}</PanelTitle>
          <InlineAbsence state={briefing.state} what="סיכום הבריף" reload={briefing.reload} />
          {briefing.value ? (
            briefing.value.alerts.length ? (
              <AlertList
                items={briefing.value.alerts.map((entry) => ({
                  id: entry.id,
                  severity: entry.severity,
                  kind: entry.kind,
                  message: entry.message,
                  extra: entry.notifiedAt ? "ההתראה נשלחה" : "ההתראה ממתינה לשליחה",
                }))}
                severityWord={(severity) => SEVERITY_LABEL[severity] ?? severity}
              />
            ) : (
              <EmptyLine>אין התראות פתוחות. הקריאה הצליחה והרשימה באמת ריקה.</EmptyLine>
            )
          ) : null}
        </div>
      </div>

      {/* ── Costs, readiness and the inner delivery queue ────────────────
          The four budget meters of System & Security's costs sub-area, the
          integration readiness and the resource fingerprints the status
          read above already carries, and the outbox backlog. Both console
          reads are mount + signal only, so the area's poll spend stays the
          three 30s reads it declares above. */}
      <div className={styles.twoColumns}>
        <div className={styles.panel}>
          <PanelTitle>{T.budgetsPanel}</PanelTitle>
          <InlineAbsence state={costs.state} what={T.costsRead} reload={costs.reload} />
          {costs.value ? (
            <>
              {costs.value.warnings.length ? (
                <ul className={styles.warnList} {...politeLive}>
                  {costs.value.warnings.map((warning) => (
                    <li key={warning} className={styles.warnNote}>
                      {warning}
                    </li>
                  ))}
                </ul>
              ) : null}
              <PanelTitle note={`${T.warnNotePrefix} ${formatPercent(costs.value.warnAt)}`}>{T.budgets}</PanelTitle>
              <div className={styles.meterGrid}>
                <BudgetMeter label={T.meterAiDaily} fraction={costs.value.utilisation.aiDaily} spent={formatUsd(costs.value.spend.today, 2)} budget={formatUsd(costs.value.budgets.ai.dailyUsd, 2)} warnAt={costs.value.warnAt} />
                <BudgetMeter label={T.meterAiMonthly} fraction={costs.value.utilisation.aiMonthly} spent={formatUsd(costs.value.spend.monthToDateUsd, 2)} budget={formatUsd(costs.value.budgets.ai.monthlyUsd, 2)} warnAt={costs.value.warnAt} />
                <BudgetMeter label={T.meterBriefingMonthly} fraction={costs.value.utilisation.briefingMonthly} spent={formatUsd(costs.value.spend.monthToDateUsd, 2)} budget={formatUsd(costs.value.budgets.briefing.monthlyUsd, 2)} warnAt={costs.value.warnAt} />
                <BudgetMeter
                  label={T.meterSearchMonthly}
                  fraction={costs.value.utilisation.searchMonthly}
                  spent={`${costs.value.search.successfulQueriesThisMonth} ${T.queries}`}
                  budget={costs.value.budgets.search.monthlyQueries === null ? T.noQueryBudget : `${costs.value.budgets.search.monthlyQueries} ${T.queries}`}
                  warnAt={costs.value.warnAt}
                />
              </div>
            </>
          ) : null}
        </div>
        <div className={styles.panel}>
          <PanelTitle>{T.integrations}</PanelTitle>
          <InlineAbsence state={status.state} what="מצב הפריסה" reload={status.reload} />
          {status.value ? (
            <div className={styles.grid}>
              {Object.entries(status.value.integrations).map(([name, active]) => (
                <article className={styles.service} key={name}>
                  <Pill tone={active ? "ok" : "warn"}>{active ? T.ready : T.waiting}</Pill>
                  <h4>{name}</h4>
                </article>
              ))}
            </div>
          ) : null}
          <PanelTitle>{T.resourceIdentity}</PanelTitle>
          <p className={styles.muted}>{T.fingerprintNote}</p>
          {status.value ? (
            <StatGrid>
              {Object.entries(status.value.resourceFingerprints ?? {}).map(([name, fingerprint]) => (
                <Stat key={name} label={name} value={fingerprint ?? T.notSet} />
              ))}
            </StatGrid>
          ) : null}
          <PanelTitle>{T.outboxPanel}</PanelTitle>
          <InlineAbsence state={incidents.state} what={T.outboxPanel} reload={incidents.reload} />
          {incidents.value ? (
            <StatGrid>
              <Stat label={T.outboxUndelivered} value={String(incidents.value.outbox.undelivered)} tone={incidents.value.outbox.undelivered ? "warn" : "ok"} />
              <Stat label={T.outboxDeadLettered} value={String(incidents.value.outbox.deadLettered)} tone={incidents.value.outbox.deadLettered ? "danger" : "ok"} />
              <Stat label={T.outboxOldest} value={incidents.value.outbox.oldestAt ? formatAgo(incidents.value.outbox.oldestAt) : T.none} />
            </StatGrid>
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

  function requestEditionPublication() {
    setConfirmIntent({
      action: "פרסום המהדורה המאושרת של היום עכשיו",
      target: "מהדורת היום",
      targetDetail: today(),
      consequence: "כל כתבה מאושרת במהדורת היום תהפוך לקריאה בדפים הציבוריים וזמינה למנועי חיפוש באופן מיידי. הורדה של כתבה בחזרה פירושה ארכוב שלה, וייתכן שקוראים כבר ראו אותה.",
      confirmLabel: "פרסום המהדורה",
      tone: "primary",
      run: resumePausedEdition,
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

  async function runBriefing() {
    await ops.run("run", async () => {
      /* No body: the route treats an empty POST as the plain run, and its own
         schema refuses `{}` (an explicit action is required) — so an empty
         object here was a guaranteed 422. The two variants below still send
         theirs. */
      const result = await callConsole<{
        status: string;
        activeCollectionJobs?: number;
        recovery?: { dispatched: number; configurationRecovered?: number; processingResumed?: number };
      }>("admin/briefing/run", { method: "POST", failure: "לא ניתן להתחיל עיבוד עכשיו." });
      reloadAll();
      const recovered = result.recovery?.dispatched ?? 0;
      const repaired = result.recovery?.configurationRecovered ?? 0;
      const resumed = result.recovery?.processingResumed ?? 0;
      const recoveryMessage = recovered > 0
        ? `${repaired > 0 ? `${repaired} משימות שנחסמו בגלל תצורה תוקנו, ` : ""}${resumed > 0 ? `${resumed} משימות עיבוד שהמתינו לשחרור חודשו, ` : ""}${recovered} משימות ממתינות נשלחו לתור מחדש. `
        : "";
      return result.status === "queued"
        ? `${recoveryMessage}העיבוד נכנס לתור.`
        : result.status === "waiting_for_collection"
          ? `${recoveryMessage}העיבוד ממתין ל־${result.activeCollectionJobs ?? 0} משימות איסוף.`
          : "הריצה של היום כבר הושלמה.";
    });
  }

  async function resumePausedEdition() {
    await ops.run("resume-paused-edition", async () => {
      const result = await callConsole<{ status: string; publications: number; reason?: string }>("admin/briefing/run", {
        method: "POST",
        body: { resumePausedEdition: true },
        failure: "לא ניתן להשלים את פרסום המהדורה.",
      });
      reloadAll();
      return result.status === "completed"
        ? `מהדורת היום פורסמה אוטומטית עם ${result.publications} כתבות.`
        : result.status === "already_run"
          ? "מהדורת היום כבר פורסמה."
          : "אין מהדורה מאושרת להשלמה היום.";
    });
  }
}

/** One spend-versus-budget bar — the markup, the colour ramp and the
 *  threshold behaviour of System & Security's costs meter, mirrored rather
 *  than imported because that sub-area owns its own; the labels travel with
 *  it through the lexicon, and a `null` budget is stated, never rendered as
 *  a zero. */
function BudgetMeter({ label, fraction, spent, budget, warnAt }: { label: string; fraction: number | null; spent: string; budget: string; warnAt: number }) {
  const tone: PillTone = fraction === null ? "neutral" : fraction >= 1 ? "danger" : fraction >= warnAt ? "warn" : "ok";
  const width = fraction === null ? 0 : Math.min(100, Math.round(fraction * 100));
  return (
    <div className={styles.meter}>
      <div className={styles.meterHead}>
        <span>{label}</span>
        <Pill tone={tone}>{fraction === null ? T.noBudget : formatPercent(fraction)}</Pill>
      </div>
      <div className={styles.meterTrack} role="img" aria-label={`${label}: ${spent} ${T.ofTotal} ${budget}`}>
        <span className={`${styles.meterFill} ${styles[`meter${tone === "danger" ? "Danger" : tone === "warn" ? "Warn" : "Ok"}`]}`} style={{ width: `${width}%` }} />
      </div>
      <p className={styles.headNote}>
        {spent} {T.ofTotal} {budget}
      </p>
    </div>
  );
}
