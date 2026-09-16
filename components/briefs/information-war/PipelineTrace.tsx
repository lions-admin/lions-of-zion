"use client";

import { useEffect, useRef, useState, type CSSProperties, type KeyboardEvent } from "react";
import { PIPELINE_ROUTES, SYSTEM_EDGES, SYSTEM_NODES, type SystemNodeId } from "./pipeline-data";
import { Icon } from "@/components/ui/Icon";
import { liveWhenIdle } from "@/components/ui/live-region";
import styles from "../information-war-system.module.css";

/**
 * The architecture, opened up — and stopped until the reader starts it.
 *
 * Two changes from the autoplaying explainer this was (2026-09-17, Midnight
 * Signal workstream G):
 *
 * - **Default paused.** The machine no longer advances on its own; the first
 *   step of the chosen journey is revealed and waits. The Play control is
 *   still there — the journey is an explainer, and a reader who wants to be
 *   walked through it can start it — but nothing moves on this page that the
 *   reader did not ask to move.
 * - **The route chooser is a real tab strip.** It was four toggle-styled
 *   buttons carrying `aria-pressed` on what is a single-select choice; it is
 *   a `tablist` now, with `aria-selected`, roving tab stops and arrow-key
   * movement, and the panel it drives is a `tabpanel`.
 */
