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
    const scroller = document.querySelector<HTMLElement>('[data-reading-scroll]');
    if (!scroller) return;
    let frame = 0;

    const update = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const distance = scroller.scrollHeight - scroller.clientHeight;
        const progress = distance <= 0
          ? 1
          : Math.min(1, Math.max(0, scroller.scrollTop / distance));
        if (valueRef.current) valueRef.current.style.transform = `scaleX(${progress})`;
      });
    };

    update();
    scroller.addEventListener('scroll', update, { passive: true });
    window.addEventListener('resize', update);
    return () => {
      if (frame) cancelAnimationFrame(frame);
      scroller.removeEventListener('scroll', update);
      window.removeEventListener('resize', update);
    };
  }, []);

  return (
    <span className={trackClassName ?? styles.progressTrack} aria-hidden="true">
      <span ref={valueRef} className={valueClassName ?? styles.progressValue} />
    </span>
  );
}
