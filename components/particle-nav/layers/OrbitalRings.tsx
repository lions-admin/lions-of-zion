'use client';
/**
 * Layer 2 — dotted orbital rings. Each ring carries its own `spec.rate`, so
 * they counter-rotate at differing rates for any nonzero
 * `idleRotateDegPerSec`; the shipping value is 0, so today they hold still.
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame } from '@react-three/fiber';
import { Sprite } from 'three/webgpu';
import { createRingMaterial, RING_SPECS } from '../tsl/ringMaterial';
import type { ParticleNavTheme, SimParams } from '../types';

export interface OrbitalRingsProps {
  theme: ParticleNavTheme;
  params: SimParams;
  reducedMotion: boolean;
  pxToWorldRef: { current: number };
  dprRef: { current: number };
  scale?: number;
}

export function OrbitalRings({
  theme,
  params,
  reducedMotion,
  pxToWorldRef,
  dprRef,
  scale = 1,
}: OrbitalRingsProps) {
  const rotations = useRef<number[]>(RING_SPECS.map(() => 0));

  const built = useMemo(
    () =>
      RING_SPECS.map((spec) => {
        const { material, uniforms } = createRingMaterial(spec, theme);
        const sprite = new Sprite(material);
        sprite.count = spec.count;
        sprite.frustumCulled = false;
        return { sprite, material, uniforms, spec };
      }),
    [theme],
  );

  useFrame((_, delta) => {
    const base = (params.idleRotateDegPerSec * Math.PI) / 180;
    built.forEach((b, i) => {
      if (!reducedMotion) rotations.current[i] += base * b.spec.rate * 20 * delta;
      (b.uniforms.rotation as { value: number }).value = rotations.current[i];
      (b.uniforms.pxToWorld as { value: number }).value = pxToWorldRef.current;
      (b.uniforms.dpr as { value: number }).value = dprRef.current;
    });
  });

  useEffect(
    () => () => {
      for (const b of built) b.material.dispose();
    },
    [built],
  );

  return (
    <group scale={scale}>
      {built.map((b, i) => (
        <primitive key={i} object={b.sprite} />
      ))}
    </group>
  );
}
