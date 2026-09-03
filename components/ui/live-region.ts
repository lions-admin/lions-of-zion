/**
 * STATE-002 — live-region policy.
 *
 * Polite: result counts, new updates, success, non-blocking progress.
 * Assertive: blocking errors only. Never announce ambient status on a loop.
 */
export const politeLive = {
  role: "status",
  "aria-live": "polite",
  "aria-atomic": "true",
} as const;

export const assertiveLive = {
  role: "alert",
} as const;
