/**
 * Shared point-sprite material for the lion core (and node rings reuse the
 * same recipe): velocity-driven colour ramp gold → excited, crown sub-set
 * biased +12% toward excited (brief §6), soft-disc alpha, additive.
 */
import { AdditiveBlending, Color, SpriteNodeMaterial } from 'three/webgpu';
import {
  color,
  clamp,
  float,
  hash,
  instanceIndex,
  length,
  mix,
  smoothstep,
  step,
  uniform,
  uv,
  vec2,
} from 'three/tsl';
import type { LionSim } from './lionCompute';
import type { ParticleNavTheme } from '../types';

export interface LionMaterialHandle {
  material: SpriteNodeMaterial;
  uniforms: {
    /** World units per CSS pixel at the lion's depth — updated on resize. */
    pxToWorld: ReturnType<typeof uniform>;
    sizeMinPx: ReturnType<typeof uniform>;
    sizeMaxPx: ReturnType<typeof uniform>;
    /** DPR clamped at 2 (brief §6). */
    dpr: ReturnType<typeof uniform>;
    opacity: ReturnType<typeof uniform>;
    crownReveal: ReturnType<typeof uniform>;
  };
}

export function createLionMaterial(sim: LionSim, theme: ParticleNavTheme): LionMaterialHandle {
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });

  const uniforms = {
    pxToWorld: uniform(0.004),
    sizeMinPx: uniform(1.2),
    sizeMaxPx: uniform(2.6),
    dpr: uniform(1),
    opacity: uniform(1),
    crownReveal: uniform(1),
  };

  const seed = hash(instanceIndex.add(977));
  material.positionNode = sim.positions.element(instanceIndex).xyz;
  material.scaleNode = mix(uniforms.sizeMinPx, uniforms.sizeMaxPx, seed)
    .mul(uniforms.dpr)
    .mul(uniforms.pxToWorld);

  const speed = length(sim.velocities.element(instanceIndex).xyz);
  const crownBias = step(float(sim.crownStart), float(instanceIndex)).mul(0.12);
  const excite = clamp(speed.mul(1.6).add(crownBias), 0, 1);
  material.colorNode = mix(color(new Color(theme.gold)), color(new Color(theme.excited)), excite);

  // 45k–180k additive sprites overlap massively at the lion's footprint —
  // per-particle alpha must stay low or bloom blows the centre out to white.
  const d = uv().sub(vec2(0.5)).length();
  const isCrown = step(float(sim.crownStart), float(instanceIndex));
  const regionVisibility = mix(float(1), uniforms.crownReveal, isCrown);
  material.opacityNode = smoothstep(0.5, 0.16, d)
    .mul(mix(0.05, 0.13, seed))
    .mul(uniforms.opacity)
    .mul(regionVisibility);

  return { material, uniforms };
}
