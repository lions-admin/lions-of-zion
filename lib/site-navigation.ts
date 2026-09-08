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

/**
 * The descriptions are the decided words of
 * `docs/audits/2026-09-08-copy-table.md` (UX-02): second person, one verb the
 * reader performs, one thing they get. Until 2026-09-08 News promised "war
 * updates" three days after the section was removed, and Fake Resistance a
 * "daily X review" that no route, section or component was ever called.
 */
export const SITE_NAVIGATION: readonly SiteNavigationItem[] = [
  {
    id: "geopolitical-brief",
    label: "NEWS & ANALYSIS",
    displayName: "News & Analysis",
    href: "/geopolitical-brief",
    description:
      "What happened, with the sources behind every line.",
    emblem: "/emblems/geopolitical-brief.svg",
    tone: "signal",
  },
  {
    id: "we-are",
    label: "WE ARE",
    displayName: "We Are",
    href: "/we-are",
    description:
      "Who checks what, and the rules that bind them.",
    emblem: "/emblems/we-are.svg",
    tone: "action",
  },
  {
    id: "october-7",
    label: "OCTOBER 7",
    displayName: "October 7",
    href: "/october-7",
    description:
      "Testimony and documentation, with their original context, ready to share.",
    emblem: "/emblems/october-7.svg",
    tone: "archive",
  },
  {
    id: "people-of-israel",
    label: "THE PEOPLE OF ISRAEL",
    displayName: "The People of Israel",
    href: "/people-of-israel",
    description:
      "Courage, invention and history — the people the narrative leaves out, with sources.",
    emblem: "/emblems/our-heroes.svg",
    tone: "archive",
  },
  {
    id: "fake-resistance",
    label: "FAKE RESISTANCE",
    displayName: "Fake Resistance",
    href: "/fake-resistance",
    description:
      "The claims in circulation, what they were built from, and the sourced version to carry back.",
    emblem: "/emblems/fake-resistance.svg",
    tone: "ember",
  },
  {
    id: "support-us",
    label: "SUPPORT US",
    displayName: "Support Us",
    href: "/support-us",
    description: "Report a claim, lend a skill, or fund the work.",
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

/**
 * The destination a route belongs to, or `undefined` when it belongs to none.
 *
 * **`/information-war` is deliberately absent** (VA-15). It used to return
 * `geopolitical-brief`, which lit the News & Analysis link in the bar while the
 * reader was on Behind the Desk — a page that is not News, is not inside News,
 * and has a control of its own in every chrome bar (`SYSTEM_LINK` in
 * `components/site/navigation-model.ts`). It owns its own active-state
 * identity, which is its own route id; `resolveActiveChromeSection` is what
 * turns that into the value the chrome compares against.
 *
 * It was the only route that resolved to a destination it is not part of. The
 * remaining rules are containment (`october-7/*`, `fake-resistance/*`) or an
 * address that outlived its own menu entry (`LEGACY_SECTION_PAGES`), and both
 * of those genuinely are inside the destination they name.
 */
export function resolveSiteSectionId(routeId: string): SiteSectionId | undefined {
  if (routeId.startsWith("october-7")) return "october-7";
  if (routeId.startsWith("fake-resistance")) return "fake-resistance";
  const legacy = LEGACY_SECTION_PAGES.find((page) => page.id === routeId);
  if (legacy) return legacy.parent;
  return getSiteNavigationItem(routeId)?.id;
}

/**
 * The "you are here" value the header and footer compare every chrome link
 * against — a destination id where the route has one, and the route's own id
 * where it does not.
 *
 * The fallback is what lets `/information-war`, `/methodology` and
 * `/corrections` mark themselves: none of them is a `SITE_NAVIGATION`
 * destination, all three have a link in the chrome, and resolving them to
 * `undefined` left those links unmarked (or, in the case of `/information-war`
 * before VA-15, marked the wrong one).
 *
 * A route with neither — an article, say — yields its own id, matches no chrome
 * link, and correctly marks nothing current.
 */
export function resolveActiveChromeSection(routeId: string): string {
  return resolveSiteSectionId(routeId) ?? routeId;
}
