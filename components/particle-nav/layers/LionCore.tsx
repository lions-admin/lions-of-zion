'use client';
/**
 * Layer 3 — the compute layer. Dispatches the per-frame simulation and renders
 * the point cloud. This is where the particle budget goes (brief §4.1).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Sprite, Vector3, type WebGPURenderer } from 'three/webgpu';
import type { LionSim } from '../tsl/lionCompute';
import { createLionMaterial } from '../tsl/pointMaterial';
import type { InteractionFrame } from '../hooks/useInteraction';
import type { ParticleNavTheme, SimParams } from '../types';

export interface LionCoreProps {
  sim: LionSim;
  theme: ParticleNavTheme;
  params: SimParams;
  reducedMotion: boolean;
  /** Latest smoothed interaction values — written by the Scene each frame. */
  frameRef: { current: InteractionFrame | null };
  /** World-space pointer at the lion plane. */
  pointerRef: { current: Vector3 };
  /** Bézier of the active connector, lion-local. */
  bezierRef: { current: { start: Vector3; ctrl: Vector3; end: Vector3 } };
  pxToWorldRef: { current: number };
  dprRef: { current: number };
  scale?: number;
}

export function LionCore({
  sim,
  theme,
  params,
  reducedMotion,
  frameRef,
  pointerRef,
  bezierRef,
  pxToWorldRef,
  dprRef,
  scale = 1,
}: LionCoreProps) {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const groupRef = useRef<Group>(null);
  const assemblyElapsedRef = useRef(0);
  const local = useMemo(() => new Vector3(), []);

  const handle = useMemo(() => createLionMaterial(sim, theme), [sim, theme]);

  const sprite = useMemo(() => {
    const s = new Sprite(handle.material);
    s.count = sim.count;
    s.frustumCulled = false;
    return s;
  }, [handle, sim]);

  useEffect(() => {
    assemblyElapsedRef.current = 0;
    gl.computeAsync(sim.initCompute as never);
  }, [gl, sim]);

  useEffect(() => () => handle.material.dispose(), [handle]);

  useFrame((_, delta) => {
    const u = sim.uniforms;
    const f = frameRef.current;
    assemblyElapsedRef.current += delta;
    const assemblyDuration = 2.8;
    const assemblyDelay = 0.12;
    const assemble = Math.min(1, Math.max(0, (assemblyElapsedRef.current - assemblyDelay) / assemblyDuration));
    (u.assemble as { value: number }).value = reducedMotion ? 1 : assemble;
    (u.delta as { value: number }).value = delta;
    (u.stiffness as { value: number }).value = params.springStiffness;
    (u.damping as { value: number }).value = params.springDamping;
    (u.curlAmp as { value: number }).value = params.curlAmp;
    (u.curlFreq as { value: number }).value = params.curlFreq;
    (u.curlTimescale as { value: number }).value = params.curlTimescale;
    (u.repelRadius as { value: number }).value = params.repelRadius;
    (u.repelStrength as { value: number }).value = params.repelStrength;
    (u.streamFraction as { value: number }).value = params.streamFraction;
    (u.reducedMotion as { value: number }).value = reducedMotion ? 1 : 0;

    // pointer world → lion local (the rig may be rotated)
    if (groupRef.current) {
      local.copy(pointerRef.current);
      groupRef.current.worldToLocal(local);
      (u.pointer as { value: Vector3 }).value.copy?.(local);
    }

    if (f) {
      (u.hoverAmount as { value: number }).value = f.hoverAmount;
      (u.burst as { value: number }).value = f.burstPulse;
      const bez = bezierRef.current;
      (u.bezStart as { value: Vector3 }).value.copy?.(bez.start);
      (u.bezCtrl as { value: Vector3 }).value.copy?.(bez.ctrl);
      (u.bezEnd as { value: Vector3 }).value.copy?.(bez.end);
    }

    const hu = handle.uniforms;
    (hu.pxToWorld as { value: number }).value = pxToWorldRef.current;
    (hu.dpr as { value: number }).value = dprRef.current;
    (hu.sizeMinPx as { value: number }).value = params.pointSizeMin;
    (hu.sizeMaxPx as { value: number }).value = params.pointSizeMax;

    gl.compute(sim.updateCompute as never);
  });

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={sprite} />
    </group>
  );
}
