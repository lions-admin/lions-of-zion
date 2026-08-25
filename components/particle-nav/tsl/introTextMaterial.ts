import { Color, NormalBlending, SpriteNodeMaterial, Vector3 } from 'three/webgpu';
import {
  color,
  float,
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
import type { TextCloud } from '@/components/intro/textCloud';

export interface IntroTextMaterialOptions {
  coreColor?: string;
  edgeColor?: string;
  sizeMinPx?: number;
  sizeMaxPx?: number;
  alphaMin?: number;
  alphaMax?: number;
}

export function createIntroTextMaterial(
  cloud: TextCloud,
  options: IntroTextMaterialOptions = {},
) {
  const packedPositions = new Float32Array(cloud.count * 4);
  const packedTraits = new Float32Array(cloud.count * 4);
  for (let i = 0; i < cloud.count; i++) {
    const p = i * 3;
    const q = i * 4;
    packedPositions[q] = cloud.positions[p];
    packedPositions[q + 1] = cloud.positions[p + 1];
    packedPositions[q + 2] = cloud.positions[p + 2];
    packedPositions[q + 3] = cloud.order[i];
    packedTraits[q] = cloud.seeds[p];
    packedTraits[q + 1] = cloud.seeds[p + 1];
    packedTraits[q + 2] = cloud.seeds[p + 2];
    packedTraits[q + 3] = cloud.edges[i];
  }

  const positions = instancedArray(packedPositions, 'vec4');
  const traits = instancedArray(packedTraits, 'vec4');
  /* The trajectory is a uniform rather than a build option because it depends
     on the frame's width, and the frame changes on every resize. Baking it into
     the node graph would tie a rotation to a full glyph resample — the exact
     cost the layout's width quantiser exists to avoid. */
  const uniforms = {
    build: uniform(0),
    disperse: uniform(0),
    opacity: uniform(0),
    focus: uniform(0),
    pxToWorld: uniform(0.004),
    dpr: uniform(1),
    originBias: uniform(new Vector3(-1.5, -0.725, -0.65)),
    originSpan: uniform(new Vector3(-2.3, 1.45, 1.3)),
    windBias: uniform(new Vector3(2.4, 1.7, -1.6)),
    windSpan: uniform(new Vector3(3, 2.5, 3.2)),
  };
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: NormalBlending,
  });

  const point = positions.element(instanceIndex);
  const trait = traits.element(instanceIndex);
  const seed = trait.xyz;
  const start = point.w.mul(0.82);
  const built = smoothstep(start, start.add(0.17), uniforms.build);
  const eraseStart = point.w.mul(0.52);
  const erased = smoothstep(eraseStart, eraseStart.add(0.3), uniforms.disperse);
  /* `bias + span * seed` reproduces the authored spans exactly: the old
     `(seed - 0.5) * s` forms are the same line with the half folded into the
     bias, which is what lets one uniform pair carry every axis. */
  const origin = point.xyz.add(uniforms.originBias.add(seed.mul(uniforms.originSpan)));
  const windTarget = point.xyz.add(uniforms.windBias.add(seed.mul(uniforms.windSpan)));
  const visiblePosition = mix(origin, point.xyz, built);
  const edgeDrift = sin(time.mul(0.9).add(seed.x.mul(18))).mul(trait.w).mul(0.012);
  material.positionNode = mix(visiblePosition, windTarget, erased).add(
    vec3(0, edgeDrift.mul(built).mul(float(1).sub(erased)), 0),
  );
  material.scaleNode = mix(
    float(options.sizeMinPx ?? 0.9),
    float(options.sizeMaxPx ?? 1.58),
    hash(instanceIndex.add(53)),
  )
    .mul(mix(float(1), float(1.25), uniforms.focus))
    .mul(uniforms.dpr)
    .mul(uniforms.pxToWorld);
  const printHead = smoothstep(0.075, 0, uniforms.build.sub(start.add(0.08)).abs());
  material.colorNode = mix(
    color(new Color(options.coreColor ?? '#F1EDE4')),
    color(new Color(options.edgeColor ?? '#FFFFFF')),
    trait.w.mul(0.72).add(printHead.mul(0.18)),
  );
  material.opacityNode = smoothstep(0.5, 0.1, uv().sub(vec2(0.5)).length())
    .mul(built)
    .mul(float(1).sub(erased))
    .mul(uniforms.opacity)
    .mul(mix(float(options.alphaMin ?? 0.82), float(options.alphaMax ?? 1), trait.w));

  const dispose = () => {
    material.dispose();
    for (const storage of [positions, traits]) {
      (storage as unknown as { value?: { dispose(): void }; dispose?: () => void }).value?.dispose();
      (storage as unknown as { dispose?: () => void }).dispose?.();
    }
  };

  return { material, uniforms, dispose };
}

export type IntroTextMaterialHandle = ReturnType<typeof createIntroTextMaterial>;
