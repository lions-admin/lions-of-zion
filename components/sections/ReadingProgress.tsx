'use client';

/**
 * Tracks scroll progress of the nearest `[data-reading-scroll]` ancestor.
 *
 * The bar itself is this module's, always. There were four copies of it —
 * here, `sections.module.css` `.topProgress*`, the article route's, and
 * `information-war-system.module.css` — because `trackClassName` and
 * `valueClassName` used to *replace* the treatment rather than add to it, so
 * every caller restated the whole 2px line. They had drifted: the article's
 * carried a gradient and a `box-shadow` glow against this file's own stated
 * rule that a progress bar is a measurement and not an emphasis, and two of
 * the four had lost the transition and the reduced-motion result with it.
 *
 * The classes now compose, so a caller passes only its delta: the two
 * variables this bar reads (`--accent` for its fill, `--progress-top` for
 * where it hangs) and whatever the page needs to do to it at a breakpoint.
 */
import { useEffect, useRef } from 'react';
import styles from './reading-progress.module.css';

export interface ReadingProgressProps {
  trackClassName?: string;
  valueClassName?: string;
}

export function ReadingProgress({ trackClassName, valueClassName }: ReadingProgressProps) {
  const valueRef = useRef<HTMLSpanElement>(null);

  useEffect(() => {
    /* The reading routes scroll the document as of 2026-08-27, so progress is
       read from `documentElement` and the events come from `window`. The
       `[data-reading-scroll]` marker still exists — `SectionToc` uses it to
       find the body — but it no longer names a scrollport, and reading
       `scrollTop` from it would return a flat 0 for the whole page.

       Guarded rather than assumed: if a route ever declares its own scroller
       again, that element is used and this keeps working. */
    const marked = document.querySelector<HTMLElement>('[data-reading-scroll]');
    const isScroller =
      marked !== null &&
      ['auto', 'scroll'].includes(getComputedStyle(marked).overflowY) &&
      marked.scrollHeight > marked.clientHeight;

    const doc = document.documentElement;
    const target: HTMLElement = isScroller ? marked : doc;
    const source: HTMLElement | Window = isScroller ? marked : window;
    let frame = 0;

    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const distance = target.scrollHeight - target.clientHeight;
        const progress = distance <= 0
          ? 1
          : Math.min(1, Math.max(0, target.scrollTop / distance));
        if (valueRef.current) valueRef.current.style.transform = `scaleX(${progress})`;
      });
    };

    update();
    source.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      source.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <span
      className={[styles.progressTrack, trackClassName].filter(Boolean).join(" ")}
      aria-hidden="true"
    >
      <span
        ref={valueRef}
        className={[styles.progressValue, valueClassName].filter(Boolean).join(" ")}
      />
    </span>
  );
}
