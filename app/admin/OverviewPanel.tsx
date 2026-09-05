"use client";

import { useRef, useState } from "react";
import Link from "next/link";
import { Button } from "@/components/ui/Button";
import type { ConsoleOverview, ConsoleIncidents } from "@/server/contracts/admin-console";
import type { BriefingStatus } from "./briefing-shapes";
import { ConfirmDialog, type ConfirmIntent } from "./ConfirmDialog";
import { AreaHead, ConsoleNotices, InlineAbsence, PanelTitle, Pill, ReadGate, formatDate, stageLabel, today, useOperations } from "./console-primitives";
import { Stat, StatGrid } from "./_command/StatusCards";
import { JOB_STATE_LABEL } from "./lexicon";
import { callConsole, useConsoleRead } from "./useConsoleRead";
import styles from "./admin.module.css";
import workspace from "./workspace.module.css";

const STATE_WORD = { configured: "מוגדר לפעול", observed: "נרשמה פעילות", paused: "מושהה", degraded: "דורש טיפול", unknown: "אין מידע מספיק" };
const ATTENTION = {
  critical_alerts: { title: "התראות קריטיות פתוחות", note: "בדיקת האירועים והאם הבעיה עדיין קיימת", area: "incidents" },
  stuck_jobs: { title: "משימות ללא עדכון בזמן", note: "בדיקת השלב והאפשרות להרצה חוזרת", area: "pipeline" },
  quarantined_jobs: { title: "משימות בבידוד", note: "בדיקת סיבת הכשל ואפשרויות ההתאוששות", area: "incidents" },
  processing_disabled: { title: "העיבוד מושבת בהגדרות", note: "בדיקת תצורת העיבוד של הסביבה", area: "settings" },
  publication_paused: { title: "הפרסום האוטומטי מושהה", note: "האיסוף והעיבוד אינם נשלטים באמצעות מתג הפרסום", area: "pipeline" },
} as const;

