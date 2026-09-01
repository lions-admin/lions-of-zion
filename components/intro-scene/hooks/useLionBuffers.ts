'use client';
/**
 * Owns the full lifecycle of the lion's GPU state (brief §2.1: storage buffers
 * are NOT garbage collected). Fetches the tier-appropriate LOD binary, decodes
 * it, builds the sim, and destroys every buffer in the effect cleanup — the
 * single place disposal happens (acceptance #8).
 */
import { useEffect, useRef, useState } from 'react';
import { decodeLionBake } from '../binary/lionFormat';
import { createLionSim, type LionSim } from '../tsl/lionCompute';
import type { SimParams } from '../types';

const LOD_URL: Record<number, string> = {
  // Versioned filenames are intentional: particle binaries are static assets
  // and an already-open browser otherwise keeps the previous sculpt in cache.
  180_000: '/particles/lion-v2-180k.bin',
  90_000: '/particles/lion-v2-90k.bin',
  45_000: '/particles/lion-v2-45k.bin',
};

export function useLionBuffers(particles: number, params: SimParams): LionSim | null {
  const [sim, setSim] = useState<LionSim | null>(null);
  const initialParamsRef = useRef(params);

  useEffect(() => {
    let cancelled = false;
    let created: LionSim | null = null;
    const url = LOD_URL[particles] ?? LOD_URL[45_000];

    (async () => {
      const res = await fetch(url);
      if (!res.ok) throw new Error(`lion bake fetch failed: ${url} (${res.status})`);
      const buf = await res.arrayBuffer();
      if (cancelled) return;
      const decoded = decodeLionBake(buf);
      created = createLionSim(decoded, initialParamsRef.current);
      setSim(created);
    })().catch((err) => console.error('[intro-scene] lion load failed:', err));

    return () => {
      cancelled = true;
      created?.dispose();
      setSim(null);
    };
  }, [particles]);

  return sim;
}
