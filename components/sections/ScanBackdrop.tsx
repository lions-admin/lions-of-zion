/**
 * The scan, still running behind an open file.
 *
 * Server-rendered rows of the real monitoring corpus, drifting by CSS alone —
 * no client JS, no WebGPU. Direction and colour mirror the canvas layer's
 * semantics: hostile narratives (red/amber) run leftward on the ember ramp,
 * fact checks and monitored context (blue/neutral) run rightward in blue.
 *
 * Fragments render whole or not at all — the corpus rule from
 * `components/particle-nav/scanCorpus.ts` holds here too. Rows are clipped by
 * the viewport edge as they travel (exactly what the canvas does); they are
 * never ellipsised, wrapped, or sliced.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import styles from './sections.module.css';

type ScanTone = 'red' | 'amber' | 'blue' | 'neutral';

interface Fragment {
  text: string;
  tone: ScanTone;
}

/** Same never-empty rule as the canvas layer: shown only if the corpus fails. */
const FALLBACK: Fragment[] = [
  { text: 'SCANNING NETWORK', tone: 'neutral' },
  { text: 'SOURCE MONITOR: open channels', tone: 'neutral' },
  { text: 'TRACE: propagation path', tone: 'amber' },
  { text: 'AWAITING CORPUS', tone: 'blue' },
];

/** Same deterministic PRNG the canvas layer uses. */
function mulberry32(seed: number) {
  let value = seed >>> 0;
  return () => {
    value |= 0;
    value = (value + 0x6d2b79f5) | 0;
    let t = value;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hashSeed(text: string) {
  let h = 0x811c9dc5;
  for (let i = 0; i < text.length; i++) {
    h ^= text.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

async function loadFragments(): Promise<Fragment[]> {
  try {
    const raw = await readFile(
      path.join(process.cwd(), 'public/matrix/matrix-fragments.en.json'),
      'utf8',
    );
    const payload: unknown = JSON.parse(raw);
    const list = (payload as { fragments?: unknown }).fragments;
    if (!Array.isArray(list)) return FALLBACK;
    const fragments: Fragment[] = [];
    for (const entry of list) {
      const text = (entry as { text?: unknown }).text;
      const tone = (entry as { tone?: unknown }).tone;
      if (
        typeof text === 'string' &&
        text.trim().length > 0 &&
        (tone === 'red' || tone === 'amber' || tone === 'blue' || tone === 'neutral')
      ) {
        fragments.push({ text: text.trim(), tone });
      }
    }
    return fragments.length > 0 ? fragments : FALLBACK;
  } catch {
    return FALLBACK;
  }
}

export interface ScanBackdropProps {
  /** Seeds the sample so each page shows its own stable slice of the corpus. */
  routeId: string;
  register?: 'default' | 'muted';
}

export async function ScanBackdrop({ routeId, register = 'default' }: ScanBackdropProps) {
  const fragments = await loadFragments();
  const rng = mulberry32(hashSeed(routeId));
  const hostile = fragments.filter((f) => f.tone === 'red' || f.tone === 'amber');
  const verified = fragments.filter((f) => f.tone === 'blue' || f.tone === 'neutral');

  // Alternate the streams rather than sampling corpus proportions — the corpus
  // is mostly hostile material, and a page that is 85% ember is a mood, not a
  // monitor. Muted pages breathe slower and carry fewer rows.
  const rowCount = register === 'muted' ? 9 : 16;
  const rows = Array.from({ length: rowCount }, (_, i) => {
    const toHostile = i % 2 === 1;
    const pool = (toHostile ? hostile : verified).length > 0
      ? (toHostile ? hostile : verified)
      : fragments;
    const fragment = pool[Math.floor(rng() * pool.length)];
    return {
      key: i,
      text: fragment.text,
      hostile: toHostile,
      loud: rng() > 0.62,
      top: 3 + ((i + 0.5) / rowCount) * 92 + (rng() - 0.5) * 3,
      duration: 45 + rng() * 45,
      progress: rng(), // negative delay: the row is already mid-flight on load
      rest: (rng() * 70).toFixed(1), // reduced-motion resting spot, in vw
    };
  });

  return (
    <div className={styles.backdrop} aria-hidden="true">
      {rows.map((row) => (
        <span
          key={row.key}
          className={[
            styles.row,
            row.hostile ? styles.rowHostile : styles.rowVerified,
            row.loud ? styles.rowLoud : '',
          ].join(' ')}
          style={{
            top: `${row.top.toFixed(2)}%`,
            ['--dur' as string]: `${row.duration.toFixed(1)}s`,
            ['--delay' as string]: `${(-row.progress * row.duration).toFixed(1)}s`,
            ['--rest' as string]: row.rest,
          }}
        >
          {row.text}
        </span>
      ))}
    </div>
  );
}
