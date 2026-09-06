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
  SYSTEM_LINK, section("we-are"), section("people-of-israel"),
];
export const SUPPORT_LINK = section("support-us");
export const SECTION_LINKS: readonly ChromeLink[] = [...REPORTING_LINKS, ...ABOUT_LINKS, SUPPORT_LINK];
export const BAR_LINKS: readonly ChromeLink[] = [...REPORTING_LINKS, SYSTEM_LINK];

/**
 * The reader's own destination — a reference link that is also a permanent
 * control in the bar, which is why it is named separately here.
 *
 * The description read "Saved work and access." until 2026-09-05, and both
 * halves of it were untrue: nothing on this site can be saved, and nothing
 * published here is gated behind an account. What signing in actually buys is
 * continuity between visits, which is what `app/account/page.tsx` already
 * tells the reader in its own lede.
 */
export const ACCOUNT_LINK: ChromeLink = {
  label: "Account",
  href: "/account",
  description: "Sign in so the desk knows you between visits.",
};

/** Useful but secondary. No separate wall of repeated page descriptions. */
export const REFERENCE_LINKS: readonly ChromeLink[] = [
  { label: "Methodology", href: "/methodology", description: "How sources and findings are assessed." },
  { label: "Corrections", href: "/corrections", description: "How the public record is corrected." },
  ACCOUNT_LINK,
];

export function isCurrentChromeLink(activeSection: string | undefined, href: string): boolean {
  if (!activeSection) return false;
  const target = href.slice(1);
  return activeSection === target || activeSection.startsWith(`${target}/`);
}

/**
 * True when the current file has no control of its own in the bar, so the
 * "Menu" trigger has to carry the "you are here" mark on its behalf.
 *
 * `ACCOUNT_LINK` counts as on the bar even though it is not in `BAR_LINKS`:
 * the account control is permanent at every width and takes `aria-current`
 * itself, so marking the Menu trigger for `/account` as well would say "here"
 * twice in one row of chrome.
 */
export function isSectionOffBar(activeSection: string | undefined): boolean {
  if (!activeSection) return false;
  const known = [...SECTION_LINKS, ...REFERENCE_LINKS].some((link) => isCurrentChromeLink(activeSection, link.href));
  const onBar = [...BAR_LINKS, SUPPORT_LINK, ACCOUNT_LINK].some((link) => isCurrentChromeLink(activeSection, link.href));
  return known && !onBar;
}
