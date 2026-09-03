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

    /* MOTION-005 — the engine already stops itself on a hidden tab and under
       reduced motion; this observer adds the third gate, scrolled offscreen.
       The engine owns the composed state, so a tab returning to a
       scrolled-away field stays stopped. */
    const io = new IntersectionObserver((entries) => {
      engine.setOffscreen(!entries.some((entry) => entry.isIntersecting));
    });
    io.observe(canvas);

    /* Telemetry reads the engine's own frame counter, so the FPS figure is the
       render loop's real rate — a stopped or settled engine reports itself as
       settled instead of echoing this reader loop's 60Hz. */
    let metricsFrame = 0;
    let lastFrames = engine.framesRendered;
    let lastMetricTime = performance.now();

    const updateMetrics = () => {
      const now = performance.now();
      if (now - lastMetricTime >= 1000) {
        const rows = engine.rowCount || 0;
        const glyphs = rows * (engine.charsPerRow || 0);
        if (engine.isRunning) {
          const fps = Math.round(
            ((engine.framesRendered - lastFrames) * 1000) / (now - lastMetricTime),
          );
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
      }
      metricsFrame = requestAnimationFrame(updateMetrics);
    };

    metricsFrame = requestAnimationFrame(updateMetrics);

    return () => {
      cancelAnimationFrame(metricsFrame);
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
