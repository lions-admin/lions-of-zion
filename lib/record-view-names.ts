/**
 * The shared-element view-transition names of a record, and the one
 * transition type its links carry.
 *
 * A record's headline, section kicker and media plate carry names derived
 * from its `publicId` on every list surface AND on the record page
 * (`app/articles/[publicId]`), so the browser can morph one into the other
 * during a list → record navigation (`components/motion/view-transition.tsx`
 * wraps the elements; `app/globals.css` styles the transition). Names are
 * derived from the destination address rather than handed down through props,
 * so a hub row, a homepage card, a search hit and the record's own page
 * cannot disagree about which elements pair.
 *
 * Only destinations under `/articles/` pair: a hero profile or an archive
 * chapter has no record page, and a named element whose partner never exists
 * would fade out alone at the root crossfade instead of staying quiet.
 */

export type RecordViewNames = {
  headline: string;
  kicker: string;
  plate: string;
};

/** The type a link into a record declares, so the transition CSS can tell a
 *  list → record navigation (shared elements morph, the page fades and rises)
 *  from every other navigation (the root crossfade, 200ms). */
export const RECORD_TRANSITION_TYPE = "to-record";

export function recordViewNames(publicId: string): RecordViewNames {
  return {
    headline: `record-${publicId}-headline`,
    kicker: `record-${publicId}-kicker`,
    plate: `record-${publicId}-plate`,
  };
}

/** The record a destination page belongs to, from the link that opens it —
 *  `null` for every destination that is not a publication record. */
export function recordViewNamesFromHref(
  href: string | null | undefined,
): RecordViewNames | null {
  if (!href?.startsWith("/articles/")) return null;
  const publicId = decodeURIComponent(
    href.slice("/articles/".length).split(/[?#]/)[0] ?? "",
  ).trim();
  return publicId ? recordViewNames(publicId) : null;
}
