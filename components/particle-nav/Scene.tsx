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
import { IntroText } from './layers/IntroText';
import { useLionBuffers } from './hooks/useLionBuffers';
import { createPost, type PostHandle } from './tsl/post';
import {
  computeOrbitLayout,
  MOBILE_MAX_WIDTH,
  nodeAngle,
  nodePosition,
  type SafeAreaInsets,
} from './config';
import type { InteractionDriver, InteractionFrame } from './hooks/useInteraction';
import type { PerfTier } from './hooks/usePerfTier';
import type { NavNode, ParticleNavTheme, SimParams } from './types';
import type { ExperienceFrame, IntroControls } from './introFrame';
import {
  getActiveTextTransfer,
  getNextRollingCue,
  getRollingFinalTime,
  getRollingSkipTime,
  getRollingStoryFrame,
  retimeRollingStory,
} from '@/components/intro/rolling-story-timeline';
import {
  getFormationEnvelope,
  getLionOpacityEnvelope,
  getRelocationEnvelope,
  getScanRevealEnvelope,
  getTextFlowEnvelope,
  getTextOpacityEnvelope,
  smoothstep01,
} from '@/components/intro/story-timeline';
import { settledLionPlacement } from '@/components/intro/introLayout';
import { SCAN_VISIBLE_THRESHOLD } from '@/components/intro/scanIntro';

const CAMERA_Z = 8.2;
const FOV = 45;

/**
 * Frame order in this scene, ascending: this writer, then every layer that
 * reads `experienceFrameRef` at its own priority, then the post pass at 1.
 * Negative on purpose — see the comment on the writer's `useFrame`.
 */
export const FRAME_WRITER_PRIORITY = -1;

/**
 * The largest slice of the intro clock a single frame may advance, in
 * seconds — a 10 fps floor. See the comment at the advance itself: the frame
 * delta is wall-clock, and the entrance is the part of the session where
 * wall-clock and rendered time diverge most.
 */
