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
      {/* ── שורת סטטוס ומדדים מבצעיים ── */}
      <div className={styles.telemetryHeader}>
        <div className={styles.telemetryMetricsRow}>
          <div className={styles.metricBadge}>
            <span className={styles.metricDot} />
            <span>מצב מנוע: פעיל ותקין</span>
          </div>
          <div>שעון ירושלים: 07:04:12</div>
          <div>שלב נוכחי: {activeStepNodeName || "המתנה לתחילת הרצה"}</div>
        </div>

        <div className={styles.telemetryMetricsRow} dir="ltr">
          <div>OUTBOX PENDING: 0</div>
          <div>RLS: ENFORCED</div>
          <div>AI BUDGET: $0.024 / $50.00</div>
        </div>
      </div>

      {/* ── זרם אירועים ויומן חי ── */}
      <div className={styles.logStreamContainer}>
        {eventLogs.length === 0 ? (
          <div style={{ color: "var(--ink-lo, #88837b)" }}>ממתין לפעימות הדמיה…</div>
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
                <span style={{ color: "var(--gold-hi, #ead39b)" }}>[{log.nodeName}]</span>
                <span className={styles.logMessage}>{log.message}</span>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
