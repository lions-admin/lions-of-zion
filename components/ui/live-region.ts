/**
 * STATE-002 — live-region policy.
 *
 * Polite: result counts, new updates, success, non-blocking progress.
 * Assertive: blocking errors only. Never announce ambient status on a loop.
 *
 * Spread one of these onto the element rather than writing the attributes by
 * hand: twelve surfaces had hand-rolled their own by 2026-09-16, and they
 * disagreed on whether a region was atomic and whether it carried a role.
 */
export const politeLive = {
  role: "status",
  "aria-live": "polite",
  "aria-atomic": "true",
} as const;

/**
 * `role="alert"` implies an assertive live region, and a screen reader that
 * honours only the implicit semantics reads just the node that changed. The
 * explicit `aria-atomic` is what makes a blocking error read as one sentence
 * when a single word of it re-renders.
 */
export const assertiveLive = {
  role: "alert",
  "aria-live": "assertive",
  "aria-atomic": "true",
} as const;

/** A region that must not narrate while it is animating. */
export const silentLive = {
  "aria-live": "off",
} as const;

/**
 * The polite region, but only when nothing is in flight. A walkthrough that
 * advances itself every few seconds would otherwise announce every step of
 * its own autoplay; once the reader stops it, or selects a step by hand, the
 * same region narrates that choice. Returns `aria-live="off"` rather than
 * nothing while playing, so the intent is visible in the DOM and a region
 * that was just `role="status"` is explicitly silenced rather than quietly
 * stripped.
 */
export function liveWhenIdle(playing: boolean): typeof politeLive | typeof silentLive {
  return playing ? silentLive : politeLive;
}
