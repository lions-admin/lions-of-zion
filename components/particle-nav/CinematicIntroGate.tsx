'use client';

import { useCallback, useState } from 'react';
import { defaultNodes } from './config';
import { NavClient } from './CanvasMount';
import styles from './styles.module.css';

const INTRO_RADIUS = 3.3;

/**
 * Keeps the new editorial home in server HTML while the existing particle
 * story plays as a single, disposable entrance layer. The scene unmounts at
 * handoff; it never remains as a second renderer behind the page.
 */
export function CinematicIntroGate({ children }: { children: React.ReactNode }) {
  const [blocked, setBlocked] = useState(false);
  const handleBlockingChange = useCallback((next: boolean) => setBlocked(next), []);

  return (
    <>
      <NavClient
        nodes={defaultNodes}
        radius={INTRO_RADIUS}
        intro
        introOnly
        onIntroBlockingChange={handleBlockingChange}
      >
        <picture className={styles.poster}>
          <source srcSet="/posters/particle-nav.avif" type="image/avif" />
          <img src="/posters/particle-nav.webp" alt="" draggable={false} />
        </picture>
      </NavClient>
      <noscript>
        <style>{'[data-intro-only] { display: none !important; }'}</style>
      </noscript>
      <div className={styles.introDestination} inert={blocked || undefined} aria-hidden={blocked || undefined}>
        {children}
      </div>
    </>
  );
}
