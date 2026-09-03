/**
 * The intelligence scan's presence during the intro, as pure arithmetic.
 *
 * `Scene.tsx` writes `scanReveal` and `navReveal` into the shared frame;
 * `NetworkScan` reads them and needs three numbers back: how much of the
 * navigation-strength opacity each sprite layer may show right now, where the
 * lion's exclusion hole is, and where the text corridor is. None of that needs
 * a GPU or a DOM, so it lives here, next to the timeline it is driven by, and
 * is pinned by `tests/intro-scan.test.ts`.
 */

import type { IntroLayout } from './introLayout';
import type { RollingStoryFrame } from './rolling-story-timeline';

/**
 * Intro opacity targets, as fractions of the navigation values in
 * `defaultSimParams` (`scanFieldOpacity` 0.3, `scanWordOpacity` 0.52,
 * `scanGlyphOpacity` 0.55). The scan is a backdrop to the story while the
 * story is on screen, so each stays well below 1; the outro lifts them to 1.
 * Plan §4 Phase D calls these a starting point to be validated from captures.
 */
export const INTRO_SCAN_FIELD_TARGET = 0.45;
export const INTRO_SCAN_WORD_TARGET = 0.3;
export const INTRO_SCAN_GLYPH_TARGET = 0.24;

/**
 * Below this, the network group is not drawn at all. Shared by the intro
 * wake and the navigation outro so neither can leave a sub-threshold frame.
 */
export const SCAN_VISIBLE_THRESHOLD = 0.02;

/**
 * Multiplier applied to a layer's navigation opacity.
 *
 *   `mix(target * scanReveal, 1, navReveal)`
 *
 * 0 while the opening is black (`scanReveal` is 0 until `SCAN_REVEAL_START`),
 * `target` once the reveal completes, and 1 at the end of the outro — one
 * continuous ramp with no cut between the intro and the navigation state.
 * Monotone in both inputs.
 */
export function introScanMultiplier(
  scanReveal: number,
  navReveal: number,
  target: number,
): number {
  const reveal = clamp01(scanReveal);
  const nav = clamp01(navReveal);
  const introLevel = target * reveal;
  return introLevel + (1 - introLevel) * nav;
}

/**
 * Half-axes of the soft elliptical hole the scan fades through around the
 * lion, per unit of lion scale, on the lion's own plane. These are the ratios
 * the static hole already used at `centerScale`, so the navigation state is
 * unchanged: the hole simply follows `lionScale`/`lionY` instead of assuming
 * a centred lion of orbit size.
 */
export const LION_MASK_X_PER_SCALE = 1.62;
export const LION_MASK_Y_PER_SCALE = 1.42;

export interface LionScanMask {
  /** World Y of the hole's centre on the lion plane. */
  centerY: number;
  /** Half-axes on the lion plane. */
  halfX: number;
  halfY: number;
}

/** Writes the lion hole for this frame into `out`; allocates nothing. */
export function solveLionScanMask(
  lionScale: number,
  lionY: number,
  out: LionScanMask,
): LionScanMask {
  const scale = Math.max(0, lionScale);
  out.centerY = lionY;
  out.halfX = LION_MASK_X_PER_SCALE * scale;
  out.halfY = LION_MASK_Y_PER_SCALE * scale;
  return out;
}

/**
 * The band the hole is faded through, in half-axis units: fully dark at or
 * inside `INNER`, untouched at or outside `OUTER`.
 *
 * `networkScanMaterial.ts` imports these for its `smoothstep`, and
 * `lionScanMaskOpacity` below mirrors that `smoothstep` on the CPU. One
 * definition, because the whole point of the pair is that the navigation
 * state can be proved arithmetically against a shader nothing can run under
 * vitest.
 */
export const LION_MASK_EDGE_INNER = 0.86;
export const LION_MASK_EDGE_OUTER = 1.24;

/**
 * The centred ellipse `buildScanField` used to punch out of the field
 * geometry at build time, in lion-plane units per unit of
 * `orbit.centerScale`.
 *
 * Retired 2026-09-04. It was solved once, at build time, from
 * `orbit.centerScale` and frozen on world centre — correct for the settled
 * navigation state and wrong for every intro frame, where the lion has risen
 * and shrunk and the hole stayed behind as an empty oval under the text
 * column that no uniform could move. The field is generated uniformly now and
 * the runtime mask above is the only hero exclusion.
 *
 * These stay because they are the bound that mask has to keep covering:
 * `LION_MASK_EDGE_INNER * LION_MASK_{X,Y}_PER_SCALE` exceeds them, so the
 * fully dark core of the runtime hole contains the retired one at every
 * `centerScale`. `tests/intro-scan.test.ts` pins it.
 */
