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
    displayName: "Narratives & Fact Checks",
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

export function resolveSiteSectionId(routeId: string): SiteSectionId | undefined {
  if (routeId === "information-war") return "geopolitical-brief";
  if (routeId.startsWith("october-7")) return "october-7";
  if (routeId.startsWith("fake-resistance")) return "fake-resistance";
  return getSiteNavigationItem(routeId)?.id;
}
