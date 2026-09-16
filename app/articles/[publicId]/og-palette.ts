/**
 * The Midnight Signal share-card palette, derived from the token values in
 * `app/globals.css` (2026-09-16).
 *
 * Satori cannot read a stylesheet, so the values are carried beside the route
 * and kept byte-identical to the tokens they name — each line below says
 * which token it is. A token change that matters to the card is a one-line
 * change here, in the same commit, and the card cannot drift from the site
 * the way it did when the palette lived inline in the render function.
 */
export const OG_PALETTE = {
  /** --ground */
  ground: "#0B1220",
  /** --abyss, the cover vignette only */
  abyss: "#070B14",
  /** --ink-hi */
  inkHi: "#F3EFE6",
  /** --ink */
  ink: "#CBCFD8",
  /** --ink-lo */
  inkLo: "#9BA5B8",
  /** --gold */
  gold: "#D8B45F",
  /** --gold-dim */
  goldDim: "#C6A24F",
  /** --gold-wash */
  goldWash: "rgba(216, 180, 95, 0.08)",
  /** --line */
  line: "rgba(243, 239, 230, 0.14)",
  /** --surface-1, the plate a card's chip sits on */
  surface1: "#15213A",
} as const;
