"use client";

import type { SimulationEventLog } from "./types";
import { CHROME } from "./copy";
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
    <div className={styles.telemetryConsole}>
      {/* Every figure that used to sit here was invented: a Jerusalem wall
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
            <span>{CHROME.telemetrySimulated}</span>
          </div>
          <div>
            {CHROME.currentStep}: {activeStepNodeName || CHROME.waitingToStart}
          </div>
        </div>

        <div className={styles.telemetryMetricsRow}>
          <div>OUTBOX: TRANSACTIONAL</div>
          <div>RLS: ENFORCED</div>
          <div>AI BUDGET: CAPPED</div>
        </div>
      </div>

      <div className={styles.logStreamContainer}>
        {eventLogs.length === 0 ? (
          <div className={styles.logEmpty}>{CHROME.logEmpty}</div>
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

            return (
              <div key={log.id} className={styles.logRow}>
                <span className={styles.logTimestamp}>[{log.timestamp}]</span>
                <span className={levelClass}>[{CHROME.logLevel[log.level]}]</span>
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
