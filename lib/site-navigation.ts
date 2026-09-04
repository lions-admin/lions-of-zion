export type SiteSectionId =
  | "geopolitical-brief"
  | "we-are"
  | "war-update"
  | "october-7"
  | "our-heroes"
  | "israels-story"
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
    label: "GEOPOLITICAL BRIEF",
    displayName: "Geopolitical Brief",
    href: "/geopolitical-brief",
    description:
      "One strategic file worked through in order: what changed, what follows, and what remains unknown.",
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
    id: "war-update",
    label: "WAR UPDATE",
    displayName: "War Update",
    href: "/war-update",
    description:
      "Dated dispatches with their sources beside them and a corrections record that follows.",
    emblem: "/emblems/war-update.svg",
    tone: "signal",
  },
  {
    id: "october-7",
    label: "OCTOBER 7",
    displayName: "October 7",
    href: "/october-7",
    description:
      "The record of the day and its archives: first-hand testimony and documentation held in full.",
    emblem: "/emblems/october-7.svg",
    tone: "archive",
  },
  {
    id: "our-heroes",
    label: "OUR HEROES",
    displayName: "Our Heroes",
    href: "/our-heroes",
    description:
      "Citations for the fallen, the fighters, and the rescuers, built from named reporting.",
    emblem: "/emblems/our-heroes.svg",
    tone: "archive",
  },
  {
    id: "israels-story",
    label: "ISRAEL'S STORY",
    displayName: "Israel’s Story",
    href: "/israels-story",
    description:
      "The founding, wars, and treaties that followed, set in sourced chapters from 1947 onward.",
    emblem: "/emblems/israels-story.svg",
    tone: "archive",
  },
  {
    id: "fake-resistance",
    label: "FAKE RESISTANCE",
    displayName: "Fake Resistance",
    href: "/fake-resistance",
    description:
      "Case files on manufactured outrage: how claims were built, how they travelled, and what the record shows.",
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

/** Two-digit file count, derived from the list so it can never drift. */
export const FILES_COUNT_LABEL = String(SITE_NAVIGATION.length).padStart(2, "0");

export function getSiteNavigationItem(id: string) {
  return SITE_NAVIGATION.find((item) => item.id === id);
}

export function resolveSiteSectionId(routeId: string): SiteSectionId | undefined {
  if (routeId === "information-war") return "geopolitical-brief";
  if (routeId.startsWith("october-7")) return "october-7";
  if (routeId.startsWith("fake-resistance")) return "fake-resistance";
  return getSiteNavigationItem(routeId)?.id;
}
