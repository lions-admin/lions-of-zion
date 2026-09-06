/**
 * Where a publication appears, decided in exactly one place.
 *
 * `publication.section` is the source of truth and the only editorial choice
 * a composer makes. Every UI destination — the hub it belongs to, the
 * homepage band it competes in, the breadcrumb above the article, the reading
 * label on a card — is derived from that value here, deterministically.
 *
 * The alternative, which this file exists to prevent, is a second field the
 * model picks (`homepageCategory`, `destination`, `frontendSection`) plus a
 * scattering of `section === "narrative_watch" ? … : …` ternaries. Those two
 * together are how a record ends up filed as news on the homepage and as a
 * claim assessment on its own page.
 *
 * Deliberately dependency-free beyond the section enum: `lib/**` may import
 * `@/server/contracts/*` and `server/**` may import `lib/**` (the same seam
 * `lib/site-config.ts` sits on), so the backend selector and the frontend
 * renderer resolve a destination through this one map.
 */

import type { PublicationSection } from "@/server/contracts/enums";

/** The homepage bands a live publication may compete in. */
export type PublicationHomepageSection = "news" | "fakeResistance";

/** The `HomeReference` kind a live publication resolves as. */
export type PublicationHomepageKind = "news" | "watch";

export type PublicationDestination = {
  /** The hub that owns this section's records, in the site's own words. */
  hub: string;
  /** That hub's route — the breadcrumb parent and the "see all" target. */
  href: string;
  /** The homepage band. */
  homepageSection: PublicationHomepageSection;
  /** The homepage reference kind, which decides how the card is drawn. */
  homepageKind: PublicationHomepageKind;
  /** The reading label for one record of this section. */
  label: string;
};

/**
 * The whole mapping. Exhaustive by construction: a fourth section fails the
 * typecheck here rather than silently defaulting to news.
 */
const DESTINATIONS: Record<PublicationSection, PublicationDestination> = {
  daily_brief: {
    hub: "News & Analysis",
    href: "/geopolitical-brief",
    homepageSection: "news",
    homepageKind: "news",
    label: "Daily Brief",
  },
  israel_update: {
    hub: "News & Analysis",
    href: "/geopolitical-brief",
    homepageSection: "news",
    homepageKind: "news",
    label: "Israel update",
  },
  narrative_watch: {
    hub: "Fake Resistance",
    href: "/fake-resistance",
    homepageSection: "fakeResistance",
    homepageKind: "watch",
    label: "Narrative Watch",
  },
};

/** The one call every surface makes. */
export function routePublication(section: PublicationSection): PublicationDestination {
  return DESTINATIONS[section];
}

/** The reading label for a section — "Daily Brief", "Narrative Watch". */
export function publicationSectionLabel(section: PublicationSection): string {
  return DESTINATIONS[section].label;
}

/** The breadcrumb parent above `/articles/[publicId]`, by section. */
export function publicationParentCrumb(section: PublicationSection): { href: string; label: string } {
  const destination = DESTINATIONS[section];
  return { href: destination.href, label: destination.hub };
}

/** The homepage band a live publication competes in. */
export function publicationHomepageSection(section: PublicationSection): PublicationHomepageSection {
  return DESTINATIONS[section].homepageSection;
}

/** The homepage reference kind a live publication resolves as. */
export function publicationHomepageKind(section: PublicationSection): PublicationHomepageKind {
  return DESTINATIONS[section].homepageKind;
}

/**
 * A hub's own breadcrumb, addressable without a publication in hand.
 *
 * `/updates` and `/fact-check` are indexes over the desk rather than records
 * in it, so they have a parent hub but no `section` to derive it from. Both
 * hardcoded `"The Daily Brief"` against `/geopolitical-brief` — a name the
 * hub stopped using, still pointing at the right route, which is the exact
 * drift this module exists to end.
 */
export function publicationHubCrumb(section: PublicationHomepageSection): { href: string; label: string } {
  const destination = section === "news" ? DESTINATIONS.daily_brief : DESTINATIONS.narrative_watch;
  return { href: destination.href, label: destination.hub };
}

/** Canonical article path. One place, so a route rename is one edit. */
export function publicationHref(publicId: string): string {
  return `/articles/${publicId}`;
}

/** Every section that files into one homepage band — the selector's filter. */
export const SECTIONS_BY_HOMEPAGE_SECTION: Record<PublicationHomepageSection, PublicationSection[]> = {
  news: (Object.keys(DESTINATIONS) as PublicationSection[]).filter(
    (section) => DESTINATIONS[section].homepageSection === "news",
  ),
  fakeResistance: (Object.keys(DESTINATIONS) as PublicationSection[]).filter(
    (section) => DESTINATIONS[section].homepageSection === "fakeResistance",
  ),
};

/** The reading label for every section, keyed — the shape components want. */
export const PUBLICATION_SECTION_LABELS: Record<PublicationSection, string> = Object.freeze(
  Object.fromEntries(
    (Object.keys(DESTINATIONS) as PublicationSection[]).map((section) => [section, DESTINATIONS[section].label]),
  ) as Record<PublicationSection, string>,
);
