/**
 * The intro's viewport→world contract.
 *
 * This used to be four lines inside `IntroText`, re-deriving the camera from
 * two local constants and solving a line cap that no test could see. Three
 * things were wrong with it and none of them were visible in a typecheck:
 *
 *   - the cap was `viewWidth - 0.48`, a fixed margin, which is 92vw on a phone
 *     and 170vw on a tablet in portrait — the desktop line breaks are chosen
 *     at 720px and up, but 768x1024 is a *narrow* frame in world units;
 *   - it had a floor of 2.05 world units that could exceed the frame it was
 *     protecting, on any aspect below 0.302;
 *   - the entry and exit trajectories were authored as absolute world offsets,
 *     so on a 390px phone particles started 2.4 frame-widths off to the left
 *     and left the frame entirely on the way out, at readable alpha.
 *
 * Everything here is pure and unit-tested. The camera is the particle-nav one
 * (45°, 8.2 units); `components/graphics/viewport.ts` looks like the obvious
 * home but belongs to the retired photographic scene at 34° and 10 units, and
 * every constant below would change meaning under it.
 */

import { CAMERA_FOV, CAMERA_Z, MOBILE_MAX_WIDTH, viewSize } from '@/components/particle-nav/config';

export type IntroLayoutName = 'mobile' | 'desktop';

/** No line may be wider than this fraction of the frame. */
export const INTRO_LINE_WIDTH_FRACTION = 0.86;

/** Keep a little back from the very edge, for the sprite's own half-size. */
export const INTRO_SAFE_FRACTION = 0.98;

/**
 * How much of its trajectory a particle covers while it can still be read.
 *
 * Alpha is `built * (1 - erased)`, so a particle is invisible where it starts
 * and invisible where it ends; only the middle of the path is legible. These
 * two fractions are the widest windows for which the authored desktop spans
 * are *not* clamped — which is how desktop stays exactly as it is today rather
 * than by hoping the numbers happen to miss.
 */
export const INTRO_ENTRY_LEGIBLE_FRACTION = 0.26;
export const INTRO_EXIT_LEGIBLE_FRACTION = 0.18;

/** A phone still gets a slide, not a pop-in, however tight the frame is. */
export const INTRO_TRAVEL_X_MIN = 0.35;

/** Resampling ~20 glyph clouds is not something to do on every resize frame. */
export const INTRO_WIDTH_QUANTUM_PX = 16;

/** The authored trajectory, as `bias + span * seed` per axis — the form the
    material's uniforms take. Desktop uses these unchanged. */
const AUTHORED_TRAVEL = {
  originBias: [-1.5, -0.725, -0.65] as const,
  originSpan: [-2.3, 1.45, 1.3] as const,
  windBias: [2.4, 1.7, -1.6] as const,
  windSpan: [3, 2.5, 3.2] as const,
};

export interface IntroLayout {
  name: IntroLayoutName;
  /** Half the visible frame in world units at the text plane. */
  halfWidth: number;
  /** Constant at every viewport: the camera's vertical extent does not depend
      on aspect, which is why only the horizontal solve below is responsive. */
  halfHeight: number;
  /** Hard cap on a rendered line's width, world units. */
  lineMaxWidth: number;
  /** Preferred em size, before the cap binds. */
  fontScale: number;
  finalFontScale: number;
  brandFontScale: number;
  /** World Y of row 0, and the world Y a row consumes. */
  rowTop: number;
  rowGap: number;
  brandY: number;
}

export interface IntroTravel {
  originBias: [number, number, number];
  originSpan: [number, number, number];
  windBias: [number, number, number];
  windSpan: [number, number, number];
}

export function introLayoutName(width: number): IntroLayoutName {
  return width < MOBILE_MAX_WIDTH ? 'mobile' : 'desktop';
}

/**
 * Buckets the width that feeds the glyph resample. The breakpoint itself reads
 * the raw width, so quantising cannot move it.
 */
