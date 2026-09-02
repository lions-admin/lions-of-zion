'use client';
/**
 * Layer 1 — a full-screen network scan made only from particle sprites.
 * Horizontal traces are seeded geometry; labels and platform glyphs are
 * sampled from a temporary canvas into point positions (no texture is used by
 * the renderer). A dark exclusion mask is authored into the point layout so
 * the lion, spokes and navigation labels retain hierarchy.
 */
import { useEffect, useMemo, useState } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sprite } from 'three/webgpu';
import { NODE_Z, nodePosition, type OrbitLayout } from '../config';
import {
  createNetworkScanMaterial,
  type NetworkScanMaterialHandle,
} from '../tsl/networkScanMaterial';
import { loadScanFragments, type ScanFragment } from '../scanCorpus';
import type { ParticleNavTheme, SimParams } from '../types';

const CAMERA_Z = 8.2;
const FOV = 45;
const FIELD_Z = -1.35;
/**
 * Maps a point on the node plane to the field plane position that covers it on
 * screen. Nodes sit at NODE_Z, not at the origin — dividing by CAMERA_Z drew
 * every keep-out about 4% small, which is why hand-placed labels grazed the
 * rings they were supposed to clear.
 */
const NODE_TO_FIELD = (CAMERA_Z - FIELD_Z) / (CAMERA_Z - NODE_Z);

interface PointCloudData {
  field: Float32Array;
  wordsHostile: Float32Array;
  wordsVerified: Float32Array;
  glyphs: Float32Array;
  halfWidth: number;
  halfHeight: number;
}

interface LabelSpec {
  text: string;
  x: number;
  y: number;
}

type PlatformGlyph = 'x' | 'instagram' | 'telegram' | 'tiktok' | 'youtube';

interface IconSpec {
  icon: PlatformGlyph;
  x: number;
  y: number;
}

/*
 * The glyph layer is the readable one: the largest, brightest, slowest marks
 * on the first screen, and the only copy a visitor finishes reading before
 * they touch anything. It used to be ten hostile labels out of ten — a threat
 * board on a site whose whole differentiator is that it issues verdicts.
 *
 * The lower diagonal now carries the verdict side. It stays one palette on
 * purpose: `buildGlyphs` writes a single merged buffer rendered by one Sprite
 * with one ramp, so a second colour would mean a second buffer, material and
 * draw call — not a free addition. Every replacement is also no wider than
 * the string it replaced (`appendCanvasParticles` scales by height, so width
 * follows the line count and the longest line), which is what keeps the
 * placement solved for the composition that was captured.
 */
const DESKTOP_LABELS: LabelSpec[] = [
  { text: 'DISINFORMATION\nNETWORK', x: -0.76, y: 0.76 },
  { text: 'FAKE NEWS\nFACTORY', x: 0.67, y: 0.83 },
  { text: 'INCITEMENT\nSIGNAL', x: -0.43, y: 0.61 },
  { text: 'HOSTILE\nINFLUENCE', x: -0.77, y: 0.39 },
  { text: 'COORDINATED\nNARRATIVE', x: 0.71, y: 0.36 },
  { text: 'BOT CLUSTER', x: 0.55, y: -0.16 },
  { text: 'ANTI-ISRAEL\nCAMPAIGN', x: -0.56, y: -0.38 },
  { text: 'CROSS\nCHECKED', x: 0.72, y: -0.44 },
  { text: 'CORRECTION\nLOGGED', x: 0.33, y: -0.69 },
  { text: 'SOURCE\nCONFIRMED', x: -0.36, y: -0.73 },
];

/* The phone set is a subset of the desktop one and stays one — including the
   verdict it now ends on. */
const MOBILE_LABELS: LabelSpec[] = [
  { text: 'DISINFORMATION\nNETWORK', x: -0.5, y: 0.76 },
  { text: 'FAKE NEWS\nFACTORY', x: 0.48, y: 0.83 },
  { text: 'HOSTILE\nINFLUENCE', x: -0.55, y: 0.39 },
  { text: 'COORDINATED\nNARRATIVE', x: 0.5, y: 0.36 },
  { text: 'ANTI-ISRAEL\nCAMPAIGN', x: -0.42, y: -0.38 },
  { text: 'SOURCE\nCONFIRMED', x: 0.4, y: -0.69 },
];

