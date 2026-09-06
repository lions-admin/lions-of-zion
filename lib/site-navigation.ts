export type SiteSectionId =
  | "geopolitical-brief"
  | "we-are"
  | "war-update"
  | "october-7"
  | "people-of-israel"
  | "fake-resistance"
  | "support-us";

export interface SiteNavigationItem {
  id: SiteSectionId;
  label: string;
  displayName: string;
  href: `/${string}`;
  description: string;
  emblem: `/emblems/${string}.svg`;
  tone: "signal" | "archive" | "ember" | "action";
}

export const SITE_NAVIGATION: readonly SiteNavigationItem[] = [
  {
    id: "geopolitical-brief",
    label: "NEWS & ANALYSIS",
    displayName: "News & Analysis",
    href: "/geopolitical-brief",
    description:
      "News, war updates and deeper analysis — the developments, their context and the sources behind them.",
    emblem: "/emblems/geopolitical-brief.svg",
    tone: "signal",
  },
  {
    id: "we-are",
    label: "WE ARE",
    displayName: "We Are",
    href: "/we-are",
    description:
      "The network behind the desk: how a claim gets checked, who checks it, and the rules that bind them.",
    emblem: "/emblems/we-are.svg",
    tone: "action",
  },
  {
    id: "october-7",
    label: "OCTOBER 7",
    displayName: "October 7",
    href: "/october-7",
    description:
      "Help the record travel. Find testimony and documentation to share with their original context.",
    emblem: "/emblems/october-7.svg",
    tone: "archive",
  },
  {
    id: "people-of-israel",
    label: "THE PEOPLE OF ISRAEL",
    displayName: "The People of Israel",
    href: "/people-of-israel",
    description:
      "People, courage, invention and history — with cited records that remain available at their original addresses.",
    emblem: "/emblems/our-heroes.svg",
    tone: "archive",
  },
  {
    id: "fake-resistance",
    label: "FAKE RESISTANCE",
    displayName: "Fake Resistance",
    href: "/fake-resistance",
    description:
      "False narratives, incitement and the daily X review — follow the claims, their sources and the findings.",
    emblem: "/emblems/fake-resistance.svg",
    tone: "ember",
  },
  {
    id: "support-us",
    label: "SUPPORT US",
    displayName: "Support Us",
    href: "/support-us",
    description: "Report a claim for checking or offer the desk a skill it needs.",
    emblem: "/emblems/support-us.svg",
    tone: "action",
  },
] as const;

export function getSiteNavigationItem(id: string) {
  return SITE_NAVIGATION.find((item) => item.id === id);
}

/**
 * Pages that keep their address and their own reading shell after their
 * navigation entry folded into a parent destination (2026-09-06: Our Heroes
 * and Israel's Story became collections inside The People of Israel).
 *
 * Deliberately a separate list rather than hidden `SITE_NAVIGATION` entries:
 * every consumer of that array — the header and footer chrome, the sitemap's
 * eight destinations, the search vocabulary, the home fallback list — treats
 * it as "the destinations", and a flag each of them would have to remember to
 * filter is how one of them forgets. Here they are reachable only by the
 * things that need them: the section shell, the sitemap's own legacy block,
 * and the chrome's "you are here" resolution through `parent`.
 */
export interface LegacySectionPage {
  id: string;
  parent: SiteSectionId;
  href: `/${string}`;
  description: string;
}

export const LEGACY_SECTION_PAGES: readonly LegacySectionPage[] = [
  {
    id: "our-heroes",
    parent: "people-of-israel",
    href: "/our-heroes",
    description:
      "Citations for the fallen, the fighters, and the rescuers, built from named reporting.",
  },
  {
    id: "israels-story",
    parent: "people-of-israel",
    href: "/israels-story",
    description:
      "The founding, wars, and treaties that followed, set in sourced chapters from 1947 onward.",
  },
] as const;

/** What `SectionPage` needs from a route id: a destination, or a page that
 *  outlived its destination and kept its own description. */
export function getSectionPageNode(id: string): { description: string } | undefined {
  return getSiteNavigationItem(id) ?? LEGACY_SECTION_PAGES.find((page) => page.id === id);
}

export function resolveSiteSectionId(routeId: string): SiteSectionId | undefined {
  if (routeId === "information-war") return "geopolitical-brief";
  if (routeId.startsWith("october-7")) return "october-7";
  if (routeId.startsWith("fake-resistance")) return "fake-resistance";
  const legacy = LEGACY_SECTION_PAGES.find((page) => page.id === routeId);
  if (legacy) return legacy.parent;
  return getSiteNavigationItem(routeId)?.id;
}
