'use client';

import { useEffect, useRef } from 'react';
import styles from './geopolitical-brief.module.css';

export function ReadingProgress() {
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
    <span className={styles.progressTrack} aria-hidden="true">
      <span ref={valueRef} className={styles.progressValue} />
    </span>
  );
}
