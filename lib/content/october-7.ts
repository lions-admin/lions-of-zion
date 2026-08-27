/**
 * October 7 — "The record" seam.
 *
 * Same convention as `lib/content/war-update.ts`: local and hand-sourced
 * today, swappable later.
 *
 * **The link-only boundary this file used to describe is reversed.** Two
 * crawled archives are hosted under `/october-7/testimonies` and
 * `/october-7/documentation`, read through `lib/content/testimonies.ts` and
 * `lib/content/documentation.ts`. `ARCHIVES` below is now the short list of
 * projects that remain genuinely additive rather than the whole answer to
 * testimony. See `.ai/DECISIONS.md`, 2026-08-26, for the reversal and for
 * what must not be quietly re-tightened.
 *
 * What this file still owns is "The record": administrative and casualty
 * facts from primary research, not testimony.
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

/* One ADL backgrounder used to carry all seven entries, so the margin printed
   the same citation seven times: an ornament rather than evidence, and a page
   claiming the record is checkable resting visibly on a single secondary
   source. Each entry now carries the record of its own event. Every URL below
   was fetched and its title and date checked in the session that added it —
   the same rule the founding chapter in `israels-story.ts` is held to — and
   the ADL timeline stays only on the entry whose figures it is the source of. */

const ADL_SOURCE: Source = {
  id: 'adl-timeline',
  label: 'The October 7th War: A Timeline of Key Events and Issues',
  kind: 'ADL',
  url: 'https://www.adl.org/resources/backgrounder/october-7th-war-timeline-key-events-and-issues',
};

const UN_COI_OCTOBER_7: Source = {
  id: 'un-coi-october-7',
  label:
    'Detailed findings on attacks carried out on and after 7 October 2023 in Israel (A/HRC/56/CRP.3)',
  kind: 'UN record',
  url: 'https://digitallibrary.un.org/record/4051246',
};

const OCHA_FLASH_22: Source = {
  id: 'ocha-flash-22',
  label:
    'Hostilities in the Gaza Strip and Israel, Flash Update #22 — reporting 27–28 October 2023',
  kind: 'UN OCHA',
  url: 'https://www.ochaopt.org/content/hostilities-gaza-strip-and-israel-flash-update-22',
};

const OCHA_FLASH_49: Source = {
  id: 'ocha-flash-49',
  label:
    'Hostilities in the Gaza Strip and Israel, Flash Update #49 — the pause enters into force, 24 November 2023',
  kind: 'UN OCHA',
  url: 'https://www.ochaopt.org/content/hostilities-gaza-strip-and-israel-flash-update-49',
};

const US_STATEMENT_SINWAR: Source = {
  id: 'us-statement-sinwar',
  label: 'Statement on the Death of Yahya Sinwar, 17 October 2024',
  kind: 'US Presidential Documents',
  url: 'https://www.govinfo.gov/content/pkg/DCPD-202400923/html/DCPD-202400923.htm',
};

const PMO_FIRST_HOSTAGES_2025: Source = {
  id: 'pmo-first-hostages-2025',
  label: 'First hostages return home — Prime Minister’s Office announcement, 19 January 2025',
  kind: 'Israel Prime Minister’s Office',
  url: 'https://embassies.gov.il/usa/en/news/first-hostages-return-home-19012025',
};

const ICRC_FINAL_TWENTY: Source = {
  id: 'icrc-final-twenty',
  label:
    'ICRC facilitates the return of 20 hostages and 1,808 detainees as part of ceasefire agreement, 13 October 2025',
  kind: 'ICRC',
  url: 'https://www.icrc.org/en/news-release/israel-and-occupied-territories-icrc-facilitates-return-20-hostages-and-1809-detainees',
};

const MFA_LAST_HOSTAGE: Source = {
  id: 'mfa-last-hostage',
  label:
    'President Isaac Herzog addresses the return home of the last hostage, Ran Gvili, 26 January 2026',
  kind: 'Israel Ministry of Foreign Affairs',
  url: 'https://embassies.gov.il/nepal/en/news/president-isaac-herzog-addresses-return-home-last-hostage-ran-gvili-26012026',
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
    sources: [UN_COI_OCTOBER_7, ADL_SOURCE],
  },
  {
    id: 'ground-offensive',
    datetime: '2023-10-27',
    dateLabel: 'Oct 27, 2023',
    category: 'The war',
    assessment: VERIFIED,
    title: 'Israel launches a ground offensive into Gaza',
    body: 'The start of the campaign to dismantle Hamas’s military and governing capability there.',
    sources: [OCHA_FLASH_22],
  },
  {
    id: 'first-ceasefire',
    datetime: '2023-11-24',
    dateLabel: 'Nov 24, 2023',
    category: 'Hostages',
    assessment: VERIFIED,
    title: 'A first ceasefire brings the first hostage releases',
    body: 'A temporary pause exchanges hostages held in Gaza for Palestinian prisoners held in Israel.',
    sources: [OCHA_FLASH_49],
  },
  {
    id: 'sinwar-killed',
    datetime: '2024-10-16',
    dateLabel: 'Oct 16, 2024',
    category: 'The war',
    assessment: VERIFIED,
    title: 'Hamas leader Yahya Sinwar is killed',
    body: 'Sinwar, believed to have planned the October 7 attack, is killed by Israeli forces in Gaza.',
    sources: [US_STATEMENT_SINWAR],
  },
  {
    id: 'jan-2025-ceasefire',
    datetime: '2025-01-19',
    dateLabel: 'Jan 19, 2025',
    category: 'Diplomacy',
    assessment: VERIFIED,
    title: 'A ceasefire is implemented',
    sources: [PMO_FIRST_HOSTAGES_2025],
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
    sources: [ICRC_FINAL_TWENTY],
  },
  {
    id: 'last-hostage-recovered',
    datetime: '2026-01-26',
    dateLabel: 'Jan 26, 2026',
    category: 'Hostages',
    assessment: VERIFIED,
    title: 'The last deceased hostage is recovered',
    body: 'The body of Ran Gvili, the last hostage still held in Gaza, is recovered and returned, closing that chapter of the war.',
    sources: [MFA_LAST_HOSTAGE],
  },
];

/**
 * Testimony projects this site does **not** hold.
 *
 * The two archives under `/october-7/testimonies` and `/october-7/documentation`
 * are hosted here in full. These are the ones that remain genuinely additive:
 * both are recorded-interview collections — video and oral history gathered
 * under a consent process this site has no equivalent of — so linking is the
 * only honest way to carry them.
 *
 * October7.org is deliberately **not** in this list any more. Its records are
 * hosted here now, so an invitation to go and read them elsewhere would read
 * as an editing mistake; its attribution appears instead on every record's
 * provenance note and beside the archive entry on the page.
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