export function quantizeIntroWidth(width: number): number {
  return Math.round(width / INTRO_WIDTH_QUANTUM_PX) * INTRO_WIDTH_QUANTUM_PX;
}

export function computeIntroLayout(width: number, height: number): IntroLayout {
  const name = introLayoutName(width);
  const mobile = name === 'mobile';
  const { viewWidth, viewHeight } = viewSize(quantizeIntroWidth(width), height);
  const halfWidth = viewWidth / 2;

  /* The authored maximum is art direction — the cap is a ceiling on it, not a
     replacement for it. A 2560px frame does not get 86vw of type. */
  const authoredMax = mobile ? 2.68 : 8.65;
  const lineMaxWidth = Math.min(authoredMax, viewWidth * INTRO_LINE_WIDTH_FRACTION);

  return {
    name,
    halfWidth,
    halfHeight: viewHeight / 2,
    lineMaxWidth,
    fontScale: mobile ? 0.205 : 0.415,
    finalFontScale: mobile ? 0.58 : 0.7,
    brandFontScale: mobile ? 0.235 : 0.38,
    rowTop: mobile ? 0.38 : 0.55,
    rowGap: mobile ? 0.62 : 0.68,
    brandY: mobile ? -1.18 : -1.24,
  };
}

/**
 * Scales the authored trajectory to what the frame can hold.
 *
 * A particle is legible over the middle of its path, so containment is only
 * required there: `lineHalf + fraction * offset <= halfWidth * safe`. Solving
 * for the offset gives the allowance, and the authored span is kept whenever it
 * already fits — which it does at every desktop viewport.
 *
 * Only X and Z move. The vertical extent of this camera is the same 6.79 world
 * units at every viewport, and the authored Y spans clear it with room to
 * spare at both ends. Z is scaled alongside X because depth is not free: moving
 * toward the camera magnifies a particle's screen position, and an unscaled Z
 * would spend the horizontal margin this function just solved for.
 *
 * Takes the line's achieved width rather than the cap, so a short line keeps
 * the travel a full-width one cannot have.
 */
export function introTravel(
  halfWidth: number,
  lineWidth: number,
  name: IntroLayoutName = 'mobile',
): IntroTravel {
  const [ox, oy, oz] = AUTHORED_TRAVEL.originBias;
  const [osx, osy, osz] = AUTHORED_TRAVEL.originSpan;
  const [wx, wy, wz] = AUTHORED_TRAVEL.windBias;
  const [wsx, wsy, wsz] = AUTHORED_TRAVEL.windSpan;

  /* Desktop keeps the authored trajectory. Its frame is three times wider in
     world units than a phone's and nothing clips there; scaling it would be
     changing a composition that works to satisfy a bound written for one that
     does not. The failure this solves is a mobile one, and so is the fix. */
  if (name === 'desktop') {
    return {
      originBias: [ox, oy, oz],
      originSpan: [osx, osy, osz],
      windBias: [wx, wy, wz],
      windSpan: [wsx, wsy, wsz],
    };
  }

  const scaleFor = (fraction: number, authoredX: number, authoredZ: number) => {
    /* Depth costs width: a particle pulled toward the camera projects further
       out, so the horizontal allowance depends on the scale being solved for.
       The passes only ever tighten — a smaller scale means less depth, which
       would allow more width, and taking the minimum keeps the earlier, harder
       bound. That makes the result conservative by construction rather than by
       convergence. */
    let scale = 1;
    for (let pass = 0; pass < 3; pass++) {
      const z = authoredZ * scale * fraction;
      const magnify = CAMERA_Z / Math.max(0.001, CAMERA_Z - z);
      const room = Math.max(0, (halfWidth * INTRO_SAFE_FRACTION) / magnify - lineWidth / 2);
      scale = Math.min(scale, room / fraction / authoredX);
    }
    /* The floor is applied last and deliberately outranks the bound: a frame
       too tight for a slide gets a short one rather than a pop-in. It shrinks
       the depth along with the width, so it stays close to the bound it
       crosses. */
    return Math.min(1, Math.max(scale, INTRO_TRAVEL_X_MIN / authoredX));
  };

  // `|bias| + |span|` is the furthest a seed can push a particle on that axis.
  const reachOf = (bias: readonly number[], span: readonly number[], axis: number) =>
    Math.abs(bias[axis]) + Math.abs(span[axis]);
  const entry = scaleFor(
    INTRO_ENTRY_LEGIBLE_FRACTION,
    reachOf(AUTHORED_TRAVEL.originBias, AUTHORED_TRAVEL.originSpan, 0),
    reachOf(AUTHORED_TRAVEL.originBias, AUTHORED_TRAVEL.originSpan, 2),
  );
  const exit = scaleFor(
    INTRO_EXIT_LEGIBLE_FRACTION,
    reachOf(AUTHORED_TRAVEL.windBias, AUTHORED_TRAVEL.windSpan, 0),
    reachOf(AUTHORED_TRAVEL.windBias, AUTHORED_TRAVEL.windSpan, 2),
  );

  return {
    originBias: [ox * entry, oy, oz * entry],
    originSpan: [osx * entry, osy, osz * entry],
    windBias: [wx * exit, wy, wz * exit],
    windSpan: [wsx * exit, wsy, wsz * exit],
  };
}

