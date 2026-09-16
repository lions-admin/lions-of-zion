/**
 * STATE-002 — live-region policy.
 *
 * Polite: result counts, new updates, success, non-blocking progress.
 * Assertive: blocking errors only. Never announce ambient status on a loop.
 *
 * `liveWhenIdle` is for a region that goes quiet while an animated sequence
 * is genuinely running: while `playing` is true the region stops announcing,
 * and when the animation stops or the reader pauses it, the region is polite
 * again. Spread it exactly where a hand-rolled `aria-live={playing ? "off" :
 * "polite"}` used to be — it is the same contract, named once (2026-09-16).
 */
export const politeLive = {
  role: "status",
  "aria-live": "polite",
  "aria-atomic": "true",
} as const;

export const assertiveLive = {
  role: "alert",
  "aria-live": "assertive",
  "aria-atomic": "true",
} as const;

export function liveWhenIdle(playing: boolean) {
  return {
    "aria-live": playing ? ("off" as const) : ("polite" as const),
  };
}
