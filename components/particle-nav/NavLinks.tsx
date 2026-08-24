/**
 * The real navigation (brief §9): a server-rendered <nav> of <a href> links
 * that works with JavaScript disabled entirely. The inline --x/--y custom
 * properties give a pure-CSS radial layout matching the idle composition;
 * once the canvas is live, per-frame projection overrides left/top in px on
 * the same elements — one set of links, always.
 */
import type { NavNode } from './types';
import styles from './styles.module.css';

export interface NavLinksProps {
  nodes: NavNode[];
  radius: number;
}

export function NavLinks({ nodes }: NavLinksProps) {
  // The no-JS fallback mirrors the responsive live ellipse with percentages
  // that keep the 44 px minimum target inside even at 320 px wide.
  const orbitX = 36;
  const orbitY = 40;
  return (
    <nav aria-label="Primary" className={styles.nav}>
      <ul className={styles.list}>
        {nodes.map((node, i) => {
          const a = Math.PI / 2 - (i / nodes.length) * Math.PI * 2;
          const cx = 50 + Math.cos(a) * orbitX;
          const cy = 50 - Math.sin(a) * orbitY;
          return (
            <li
              key={node.id}
              className={styles.item}
              style={{ ['--x' as string]: `${cx.toFixed(2)}%`, ['--y' as string]: `${cy.toFixed(2)}%` }}
            >
              <a href={node.href} data-node-index={i} className={styles.link}>
                <span className={styles.label}>{node.label}</span>
              </a>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
