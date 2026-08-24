'use client';
/**
 * Layer 5 — Bézier connectors, one bent plane strip per spoke. Pulses travel
 * outward on a staggered loop (4.2 s / 0.35 s); the active connector's dash
 * runs 3×; activate floods gold (brief §7).
 */
import { useEffect, useMemo } from 'react';
import { useFrame } from '@react-three/fiber';
import { Mesh, PlaneGeometry, Vector3 } from 'three/webgpu';
import { createConnectorMaterial, type ConnectorHandle } from '../tsl/connectorMaterial';
import { nodePosition, type OrbitLayout } from '../config';
import type { InteractionFrame } from '../hooks/useInteraction';
import type { NavNode, ParticleNavTheme, SimParams } from '../types';

const LION_EDGE = 0.95;

export function connectorBezier(
  index: number,
  count: number,
  orbit: OrbitLayout,
): { start: Vector3; ctrl: Vector3; end: Vector3 } {
  const [x, y] = nodePosition(index, count, orbit);
  const node = new Vector3(x, y, 0);
  const dir = node.clone().normalize();
  const start = dir.clone().multiplyScalar(LION_EDGE * orbit.centerScale).setZ(0.45);
  const end = node.clone().addScaledVector(dir, -orbit.nodeVisualRadius).setZ(0.45);
  const perp = new Vector3(-dir.y, dir.x, 0).multiplyScalar(0.16 * (index % 2 === 0 ? 1 : -1));
  const ctrl = start.clone().lerp(end, 0.5).add(perp);
  return { start, ctrl, end };
}

export interface ConnectorsProps {
  nodes: NavNode[];
  orbit: OrbitLayout;
  theme: ParticleNavTheme;
  params: SimParams;
  reducedMotion: boolean;
  frameRef: { current: InteractionFrame | null };
  pxToWorldRef: { current: number };
}

export function Connectors({
  nodes,
  orbit,
  theme,
  params,
  reducedMotion,
  frameRef,
  pxToWorldRef,
}: ConnectorsProps) {
  const built = useMemo(() => {
    const geometry = new PlaneGeometry(1, 1, 96, 1);
    const items: { mesh: Mesh; handle: ConnectorHandle }[] = nodes.map((_, i) => {
      const handle = createConnectorMaterial(theme);
      const bez = connectorBezier(i, nodes.length, orbit);
      (handle.uniforms.start as { value: Vector3 }).value.copy(bez.start);
      (handle.uniforms.ctrl as { value: Vector3 }).value.copy(bez.ctrl);
      (handle.uniforms.end as { value: Vector3 }).value.copy(bez.end);
      const mesh = new Mesh(geometry, handle.material);
      mesh.frustumCulled = false;
      // connectors read +4 (in front of nodes) — the Bézier itself sits at z 2,
      // renderOrder keeps them over the node rings without z-fighting
      mesh.renderOrder = 4;
      return { mesh, handle };
    });
    return { geometry, items };
  }, [nodes, orbit, theme]);

  useFrame(({ clock }) => {
    const f = frameRef.current;
    const t = clock.elapsedTime;
    built.items.forEach(({ handle }, i) => {
      const u = handle.uniforms;
      const phase = (t / params.pulseLoopSec + (i * params.pulseStaggerSec) / params.pulseLoopSec) % 1;
      (u.pulsePhase as { value: number }).value = phase;
      (u.active as { value: number }).value = f ? f.nodeActive[i] : 0;
      (u.flood as { value: number }).value = f && f.streamNode === i ? f.flood : 0;
      (u.pxToWorld as { value: number }).value = pxToWorldRef.current;
      (u.reducedMotion as { value: number }).value = reducedMotion ? 1 : 0;
    });
  });

  useEffect(
    () => () => {
      built.geometry.dispose();
      for (const { handle } of built.items) handle.material.dispose();
    },
    [built],
  );

  return (
    <>
      {built.items.map(({ mesh }, i) => (
        <primitive key={nodes[i].id} object={mesh} />
      ))}
    </>
  );
}
