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
  max,
  mix,
  sin,
  smoothstep,
  time,
  uniform,
  uv,
  vec2,
  vec3,
} from 'three/tsl';
import {
  LION_MASK_EDGE_INNER,
  LION_MASK_EDGE_OUTER,
  TEXT_CORRIDOR_MUTE,
} from '@/components/intro/scanIntro';
import type { ParticleNavTheme } from '../types';

/**
 * Normalised distance (1 = the corridor's edge) over which the text-corridor
 * mute fades back to full scan. Wider than the node holes' 0.74→1 because the
 * corridor moves every frame with the rows and a crisp edge would be seen
 * sliding.
 */
const CORRIDOR_EDGE_INNER = 1;
const CORRIDOR_EDGE_OUTER = 1.4;

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
   * Initial half-axes of a soft elliptical hole around the lion. A flowing
   * layer cannot rely on build-time exclusion — its points travel the full
   * width, so whatever was placed clear of the hero eventually crosses it.
   * The hole is evaluated per frame, against the drifted position, and its
   * centre Y and half-axes are uniforms (`heroCenterY`, `heroMaskX`,
   * `heroMaskY`) so it can follow the intro's relocated lion without a
   * rebuild. Omit both to build a layer with no hero hole at all.
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
    /* Hero hole, on this layer's plane. Written per frame from the lion's
       live scale and Y; the initial values are the static centred hole. */
    heroCenterY: uniform(0),
    heroMaskX: uniform(options.maskX ?? 1),
    heroMaskY: uniform(options.maskY ?? 1),
    /* Text corridor, on this layer's plane. A soft box the scan is dimmed
       through while the story is read: `corridorStrength` is the reading
       mask (0 = no effect), the rest is geometry written per frame. Half
       extents start at 1, never 0, so the division below is always defined. */
    corridorY: uniform(0),
    corridorHalfHeight: uniform(1),
    corridorHalfWidth: uniform(1),
    corridorStrength: uniform(0),
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
  // The only hero exclusion there is. `NetworkScan` stopped punching a centred
  // hole into the field geometry on 2026-09-04, because a build-time hole is
  // frozen at world centre while the lion rises and shrinks through the intro.
  // The band is shared with `lionScanMaskOpacity`, the CPU mirror the
  // navigation state is proved against.
  const heroMask = options.maskX === undefined || options.maskY === undefined
    ? float(1)
    : smoothstep(
        LION_MASK_EDGE_INNER,
        LION_MASK_EDGE_OUTER,
        vec2(
          x.div(uniforms.heroMaskX),
          p.y.sub(uniforms.heroCenterY).div(uniforms.heroMaskY),
        ).length(),
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

  // 0 inside the corridor, 1 outside, softened over the outer band; the mute
  // itself keeps `1 - TEXT_CORRIDOR_MUTE` of the scan alive at full strength,
  // scaled by how far the reading mask is open.
  const corridorNorm = max(
    abs(x).div(uniforms.corridorHalfWidth),
    abs(p.y.sub(uniforms.corridorY)).div(uniforms.corridorHalfHeight),
  );
  const outsideCorridor = smoothstep(CORRIDOR_EDGE_INNER, CORRIDOR_EDGE_OUTER, corridorNorm);
  const corridorMute = float(1).sub(
    uniforms.corridorStrength
      .mul(float(TEXT_CORRIDOR_MUTE))
      .mul(float(1).sub(outsideCorridor)),
  );

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
    .mul(corridorMute)
    .mul(float(1).add(scanBand.mul(options.scan ? 1.35 : 0)));

  return { material, storage, uniforms };
}

export type NetworkScanMaterialHandle = ReturnType<typeof createNetworkScanMaterial>;
