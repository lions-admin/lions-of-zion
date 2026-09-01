'use client';
/**
 * The canvas. One <Canvas>, one camera, two sibling layers under a rig group.
 * WebGPU init is async — the gl factory MUST await renderer.init() or the
 * canvas stays silently blank (brief §2.1 rule 1).
 *
 * This scene is the cinematic intro and nothing else. The crowned-lion radial
 * navigation that used to share it — network scan, orbital rings, spoke nodes,
 * connectors — was deleted; the lion itself stays, because it is the intro's
 * subject.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr } from '@react-three/drei';
import { Group, PerspectiveCamera, Vector3, WebGPURenderer } from 'three/webgpu';
import { LionCore } from './layers/LionCore';
import { IntroText } from './layers/IntroText';
import { useLionBuffers } from './hooks/useLionBuffers';
import { createPost, type PostHandle } from './tsl/post';
import { lionCenterScale, MOBILE_MAX_WIDTH } from './config';
import type { PerfTier } from './hooks/usePerfTier';
import type { ParticleNavTheme, SimParams } from './types';
import type { ExperienceFrame, IntroControls } from './introFrame';
import {
  getNextRollingCue,
  getRollingFinalTime,
  getRollingOutroStart,
  getRollingStoryFrame,
} from '@/components/intro/rolling-story-timeline';
import {
  FORMATION_END,
  FORMATION_START,
  RELOCATION_END,
  RELOCATION_START,
} from '@/components/intro/story-timeline';

const CAMERA_Z = 8.2;
const FOV = 45;

export interface SceneProps {
  theme: ParticleNavTheme;
  params: SimParams;
  tier: PerfTier;
  reducedMotion: boolean;
  forceWebGL?: boolean;
  /** NDC pointer written by the DOM layer (canvas itself is pointer-inert). */
  pointerNdcRef: { current: { x: number; y: number } };
  onReady?: () => void;
  intro?: boolean;
  introControlsRef?: { current: IntroControls };
  onIntroComplete?: () => void;
}

const clamp01 = (value: number) => Math.max(0, Math.min(1, value));
const smooth01 = (value: number) => {
  const t = clamp01(value);
  return t * t * (3 - 2 * t);
};

