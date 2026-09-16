"use client";

import { useSyncExternalStore } from "react";

/**
 * The cover's motion pause control (WCAG 2.2.2 — pause, stop, hide).
 *
 * The cover's cinema is CSS keyframes and one scroll-driven timeline, and
 * this button is the off switch the OS preference does not cover: a reader
 * who wants the *rest* of the site to move but the lion held still sets the
 * pause here, and it persists. It sets `data-motion="paused"` on `<html>`,
 * which every cover rule reads (`html[data-motion="paused"]` in
 * `app/home.module.css` zeroes the runway and stills the layers), and it
 * freezes the ambient loops and page transitions as they land.
 *
 * The paused state is an external store rather than `useState` + effect,
 * for two reasons both about honesty of the first paint: the server HTML
 * and the first client render agree on the neutral state (motion playing)
 * through `getServerSnapshot`, so there is no hydration mismatch and no
 * cascading render from a synchronous setState inside an effect; and the
 * one write per press is a plain store update, the same shape the archive
 * reads `popstate` with. Storage failures degrade to session-local — a
 * reader with blocked storage loses nothing but the persistence. The
 * try/catch around the read is not decoration: storage can be partitioned
 * or denied.
 *
 * Registered in `tests/motion-runtime.test.ts`'s inventory terms: no rAF,
 * no observer, no listener — one `localStorage` read on first snapshot,
 * one write per press.
 */
const STORAGE_KEY = "lz-motion";
const PAUSED = "paused";

let snapshot: boolean | null = null;
const listeners = new Set<() => void>();

function subscribe(listener: () => void) {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
}

function getSnapshot(): boolean {
  if (snapshot === null) {
    let stored = false;
    try {
      stored = window.localStorage.getItem(STORAGE_KEY) === PAUSED;
    } catch {
      /* Storage unavailable: neutral state, per-session. */
    }
    if (stored) document.documentElement.setAttribute("data-motion", PAUSED);
    snapshot = stored;
  }
  return snapshot;
}

function getServerSnapshot(): boolean {
  return false;
}

function setPaused(next: boolean) {
  snapshot = next;
  try {
    window.localStorage.setItem(STORAGE_KEY, next ? PAUSED : "playing");
  } catch {
    /* See above: session-local is an acceptable degradation. */
  }
  if (next) document.documentElement.setAttribute("data-motion", PAUSED);
  else document.documentElement.removeAttribute("data-motion");
  for (const listener of listeners) listener();
}

export function MotionControl({ className }: { className?: string }) {
  const paused = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);
  return (
    <button
      type="button"
      className={className}
      onClick={() => setPaused(!paused)}
      aria-pressed={paused}
    >
      {paused ? "Play motion" : "Pause motion"}
    </button>
  );
}