export function PipelineTrace() {
  const [routeIndex, setRouteIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [selected, setSelected] = useState<SystemNodeId | null>(null);
  const [playing, setPlaying] = useState(false);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(false);
  const host = useRef<HTMLDivElement>(null);
  const tabRefs = useRef<Array<HTMLButtonElement | null>>([]);
  const route = PIPELINE_ROUTES[routeIndex];
  const current = route.steps[position];
  const node = SYSTEM_NODES.find((entry) => entry.id === (selected ?? current))!;
  // DOM order follows the selected journey, so mobile reading and keyboard
  // order match the visual flow. Absolute desktop positions are unchanged.
  const orderedNodes = [...SYSTEM_NODES].sort((a, b) => {
    const rank = (id: SystemNodeId) => {
      const index = route.steps.indexOf(id);
      return index === -1 ? SYSTEM_NODES.length : index;
    };
    return rank(a.id) - rank(b.id);
  });

  useEffect(() => {
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    const update = () => setReduced(preference.matches);
    update();
    preference.addEventListener("change", update);
    const observer = new IntersectionObserver(([entry]) => setVisible(entry.isIntersecting), { threshold: 0.15 });
    if (host.current) observer.observe(host.current);
    return () => { observer.disconnect(); preference.removeEventListener("change", update); };
  }, []);

  useEffect(() => {
    if (!playing || reduced || !visible) return;
    const timer = window.setInterval(() => {
      if (!document.hidden) setPosition((p) => (p + 1) % route.steps.length);
    }, 4800);
    return () => window.clearInterval(timer);
  }, [playing, reduced, visible, route.steps.length]);

  function advance(delta: number) {
    setPlaying(false);
    setSelected(null);
    setPosition((p) => (p + delta + route.steps.length) % route.steps.length);
  }

  function chooseRoute(index: number) {
    setRouteIndex(index);
    setPosition(0);
    setSelected(null);
    setPlaying(false);
  }

  /* Roving tab stop: the selected tab is the one stop, and the arrow keys
     move both selection and focus in one action. */
  function onTabKeys(event: KeyboardEvent<HTMLDivElement>) {
    const last = PIPELINE_ROUTES.length - 1;
    let next: number | null = null;
    if (event.key === "ArrowRight") next = routeIndex === last ? 0 : routeIndex + 1;
    else if (event.key === "ArrowLeft") next = routeIndex === 0 ? last : routeIndex - 1;
    else if (event.key === "Home") next = 0;
    else if (event.key === "End") next = last;
    if (next === null) return;
    event.preventDefault();
    chooseRoute(next);
    tabRefs.current[next]?.focus();
  }

  return (
    <div className={styles.trace} ref={host} data-playing={playing && !reduced && visible}>
      <div className={styles.traceTopline}>
        <span className={styles.eyebrow}>The system, opened up</span>
        <span className={styles.diagramLabel}>Interactive explanation · not live telemetry</span>
      </div>
      <div className={styles.traceRoutes} role="tablist" aria-label="Choose a system journey" onKeyDown={onTabKeys}>
        {PIPELINE_ROUTES.map((option, index) => (
          <button key={option.id} type="button" role="tab" id={`system-route-${option.id}`}
            aria-selected={routeIndex === index} tabIndex={routeIndex === index ? 0 : -1}
            ref={(node) => { tabRefs.current[index] = node; }}
            onClick={() => { chooseRoute(index); }}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{option.name}
          </button>
        ))}
      </div>
      {/* What the tab strip drives: the journey's subject, its highlighted
          steps on the canvas, its note. One `tabpanel`, one `aria-controls`
          per tab — the nine node buttons keep their own `aria-controls`
          pointing at the inspector. */}
      <div id="system-route-panel" role="tabpanel" aria-labelledby={`system-route-${route.id}`}>
        <div className={styles.playback}>
          <p>{route.subject}</p>
          <div role="group" aria-label="Journey playback">
            <button type="button" onClick={() => advance(-1)} aria-label="Previous step"><Icon name="arrow-left" size={16} /></button>
            <button type="button" disabled={reduced} onClick={() => { setSelected(null); setPlaying((p) => !p); }}
              aria-label={playing && !reduced ? "Pause journey" : "Play journey"}>{playing && !reduced ? "Pause" : "Play"}</button>
            <span className={styles.stepCount}>{position + 1} / {route.steps.length}</span>
            <button type="button" onClick={() => advance(1)} aria-label="Next step"><Icon name="arrow-right" size={16} /></button>
          </div>
        </div>
        <div className={styles.mapColumns} aria-hidden="true"><span>01 / Material in</span><span>02 / Work on the evidence</span><span>03 / Public access</span></div>
        <div className={styles.systemCanvas} role="group" aria-label="System architecture. Select a node to inspect it.">
          <svg viewBox="0 0 1000 550" preserveAspectRatio="none" className={styles.connectors} aria-hidden="true">
            {SYSTEM_EDGES.map((edge) => {
              const start = route.steps.indexOf(edge.from);
              const onRoute = start !== -1 && route.steps[start + 1] === edge.to;
              return <g key={`${edge.from}-${edge.to}`} data-on-route={onRoute} data-current={onRoute && current === edge.from}>
                <path d={edge.path} className={styles.wire} />
                {onRoute && <path d={edge.path} className={styles.packet} />}
              </g>;
            })}
          </svg>
          {orderedNodes.map((entry) => {
            const step = route.steps.indexOf(entry.id);
            return <button key={entry.id} type="button" className={styles.mapNode}
              style={{ "--node-x": `${entry.x / 10}%`, "--node-y": `${entry.y / 5.5}%`, "--node-order": step } as CSSProperties}
              data-on-route={step !== -1} data-active={node.id === entry.id} data-last={step === route.steps.length - 1}
              aria-pressed={node.id === entry.id} aria-controls="node-inspector"
              onClick={() => { setPlaying(false); setSelected(entry.id); if (step !== -1) setPosition(step); }}>
              <span className={styles.nodeMark} aria-hidden="true">{step !== -1 ? String(step + 1).padStart(2, "0") : "·"}</span>
              <strong>{entry.name}</strong><small>{entry.label}</small>
            </button>;
          })}
        </div>
        <section className={styles.inspector} id="node-inspector" aria-label="Selected system node" {...liveWhenIdle(playing && !reduced)}>
          <div><span className={styles.eyebrow}>Inside this step</span><h3>{node.name}</h3></div>
          <p>{node.detail}</p>
          <dl><dt>Receives</dt><dd>{node.input}</dd><dt>Produces</dt><dd>{node.output}</dd></dl>
        </section>
        <p className={styles.routeNote}>{route.note}</p>
      </div>
      <details className={styles.textAlternative}>
        <summary>Read every journey without the animation</summary>
        {PIPELINE_ROUTES.map((entry) => <div key={entry.id}><h3>{entry.name}</h3>
          <ol>{entry.steps.map((id) => <li key={id}>{SYSTEM_NODES.find((n) => n.id === id)!.name}</li>)}</ol><p>{entry.note}</p></div>)}
      </details>
    </div>
  );
}
