"use client";

import { useEffect, useState } from "react";
import styles from "./hub-masthead.module.css";

export type HubJumpLink = { href: `#${string}`; label: string };

/**
 * The in-page contents of a hub — the row under the masthead that stays
 * under the site bar as the page scrolls, and says which section the reader
 * is inside (2026-09-16).
 *
 * Anchors only, by contract: a route link in this row is a door, and the
 * doors live in the page. The strip is server-rendered as plain `<a href="#…">`
 * links, so it works as a contents list with scripting off; what the script
 * adds is `aria-current` on the section in view, from one
 * `IntersectionObserver` over the sections themselves (never the headings —
 * a heading is a few pixels tall and leaves the active band as soon as the
 * reader starts reading it), released on unmount. No frame is scheduled and
 * no listener is added, so the motion inventory in
 * `tests/motion-runtime.test.ts` gains nothing but the observer it already
 * scans for.
 *
 * The active band is a strip near the top of the viewport. If nothing is in
 * it — a gap between sections — the previous mark stands rather than
 * clearing, because the reader has not left anything.
 */
export function HubJumps({ jumps, label = "On this page" }: { jumps: readonly HubJumpLink[]; label?: string }) {
  const [activeId, setActiveId] = useState<string | null>(null);
  const key = jumps.map((jump) => jump.href).join(" ");

  useEffect(() => {
    const targets = key
      .split(" ")
      .map((href) => document.getElementById(href.slice(1)))
      .filter((element): element is HTMLElement => element !== null);
    if (targets.length < 2) return;

    const visible = new Set<Element>();
    const observer = new IntersectionObserver(
      (entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting) visible.add(entry.target);
          else visible.delete(entry.target);
        }
        const first = targets.find((target) => visible.has(target));
        if (first) setActiveId(first.id);
      },
      { rootMargin: "-20% 0px -70% 0px" },
    );
    for (const target of targets) observer.observe(target);
    return () => observer.disconnect();
  }, [key]);

  return (
    <nav className={styles.jumps} aria-label={label}>
      {jumps.map((jump) => (
        <a
          key={jump.href}
          href={jump.href}
          className={styles.jump}
          aria-current={activeId === jump.href.slice(1) ? "true" : undefined}
        >
          {jump.label}
        </a>
      ))}
    </nav>
  );
}
