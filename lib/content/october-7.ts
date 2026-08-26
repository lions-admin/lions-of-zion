/**
 * October 7 — "The record" seam.
 *
 * Same convention as `lib/content/war-update.ts`: local and hand-sourced
 * today, swappable later. Testimony and remembrance are handled by linking
 * to real, established archives (`ARCHIVE_SOURCES`) rather than reproducing
 * any testimony or building victim profiles here — this site has no
 * consent from survivors or families to do either. See `.ai/DECISIONS.md`
 * for why that boundary exists and must hold in any future edit.
 */
import type { AssessmentValue } from '@/server/contracts/enums';
import type { Figure, Source, TimelineEntry } from '@/components/content';

export type October7Record = {
  publishedAt: string;
  reviewedBy: string;
  figures: Figure[];
  timeline: TimelineEntry[];
  archives: Source[];
};

const VERIFIED: AssessmentValue = 'verified';

const ADL_SOURCE: Source = {
  id: 'adl-timeline',
  label: 'The October 7th War: A Timeline of Key Events and Issues',
  kind: 'ADL',
  url: 'https://www.adl.org/resources/backgrounder/october-7th-war-timeline-key-events-and-issues',
};

const FIGURES: Figure[] = [
  { value: '1,200+', label: 'Killed in Israel that day, mostly civilians' },
  { value: '251', label: 'Hostages taken into Gaza' },
  { value: '22+', label: 'Communities attacked, plus the Nova festival and IDF posts' },
];

const TIMELINE: TimelineEntry[] = [
  {
    id: 'attack',
    datetime: '2023-10-07',
    dateLabel: 'Oct 7, 2023',
    category: 'The attack',
    assessment: VERIFIED,
    title: 'Hamas and allied fighters attack southern Israel',
    body: 'Roughly 6,000 fighters cross from Gaza — primarily by land, with additional sea and paraglider infiltration reported elsewhere — while thousands of rockets are fired into Israeli territory. Twenty-two civilian communities, the Nova music festival, and about a dozen IDF bases and posts are attacked. It is the deadliest day for Jews since the Holocaust.',
    sources: [ADL_SOURCE],
  },
  {
    id: 'ground-offensive',
    datetime: '2023-10-27',
    dateLabel: 'Oct 27, 2023',
    category: 'The war',
    assessment: VERIFIED,
    title: 'Israel launches a ground offensive into Gaza',
    body: 'The start of the campaign to dismantle Hamas’s military and governing capability there.',
    sources: [ADL_SOURCE],
  },
  {
    id: 'first-ceasefire',
    datetime: '2023-11-24',
    dateLabel: 'Nov 24, 2023',
    category: 'Hostages',
    assessment: VERIFIED,
    title: 'A first ceasefire brings the first hostage releases',
    body: 'A temporary pause exchanges hostages held in Gaza for Palestinian prisoners held in Israel.',
    sources: [ADL_SOURCE],
  },
  {
    id: 'sinwar-killed',
    datetime: '2024-10-16',
    dateLabel: 'Oct 16, 2024',
    category: 'The war',
    assessment: VERIFIED,
    title: 'Hamas leader Yahya Sinwar is killed',
    body: 'Sinwar, believed to have planned the October 7 attack, is killed by Israeli forces in Gaza.',
    sources: [ADL_SOURCE],
  },
  {
    id: 'jan-2025-ceasefire',
    datetime: '2025-01-19',
    dateLabel: 'Jan 19, 2025',
    category: 'Diplomacy',
    assessment: VERIFIED,
    title: 'A ceasefire is implemented',
    sources: [ADL_SOURCE],
    body: 'Superseded later the same year — see War Update for the ceasefire process that has been in effect since October 2025.',
  },
  {
    id: 'final-hostages',
    datetime: '2025-10-13',
    dateLabel: 'Oct 13, 2025',
    category: 'Hostages',
    assessment: VERIFIED,
    title: 'The final 20 living hostages are released',
    body: 'All remaining living hostages come home within days, under the ceasefire process — see War Update for how it has held since.',
    sources: [ADL_SOURCE],
  },
  {
    id: 'last-hostage-recovered',
    datetime: '2026-01-26',
    dateLabel: 'Jan 26, 2026',
    category: 'Hostages',
    assessment: VERIFIED,
    title: 'The last deceased hostage is recovered',
    body: 'The body of the final hostage still held in Gaza is returned, closing that chapter of the war.',
    sources: [ADL_SOURCE],
  },
];

/**
 * Real, independently operated testimony and memorial projects. This site
 * does not host or reproduce testimony — it links to where the fuller
 * record already lives, with named, credentialed custodians.
 */
const ARCHIVES: Source[] = [
  {
    id: 'edut-710',
    label: 'Edut 710 — testimony from survivors, witnesses, first responders and bereaved families',
    kind: 'Historical testimony archive',
    url: 'https://www.edut710en.org/',
  },
  {
    id: 'usc-shoah',
    label: 'USC Shoah Foundation — October 7 testimony collection',
    kind: 'Oral-history archive',
    url: 'https://sfi.usc.edu/october7testimonies',
  },
  {
    id: 'october7-org',
    label: 'October7.org — firsthand accounts, translated',
    kind: 'Testimony repository',
    url: 'https://october7.org/',
  },
];

const RECORD: October7Record = {
  publishedAt: 'Aug 25, 2026',
  reviewedBy: 'Editorial desk',
  figures: FIGURES,
  timeline: TIMELINE,
  archives: ARCHIVES,
};

export async function getOctober7Record(): Promise<October7Record> {
  return RECORD;
}

/**
 * The same edition, read synchronously.
 *
 * The home route must render without JavaScript (`CLAUDE.md`). This existed
 * because an async component put a route behind `app/loading.tsx`'s Suspense
 * boundary, where no-JS visitors never got past the fallback. That file is
 * deleted now (`.ai/DECISIONS.md`, 2026-08-26), so the constraint no longer
 * binds — this stays because nothing needs it to change. The accessor above
 * stays the seam a real query will land on; this is the static shape the
 * front-page band reads today. One object, two doors — not two sources.
 */
export const october7Record: October7Record = RECORD;
