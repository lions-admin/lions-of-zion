"use client";

import { useEffect, useState } from "react";
import { createAuthClient } from "@neondatabase/auth/next";
import { useRouter } from "next/navigation";
import styles from "./admin.module.css";

type Status = {
  status: string;
  environment: string;
  region: string;
  aiBudgetUsd: number;
  integrations: Record<string, boolean>;
};

type UserCount = { registeredUsers: number };
type BriefingStatus = { latestRunAt: string | null; failedRuns: number; unprocessedEvidence: number };

const auth = createAuthClient();

export function AdminStatus() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [userCount, setUserCount] = useState<UserCount | null>(null);
  const [briefing, setBriefing] = useState<BriefingStatus | null>(null);
  const [briefingRunning, setBriefingRunning] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    Promise.all([
      fetch("/api/v1/admin/status", { cache: "no-store" }),
      fetch("/api/v1/admin/user-count", { cache: "no-store" }),
      fetch("/api/v1/admin/briefing", { cache: "no-store" }),
    ])
      .then(async ([statusResponse, countResponse, briefingResponse]) => {
        if (!statusResponse.ok || !countResponse.ok || !briefingResponse.ok) {
          throw new Error(statusResponse.status === 403 || countResponse.status === 403 ? "החשבון הזה אינו מורשה." : "לא ניתן לטעון את מצב המערכות.");
        }
        return Promise.all([
          statusResponse.json() as Promise<Status>,
          countResponse.json() as Promise<UserCount>,
          briefingResponse.json() as Promise<BriefingStatus>,
        ]);
      })
      .then(([nextStatus, nextCount, nextBriefing]) => { setStatus(nextStatus); setUserCount(nextCount); setBriefing(nextBriefing); })
      .catch((cause: Error) => setError(cause.message));
  }, []);

  if (error) return <p className={styles.error} role="alert">{error}</p>;
  if (!status || !userCount || !briefing) return <p className={styles.muted}>טוען מצב…</p>;

  return (
    <>
      <div className={styles.summary}>
        <div><span>סביבה</span><strong>{status.environment}</strong></div>
        <div><span>אזור</span><strong>{status.region}</strong></div>
        <div><span>תקרת AI באפליקציה</span><strong>${status.aiBudgetUsd.toFixed(2)}</strong></div>
        <div><span>משתמשים רשומים</span><strong>{userCount.registeredUsers}</strong></div>
      </div>
      <div className={styles.grid}>
        {Object.entries(status.integrations).map(([name, active]) => (
          <article className={styles.service} key={name}>
            <span className={active ? styles.ok : styles.wait}>{active ? "מוכן" : "ממתין"}</span>
            <h2>{name}</h2>
          </article>
        ))}
      </div>
      <section className={styles.service}>
        <span className={briefing.failedRuns ? styles.wait : styles.ok}>{briefing.failedRuns ? "נדרשת בדיקה" : "תקין"}</span>
        <h2>הבריף היומי</h2>
        <p className={styles.muted}>ראיות שעדיין לא עובדו: {briefing.unprocessedEvidence}</p>
        <p className={styles.muted}>ריצה אחרונה: {briefing.latestRunAt ? new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(briefing.latestRunAt)) : "עדיין לא בוצעה"}</p>
        <button
          className={styles.secondary}
          type="button"
          disabled={briefingRunning}
          onClick={async () => {
            setBriefingRunning(true);
            try {
              const response = await fetch("/api/v1/admin/briefing/run", { method: "POST" });
              if (!response.ok) throw new Error("לא ניתן להפעיל את הבריף כעת.");
              const result = await response.json() as { status: string; publications: number };
              setError(result.status === "already_run" ? "הבריף כבר רץ היום." : "נוצרו " + result.publications + " פרסומים.");
            } catch (cause) {
              setError(cause instanceof Error ? cause.message : "לא ניתן להפעיל את הבריף כעת.");
            } finally {
              setBriefingRunning(false);
            }
          }}
        >
          {briefingRunning ? "מפעיל…" : "הפעל בריף עכשיו"}
        </button>
      </section>
      <button className={styles.secondary} type="button" onClick={async () => { await auth.signOut(); router.replace("/admin/login"); router.refresh(); }}>
        יציאה
      </button>
    </>
  );
}
