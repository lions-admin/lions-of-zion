"use client";

import { useRef, useState } from "react";
import {
  PIPELINE_ROUTES,
  SYSTEM_NODES,
  SYSTEM_STAGES,
  type SystemNodeId,
} from "./pipeline-data";
import styles from "../information-war-system.module.css";
import { Icon } from "@/components/ui/Icon";

/**
 * The architecture, opened up — reader-driven.
 *
 * It used to drive itself: a 4.8s `setInterval` stepped the journey while the
 * plate was in view, with a play/pause pair, a reduced-motion listener, a
 * visibility check and an `IntersectionObserver` all present to keep that one
 * clock honest. Two autoplaying machines plus two infinite packet loops shared
 * this page. The clock is gone (2026-09-16): the first step of the first
 * journey is revealed on arrival and the reader moves through it — previous,
 * next, or straight to any of the nine parts. Nothing moves on its own, so
 * there is nothing to pause, nothing to announce and no motion to suppress.
 *
 * The journey chooser is a `role="tablist"`. It was four `aria-pressed`
 * buttons, which describes four independent toggles; exactly one journey is
 * ever shown.
 */
export function PipelineTrace() {
  const [routeIndex, setRouteIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [selected, setSelected] = useState<SystemNodeId | null>(null);
  const tabs = useRef<(HTMLButtonElement | null)[]>([]);

  const route = PIPELINE_ROUTES[routeIndex];
  const current = route.steps[position];
  const node = SYSTEM_NODES.find((entry) => entry.id === (selected ?? current))!;

  function chooseRoute(index: number) {
    setRouteIndex(index);
    setPosition(0);
    setSelected(null);
  }

  /* Roving focus, the arrow-key contract a tablist owes (WAI-ARIA). */
  function onTabKeyDown(event: React.KeyboardEvent, index: number) {
    const last = PIPELINE_ROUTES.length - 1;
    const next =
      event.key === "ArrowRight" || event.key === "ArrowDown" ? (index === last ? 0 : index + 1)
      : event.key === "ArrowLeft" || event.key === "ArrowUp" ? (index === 0 ? last : index - 1)
      : event.key === "Home" ? 0
      : event.key === "End" ? last
      : -1;
    if (next < 0) return;
    event.preventDefault();
    chooseRoute(next);
    tabs.current[next]?.focus();
  }

  function advance(delta: number) {
    setSelected(null);
    setPosition((p) => (p + delta + route.steps.length) % route.steps.length);
  }

  return (
    <figure className={styles.trace}>
      <figcaption className={styles.traceTopline}>
        <span className={styles.kicker}>The system, opened up</span>
        <span className={styles.meta}>Interactive explanation · not live telemetry</span>
      </figcaption>

      <div className={styles.traceRoutes} role="tablist" aria-label="Choose a system journey">
        {PIPELINE_ROUTES.map((option, index) => (
          <button
            key={option.id}
            ref={(element) => { tabs.current[index] = element; }}
            type="button"
            role="tab"
            id={`journey-tab-${option.id}`}
            aria-selected={routeIndex === index}
            aria-controls="journey-panel"
            tabIndex={routeIndex === index ? 0 : -1}
            onKeyDown={(event) => onTabKeyDown(event, index)}
            onClick={() => chooseRoute(index)}
          >
            <span className={styles.stepMark} aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>
            {option.name}
          </button>
        ))}
      </div>

      <div
        className={styles.tracePanel}
        role="tabpanel"
        id="journey-panel"
        aria-labelledby={`journey-tab-${route.id}`}
        tabIndex={-1}
      >
        <p className={styles.traceSubject}>{route.subject}</p>

        <div className={styles.stepper}>
          <button type="button" onClick={() => advance(-1)} aria-label="Previous step">
            <Icon name="arrow-left" size={16} />
          </button>
          <span className={styles.stepCount}>
            Step {position + 1} / {route.steps.length}
          </span>
          <button type="button" onClick={() => advance(1)} aria-label="Next step">
            <Icon name="arrow-right" size={16} />
          </button>
        </div>

        {/* All nine, at every width. Off-route parts are dimmed, never hidden. */}
        <div className={styles.ledger}>
          {SYSTEM_STAGES.map((stage) => (
            <div key={stage.id} className={styles.stage}>
              <h4 className={styles.stageName}>{stage.number} / {stage.name}</h4>
              <ul>
                {SYSTEM_NODES.filter((entry) => entry.stage === stage.id).map((entry) => {
                  const step = route.steps.indexOf(entry.id);
                  return (
                    <li key={entry.id}>
                      <button
                        type="button"
                        className={styles.mapNode}
                        data-on-route={step !== -1}
                        aria-pressed={node.id === entry.id}
                        aria-controls="node-inspector"
                        onClick={() => {
                          setSelected(entry.id);
                          if (step !== -1) setPosition(step);
                        }}
                      >
                        <span className={styles.nodeMark} aria-hidden="true">
                          {step !== -1 ? String(step + 1).padStart(2, "0") : "—"}
                        </span>
                        <span>
                          <strong>{entry.name}</strong>
                          <small>{entry.label}</small>
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </div>

        <section className={styles.inspector} id="node-inspector" aria-label="Selected system node">
          <span className={styles.kicker}>Inside this step</span>
          <h4>{node.name}</h4>
          <p>{node.detail}</p>
          <dl>
            <div><dt className={styles.termLabel}>Receives</dt><dd>{node.input}</dd></div>
            <div><dt className={styles.termLabel}>Produces</dt><dd>{node.output}</dd></div>
          </dl>
        </section>

        <p className={styles.routeNote}>{route.note}</p>
      </div>

      <details className={styles.textAlternative}>
        <summary>Read every journey as plain text</summary>
        {PIPELINE_ROUTES.map((entry) => (
          <div key={entry.id}>
            <h4>{entry.name}</h4>
            <ol>
              {entry.steps.map((id) => (
                <li key={id}>{SYSTEM_NODES.find((n) => n.id === id)!.name}</li>
              ))}
            </ol>
            <p>{entry.note}</p>
          </div>
        ))}
      </details>
    </figure>
  );
}
