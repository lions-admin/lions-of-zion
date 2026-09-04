'use client';

import { useCallback, useState, useSyncExternalStore } from 'react';
import { MediaBlock } from '@/components/content/MediaBlock';
import { NavClient } from './CanvasMount';
import styles from './styles.module.css';

const INTRO_RADIUS = 3.3;

/* Same shape as `CanvasMount`'s: the server snapshot is false, and the first
   commit after hydration flips it. */
const subscribeToHydration = () => () => {};

function useHydrated() {
  return useSyncExternalStore(subscribeToHydration, () => true, () => false);
}

/**
 * Keeps the new editorial home in server HTML while the existing particle
 * story plays as a single, disposable entrance layer. The scene unmounts at
 * handoff; it never remains as a second renderer behind the page.
 */
export function CinematicIntroGate({
  children,
  background,
}: {
  children: React.ReactNode;
  /** The entrance's background layer — see `NavClient`'s `introBackground`. */
  background?: React.ReactNode;
}) {
  // Start blocked so the destination's WebGL engine cannot mount for a frame
  // underneath the particle intro before NavClient reports its real state.
  const [blocked, setBlocked] = useState(true);
  const handleBlockingChange = useCallback((next: boolean) => setBlocked(next), []);

  /**
   * `blocked` is the React truth and starts true, so nothing underneath ever
   * observes an unblocked frame. What it may NOT do is reach the server HTML.
   *
   * `inert` is an HTML attribute with no CSS counterpart: no stylesheet, and
   * therefore no `<noscript>` block, can lift it. Rendered into the server
   * document it stays there for anyone whose JavaScript never runs — and the
   * measured result was the entire home page, `<h1>` and every link included,
   * shipped `inert` and `aria-hidden="true"` with nothing that would ever
   * clear it. The no-JS reader got a page they could not click and a screen
   * reader announced nothing at all, which is the exact opposite of the
   * fallback the noscript rule one element up is trying to build.
   *
   * So the attributes are gated on hydration instead. With scripting off they
   * are simply absent, `[data-intro-only]` is hidden by the rule below, and
   * what remains is the server-rendered home. With scripting on they arrive in
   * the first commit after hydration — which is also the first commit in which
   * any client engine down there can have mounted, so nothing is unguarded
   * that was guarded before.
   */
  const hydrated = useHydrated();
  const inertDestination = hydrated && blocked;

  return (
    <>
      <NavClient
        radius={INTRO_RADIUS}
        intro
        introOnly
        onIntroBlockingChange={handleBlockingChange}
        introBackground={background}
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
      <div
        className={styles.introDestination}
        inert={inertDestination || undefined}
        aria-hidden={inertDestination || undefined}
      >
        {children}
      </div>
    </>
  );
}
