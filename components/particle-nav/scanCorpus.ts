/**
 * The monitoring corpus behind the background scan.
 *
 * Every fragment in this corpus labels itself — "FALSE CLAIM: …",
 * "FACT CHECK: …", "TRENDING POST CLAIMS …", "<account>: public creator
 * repeatedly fact checked …". That label is the only thing separating a
 * hostile narrative from an assertion this site appears to be making, so it is
 * load-bearing, not decoration.
 *
 * Therefore: fragments are rendered whole or not at all. Do not truncate, clip
 * to a width, ellipsise, or slice a fragment to fit a row — a line that starts
 * mid-sentence has lost its attribution. Fitting is the layout's problem, and
 * the layout solves it by letting long lines run off-screen and scroll.
 */

export type ScanTone = 'red' | 'amber' | 'blue' | 'neutral';

export interface ScanFragment {
  text: string;
  tone: ScanTone;
}

const TONES: readonly ScanTone[] = ['red', 'amber', 'blue', 'neutral'];
const CORPUS_URL = '/matrix/matrix-fragments.en.json';

function isTone(value: unknown): value is ScanTone {
  return typeof value === 'string' && (TONES as readonly string[]).includes(value);
}

/**
 * Fetched rather than bundled: the corpus is editorial content with sources
 * attached, and it should be replaceable without a rebuild. Callers must keep
 * a usable fallback — the background is never allowed to be empty.
 */
export async function loadScanFragments(signal?: AbortSignal): Promise<ScanFragment[]> {
  const response = await fetch(CORPUS_URL, { signal });
  if (!response.ok) throw new Error(`scan corpus responded ${response.status}`);
  const payload: unknown = await response.json();
  const raw = (payload as { fragments?: unknown }).fragments;
  if (!Array.isArray(raw)) throw new Error('scan corpus carries no fragments array');

  const fragments: ScanFragment[] = [];
  for (const entry of raw) {
    const text = (entry as { text?: unknown }).text;
    const tone = (entry as { tone?: unknown }).tone;
    if (typeof text !== 'string' || !isTone(tone)) continue;
    const trimmed = text.trim();
    if (trimmed.length > 0) fragments.push({ text: trimmed, tone });
  }
  if (fragments.length === 0) throw new Error('scan corpus held no usable fragments');
  return fragments;
}