const DESKTOP_ICONS: IconSpec[] = [
  { icon: 'x', x: 0.84, y: 0.61 },
  { icon: 'instagram', x: 0.58, y: 0.16 },
  { icon: 'telegram', x: -0.81, y: 0.18 },
  { icon: 'tiktok', x: -0.83, y: -0.31 },
  { icon: 'youtube', x: -0.75, y: -0.63 },
];

const MOBILE_ICONS: IconSpec[] = [
  { icon: 'x', x: 0.7, y: 0.61 },
  { icon: 'instagram', x: 0.65, y: 0.16 },
  { icon: 'telegram', x: -0.68, y: 0.18 },
];

/**
 * Shown only until the monitoring corpus loads, so the field is never empty on
 * the first frames. Deliberately generic: the real copy is editorial content
 * with sources, and lives in `public/matrix/`.
 */
const FALLBACK_FRAGMENTS: ScanFragment[] = [
  { text: 'SCANNING NETWORK', tone: 'neutral' },
  { text: 'SOURCE MONITOR: open channels', tone: 'neutral' },
  { text: 'TRACE: propagation path', tone: 'amber' },
  { text: 'AWAITING CORPUS', tone: 'blue' },
];

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

function distanceToSegment(
  px: number,
  py: number,
  ax: number,
  ay: number,
  bx: number,
  by: number,
) {
  const abx = bx - ax;
  const aby = by - ay;
  const lengthSq = abx * abx + aby * aby;
  const t = lengthSq === 0 ? 0 : Math.max(0, Math.min(1, ((px - ax) * abx + (py - ay) * aby) / lengthSq));
  return Math.hypot(px - (ax + abx * t), py - (ay + aby * t));
}

function createExclusionTest(orbit: OrbitLayout, count: number, depthScale: number) {
  const nodes = Array.from({ length: count }, (_, i) => {
    const [x, y] = nodePosition(i, count, orbit);
    return { x: x * depthScale, y: y * depthScale };
  });
  const centreX = 1.34 * orbit.centerScale * depthScale;
  const centreY = 1.18 * orbit.centerScale * depthScale;
  const nodeGap = (orbit.nodeVisualRadius + 0.22) * depthScale;

  return (x: number, y: number) => {
    if ((x / centreX) ** 2 + (y / centreY) ** 2 < 1) return true;
    for (const node of nodes) {
      if (Math.hypot(x - node.x, y - node.y) < nodeGap) return true;
      if (distanceToSegment(x, y, 0, 0, node.x, node.y) < 0.075 * depthScale) return true;
    }
    return false;
  };
}

function buildScanField(
  halfWidth: number,
  halfHeight: number,
  pointBudget: number,
  orbit: OrbitLayout,
) {
  const rng = mulberry32(0x5ca11fab);
  const out: number[] = [];
  const depthScale = NODE_TO_FIELD;
  const excluded = createExclusionTest(orbit, 8, depthScale);
  const rows = pointBudget <= 8_000 ? 32 : 52;

  const push = (x: number, y: number, size: number, seed: number) => {
    if (out.length >= pointBudget * 4 || excluded(x, y)) return;
    out.push(x, y, size, seed);
  };

  const perRowBudget = Math.floor(pointBudget / rows);
  for (let row = 0; row < rows; row++) {
    const rowStart = out.length;
    const y = -halfHeight + ((row + 0.5) / rows) * halfHeight * 2 + (rng() - 0.5) * 0.055;
    let cursor = -halfWidth - rng() * 0.35;
    while (cursor < halfWidth && (out.length - rowStart) / 4 < perRowBudget) {
      cursor += 0.035 + rng() * 0.18;
      const length = 0.16 + rng() * Math.min(1.2, halfWidth * 0.32);
      const spacing = 0.013 + rng() * 0.018;
      for (let x = cursor; x < Math.min(halfWidth, cursor + length); x += spacing) {
        if (rng() > 0.18) push(x, y + (rng() - 0.5) * 0.009, rng(), rng());
      }

      if (rng() > 0.72) {
        const markerX = Math.min(halfWidth - 0.03, cursor + length);
        const markerHalf = 0.025 + rng() * 0.018;
        for (let d = -markerHalf; d <= markerHalf; d += 0.012) {
          push(markerX - markerHalf, y + d, 0.72, rng());
          push(markerX + markerHalf, y + d, 0.72, rng());
          push(markerX + d, y - markerHalf, 0.72, rng());
          push(markerX + d, y + markerHalf, 0.72, rng());
        }
      }
      cursor += length;
    }
  }

  // Fill any remaining budget with more horizontal micro-streams, never with
  // free-floating dust — the background must read as a scan, not a starfield.
  let guard = 0;
  while (out.length < pointBudget * 4 && guard++ < pointBudget) {
    const row = Math.floor(rng() * rows);
    const y = -halfHeight + ((row + 0.5) / rows) * halfHeight * 2 + (rng() - 0.5) * 0.012;
    const x0 = -halfWidth + rng() * halfWidth * 2;
    const length = 0.1 + rng() * 0.48;
    const spacing = 0.012 + rng() * 0.016;
    for (let x = x0; x < Math.min(halfWidth, x0 + length); x += spacing) {
      push(x, y, rng(), rng());
    }
  }

  return new Float32Array(out);
}

