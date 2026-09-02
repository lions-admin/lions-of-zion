/**
 * Present for one reason: Tailwind v4 is a PostCSS plugin, and `app/tailwind.css`
 * needs it to resolve `@import "tailwindcss/…"` and `@theme`.
 *
 * Consequence worth knowing before editing: this file changes the CSS pipeline for
 * EVERY stylesheet Next compiles, not just the Tailwind entry — including all 40
 * `*.module.css` (13,927 lines). Tailwind's docs are explicit that each CSS module
 * is processed separately, so the plugin runs 40 extra times per build. It
 * short-circuits on files carrying no Tailwind at-rules, and none of the modules
 * has one, so the cost is scan-only — but a CSS regression in a module now has a
 * new place to have come from. Deleting this file plus the `./tailwind.css` import
 * in `app/layout.tsx` reverts the entire Tailwind integration.
 */
const config = {
  plugins: {
    "@tailwindcss/postcss": {},
  },
};

export default config;
