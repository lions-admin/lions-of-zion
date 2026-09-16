/**
 * The share card's palette — the Midnight Signal tokens, as literals.
 *
 * `app/articles/[publicId]/opengraph-image.tsx` renders through satori, which
 * has no stylesheet, no custom properties and no `var()`: every colour it
 * paints has to be a literal. Until 2026-09-16 the card carried its own set —
 * a charcoal gradient, `#d2a94f` brass, `#f4efe5` ivory — which was the
 * identity before last, so a shared link previewed as a different product from
 * the page it opened.
 *
 * THESE VALUES MIRROR `:root` IN `app/globals.css` AND MUST MOVE WITH IT.
 * Each entry names the token it copies; when the token changes, change the
 * literal here in the same commit. `tests/article-share-card.test.tsx` renders
 * the card, so a broken literal fails there rather than on a crawler.
 */
export const OG_PALETTE = {
  /** `--ground` — the one ground, cover to footer. Flat: no gradient. */
  ground: "#0b1220",
  /** `--abyss` — the cover vignette; the card's picture scrim is built from it. */
  abyss: "#070b14",
  /** `--surface-1` — a flat plate one step above the ground. */
  surface: "#15213a",
  /** `--ink-hi` — headlines. */
  inkHi: "#f3efe6",
  /** `--ink` — running text. */
  ink: "#cbcfd8",
  /** `--ink-lo` — metadata. */
  inkLo: "#9ba5b8",
  /** `--gold` — the one accent: the signal rule and the section kicker. */
  gold: "#d8b45f",
  /** `--gold-dim` — small gold text. */
  goldDim: "#c6a24f",
  /** `--line-strong` — the hairline, at the alpha the token carries. */
  line: "rgba(243, 239, 230, 0.24)",
} as const;

export type OgPalette = typeof OG_PALETTE;