function appendCanvasParticles(
  output: number[],
  canvas: HTMLCanvasElement,
  x: number,
  y: number,
  targetHeight: number,
  seed: number,
  stride = 2,
  keep = 0.965,
) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const scale = targetHeight / canvas.height;
  const left = x - (canvas.width * scale) / 2;
  const top = y + (canvas.height * scale) / 2;
  const rng = mulberry32(seed);

  // Stride 2 over a canvas drawn at ~1.75x: the glyph outline is resolved
  // finely enough that a stroke gets three samples across instead of one, and
  // the low alpha cutoff keeps the antialiased rim that defines the edge.
  for (let py = 0; py < canvas.height; py += stride) {
    for (let px = 0; px < canvas.width; px += stride) {
      const alpha = pixels[(py * canvas.width + px) * 4 + 3];
      if (alpha > 64 && rng() < keep) {
        output.push(left + px * scale, top - py * scale, 0.55 + rng() * 0.45, rng());
      }
    }
  }
}

/**
 * The scan's own threshold, and deliberately not `MOBILE_MAX_WIDTH`.
 *
 * What "compact" switches is density: four fewer labels, two fewer platform
 * glyphs, tighter line and icon heights, and x positions pulled inward from
 * ±0.76 to ±0.5. It is a fit threshold, not an orbit-avoidance one — the
 * glyph sprite is punched with `nodeHoles` and `heroHole` derived from the
 * live orbit at any width, so labels never collide with the nodes regardless
 * of what this says. Raising it to 720 would visibly strip six marks out of
 * the whole 620–719 band, which is a composition change and needs a capture,
 * not a constant swap.
 */
const SCAN_COMPACT_MAX_WIDTH = 620;


const SANS_STACK = 'Arial, sans-serif';
const MONO_STACK = 'ui-monospace, "SF Mono", Menlo, Consolas, monospace';

function makeTextCanvas(text: string, fontPx = 44, weight = 600, family = SANS_STACK) {
  const lines = text.split('\n');
  const lineHeight = Math.round(fontPx * 1.25);
  const pad = Math.round(fontPx * 0.45);
  const font = `${weight} ${fontPx}px ${family}`;
  const canvas = document.createElement('canvas');
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return canvas;
  measure.font = font;
  canvas.width = Math.ceil(
    Math.max(...lines.map((line) => measure.measureText(line).width)) + pad * 1.6,
  );
  canvas.height = lines.length * lineHeight + pad;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  context.font = font;
  context.textAlign = 'center';
  context.textBaseline = 'top';
  lines.forEach((line, i) => context.fillText(line, canvas.width / 2, pad / 2 + i * lineHeight));
  return canvas;
}

