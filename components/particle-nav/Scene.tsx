'use client';
/**
 * The canvas. One <Canvas>, one camera, five sibling layers under a rig group
 * (brief §4). WebGPU init is async — the gl factory MUST await renderer.init()
 * or the canvas stays silently blank (brief §2.1 rule 1).
 */
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr } from '@react-three/drei';
import { Group, PerspectiveCamera, Vector3, WebGPURenderer } from 'three/webgpu';
import { NetworkScan } from './layers/NetworkScan';
import { OrbitalRings } from './layers/OrbitalRings';
import { LionCore } from './layers/LionCore';
import { SpokeNodes } from './layers/SpokeNodes';
import { Connectors, connectorBezier } from './layers/Connectors';
import { useLionBuffers } from './hooks/useLionBuffers';
import { createPost, type PostHandle } from './tsl/post';
import { computeOrbitLayout, nodeAngle, nodePosition, type SafeAreaInsets } from './config';
import type { InteractionDriver, InteractionFrame } from './hooks/useInteraction';
import type { PerfTier } from './hooks/usePerfTier';
import type { NavNode, ParticleNavTheme, SimParams } from './types';

const CAMERA_Z = 8.2;
const FOV = 45;

export interface SceneProps {
  nodes: NavNode[];
  radius: number;
  theme: ParticleNavTheme;
  params: SimParams;
  tier: PerfTier;
  reducedMotion: boolean;
  driver: InteractionDriver;
  forceWebGL?: boolean;
  safeArea: SafeAreaInsets;
  /** NDC pointer written by the DOM layer (canvas itself is pointer-inert). */
  pointerNdcRef: { current: { x: number; y: number } };
  /** Label wrapper elements, index-aligned with nodes. */
  getLabelEls: () => (HTMLElement | null)[];
  onReady?: () => void;
  onFrameStats?: (ms: number, fps: number) => void;
}

