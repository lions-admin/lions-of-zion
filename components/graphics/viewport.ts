/**
 * The shared coordinate contract.
 *
 * One module owns the answer to "how big is the world, and where is anything in
 * it". Before this existed, the homepage measured its wrapper element and the
 * intro measured `window`, with two different pixel-ratio caps, and the lion's
 * cover fit was a two-branch heuristic that failed at both ends of the aspect
 * range. A navigation layer registered against the lion's composition would
 * have inherited every one of those failures one layer up.
 *
 * Everything here is measurement. Art direction — which text cloud to build,
 * how a scene eases — stays in the scenes.
 */

/* ------------------------------------------------------------------ *
 * Composition constants
 *
 * These describe the one composition both scenes share. They were previously
 * local to the retired photographic landing scene. They remain exported
 * because the preserved intro and its tests still share this coordinate
 * contract; a second copy is how a quantisation scale silently drifts.
 * ------------------------------------------------------------------ */

/** Camera field of view, degrees. */
export const CAMERA_FOV = 34;
/** Camera distance from the lion's plane. */
export const CAMERA_Z = 10;

/** The lion plane, in world units. 16:9, matching the source photograph. */
export const PLANE_H = 6.15;
export const PLANE_W = PLANE_H * (16 / 9);

/**
 * The lion mesh sits centred in its group. It used to carry a private +0.14
 * lift, duplicated again in the particle sampler, which meant two constants
 * decided vertical framing and neither knew about the cover fit. All vertical
 * framing is `planeOffsetY` now, and it is solved for rather than chosen.
 */

/**
 * The face, in plane UV space. Eyes were measured on the source image at
 * (0.439, 0.562) and (0.559, 0.566); v = 0.65 sits just above them, which is
 * the point the composition should hold as the frame narrows.
 */
export const FACE_V = 0.65;

/**
 * Per-frame parallax amplitudes, in world units. The composition must stay
 * covered with all of these at their extreme simultaneously, which is why the
 * cover fit adds them rather than trusting a hand-picked safety factor.
 */
export const PARALLAX = {
  lionX: 0.18,
  lionY: 0.14,
  cameraX: 0.18,
  cameraY: 0.1,
} as const;

/** Amplitude of the lion's breathing micro-scale; it can shrink the plane. */
export const BREATH_AMPLITUDE = 0.0045;

/**
 * How much of the image width the composition frames, as the aspect narrows.
 * 1.0 is "whatever cover requires"; the portrait end reproduces the original
 * art direction of moving in on the face, but as a continuous function rather
 * than as a branch.
 */
const PORTRAIT_ZOOM_MAX = 1.12;

/** The aspect band over which the framing drifts from wide to face-centred. */
const FACE_BIAS_WIDE = 1.3;
const FACE_BIAS_NARROW = 0.75;


export type QualityTier = "ultra" | "high" | "medium" | "low" | "fallback";

export interface SafeArea {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

export interface ViewportSnapshot {
  /** CSS pixels of the observed element. */
  width: number;
  height: number;
  aspect: number;
  /** The one pixel-ratio policy, for every scene. */
  dpr: number;
  tier: QualityTier;
  reducedMotion: boolean;
  coarsePointer: boolean;

  /** World half-extents of the visible area at the lion's plane. */
  halfW: number;
  halfH: number;

  /** The Stage 0 cover fit. */
  planeScale: number;
  planeOffsetY: number;

  /** World position of the lion's face under the current fit. */
  focalX: number;
  focalY: number;

  /** Where a ring built around this composition should be centred. */
  navCenterX: number;
  navCenterY: number;

  /** Device safe-area insets, CSS pixels. */
  safeArea: SafeArea;
}

/* ------------------------------------------------------------------ *
 * The fit
 * ------------------------------------------------------------------ */

function smoothstep(edge0: number, edge1: number, x: number): number {
  const t = Math.min(1, Math.max(0, (x - edge0) / (edge1 - edge0)));
  return t * t * (3 - 2 * t);
}

/** Visible world height at the lion's plane. Constant — only width varies. */
export function visibleHeight(): number {
  return 2 * Math.tan((CAMERA_FOV * Math.PI) / 360) * CAMERA_Z;
}

/**
 * The cover fit, in one continuous piece.
 *
 * Cover is guaranteed by construction: the required scale is solved for, with
 * the parallax and the breathing already inside it. The focal pan then takes
 * whatever vertical headroom the resulting scale leaves over, which is why
 * there is no threshold anywhere in here to cross — at every aspect the frame
 * is covered, and the face moves toward centre only as far as it can without
 * breaking that.
 */
export function fitComposition(aspect: number): {
  planeScale: number;
  planeOffsetY: number;
  focalY: number;
  halfW: number;
  halfH: number;
} {
  const visH = visibleHeight();
  const visW = visH * aspect;

  const maxShiftX = PARALLAX.lionX + PARALLAX.cameraX;
  const maxShiftY = PARALLAX.lionY + PARALLAX.cameraY;
  // The breathing scale dips below 1, so the plane must be solved for at its
  // smallest, not its nominal size.
  const shrink = 1 - BREATH_AMPLITUDE;

  // The scale that covers the frame with every parallax at its extreme and no
  // pan applied. Both axes bind on some aspect; the wider one wins.
  const coverX = (visW + 2 * maxShiftX) / (PLANE_W * shrink);
  const coverY = (visH + 2 * maxShiftY) / (PLANE_H * shrink);
  const coverScale = Math.max(coverX, coverY);

  // How far this aspect wants to move in on the face, 0 wide → 1 portrait.
  const faceBias = smoothstep(FACE_BIAS_WIDE, FACE_BIAS_NARROW, aspect);

  // Extra zoom, whose only purpose is to buy the pan somewhere to go.
  const planeScale = coverScale * (1 + faceBias * (PORTRAIT_ZOOM_MAX - 1));

  // Vertical slack this scale leaves over, in world units, and the pan that
  // fits inside it. Cover is never traded away for art direction: the pan
  // takes the headroom that exists and stops there.
  const slack = (PLANE_H * planeScale * shrink) / 2 - (visH / 2 + maxShiftY);
  const maxPan = Math.max(0, slack / (PLANE_H * planeScale));
  const pan = Math.min(faceBias * (FACE_V - 0.5), maxPan);

  return {
    planeScale,
    planeOffsetY: -pan * PLANE_H * planeScale,
    focalY: (FACE_V - 0.5 - pan) * PLANE_H * planeScale,
    halfW: visW / 2,
    halfH: visH / 2,
  };
}


/* ------------------------------------------------------------------ *
 * What used to live below this line
 *
 * A `Viewport` class, a device-tier detector, `hasWebGL`, `dprFor`,
 * `worldToScreenIn`, `readSafeArea` and a `publishForVerification` that wrote
 * `window.__lionFit`. All of it served the retired photographic landing scene;
 * none of it had a single caller left, and the `__lionFit` global had one
 * writer and no reader — its docstring claimed `verify-composition.mjs` read
 * it, which was never true. Removed 2026-08-27; `git log` has it.
 *
 * What remains is the part that is still load-bearing: the composition
 * constants and the cover fit, which `tests/composition-fit.test.ts` asserts
 * as invariants rather than as a screenshot. The live scene runs at a
 * different camera (45°/8.2u, see `intro-scene/Scene.tsx`), so these numbers
 * describe the preserved intro's contract and not the navigation's.
 * ------------------------------------------------------------------ */
