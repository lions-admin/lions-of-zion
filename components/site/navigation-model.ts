import { SITE_NAVIGATION, type SiteSectionId } from "@/lib/site-navigation";

export interface ChromeLink {
  label: string;
  href: string;
  description: string;
}

function section(id: SiteSectionId): ChromeLink {
  const item = SITE_NAVIGATION.find((entry) => entry.id === id);
  if (!item) throw new Error(`Site chrome: no navigation entry for "${id}"`);
  return { label: item.displayName, href: item.href, description: item.description };
}

export const SYSTEM_LINK: ChromeLink = {
  label: "How it works",
  href: "/information-war",
  description: "Open the system: from source material to public reporting.",
};

/** Reader tasks, rather than a numbered catalogue. Shared by both menu sizes. */
export const REPORTING_LINKS: readonly ChromeLink[] = [
  section("geopolitical-brief"), section("fake-resistance"), section("october-7"),
];
export const ABOUT_LINKS: readonly ChromeLink[] = [
  SYSTEM_LINK, section("we-are"), section("our-heroes"), section("israels-story"),
];
export const SUPPORT_LINK = section("support-us");
export const SECTION_LINKS: readonly ChromeLink[] = [...REPORTING_LINKS, ...ABOUT_LINKS, SUPPORT_LINK];
export const BAR_LINKS: readonly ChromeLink[] = [...REPORTING_LINKS, SYSTEM_LINK];

/** Useful but secondary. No separate wall of repeated page descriptions. */
export const REFERENCE_LINKS: readonly ChromeLink[] = [
  { label: "Methodology", href: "/methodology", description: "How sources and findings are assessed." },
  { label: "Corrections", href: "/corrections", description: "How the public record is corrected." },
  { label: "Account", href: "/account", description: "Saved work and access." },
];

export function isCurrentChromeLink(activeSection: string | undefined, href: string): boolean {
  if (!activeSection) return false;
  const target = href.slice(1);
  return activeSection === target || activeSection.startsWith(`${target}/`);
}

export function isSectionOffBar(activeSection: string | undefined): boolean {
  if (!activeSection) return false;
  const known = [...SECTION_LINKS, ...REFERENCE_LINKS].some((link) => isCurrentChromeLink(activeSection, link.href));
  const onBar = [...BAR_LINKS, SUPPORT_LINK].some((link) => isCurrentChromeLink(activeSection, link.href));
  return known && !onBar;
}
