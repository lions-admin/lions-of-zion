"use client";

import { useCallback, useEffect, useState } from "react";
import { createAuthClient } from "@neondatabase/auth/next";
import { useRouter } from "next/navigation";
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

const auth = createAuthClient();

export function AdminStatus() {
  const router = useRouter();
  const [status, setStatus] = useState<Status | null>(null);
  const [userCount, setUserCount] = useState<UserCount | null>(null);
  const [briefing, setBriefing] = useState<BriefingStatus | null>(null);
  const [deepHealth, setDeepHealth] = useState<DeepHealth | null>(null);
  const [busy, setBusy] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    const responses = await Promise.all([
      fetch("/api/v1/admin/status", { cache: "no-store" }),
      fetch("/api/v1/admin/user-count", { cache: "no-store" }),
      fetch("/api/v1/admin/briefing", { cache: "no-store" }),
    ]);
    if (responses.some((response) => !response.ok)) throw new Error("לא ניתן לטעון את מצב המערכות.");
    const [nextStatus, nextCount, nextBriefing] = await Promise.all(responses.map((response) => response.json()));
    setStatus(nextStatus as Status); setUserCount(nextCount as UserCount); setBriefing(nextBriefing as BriefingStatus);
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => { void load().catch((cause: Error) => setError(cause.message)); }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  if (error && !status) return <p className={styles.error} role="alert">{error}</p>;
  if (!status || !userCount || !briefing) return <p className={styles.muted}>טוען מצב…</p>;

  const totalAttempts = briefing.sources.reduce((sum, source) => sum + source.attempts, 0);
  const totalSuccess = briefing.sources.reduce((sum, source) => sum + source.successfulAttempts, 0);

  return (
    <>
      {error ? <p className={styles.error} role="alert">{error}</p> : null}
      {message ? <p className={styles.notice} role="status">{message}</p> : null}

      <div className={styles.summary}>
        <Metric label="סביבה" value={status.environment} /><Metric label="אזור תורים" value={status.region} />
        <Metric label="תקרת בריף חודשית" value={`$${status.aiBudgetUsd.toFixed(2)}`} /><Metric label="משתמשים רשומים" value={String(userCount.registeredUsers)} />
        <Metric label="ניסיונות איסוף בשבוע" value={String(totalAttempts)} /><Metric label="איסופים מוצלחים בשבוע" value={String(totalSuccess)} />
        <Metric label="ראיות ממתינות" value={String(briefing.unprocessedEvidence)} /><Metric label="קבוצות סיפורים ביממה" value={String(briefing.clustersLast24Hours)} />
        <Metric label="ניסיונות חיפוש החודש" value={String(briefing.googleUsage.attemptsThisMonth)} /><Metric label="חיפושים מוצלחים החודש" value={String(briefing.googleUsage.successfulQueriesThisMonth)} />
        <Metric label="עלות חיפוש משוערת" value={briefing.googleUsage.estimatedSpendUsd === null ? "לא הוגדרה" : `$${briefing.googleUsage.estimatedSpendUsd.toFixed(4)}${briefing.googleUsage.monthlyBudgetUsd === null ? "" : ` / $${briefing.googleUsage.monthlyBudgetUsd.toFixed(2)}`}`} />
        <Metric label="פגיעות מטמון ציבורי" value={status.publicReadCache.hitRatio === null ? "אין נתונים" : `${(status.publicReadCache.hitRatio * 100).toFixed(1)}% · ${status.publicReadCache.averageLoadMs ?? 0}ms`} />
        <Metric label="תוצאות גולמיות ביממה" value={String(briefing.pipelineCounts.rawResults)} /><Metric label="תוצאות ייחודיות ביממה" value={String(briefing.pipelineCounts.uniqueResults)} />
        <Metric label="ראיות שהועשרו ביממה" value={String(briefing.pipelineCounts.enrichedEvidence)} /><Metric label="טענות שחולצו ביממה" value={String(briefing.pipelineCounts.extractedClaims)} />
        <Metric label="נפח חומר גלם ב־30 יום" value={`${(briefing.pipelineCounts.rawBytes30d / 1024 / 1024).toFixed(2)} MB`} />
      </div>

      <section className={styles.panel}>
        <p className={styles.sectionLabel}>זיהוי משאבים</p>
        <p className={styles.muted}>טביעות חד־כיווניות בלבד להשוואה בין סביבות; לא מוצגים כאן סודות או מזהים מלאים.</p>
        <div className={styles.compactMetrics}>
          {Object.entries(status.resourceFingerprints ?? {}).map(([name, fingerprint]) => (
            <Metric key={name} label={name} value={fingerprint ?? "לא מוגדר"} />
          ))}
        </div>
      </section>

      <section className={styles.controlBar}>
        <div><p className={styles.sectionLabel}>בקרת פרסום</p><h2>{briefing.automaticPublicationPaused ? "הפרסום האוטומטי מושהה" : "הפרסום האוטומטי פעיל"}</h2><p className={styles.muted}>האיסוף והעיבוד ממשיכים בנפרד. השהיה זו אינה עוצרת אותם.</p></div>
        <div className={styles.actionRow}>
          <span className={styles.ok}>כניסה עם Google פעילה</span>
          <button className={briefing.automaticPublicationPaused ? styles.primary : styles.secondary} type="button" disabled={busy !== null} onClick={() => mutateControl(!briefing.automaticPublicationPaused)}>
            {briefing.automaticPublicationPaused ? "הפעל פרסום אוטומטי" : "השהה פרסום אוטומטי"}
          </button>
          {!briefing.automaticPublicationPaused ? <button className={styles.primary} type="button" disabled={busy !== null} onClick={resumePausedEdition}>פרסם את מהדורת היום שאושרה</button> : null}
        </div>
      </section>

      <section className={styles.panel}>
        <p className={styles.sectionLabel}>סכימת מסד הנתונים</p>
        <p className={styles.muted}>{briefing.migration.available ? `מיגרציות שהוחלו: ${briefing.migration.applied} · גרסה אחרונה: ${briefing.migration.latestId ?? "לא ידועה"}${briefing.migration.latestAppliedAt ? ` · ${formatDate(briefing.migration.latestAppliedAt)}` : ""}` : "מצב המיגרציות אינו זמין בסביבה זו."}</p>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}>
          <div><p className={styles.sectionLabel}>צינור יומי</p><h2>ריצות, תורים ועלויות</h2></div>
          <div className={styles.actionRow}><button className={styles.secondary} type="button" disabled={busy !== null} onClick={runDeepHealth}>בדיקת תקינות עמוקה</button><button className={styles.secondary} type="button" disabled={busy !== null} onClick={syncRssCatalog}>עדכן כתובות מקורות</button><button className={styles.primary} type="button" disabled={busy !== null} onClick={runBriefing}>הפעל עיבוד עכשיו</button></div>
        </div>
        <div className={styles.compactMetrics}>
          <Metric label="עלות ביממה" value={`$${briefing.spend.last24HoursUsd.toFixed(4)}`} /><Metric label="עלות בשלושים יום" value={`$${briefing.spend.last30DaysUsd.toFixed(4)}`} />
          <Metric label="כשלים בשבוע" value={String(briefing.failedRuns)} /><Metric label="הסגר פתוח" value={String(briefing.quarantine.length)} />
        </div>
        {deepHealth ? <div className={styles.healthStrip}>{Object.entries(deepHealth.checks).map(([name, check]) => <span key={name} className={check.status === "ok" ? styles.ok : styles.wait}>{name} · {check.status} · {check.latencyMs}ms</span>)}</div> : null}
        <div className={styles.queueRow}>{briefing.jobs.map((job) => <span key={job.state}><strong>{job.count}</strong> {job.state}</span>)}</div>
      </section>

      <section className={styles.panel}>
        <div className={styles.panelHead}><div><p className={styles.sectionLabel}>מקורות</p><h2>תקינות ותפוקה בשבעת הימים האחרונים</h2></div></div>
        <div className={styles.tableWrap}><table className={styles.table}>
          <thead><tr><th>מקור</th><th>סוג</th><th>מצב</th><th>ניסיונות</th><th>הצלחות</th><th>נמצאו</th><th>חדשים</th><th>הצלחה אחרונה</th><th>פעולה</th></tr></thead>
          <tbody>{briefing.sources.map((source) => <tr key={source.id}>
            <td><strong>{source.name}</strong>{source.disabledReason || source.verificationError ? <small>{source.disabledReason ?? source.verificationError}</small> : null}</td><td>{source.kind}</td>
            <td><span className={source.active && source.consecutiveFailures === 0 ? styles.ok : styles.wait}>{source.active ? `${source.consecutiveFailures} כשלים` : "מושבת"}</span></td>
            <td>{source.attempts}</td><td>{source.successfulAttempts}</td><td>{source.itemsSeen}</td><td>{source.itemsNew}</td><td>{source.lastSuccessfulFetchAt ? formatDate(source.lastSuccessfulFetchAt) : "—"}</td>
            <td>{["rss", "api", "agent_search"].includes(source.kind) && !source.active ? <button className={styles.secondary} type="button" disabled={busy !== null} onClick={() => verifySource(source)}>בדוק והפעל</button> : "—"}</td>
          </tr>)}</tbody>
        </table></div>
      </section>

      <section className={styles.twoColumns}>
        <div className={styles.panel}><p className={styles.sectionLabel}>ריצות אחרונות</p><ul className={styles.logList}>{briefing.runs.map((run) => <li key={run.id}><span className={run.status === "completed" ? styles.ok : styles.wait}>{run.status}</span><strong>{run.localDate} · {run.stage}</strong><small>{run.inputCount} ← {run.outputCount}{run.error ? ` · ${run.error}` : ""}</small></li>)}</ul></div>
        <div className={styles.panel}><p className={styles.sectionLabel}>הסגר איכות</p>{briefing.quarantine.length ? <ul className={styles.logList}>{briefing.quarantine.map((entry) => <li key={entry.id}><span className={styles.wait}>{entry.stage}</span><strong>{entry.candidateKey}</strong><small>{entry.reason}</small></li>)}</ul> : <p className={styles.muted}>אין פריטים בהסגר.</p>}</div>
      </section>

      <section className={styles.twoColumns}>
        <div className={styles.panel}><p className={styles.sectionLabel}>מגמות נרטיבים</p>{briefing.narrativeTrends.length ? <ul className={styles.logList}>{briefing.narrativeTrends.map((entry) => <li key={entry.id}><span className={styles.wait}>{entry.status}</span><strong>{entry.title}</strong><small>{entry.observationCount} תצפיות{entry.lastSeenAt ? ` · ${formatDate(entry.lastSeenAt)}` : ""}</small></li>)}</ul> : <p className={styles.muted}>אין מגמות פעילות.</p>}</div>
        <div className={styles.panel}><p className={styles.sectionLabel}>התראות תפעוליות</p>{briefing.alerts.length ? <ul className={styles.logList}>{briefing.alerts.map((entry) => <li key={entry.id}><span className={entry.severity === "critical" ? styles.wait : styles.ok}>{entry.severity}</span><strong>{entry.kind}</strong><small>{entry.message} · {entry.notifiedAt ? "נשלחה" : "ממתינה"}</small></li>)}</ul> : <p className={styles.muted}>אין התראות פתוחות.</p>}</div>
      </section>

      <section className={styles.panel}><p className={styles.sectionLabel}>עלות לפי דגם ושלב</p><div className={styles.tableWrap}><table className={styles.table}><thead><tr><th>דגם</th><th>שלב</th><th>קריאות</th><th>עלות</th></tr></thead><tbody>{briefing.spend.byModel.map((entry) => <tr key={`${entry.model}:${entry.stage}`}><td>{entry.model}</td><td>{entry.stage}</td><td>{entry.calls}</td><td>${entry.costUsd.toFixed(4)}</td></tr>)}</tbody></table></div></section>

      <div className={styles.grid}>{Object.entries(status.integrations).map(([name, active]) => <article className={styles.service} key={name}><span className={active ? styles.ok : styles.wait}>{active ? "מוכן" : "ממתין"}</span><h2>{name}</h2></article>)}</div>
      <button className={styles.secondary} type="button" onClick={async () => { await auth.signOut(); router.replace("/admin/login"); router.refresh(); }}>יציאה</button>
    </>
  );

  async function mutateControl(paused: boolean) {
    setBusy("control"); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/briefing/control", { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ automaticPublicationPaused: paused }) });
      if (!response.ok) throw new Error("לא ניתן לעדכן את בקרת הפרסום.");
      await load(); setMessage(paused ? "הפרסום האוטומטי הושהה." : "הפרסום האוטומטי הופעל.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "הפעולה נכשלה."); } finally { setBusy(null); }
  }
  async function runBriefing() {
    setBusy("run"); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/briefing/run", { method: "POST" });
      if (!response.ok) throw new Error("לא ניתן להפעיל את העיבוד כעת.");
      const result = await response.json() as { status: string; jobId?: string; activeCollectionJobs?: number; recovery?: { dispatched: number; configurationRecovered?: number; processingResumed?: number } };
      await load();
      const recovered = result.recovery?.dispatched ?? 0;
      const repaired = result.recovery?.configurationRecovered ?? 0;
      const resumed = result.recovery?.processingResumed ?? 0;
      const recoveryMessage = recovered > 0
        ? `${repaired > 0 ? `${repaired} משימות שנחסמו בהגדרה תוקנו, ו־` : ""}${resumed > 0 ? `${resumed} משימות עיבוד שחיכו לשחרור חודשו, ו־` : ""}${recovered} משימות ממתינות שוגרו מחדש. `
        : "";
      setMessage(
        result.status === "queued"
          ? `${recoveryMessage}העיבוד נוסף לתור.`
          : result.status === "waiting_for_collection"
            ? `${recoveryMessage}העיבוד ממתין ל־${result.activeCollectionJobs ?? 0} משימות איסוף.`
            : "הריצה כבר הושלמה להיום.",
      );
    } catch (cause) { setError(cause instanceof Error ? cause.message : "הפעולה נכשלה."); } finally { setBusy(null); }
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
      if (!response.ok) throw new Error("לא ניתן להשלים את פרסום המהדורה.");
      await load();
      setMessage(
        result.status === "completed"
          ? `מהדורת היום פורסמה אוטומטית עם ${result.publications} פרסומים.`
          : result.status === "already_run"
            ? "מהדורת היום כבר פורסמה."
            : "אין מהדורה מאושרת להשלמה היום.",
      );
    } catch (cause) { setError(cause instanceof Error ? cause.message : "הפעולה נכשלה."); } finally { setBusy(null); }
  }
  async function runDeepHealth() {
    setBusy("health"); setError(null);
    try {
      const response = await fetch("/api/v1/admin/health/deep", { cache: "no-store" });
      if (!response.ok) throw new Error("בדיקת התקינות נכשלה.");
      setDeepHealth(await response.json() as DeepHealth);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "הפעולה נכשלה."); } finally { setBusy(null); }
  }
  async function syncRssCatalog() {
    setBusy("sync-rss-catalog"); setError(null); setMessage(null);
    try {
      const response = await fetch("/api/v1/admin/briefing/sources/sync", { method: "POST" });
      const result = await response.json() as { created?: number; updated?: number };
      if (!response.ok) throw new Error("לא ניתן לעדכן את כתובות המקורות.");
      await load();
      const changed = (result.created ?? 0) + (result.updated ?? 0);
      setMessage(changed
        ? `נוספו ${result.created ?? 0} מקורות ועודכנו ${result.updated ?? 0}; כולם נשארו מושבתים עד בדיקה חיה.`
        : "כתובות המקורות כבר מעודכנות.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "הפעולה נכשלה."); } finally { setBusy(null); }
  }
  async function verifySource(source: SourceHealth) {
    setBusy(`source:${source.id}`); setError(null); setMessage(null);
    try {
      const response = await fetch(`/api/v1/sources/${source.id}/fetch`, { method: "POST" });
      const result = await response.json() as { fetch?: { status?: string; itemsSeen?: number; errorMessage?: string | null }; evidenceCreated?: number; message?: string };
      if (!response.ok || result.fetch?.status !== "success" || !result.fetch.itemsSeen) {
        throw new Error(result.message || result.fetch?.errorMessage || "המקור לא החזיר הזנה תקינה ולכן נשאר מושבת.");
      }
      await load();
      setMessage(`המקור ${source.name} אומת והופעל עם ${result.fetch.itemsSeen} פריטים.`);
    } catch (cause) { setError(cause instanceof Error ? cause.message : "בדיקת המקור נכשלה."); } finally { setBusy(null); }
  }
}

function Metric({ label, value }: { label: string; value: string }) { return <div><span>{label}</span><strong>{value}</strong></div>; }
function formatDate(value: string) { return new Intl.DateTimeFormat("he-IL", { dateStyle: "short", timeStyle: "short" }).format(new Date(value)); }
