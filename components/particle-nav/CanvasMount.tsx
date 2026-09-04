'use client';
/**
 * Client orchestration: attaches the interaction machine to the
 * server-rendered links (pointer and keyboard dispatch identically),
 * defers the canvas until after first paint (requestIdleCallback OR
 * IntersectionObserver, whichever fires first — brief §8), and owns the
 * 320 ms navigation timer, which never waits for the animation.
 */
import dynamic from 'next/dynamic';
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore, type ReactNode } from 'react';
import { usePerfTier } from './hooks/usePerfTier';
import { useReducedMotion } from './hooks/useReducedMotion';
import {
  defaultSimParams,
  defaultTheme,
  type SafeAreaInsets,
} from './config';
import type { ParticleNavProps, SimParams } from './types';
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

/**
 * The entrance's dead-man switch.
 *
 * `Scene` reports `onReady` from its first *composed* frame — not from a
 * loaded font, not from a decoded lion — so a canvas that is merely slow and
 * a canvas that will never paint look identical from here until one of them
 * paints. And the second case is reachable: `usePerfTier` calls the backend
 * `webgpu` on the strength of `'gpu' in navigator` alone, without ever asking
 * for an adapter, so every machine that advertises WebGPU and cannot deliver
 * it — no adapter, a blocklisted GPU, a lost device, a shader that will not
 * compile, a VM — takes the intro path and then never renders.
 *
 * What that leaves on screen is the worst state this component can produce.
 * `[data-intro-only]` is `position: fixed`, `inset: 0`, `z-index: 1000` on
 * `#000`, so it is the whole viewport; `onIntroComplete` can only come from
 * the frame loop that is not running, so `introDone` never flips; and
 * `.skipIntro` is still `opacity: 0`, because its reveal is keyed on
 * `[data-live]` — which is `canvasLive`, the signal that never arrived. The
 * page is a black rectangle for the rest of the session. Escape still works,
 * and the invisible Skip is still focusable and still takes a blind tap in
 * the corner, but neither of those is a fallback anyone can find.
 *
 * So readiness itself is bounded. A healthy first frame lands inside a few
 * hundred milliseconds; this is an order of magnitude past that, and it is
 * cleared the moment `canvasLive` arrives, so it can only fire on a canvas
 * that genuinely never painted. When it fires it runs the ordinary handoff —
 * marked seen, guarded, `introDismissed` — and the server-rendered home
 * underneath becomes the page, which is exactly the no-GPU result.
 */
const INTRO_READY_TIMEOUT_MS = 6_000;

