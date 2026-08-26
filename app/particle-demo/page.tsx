"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Leva } from "leva";
import { NavClient, defaultNodes } from "@/components/particle-nav";
import { NavLinks } from "@/components/particle-nav/NavLinks";
import { useSimControls } from "@/components/particle-nav/dev/ControlPanel";
import { detectBackend } from "@/components/particle-nav/hooks/usePerfTier";
import {
  FrameStats,
  type FrameStatsData,
} from "@/components/particle-nav/dev/FrameStats";

const RADIUS = 3.3;

function Demo() {
  const search = useSearchParams();
  const showStats = search != null && search.get("stats") !== null;
  const forceWebGL = search?.get("forceWebGL") === "1";
  const sim = useSimControls();
  const [stats, setStats] = useState<FrameStatsData | null>(null);
  const [mounted, setMounted] = useState(true);
  const [cycles, setCycles] = useState(0);
  const cycleRun = useRef<ReturnType<typeof setInterval> | null>(null);

  const runMemoryAudit = () => {
    if (cycleRun.current) return;
    let count = 0;
    cycleRun.current = setInterval(() => {
      setMounted((value) => !value);
      count += 1;
      setCycles(Math.ceil(count / 2));
      if (count >= 100) {
        clearInterval(cycleRun.current!);
        cycleRun.current = null;
        setMounted(true);
      }
    }, 900);
  };

  useEffect(
    () => () => {
      if (cycleRun.current) clearInterval(cycleRun.current);
    },
    [],
  );

  return (
    <main style={{ height: "100dvh", position: "relative" }}>
      {mounted ? (
        <NavClient
          nodes={defaultNodes}
          radius={RADIUS}
          forceWebGL={forceWebGL}
          simOverrides={sim}
          onFrameStats={
            showStats
              ? (ms, fps) =>
                  setStats({
                    ms,
                    fps,
                    backend: detectBackend(forceWebGL),
                    particles: 0,
                  })
              : undefined
          }
        >
          <NavLinks nodes={defaultNodes} radius={RADIUS} />
        </NavClient>
      ) : (
        <div
          style={{
            display: "grid",
            placeItems: "center",
            height: "100%",
            color: "#c9a24b",
          }}
        >
          unmounted (cycle {cycles}/50)
        </div>
      )}

      <Leva collapsed titleBar={{ title: "particle-nav" }} />
      {showStats ? <FrameStats data={stats} /> : null}

      <div
        style={{
          position: "fixed",
          bottom: 12,
          left: 12,
          zIndex: 50,
          display: "flex",
          flexWrap: "wrap",
          gap: 8,
        }}
      >
        <button type="button" onClick={() => setMounted((value) => !value)} style={buttonStyle}>
          {mounted ? "unmount" : "mount"}
        </button>
        <button type="button" onClick={runMemoryAudit} style={buttonStyle}>
          run 50× audit {cycles > 0 ? `(${cycles}/50)` : ""}
        </button>
        <a
          href={forceWebGL ? "/particle-demo" : "/particle-demo?forceWebGL=1"}
          style={{ ...buttonStyle, textDecoration: "none" }}
        >
          {forceWebGL ? "WebGL2 forced → switch off" : "force WebGL2"}
        </a>
      </div>
    </main>
  );
}

const buttonStyle: React.CSSProperties = {
  background: "rgba(0, 0, 0,0.9)",
  color: "#efd79a",
  border: "1px solid rgba(201,162,75,0.5)",
  borderRadius: 6,
  padding: "6px 12px",
  fontSize: 12,
  fontFamily: "ui-monospace, monospace",
  cursor: "pointer",
};

export default function ParticleDemoPage() {
  return (
    <Suspense fallback={null}>
      <Demo />
    </Suspense>
  );
}
