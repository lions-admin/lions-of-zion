import type { NavNode, ParticleNavTheme, SimParams } from './types';

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
 * The shipping simulation dials — every one is exposed on `/particle-demo`.
 *
 * These were the brief's starting points and were never tuned against a
 * capture, so "calibrated" was the wrong word for three of them, which ship
 * at 0 and therefore do nothing at all:
 *
 *   - `curlAmp: 0` zeroes the lion's ambient drift in both branches of
 *     `lionCompute.ts` (`curlAmp.mul(6)` and `curlAmp.mul(60)`);
 *   - `repelStrength: 0` zeroes pointer repulsion;
 *   - `idleRotateDegPerSec: 0` holds the rig and the orbital rings still.
 *
 * Restoring any of them is a visual decision that needs a real-Chrome capture
 * — idle rotation especially, because `Scene.tsx` rotates the whole rig and
 * reads `rig.rotation.z` back into the activate-dolly direction, so a nonzero
 * value drifts the projected DOM label geometry too and has to be checked
 * against `OrbitLayout`'s eight-links-in-viewport invariant. The scene is not
 * motionless meanwhile: pointer parallax, hover particle streams and the
 * connector pulse all run.
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
  streamDurationMs: 700,
  returnDurationMs: 900,
  pointSizeMin: 0.9,
  pointSizeMax: 1.85,
  scanFieldOpacity: 0.3,
  scanWordOpacity: 0.52,
  scanGlyphOpacity: 0.55,
  bloomThreshold: 0.46,
  bloomStrength: 0.38,
  bloomRadius: 0.26,
  idleRotateDegPerSec: 0,
  parallaxDeg: 1.25,
  parallaxDamping: 0.08,
  pulseLoopSec: 4.2,
  pulseStaggerSec: 0.35,
  activateImpulse: 2.4,
  activateDollyDistance: 0.8,
};

/** UI ranges for the dev control panel + README tunables table. */
export const simParamRanges: Record<keyof SimParams, [number, number, number]> = {
  springStiffness: [2, 20, 0.1], // below ~6 the lion dissolves
  springDamping: [0.7, 0.99, 0.005],
  curlAmp: [0, 0.08, 0.001],
  curlFreq: [0.2, 6, 0.05],
  curlTimescale: [0, 1, 0.01],
  repelRadius: [0.05, 1.2, 0.01],
  repelStrength: [0, 6, 0.05],
  streamFraction: [0, 0.4, 0.01],
  streamDurationMs: [100, 2000, 10],
  returnDurationMs: [100, 2500, 10],
  pointSizeMin: [0.5, 4, 0.05],
  pointSizeMax: [0.5, 6, 0.05],
  // the ambient scan and its readable glyphs are tuned against each other,
  // so both are on the demo panel rather than baked into the layer
  scanFieldOpacity: [0, 1, 0.01],
  scanWordOpacity: [0, 1, 0.01],
  scanGlyphOpacity: [0, 1, 0.01],
  bloomThreshold: [0, 1, 0.01],
  bloomStrength: [0, 2, 0.01], // over-bloom is what makes particle work look cheap
  bloomRadius: [0, 1, 0.01],
  idleRotateDegPerSec: [0, 4, 0.05],
  parallaxDeg: [0, 10, 0.1],
  parallaxDamping: [0.01, 0.3, 0.005],
  pulseLoopSec: [1, 10, 0.1],
  pulseStaggerSec: [0, 1, 0.01],
  activateImpulse: [0, 8, 0.1],
  activateDollyDistance: [0, 3, 0.05],
};

export const NAVIGATE_AT_MS = 320; // navigation never waits for the animation (brief §7)
export const CANVAS_FADE_MS = 180;

/*
 * The eight destinations, and the one array that carries three contracts:
 * `nodeAngle` maps index straight to a clockwise spoke, `NavLinks` renders in
 * array order so index is also DOM and tab order, and `index + 1` is the
 * "File NN / 08" identity the front-page band and every section page print.
 *
 * `we-are` and `support-us` are swapped from the original order for the
 * second of those. On a radial arrangement where all eight labels are visible
 * and equally styled, "clockwise reading order" is a weak claim — but tab
 * order genuinely is sequential, and it used to put the donate/join ask
 * second, before a visitor had been told who this is or seen a verified
 * claim, with the page that answers "who are you and why should I believe
 * you" last. Now identity is second and the ask is last. The intent sequence
 * is unchanged (both nodes are `participate`), and the two file numbers that
 * moved are derived everywhere they appear.
 */
