"use client";

import { PIPELINE_STAGES, type PipelineStageStatus } from "@/server/contracts/admin-console";
import { Pill } from "../console-primitives";
import { formatDate, formatDuration } from "../console-primitives";
import cmd from "../command.module.css";

/**
 * Pipeline flow: the seven stages as one connected run.
 *
 * DOM order is collect → publish and stays that way; under the console's
 * `dir="rtl"` the connectors mirror automatically, so a Hebrew reader
 * follows the flow right-to-left with no reordering code and no `order`
 * property. Each node carries its counts as pills (colour is never the
 * only cue — every pill keeps its word), and the raw `lastError` sits in
 * its own scrollable data block, visually separated from the explanation
 * around it. Active nodes pulse gently; `prefers-reduced-motion` stills
 * them. Nothing here is live-faked: every number is the wire value.
 */
export function PipelineFlow({
  stages,
  stageWord,
  pendingWord,
  runningWord,
  stuckWord,
  quarantinedWord,
  okWord,
  completedWord,
  averageWord,
  oldestPendingWord,
}: {
  stages: PipelineStageStatus[];
  stageWord: (stage: string) => string;
  pendingWord: string;
  runningWord: (count: number) => string;
  stuckWord: (count: number) => string;
  quarantinedWord: (count: number) => string;
  okWord: string;
  completedWord: string;
  averageWord: string;
  oldestPendingWord: string;
}) {
  return (
    <ol className={cmd.flow} aria-label="שלבי תהליך העיבוד">
      {PIPELINE_STAGES.map((stage) => {
        const cell = stages.find((entry) => entry.stage === stage);
        if (!cell) {
          return (
            <li key={stage} className={cmd.flowNode}>
              <h3 className={cmd.flowName}>{stageWord(stage)}</h3>
              <p className={cmd.flowMeta}>לא דווח.</p>
            </li>
          );
        }
        const stateClass = cell.quarantined
          ? cmd.flowDanger
          : cell.stuck
            ? cmd.flowWarn
            : cell.running
              ? cmd.flowActive
              : cell.pending === 0
                ? cmd.flowDone
                : "";
        return (
          <li key={stage} className={stateClass ? `${cmd.flowNode} ${stateClass}` : cmd.flowNode}>
            <h3 className={cmd.flowName}>{stageWord(stage)}</h3>
            <p className={cmd.flowMeta}>
              <bdi>{String(cell.pending)}</bdi> {pendingWord}
            </p>
            <p className={cmd.flowCounts}>
              {cell.running ? <Pill tone="gold">{runningWord(cell.running)}</Pill> : null}
              {cell.stuck ? <Pill tone="warn">{stuckWord(cell.stuck)}</Pill> : null}
              {cell.quarantined ? <Pill tone="danger">{quarantinedWord(cell.quarantined)}</Pill> : null}
              {!cell.running && !cell.stuck && !cell.quarantined ? <Pill tone="ok">{okWord}</Pill> : null}
            </p>
            <p className={cmd.flowMeta}>
              {completedWord} <bdi>{String(cell.completed24h)}</bdi> · {averageWord}{" "}
              <bdi>{formatDuration(cell.averageDurationMs)}</bdi>
            </p>
            <p className={cmd.flowMeta}>
              {oldestPendingWord}: {cell.oldestPendingAt ? formatDate(cell.oldestPendingAt) : "—"}
            </p>
            {cell.lastError ? (
              <details className={cmd.flowError}>
                <summary>שגיאה אחרונה</summary>
                <p className={cmd.flowErrorBody} dir="ltr">
                  {cell.lastError}
                </p>
              </details>
            ) : null}
          </li>
        );
      })}
    </ol>
  );
}
