'use client';
/**
 * Client orchestration: attaches the interaction machine to the
 * server-rendered links (pointer and keyboard dispatch identically),
 * defers the canvas until after first paint (requestIdleCallback OR
 * IntersectionObserver, whichever fires first — brief §8), and owns the
 * 320 ms navigation timer, which never waits for the animation.
 */
import dynamic from 'next/dynamic';
import { useRouter } from 'next/navigation';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from 'react';
import { usePerfTier } from './hooks/usePerfTier';
import { useReducedMotion } from './hooks/useReducedMotion';
import { useInteractionDriver } from './hooks/useInteraction';
import {
  defaultSimParams,
  defaultTheme,
  CANVAS_FADE_MS,
  NAVIGATE_AT_MS,
  type SafeAreaInsets,
} from './config';
import type { NavNode, ParticleNavProps, SimParams } from './types';
import styles from './styles.module.css';
import { STORY_PARAGRAPHS } from '@/components/intro/story-timeline';
import type { IntroControls } from './introFrame';

// The canvas is dynamic-imported and must never block LCP (brief §8):
// three.js bytes only download after the DOM nav is interactive.
const Scene = dynamic(() => import('./Scene'), { ssr: false });

export interface NavClientProps {
  nodes: NavNode[];
  radius: number;
  active?: boolean;
  theme?: ParticleNavProps['theme'];
  forceWebGL?: boolean;
  simOverrides?: Partial<SimParams>;
  onFrameStats?: (ms: number, fps: number) => void;
  children: React.ReactNode;
  intro?: boolean;
}

const subscribeToHydration = () => () => {};

