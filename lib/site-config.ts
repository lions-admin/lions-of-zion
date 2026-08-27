/** The one place the canonical production domain is spelled out. */
export const SITE_URL = "https://lionsofzion.io";

/**
 * The product description, shared by the root metadata (base, openGraph,
 * twitter) and the web manifest — the only four places that inherit it, since
 * every section route exports its own.
 *
 * It describes the desk, not the intro film: "A cinematic awakening from
 * digital darkness" described 39 seconds of animation and contradicted the OG
 * card this same repo renders, which ends on "Verified information.
 * Documented sources."
 *
 * Deliberately not shared with `app/opengraph-image.tsx`: that line is a 24px
 * satori text node in a fixed 1200×630 card with one weight of Geist
 * available, and a sentence this long will not lay out there.
 */
export const SITE_DESCRIPTION =
  "An independent evidence network: verified developments, documented sources, and the record behind them.";
