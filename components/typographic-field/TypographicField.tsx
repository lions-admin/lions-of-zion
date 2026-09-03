"use client";

import { useEffect, useRef, useState } from "react";
import { TypographicMotionEngine, type TypographicFieldConfig } from "./engine";

interface TypographicFieldProps {
  canvasClassName?: string;
  statusClassName?: string;
  dotClassName?: string;
  config?: Partial<TypographicFieldConfig>;
}

export function TypographicField({
  canvasClassName = "",
  statusClassName = "",
  dotClassName = "",
  config,
}: TypographicFieldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [engineStatus, setEngineStatus] = useState("TYPOGRAPHIC ENGINE // STANDBY");
  const [isReady, setIsReady] = useState(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const engine = new TypographicMotionEngine(canvas, config);
    setIsReady(true);

    /* Telemetry reads the engine's own frame counter, so the FPS figure is the
       render loop's real rate — a stopped or settled engine reports itself as
       settled instead of echoing a reader loop's rate.

       MOTION-002 — this was a `requestAnimationFrame` loop that ran at ~60Hz
       for the life of the mount and did nothing on 59 of every 60 wakeups: it
       had no offscreen gate, no reduced-motion gate, and outlived the engine's
       own three gates, so a scrolled-away, reduced-motion, settled field still
       scheduled a frame callback every 16ms. The reading it takes is a
       once-per-second average, so a 1Hz interval is the loop's actual period
       and `sampleMetrics` is now the whole of it. */
    let lastFrames = engine.framesRendered;
    let lastMetricTime = performance.now();
    let metricsTimer: ReturnType<typeof setInterval> | null = null;

    const sampleMetrics = () => {
      const now = performance.now();
      const rows = engine.rowCount || 0;
      const glyphs = rows * (engine.charsPerRow || 0);
      if (engine.isRunning) {
        const elapsed = now - lastMetricTime;
        const fps =
          elapsed > 0
            ? Math.round(((engine.framesRendered - lastFrames) * 1000) / elapsed)
            : 0;
        setEngineStatus(
          `TYPOGRAPHIC ENGINE // ${fps} FPS // ${rows} ROWS // ${glyphs.toLocaleString()} GLYPHS`,
        );
      } else {
        setEngineStatus(
          `TYPOGRAPHIC ENGINE // SETTLED // ${rows} ROWS // ${glyphs.toLocaleString()} GLYPHS`,
        );
      }
      lastFrames = engine.framesRendered;
      lastMetricTime = now;
    };

    const startMetrics = () => {
      if (metricsTimer !== null) return;
      lastFrames = engine.framesRendered;
      lastMetricTime = performance.now();
      metricsTimer = setInterval(sampleMetrics, 1000);
    };

    const stopMetrics = () => {
      if (metricsTimer === null) return;
      clearInterval(metricsTimer);
      metricsTimer = null;
    };

    /* MOTION-005 — the engine already stops itself on a hidden tab and under
       reduced motion; this observer adds the third gate, scrolled offscreen.
       The engine owns the composed state, so a tab returning to a
       scrolled-away field stays stopped.

       MOTION-002 — the same signal now also gates the telemetry sampler. One
       final sample runs as the field leaves so the readout the reader scrolls
       back to is the settled one, not a stale FPS figure. */
    let onScreen = true;

    const syncMetrics = () => {
      if (onScreen && !document.hidden) startMetrics();
      else {
        stopMetrics();
        sampleMetrics();
      }
    };

    const io = new IntersectionObserver((entries) => {
      onScreen = entries.some((entry) => entry.isIntersecting);
      engine.setOffscreen(!onScreen);
      syncMetrics();
    });
    io.observe(canvas);

    /* The engine has its own `visibilitychange` handler for the render loop;
       this one is the sampler's, so a backgrounded tab stops both. */
    document.addEventListener("visibilitychange", syncMetrics, { passive: true });

    syncMetrics();

    return () => {
      document.removeEventListener("visibilitychange", syncMetrics);
      stopMetrics();
      io.disconnect();
      engine.destroy();
    };
  }, [config]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={canvasClassName}
        aria-hidden="true"
        data-engine-ready={isReady ? "true" : undefined}
      />
      {statusClassName ? (
        <div className={statusClassName} aria-live="off">
          {dotClassName ? <span className={dotClassName} aria-hidden="true" /> : null}
          <span>{engineStatus}</span>
        </div>
      ) : null}
    </>
  );
}