function useHydrated() {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

export function NavClient({
  nodes,
  radius,
  active = true,
  theme: themeOverride,
  forceWebGL,
  simOverrides,
  onFrameStats,
  children,
  intro = false,
}: NavClientProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const labelElsRef = useRef<(HTMLElement | null)[]>([]);
  const pointerNdcRef = useRef({ x: 0, y: 0 });
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introControlsRef = useRef<IntroControls>({
    paused: false,
    skipRequested: false,
    nextCueRequested: false,
  });
  const skipFocusRef = useRef(0);

  const tier = usePerfTier(forceWebGL);
  const reducedMotion = useReducedMotion();
  const hydrated = useHydrated();
  const driver = useInteractionDriver(nodes.length);

  const [wantCanvas, setWantCanvas] = useState(false);
  const [canvasLive, setCanvasLive] = useState(false);
  const [fading, setFading] = useState(false);
  const [safeArea, setSafeArea] = useState<SafeAreaInsets>({ top: 0, right: 0, bottom: 0, left: 0 });
  const [introDone, setIntroDone] = useState(false);

  const theme = useMemo(() => ({ ...defaultTheme, ...themeOverride }), [themeOverride]);
  const params: SimParams = useMemo(
    () => ({ ...defaultSimParams, ...simOverrides }),
    [simOverrides],
  );

  useEffect(() => {
    driver.machine.setReducedMotion(reducedMotion);
  }, [driver, reducedMotion]);

  // ---- deferred mount: idle callback or visibility, whichever first
  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    let done = false;
    const go = () => {
      if (!done) {
        done = true;
        setWantCanvas(true);
      }
    };
    if (intro) go();
    const hasIdle = typeof window.requestIdleCallback === 'function';
    const idleId = hasIdle
      ? window.requestIdleCallback(go, { timeout: 2500 })
      : window.setTimeout(go, 350);
    const io = new IntersectionObserver((entries) => {
      if (entries.some((e) => e.isIntersecting)) go();
    });
    io.observe(el);
    return () => {
      if (hasIdle) window.cancelIdleCallback(idleId);
      else clearTimeout(idleId);
      io.disconnect();
    };
  }, [intro]);

  const introRunning = Boolean(
    intro && hydrated && !reducedMotion && !introDone && tier?.backend !== 'none',
  );

  useEffect(() => {
    if (!introRunning) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        introControlsRef.current.skipRequested = true;
      } else if (event.key === ' ') {
        event.preventDefault();
        introControlsRef.current.paused = !introControlsRef.current.paused;
      } else if (event.key === 'ArrowRight') {
        event.preventDefault();
        introControlsRef.current.nextCueRequested = true;
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [introRunning]);

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;
    const readSafeArea = () => {
      const css = getComputedStyle(el);
      const px = (name: string) => Number.parseFloat(css.getPropertyValue(name)) || 0;
      const next = {
        top: px('--safe-top'),
        right: px('--safe-right'),
        bottom: px('--safe-bottom'),
        left: px('--safe-left'),
      };
      setSafeArea((current) =>
        current.top === next.top &&
        current.right === next.right &&
        current.bottom === next.bottom &&
        current.left === next.left
          ? current
          : next,
      );
    };
    readSafeArea();
    window.addEventListener('resize', readSafeArea);
    window.visualViewport?.addEventListener('resize', readSafeArea);
    return () => {
      window.removeEventListener('resize', readSafeArea);
      window.visualViewport?.removeEventListener('resize', readSafeArea);
    };
  }, []);

  // ---- machine wiring on the server-rendered links (focus == hover, §9)
  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const links = Array.from(
      container.querySelectorAll<HTMLAnchorElement>('a[data-node-index]'),
    ).sort(
      (a, b) => Number(a.dataset.nodeIndex) - Number(b.dataset.nodeIndex),
    );
    labelElsRef.current = links.map((l) => l.closest('li'));

    const cleanups: (() => void)[] = [];
    links.forEach((link) => {
      const i = Number(link.dataset.nodeIndex);
      const enter = () => driver.machine.hover(i);
      const leave = () => driver.machine.unhover(i);
      const click = (e: MouseEvent) => {
        // modified/middle clicks keep native behaviour (new tab etc.)
        if (e.metaKey || e.ctrlKey || e.shiftKey || e.altKey || e.button !== 0) return;
        e.preventDefault();
        driver.machine.activate(i);
        setFading(true);
        if (navTimerRef.current) clearTimeout(navTimerRef.current);
        // Navigation fires at 320 ms — it must not wait for the animation (§7).
        navTimerRef.current = setTimeout(() => {
          router.push(link.getAttribute('href') ?? '/');
        }, NAVIGATE_AT_MS);
      };
      link.addEventListener('pointerenter', enter);
      link.addEventListener('pointerleave', leave);
      link.addEventListener('focus', enter);
      link.addEventListener('blur', leave);
      link.addEventListener('click', click);
      cleanups.push(() => {
        link.removeEventListener('pointerenter', enter);
        link.removeEventListener('pointerleave', leave);
        link.removeEventListener('focus', enter);
        link.removeEventListener('blur', leave);
        link.removeEventListener('click', click);
      });
    });
    return () => {
      cleanups.forEach((fn) => fn());
      if (navTimerRef.current) clearTimeout(navTimerRef.current);
    };
  }, [driver, nodes, router]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointerNdcRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdcRef.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }, []);

  const getLabelEls = useCallback(() => labelElsRef.current, []);

  const showCanvas = active && wantCanvas && tier && tier.backend !== 'none';
  const hasLiveBackend = Boolean(active && tier && tier.backend !== 'none');

  return (
    <div
      ref={containerRef}
      className={styles.root}
      data-live={canvasLive ? '' : undefined}
      data-canvas={hasLiveBackend ? '' : undefined}
      data-backend={tier?.backend}
      data-intro-active={introRunning ? '' : undefined}
      onPointerMove={onPointerMove}
      style={{ ['--fade-ms' as string]: `${CANVAS_FADE_MS}ms` }}
    >
      <div
        className={styles.navContent}
        aria-hidden={introRunning || undefined}
        inert={introRunning ? true : undefined}
      >
        {children}
      </div>
      {showCanvas ? (
        <div
          className={`${styles.canvasWrap} ${fading ? styles.fadeOut : ''} ${canvasLive ? styles.canvasLive : ''}`}
          aria-hidden="true"
        >
          <Scene
            nodes={nodes}
            radius={radius}
            theme={theme}
            params={params}
            tier={tier}
            reducedMotion={reducedMotion}
            driver={driver}
            forceWebGL={forceWebGL}
            safeArea={safeArea}
            pointerNdcRef={pointerNdcRef}
            getLabelEls={getLabelEls}
            onReady={() => setCanvasLive(true)}
            onFrameStats={onFrameStats}
            intro={introRunning}
            introControlsRef={introControlsRef}
            onIntroComplete={() => setIntroDone(true)}
            skipFocusRef={skipFocusRef}
          />
        </div>
      ) : null}
      {introRunning ? (
        <>
          <article className={styles.srOnly} aria-label="The battlefield for truth">
            {STORY_PARAGRAPHS.map((paragraph) => <p key={paragraph}>{paragraph}</p>)}
          </article>
          <button
            type="button"
            className={styles.skipIntro}
            aria-label="Skip intro"
            onPointerEnter={() => { skipFocusRef.current = 1; }}
            onPointerLeave={() => { skipFocusRef.current = 0; }}
            onFocus={() => { skipFocusRef.current = 1; }}
            onBlur={() => { skipFocusRef.current = 0; }}
            onClick={() => { introControlsRef.current.skipRequested = true; }}
          >
            <span className={styles.srOnly}>Skip intro</span>
          </button>
        </>
      ) : null}
    </div>
  );
}
