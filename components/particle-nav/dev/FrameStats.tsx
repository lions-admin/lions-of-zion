'use client';
/** Frame-time overlay behind the ?stats query flag (brief §8: perf claims get verified, not asserted). */

export interface FrameStatsData {
  ms: number;
  fps: number;
  backend: string;
  particles: number;
}

export function FrameStats({ data }: { data: FrameStatsData | null }) {
  if (!data) return null;
  const over = data.ms > 16.9;
  return (
    <div
      style={{
        position: 'fixed',
        top: 12,
        left: 12,
        zIndex: 50,
        fontFamily: 'ui-monospace, monospace',
        fontSize: 12,
        lineHeight: 1.6,
        color: over ? '#ff9a6b' : '#9be29b',
        background: 'rgba(0, 0, 0,0.82)',
        border: '1px solid rgba(201,162,75,0.4)',
        padding: '6px 10px',
        borderRadius: 6,
        pointerEvents: 'none',
        whiteSpace: 'pre',
      }}
    >
      {`${data.fps.toFixed(0)} fps · ${data.ms.toFixed(2)} ms\n${data.backend}${
        data.particles > 0 ? ` · ${(data.particles / 1000).toFixed(0)}k particles` : ''
      }`}
    </div>
  );
}
