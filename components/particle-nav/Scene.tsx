'use client';
/**
 * The canvas. One <Canvas>, one camera, two sibling layers: the lion and the
 * story text. WebGPU init is async — the gl factory MUST await
 * renderer.init() or the canvas stays silently blank (brief §2.1 rule 1).
 *
 * The canvas clears **transparent**. The entrance's background is the site's
 * own CSS scan backdrop, rendered by the page underneath; an opaque clear
 * would paint black over it. Nothing in the post chain assumes an opaque
 * background — `pass()` carries the scene's own alpha and the bloom node is
 * added to it.
 *
 * This layer used to carry four more siblings: a GPU intelligence scan and an
 * orbital ring navigation of eight nodes with connectors and projected DOM
 * labels. Both were retired by owner instruction on 2026-09-04 — the scan
 * because the site's CSS backdrop is the background now, the orbit because
 * the home page carries its own navigation. Their removal took the
 * interaction machine with it: hover, the activation burst, the connector
 * Bézier the lion streamed particles along, and the activate dolly all
 * existed to serve those nodes and have no source without them.
 */
import { useEffect, useMemo, useRef } from 'react';
import { Canvas, useFrame, useThree } from '@react-three/fiber';
import { AdaptiveDpr } from '@react-three/drei';
import { Group, PerspectiveCamera, WebGPURenderer } from 'three/webgpu';
import { LionCore } from './layers/LionCore';
import { IntroText } from './layers/IntroText';
import { useLionBuffers } from './hooks/useLionBuffers';
import { createPost, type PostHandle } from './tsl/post';
import { computeOrbitLayout, MOBILE_MAX_WIDTH, type SafeAreaInsets } from './config';
import type { PerfTier } from './hooks/usePerfTier';
import type { ParticleNavTheme, SimParams } from './types';
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
  getTextFlowEnvelope,
  getTextOpacityEnvelope,
  smoothstep01,
} from '@/components/intro/story-timeline';
import { settledLionPlacement } from '@/components/intro/introLayout';

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
  radius: number;
  theme: ParticleNavTheme;
  params: SimParams;
  tier: PerfTier;
  reducedMotion: boolean;
  forceWebGL?: boolean;
  safeArea: SafeAreaInsets;
  onReady?: () => void;
  onFrameStats?: (ms: number, fps: number) => void;
  intro?: boolean;
  introControlsRef?: { current: IntroControls };
  onIntroComplete?: () => void;
}

function SceneContent(props: SceneProps) {
  const {
    radius,
    theme,
    params,
    tier,
    reducedMotion,
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
  /* `computeOrbitLayout` outlived the orbit it was named for: `centerScale`
     is the lion's responsive base size, and the placement below is solved
     against it. */
  const orbit = useMemo(
    () => computeOrbitLayout(size.width, size.height, radius, safeArea),
    [radius, safeArea, size.height, size.width],
  );
  /* The settled lion's scale and Y, solved from the same viewport, safe-area
     and camera, so the crown stays under the frame edge and the entrance
     chrome at every size. Memoised: nothing in the frame loop re-derives it. */
  const lionPlacement = useMemo(
    () => settledLionPlacement(size.width, size.height, safeArea, orbit),
    [orbit, safeArea, size.height, size.width],
  );

  const rootRef = useRef<Group>(null);
  const experienceFrameRef = useRef<ExperienceFrame | null>(null);
  const pxToWorldRef = useRef(0.007);
  const dprRef = useRef(1);
  const postRef = useRef<PostHandle | null>(null);
  const readyRef = useRef(false);
  const introCompleteRef = useRef(false);
  const timelineTimeRef = useRef(0);
  const timelineLayoutRef = useRef<'desktop' | 'mobile'>(
    size.width < MOBILE_MAX_WIDTH ? 'mobile' : 'desktop',
  );
  const statsRef = useRef({ acc: 0, frames: 0, last: 0 });

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
     that. Without the ordering, `LionCore` and `IntroText` both subscribed
     after this one but at the default priority and read the *previous*
     frame's `ExperienceFrame`: during the 1.1 s rise the lion moved a frame
     further than the text particles born on its surface, so the stream
     detached from the lion it is supposed to come out of. */
  useFrame((state, delta) => {
    const now = performance.now();

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
         and Y, and both come from `settledLionPlacement` — the assembled
         size, the settled size (floored at 42%/55% of it) and a Y capped by
         the measured crown clearance. `lionPlacement.name` and
         `timelineLayout` read the same breakpoint, so they cannot disagree. */
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
        outro,
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
        outro: 1,
        textOpacity: 0,
        story,
      };
    }

    // world-per-CSS-px at the lion plane; sprite scale nodes multiply this
    pxToWorldRef.current = (2 * CAMERA_Z * Math.tan((FOV * Math.PI) / 360)) / size.height;
    dprRef.current = 1; // px sizes are CSS px — device px scaling comes from the render DPR

    /* The camera is fixed. Pointer parallax and the activate dolly were orbit
       affordances: the parallax tracked a pointer the entrance never has (the
       canvas is pointer-inert and the destination is inert underneath), and
       the dolly pushed toward the node being activated. Neither has a subject
       now, and a still camera is what the lion-to-text transfer is composed
       against. */
    camera.lookAt(0, 0, 0);

    // ---- live bloom tuning (demo control panel)
    postRef.current?.setBloom(params.bloomThreshold, params.bloomStrength, params.bloomRadius);

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
    // frame is composed — don't hold the whole canvas hidden.
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
      <group ref={rootRef}>
        {sim ? (
          <LionCore
            sim={sim}
            theme={theme}
            params={params}
            reducedMotion={reducedMotion}
            pxToWorldRef={pxToWorldRef}
            dprRef={dprRef}
            scale={orbit.centerScale}
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
          /* Transparent, so the site's CSS scan backdrop shows through the
             entrance. `alpha` has to be asked for at construction — a zero
             clear alpha on an opaque context only yields black. */
          alpha: true,
          forceWebGL: forceWebGL || tier.backend === 'webgl2',
        });
        await renderer.init();
        renderer.setClearColor(theme.background, 0);
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
