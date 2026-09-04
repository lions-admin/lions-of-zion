"use client";

/**
 * The pipeline, traced.
 *
 * One spine — the seven stages — and three routes across it. Choosing a route
 * lights the stages it touches and walks a packet down them; the steps it takes
 * at each stage are printed at that stage, so the explanation sits on the
 * diagram instead of beside it.
 *
 * This replaces four ordered lists that were the same journey under different
 * names. The reason it is one component and not four is in `pipeline-data.ts`.
 *
 * ## What is honest here
 *
 * The packet is an explanation of shape, not telemetry, and it must not be
 * mistaken for one. It carries no counts, no rates and no per-stage status —
 * that state is internal, and this page's standing rule is to draw nothing
 * rather than draw a number it cannot show. `aria-hidden` on the packet says
 * the same thing to a screen reader: the meaning is in the step text, which is
 * server-rendered for every route and present whether or not this runs.
 *
 * ## Motion
 *
 * It advances on its own only while it is on screen and only until the reader
 * takes over — the first route click stops the auto-advance for good, because
 * something that keeps moving after you have chosen is fighting you. Under
 * `prefers-reduced-motion` nothing advances and nothing transitions; the routes
 * still switch, which is the part that carries information.
 */

import { useCallback, useEffect, useRef, useState } from "react";
import { PIPELINE_ROUTES, PIPELINE_STAGES } from "./pipeline-data";
import styles from "@/components/briefs/information-war-system.module.css";

/** Dwell per stage. Long enough to read one step, not a slideshow. */
const DWELL_MS = 2600;

export function PipelineTrace() {
  const [routeId, setRouteId] = useState<(typeof PIPELINE_ROUTES)[number]["id"]>("signal");
  const [position, setPosition] = useState(0);
  const [auto, setAuto] = useState(true);
  const frameRef = useRef<HTMLDivElement>(null);

  const route = PIPELINE_ROUTES.find((r) => r.id === routeId) ?? PIPELINE_ROUTES[0];
  /* The stages this route actually stops at, in spine order, de-duplicated:
     a claim stops at `Evidence` twice and that is one lit stage, not two. */
  const visited = PIPELINE_STAGES.filter((stage) =>
    route.steps.some((step) => step.at === stage.number),
  );
  const activeStage = visited[Math.min(position, visited.length - 1)];

  const choose = useCallback((id: (typeof PIPELINE_ROUTES)[number]["id"]) => {
    setRouteId(id);
    setPosition(0);
    setAuto(false);
  }, []);

  useEffect(() => {
    if (!auto) return;
    const frame = frameRef.current;
    if (!frame) return;

    const reduced = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (reduced.matches) return;

    let timer: ReturnType<typeof setInterval> | undefined;
    const stop = () => {
      if (timer) clearInterval(timer);
      timer = undefined;
    };
    const start = () => {
      if (timer) return;
      timer = setInterval(() => {
        setPosition((p) => (p + 1) % Math.max(visited.length, 1));
      }, DWELL_MS);
    };

    /* Only while it is on screen. A diagram advancing in a viewport nobody is
       looking at is work done for no reader, and it arrives mid-journey when
       they finally scroll to it. */
    const observer = new IntersectionObserver(
      ([entry]) => (entry.isIntersecting ? start() : stop()),
      { threshold: 0.35 },
    );
    observer.observe(frame);

    return () => {
      observer.disconnect();
      stop();
    };
  }, [auto, visited.length]);

  return (
    <div className={styles.trace} ref={frameRef}>
      <div className={styles.traceRoutes} role="group" aria-label="Choose what to follow">
        {PIPELINE_ROUTES.map((option) => (
          <button
            key={option.id}
            type="button"
            className={styles.traceRoute}
            aria-pressed={option.id === routeId}
            onClick={() => choose(option.id)}
          >
            {option.name}
          </button>
        ))}
      </div>

      <p className={styles.traceSubject}>{route.subject}</p>

      <ol className={styles.traceChain}>
        {PIPELINE_STAGES.map((stage) => {
          const steps = route.steps.filter((step) => step.at === stage.number);
          const onRoute = steps.length > 0;
          const isActive = onRoute && stage.number === activeStage?.number;
          return (
            <li
              key={stage.number}
              className={styles.traceStage}
              data-on-route={onRoute || undefined}
              data-active={isActive || undefined}
            >
              <div className={styles.traceRail} aria-hidden="true">
                <i className={styles.traceNode} />
              </div>
              <div className={styles.traceBody}>
                <p className={styles.traceMeta}>
                  <span>{stage.number}</span>
                  <span>{stage.name}</span>
                </p>
                {onRoute ? (
                  <ul className={styles.traceSteps}>
                    {steps.map((step) => (
                      <li key={step.step}>
                        <strong>{step.step}</strong>
                        <span>{step.text}</span>
                      </li>
                    ))}
                  </ul>
                ) : (
                  <p className={styles.traceSkip}>
                    Not on this route — the stage still runs, this subject just
                    does not stop here.
                  </p>
                )}
              </div>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
