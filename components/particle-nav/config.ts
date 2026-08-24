import type { NavNode, ParticleNavTheme, SimParams } from './types';

export const defaultTheme: ParticleNavTheme = {
  background: '#070B14',
  // #C9A24B on #070B14 clears 4.5:1 — do not let it drift dimmer for atmosphere (brief §9).
  gold: '#C9A24B',
  excited: '#FFE9B0',
  hover: '#EFD79A',
  starBlue: '#57A7D9',
};

/** Brief §6 calibrated starting points — every one is exposed on the demo route. */
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

export const defaultNodes: NavNode[] = [
  { id: 'today', label: 'TODAY', href: '/today', iconSdfUrl: '/icons/today.sdf.png' },
  { id: 'verify', label: 'VERIFY', href: '/verify', iconSdfUrl: '/icons/verify.sdf.png' },
  { id: 'the-war', label: 'THE WAR', href: '/the-war', iconSdfUrl: '/icons/the-war.sdf.png' },
  { id: 'october-7', label: 'OCTOBER 7', href: '/october-7', iconSdfUrl: '/icons/october-7.sdf.png' },
  { id: 'stories', label: 'STORIES', href: '/stories', iconSdfUrl: '/icons/stories.sdf.png' },
  {
    id: 'israel-explained',
    label: 'ISRAEL EXPLAINED',
    href: '/israel-explained',
    iconSdfUrl: '/icons/israel-explained.sdf.png',
  },
  { id: 'influence', label: 'INFLUENCE', href: '/influence', iconSdfUrl: '/icons/influence.sdf.png' },
  { id: 'about', label: 'ABOUT', href: '/about', iconSdfUrl: '/icons/about.sdf.png' },
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

export interface OrbitLayout {
  radiusX: number;
  radiusY: number;
  /** Outer particle-ring radius in world units at the lion plane. */
  nodeVisualRadius: number;
  /** Edge protection in world units, including the node radius. */
  safeInset: { x: number; y: number };
  /** Narrow screens scale the central emblem before squeezing the orbit. */
  centerScale: number;
}

const CAMERA_Z = 8.2;
const CAMERA_FOV = 45;

const clamp = (value: number, min: number, max: number) => Math.min(max, Math.max(min, value));

export function computeOrbitLayout(
  width: number,
  height: number,
  maxRadius: number,
  safeArea: SafeAreaInsets = { top: 0, right: 0, bottom: 0, left: 0 },
): OrbitLayout {
  const safeHeight = Math.max(1, height);
  const minDimension = Math.min(width, safeHeight);
  const viewHeight = 2 * CAMERA_Z * Math.tan((CAMERA_FOV * Math.PI) / 360);
  const viewWidth = viewHeight * (width / safeHeight);
  const worldPerPx = viewHeight / safeHeight;

  const nodeRadiusPx = clamp(minDimension * 0.056, 44, 68);
  const edgeGapPx = clamp(minDimension * 0.045, 24, 64);
  const insetX = (nodeRadiusPx + edgeGapPx + Math.max(safeArea.left, safeArea.right)) * worldPerPx;
  const insetY = (nodeRadiusPx + edgeGapPx + Math.max(safeArea.top, safeArea.bottom)) * worldPerPx;

  const radiusX = Math.max(0.9, Math.min(maxRadius, viewWidth * 0.5 - insetX));
  const radiusY = Math.max(1.25, Math.min(maxRadius, viewHeight * 0.5 - insetY));
  const narrowT = clamp((width - 320) / 160, 0, 1);

  return {
    radiusX,
    radiusY,
    nodeVisualRadius: nodeRadiusPx * worldPerPx,
    safeInset: { x: insetX, y: insetY },
    centerScale: width < 480 ? 0.78 + narrowT * 0.22 : 1,
  };
}

export function nodePosition(
  index: number,
  count: number,
  radius: number | Pick<OrbitLayout, 'radiusX' | 'radiusY'>,
): [number, number, number] {
  const a = nodeAngle(index, count);
  const radiusX = typeof radius === 'number' ? radius : radius.radiusX;
  const radiusY = typeof radius === 'number' ? radius : radius.radiusY;
  return [Math.cos(a) * radiusX, Math.sin(a) * radiusY, NODE_Z];
}
