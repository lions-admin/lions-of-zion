"use client";

import { useSyncExternalStore } from "react";

/**
 * Viewport gates for the visualizer, read from JavaScript.
 *
 * Two rules govern every gate in this file.
 *
 * **Gate on width *and* height.** A width-only gate is how a full-height
 * side panel ends up pinned across a 1024×768 landscape viewport with no
 * room left for the thing it annotates. Every gate below names a minimum
 * height as well.
 *
 * **The query strings are shared with the stylesheet.** CSS owns what is
 * displayed, so the first paint is already correct and nothing flashes;
 * JavaScript reads the same string only to decide which *shell* a surface
 * gets (a non-modal aside versus a modal drawer) and what the controls say.
 * If the two ever disagreed the page would render one thing and describe
 * another, so the strings are exported from here and pasted verbatim into
 * `visualizer.module.css` beside a comment pointing back at this file.
 */
export const WORKBENCH_QUERY = "(min-width: 64rem) and (min-height: 40rem)";

type Entry = {
  subscribe: (onChange: () => void) => () => void;
  getSnapshot: () => boolean;
};

const entries = new Map<string, Entry>();

function entryFor(query: string): Entry {
  const existing = entries.get(query);
  if (existing) return existing;

  const entry: Entry = {
    subscribe: (onChange) => {
      const mql = window.matchMedia(query);
      mql.addEventListener("change", onChange);
      return () => mql.removeEventListener("change", onChange);
    },
    getSnapshot: () => window.matchMedia(query).matches,
  };

  entries.set(query, entry);
  return entry;
}

/* The server cannot know the viewport, so it answers "small". The whole
   layout is built so that answer is the safe one: the structure list is the
   server-rendered stage and the map is the enhancement, not the reverse. */
function getServerSnapshot(): boolean {
  return false;
}

export function useViewportGate(query: string): boolean {
  const entry = entryFor(query);
  return useSyncExternalStore(entry.subscribe, entry.getSnapshot, getServerSnapshot);
}