export function OverviewPanel({ signal }: { signal: number }) {
  const overview = useConsoleRead<ConsoleOverview>("admin/console/overview", { signal, pollInterval: 30_000 });
  const briefing = useConsoleRead<BriefingStatus>("admin/briefing", { signal });
  const incidents = useConsoleRead<ConsoleIncidents>("admin/console/incidents", { signal });
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  const areaRef = useRef<HTMLElement | null>(null);
  const ops = useOperations();
  const paused = overview.value?.automaticPublicationPaused ?? briefing.value?.automaticPublicationPaused ?? null;
  function reloadAll() { overview.reload(); briefing.reload(); incidents.reload(); }

  return (
    <section id="console-overview" className={styles.area} aria-labelledby="console-overview-heading" ref={areaRef} tabIndex={-1}>
      <AreaHead id="console-overview" label="תמונת מצב" title="מה קורה עכשיו" note="הגדרה פעילה אינה הוכחה לריצה מוצלחת. הנתונים מציגים את התצפית האחרונה בכל שלב.">
        <Button variant="primary" disabled={ops.disabled || paused === null} onClick={runBriefing}>הרצת עיבוד עכשיו</Button>
      </AreaHead>
      <ConsoleNotices busy={ops.busy} notice={ops.notice} />
      <ReadGate state={overview.state} what="תמונת המצב" reload={overview.reload}>
        {(value) => <>
          <div className={workspace.health}>
            {([
              ["collection", "איסוף", "sources"], ["processing", "עיבוד", "pipeline"], ["publication", "פרסום", "editorial"],
            ] as const).map(([key, label, area]) => {
              const health = value.health?.[key];
              return <Link key={key} href={`/admin?area=${area}`} prefetch={false}>
                <h3>{label}</h3>
                <strong>{health ? STATE_WORD[health.state] : "אין מידע מספיק"}</strong>
                <p>{health?.observedAt ? `פעילות אחרונה: ${formatDate(health.observedAt)}` : "לא נרשמה פעילות מוצלחת"}</p>
                {key === "publication" ? <p>{value.automaticPublicationPaused ? "פרסום אוטומטי מושהה" : "פרסום אוטומטי מופעל בהגדרות"}</p> : null}
              </Link>;
            })}
          </div>
          <div className={styles.twoColumns}>
            <section className={styles.panel}>
              <PanelTitle>לטיפול</PanelTitle>
              <ul className={workspace.attention}>
                {(value.attention ?? []).map((issue) => <li key={issue.code}>
                  <Link href={`/admin?area=${ATTENTION[issue.code].area}`} prefetch={false}>
                    <span>{ATTENTION[issue.code].title}<small>{ATTENTION[issue.code].note}</small></span>
                    <Pill tone={issue.severity === "critical" ? "danger" : issue.severity === "warning" ? "warn" : "neutral"}>{issue.count}</Pill>
                  </Link>
                </li>)}
                {incidents.value && incidents.value.outbox.undelivered > 0 ? <li>
                  <Link href="/admin?area=incidents" prefetch={false}>
                    <span>מסירות פנימיות ממתינות<small>בדיקת גיל התור ותוצאות המסירה</small></span>
                    <Pill tone="warn">{incidents.value.outbox.undelivered}</Pill>
                  </Link>
                </li> : null}
              </ul>
              <InlineAbsence state={incidents.state} what="מצב המסירות" reload={incidents.reload} />
              {value.attention?.length === 0 && incidents.state.kind === "ready" && incidents.value?.outbox.undelivered === 0 ? <p className={styles.muted}>לא נמצאו משימות לטיפול בסיכום הנוכחי.</p> : null}
              {!value.attention ? <p className={styles.muted}>פירוט הטיפול אינו זמין בגרסת השרת הזו. <Link href="/admin?area=incidents">פתיחת התקלות</Link></p> : null}
            </section>
            <section className={styles.panel}>
              <PanelTitle>פעילות ותזמון</PanelTitle>
              <dl className={styles.runFacts}>
                <dt>ריצה אחרונה שנרשמה</dt><dd>{formatDate(value.lastRun.at)}</dd>
                <dt>שלב</dt><dd>{value.lastRun.stage?.startsWith("external_publish:") ? "קליטת מהדורה חיצונית" : value.lastRun.stage ? stageLabel(value.lastRun.stage) : "לא נרשם"}</dd>
                <dt>מצב רשום</dt><dd>{value.lastRun.status ? JOB_STATE_LABEL[value.lastRun.status] ?? value.lastRun.status : "לא נרשם"}</dd>
                <dt>איסוף מתוכנן הבא</dt><dd>{value.nextRun.at ? formatDate(value.nextRun.at) : "לא מתוזמן"}</dd>
              </dl>
              <p className={styles.muted}>מועד האיסוף מחושב מהתזמון. הוא אינו אישור שהריצה תתבצע. מצב ריצה ישן אינו הוכחה שהיא עדיין פועלת.</p>
              <details className={styles.traceability}><summary>פרטים טכניים</summary><p><bdi>{value.lastRun.stage}</bdi></p><p><bdi>{value.nextRun.schedule}</bdi></p><p><bdi>{value.nextRun.path}</bdi></p></details>
            </section>
          </div>
          <section><PanelTitle>תפוקה ב־24 השעות האחרונות</PanelTitle><StatGrid>
            <Stat label="ראיות שנאספו" value={String(value.counts24h.collected)} />
            <Stat label="משימות שעובדו" value={String(value.counts24h.processed)} />
            <Stat label="כתבות שנוצרו" value={String(value.counts24h.drafted)} />
            <Stat label="כתבות שפורסמו" value={String(value.counts24h.published)} />
          </StatGrid></section>
        </>}
      </ReadGate>
      <div className={styles.controlBar}>
        <div><h3>בקרת פרסום</h3><p className={styles.muted}>{paused === null ? "מצב הפרסום אינו זמין; הפעולות מושבתות עד שייקרא." : paused ? "פרסום אוטומטי מושהה. ניתן לחדש אותו כאן." : "פרסום אוטומטי מופעל בהגדרות. זה אינו אישור שכל מהדורה עברה את בדיקות הפרסום."}</p></div>
        <div className={styles.actionRow}>
          <Button variant="secondary" disabled={ops.disabled || paused === null} onClick={() => requestPublicationControl(!paused)}>{paused ? "חידוש הפרסום האוטומטי" : "השהיית הפרסום האוטומטי"}</Button>
          {paused === false ? <Button variant="secondary" disabled={ops.disabled} onClick={requestEditionPublication}>פרסום מהדורה מאושרת</Button> : null}
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
