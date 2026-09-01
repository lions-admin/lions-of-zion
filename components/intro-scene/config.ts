import type { ParticleNavTheme, SimParams } from './types';

export const defaultTheme: ParticleNavTheme = {
  /* The renderer's clear colour, separate from the CSS `--ground` token and
     not reached by it — changing the token alone leaves the canvas navy. */
  background: '#000000',
  // #C9A24B on #000000 clears 8.75:1 — do not let it drift dimmer for atmosphere (brief §9).
  gold: '#C9A24B',
  excited: '#FFE9B0',
  hover: '#EFD79A',
  starBlue: '#57A7D9',
};

/**
 * The shipping simulation dials.
 *
 * These were the brief's starting points and were never tuned against a
 * capture, so "calibrated" was the wrong word for three of them, which ship
 * at 0 and therefore do nothing at all:
 *
 *   - `curlAmp: 0` zeroes the lion's ambient drift in both branches of
 *     `lionCompute.ts` (`curlAmp.mul(6)` and `curlAmp.mul(60)`);
 *   - `repelStrength: 0` zeroes pointer repulsion;
 *   - `idleRotateDegPerSec: 0` holds the rig still.
 *
 * Restoring any of them is a visual decision that needs a real-Chrome capture.
 */
export const defaultSimParams: SimParams = {
  springStiffness: 8.0,
  springDamping: 0.86,
  curlAmp: 0,
  curlFreq: 1.6,
  curlTimescale: 0.15,
  repelRadius: 0.35,
  repelStrength: 0,
  streamFraction: 0.12,
  pointSizeMin: 0.9,
  pointSizeMax: 1.85,
  bloomThreshold: 0.46,
  bloomStrength: 0.38,
  bloomRadius: 0.26,
  idleRotateDegPerSec: 0,
  parallaxDeg: 1.25,
  parallaxDamping: 0.08,
};

/**
 * Below this width the layout is the phone one, in every layer that asks *for
 * the layout mode* — the intro's line arrays, the timeline it derives from
 * them, and the CSS breakpoints.
 */
export const MOBILE_MAX_WIDTH = 720;

export const CAMERA_Z = 8.2;
export const CAMERA_FOV = 45;

/**
 * The camera's visible extent in world units at the lion plane.
 *
 * Every layer needs this and, until now, three of them re-derived it from
 * their own copies of the two constants above. `viewHeight` does not depend on
 * the aspect at all — it is 6.7931 at every viewport — which is a fact worth
 * having in one place, because it is why the intro's vertical composition needs
 * no responsive handling and its horizontal composition does.
 */
export function viewSize(width: number, height: number) {
  const safeHeight = Math.max(1, height);
  const viewHeight = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360);
  return {
    viewHeight,
    viewWidth: viewHeight * (width / safeHeight),
    worldPerPx: viewHeight / safeHeight,
  };
}

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

/**
 * Narrow screens scale the central lion rather than letting it run off the
 * sides. Extracted verbatim from the retired `computeOrbitLayout`, which is
 * where this number used to live as `OrbitLayout.centerScale`: 1 at 480px and
 * wider, ramping down to 0.78 at 320px and below.
 */
export function lionCenterScale(width: number): number {
  const narrowT = clamp((width - 320) / 160, 0, 1);
  return width < 480 ? 0.78 + narrowT * 0.22 : 1;
}
