/**
 * The root wrapper for the Lions of Zion design system.
 *
 * In the application, this system's ground and reading defaults live on
 * `<body>` in `app/globals.css` — `background-color: var(--ground)`,
 * `background-image: var(--scan-ground)`, `color: var(--ink-hi)`,
 * `font-family: var(--face-text)`. Outside the app there is no `<body>` under
 * the design system's control: the preview harness owns it (and paints it
 * white), and a design built with the system owns its own.
 *
 * So the body layer is expressed here as a component. It is a **host wrapper**,
 * the same category as the `next/*` shims in this directory — it introduces no
 * new design decisions and hard-codes no values. Every property below reads a
 * token that `app/globals.css` already defines, so the palette and type cannot
 * drift from the real site: change the token, this changes with it.
 *
 * This system is dark-first. Without this wrapper, components render on
 * whatever ground the host provides — on white, the muted ink tokens fall below
 * usable contrast.
 */
import type { CSSProperties, ReactNode } from 'react';

export interface DesignSurfaceProps {
  children?: ReactNode;
  /** Inner padding. Defaults to a comfortable reading inset. */
  pad?: CSSProperties['padding'];
  /** Constrain to the 68ch reading measure the dossier pages use. */
  measure?: boolean;
  className?: string;
  style?: CSSProperties;
}

export function DesignSurface({
  children,
  pad = 'clamp(1rem, 3vw, 2rem)',
  measure = false,
  className,
  style,
}: DesignSurfaceProps) {
  return (
    <div
      className={className}
      style={{
        backgroundColor: 'var(--ground)',
        backgroundImage: 'var(--scan-ground)',
        color: 'var(--ink-hi)',
        fontFamily: 'var(--face-text)',
        fontSize: 'var(--t-body)',
        lineHeight: 'var(--t-body-lh)',
        fontOpticalSizing: 'auto',
        WebkitFontSmoothing: 'antialiased',
        padding: pad,
        ...(measure ? { maxWidth: 'var(--reading-w, 68ch)', marginInline: 'auto' } : null),
        ...style,
      }}
    >
      {children}
    </div>
  );
}