/**
 * The furthest a legible particle of this line reaches from the frame's centre,
 * horizontally, including the magnification its depth buys it. The containment
 * test asserts on this; nothing in the render path needs it.
 */
export function introTravelReach(
  travel: IntroTravel,
  lineWidth: number,
): { entry: number; exit: number } {
  const reach = (
    bias: readonly [number, number, number],
    span: readonly [number, number, number],
    fraction: number,
  ) => {
    const x = (Math.abs(bias[0]) + Math.abs(span[0])) * fraction;
    const z = (Math.abs(bias[2]) + Math.abs(span[2])) * fraction;
    const magnify = CAMERA_Z / Math.max(0.001, CAMERA_Z - z);
    return (lineWidth / 2 + x) * magnify;
  };
  return {
    entry: reach(travel.originBias, travel.originSpan, INTRO_ENTRY_LEGIBLE_FRACTION),
    exit: reach(travel.windBias, travel.windSpan, INTRO_EXIT_LEGIBLE_FRACTION),
  };
}

/** Where the particle budget starts, as a fraction of its full value. */
export const INTRO_BUDGET_RAMP_START = 0.72;

export interface IntroLineBudget {
  maxParticles: number;
  density: number;
}

/**
 * The cloud is thinnest at the opening line and reaches full density by the
 * closing one.
 *
 * `density` is a request — `max(850, characters * density)` — and `maxParticles`
 * is the cap. Every line but "Join us." asks for well over its cap on both
 * layouts, so `density` is inert there and the cap is the dial that actually
 * moves. Both ramp, so the short line thins too.
 *
 * Line index is time: the rolling timeline enters one line per 1.25s, so a
 * ramp over the index is a ramp over the intro without a single runtime dial.
 * It also thins the clouds during the seconds the lion is still assembling,
 * which is where the frame budget is tightest.
 */
export function introLineBudget(
  index: number,
  count: number,
  name: IntroLayoutName,
  lightweight: boolean,
): IntroLineBudget {
  const final = index === count - 1;
  const mobile = name === 'mobile';
  const fullParticles = lightweight
    ? final
      ? 5_200
      : 5_400
    : final
      ? 7_000
      : mobile
        ? 5_200
        : 7_500;
  const fullDensity = lightweight ? 350 : final ? 500 : mobile ? 390 : 440;
  const progress = count > 1 ? index / (count - 1) : 1;
  const ramp = INTRO_BUDGET_RAMP_START + (1 - INTRO_BUDGET_RAMP_START) * progress;
  return {
    maxParticles: Math.round(fullParticles * ramp),
    density: Math.round(fullDensity * ramp),
  };
}

export { CAMERA_FOV, CAMERA_Z };