function makeIconCanvas(icon: PlatformGlyph) {
  const canvas = document.createElement('canvas');
  // Authored on a 72 grid, rasterised at 128 so stroke interiors carry
  // particles rather than a single sampled row.
  const grid = 72;
  canvas.width = 128;
  canvas.height = 128;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.scale(canvas.width / grid, canvas.height / grid);
  context.strokeStyle = '#fff';
  context.fillStyle = '#fff';
  context.lineWidth = 3.4;
  context.lineCap = 'round';
  context.lineJoin = 'round';

  // Particle corner brackets make every glyph read as a detected signal.
  for (const [sx, sy] of [[1, 1], [-1, 1], [1, -1], [-1, -1]] as const) {
    const cx = sx > 0 ? 7 : 65;
    const cy = sy > 0 ? 7 : 65;
    context.beginPath();
    context.moveTo(cx, cy + sy * 9);
    context.lineTo(cx, cy);
    context.lineTo(cx + sx * 9, cy);
    context.stroke();
  }

  context.beginPath();
  if (icon === 'x') {
    context.moveTo(25, 22);
    context.lineTo(48, 50);
    context.moveTo(48, 22);
    context.lineTo(25, 50);
    context.stroke();
  } else if (icon === 'instagram') {
    context.roundRect(20, 19, 33, 34, 8);
    context.stroke();
    context.beginPath();
    context.arc(36.5, 36, 8, 0, Math.PI * 2);
    context.stroke();
    context.beginPath();
    context.arc(47, 25, 2.3, 0, Math.PI * 2);
    context.fill();
  } else if (icon === 'telegram') {
    context.moveTo(17, 35);
    context.lineTo(55, 21);
    context.lineTo(45, 53);
    context.lineTo(34, 42);
    context.lineTo(27, 48);
    context.lineTo(28, 39);
    context.closePath();
    context.stroke();
  } else if (icon === 'tiktok') {
    context.moveTo(40, 19);
    context.lineTo(40, 45);
    context.arc(31, 46, 9, -0.15, Math.PI * 1.7);
    context.moveTo(40, 21);
    context.quadraticCurveTo(45, 29, 53, 29);
    context.stroke();
  } else {
    context.roundRect(17, 23, 39, 27, 7);
    context.stroke();
    context.beginPath();
    context.moveTo(32, 29);
    context.lineTo(45, 36.5);
    context.lineTo(32, 44);
    context.closePath();
    context.stroke();
  }
  return canvas;
}

/**
 * Fragments running across the scan field like terminal output.
 *
 * Two streams, split by the corpus tone legend and sent in opposite
 * directions: hostile narratives and claims under review run one way, fact
 * checks and monitored context run the other. Direction carries the meaning
 * because it is already a per-layer constant — the single flow rate that keeps
 * a line's characters together also fixes which way it travels.
 *
 * Nothing here shortens a fragment; see the rule in `scanCorpus.ts`. Long
 * lines simply run past the edge and wrap, which is what terminal output does.
 */
function buildScanWords(
  halfWidth: number,
  halfHeight: number,
  compact: boolean,
  fragments: ScanFragment[],
) {
  const rng = mulberry32(0x7ab1e5);
  const hostile: number[] = [];
  const verified: number[] = [];
  const lineHeight = compact ? 0.075 : 0.1;
  const rows = compact ? 32 : 52;
  const rowStep = compact ? 4 : 2;

  const hostilePool = fragments.filter((f) => f.tone === 'red' || f.tone === 'amber');
  const verifiedPool = fragments.filter((f) => f.tone === 'blue' || f.tone === 'neutral');

  // Rows alternate between the streams rather than sampling the corpus by its
  // real proportions — it holds far more hostile material than fact checks,
  // and a background that is 85% red is a mood, not a monitor.
  let index = 0;
  for (let row = 2; row < rows; row += rowStep) {
    const toHostile = index % 2 === 0;
    const pool = toHostile ? hostilePool : verifiedPool;
    const source = pool.length > 0 ? pool : fragments;
    if (source.length === 0) break;
    const fragment = source[Math.floor(rng() * source.length)];
    const y = -halfHeight + ((row + 0.5) / rows) * halfHeight * 2;
    const halfSpan = fragment.text.length * lineHeight * 0.175;
    const x = (rng() * 2 - 1) * Math.max(0.05, halfWidth - halfSpan);
    appendCanvasParticles(
      toHostile ? hostile : verified,
      makeTextCanvas(fragment.text, 15, 500, MONO_STACK),
      x,
      y,
      lineHeight,
      4201 + row * 89,
      2,
      0.86,
    );
    index += 1;
  }

  return {
    hostile: new Float32Array(hostile),
    verified: new Float32Array(verified),
  };
}