export const defaultNodes: NavNode[] = [
  {
    id: 'geopolitical-brief',
    label: 'GEOPOLITICAL BRIEF',
    displayName: 'Geopolitical Brief',
    href: '/geopolitical-brief',
    description: 'The daily strategic picture: verified developments, their context, and what they change.',
    iconSdfUrl: '/icons/geopolitical-brief.sdf.png',
    intent: 'now',
  },
  {
    id: 'we-are',
    label: 'WE ARE',
    displayName: 'We Are',
    href: '/we-are',
    description: 'Who Lions of Zion are, why this network exists, and how it works.',
    iconSdfUrl: '/icons/we-are.sdf.png',
    intent: 'participate',
  },
  {
    id: 'war-update',
    label: 'WAR UPDATE',
    displayName: 'War Update',
    href: '/war-update',
    description: 'Sourced, time-stamped updates from the front and the home front.',
    iconSdfUrl: '/icons/war-update.sdf.png',
    intent: 'now',
  },
  {
    id: 'october-7',
    label: 'OCTOBER 7',
    displayName: 'October 7',
    href: '/october-7',
    description: 'The record of October 7: testimony, evidence, and remembrance.',
    iconSdfUrl: '/icons/october-7.sdf.png',
    intent: 'understand',
  },
  {
    id: 'our-heroes',
    label: 'OUR HEROES',
    displayName: 'Our Heroes',
    href: '/our-heroes',
    description: 'The people behind the story: the fallen, the fighters, the rescuers.',
    iconSdfUrl: '/icons/our-heroes.sdf.png',
    intent: 'understand',
  },
  {
    id: 'israels-story',
    label: "ISRAEL'S STORY",
    displayName: "Israel’s Story",
    href: '/israels-story',
    description: 'The long arc: history, identity, and the context the noise leaves out.',
    iconSdfUrl: '/icons/israels-story.sdf.png',
    intent: 'understand',
  },
  {
    id: 'fake-resistance',
    label: 'FAKE RESISTANCE',
    displayName: 'Fake Resistance',
    href: '/fake-resistance',
    description: 'Inside the influence machine: how manufactured outrage is built and amplified.',
    iconSdfUrl: '/icons/fake-resistance.sdf.png',
    intent: 'understand',
  },
  {
    id: 'support-us',
    label: 'SUPPORT US',
    displayName: 'Support Us',
    href: '/support-us',
    description: 'Ways to join the effort: amplify verified truth, contribute skills, sustain the work.',
    iconSdfUrl: '/icons/support-us.sdf.png',
    intent: 'participate',
  },
];

/** Clockwise from 12 o'clock — spoke order is configuration, not geometry. */
export function nodeAngle(index: number, count: number): number {
  return Math.PI / 2 - (index / count) * Math.PI * 2;
}

/**
 * Nodes sit just in front of the lion plane. The brief's layer numbers (+2/+4)
 * are stacking order, not world offsets — large z steps here would perspective-
 * enlarge the ring out of frame at the 8.2-unit camera distance.
 */
export const NODE_Z = 0.3;

export interface SafeAreaInsets {
  top: number;
  right: number;
  bottom: number;
  left: number;
}

/**
 * What a node draws past its nominal ring.
 *
 * `nodeVisualRadius` is the ring, and `SpokeNodes` scales the node unit by
 * `nodeVisualRadius / NODE_RING_RADIUS` so the ring lands exactly on it. Three
 * things are then drawn outside it and none of them were being counted:
 *
 *   - per-particle radial jitter of 0.016 plus a wobble of 0.004, in node-local
 *     units against a 0.46 ring — 4.3% of the radius, hence the ratio;
 *   - a sprite half-size of up to 1.25 CSS px, at up to 2× device pixels;
 *   - the bloom pass, whose `bloomRadius` is a screen-space mip spread with no
 *     world extent to read off, so its contribution can only be measured.
 *
 * The px term covers the last two together. It is empirical: if a node ever
 * clips at a phone viewport again, this is the number to re-measure in real
 * Chrome rather than a reason to shrink the orbit everywhere.
 */
export const NODE_HALO_RATIO = 0.043;
export const NODE_HALO_PX = 12;

/**
 * Extra floor under the bottom node, on phones only.
 *
 * A phone's reported viewport is not the visible one: iOS Safari and Chrome
 * Android overlay a collapsing URL bar across the bottom of it, and
 * `env(safe-area-inset-bottom)` describes the home indicator rather than that
 * bar. So the bottom-centre node can measure as fully on screen and still sit
 * under browser chrome — which is exactly the node the ring puts there.
 *
 * A floor rather than an addition: the home indicator is one instance of what
 * this reserves for, not a second thing to pay for. Desktop gets none of it —
 * there the reported viewport really is the visible one, and charging it here
 * would shrink the orbit for chrome that does not exist.
 */
export const NODE_BOTTOM_RESERVE_PX = 56;

