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
export type PublicationHomepageSection = "news" | "fakeResistance" | "people";

/** The `HomeReference` kind a live publication resolves as. */
export type PublicationHomepageKind = "news" | "watch" | "feature";

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
  /**
   * Whether a record of this section is the product of an investigation, and
   * may therefore be staged as one.
   *
   * The seven-stage evidence explorer asserts that a claim was traced to an
   * origin, that its spread was observed and that its limits were recorded.
   * That is true of the Fake Resistance desk and of nothing else: a Ministry
   * of Defense announcement given the same apparatus reads as an
   * investigation whose every stage came back empty — "does not name observed
   * propagators" — which claims work that was never done. Derived here, with
   * the rest of the surfaces, so no page hand-writes a section list.
   */
  investigation: boolean;
};

/**
 * The whole mapping. Exhaustive by construction: a fourth section fails the
 * typecheck here rather than silently defaulting to news.
 */
const news = (label: string): PublicationDestination => ({
  hub: "News & Analysis", href: "/geopolitical-brief", homepageSection: "news", homepageKind: "news", label, investigation: false,
});
const investigation = (label: string): PublicationDestination => ({
  hub: "Fake Resistance", href: "/fake-resistance", homepageSection: "fakeResistance", homepageKind: "watch", label, investigation: true,
});
const people = (label: string): PublicationDestination => ({
  hub: "The People of Israel", href: "/people-of-israel", homepageSection: "people", homepageKind: "feature", label, investigation: false,
});
const DESTINATIONS: Record<PublicationSection, PublicationDestination> = {
  daily_brief: news("Daily Brief"),
  israel_update: news("Israel update"),
  news: news("News & Analysis"),
  narrative_watch: investigation("Narrative Watch"),
  influence_investigation: investigation("Influence investigation"),
  antisemitism: investigation("Antisemitism"),
  innovation: people("Innovation"),
  science_medicine: people("Science & Medicine"),
  technology_ai: people("Technology & AI"),
  achievement: people("Israeli achievement"),
  international_cooperation: people("International cooperation"),
  people: people("People"),
  courage_service: people("Courage & Service"),
  history_context: people("History & Context"),
};

/** The one call every surface makes. */
export function routePublication(section: PublicationSection, options?: { historyContext?: "news" | "fakeResistance" }): PublicationDestination {
  if (section === "history_context" && options?.historyContext) {
    /* A history-and-context record can be *shelved* on the Fake Resistance
       desk, but shelving it there does not make it an investigation, so the
       investigative staging stays off in both directions. */
    return options.historyContext === "news"
      ? news("History & Context")
      : { ...investigation("History & Context"), investigation: false };
  }
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
  const destination = section === "news" ? DESTINATIONS.daily_brief : section === "people" ? DESTINATIONS.people : DESTINATIONS.narrative_watch;
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
  people: (Object.keys(DESTINATIONS) as PublicationSection[]).filter(
    (section) => DESTINATIONS[section].homepageSection === "people",
  ),
  fakeResistance: (Object.keys(DESTINATIONS) as PublicationSection[]).filter(
    (section) => DESTINATIONS[section].homepageSection === "fakeResistance",
  ),
};

/**
 * Whether a record of this section may be staged as an investigation — the
 * seven-stage evidence explorer, and anything else that asserts investigative
 * work rather than reporting.
 *
 * Takes a `string` on purpose: it is called with whatever the projection
 * carries, and a section this map has never heard of falls to `false`. Being
 * shown as an ordinary record costs a genuine investigation one module; being
 * staged as an investigation costs an announcement its credibility.
 */
export function publicationSupportsInvestigationExplorer(section: string | null | undefined): boolean {
  if (!section) return false;
  return (DESTINATIONS as Record<string, PublicationDestination | undefined>)[section]?.investigation === true;
}

/** Every section the explorer is permitted for — derived, never hand-written. */
export const INVESTIGATION_EXPLORER_SECTIONS: PublicationSection[] = (
  Object.keys(DESTINATIONS) as PublicationSection[]
).filter((section) => DESTINATIONS[section].investigation);

/** The reading label for every section, keyed — the shape components want. */
export const PUBLICATION_SECTION_LABELS: Record<PublicationSection, string> = Object.freeze(
  Object.fromEntries(
    (Object.keys(DESTINATIONS) as PublicationSection[]).map((section) => [section, DESTINATIONS[section].label]),
  ) as Record<PublicationSection, string>,
);
