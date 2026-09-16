import type { EditorialMedia } from '@/server/contracts/editorial-media';

/**
 * The gate an article or record hero stands behind, from the media
 * contract's own `sensitivity` (2026-09-16).
 *
 * `safe` renders bare — the contract's only unmarked grade. `sensitive` is
 * material the desk has marked, and `unknown` is material it has *not yet
 * graded*; both are covered by the gate, because "we have not looked" is a
 * reason not to put a photograph of people in front of a reader without
 * asking, never a reason to put one there silently.
 *
 * The category names the *grade*, not an invented description of the image:
 * the record carries no description of what the material shows, and writing
 * one would be inventing evidence. Returns `null` for a safe asset.
 *
 * This is deliberately NOT inside `SensitiveContent.tsx`: that module is
 * `'use client'`, and a server page — `app/articles/[publicId]/page.tsx`,
 * `NarrativeRecord` — that called it there died at render time with
 * "Attempted to call mediaSensitivityGate() from the server but
 * mediaSensitivityGate is on the client". Every article whose hero carried a
 * picture returned 500. The grade is a pure read of the media contract, so it
 * lives in its own server-safe module and both worlds import it from here.
 */
export function mediaSensitivityGate(
  media: Pick<EditorialMedia, 'sensitivity'>,
): { category: string; warning: string } | null {
  if (media.sensitivity === 'safe') return null;
  const grade =
    media.sensitivity === 'sensitive'
      ? 'marked sensitive by the desk'
      : 'not yet graded by the desk';
  return {
    category: `Image · ${grade}`,
    warning:
      'The picture is not loaded or shown until you choose to see it. Nothing about it is fetched before then.',
  };
}
