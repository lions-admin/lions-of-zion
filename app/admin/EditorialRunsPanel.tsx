"use client";

import { useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { ConfirmDialog, type ConfirmIntent } from "./ConfirmDialog";
import {
  AreaHead,
  ConsoleNotices,
  EmptyLine,
  InlineAbsence,
  Metric,
  PanelTitle,
  Pill,
  formatDate,
  useOperations,
} from "./console-primitives";
import { callConsole, useConsoleRead } from "./useConsoleRead";
import styles from "./admin.module.css";

type EditorialOperation = {
  id: string;
  operationKey: string;
  status: "pending" | "running" | "completed" | "failed";
  stage: string;
  artifact: { media?: unknown } | null;
  result: { url?: string } | null;
  failure: { message?: string } | null;
};

type EditorialRun = {
  id: string;
  runKey: string;
  mode: "daily" | "operations";
  status: "queued" | "running" | "completed" | "partial" | "failed";
  stage: string;
  failure: { message?: string; recovery?: string } | null;
  report: Record<string, unknown> | null;
  createdAt: string;
  startedAt: string | null;
  finishedAt: string | null;
  operations: EditorialOperation[];
};

type EditorialRunList = { runs: EditorialRun[] };

const tone = (status: EditorialRun["status"] | EditorialOperation["status"]) =>
  status === "completed" ? "ok" : status === "failed" || status === "partial" ? "danger" : status === "running" ? "gold" : "neutral" as const;

/** Durable, source-visible work stays alongside the established publishing controls. */
export function EditorialRunsPanel({ signal }: { signal: number }) {
  const runs = useConsoleRead<EditorialRunList>("admin/editorial-update", { signal, pollInterval: 30_000 });
  const [confirmIntent, setConfirmIntent] = useState<ConfirmIntent | null>(null);
  const areaRef = useRef<HTMLElement | null>(null);
  const ops = useOperations();

  function requestDailyRun() {
    setConfirmIntent({
      action: "התחלת הרצת מערכת העריכה",
      target: "מחקר, עדכון ופרסום של האתר כולו",
      consequence: "ההרצה נשמרת מיד עם מזהה קבוע. כאשר קיימות פעולות מחקר מוכנות, היא יכולה להכין מדיה ולפרסם או לעדכן כתבות לפי המקורות שלה.",
      confirmLabel: "התחלת ההרצה",
      tone: "primary",
      run: startDailyRun,
    });
  }

  async function startDailyRun() {
    await ops.run("start-editorial-run", async () => {
      const result = await callConsole<{ id: string; status: string }>("admin/editorial-update", {
        method: "POST",
        body: { runId: `manual:${crypto.randomUUID()}`, mode: "daily", operations: [] },
        failure: "לא ניתן להתחיל את הרצת מערכת העריכה.",
      });
      runs.reload();
      return `ההרצה ${result.id} נרשמה במצב ${result.status}.`;
    });
  }

  async function resume(run: EditorialRun) {
    await ops.run(`resume:${run.id}`, async () => {
      const result = await callConsole<{ status: string }>(`admin/editorial-update/${run.id}`, {
        method: "POST",
        body: { action: "resume" },
        failure: "לא ניתן לחדש את ההרצה.",
      });
      runs.reload();
      return `ההרצה הוחזרה לתור במצב ${result.status}.`;
    });
  }

  return (
    <section className={styles.area} id="console-editorial-runs" aria-labelledby="console-editorial-runs-heading" ref={areaRef} tabIndex={-1}>
      <AreaHead id="console-editorial-runs" label="מערכת העריכה" title="מחקר, פרסום, מדיה ודוחות במקום אחד">
        <div className={styles.actionRow}>
          <Button variant="primary" type="button" disabled={ops.disabled} onClick={requestDailyRun}>התחלת הרצה עכשיו</Button>
        </div>
      </AreaHead>
      <p className={styles.muted}>השהיית הפרסום האוטומטי נשלטת באזור ״עיבוד ומהדורות״ ונבדקת גם לפני ההרצה המתוזמנת. כל ריצה כאן נשמרת, ניתנת לקריאה ולחידוש בלי לשכפל פרסום או מדיה שהושלמו.</p>
      <ConsoleNotices busy={ops.busy} notice={ops.notice} />
      <InlineAbsence state={runs.state} what="ריצות מערכת העריכה" reload={runs.reload} />
      {runs.value ? (
        runs.value.runs.length ? (
          <div className={styles.twoColumns}>
            {runs.value.runs.map(run => (
              <article className={styles.panel} key={run.id}>
                <PanelTitle note={run.runKey}>הרצה {run.mode === "daily" ? "יומית" : "מפורשת"}</PanelTitle>
                <div className={styles.compactMetrics}>
                  <Metric label="מצב" value={run.status} tone={tone(run.status)} />
                  <Metric label="שלב" value={run.stage} />
                  <Metric label="פעולות" value={String(run.operations.length)} />
                  <Metric label="נוצרה" value={formatDate(run.createdAt)} />
                </div>
                {run.failure ? <p className={styles.warnNote}>{run.failure.message}{run.failure.recovery ? ` · ${run.failure.recovery}` : ""}</p> : null}
                <ul className={styles.logList}>
                  {run.operations.map(operation => (
                    <li key={operation.id}>
                      <span><Pill tone={tone(operation.status)}>{operation.status}</Pill></span>
                      <strong>{operation.operationKey} · {operation.stage}</strong>
                      <small>
                        {operation.artifact?.media ? "מדיה נשמרה" : "מדיה טרם נשמרה"}
                        {operation.result?.url ? ` · ${operation.result.url}` : ""}
                        {operation.failure?.message ? ` · ${operation.failure.message}` : ""}
                      </small>
                    </li>
                  ))}
                </ul>
                {run.status === "failed" || run.status === "partial" ? (
                  <Button variant="secondary" type="button" disabled={ops.disabled} onClick={() => resume(run)}>חידוש ההרצה</Button>
                ) : null}
                {run.report ? (
                  <details className={styles.panel}>
                    <summary>הדוח השמור</summary>
                    <pre className={styles.json}>{JSON.stringify(run.report, null, 2)}</pre>
                  </details>
                ) : null}
              </article>
            ))}
          </div>
        ) : <EmptyLine>עדיין לא נשמרו ריצות של מערכת העריכה.</EmptyLine>
      ) : null}
      <ConfirmDialog intent={confirmIntent} onClose={() => setConfirmIntent(null)} fallbackFocusRef={areaRef} />
    </section>
  );
}
