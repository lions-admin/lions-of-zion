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
import { shouldSwallowClick } from './introSignal';

// The canvas is dynamic-imported and must never block LCP (brief §8):
// three.js bytes only download after the DOM nav is interactive.
const Scene = dynamic(() => import('./Scene'), { ssr: false });
/* Matches `.navContent`'s 700ms opacity transition. The two used to disagree by
   200ms, which is 200ms in which the navigation looks completely ready and
   silently eats every touch — the surest way to make someone tap again. */
const HANDOFF_INPUT_GUARD_MS = 700;

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
  /**
   * Use the scene only as the cinematic entrance. Once the story completes,
   * or when motion/GPU capability asks us to bypass it, the renderer unmounts
   * and this layer releases the application underneath it.
   */
  introOnly?: boolean;
  /** Keeps the host content out of the accessibility tree while the intro owns the screen. */
  onIntroBlockingChange?: (blocked: boolean) => void;
}

const subscribeToHydration = () => () => {};

function useHydrated() {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

/**
 * Session memory: the intro plays once per tab. Completing or skipping it sets
 * the flag; later visits to "/" in the same tab mount straight into the
 * completed-navigation state (`introRunning` stays false, exactly as it does
 * for reduced motion). Storage can be denied — private mode, partitioned
 * storage, hardened browsers — so every access is guarded, and a failure only
 * means the intro plays again.
 */
const INTRO_SEEN_KEY = 'loz-intro-seen';

function getIntroSeenSnapshot() {
  try {
    return window.sessionStorage.getItem(INTRO_SEEN_KEY) === '1';
  } catch {
    return false;
  }
}

function markIntroSeen() {
  try {
    window.sessionStorage.setItem(INTRO_SEEN_KEY, '1');
  } catch {
    /* storage unavailable — the intro simply replays next session */
  }
}

/* Same shape as `useHydrated`: the server snapshot is false, and hydration
   either confirms it or drops the intro in the same commit that flips
   `hydrated` — so a seen intro never gets a first painted frame. */
function useIntroSeen() {
  return useSyncExternalStore(subscribeToHydration, getIntroSeenSnapshot, () => false);
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
  introOnly = false,
  onIntroBlockingChange,
}: NavClientProps) {
  const router = useRouter();
  const containerRef = useRef<HTMLDivElement>(null);
  const labelElsRef = useRef<(HTMLElement | null)[]>([]);
  const pointerNdcRef = useRef({ x: 0, y: 0 });
  const navTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const handoffTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const introControlsRef = useRef<IntroControls>({
    paused: false,
    skipRequested: false,
    nextCueRequested: false,
  });

  const tier = usePerfTier(forceWebGL);
  const reducedMotion = useReducedMotion();
  const hydrated = useHydrated();
  const introSeen = useIntroSeen();
  const driver = useInteractionDriver(nodes.length);

  const [wantCanvas, setWantCanvas] = useState(false);
  const [canvasLive, setCanvasLive] = useState(false);
  const [fading, setFading] = useState(false);
  const [safeArea, setSafeArea] = useState<SafeAreaInsets>({ top: 0, right: 0, bottom: 0, left: 0 });
  const [introDone, setIntroDone] = useState(false);
  const [handoffBlocked, setHandoffBlocked] = useState(false);
  const [skipping, setSkipping] = useState(false);

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
    intro && hydrated && !reducedMotion && !introDone && !introSeen && tier?.backend !== 'none',
  );

  const introDismissed = Boolean(
    introOnly &&
      hydrated &&
      (introDone || introSeen || reducedMotion || tier?.backend === 'none'),
  );

  const introBlocking = Boolean(
    introOnly && !introDismissed && (!hydrated || tier === null || introRunning || handoffBlocked),
  );

  useEffect(() => {
    onIntroBlockingChange?.(introBlocking);
  }, [introBlocking, onIntroBlockingChange]);

  // `introPending` is the server's early claim. Hydration either confirms it
  // with `introRunning` or dismisses the entrance for reduced motion, a seen
  // session, or a missing GPU backend.
  const introPending = Boolean(intro && !introDone && (!hydrated || introRunning));

  useEffect(() => {
    if (!introRunning) return;
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        event.preventDefault();
        markIntroSeen();
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

  const completeIntro = useCallback(() => {
    // iOS can retarget the tail of a touch gesture after the Skip control
    // unmounts. Keep the revealed home visible but inert long enough for that
    // gesture to finish, and cancel any navigation timer that might have been
    // armed before the handoff.
    if (navTimerRef.current) {
      clearTimeout(navTimerRef.current);
      navTimerRef.current = null;
    }
    if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current);
    markIntroSeen();
    setIntroDone(true);
    setHandoffBlocked(true);
    handoffTimerRef.current = setTimeout(() => {
      handoffTimerRef.current = null;
      setHandoffBlocked(false);
    }, HANDOFF_INPUT_GUARD_MS);
  }, []);

  useEffect(() => () => {
    if (handoffTimerRef.current) clearTimeout(handoffTimerRef.current);
  }, []);

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

  /**
   * Nothing may be activated by a gesture that began before it was there.
   *
   * The previous guard put its check on `a[data-node-index]` — the eight orbit
   * links. Those are `display: none` below 720px, so on the device where this
   * actually goes wrong the guard was attached to elements that cannot be
   * tapped. The real mobile destinations are `HomeSignalLayer`'s `next/link`s,
   * and they had no guard at all: only `pointer-events: none` for a fixed
   * window, which is a time bound on a problem that is not about time.
   *
   * WebKit hit-tests a tap at `touchend`, against whatever is live *then*. So a
   * finger that goes down while the navigation is inert and lifts after it goes
   * live activates whatever it happens to be resting on — and on a phone the
   * largest thing under it is a full-width link to the Geopolitical Brief.
   *
   * The bound that actually holds is the gesture's own start: a click is the
   * user's choice only if the gesture that produced it began after the
   * navigation could be seen and touched. This runs in the capture phase, so it
   * stops both a plain `<a href>` and `next/link`, whose handler never sees the
   * event.
   */
  const liveAtRef = useRef(0);
  const gestureStartRef = useRef(0);
  const introWasActiveRef = useRef(false);

  useEffect(() => {
    const blocked = introRunning || handoffBlocked;
    if (blocked) {
      introWasActiveRef.current = true;
      return;
    }
    /* Keyed on the transition, not on `completeIntro`, so the paths that end an
       intro without ever calling it — the GPU probe landing on `none`, reduced
       motion flipping mid-run — arm the guard too. */
    if (introWasActiveRef.current) {
      introWasActiveRef.current = false;
      liveAtRef.current = performance.now();
    }
  }, [handoffBlocked, introRunning]);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const startGesture = () => {
      gestureStartRef.current = performance.now();
    };
    const swallowStaleClick = (event: MouseEvent) => {
      if (!shouldSwallowClick(gestureStartRef.current, liveAtRef.current)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    // Capture, so a gesture is recorded even where the target is inert.
    window.addEventListener('pointerdown', startGesture, true);
    window.addEventListener('touchstart', startGesture, true);
    window.addEventListener('keydown', startGesture, true);
    container.addEventListener('click', swallowStaleClick, true);
    return () => {
      window.removeEventListener('pointerdown', startGesture, true);
      window.removeEventListener('touchstart', startGesture, true);
      window.removeEventListener('keydown', startGesture, true);
      container.removeEventListener('click', swallowStaleClick, true);
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
        if (introRunning || handoffBlocked) {
          e.preventDefault();
          return;
        }
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
  }, [driver, handoffBlocked, introRunning, nodes, router]);

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointerNdcRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdcRef.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }, []);

  const getLabelEls = useCallback(() => labelElsRef.current, []);

  // Every width keeps the live orbit after the intro. The static editorial
  // index in HomeSignalLayer is the no-JS/no-GPU tier only, gated in CSS on
  // the same `data-canvas` attribute.
  const showCanvas = active && wantCanvas && tier && tier.backend !== 'none' && !introDismissed;
  const hasLiveBackend = Boolean(active && tier && tier.backend !== 'none');

  return (
    <div
      ref={containerRef}
      className={styles.root}
      data-live={canvasLive ? '' : undefined}
      data-canvas={hasLiveBackend ? '' : undefined}
      data-backend={tier?.backend}
      data-intro-active={introRunning ? '' : undefined}
      data-intro-pending={introPending ? '' : undefined}
      data-handoff-blocked={handoffBlocked ? '' : undefined}
      data-intro-only={introOnly ? '' : undefined}
      data-intro-dismissed={introDismissed ? '' : undefined}
      onPointerMove={onPointerMove}
      style={{ ['--fade-ms' as string]: `${CANVAS_FADE_MS}ms` }}
    >
      <div
        className={styles.navContent}
        aria-hidden={introOnly || introRunning || undefined}
        inert={introOnly || introRunning || handoffBlocked ? true : undefined}
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
            onIntroComplete={completeIntro}
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
            data-skipping={skipping ? '' : undefined}
            onClick={() => {
              /* The outro still runs for 2.8s after this. Without an
                 acknowledgement the control just sits there looking unpressed,
                 and the second tap it invites is the one that lands on the
                 navigation as it arrives. */
              setSkipping(true);
              markIntroSeen();
              introControlsRef.current.skipRequested = true;
            }}
          >
            <span className={styles.skipRule} aria-hidden="true" />
            <span className={styles.skipLabel}>Skip intro</span>
            <svg
              className={styles.skipChevron}
              width="18"
              height="18"
              viewBox="0 0 14 14"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.7"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden="true"
            >
              <path d="M3 3l4 4-4 4" />
              <path d="M8 3l4 4-4 4" />
            </svg>
          </button>
        </>
      ) : null}
    </div>
  );
}
