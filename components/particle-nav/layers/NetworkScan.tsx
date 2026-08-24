'use client';
/**
 * Layer 1 — a full-screen network scan made only from particle sprites.
 * Horizontal traces are seeded geometry; labels and platform glyphs are
 * sampled from a temporary canvas into point positions (no texture is used by
 * the renderer). A dark exclusion mask is authored into the point layout so
 * the lion, spokes and navigation labels retain hierarchy.
 */
import { useEffect, useMemo } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Sprite } from 'three/webgpu';
import { nodePosition, type OrbitLayout } from '../config';
import {
  createNetworkScanMaterial,
  type NetworkScanMaterialHandle,
} from '../tsl/networkScanMaterial';
import type { ParticleNavTheme } from '../types';

const CAMERA_Z = 8.2;
const FOV = 45;
const FIELD_Z = -1.35;

interface PointCloudData {
  field: Float32Array;
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

const DESKTOP_LABELS: LabelSpec[] = [
  { text: 'DISINFORMATION\nNETWORK', x: -0.76, y: 0.76 },
  { text: 'FAKE NEWS\nFACTORY', x: 0.67, y: 0.83 },
  { text: 'INCITEMENT\nSIGNAL', x: -0.43, y: 0.61 },
  { text: 'HOSTILE\nINFLUENCE', x: -0.77, y: 0.39 },
  { text: 'COORDINATED\nNARRATIVE', x: 0.71, y: 0.36 },
  { text: 'BOT CLUSTER', x: 0.55, y: -0.16 },
  { text: 'ANTI-ISRAEL\nCAMPAIGN', x: -0.56, y: -0.38 },
  { text: 'NARRATIVE\nSPIKE', x: 0.72, y: -0.44 },
  { text: 'HATE\nAMPLIFICATION', x: 0.33, y: -0.69 },
  { text: 'SOURCE\nUNVERIFIED', x: -0.36, y: -0.73 },
];

const MOBILE_LABELS: LabelSpec[] = [
  { text: 'DISINFORMATION\nNETWORK', x: -0.5, y: 0.76 },
  { text: 'FAKE NEWS\nFACTORY', x: 0.48, y: 0.83 },
  { text: 'HOSTILE\nINFLUENCE', x: -0.55, y: 0.39 },
  { text: 'COORDINATED\nNARRATIVE', x: 0.5, y: 0.36 },
  { text: 'ANTI-ISRAEL\nCAMPAIGN', x: -0.42, y: -0.38 },
  { text: 'HATE\nAMPLIFICATION', x: 0.4, y: -0.69 },
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
  const depthScale = (CAMERA_Z - FIELD_Z) / CAMERA_Z;
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
) {
  const context = canvas.getContext('2d', { willReadFrequently: true });
  if (!context) return;
  const pixels = context.getImageData(0, 0, canvas.width, canvas.height).data;
  const scale = targetHeight / canvas.height;
  const left = x - (canvas.width * scale) / 2;
  const top = y + (canvas.height * scale) / 2;
  const rng = mulberry32(seed);

  for (let py = 0; py < canvas.height; py += 2) {
    for (let px = 0; px < canvas.width; px += 2) {
      const alpha = pixels[(py * canvas.width + px) * 4 + 3];
      if (alpha > 76 && rng() > 0.08) {
        output.push(left + px * scale, top - py * scale, 0.55 + rng() * 0.45, rng());
      }
    }
  }
}

function makeTextCanvas(text: string) {
  const lines = text.split('\n');
  const canvas = document.createElement('canvas');
  const measure = document.createElement('canvas').getContext('2d');
  if (!measure) return canvas;
  measure.font = '600 25px Arial, sans-serif';
  canvas.width = Math.ceil(Math.max(...lines.map((line) => measure.measureText(line).width)) + 18);
  canvas.height = lines.length * 31 + 12;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
  context.clearRect(0, 0, canvas.width, canvas.height);
  context.fillStyle = '#fff';
  context.font = '600 25px Arial, sans-serif';
  context.textAlign = 'center';
  context.textBaseline = 'top';
  lines.forEach((line, i) => context.fillText(line, canvas.width / 2, 5 + i * 31));
  return canvas;
}

function makeIconCanvas(icon: PlatformGlyph) {
  const canvas = document.createElement('canvas');
  canvas.width = 72;
  canvas.height = 72;
  const context = canvas.getContext('2d');
  if (!context) return canvas;
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
}

export function NetworkScan({
  orbit,
  theme,
  reducedMotion,
  pxToWorldRef,
  dprRef,
  pointBudget,
}: NetworkScanProps) {
  const size = useThree((state) => state.size);
  const data = useMemo<PointCloudData>(() => {
    const distance = CAMERA_Z - FIELD_Z;
    const viewHeight = 2 * distance * Math.tan((FOV * Math.PI) / 360);
    const viewWidth = viewHeight * (size.width / Math.max(1, size.height));
    const halfWidth = viewWidth * 0.52;
    const halfHeight = viewHeight * 0.52;
    return {
      field: buildScanField(halfWidth, halfHeight, pointBudget, orbit),
      glyphs: buildGlyphs(halfWidth, halfHeight, size.width < 620),
      halfWidth,
      halfHeight,
    };
  }, [orbit, pointBudget, size.height, size.width]);

  const built = useMemo(() => {
    const field = createNetworkScanMaterial(data.field, theme, {
      z: FIELD_Z,
      halfWidth: data.halfWidth,
      halfHeight: data.halfHeight,
      minSizePx: 0.55,
      maxSizePx: 1.15,
      opacity: 0.29,
      flow: true,
      scan: true,
      bright: false,
    });
    const glyphs = createNetworkScanMaterial(data.glyphs, theme, {
      z: FIELD_Z + 0.08,
      halfWidth: data.halfWidth,
      halfHeight: data.halfHeight,
      minSizePx: 0.88,
      maxSizePx: 1.46,
      opacity: 0.86,
      flow: false,
      scan: false,
      bright: true,
    });
    const fieldSprite = new Sprite(field.material);
    fieldSprite.count = data.field.length / 4;
    fieldSprite.frustumCulled = false;
    fieldSprite.renderOrder = -30;
    const glyphSprite = new Sprite(glyphs.material);
    glyphSprite.count = data.glyphs.length / 4;
    glyphSprite.frustumCulled = false;
    glyphSprite.renderOrder = -29;
    return { field, glyphs, fieldSprite, glyphSprite };
  }, [data, theme]);

  useFrame(() => {
    for (const handle of [built.field, built.glyphs]) {
      (handle.uniforms.pxToWorld as { value: number }).value = pxToWorldRef.current;
      (handle.uniforms.dpr as { value: number }).value = dprRef.current;
      (handle.uniforms.reducedMotion as { value: number }).value = reducedMotion ? 1 : 0;
    }
  });

  useEffect(
    () => () => {
      disposeHandle(built.field);
      disposeHandle(built.glyphs);
    },
    [built],
  );

  return (
    <>
      <primitive object={built.fieldSprite} />
      <primitive object={built.glyphSprite} />
    </>
  );
}
