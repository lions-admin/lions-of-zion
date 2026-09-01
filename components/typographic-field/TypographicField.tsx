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

    let metricsFrame = 0;
    let frameCount = 0;
    let lastMetricTime = performance.now();

    const updateMetrics = () => {
      frameCount += 1;
      const now = performance.now();
      if (now - lastMetricTime >= 1000) {
        const fps = Math.round((frameCount * 1000) / (now - lastMetricTime));
        const rows = engine.rowCount || 0;
        const glyphs = rows * (engine.charsPerRow || 0);
        setEngineStatus(
          `TYPOGRAPHIC ENGINE // ${fps} FPS // ${rows} ROWS // ${glyphs.toLocaleString()} GLYPHS`
        );
        frameCount = 0;
        lastMetricTime = now;
      }
      metricsFrame = requestAnimationFrame(updateMetrics);
    };

    metricsFrame = requestAnimationFrame(updateMetrics);

    return () => {
      cancelAnimationFrame(metricsFrame);
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