/**
 * The chat launcher's mobile dock, measured from the top of the safe-area
 * inset: a 0.65rem offset, 3.45rem launcher and 0.46rem vertical padding
 * (`particle-chat-launcher.module.css` ≤719px) ≈ 82px of our own bottom
 * chrome, sitting above the home indicator. Charged like the browser's URL
 * bar: the bottom node clears the pill, and the shared edge gap is the
 * breathing room above it. The static mobile index reserves the same band as
 * `5.25rem + var(--safe-bottom)`.
 */
export const CHAT_DOCK_PX = 84;

/**
 * Below this width the layout is the phone one, in every layer that asks *for
 * the layout mode* — the intro's line arrays, the timeline it derives from
 * them, and the CSS breakpoints that hide the wordmark and the no-canvas nav.
 *
 * It is not the only width threshold in the scene, and the others are not
 * bugs: `NetworkScan`'s SCAN_COMPACT_MAX_WIDTH is a label-density threshold,
 * a separate question with a separate answer.
 */
export const MOBILE_MAX_WIDTH = 720;

export interface OrbitLayout {
  radiusX: number;
  radiusY: number;
  /**
   * Outer particle-ring radius in world units at the lion plane. This is also
   * the DOM link's half-box — `styles.module.css` sizes `.link` to the same
   * `clamp(min(w,h) * 0.056, 44, 68)` — and the connector's occlusion boundary.
   * Three contracts on one number: widen the halo, not this.
   */
  nodeVisualRadius: number;
  /** Everything actually drawn: the ring plus jitter, sprite spill and bloom. */
  nodeHaloRadius: number;
  /**
   * World-unit offset of the orbit's centre. A phone reserves more at the
   * bottom (home indicator) than at the top (notch), and collapsing the two
   * with `Math.max` used to charge the orbit the larger of them twice. Solving
   * each edge separately and offsetting the centre raises the bottom node
   * without pushing the top one down.
   */
  centerY: number;
  /** Edge protection in world units, including the node halo. */
  safeInset: { x: number; top: number; bottom: number };
  /** Narrow screens scale the central emblem before squeezing the orbit. */
  centerScale: number;
}

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

export function computeOrbitLayout(
  width: number,
  height: number,
  maxRadius: number,
  safeArea: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 },
): OrbitLayout {
  const minDimension = Math.min(width, Math.max(1, height));
  const { viewHeight, viewWidth, worldPerPx } = viewSize(width, height);

  const nodeRadiusPx = clamp(minDimension * 0.056, 44, 68);
  const haloRadiusPx = nodeRadiusPx * (1 + NODE_HALO_RATIO) + NODE_HALO_PX;
  const edgeGapPx = clamp(minDimension * 0.045, 24, 64);
  const insetX =
    (haloRadiusPx + edgeGapPx + Math.max(safeArea.left, safeArea.right)) * worldPerPx;
  const bottomReservePx =
    width < MOBILE_MAX_WIDTH
      ? Math.max(NODE_BOTTOM_RESERVE_PX, safeArea.bottom + CHAT_DOCK_PX)
      : safeArea.bottom;
  const insetTop = (haloRadiusPx + edgeGapPx + safeArea.top) * worldPerPx;
  const insetBottom = (haloRadiusPx + edgeGapPx + bottomReservePx) * worldPerPx;

  const radiusX = Math.max(0.9, Math.min(maxRadius, viewWidth * 0.5 - insetX));
  const radiusY = Math.max(
    1.25,
    Math.min(maxRadius, (viewHeight - insetTop - insetBottom) / 2),
  );
  const narrowT = clamp((width - 320) / 160, 0, 1);

  return {
    radiusX,
    radiusY,
    nodeVisualRadius: nodeRadiusPx * worldPerPx,
    nodeHaloRadius: haloRadiusPx * worldPerPx,
    /* The band left over runs from `-viewHeight/2 + insetBottom` to
       `+viewHeight/2 - insetTop`; its midpoint is half their difference. */
    centerY: (insetBottom - insetTop) / 2,
    safeInset: { x: insetX, top: insetTop, bottom: insetBottom },
    centerScale: width < 480 ? 0.78 + narrowT * 0.22 : 1,
  };
}

export function nodePosition(
  index: number,
  count: number,
  radius:
    | number
    | (Pick<OrbitLayout, 'radiusX' | 'radiusY'> & Partial<Pick<OrbitLayout, 'centerY'>>),
): [number, number, number] {
  const a = nodeAngle(index, count);
  const circular = typeof radius === 'number';
  const radiusX = circular ? radius : radius.radiusX;
  const radiusY = circular ? radius : radius.radiusY;
  /* Passing a bare number still means a circle centred on the lion, which is
     what the dev harness and the icon bakes want. */
  const centerY = circular ? 0 : (radius.centerY ?? 0);
  return [Math.cos(a) * radiusX, Math.sin(a) * radiusY + centerY, NODE_Z];
}
