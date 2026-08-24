import { Color, NormalBlending, SpriteNodeMaterial } from 'three/webgpu';
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

export function createIntroTextMaterial(cloud: TextCloud) {
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
  const uniforms = {
    build: uniform(0),
    disperse: uniform(0),
    opacity: uniform(0),
    focus: uniform(0),
    pxToWorld: uniform(0.004),
    dpr: uniform(1),
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
  const origin = point.xyz.add(
    vec3(
      float(-1.5).sub(seed.x.mul(2.3)),
      seed.y.sub(0.5).mul(1.45),
      seed.z.sub(0.5).mul(1.3),
    ),
  );
  const windTarget = point.xyz.add(
    vec3(
      float(2.4).add(seed.x.mul(3)),
      float(1.7).add(seed.y.mul(2.5)),
      seed.z.sub(0.5).mul(3.2),
    ),
  );
  const visiblePosition = mix(origin, point.xyz, built);
  const edgeDrift = sin(time.mul(0.9).add(seed.x.mul(18))).mul(trait.w).mul(0.012);
  material.positionNode = mix(visiblePosition, windTarget, erased).add(
    vec3(0, edgeDrift.mul(built).mul(float(1).sub(erased)), 0),
  );
  material.scaleNode = mix(float(1.15), float(2.05), hash(instanceIndex.add(53)))
    .mul(mix(float(1), float(1.25), uniforms.focus))
    .mul(uniforms.dpr)
    .mul(uniforms.pxToWorld);
  const printHead = smoothstep(0.075, 0, uniforms.build.sub(start.add(0.08)).abs());
  material.colorNode = mix(
    color(new Color('#ECE8DE')),
    color(new Color('#FFFFFF')),
    trait.w.mul(0.72).add(printHead.mul(0.18)),
  );
  material.opacityNode = smoothstep(0.5, 0.1, uv().sub(vec2(0.5)).length())
    .mul(built)
    .mul(float(1).sub(erased))
    .mul(uniforms.opacity)
    .mul(mix(float(0.72), float(1), trait.w));

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
