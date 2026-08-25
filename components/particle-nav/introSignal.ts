/**
 * How the intro tells the rest of the page it owns the screen.
 *
 * The nav canvas and the chat launcher are siblings under `<body>` — the
 * launcher is mounted by the root layout, the canvas by the page — with no
 * provider between them and no store in this repo to add one to. So the state
 * travels as DOM attributes, which both the stylesheet (`body:has(…)`) and the
 * launcher's `MutationObserver` can read.
 *
 * They live here rather than as string literals at each site because there are
 * now three readers: `CanvasMount` writes them, `particle-chat-launcher.module.css`
 * paints against them, and `ParticleChatLauncher` observes them. A rename that
 * reaches two of the three fails silently, and the failure is a launcher
 * sitting on top of the intro.
 */

export const INTRO_SIGNAL_ATTRIBUTES = [
  /** The server's claim: this mount was asked for an intro. Survives until
      hydration either confirms it or rules it out. */
  'data-intro-pending',
  /** The intro is genuinely running. Only ever true after hydration. */
  'data-intro-active',
  /** The intro finished; input stays inert while a touch gesture lands. */
  'data-handoff-blocked',
] as const;

export const INTRO_SIGNAL_SELECTOR = INTRO_SIGNAL_ATTRIBUTES.map(
  (attribute) => `[${attribute}]`,
).join(',');

/**
 * What the server should assume before it can know. The intro only ever plays
 * on the root route, and that route emits `data-intro-pending` in its first
 * HTML, so this agrees with the markup at hydration.
 */
export function introRouteDefault(pathname: string | null): boolean {
  return pathname === '/';
}

/**
 * Whether a click belongs to the user or to the handoff.
 *
 * WebKit hit-tests a tap at `touchend`, against whatever is live at that
 * moment — not against what was under the finger when it went down. So the
 * navigation appearing under a finger that is already resting on the screen is
 * enough to activate a link nobody chose, and the largest link on a phone is a
 * full-width card to the Geopolitical Brief.
 *
 * The test is the gesture's start, not the click's time: a click is the user's
 * choice only if the gesture that produced it began after the navigation was
 * both visible and interactive.
 *
 * @param gestureStartedAt when the pointer went down / the key went down, or 0
 * @param navLiveAt        when the navigation became interactive, or 0 if this
 *                         route never ran an intro and nothing needs guarding
 */
export function shouldSwallowClick(gestureStartedAt: number, navLiveAt: number): boolean {
  if (!navLiveAt) return false;
  return gestureStartedAt <= navLiveAt;
}
