/**
 * The icon family, as path data.
 *
 * One 24-unit grid, one stroke weight, one corner treatment, one circular
 * proportion — stated as constants so an icon cannot quietly break the family.
 * An icon that needs different proportions is redrawn, not excepted.
 *
 * The same path data serves both representations: stroked line geometry when
 * the icon is at rest, and points sampled along the path when it reconstructs
 * from the particle field. Two sources of truth for one icon is how the two
 * drift apart.
 *
 * Curves only — no elliptical arc commands — because the sampler supports the
 * cubic and quadratic forms and nothing is gained by needing more.
 */

/** The grid every path is authored on. */
export const ICON_GRID = 24;

/** Circle approximation constant: four cubics, control arm = k · radius. */
const K = 0.5523;

function circle(cx: number, cy: number, r: number): string {
  const a = K * r;
  return (
    `M ${cx} ${cy - r} ` +
    `C ${cx + a} ${cy - r} ${cx + r} ${cy - a} ${cx + r} ${cy} ` +
    `C ${cx + r} ${cy + a} ${cx + a} ${cy + r} ${cx} ${cy + r} ` +
    `C ${cx - a} ${cy + r} ${cx - r} ${cy + a} ${cx - r} ${cy} ` +
    `C ${cx - r} ${cy - a} ${cx - a} ${cy - r} ${cx} ${cy - r} Z`
  );
}

export const ICON_PATHS = {
  /** Today — a clock. */
  clock: [circle(12, 12, 8.5), "M 12 6.6 L 12 12 L 15.8 14.2"],

  /** Verify — a shield with a check. */
  shield: [
    "M 12 3 L 20 6.2 L 20 12 C 20 16.9 16.6 20.1 12 21.2 " +
      "C 7.4 20.1 4 16.9 4 12 L 4 6.2 Z",
    "M 8.4 12.2 L 11 14.9 L 15.6 9.6",
  ],

  /** The War — a globe. */
  globe: [
    circle(12, 12, 8.5),
    "M 3.5 12 L 20.5 12",
    "M 12 3.5 C 15.2 6.6 15.2 17.4 12 20.5 C 8.8 17.4 8.8 6.6 12 3.5 Z",
  ],

  /** October 7 — a calendar. */
  calendar: [
    "M 4 6.2 L 20 6.2 L 20 20.4 L 4 20.4 Z",
    "M 4 10.4 L 20 10.4",
    "M 8.2 3.6 L 8.2 8",
    "M 15.8 3.6 L 15.8 8",
  ],

  /** Stories — a heart. */
  heart: [
    "M 12 20.4 C 6 15.9 3.6 13 3.6 10 C 3.6 7.3 5.6 5.3 8.1 5.3 " +
      "C 9.9 5.3 11.4 6.3 12 7.7 C 12.6 6.3 14.1 5.3 15.9 5.3 " +
      "C 18.4 5.3 20.4 7.3 20.4 10 C 20.4 13 18 15.9 12 20.4 Z",
  ],

  /** Israel Explained — an open book. */
  book: [
    "M 12 6.6 C 9.8 5.1 6.9 4.6 4 5.1 L 4 18.6 C 6.9 18.1 9.8 18.6 12 20.1 " +
      "C 14.2 18.6 17.1 18.1 20 18.6 L 20 5.1 C 17.1 4.6 14.2 5.1 12 6.6 Z",
    "M 12 6.6 L 12 20.1",
  ],

  /** Influence — a network. */
  network: [
    circle(12, 12, 2.6),
    circle(5.2, 6.4, 2.1),
    circle(18.8, 6.4, 2.1),
    circle(12, 20, 2.1),
    "M 10.4 9.9 L 6.6 8",
    "M 13.6 9.9 L 17.4 8",
    "M 12 14.6 L 12 17.9",
  ],

  /** About — a person. */
  person: [
    circle(12, 8.2, 3.6),
    "M 4.8 20.6 C 4.8 16.6 8 14.2 12 14.2 C 16 14.2 19.2 16.6 19.2 20.6",
  ],

  /** Reserved for later use; drawn now so the family is decided in one pass. */
  search: [circle(10.4, 10.4, 6.2), "M 15 15 L 20.6 20.6"],

  report: [
    "M 6 3.6 L 14 3.6 L 18.4 8 L 18.4 20.4 L 6 20.4 Z",
    "M 14 3.6 L 14 8 L 18.4 8",
    "M 9 12.4 L 15.4 12.4",
    "M 9 16.2 L 15.4 16.2",
  ],

  claims: [
    "M 4 5.2 L 20 5.2 L 20 16 L 12.8 16 L 8.8 20.2 L 8.8 16 L 4 16 Z",
    "M 8 10.6 L 16 10.6",
  ],
} as const;

export type IconName = keyof typeof ICON_PATHS;