export const RETIRED_FIELD_HOLE_X = 1.34;
export const RETIRED_FIELD_HOLE_Y = 1.18;

/**
 * The hero hole's opacity multiplier at a point on the mask's own plane: 0
 * inside the hole, 1 clear of it, smooth between. The CPU mirror of the
 * `smoothstep` in `networkScanMaterial.ts`, including its `1e-3` floor on the
 * half-axes, which is what `NetworkScan` clamps the uniforms to.
 */
export function lionScanMaskOpacity(x: number, y: number, mask: LionScanMask): number {
  const nx = x / Math.max(1e-3, mask.halfX);
  const ny = (y - mask.centerY) / Math.max(1e-3, mask.halfY);
  return smoothstep(LION_MASK_EDGE_INNER, LION_MASK_EDGE_OUTER, Math.hypot(nx, ny));
}

/**
 * How far the scan is dimmed inside the text corridor at full `readingMask`:
 * `1 - TEXT_CORRIDOR_MUTE` of its opacity survives. A dim, not a hole — the
 * corridor is where the story is read, and a black rectangle behind moving
 * type reads as a card, not a contrast corridor.
 */
export const TEXT_CORRIDOR_MUTE = 0.85;

/** Vertical padding around the occupied rows, in row-gap units. */
export const SCAN_CORRIDOR_ROW_PAD = 0.55;
/** Horizontal padding beyond the widest possible line, world units. */
export const SCAN_CORRIDOR_SIDE_PAD = 0.3;
/** Room kept under the brand line when it is on screen, world units. */
export const SCAN_CORRIDOR_BRAND_PAD = 0.35;

export interface ScanCorridor {
  /** World Y of the corridor's centre on the text plane. */
  centerY: number;
  halfHeight: number;
  halfWidth: number;
}

export type ScanCorridorLayout = Pick<
  IntroLayout,
  'rowTop' | 'rowGap' | 'lineMaxWidth' | 'brandY'
>;

/**
 * The text corridor for this frame, on the text plane, written into `out`.
 *
 * Spans the rows currently holding a visible line (row 0 when none has
 * built yet, which is the row the pre-roll streams toward) plus the brand
 * line once it starts building. `IntroText` places row `r` at
 * `rowTop - r * rowGap`, x centred, no wider than `lineMaxWidth`; this reads
 * the same layout so the two cannot disagree. Allocates nothing.
 */
export function solveScanCorridor(
  layout: ScanCorridorLayout,
  story: RollingStoryFrame | null,
  out: ScanCorridor,
): ScanCorridor {
  let minRow = Number.POSITIVE_INFINITY;
  let maxRow = Number.NEGATIVE_INFINITY;
  if (story) {
    for (const line of story.activeLines) {
      if (line.visibility <= 0.001) continue;
      if (line.row < minRow) minRow = line.row;
      if (line.row > maxRow) maxRow = line.row;
    }
  }
  if (!Number.isFinite(minRow)) {
    minRow = 0;
    maxRow = 0;
  }
  const pad = layout.rowGap * SCAN_CORRIDOR_ROW_PAD;
  const top = layout.rowTop - minRow * layout.rowGap + pad;
  let bottom = layout.rowTop - maxRow * layout.rowGap - pad;
  if (story && story.brandProgress > 0.001) {
    bottom = Math.min(bottom, layout.brandY - SCAN_CORRIDOR_BRAND_PAD);
  }
  out.centerY = (top + bottom) / 2;
  out.halfHeight = (top - bottom) / 2;
  out.halfWidth = layout.lineMaxWidth / 2 + SCAN_CORRIDOR_SIDE_PAD;
  return out;
}

function clamp01(value: number): number {
  return Math.max(0, Math.min(1, value));
}

/** GLSL/TSL `smoothstep`, so the CPU mirror above matches the node graph. */
function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = clamp01((x - edge0) / (edge1 - edge0));
  return t * t * (3 - 2 * t);
}
