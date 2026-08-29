"use client";

import { useEffect, useRef, useState } from "react";
import { useIntroHandoffReady } from "@/components/particle-nav/CinematicIntroGate";
import { TypographicMotionEngine } from "./engine";

interface TypographicFieldProps {
  canvasClassName: string;
  statusClassName: string;
  dotClassName: string;
}

export function TypographicField({
  canvasClassName,
  statusClassName,
  dotClassName,
}: TypographicFieldProps) {
  const handoffReady = useIntroHandoffReady();
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [status, setStatus] = useState("TYPOGRAPHIC ENGINE // STANDBY");

  useEffect(() => {
    if (!handoffReady || !canvasRef.current) return;

    const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
    if (reducedMotion) {
      return;
    }

    const engine = new TypographicMotionEngine(canvasRef.current) as TypographicMotionEngine & {
      rowCount: number;
      charsPerRow: number;
    };
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
        setStatus(
          `TYPOGRAPHIC ENGINE // ${fps} FPS // ${rows} ROWS // ${glyphs.toLocaleString()} GLYPHS`,
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
  }, [handoffReady]);

  return (
    <>
      <canvas
        ref={canvasRef}
        className={canvasClassName}
        aria-hidden="true"
        data-engine-ready={handoffReady || undefined}
      />
      <div className={statusClassName} aria-live="off">
        <span className={dotClassName} aria-hidden="true" />
        <span>{status}</span>
      </div>
    </>
  );
}