export const TIMELINE_MAX_STEP = 0.1;

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
  intro?: boolean;
  introControlsRef?: { current: IntroControls };
  onIntroComplete?: () => void;
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
    intro = false,
    introControlsRef,
    onIntroComplete,
  } = props;

  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const orbit = useMemo(
    () => computeOrbitLayout(size.width, size.height, radius, safeArea),
    [radius, safeArea, size.height, size.width],
  );
  /* The settled lion's scale and Y, solved from the same viewport, safe-area
     and camera the orbit uses, so the crown stays under the frame edge and
     the entrance chrome at every size. Memoised: nothing in the frame loop
     re-derives it. */
  const lionPlacement = useMemo(
    () => settledLionPlacement(size.width, size.height, safeArea, orbit),
    [orbit, safeArea, size.height, size.width],
  );

  const rigRef = useRef<Group>(null);
  const networkRef = useRef<Group>(null);
  const ringsRef = useRef<Group>(null);
  const spokesRef = useRef<Group>(null);
  const connectorsRef = useRef<Group>(null);
  const frameRef = useRef<InteractionFrame | null>(null);
  const experienceFrameRef = useRef<ExperienceFrame | null>(null);
  const pxToWorldRef = useRef(0.007);
  const dprRef = useRef(1);
  const pointerWorldRef = useRef(new Vector3(0, 0, 99));
  const bezierRef = useRef(connectorBezier(0, nodes.length, orbit));
  const postRef = useRef<PostHandle | null>(null);
  const readyRef = useRef(false);
  const introCompleteRef = useRef(false);
  const timelineTimeRef = useRef(0);
  const timelineLayoutRef = useRef<'desktop' | 'mobile'>(size.width < MOBILE_MAX_WIDTH ? 'mobile' : 'desktop');
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

  /* The frame writer runs before every layer that reads what it writes.
     r3f sorts subscribers ascending by priority, so a negative value puts
     this first; `internal.priority` only counts *positive* priorities
     (`internal.priority += priority > 0 ? 1 : 0`), so this does not touch
     r3f's auto-render gate — the priority-1 post pass below already owns
     that. Without the ordering, `LionCore`, `IntroText` and `NetworkScan`
     all subscribed after this one but at the default priority and read the
     *previous* frame's `ExperienceFrame`: during the 1.1 s rise the lion
     moved a frame further than the text particles born on its surface, so
     the stream detached from the lion it is supposed to come out of. */
  useFrame((state, delta) => {
    const now = performance.now();
    const frame = driver.tick(now, delta, params);
    frameRef.current = frame;

    const timelineLayout = size.width < MOBILE_MAX_WIDTH ? 'mobile' : 'desktop';
    if (timelineLayoutRef.current !== timelineLayout) {
      /* The lion stages are layout-blind and keep their exact time; only the
         story portion is carried proportionally between the two cadences. */
      timelineTimeRef.current = retimeRollingStory(
        timelineTimeRef.current,
        timelineLayoutRef.current,
        timelineLayout,
      );
      timelineLayoutRef.current = timelineLayout;
    }
    if (intro) {
      const controls = introControlsRef?.current;
      if (controls?.skipRequested) {
        controls.skipRequested = false;
        controls.paused = false;
        /* Never rewind: `getRollingSkipTime` seeks *forward* to the outro,
           and is pinned by `tests/intro-timeline.test.ts`. */
        timelineTimeRef.current = getRollingSkipTime(
          timelineTimeRef.current,
          timelineLayout,
        );
      }
      if (controls?.nextCueRequested) {
        controls.nextCueRequested = false;
        timelineTimeRef.current = getNextRollingCue(timelineTimeRef.current, timelineLayout);
      }
      if (!controls?.paused) {
        /* Advance by a *bounded* step, never by the raw frame delta. r3f
           hands over the wall-clock time since the previous frame, and the
           entrance is exactly where that number is least trustworthy: the
           renderer's first frames wait on WebGPU init and shader
           compilation, the tab may be backgrounded, and a GC pause or a
           dropped frame costs whole seconds. Added unbounded, one such stall
           skipped that many seconds of narrative — and a large enough first
           delta ran the clock straight past `getRollingFinalTime`, so
           `story.isComplete` fired on the first frame and the intro handed
           off having shown nothing. Clamping trades exact wall-clock
           duration on a struggling machine for the guarantee that every
           stage is actually played; `TIMELINE_MAX_STEP` is a 10 fps floor,
           below which the intro runs slow rather than skipping. */
        timelineTimeRef.current = Math.min(
          getRollingFinalTime(timelineLayout),
          timelineTimeRef.current + Math.min(delta, TIMELINE_MAX_STEP),
        );
      }
      const timelineTime = timelineTimeRef.current;
      const story = getRollingStoryFrame(timelineTime, timelineLayout);
      /* Every stage value comes from the pure envelopes; nothing here divides
         the clock by a boundary of its own. */
      const relocation = getRelocationEnvelope(timelineTime);
      const outro = smoothstep01(story.outroProgress);
      const textFlow = getTextFlowEnvelope(timelineTime, story.outroProgress);
      /* One continuous eased trajectory from the centred assembled lion to
         its settled place above the text column: X never moves, only scale
         and Y, and both come from `settledLionPlacement` — the assembled size,
         the settled size (floored at 42%/55% of it) and a Y capped by the
         measured crown clearance. `lionPlacement.name` and `timelineLayout`
         read the same breakpoint, so they cannot disagree. */
      const largeScale = lionPlacement.assembledScale;
      const storyScale = lionPlacement.scale;
      const storyY = lionPlacement.y;
      const preOutroScale = largeScale + (storyScale - largeScale) * relocation;
      const preOutroY = storyY * relocation;
      experienceFrameRef.current = {
        time: timelineTime,
        assemble: getFormationEnvelope(timelineTime),
        // The crowned lion is now the shared identity in both acts. Its crown
        // assembles with the face, avoiding a second asset or renderer.
        crownReveal: 1,
        lionOpacity: getLionOpacityEnvelope(timelineTime),
        lionScale: preOutroScale + (orbit.centerScale - preOutroScale) * outro,
        lionY: preOutroY * (1 - outro),
        lionRelocation: relocation,
        textFlow,
        activeTextTransfer: getActiveTextTransfer(story),
        scanReveal: getScanRevealEnvelope(timelineTime),
        readingMask: textFlow,
        navReveal: outro,
        textOpacity: getTextOpacityEnvelope(story.outroProgress),
        story,
      };
      if (story.isComplete && !introCompleteRef.current) {
        introCompleteRef.current = true;
        onIntroComplete?.();
      }
    } else {
      const story = getRollingStoryFrame(getRollingFinalTime(timelineLayout), timelineLayout);
      experienceFrameRef.current = {
        time: story.time,
        assemble: 1,
        crownReveal: 1,
        lionOpacity: 1,
        lionScale: orbit.centerScale,
        lionY: 0,
        lionRelocation: 0,
        textFlow: 0,
        activeTextTransfer: 0,
        scanReveal: 1,
        readingMask: 0,
        navReveal: 1,
        textOpacity: 0,
        story,
      };
    }
    const navReveal = experienceFrameRef.current.navReveal;
    const scanReveal = experienceFrameRef.current.scanReveal;
    if (networkRef.current) {
      /* The scan wakes during the rise on `scanReveal`, long before the
         navigation outro; the outro then owns the last of the scale easing.
         The ref is the only owner of this group's visibility. */
      networkRef.current.visible = Math.max(scanReveal, navReveal) > SCAN_VISIBLE_THRESHOLD;
      networkRef.current.scale.setScalar(0.965 + navReveal * 0.035);
    }
    if (ringsRef.current) {
      ringsRef.current.visible = navReveal > 0.18;
      ringsRef.current.scale.setScalar(0.95 + navReveal * 0.05);
    }
    if (connectorsRef.current) connectorsRef.current.visible = navReveal > 0.3;
    if (spokesRef.current) {
      spokesRef.current.visible = navReveal > 0.42;
      spokesRef.current.scale.setScalar(0.93 + navReveal * 0.07);
    }

    // world-per-CSS-px at the lion plane; sprite scale nodes multiply this
    pxToWorldRef.current = (2 * CAMERA_Z * Math.tan((FOV * Math.PI) / 360)) / size.height;
    dprRef.current = 1; // px sizes are CSS px — device px scaling comes from the render DPR

    // ---- idle rig rotation — reduced motion holds still, and so does
    //      `defaultSimParams`, which ships `idleRotateDegPerSec: 0`
    const rig = rigRef.current;
    if (rig && !reducedMotion) {
      rig.rotation.z += ((params.idleRotateDegPerSec * Math.PI) / 180) * delta;
    }

    // ---- pointer parallax (±`parallaxDeg`, 1.25° as shipped) with 0.08
    //      damping + activate dolly
    const ndc = pointerNdcRef.current;
    const responsiveParallax = intro || size.width <= 768 ? 0 : params.parallaxDeg;
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
  }, FRAME_WRITER_PRIORITY);

  // Render through the post chain; priority 1 disables r3f's auto-render.
  useFrame(() => {
    postRef.current?.post.render();
  }, 1);

  return (
    <>
      <AdaptiveDpr />
      <group ref={rigRef}>
        <group ref={networkRef}>
          <NetworkScan
            orbit={orbit}
            theme={theme}
            reducedMotion={reducedMotion}
            pxToWorldRef={pxToWorldRef}
            dprRef={dprRef}
            pointBudget={tier.networkPoints}
            params={params}
            experienceFrameRef={experienceFrameRef}
          />
        </group>
        <group ref={ringsRef} visible={!intro}>
          <OrbitalRings
            theme={theme}
            params={params}
            reducedMotion={reducedMotion}
            pxToWorldRef={pxToWorldRef}
            dprRef={dprRef}
            scale={orbit.centerScale}
          />
        </group>
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
            experienceFrameRef={experienceFrameRef}
          />
        ) : null}
        <group ref={spokesRef} visible={!intro}>
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
        </group>
        <group ref={connectorsRef} visible={!intro}>
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
      </group>
      {intro ? (
        <IntroText
          frameRef={experienceFrameRef}
          pxToWorldRef={pxToWorldRef}
          dprRef={dprRef}
          lightweight={tier.particles === 45_000}
          lionHomes={sim?.homeData ?? null}
        />
      ) : null}
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