function buildGlyphs(halfWidth: number, halfHeight: number, compact: boolean) {
  const output: number[] = [];
  const labels = compact ? MOBILE_LABELS : DESKTOP_LABELS;
  const icons = compact ? MOBILE_ICONS : DESKTOP_ICONS;
  const lineHeight = compact ? 0.13 : 0.18;
  const iconHeight = compact ? 0.25 : 0.34;

  labels.forEach((spec, i) => {
    appendCanvasParticles(
      output,
      makeTextCanvas(spec.text),
      spec.x * halfWidth,
      spec.y * halfHeight,
      Math.max(compact ? 0.16 : 0.21, spec.text.split('\n').length * lineHeight),
      7001 + i * 137,
    );
  });
  icons.forEach((spec, i) => {
    appendCanvasParticles(
      output,
      makeIconCanvas(spec.icon),
      spec.x * halfWidth,
      spec.y * halfHeight,
      iconHeight,
      9109 + i * 211,
    );
  });

  return new Float32Array(output);
}

function disposeHandle(handle: NetworkScanMaterialHandle) {
  handle.material.dispose();
  (handle.storage as unknown as { value?: { dispose(): void }; dispose?: () => void }).value?.dispose();
  (handle.storage as unknown as { dispose?: () => void }).dispose?.();
}

export interface NetworkScanProps {
  orbit: OrbitLayout;
  theme: ParticleNavTheme;
  reducedMotion: boolean;
  pxToWorldRef: { current: number };
  dprRef: { current: number };
  pointBudget: number;
  params: SimParams;
}

