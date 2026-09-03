'use client';
/**
 * Layer 3 — the compute layer. Dispatches the per-frame simulation and renders
 * the point cloud. This is where the particle budget goes (brief §4.1).
 */
import { useEffect, useMemo, useRef } from 'react';
import { useFrame, useThree } from '@react-three/fiber';
import { Group, Sprite, type WebGPURenderer } from 'three/webgpu';
import {
  LION_BRAND_SOURCE_LINE,
  lionExtractionEnvelope,
  lionExtractionSeed,
} from '@/components/intro/lionSourceMap';
import type { LionSim } from '../tsl/lionCompute';
import { createLionMaterial } from '../tsl/pointMaterial';
import type { ParticleNavTheme, SimParams } from '../types';
import type { ExperienceFrame } from '../introFrame';

export interface LionCoreProps {
  sim: LionSim;
  theme: ParticleNavTheme;
  params: SimParams;
  reducedMotion: boolean;
  pxToWorldRef: { current: number };
  dprRef: { current: number };
  scale?: number;
  experienceFrameRef?: { current: ExperienceFrame | null };
}

export function LionCore({
  sim,
  theme,
  params,
  reducedMotion,
  pxToWorldRef,
  dprRef,
  scale = 1,
  experienceFrameRef,
}: LionCoreProps) {
  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const groupRef = useRef<Group>(null);

  const handle = useMemo(() => createLionMaterial(sim, theme), [sim, theme]);

  const sprite = useMemo(() => {
    const s = new Sprite(handle.material);
    s.count = sim.count;
    s.frustumCulled = false;
    return s;
  }, [handle, sim]);

  useEffect(() => {
    gl.computeAsync(sim.initCompute as never);
  }, [gl, sim]);

  useEffect(() => () => handle.material.dispose(), [handle]);

  useFrame((_, delta) => {
    const u = sim.uniforms;
    const experience = experienceFrameRef?.current;
    const assemble = experience?.assemble ?? 1;
    (u.assemble as { value: number }).value = reducedMotion ? 1 : assemble;
    (u.delta as { value: number }).value = delta;
    (u.stiffness as { value: number }).value = params.springStiffness;
    (u.damping as { value: number }).value = params.springDamping;
    (u.curlAmp as { value: number }).value = params.curlAmp;
    (u.curlFreq as { value: number }).value = params.curlFreq;
    (u.curlTimescale as { value: number }).value = params.curlTimescale;
    (u.repelRadius as { value: number }).value = params.repelRadius;
    (u.repelStrength as { value: number }).value = params.repelStrength;
    (u.reducedMotion as { value: number }).value = reducedMotion ? 1 : 0;

    /* Pointer repulsion, the hover particle stream and the activation burst
       all belonged to the orbital navigation and went with it. The pointer
       uniform is left at its far-away default so the repulsion term in the
       compute resolves to zero without a branch. */

    const hu = handle.uniforms;
    (hu.pxToWorld as { value: number }).value = pxToWorldRef.current;
    (hu.dpr as { value: number }).value = dprRef.current;
    (hu.sizeMinPx as { value: number }).value = params.pointSizeMin;
    (hu.sizeMaxPx as { value: number }).value = params.pointSizeMax;
    (hu.opacity as { value: number }).value = experience?.lionOpacity ?? 1;
    (hu.crownReveal as { value: number }).value = experience?.crownReveal ?? 1;

    /* Extraction mask. The newest entering line is the one drawing from the
       lion, so its build progress and its index pick the envelope and the
       pool. While the brand wordmark builds every story line is already held
       at 1, so it takes over with its own pool. Nothing here allocates. */
    const story = experience?.story;
    const brandBuilding = !!story && story.brandProgress > 0 && story.brandProgress < 1;
    const transfer = brandBuilding ? story.brandProgress : experience?.activeTextTransfer ?? 0;
    const sourceLine = brandBuilding ? LION_BRAND_SOURCE_LINE : story?.latestLineIndex ?? 0;
    (hu.extraction as { value: number }).value = lionExtractionEnvelope(
      transfer,
      experience?.textFlow ?? 0,
    );
    (hu.extractionSeed as { value: number }).value = lionExtractionSeed(sourceLine);

    if (groupRef.current) {
      groupRef.current.scale.setScalar(experience?.lionScale ?? scale);
      groupRef.current.position.y = experience?.lionY ?? 0;
    }

    gl.compute(sim.updateCompute as never);
  });

  return (
    <group ref={groupRef} scale={scale}>
      <primitive object={sprite} />
    </group>
  );
}
