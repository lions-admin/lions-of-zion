'use client';
/**
 * Client orchestration for the cinematic entrance: defers the canvas until
 * after first paint (requestIdleCallback OR IntersectionObserver, whichever
 * fires first — brief §8), owns the once-per-tab session flag, the skip
 * control, and the handoff guard that releases the page underneath.
 *
 * The crowned-lion radial navigation this file used to drive is deleted. What
 * is left is the intro and its handoff, nothing else.
 */
import dynamic from 'next/dynamic';
import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  useSyncExternalStore,
  type ReactNode,
} from 'react';
import { usePerfTier } from './hooks/usePerfTier';
import { useReducedMotion } from './hooks/useReducedMotion';
import { defaultSimParams, defaultTheme } from './config';
import type { IntroSceneProps, SimParams } from './types';
import styles from './styles.module.css';
import { STORY_PARAGRAPHS } from '@/components/intro/story-timeline';
import type { IntroControls } from './introFrame';
import { shouldSwallowClick } from './introSignal';

// The canvas is dynamic-imported and must never block LCP (brief §8):
// three.js bytes only download after the page underneath is interactive.
const Scene = dynamic(() => import('./Scene'), { ssr: false });
/* Matches `.posterContent`'s 700ms opacity transition. The two used to disagree by
   200ms, which is 200ms in which the page looks completely ready and silently
   eats every touch — the surest way to make someone tap again. */
const HANDOFF_INPUT_GUARD_MS = 700;

export interface IntroCanvasProps {
  theme?: IntroSceneProps['theme'];
  forceWebGL?: boolean;
  simOverrides?: Partial<SimParams>;
  children: React.ReactNode;
  /** Keeps the host content out of the accessibility tree while the intro owns the screen. */
  onIntroBlockingChange?: (blocked: boolean) => void;
  /** Minimal DOM chrome that belongs above the cinematic canvas during the entrance only. */
  introOverlay?: ReactNode;
}

const subscribeToHydration = () => () => {};

function useHydrated() {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

/**
 * Session memory: the intro plays once per tab. Completing or skipping it sets
 * the flag; later visits to "/" in the same tab mount straight into the
 * dismissed state, exactly as they do for reduced motion. Storage can be
 * denied — private mode, partitioned storage, hardened browsers — so every
 * access is guarded, and a failure only means the intro plays again.
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

export function IntroCanvas({
  theme: themeOverride,
  forceWebGL,
  simOverrides,
  children,
  onIntroBlockingChange,
  introOverlay,
}: IntroCanvasProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const pointerNdcRef = useRef({ x: 0, y: 0 });
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

  const [wantCanvas, setWantCanvas] = useState(false);
  const [canvasLive, setCanvasLive] = useState(false);
  const [introDone, setIntroDone] = useState(false);
  const [handoffBlocked, setHandoffBlocked] = useState(false);
  const [skipping, setSkipping] = useState(false);

  const theme = useMemo(() => ({ ...defaultTheme, ...themeOverride }), [themeOverride]);
  const params: SimParams = useMemo(
    () => ({ ...defaultSimParams, ...simOverrides }),
    [simOverrides],
  );

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
    go();
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
  }, []);

  const introRunning = Boolean(
    hydrated && !reducedMotion && !introDone && !introSeen && tier?.backend !== 'none',
  );

  const introDismissed = Boolean(
    hydrated && (introDone || introSeen || reducedMotion || tier?.backend === 'none'),
  );

  const introBlocking = Boolean(
    !introDismissed && (!hydrated || tier === null || introRunning || handoffBlocked),
  );

  useEffect(() => {
    onIntroBlockingChange?.(introBlocking);
  }, [introBlocking, onIntroBlockingChange]);

  // `introPending` is the server's early claim. Hydration either confirms it
  // with `introRunning` or dismisses the entrance for reduced motion, a seen
  // session, or a missing GPU backend.
  const introPending = Boolean(!introDone && (!hydrated || introRunning));

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
    // gesture to finish.
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

  /**
   * Nothing may be activated by a gesture that began before it was there.
   *
   * WebKit hit-tests a tap at `touchend`, against whatever is live *then*. So a
   * finger that goes down while the page is inert and lifts after it goes live
   * activates whatever it happens to be resting on — and on a phone the
   * largest thing under it is a full-width link.
   *
   * The bound that actually holds is the gesture's own start: a click is the
   * user's choice only if the gesture that produced it began after the page
   * could be seen and touched. This runs in the capture phase, so it stops both
   * a plain `<a href>` and `next/link`, whose handler never sees the event.
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

  const onPointerMove = useCallback((e: React.PointerEvent) => {
    const rect = containerRef.current?.getBoundingClientRect();
    if (!rect) return;
    pointerNdcRef.current.x = ((e.clientX - rect.left) / rect.width) * 2 - 1;
    pointerNdcRef.current.y = -(((e.clientY - rect.top) / rect.height) * 2 - 1);
  }, []);

  const showCanvas = wantCanvas && tier && tier.backend !== 'none' && !introDismissed;
  const hasLiveBackend = Boolean(tier && tier.backend !== 'none');

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
      data-intro-only=""
      data-intro-dismissed={introDismissed ? '' : undefined}
      onPointerMove={onPointerMove}
    >
      <div className={styles.posterContent} aria-hidden inert>
        {children}
      </div>
      {showCanvas ? (
        <div
          className={`${styles.canvasWrap} ${canvasLive ? styles.canvasLive : ''}`}
          aria-hidden="true"
        >
          <Scene
            theme={theme}
            params={params}
            tier={tier}
            reducedMotion={reducedMotion}
            forceWebGL={forceWebGL}
            pointerNdcRef={pointerNdcRef}
            onReady={() => setCanvasLive(true)}
            intro={introRunning}
            introControlsRef={introControlsRef}
            onIntroComplete={completeIntro}
          />
        </div>
      ) : null}
      {introRunning && introOverlay ? (
        <div className={styles.introOverlay} aria-hidden="true">
          {introOverlay}
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
                 and the second tap it invites is the one that lands on the page
                 as it arrives. */
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
