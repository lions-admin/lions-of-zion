"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import { PIPELINE_ROUTES, SYSTEM_EDGES, SYSTEM_NODES, type SystemNodeId } from "./pipeline-data";
import styles from "../information-war-system.module.css";

export function PipelineTrace() {
  const [routeIndex, setRouteIndex] = useState(0);
  const [position, setPosition] = useState(0);
  const [selected, setSelected] = useState<SystemNodeId | null>(null);
  const [playing, setPlaying] = useState(true);
  const [reduced, setReduced] = useState(false);
  const [visible, setVisible] = useState(false);
  const host = useRef<HTMLDivElement>(null);
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

  return (
    <div className={styles.trace} ref={host} data-playing={playing && !reduced && visible}>
      <div className={styles.traceTopline}>
        <span className={styles.eyebrow}>The system, opened up</span>
        <span className={styles.diagramLabel}>Interactive explanation · not live telemetry</span>
      </div>
      <div className={styles.traceRoutes} role="group" aria-label="Choose a system journey">
        {PIPELINE_ROUTES.map((option, index) => (
          <button key={option.id} type="button" aria-pressed={routeIndex === index}
            onClick={() => { setRouteIndex(index); setPosition(0); setSelected(null); setPlaying(false); }}>
            <span aria-hidden="true">{String(index + 1).padStart(2, "0")}</span>{option.name}
          </button>
        ))}
      </div>
      <div className={styles.playback}>
        <p>{route.subject}</p>
        <div role="group" aria-label="Journey playback">
          <button type="button" onClick={() => advance(-1)} aria-label="Previous step">←</button>
          <button type="button" disabled={reduced} onClick={() => { setSelected(null); setPlaying((p) => !p); }}
            aria-label={playing && !reduced ? "Pause journey" : "Play journey"}>{playing && !reduced ? "Pause" : "Play"}</button>
          <span className={styles.stepCount}>{position + 1} / {route.steps.length}</span>
          <button type="button" onClick={() => advance(1)} aria-label="Next step">→</button>
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
      <section className={styles.inspector} id="node-inspector" aria-label="Selected system node" aria-live={playing && !reduced ? "off" : "polite"}>
        <div><span className={styles.eyebrow}>Inside this step</span><h3>{node.name}</h3></div>
        <p>{node.detail}</p>
        <dl><dt>Receives</dt><dd>{node.input}</dd><dt>Produces</dt><dd>{node.output}</dd></dl>
      </section>
      <p className={styles.routeNote}>{route.note}</p>
      <details className={styles.textAlternative}>
        <summary>Read every journey without the animation</summary>
        {PIPELINE_ROUTES.map((entry) => <div key={entry.id}><h3>{entry.name}</h3>
          <ol>{entry.steps.map((id) => <li key={id}>{SYSTEM_NODES.find((n) => n.id === id)!.name}</li>)}</ol><p>{entry.note}</p></div>)}
      </details>
    </div>
  );
}
