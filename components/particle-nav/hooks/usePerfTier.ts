'use client';
import { useEffect, useState } from 'react';

export type Backend = 'webgpu' | 'webgl2' | 'none';

export interface PerfTier {
  backend: Backend;
  /** Lion particle budget — matches a baked LOD. */
  particles: 180_000 | 90_000 | 45_000;
  /** Procedural network-scan particle budget. */
  networkPoints: 7_000 | 12_000 | 18_000;
  bloom: 'full' | 'reduced' | 'off';
  maxDpr: number;
}

/** Brief §8 tier table. */
export function tierFor(backend: Backend, deviceMemoryGb: number | undefined, coarse: boolean): PerfTier {
  if (backend === 'none') {
    return { backend, particles: 45_000, networkPoints: 7_000, bloom: 'off', maxDpr: 1 };
  }
  if (backend === 'webgl2' || coarse) {
    // Mobile / no-WebGPU: 45k lion + a reduced scan field, bloom off, DPR ≤ 2.
    return { backend, particles: 45_000, networkPoints: 7_000, bloom: 'off', maxDpr: 2 };
  }
  const mem = deviceMemoryGb ?? 8;
  if (mem <= 4) {
    return { backend, particles: 90_000, networkPoints: 12_000, bloom: 'reduced', maxDpr: 2 };
  }
  return { backend, particles: 180_000, networkPoints: 18_000, bloom: 'full', maxDpr: 2 };
}

export function detectBackend(forceWebGL?: boolean): Backend {
  if (typeof window === 'undefined') return 'none';
  if (!forceWebGL && 'gpu' in navigator) return 'webgpu';
  const probe = document.createElement('canvas').getContext('webgl2');
  if (probe) {
    probe.getExtension('WEBGL_lose_context')?.loseContext();
    return 'webgl2';
  }
  return 'none';
}

export function usePerfTier(forceWebGL?: boolean): PerfTier | null {
  const [tier, setTier] = useState<PerfTier | null>(null);
  useEffect(() => {
    const backend = detectBackend(forceWebGL);
    const nav = navigator as Navigator & { deviceMemory?: number };
    const coarse = window.matchMedia('(pointer: coarse)').matches;
    setTier(tierFor(backend, nav.deviceMemory, coarse));
  }, [forceWebGL]);
  return tier;
}
