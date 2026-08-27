'use client';

/**
 * Shared with the Geopolitical Brief (`components/briefs/ReadingProgress.tsx`
 * used to be its own copy of this exact logic). Tracks scroll progress of
 * the nearest `[data-reading-scroll]` ancestor. `trackClassName`/
 * `valueClassName` let a page substitute its own exact visual treatment
 * (the brief keeps its original `.progressTrack`/`.progressValue`, sitting
 * inside its sticky header) while everything else gets the default —
 * a thin fixed line pinned to the top of the viewport.
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
    <span className={trackClassName ?? styles.progressTrack} aria-hidden="true">
      <span ref={valueRef} className={valueClassName ?? styles.progressValue} />
    </span>
  );
}
