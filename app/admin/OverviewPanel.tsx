"use client";

import { useRef } from "react";
import Link from "next/link";
import type { ConsoleOverview, ConsoleIncidents } from "@/server/contracts/admin-console";
import { AreaHead, InlineAbsence, PanelTitle, Pill, ReadGate, formatDate, stageLabel } from "./console-primitives";
import { Stat, StatGrid } from "./_command/StatusCards";
import { JOB_STATE_LABEL } from "./lexicon";
import { useConsoleRead } from "./useConsoleRead";
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
  const incidents = useConsoleRead<ConsoleIncidents>("admin/console/incidents", { signal });
  const areaRef = useRef<HTMLElement | null>(null);

  return (
    <section id="console-overview" className={styles.area} aria-labelledby="console-overview-heading" ref={areaRef} tabIndex={-1}>
      <AreaHead id="console-overview" label="תמונת מצב" title="מה קורה עכשיו" note="הגדרה פעילה אינה הוכחה למסירה מוצלחת. הנתונים מציגים את התצפית האחרונה בכל שלב." />
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
    </section>
  );
}
