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
  /** Inner edge of each particle's radial falloff. Higher is crisper. */
  edgeSoftness?: number;
  /**
   * One drift rate for the whole layer. Required for any layer whose points
   * form shapes: the default per-instance rate pulls a word apart letter by
   * letter within a second.
   */
  flowSpeed?: number;
  /**
   * Half-axes of a soft elliptical hole at the origin. A flowing layer cannot
   * rely on build-time exclusion — its points travel the full width, so
   * whatever was placed clear of the hero eventually crosses it. The hole has
   * to be evaluated per frame, against the drifted position.
   */
  maskX?: number;
  maskY?: number;
  /** Overrides the blue scan ramp; used to give the two streams their tone. */
  palette?: { dim: string; live: string; peak: string };
  /**
   * Soft elliptical holes the scan fades through, one per navigation node.
   * The scan is a layer *under* the menu: it passes behind the nodes rather
   * than being routed around them, which is also the only thing that can work
   * once the layer moves.
   */
  nodeHoles?: readonly { x: number; y: number; hx: number; hy: number }[];
  /** Lowest per-particle share of `opacity`. Raise it for anything readable. */
  alphaFloor?: number;
  /** Bottom of the shimmer swing. Raise it so running copy stops pulsing out. */
  shimmerMin?: number;
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
    opacity: uniform(options.opacity),
  };

  const p = storage.element(instanceIndex);
  const seed = p.w;
  const motionTime = mix(time, float(0), uniforms.reducedMotion);
  const fullWidth = float(options.halfWidth * 2);
  const wrappedX = fract(
    p.x
      .add(options.halfWidth)
      .div(fullWidth)
      .add(
        motionTime.mul(
          options.flowSpeed === undefined
            ? mix(0.0025, 0.009, hash(instanceIndex.add(317)))
            : float(options.flowSpeed),
        ),
      ),
  )
    .mul(fullWidth)
    .sub(options.halfWidth);
  const x = options.flow ? wrappedX : p.x;
  material.positionNode = vec3(x, p.y, options.z);
  const heroMask = options.maskX === undefined || options.maskY === undefined
    ? float(1)
    : smoothstep(
        0.86,
        1.24,
        vec2(x.div(options.maskX), p.y.div(options.maskY)).length(),
      );
  // Eight holes is a known, tiny count, so the graph is unrolled rather than
  // looped; positions are constant for a layout and the layer is rebuilt on
  // resize anyway.
  let underMenu = heroMask;
  for (const hole of options.nodeHoles ?? []) {
    underMenu = underMenu.mul(
      smoothstep(
        0.74,
        1,
        vec2(x.sub(hole.x).div(hole.hx), p.y.sub(hole.y).div(hole.hy)).length(),
      ),
    );
  }

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

  const ramp = options.palette ?? { dim: '#245A83', live: theme.starBlue, peak: '#9ADFFF' };
  const dimBlue = color(new Color(ramp.dim));
  const networkBlue = color(new Color(ramp.live));
  const iceBlue = color(new Color(ramp.peak));
  // Readable glyphs start at the full network blue and only ever brighten;
  // the ambient field keeps the dim end, which is what makes it read as depth.
  const baseColour = options.bright
    ? mix(networkBlue, iceBlue, seed.mul(0.22))
    : mix(dimBlue, networkBlue, seed.mul(0.34));
  material.colorNode = mix(baseColour, iceBlue, scanBand.mul(options.bright ? 0.35 : 0.34));

  const disc = smoothstep(0.5, options.edgeSoftness ?? 0.14, uv().sub(vec2(0.5)).length());
  // A glyph that half-disappears on the shimmer's downbeat is a glyph you
  // read twice, so the bright layer gets a high alpha floor and a shallow one.
  const baseAlpha = mix(
    uniforms.opacity.mul(options.alphaFloor ?? (options.bright ? 0.66 : 0.48)),
    uniforms.opacity,
    seed,
  );
  const shimmerLow = options.shimmerMin ?? (options.bright ? 0.9 : 0.72);
  const shimmerDepth = mix(shimmerLow, options.bright ? 1.05 : 1.08, shimmer);
  material.opacityNode = disc
    .mul(baseAlpha)
    .mul(shimmerDepth)
    .mul(underMenu)
    .mul(float(1).add(scanBand.mul(options.scan ? 1.35 : 0)));

  return { material, storage, uniforms };
}

export type NetworkScanMaterialHandle = ReturnType<typeof createNetworkScanMaterial>;
