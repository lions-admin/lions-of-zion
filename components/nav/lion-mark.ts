/**
 * The central mark: a lion recognisable in as few lines as possible.
 *
 * A vector path, not a raster and not a mesh, for the same reason the icons
 * are: it has to serve both as stroked line geometry at rest and as a set of
 * points the particle field converges into, and both have to come from the
 * same source or they drift.
 *
 * Authored on a 48-unit grid — twice the icon grid, because the mark carries
 * more structure and half-unit coordinates in an icon would invite the family
 * to lose its shared proportions.
 */

export const MARK_GRID = 48;

export const LION_MARK_PATHS = [
  /* The mane: a heptagon, softened. Reads as a mane at a glance and as
     geometry on inspection, which is the register the mark wants. */
  "M 24 3.4 L 36.6 8.6 L 43 20.4 L 38.4 34.6 L 24 44.6 L 9.6 34.6 " +
    "L 5 20.4 L 11.4 8.6 Z",

  /* Ears, cut into the mane's shoulders. */
  "M 11.4 8.6 L 14.6 2.6 L 20.2 5.8",
  "M 36.6 8.6 L 33.4 2.6 L 27.8 5.8",

  /* The face. */
  "M 24 11.6 C 31.2 11.6 35.4 16.8 35.4 23 C 35.4 31 30.2 36.2 24 38.4 " +
    "C 17.8 36.2 12.6 31 12.6 23 C 12.6 16.8 16.8 11.6 24 11.6 Z",

  /* Eyes: two strokes. Any more and the mark starts having an expression. */
  "M 18.2 21.8 L 21.8 21.8",
  "M 26.2 21.8 L 29.8 21.8",

  /* Muzzle. */
  "M 24 26.8 L 21.4 29.8 L 24 32 L 26.6 29.8 Z",
  "M 24 32 L 24 34.2",
  "M 24 34.2 C 21.4 34.2 19.8 33.2 18.8 31.6",
  "M 24 34.2 C 26.6 34.2 28.2 33.2 29.2 31.6",
] as const;
