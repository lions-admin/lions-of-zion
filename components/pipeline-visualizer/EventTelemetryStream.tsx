"use client";

import React from "react";
import type { SimulationEventLog } from "./types";
import styles from "./visualizer.module.css";

interface EventTelemetryStreamProps {
  eventLogs: SimulationEventLog[];
  activeStepNodeName?: string;
}

export function EventTelemetryStream({
  eventLogs,
  activeStepNodeName,
}: EventTelemetryStreamProps) {
  return (
    <div className={styles.telemetryConsole} dir="rtl">
      {/* ── שורת סטטוס ומדדים ──
          Every figure that used to sit here was invented: a Jerusalem wall
          clock frozen at 07:04:12, an outbox depth, and a dollar spend to
          three decimal places. None of them came from anywhere — this console
          is fed by `usePipelineSimulation`, which reads a script. They now
          state what the architecture *guarantees*, which is true whether or
          not anything is running, and the badge says plainly that the run is
          a simulation. */}
      <div className={styles.telemetryHeader}>
        <div className={styles.telemetryMetricsRow}>
          <div className={styles.metricBadge}>
            <span className={styles.metricDot} />
            <span>הדמיה מתוסרטת — אינה טלמטריה חיה</span>
          </div>
          <div>שלב נוכחי: {activeStepNodeName || "המתנה לתחילת הרצה"}</div>
        </div>

        <div className={styles.telemetryMetricsRow} dir="ltr">
          <div>OUTBOX: TRANSACTIONAL</div>
          <div>RLS: ENFORCED</div>
          <div>AI BUDGET: CAPPED</div>
        </div>
      </div>

      {/* ── זרם אירועים ויומן חי ── */}
      <div className={styles.logStreamContainer}>
        {eventLogs.length === 0 ? (
          <div className={styles.logEmpty}>ממתין לפעימות הדמיה…</div>
        ) : (
          eventLogs.map((log) => {
            const levelClass =
              log.level === "error"
                ? styles.logLevelError
                : log.level === "warn"
                  ? styles.logLevelWarn
                  : log.level === "success"
                    ? styles.logLevelSuccess
                    : styles.logLevelInfo;

            const levelHe =
              log.level === "error"
                ? "שגיאה/פסילה"
                : log.level === "warn"
                  ? "אזהרה"
                  : log.level === "success"
                    ? "הצלחה"
                    : "מידע";

            return (
              <div key={log.id} className={styles.logRow}>
                <span className={styles.logTimestamp} dir="ltr">[{log.timestamp}]</span>
                <span className={levelClass}>[{levelHe}]</span>
                <span className={styles.logNode}>[{log.nodeName}]</span>
                <span className={styles.logMessage}>{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
