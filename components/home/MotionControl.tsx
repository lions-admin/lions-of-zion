"use client";

import { useEffect, useSyncExternalStore } from "react";
import styles from "@/app/home.module.css";

const STORAGE_KEY = "loz:motion";

/* The preference is an external store — localStorage, plus the same-tab
   listeners below — read through `useSyncExternalStore` so the server's
   answer (never paused) and the client's can differ without a hydration
   warning and without a state update inside an effect. */
const listeners = new Set<() => void>();

function subscribe(onChange: () => void) {
  listeners.add(onChange);
  window.addEventListener("storage", onChange);
  return () => {
    listeners.delete(onChange);
    window.removeEventListener("storage", onChange);
  };
}

function readPaused(): boolean {
  try {
    return window.localStorage.getItem(STORAGE_KEY) === "paused";
  } catch {
    /* Private mode or blocked storage: the control still works for the visit
       through the attribute alone; it just does not remember. */
    return document.documentElement.getAttribute("data-motion") === "paused";
  }
}

const readPausedOnServer = () => false;

function writePaused(next: boolean) {
  try {
    if (next) window.localStorage.setItem(STORAGE_KEY, "paused");
    else window.localStorage.removeItem(STORAGE_KEY);
  } catch {
    /* Same as above. */
  }
  if (next) document.documentElement.setAttribute("data-motion", "paused");
  else document.documentElement.removeAttribute("data-motion");
  for (const listener of listeners) listener();
}

/**
 * The reader's own pause (WCAG 2.2.2) — the cover's one visible control over
 * its motion, and a third state beside the OS preference and the no-script
 * case.
 *
 * Pressing it sets `data-motion="paused"` on the root element and remembers
 * the choice, so it holds across pages and visits. Every scroll-driven rule
 * on the cover, the one ambient loop, the `.enter` entrances and the page
 * transitions read that attribute exactly as they read
 * `prefers-reduced-motion` (see `app/globals.css` and `app/home.module.css`).
 * Nothing here runs a frame: the attribute is the whole mechanism, and the
 * stylesheet does the rest.
 *
 * Rendered as a real button in the server HTML. Before hydration it does
 * nothing, which is honest — without script the cover is already still. A
 * reader who paused on an earlier visit sees the cover settle within a frame
 * of hydration, when the effect below re-applies the remembered attribute.
 */
export function MotionControl() {
  const paused = useSyncExternalStore(subscribe, readPaused, readPausedOnServer);

  /* The attribute is what the stylesheet reads; the store is what the button
     reads. Keeping the DOM in step with the store is an external-system
     update, which is what an effect is for. */
  useEffect(() => {
    if (paused) document.documentElement.setAttribute("data-motion", "paused");
    else document.documentElement.removeAttribute("data-motion");
  }, [paused]);

  return (
    <button
      type="button"
      className={styles.motionControl}
      aria-pressed={paused}
      onClick={() => writePaused(!paused)}
      data-measure-id="cover-motion"
      data-measure-exposure="none"
    >
      {paused ? "Play motion" : "Pause motion"}
    </button>
  );
}
