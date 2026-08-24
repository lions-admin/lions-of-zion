/**
 * The eight sections, in ring order.
 *
 * Identity is data, written once. The ring geometry, the DOM navigation, the
 * icon system and the transition system all read this list — a section list
 * written twice is a section list that disagrees with itself the first time
 * anybody reorders it.
 *
 * There are no destinations yet. `href` is deliberately absent rather than
 * stubbed: nothing here should look like a route until one exists, and the
 * entry rows below are rendered as text, not as links.
 */

export interface SectionEntry {
  label: string;
  hint: string;
}

export interface NavSection {
  id: string;
  label: string;
  icon: string;
  /** Two short lines, shown beneath the node and again in its panel. */
  blurb: readonly [string, string];
  entries: readonly SectionEntry[];
}

export const SECTIONS = [
  {
    id: "today",
    label: "Today",
    icon: "clock",
    blurb: ["What matters", "right now"],
    entries: [
      { label: "Live Updates", hint: "As it happens" },
      { label: "Today's Brief", hint: "The short version" },
      { label: "What Changed", hint: "Since yesterday" },
      { label: "Watchlist", hint: "Developing stories" },
    ],
  },
  {
    id: "verify",
    label: "Verify",
    icon: "shield",
    blurb: ["Claims.", "Evidence. Truth."],
    entries: [
      { label: "Latest Claims", hint: "See what's trending" },
      { label: "False Claims", hint: "Debunked and exposed" },
      { label: "Misleading Claims", hint: "Partly false or misleading" },
      { label: "Manipulated Content", hint: "Edited, taken out of context" },
      { label: "Search a Claim", hint: "Find any claim" },
      { label: "Report a Claim", hint: "Help us verify" },
    ],
  },
  {
    id: "war",
    label: "The War",
    icon: "globe",
    blurb: ["The regional", "picture"],
    entries: [
      { label: "Fronts", hint: "Where it is being fought" },
      { label: "Actors", hint: "Who is involved" },
      { label: "Timeline", hint: "How it developed" },
      { label: "Terminology", hint: "What the words mean" },
    ],
  },
  {
    id: "october-7",
    label: "October 7",
    icon: "calendar",
    blurb: ["The day", "everything changed"],
    entries: [
      { label: "The Record", hint: "Documented and sourced" },
      { label: "Hour by Hour", hint: "How the day unfolded" },
      { label: "The Communities", hint: "Where it happened" },
      { label: "Denial", hint: "Claims and rebuttals" },
    ],
  },
  {
    id: "stories",
    label: "Stories",
    icon: "heart",
    blurb: ["Courage. Loss.", "Humanity."],
    entries: [
      { label: "Survivors", hint: "In their words" },
      { label: "Families", hint: "Those still waiting" },
      { label: "First Responders", hint: "Who ran toward it" },
      { label: "Submit a Story", hint: "Add your account" },
    ],
  },
  {
    id: "israel-explained",
    label: "Israel Explained",
    icon: "book",
    blurb: ["Facts. History.", "Context."],
    entries: [
      { label: "The Basics", hint: "Start here" },
      { label: "History", hint: "How it got here" },
      { label: "Common Questions", hint: "Asked and answered" },
      { label: "Maps", hint: "Geography, plainly" },
    ],
  },
  {
    id: "influence",
    label: "Influence",
    icon: "network",
    blurb: ["Narratives. Actors.", "Networks."],
    entries: [
      { label: "Narratives", hint: "What is being pushed" },
      { label: "Networks", hint: "Who amplifies whom" },
      { label: "Campaigns", hint: "Coordinated activity" },
      { label: "Methods", hint: "How influence works" },
    ],
  },
  {
    id: "about",
    label: "About",
    icon: "person",
    blurb: ["Who we are", "and why"],
    entries: [
      { label: "Our Method", hint: "How we verify" },
      { label: "Standards", hint: "What we will not publish" },
      { label: "Corrections", hint: "When we get it wrong" },
      { label: "Contact", hint: "Reach the team" },
    ],
  },
] as const satisfies readonly NavSection[];

export type SectionId = (typeof SECTIONS)[number]["id"];
export type IconKey = (typeof SECTIONS)[number]["icon"];

export const SECTION_COUNT = SECTIONS.length;

export function sectionIndex(id: SectionId): number {
  return SECTIONS.findIndex((section) => section.id === id);
}

export function sectionById(id: SectionId): (typeof SECTIONS)[number] {
  const found = SECTIONS.find((section) => section.id === id);
  if (!found) throw new Error(`Unknown section: ${id}`);
  return found;
}
