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
import {
  LION_EXTRACTION_DIM,
  LION_EXTRACTION_FRACTION,
} from '@/components/intro/lionSourceMap';
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
    /**
     * Extraction envelope, 0..1 — how far the line's subset is dimmed right
     * now. `lionExtractionEnvelope()` in `components/intro/lionSourceMap.ts`.
     */
    extraction: ReturnType<typeof uniform>;
    /**
     * uint seed added to the instance index before hashing. The same seed
     * selects the line's source pool on the CPU, so the particles that dim
     * are the particles the text is made of. `lionExtractionSeed(line)`.
     */
    extractionSeed: ReturnType<typeof uniform>;
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
    extraction: uniform(0),
    extractionSeed: uniform(0, 'uint'),
  };

  const seed = hash(instanceIndex.add(977));
  /* Extraction mask: the subset whose hash falls under the fraction is the
     pool the current line draws its particles from (the CPU evaluates the
     same PCG hash with the same seed). It thins while the transfer is active
     and is restored as the line lands. A small fraction and a partial dim,
     never a removal — the lion stays the primary mark. */
  const extracted = step(
    hash(instanceIndex.add(uniforms.extractionSeed)),
    float(LION_EXTRACTION_FRACTION),
  ).mul(uniforms.extraction);
  material.positionNode = sim.positions.element(instanceIndex).xyz;
  material.scaleNode = mix(uniforms.sizeMinPx, uniforms.sizeMaxPx, seed)
    .mul(float(1).sub(extracted.mul(0.35)))
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
    .mul(regionVisibility)
    .mul(float(1).sub(extracted.mul(LION_EXTRACTION_DIM)));

  return { material, uniforms };
}