function SceneContent(props: SceneProps) {
  const {
    theme,
    params,
    tier,
    reducedMotion,
    pointerNdcRef,
    onReady,
    intro = false,
    introControlsRef,
    onIntroComplete,
  } = props;

  const gl = useThree((s) => s.gl) as unknown as WebGPURenderer;
  const scene = useThree((s) => s.scene);
  const camera = useThree((s) => s.camera) as PerspectiveCamera;
  const size = useThree((s) => s.size);
  const centerScale = useMemo(() => lionCenterScale(size.width), [size.width]);

  const rigRef = useRef<Group>(null);
  const experienceFrameRef = useRef<ExperienceFrame | null>(null);
  const pxToWorldRef = useRef(0.007);
  const dprRef = useRef(1);
  const pointerWorldRef = useRef(new Vector3(0, 0, 99));
  const postRef = useRef<PostHandle | null>(null);
  const readyRef = useRef(false);
  const introCompleteRef = useRef(false);
  const timelineTimeRef = useRef(0);
  const timelineLayoutRef = useRef<'desktop' | 'mobile'>(size.width < MOBILE_MAX_WIDTH ? 'mobile' : 'desktop');
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
    const timelineLayout = size.width < MOBILE_MAX_WIDTH ? 'mobile' : 'desktop';
    if (timelineLayoutRef.current !== timelineLayout) {
      const oldFinal = getRollingFinalTime(timelineLayoutRef.current);
      const newFinal = getRollingFinalTime(timelineLayout);
      timelineTimeRef.current = (timelineTimeRef.current / oldFinal) * newFinal;
      timelineLayoutRef.current = timelineLayout;
    }
    if (intro) {
      const controls = introControlsRef?.current;
      if (controls?.skipRequested) {
        controls.skipRequested = false;
        controls.paused = false;
        /* Never rewind. Skip seeks *forward* to the outro; assigning it
           unconditionally meant a second tap during the 2.8s outro sent the
           clock back to the outro's start, so an impatient tapper could hold
           the handoff open indefinitely — and was, by construction, still
           tapping at the instant the page appeared underneath. */
        timelineTimeRef.current = Math.max(
          timelineTimeRef.current,
          getRollingOutroStart(timelineLayout),
        );
      }
      if (controls?.nextCueRequested) {
        controls.nextCueRequested = false;
        timelineTimeRef.current = getNextRollingCue(timelineTimeRef.current, timelineLayout);
      }
      if (!controls?.paused) {
        timelineTimeRef.current = Math.min(
          getRollingFinalTime(timelineLayout),
          timelineTimeRef.current + delta,
        );
      }
      const timelineTime = timelineTimeRef.current;
      const story = getRollingStoryFrame(timelineTime, timelineLayout);
      const relocation = smooth01((timelineTime - RELOCATION_START) / (RELOCATION_END - RELOCATION_START));
      const outro = smooth01(story.outroProgress);
      const narrow = timelineLayout === 'mobile';
      const largeScale = (narrow ? 1.65 : 2.65) * centerScale;
      const storyScale = (narrow ? 0.46 : 0.55) * centerScale;
      const storyY = narrow ? 2.45 : 2.35;
      const preOutroScale = largeScale + (storyScale - largeScale) * relocation;
      const preOutroY = storyY * relocation;
      experienceFrameRef.current = {
        time: timelineTime,
        assemble: smooth01((timelineTime - FORMATION_START) / (FORMATION_END - FORMATION_START)),
        // The crowned lion is the identity of the whole entrance. Its crown
        // assembles with the face, avoiding a second asset or renderer.
        crownReveal: 1,
        lionOpacity: smooth01((timelineTime - 1) / 0.42),
        lionScale: preOutroScale + (centerScale - preOutroScale) * outro,
        lionY: preOutroY * (1 - outro),
        navReveal: outro,
        textOpacity: 1 - smooth01((story.outroProgress - 0.32) / 0.68),
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
        lionScale: centerScale,
        lionY: 0,
        navReveal: 1,
        textOpacity: 0,
        story,
      };
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

    // ---- pointer parallax (±`parallaxDeg`, 1.25° as shipped) with 0.08 damping
    const ndc = pointerNdcRef.current;
    const responsiveParallax = intro || size.width <= 768 ? 0 : params.parallaxDeg;
    const maxOffset = Math.tan((responsiveParallax * Math.PI) / 180) * CAMERA_Z;
    const damp = 1 - Math.pow(1 - params.parallaxDamping, delta * 60);
    const targetX = reducedMotion ? 0 : ndc.x * maxOffset;
    const targetY = reducedMotion ? 0 : ndc.y * maxOffset;
    camera.position.x += (targetX - camera.position.x) * damp;
    camera.position.y += (targetY - camera.position.y) * damp;
    camera.position.z = CAMERA_Z;
    camera.lookAt(0, 0, 0);

    // ---- pointer world position on the lion plane (z≈0)
    tmp.v.set(ndc.x, ndc.y, 0.5).unproject(camera);
    tmp.w.copy(tmp.v).sub(camera.position).normalize();
    const t = -camera.position.z / tmp.w.z;
    pointerWorldRef.current.copy(camera.position).addScaledVector(tmp.w, t);

    postRef.current?.setBloom(params.bloomThreshold, params.bloomStrength, params.bloomRadius);

    // Ready = frames are flowing. The lion may still be streaming in, but the
    // frame is composed — don't hold the whole canvas hidden.
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
        {sim ? (
          <LionCore
            sim={sim}
            theme={theme}
            params={params}
            reducedMotion={reducedMotion}
            pointerRef={pointerWorldRef}
            pxToWorldRef={pxToWorldRef}
            dprRef={dprRef}
            scale={centerScale}
            experienceFrameRef={experienceFrameRef}
          />
        ) : null}
      </group>
      {intro ? (
        <IntroText
          frameRef={experienceFrameRef}
          pxToWorldRef={pxToWorldRef}
          dprRef={dprRef}
          lightweight={tier.particles === 45_000}
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
