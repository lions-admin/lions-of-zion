/**
 * Layer 2 — dotted orbital rings. Instanced sprites on a circle, dash gaps
 * from the instance index, rotation via a CPU-updated uniform so the three
 * rings counter-rotate at 0.4× / −0.25× / 0.15× of base (brief §4.1) and the
 * field never visibly repeats.
 */
import { AdditiveBlending, Color, SpriteNodeMaterial } from 'three/webgpu';
import {
  color,
  cos,
  float,
  fract,
  hash,
  instanceIndex,
  mix,
  sin,
  smoothstep,
  step,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import type { ParticleNavTheme } from '../types';

export interface RingSpec {
  radius: number;
  count: number;
  /** Multiple of the base idle rotation rate — sign flips counter-rotate. */
  rate: number;
  dashCount: number;
}

export const RING_SPECS: RingSpec[] = [
  { radius: 1.12, count: 170, rate: 0.4, dashCount: 14 },
  { radius: 1.36, count: 220, rate: -0.25, dashCount: 18 },
  { radius: 1.62, count: 280, rate: 0.15, dashCount: 22 },
];

export function createRingMaterial(spec: RingSpec, theme: ParticleNavTheme) {
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  const pxToWorld = uniform(0.004);
  const dpr = uniform(1);
  const rotation = uniform(0);

  const t = float(instanceIndex).div(spec.count);
  const angle = t.mul(Math.PI * 2).add(rotation);
  material.positionNode = vec3(cos(angle).mul(spec.radius), sin(angle).mul(spec.radius), -6);

  material.scaleNode = float(1.1).mul(dpr).mul(pxToWorld).mul(1.75); // ring depth ≈ −6

  // dash gap: blocks of visible dots with soft ends
  const dash = fract(t.mul(spec.dashCount));
  const visible = step(0.18, dash).mul(step(dash, float(0.82)));
  const jitterA = mix(0.18, 0.38, hash(instanceIndex.add(31)));

  material.colorNode = color(new Color(theme.gold)).mul(0.52);
  const d = uv().sub(vec2(0.5)).length();
  material.opacityNode = smoothstep(0.5, 0.14, d).mul(visible).mul(jitterA);

  return { material, uniforms: { pxToWorld, dpr, rotation } };
}
