"use client";

import cmd from "../command.module.css";

/**
 * Admin-only operational backdrop.
 *
 * Decorative layers only: an `aria-hidden` container with a radial light
 * field, a faint operational grid, and one slow scan sweep. It lives inside
 * the console shell (CSS-Module scope), so no rule can reach the public
 * site. Motion is CSS-only and disabled under `prefers-reduced-motion`;
 * there is no canvas, no backdrop-filter, and no JavaScript animation.
 */
export function CommandBackground() {
  return <div className={cmd.field} aria-hidden="true" />;
}
