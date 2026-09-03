"use client";

import { useId, useState } from "react";
import { Button } from "@/components/ui/Button";
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
  /* Collapsible because it is the region a short viewport can most afford
     to lose. At 1024×768 the stage, the explainer and this console are
     competing for 768 pixels; folding the log gives the map back its
     height without taking anything away permanently. */
  const [isExpanded, setIsExpanded] = useState<boolean>(true);
  const bodyId = useId();

  return (
    <section
      className={styles.telemetryConsole}
      aria-label={CHROME.regionTelemetry}
      data-expanded={isExpanded ? "" : undefined}
    >
      {/* Every figure that used to sit here was invented: a Jerusalem wall
          clock frozen at 07:04:12, an outbox depth, and a dollar spend to
          three decimal places. None of them came from anywhere — this console
          is fed by `usePipelineSimulation`, which reads a script. They now
          state what the architecture *guarantees*, which is true whether or
          not anything is running, and the badge says plainly that the run is
          a simulation. */}
      <div className={styles.telemetryHeader}>
        <div className={styles.telemetryMetricsRow}>
          <span className={styles.metricBadge}>
            <span className={styles.metricDot} aria-hidden="true" />
            <span>{CHROME.telemetrySimulated}</span>
          </span>
          <span>
            {CHROME.currentStep}: {activeStepNodeName || CHROME.waitingToStart}
          </span>
        </div>

        <div className={styles.telemetryMetricsRow}>
          <span className={styles.telemetryGuarantee}>OUTBOX: TRANSACTIONAL</span>
          <span className={styles.telemetryGuarantee}>RLS: ENFORCED</span>
          <span className={styles.telemetryGuarantee}>AI BUDGET: CAPPED</span>

          <Button
            type="button"
            variant="toolbar"
            size="sm"
            onClick={() => setIsExpanded((prev) => !prev)}
            aria-expanded={isExpanded}
            aria-controls={bodyId}
            title={isExpanded ? CHROME.telemetryCollapse : CHROME.telemetryExpand}
          >
            <span aria-hidden="true">{isExpanded ? "▼" : "▲"}</span>
            {isExpanded ? CHROME.collapse : CHROME.expand}
          </Button>
        </div>
      </div>

      {isExpanded ? (
        <div id={bodyId} className={styles.logStreamContainer}>
          {eventLogs.length === 0 ? (
            <p className={styles.logEmpty}>{CHROME.logEmpty}</p>
          ) : (
            <ol className={styles.logList}>
              {eventLogs.map((log) => {
                const levelClass =
                  log.level === "error"
                    ? styles.logLevelError
                    : log.level === "warn"
                      ? styles.logLevelWarn
                      : log.level === "success"
                        ? styles.logLevelSuccess
                        : styles.logLevelInfo;

                return (
                  <li key={log.id} className={styles.logRow}>
                    <span className={styles.logTimestamp}>[{log.timestamp}]</span>
                    <span className={levelClass}>[{CHROME.logLevel[log.level]}]</span>
                    <span className={styles.logNode}>[{log.nodeName}]</span>
                    <span className={styles.logMessage}>{log.message}</span>
                  </li>
                );
              })}
            </ol>
          )}
        </div>
      ) : null}
    </section>
  );
}