export interface NavClientProps {
  /** Lion base radius, feeding the responsive `centerScale`. */
  radius: number;
  active?: boolean;
  theme?: ParticleNavProps['theme'];
  forceWebGL?: boolean;
  simOverrides?: Partial<SimParams>;
  onFrameStats?: (ms: number, fps: number) => void;
  /**
   * The destination the entrance hands off to. Optional: `/particle-demo`
   * mounts the scene with nothing behind it.
   */
  children?: React.ReactNode;
  /**
   * What the entrance is composed over, behind the transparent canvas.
   *
   * The site's own CSS scan backdrop, passed in rather than imported: it is a
   * server component that reads the corpus from disk, and this file is a
   * client boundary. The entrance paints its own opaque ground and holds the
   * destination at `opacity: 0`, so it cannot simply let the page's band show
   * through — it needs an instance of its own.
   */
  introBackground?: React.ReactNode;
  intro?: boolean;
  /**
   * Use the scene only as the cinematic entrance. Once the story completes,
   * or when motion/GPU capability asks us to bypass it, the renderer unmounts
   * and this layer releases the application underneath it.
   */
  introOnly?: boolean;
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
  introOverlay,
  introBackground,
}: NavClientProps) {
  const containerRef = useRef<HTMLDivElement>(null);
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
  const [safeArea, setSafeArea] = useState<SafeAreaInsets>({ top: 0, right: 0, bottom: 0, left: 0 });
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

  /* See `INTRO_READY_TIMEOUT_MS`. Armed only while the entrance is actually
     running and the canvas has not reported a frame; the first frame clears
     it, so on every working device this timer is disarmed long before it
     could fire. */
  useEffect(() => {
    if (!introRunning || canvasLive) return;
    let id = 0;
    /* Counted only while the document is visible. A hidden tab has no
       `requestAnimationFrame`, so a canvas that has not painted there is not
       a canvas that failed — it is a canvas that was never asked to draw.
       Counting that time dismissed the entrance for anyone who opens the
       site in a background tab and switches to it a few seconds later, which
       is the opposite of what this timer is for. Re-armed on every
       visibility change, so the six seconds are six seconds of real
       opportunity to paint. */
    const arm = () => {
      window.clearTimeout(id);
      if (document.visibilityState !== 'visible') return;
      id = window.setTimeout(completeIntro, INTRO_READY_TIMEOUT_MS);
    };
    arm();
    document.addEventListener('visibilitychange', arm);
    return () => {
      window.clearTimeout(id);
      document.removeEventListener('visibilitychange', arm);
    };
  }, [canvasLive, completeIntro, introRunning]);

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
   * links, since retired whole. On the device where this actually goes wrong
   * the guard was attached to elements that cannot be tapped, and the real
   * destinations — the home's own server-rendered links, index, rail and
   * full-width primary CTA alike — had no guard at all: only
   * `pointer-events: none` for a fixed window, which is a time bound on a
   * problem that is not about time.
   *
   * WebKit hit-tests a tap at `touchend`, against whatever is live *then*. So a
   * finger that goes down while the navigation is inert and lifts after it goes
   * live activates whatever it happens to be resting on — and on a phone the
   * largest thing under it is the home's full-width "Read the Daily Brief".
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
    const startGesture = () => {
      gestureStartRef.current = performance.now();
    };
    const swallowStaleClick = (event: MouseEvent) => {
      if (!shouldSwallowClick(gestureStartRef.current, liveAtRef.current)) return;
      event.preventDefault();
      event.stopPropagation();
    };
    /* All four on the window, in the capture phase.
     *
     * The gesture listeners are on the window because a gesture must be
     * recorded even where the target is inert. The click listener is on the
     * window for a different and, until now, unmet reason: the links this
     * guard exists to protect are not inside this component. `CanvasMount`'s
     * `children` on the home route is the poster; `CinematicIntroGate` renders
     * the page itself into `.introDestination`, a *sibling* of this container.
     * A listener on `containerRef` therefore covered the eight orbit links —
     * `display: none` below 720px — and never once saw the full-width card to
     * the Geopolitical Brief that the comment above describes.
     *
     * `shouldSwallowClick` short-circuits on `navLiveAt === 0`, so the window
     * scope costs nothing on the routes that never run an intro, and it is
     * one-shot on the route that does: every gesture after the navigation goes
     * live postdates `liveAtRef`. */
    window.addEventListener('pointerdown', startGesture, true);
    window.addEventListener('touchstart', startGesture, true);
    window.addEventListener('keydown', startGesture, true);
    window.addEventListener('click', swallowStaleClick, true);
    return () => {
      window.removeEventListener('pointerdown', startGesture, true);
      window.removeEventListener('touchstart', startGesture, true);
      window.removeEventListener('keydown', startGesture, true);
      window.removeEventListener('click', swallowStaleClick, true);
    };
  }, []);

  /* The orbital navigation this component used to wire up — hover and focus
     into the interaction machine, activation into a 320 ms router push, and
     the projected label elements the Scene positioned each frame — was
     retired on 2026-09-04. The home page carries its own navigation, and the
     entrance no longer renders links of its own. */

  // The canvas is enhancement only. The home carries its navigation in its
  // own server HTML — index, rail, CTAs — so the renderer mounts when a real
  // tier exists and stays off otherwise; `data-canvas` on the host marks
  // which, and the poster drops only then.
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
    >
      {introBackground && introRunning ? (
        <div className={styles.introBackground} aria-hidden="true">
          {introBackground}
        </div>
      ) : null}
      <div
        className={styles.navContent}
        aria-hidden={introOnly || introRunning || undefined}
        inert={introOnly || introRunning || handoffBlocked ? true : undefined}
      >
        {children}
      </div>
      {showCanvas ? (
        <div
          className={`${styles.canvasWrap} ${canvasLive ? styles.canvasLive : ''}`}
          aria-hidden="true"
        >
          <Scene
            radius={radius}
            theme={theme}
            params={params}
            tier={tier}
            reducedMotion={reducedMotion}
            forceWebGL={forceWebGL}
            safeArea={safeArea}
            onReady={() => setCanvasLive(true)}
            onFrameStats={onFrameStats}
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