function SceneContent(props: SceneProps) {
  const {
    nodes,
    radius,
    theme,
    params,
    tier,
    reducedMotion,
    driver,
    pointerNdcRef,
    getLabelEls,
    onReady,
    onFrameStats,
    safeArea,
  } = props;

  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const orbit = useMemo(
    () => computeOrbitLayout(size.width, size.height, radius, safeArea),
    [radius, safeArea, size.height, size.width],
  );

  const rigRef = useRef<Group>(null);
  const frameRef = useRef<InteractionFrame | null>(null);
  const pxToWorldRef = useRef(0.007);
  const dprRef = useRef(1);
  const pointerWorldRef = useRef(new Vector3(0, 0, 99));
  const bezierRef = useRef(connectorBezier(0, nodes.length, orbit));
  const postRef = useRef<PostHandle | null>(null);
  const readyRef = useRef(false);
  const statsRef = useRef({ acc: 0, frames: 0, last: 0 });
  const tmp = useMemo(() => ({ v: new Vector3(), w: new Vector3() }), []);

  const sim = useLionBuffers(tier.particles, params);

  // Post chain — TSL pass + bloom, never EffectComposer (brief §2).
  useEffect(() => {
    const handle = createPost(gl, scene, camera, params, tier.bloom);
    postRef.current = handle;
    return () => {
      postRef.current = null;
      handle.dispose();
    };
  }, [gl, scene, camera, params, tier.bloom]);

  useFrame((state, delta) => {
    const now = performance.now();
    const frame = driver.tick(now, delta, params);
    frameRef.current = frame;

    // world-per-CSS-px at the lion plane; sprite scale nodes multiply this
    pxToWorldRef.current = (2 * CAMERA_Z * Math.tan((FOV * Math.PI) / 360)) / size.height;
    dprRef.current = 1; // px sizes are CSS px — device px scaling comes from the render DPR

    // ---- idle rig rotation (0.6°/s) — reduced motion holds still
    const rig = rigRef.current;
    if (rig && !reducedMotion) {
      rig.rotation.z += ((params.idleRotateDegPerSec * Math.PI) / 180) * delta;
    }

    // ---- pointer parallax ±3° with 0.08 damping + activate dolly
    const ndc = pointerNdcRef.current;
    const responsiveParallax = size.width <= 768 ? 0 : params.parallaxDeg;
    const maxOffset = Math.tan((responsiveParallax * Math.PI) / 180) * CAMERA_Z;
    const damp = 1 - Math.pow(1 - params.parallaxDamping, delta * 60);
    const targetX = reducedMotion ? 0 : ndc.x * maxOffset;
    const targetY = reducedMotion ? 0 : ndc.y * maxOffset;
    camera.position.x += (targetX - camera.position.x) * damp;
    camera.position.y += (targetY - camera.position.y) * damp;
    const activeAngle = nodeAngle(frame.streamNode, nodes.length) + (rig?.rotation.z ?? 0);
    const dollyAmount = frame.dolly * params.activateDollyDistance;
    camera.position.z = CAMERA_Z - dollyAmount * 0.7;
    camera.position.x += Math.cos(activeAngle) * dollyAmount * 0.35;
    camera.position.y += Math.sin(activeAngle) * dollyAmount * 0.35;
    camera.lookAt(0, 0, 0);

    // ---- pointer world position on the lion plane (z≈0)
    tmp.v.set(ndc.x, ndc.y, 0.5).unproject(camera);
    tmp.w.copy(tmp.v).sub(camera.position).normalize();
    const t = -camera.position.z / tmp.w.z;
    pointerWorldRef.current.copy(camera.position).addScaledVector(tmp.w, t);

    // ---- active connector Bézier (lion-local == rig-local space)
    bezierRef.current = connectorBezier(frame.streamNode, nodes.length, orbit);

    // ---- live bloom tuning (demo control panel)
    postRef.current?.setBloom(params.bloomThreshold, params.bloomStrength, params.bloomRadius);

    // ---- DOM label projection: node world coord → CSS px on the <a> wrappers
    const els = getLabelEls();
    if (rig && els.length) {
      for (let i = 0; i < nodes.length; i++) {
        const el = els[i];
        if (!el) continue;
        const [nx, ny, nz] = nodePosition(i, nodes.length, orbit);
        tmp.v.set(nx, ny, nz);
        rig.localToWorld(tmp.v);
        tmp.v.project(camera);
        const px = (tmp.v.x * 0.5 + 0.5) * size.width;
        const py = (-tmp.v.y * 0.5 + 0.5) * size.height;
        el.style.left = `${px.toFixed(1)}px`;
        el.style.top = `${py.toFixed(1)}px`;
      }
    }

    // ---- frame stats (dev overlay, ?stats)
    if (onFrameStats) {
      const s = statsRef.current;
      s.acc += delta;
      s.frames++;
      if (now - s.last > 1000) {
        const ms = (s.acc / s.frames) * 1000;
        onFrameStats(ms, 1000 / ms);
        s.acc = 0;
        s.frames = 0;
        s.last = now;
      }
    }

    // Ready = frames are flowing. The lion may still be streaming in, but the
    // network/rings/nodes frame is composed — don't hold the whole canvas hidden.
    if (!readyRef.current) {
      readyRef.current = true;
      onReady?.();
    }
  });

  // Render through the post chain; priority 1 disables r3f's auto-render.
  useFrame(() => {
    postRef.current?.post.render();
  }, 1);

  return (
    <>
      <AdaptiveDpr />
      <group ref={rigRef}>
        <NetworkScan
          orbit={orbit}
          theme={theme}
          reducedMotion={reducedMotion}
          pxToWorldRef={pxToWorldRef}
          dprRef={dprRef}
          pointBudget={tier.networkPoints}
        />
        <OrbitalRings
          theme={theme}
          params={params}
          reducedMotion={reducedMotion}
          pxToWorldRef={pxToWorldRef}
          dprRef={dprRef}
          scale={orbit.centerScale}
        />
        {sim ? (
          <LionCore
            sim={sim}
            theme={theme}
            params={params}
            reducedMotion={reducedMotion}
            frameRef={frameRef}
            pointerRef={pointerWorldRef}
            bezierRef={bezierRef}
            pxToWorldRef={pxToWorldRef}
            dprRef={dprRef}
            scale={orbit.centerScale}
          />
        ) : null}
        <SpokeNodes
          nodes={nodes}
          orbit={orbit}
          theme={theme}
          reducedMotion={reducedMotion}
          frameRef={frameRef}
          pxToWorldRef={pxToWorldRef}
          dprRef={dprRef}
          lightweight={tier.particles === 45_000}
        />
        <Connectors
          nodes={nodes}
          orbit={orbit}
          theme={theme}
          params={params}
          reducedMotion={reducedMotion}
          frameRef={frameRef}
          pxToWorldRef={pxToWorldRef}
        />
      </group>
    </>
  );
}

export default function Scene(props: SceneProps) {
  const { theme, tier, forceWebGL } = props;
  return (
    <Canvas
      // brief §2.1: WebGPU init is async — await it or get a silent blank canvas
      gl={async (glProps) => {
        const renderer = new WebGPURenderer({
          canvas: glProps.canvas as HTMLCanvasElement,
          antialias: false,
          forceWebGL: forceWebGL || tier.backend === 'webgl2',
        });
        await renderer.init();
        renderer.setClearColor(theme.background, 1);
        return renderer;
      }}
      camera={{ fov: FOV, near: 0.1, far: 130, position: [0, 0, CAMERA_Z] }}
      dpr={[1, tier.maxDpr]}
      flat
      frameloop="always"
      style={{ pointerEvents: 'none' }}
      aria-hidden
      role="presentation"
    >
      <SceneContent {...props} />
    </Canvas>
  );
}
