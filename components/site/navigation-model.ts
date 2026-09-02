/**
 * The one IA model the site chrome reads — header bar, file drawer, mobile
 * sheet and footer all build from this file and nothing else.
 *
 * Why it exists: the header used to keep a hand-written `PRIMARY_NAVIGATION`
 * array with its own labels, which had drifted off the destinations it points
 * at — `/israels-story` was captioned "Israel Explained" in the bar while
 * `lib/site-navigation.ts` and the page itself both say "Israel's Story", and
 * `/geopolitical-brief` was captioned "Today". A reader clicked one name and
 * arrived at a page carrying another. The fix is structural rather than a
 * corrected string: **the chrome may not name a destination.** Every label
 * below is `displayName`, read from `SITE_NAVIGATION`, so that class of bug
 * cannot recur.
 *
 * `label` in `SITE_NAVIGATION` is stored uppercase as identity for the orbit;
 * reading surfaces use `displayName`, because `text-transform: capitalize`
 * renders "ISRAEL'S STORY" as "Israel'S Story". That is a correctness fact,
 * not a preference — see CLAUDE.md.
 */
import { SITE_NAVIGATION, type SiteSectionId } from "@/lib/site-navigation";

export interface ChromeLink {
  /** Always the destination's own name. Never re-typed by the chrome. */
  label: string;
  href: string;
  description: string;
  /** Two-digit file number, for the eight destinations only. */
  index?: string;
}

/**
 * The eight files, in orbit order, numbered 01–08. The numbering is the same
 * index the orbit and `SectionPage`'s file header use, so the drawer, the
 * footer and the page all count the same way.
 */
export const FILE_LINKS: readonly ChromeLink[] = SITE_NAVIGATION.map((item, position) => ({
  label: item.displayName,
  href: item.href,
  description: item.description,
  index: String(position + 1).padStart(2, "0"),
}));

/**
 * The four that earn a slot in the bar: the desk's content engines — today's
 * analysis, the running dispatch, the record, and the investigations. The
 * other four (`Our Heroes`, `Israel's Story`, `We Are`, `Support Us`) are
 * memorial, context, about and action; they are one click away in the drawer,
 * and `Support Us` additionally has its own control in the bar.
 *
 * Below 64rem this set is not thinned by editorial preference — it is dropped
 * whole, and the drawer carries every destination. Picking "the two that still
 * fit" is how a bar acquires a hierarchy nobody can defend.
 */
const BAR_SECTION_IDS: readonly SiteSectionId[] = [
  "geopolitical-brief",
  "war-update",
  "october-7",
  "fake-resistance",
];

export const BAR_LINKS: readonly ChromeLink[] = BAR_SECTION_IDS.map((id) => {
  const link = FILE_LINKS.find((candidate) => candidate.href === `/${id}`);
  /* Unreachable while `BAR_SECTION_IDS` is typed as `SiteSectionId[]`; the
     throw is here so a future rename fails loudly at build rather than
     silently shortening the bar. */
  if (!link) throw new Error(`Site chrome: no navigation entry for "${id}"`);
  return link;
});

/** The desk's action. Its own name, not an invented call to action. */
export const SUPPORT_LINK: ChromeLink =
  FILE_LINKS.find((link) => link.href === "/support-us") ?? FILE_LINKS[FILE_LINKS.length - 1];

/**
 * Not files — the pages a reader consults *about* the files. These four are
 * the trust surface, and they are why the drawer and the footer both carry a
 * reference block rather than burying them in a colophon line.
 *
 * `/information-war` is the system explainer ("This Is an Information War").
 * The old bar captioned it "Investigations", which is what `/fake-resistance`
 * actually is — two different pages competing for one word.
 */
export const REFERENCE_LINKS: readonly ChromeLink[] = [
  {
    label: "Methodology",
    href: "/methodology",
    description: "How a claim is sourced, checked and graded.",
  },
  {
    label: "Corrections",
    href: "/corrections",
    description: "Every amendment, published in full.",
  },
  {
    label: "The Information War",
    href: "/information-war",
    description: "How narratives become pressure, and how the desk answers.",
  },
  {
    label: "Account",
    href: "/account",
    description: "Saved work and access.",
  },
];

/**
 * Is this link the page the reader is on?
 *
 * `activeSection` is a section id (`october-7`), a bare route id
 * (`methodology`), or `information-war` — see `EditorialShell`. The prefix
 * test is what makes the ~1,177 archive records under `/october-7/…` mark
 * October 7 as current.
 */
export function isCurrentChromeLink(activeSection: string | undefined, href: string): boolean {
  if (!activeSection) return false;
  const target = href.slice(1);
  return activeSection === target || activeSection.startsWith(`${target}/`);
}

/**
 * True when the reader is inside one of the eight but the bar cannot show it —
 * the condition under which the "All files" trigger takes the gold mark, so
 * "you are here" always has somewhere to live.
 *
 * `SUPPORT_LINK` counts as on the bar even though it is not in `BAR_LINKS`: it
 * has its own control there and marks itself current. Without this the reader
 * on `/support-us` would see two gold marks in one bar for one idea, and gold
 * in this component means exactly one thing.
 */
export function isSectionOffBar(activeSection: string | undefined): boolean {
  if (!activeSection) return false;
  const inFiles = FILE_LINKS.some((link) => isCurrentChromeLink(activeSection, link.href));
  const onBar = [...BAR_LINKS, SUPPORT_LINK].some((link) =>
    isCurrentChromeLink(activeSection, link.href),
  );
  return inFiles && !onBar;
}
