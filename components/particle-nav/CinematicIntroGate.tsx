'use client';

import { createContext, useCallback, useContext, useState } from 'react';
import { MediaBlock } from '@/components/content/MediaBlock';
import { defaultNodes } from './config';
import { NavClient } from './CanvasMount';
import styles from './styles.module.css';

const INTRO_RADIUS = 3.3;

const IntroHandoffContext = createContext(true);

export function useIntroHandoffReady() {
  return useContext(IntroHandoffContext);
}

/**
 * Keeps the new editorial home in server HTML while the existing particle
 * story plays as a single, disposable entrance layer. The scene unmounts at
 * handoff; it never remains as a second renderer behind the page.
 */
export function CinematicIntroGate({ children }: { children: React.ReactNode }) {
  // Start blocked so the destination's WebGL engine cannot mount for a frame
  // underneath the particle intro before NavClient reports its real state.
  const [blocked, setBlocked] = useState(true);
  const handleBlockingChange = useCallback((next: boolean) => setBlocked(next), []);

  return (
    <>
      <NavClient
        nodes={defaultNodes}
        radius={INTRO_RADIUS}
        intro
        introOnly
        onIntroBlockingChange={handleBlockingChange}
        introOverlay={
          <div className={styles.introChrome}>
            <div className={styles.introMasthead}>
              <span>Lions of Zion</span>
              <span>Evidence desk</span>
            </div>
            <div className={styles.introFootnote}>
              <span>Signal intake</span>
              <span>01 / 01</span>
            </div>
          </div>
        }
      >
        <MediaBlock className={styles.poster} aspectRatio="1 / 1">
          <picture>
            <source srcSet="/posters/particle-nav.avif" type="image/avif" />
            <img src="/posters/particle-nav.webp" alt="" draggable={false} />
          </picture>
        </MediaBlock>
      </NavClient>
      <noscript>
        <style>{'[data-intro-only] { display: none !important; }'}</style>
      </noscript>
      <IntroHandoffContext.Provider value={!blocked}>
        <div className={styles.introDestination} inert={blocked || undefined} aria-hidden={blocked || undefined}>
          {children}
        </div>
      </IntroHandoffContext.Provider>
    </>
  );
}
