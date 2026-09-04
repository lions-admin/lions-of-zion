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
  today,
  useOperations,
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
            <div className={value.systemActive ? styles.verdict : `${styles.verdict} ${styles.verdictOff}`}>
              <p className={styles.verdictWord}>{value.systemActive ? "פעילה." : "אינה פעילה."}</p>
              <div className={styles.verdictBody}>
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
                        {formatAgo(value.lastRun.at)} · {value.lastRun.localDate ?? ""}{" "}
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
                    {value.nextRun.schedule ? <small>{value.nextRun.schedule}{value.nextRun.path ? ` · ${value.nextRun.path}` : ""}</small> : null}
                  </dd>
                </dl>
              </div>
            </div>

            <div className={styles.summary}>
              <Metric label={`נאספו ${T.last24h}`} value={String(value.counts24h.collected)} />
              <Metric label={`עובדו ${T.last24h}`} value={String(value.counts24h.processed)} />
              <Metric label={`נוסחו ${T.last24h}`} value={String(value.counts24h.drafted)} />
              <Metric label={`פורסמו ${T.last24h}`} value={String(value.counts24h.published)} />
            </div>

            <div className={styles.compactMetrics}>
              <Metric label={`${T.jobs} שנכשלו ${T.last24h}`} value={String(value.counts24h.failedJobs)} tone={value.counts24h.failedJobs ? "danger" : "ok"} />
              <Metric label="התראות קריטיות פתוחות" value={String(value.openAlerts.critical)} tone={value.openAlerts.critical ? "danger" : "ok"} />
              <Metric label="אזהרות פתוחות" value={String(value.openAlerts.warning)} tone={value.openAlerts.warning ? "warn" : "ok"} />
              <Metric label={`${T.jobs} תקועות`} value={String(value.stuckJobs)} tone={value.stuckJobs ? "warn" : "ok"} />
              <Metric label={T.quarantined} value={String(value.quarantined)} tone={value.quarantined ? "warn" : "ok"} />
            </div>
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
              <ul className={styles.logList}>
                {briefing.value.alerts.map((entry) => (
                  <li key={entry.id}>
                    <span>
                      <Pill tone={entry.severity === "critical" ? "danger" : "warn"}>{SEVERITY_LABEL[entry.severity] ?? entry.severity}</Pill>
                    </span>
                    {/* The alert kind is the wire identifier the alert is filed under, so it is shown as it is stored. */}
                    <strong>{entry.kind}</strong>
                    <small>
                      {entry.message} · {entry.notifiedAt ? "ההתראה נשלחה" : "ההתראה ממתינה לשליחה"}
                    </small>
                  </li>
                ))}
              </ul>
            ) : (
              <EmptyLine>אין התראות פתוחות. הקריאה הצליחה והרשימה באמת ריקה.</EmptyLine>
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
      const result = await callConsole<{
        status: string;
        activeCollectionJobs?: number;
        recovery?: { dispatched: number; configurationRecovered?: number; processingResumed?: number };
      }>("admin/briefing/run", { method: "POST", body: {}, failure: "לא ניתן להתחיל עיבוד עכשיו." });
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
