/**
 * Layer 1 — procedural intelligence-network scan particles. Position data is
 * generated deterministically on the CPU, while horizontal flow, the scan
 * sweep, colour and opacity live in TSL so the same material runs on WebGPU
 * and the WebGL2 fallback.
 */
import { AdditiveBlending, Color, SpriteNodeMaterial } from 'three/webgpu';
import {
  abs,
  color,
  float,
  fract,
  hash,
  instanceIndex,
  instancedArray,
  mix,
  sin,
  smoothstep,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import type { ParticleNavTheme } from '../types';

export interface NetworkMaterialOptions {
  z: number;
  halfWidth: number;
  halfHeight: number;
  minSizePx: number;
  maxSizePx: number;
  opacity: number;
  flow: boolean;
  scan: boolean;
  bright: boolean;
}

export function createNetworkScanMaterial(
  data: Float32Array,
  theme: ParticleNavTheme,
  options: NetworkMaterialOptions,
) {
  const storage = instancedArray(data, 'vec4');
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  const uniforms = {
    pxToWorld: uniform(0.004),
    dpr: uniform(1),
    reducedMotion: uniform(0),
  };

  const p = storage.element(instanceIndex);
  const seed = p.w;
  const motionTime = mix(time, float(0), uniforms.reducedMotion);
  const fullWidth = float(options.halfWidth * 2);
  const wrappedX = fract(
    p.x
      .add(options.halfWidth)
      .div(fullWidth)
      .add(motionTime.mul(mix(0.0025, 0.009, hash(instanceIndex.add(317))))),
  )
    .mul(fullWidth)
    .sub(options.halfWidth);
  const x = options.flow ? wrappedX : p.x;
  material.positionNode = vec3(x, p.y, options.z);

  const depthScale = (8.2 - options.z) / 8.2;
  material.scaleNode = mix(float(options.minSizePx), float(options.maxSizePx), p.z)
    .mul(uniforms.dpr)
    .mul(uniforms.pxToWorld)
    .mul(depthScale);

  const scanY = fract(motionTime.mul(0.045).add(0.12))
    .mul(options.halfHeight * 2)
    .sub(options.halfHeight);
  const scanBand = options.scan
    ? smoothstep(0.24, 0.0, abs(p.y.sub(scanY)))
    : float(0);
  const shimmer = mix(
    sin(motionTime.mul(mix(0.55, 1.65, seed)).add(seed.mul(70))).mul(0.5).add(0.5),
    float(0.55),
    uniforms.reducedMotion,
  );

  const dimBlue = color(new Color('#245A83'));
  const networkBlue = color(new Color(theme.starBlue));
  const iceBlue = color(new Color('#9ADFFF'));
  const baseColour = mix(dimBlue, networkBlue, seed.mul(options.bright ? 0.62 : 0.34));
  material.colorNode = mix(baseColour, iceBlue, scanBand.mul(options.bright ? 0.5 : 0.34));

  const disc = smoothstep(0.5, 0.14, uv().sub(vec2(0.5)).length());
  const baseAlpha = mix(options.opacity * 0.48, options.opacity, seed);
  material.opacityNode = disc
    .mul(baseAlpha)
    .mul(mix(0.72, 1.08, shimmer))
    .mul(float(1).add(scanBand.mul(options.scan ? 1.35 : 0)));

  return { material, storage, uniforms };
}

export type NetworkScanMaterialHandle = ReturnType<typeof createNetworkScanMaterial>;
