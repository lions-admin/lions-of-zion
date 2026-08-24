/**
 * Deliverable #1 — the typed, self-contained navigation component.
 * Server component: the <nav>, links, and poster render in the initial HTML;
 * the canvas is client-only, dynamic-imported, and mounted after first paint.
 */
import { NavClient } from './CanvasMount';
import { NavLinks } from './NavLinks';
import type { ParticleNavProps } from './types';
import styles from './styles.module.css';

const DEFAULT_RADIUS = 3.3;

export function ParticleNav(props: ParticleNavProps) {
  const { nodes, radius = DEFAULT_RADIUS } = props;
  if (nodes.length < 6 || nodes.length > 10) {
    throw new Error(`ParticleNav requires 6–10 nodes, got ${nodes.length} (brief §1)`);
  }

  return (
    <NavClient
      nodes={nodes}
      radius={radius}
      active={props.active}
      theme={props.theme}
      forceWebGL={props.forceWebGL}
      simOverrides={props.simOverrides}
      onFrameStats={props.onFrameStats}
      intro={props.intro}
    >
      {/* No-WebGL2 tier: static AVIF poster behind the live DOM nav (brief §8). */}
      <picture className={styles.poster}>
        <source srcSet="/posters/particle-nav.avif" type="image/avif" />
        <img src="/posters/particle-nav.webp" alt="" draggable={false} />
      </picture>
      <NavLinks nodes={nodes} radius={radius} />
    </NavClient>
  );
}