export function NetworkScan({
  orbit,
  theme,
  reducedMotion,
  pxToWorldRef,
  dprRef,
  pointBudget,
  params,
}: NetworkScanProps) {
  const size = useThree((state) => state.size);
  const [fragments, setFragments] = useState<ScanFragment[]>(FALLBACK_FRAGMENTS);

  useEffect(() => {
    const controller = new AbortController();
    loadScanFragments(controller.signal)
      .then((loaded) => setFragments(loaded))
      .catch((error: unknown) => {
        if (controller.signal.aborted) return;
        // The background is decoration: a missing corpus degrades to the
        // fallback lines rather than taking the scene down.
        console.warn('[particle-nav] scan corpus unavailable:', error);
      });
    return () => controller.abort();
  }, []);

  const data = useMemo<PointCloudData>(() => {
    const distance = CAMERA_Z - FIELD_Z;
    const viewHeight = 2 * distance * Math.tan((FOV * Math.PI) / 360);
    const viewWidth = viewHeight * (size.width / Math.max(1, size.height));
    const halfWidth = viewWidth * 0.52;
    const halfHeight = viewHeight * 0.52;
    const words = buildScanWords(halfWidth, halfHeight, size.width < SCAN_COMPACT_MAX_WIDTH, fragments);
    return {
      field: buildScanField(halfWidth, halfHeight, pointBudget, orbit),
      wordsHostile: words.hostile,
      wordsVerified: words.verified,
      glyphs: buildGlyphs(halfWidth, halfHeight, size.width < SCAN_COMPACT_MAX_WIDTH),
      halfWidth,
      halfHeight,
    };
  }, [fragments, orbit, pointBudget, size.height, size.width]);

  const built = useMemo(() => {
    const depthScale = NODE_TO_FIELD;
    // One hole per node, sized to the ring plus the DOM label hanging under it.
    const nodeHoles = Array.from({ length: 8 }, (_, i) => {
      const [nx, ny] = nodePosition(i, 8, orbit);
      const ring = orbit.nodeVisualRadius * depthScale;
      return {
        x: nx * depthScale,
        y: ny * depthScale - 0.14,
        hx: Math.max(ring + 0.14, 0.62),
        hy: ring + 0.32,
      };
    });
    const heroHole = {
      maskX: 1.62 * orbit.centerScale * depthScale,
      maskY: 1.42 * orbit.centerScale * depthScale,
    };
    const field = createNetworkScanMaterial(data.field, theme, {
      z: FIELD_Z,
      halfWidth: data.halfWidth,
      halfHeight: data.halfHeight,
      minSizePx: 0.55,
      maxSizePx: 1.15,
      opacity: 0.3,
      flow: true,
      scan: true,
      bright: false,
      edgeSoftness: 0.14,
      nodeHoles,
      ...heroHole,
    });
    const wordOptions = {
      z: FIELD_Z + 0.03,
      halfWidth: data.halfWidth,
      halfHeight: data.halfHeight,
      minSizePx: 0.58,
      maxSizePx: 1,
      opacity: 0.52,
      alphaFloor: 0.72,
      shimmerMin: 0.86,
      flow: true as const,
      scan: true as const,
      bright: false as const,
      edgeSoftness: 0.3,
      nodeHoles,
      ...heroHole,
    };
    // Opposite rates, and not a simple negation of each other: two sheets
    // sliding at mirrored speeds read as one mechanism, which is the thing
    // terminal output never looks like.
    const wordsHostile = createNetworkScanMaterial(data.wordsHostile, theme, {
      ...wordOptions,
      flowSpeed: -0.05,
      // A third hue in a gold-and-blue composition has to stay an ember. This
      // one is desaturated well below the lion so it never competes at centre.
      palette: { dim: '#7A4048', live: '#A85A61', peak: '#D08D94' },
    });
    const wordsVerified = createNetworkScanMaterial(data.wordsVerified, theme, {
      ...wordOptions,
      flowSpeed: 0.037,
      palette: { dim: '#3E7FA8', live: theme.starBlue, peak: '#9ADFFF' },
    });
    const glyphs = createNetworkScanMaterial(data.glyphs, theme, {
      z: FIELD_Z + 0.08,
      halfWidth: data.halfWidth,
      halfHeight: data.halfHeight,
      minSizePx: 0.8,
      maxSizePx: 1.24,
      opacity: 0.55,
      // Slower than the matrix rows: these are the readable ones, and copy you
      // are meant to finish reading cannot travel at ticker speed.
      flow: true,
      flowSpeed: 0.011,
      scan: true,
      bright: true,
      edgeSoftness: 0.34,
      nodeHoles,
      ...heroHole,
    });
    const fieldSprite = new Sprite(field.material);
    fieldSprite.count = data.field.length / 4;
    fieldSprite.frustumCulled = false;
    fieldSprite.renderOrder = -30;
    const hostileSprite = new Sprite(wordsHostile.material);
    hostileSprite.count = data.wordsHostile.length / 4;
    hostileSprite.frustumCulled = false;
    hostileSprite.renderOrder = -29.5;
    const verifiedSprite = new Sprite(wordsVerified.material);
    verifiedSprite.count = data.wordsVerified.length / 4;
    verifiedSprite.frustumCulled = false;
    verifiedSprite.renderOrder = -29.5;
    const glyphSprite = new Sprite(glyphs.material);
    glyphSprite.count = data.glyphs.length / 4;
    glyphSprite.frustumCulled = false;
    glyphSprite.renderOrder = -29;
    return {
      field,
      wordsHostile,
      wordsVerified,
      glyphs,
      fieldSprite,
      hostileSprite,
      verifiedSprite,
      glyphSprite,
    };
  }, [data, orbit, theme]);

  useFrame(() => {
    for (const handle of [built.field, built.wordsHostile, built.wordsVerified, built.glyphs]) {
      (handle.uniforms.pxToWorld as { value: number }).value = pxToWorldRef.current;
      (handle.uniforms.dpr as { value: number }).value = dprRef.current;
      (handle.uniforms.reducedMotion as { value: number }).value = reducedMotion ? 1 : 0;
    }
    (built.field.uniforms.opacity as { value: number }).value = params.scanFieldOpacity;
    for (const handle of [built.wordsHostile, built.wordsVerified]) {
      (handle.uniforms.opacity as { value: number }).value = params.scanWordOpacity;
    }
    (built.glyphs.uniforms.opacity as { value: number }).value = params.scanGlyphOpacity;
  });

  useEffect(
    () => () => {
      disposeHandle(built.field);
      disposeHandle(built.wordsHostile);
      disposeHandle(built.wordsVerified);
      disposeHandle(built.glyphs);
    },
    [built],
  );

  return (
    <>
      <primitive object={built.fieldSprite} />
      <primitive object={built.hostileSprite} />
      <primitive object={built.verifiedSprite} />
      <primitive object={built.glyphSprite} />
    </>
  );
}
