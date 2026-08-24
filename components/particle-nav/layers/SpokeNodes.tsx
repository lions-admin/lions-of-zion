'use client';
/**
 * Layer 4 — responsive spoke units. Each node uses two restrained particle
 * rings, a secondary SDF icon cluster, and a projected DOM label.
 */
import { useEffect, useMemo, useRef, useState } from 'react';
import { useFrame } from '@react-three/fiber';
import { AdditiveBlending, Color, Sprite, SpriteNodeMaterial } from 'three/webgpu';
import {
  color,
  clamp,
  cos,
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
import { sampleIconSdf } from '../tsl/iconCluster';
import { nodePosition, type OrbitLayout } from '../config';
import type { InteractionFrame } from '../hooks/useInteraction';
import type { NavNode, ParticleNavTheme } from '../types';

export const NODE_RING_RADIUS = 0.46;
const OUTER_RING_POINTS = 1200;
const INNER_RING_POINTS = 850;
const ICON_POINTS = 2800;

interface NodeUnit {
  ringSprites: Sprite[];
  ringMaterials: SpriteNodeMaterial[];
  iconSprite: Sprite | null;
  iconMaterial: SpriteNodeMaterial | null;
  iconStorage: { value?: { dispose(): void } } | null;
  uniforms: {
    active: ReturnType<typeof uniform>;
    pxToWorld: ReturnType<typeof uniform>;
    dpr: ReturnType<typeof uniform>;
    reducedMotion: ReturnType<typeof uniform>;
  }[];
}

function disposeUnit(unit: NodeUnit) {
  unit.ringMaterials.forEach((material) => material.dispose());
  unit.iconMaterial?.dispose();
  unit.iconStorage?.value?.dispose();
}

function createRing(theme: ParticleNavTheme, radius: number, inner: boolean) {
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  const active = uniform(0);
  const pxToWorld = uniform(0.004);
  const dpr = uniform(1);
  const reducedMotion = uniform(0);

  const a = hash(instanceIndex.add(inner ? 149 : 47)).mul(Math.PI * 2);
  const wobble = mix(
    sin(time.mul(0.8).add(a.mul(3))).mul(inner ? 0.002 : 0.004),
    float(0),
    reducedMotion,
  );
  const jitter = inner ? 0.01 : 0.016;
  const r = float(radius).add(hash(instanceIndex.add(93)).sub(0.5).mul(jitter)).add(wobble);
  material.positionNode = vec3(cos(a).mul(r), sin(a).mul(r), 0);
  material.scaleNode = mix(float(0.65), float(1.25), hash(instanceIndex.add(7)))
    .mul(dpr)
    .mul(pxToWorld);
  material.colorNode = mix(
    color(new Color(theme.gold)).mul(inner ? 0.48 : 0.62),
    color(new Color(theme.hover)).mul(1.08),
    active,
  );
  const d = uv().sub(vec2(0.5)).length();
  material.opacityNode = smoothstep(0.5, 0.15, d)
    .mul(mix(inner ? 0.13 : 0.18, inner ? 0.34 : 0.44, hash(instanceIndex.add(13))))
    .mul(mix(float(0.78), float(1.4), active));
  return { material, uniforms: { active, pxToWorld, dpr, reducedMotion } };
}

function createIconMaterial(offsets: Float32Array, theme: ParticleNavTheme) {
  const storage = instancedArray(offsets, 'vec4');
  const material = new SpriteNodeMaterial({
    transparent: true,
    depthWrite: false,
    depthTest: false,
    blending: AdditiveBlending,
  });
  const active = uniform(0);
  const pxToWorld = uniform(0.004);
  const dpr = uniform(1);
  const reducedMotion = uniform(0);

  const p = storage.element(instanceIndex);
  const seed = p.w;
  const shimmer = mix(
    sin(time.mul(1.3).add(seed.mul(50))).mul(0.002),
    float(0),
    reducedMotion,
  );
  material.positionNode = p.xyz.add(vec3(0, shimmer.add(0.095), 0));
  material.scaleNode = mix(float(0.62), float(1.05), seed).mul(dpr).mul(pxToWorld);
  material.colorNode = mix(
    color(new Color(theme.gold)).mul(0.68),
    color(new Color(theme.excited)),
    clamp(active.add(seed.mul(0.16)), 0, 1),
  );
  const d = uv().sub(vec2(0.5)).length();
  material.opacityNode = smoothstep(0.5, 0.18, d)
    .mul(mix(0.18, 0.42, seed))
    .mul(mix(float(0.82), float(1.55), active));
  return { material, storage, uniforms: { active, pxToWorld, dpr, reducedMotion } };
}

export interface SpokeNodesProps {
  nodes: NavNode[];
  orbit: OrbitLayout;
  theme: ParticleNavTheme;
  reducedMotion: boolean;
  frameRef: { current: InteractionFrame | null };
  pxToWorldRef: { current: number };
  dprRef: { current: number };
  lightweight: boolean;
}

export function SpokeNodes({
  nodes,
  orbit,
  theme,
  reducedMotion,
  frameRef,
  pxToWorldRef,
  dprRef,
  lightweight,
}: SpokeNodesProps) {
  const [units, setUnits] = useState<NodeUnit[] | null>(null);
  const unitsRef = useRef<NodeUnit[] | null>(null);

  useEffect(() => {
    let cancelled = false;
    setUnits(null);
    const iconCount = lightweight ? Math.floor(ICON_POINTS / 2) : ICON_POINTS;
    const outerRingCount = lightweight ? Math.floor(OUTER_RING_POINTS / 2) : OUTER_RING_POINTS;
    const innerRingCount = lightweight ? Math.floor(INNER_RING_POINTS / 2) : INNER_RING_POINTS;

    (async () => {
      const built: NodeUnit[] = await Promise.all(
        nodes.map(async (node, i) => {
          const outerRing = createRing(theme, NODE_RING_RADIUS, false);
          const innerRing = createRing(theme, NODE_RING_RADIUS * 0.89, true);
          const ringSprites = [
            { handle: outerRing, count: outerRingCount },
            { handle: innerRing, count: innerRingCount },
          ].map(({ handle, count }) => {
            const sprite = new Sprite(handle.material);
            sprite.count = count;
            sprite.frustumCulled = false;
            return sprite;
          });

          let iconSprite: Sprite | null = null;
          let iconMaterial: SpriteNodeMaterial | null = null;
          let iconStorage: NodeUnit['iconStorage'] = null;
          const uniforms = [outerRing.uniforms, innerRing.uniforms];
          try {
            const offsets = await sampleIconSdf(node.iconSdfUrl, iconCount, 4242 + i * 101);
            const icon = createIconMaterial(offsets, theme);
            iconSprite = new Sprite(icon.material);
            iconSprite.count = iconCount;
            iconSprite.frustumCulled = false;
            iconMaterial = icon.material;
            iconStorage = icon.storage as unknown as NodeUnit['iconStorage'];
            uniforms.push(icon.uniforms);
          } catch (err) {
            console.warn(`[particle-nav] icon cluster skipped for ${node.id}:`, err);
          }
          return {
            ringSprites,
            ringMaterials: [outerRing.material, innerRing.material],
            iconSprite,
            iconMaterial,
            iconStorage,
            uniforms,
          };
        }),
      );
      if (!cancelled) {
        unitsRef.current = built;
        setUnits(built);
      } else built.forEach(disposeUnit);
    })();

    return () => {
      cancelled = true;
      unitsRef.current?.forEach(disposeUnit);
      unitsRef.current = null;
    };
  }, [nodes, theme, lightweight]);

  useFrame(() => {
    if (!units) return;
    const frame = frameRef.current;
    units.forEach((unit, i) => {
      for (const set of unit.uniforms) {
        (set.active as { value: number }).value = frame ? frame.nodeActive[i] : 0;
        (set.pxToWorld as { value: number }).value = pxToWorldRef.current;
        (set.dpr as { value: number }).value = dprRef.current;
        (set.reducedMotion as { value: number }).value = reducedMotion ? 1 : 0;
      }
    });
  });

  const positions = useMemo(
    () => nodes.map((_, i) => nodePosition(i, nodes.length, orbit)),
    [nodes, orbit],
  );
  const nodeScale = orbit.nodeVisualRadius / NODE_RING_RADIUS;

  if (!units) return null;
  return (
    <>
      {units.map((unit, i) => (
        <group key={nodes[i].id} position={positions[i]} scale={nodeScale}>
          {unit.ringSprites.map((ringSprite, ringIndex) => (
            <primitive key={ringIndex} object={ringSprite} />
          ))}
          {unit.iconSprite ? <primitive object={unit.iconSprite} /> : null}
        </group>
      ))}
    </>
  );
}
