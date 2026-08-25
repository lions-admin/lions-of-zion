/**
 * Israel's Story — seam for real, cited historical chapters.
 *
 * This is a deliberately small first edition: two chapters, each with dates
 * and sources a reader can check, rather than reaching across millennia in
 * one pass. An ancient-continuity chapter needs sourcing this session
 * didn't have time to do carefully — see `.ai/DECISIONS.md`. Do not pad
 * this file with additional chapters that weren't individually verified;
 * add them the same way these two were, one at a time, with a fetched
 * source per fact.
 */
import type { Source, TimelineEntry } from '@/components/content';

export type StoryChapter = {
  id: string;
  title: string;
  intro: string;
  timeline: TimelineEntry[];
  sources: Source[];
};

export type IsraelsStoryEdition = {
  publishedAt: string;
  reviewedBy: string;
  chapters: StoryChapter[];
};

const WIKI_DECLARATION: Source = {
  id: 'wiki-declaration',
  label: 'Israeli Declaration of Independence',
  kind: 'Wikipedia',
  url: 'https://en.wikipedia.org/wiki/Israeli_Declaration_of_Independence',
};

const WIKI_EGYPT_TREATY: Source = {
  id: 'wiki-egypt-treaty',
  label: 'Egypt–Israel peace treaty',
  kind: 'Wikipedia',
  url: 'https://en.wikipedia.org/wiki/Israel%E2%80%93Egypt_peace_treaty',
};

const CHAPTERS: StoryChapter[] = [
  {
    id: 'the-founding',
    title: 'The founding, 1947–1948',
    intro:
      'A state proclaimed under fire, hours after the authority governing the land ended, and invaded within a day of existing. The dates below are the spine of it.',
    timeline: [
      {
        id: 'partition-plan',
        datetime: '1947-11-29',
        dateLabel: 'Nov 29, 1947',
        title: 'The UN adopts the Partition Plan',
        body: 'General Assembly Resolution 181(II) recommends dividing the British Mandate for Palestine into Jewish and Arab states.',
        sources: [WIKI_DECLARATION],
      },
      {
        id: 'mandate-ends',
        datetime: '1948-05-14',
        dateLabel: 'Midnight, May 14–15, 1948',
        title: 'The British Mandate ends',
        body: 'British administration of Palestine terminates at midnight, ending three decades of Mandate rule.',
        sources: [WIKI_DECLARATION],
      },
      {
        id: 'independence',
        datetime: '1948-05-14',
        dateLabel: 'May 14, 1948',
        title: 'David Ben-Gurion proclaims independence',
        body: 'At the Tel Aviv Museum, Ben-Gurion reads the Declaration of Independence on behalf of the 37-member Provisional State Council, establishing the State of Israel.',
        sources: [WIKI_DECLARATION],
      },
      {
        id: 'invasion',
        datetime: '1948-05-15',
        dateLabel: 'May 15, 1948',
        title: 'Egypt, Transjordan, Iraq and Syria invade',
        body: 'Within a day of the declaration, four neighboring states send forces into the former Mandate territory, opening the 1948 Arab–Israeli War.',
        sources: [WIKI_DECLARATION],
      },
    ],
    sources: [WIKI_DECLARATION],
  },
  {
    id: 'peace-when-it-came',
    title: 'Peace, when it came',
    intro:
      'The first Arab state to make peace with Israel did so three decades after the war that began at independence. Jordan followed in 1994, and the Abraham Accords brought four more countries to normalized relations in 2020 — both real, later chapters this first edition does not yet detail; that is a known gap, not an omission to gloss over.',
    timeline: [
      {
        id: 'egypt-treaty',
        datetime: '1979-03-26',
        dateLabel: 'Mar 26, 1979',
        title: 'Egypt and Israel sign a peace treaty',
        body: 'Signed in Washington, D.C. by Egyptian President Anwar Sadat and Israeli Prime Minister Menachem Begin, witnessed by U.S. President Jimmy Carter. It ends the state of war dating to 1948: Israel withdraws from the Sinai Peninsula; Egypt demilitarizes it and opens the Suez Canal and the Strait of Tiran to Israeli shipping.',
        sources: [WIKI_EGYPT_TREATY],
      },
    ],
    sources: [WIKI_EGYPT_TREATY],
  },
];

const EDITION: IsraelsStoryEdition = {
  publishedAt: 'Aug 25, 2026',
  reviewedBy: 'Editorial desk',
  chapters: CHAPTERS,
};

export async function getIsraelsStoryEdition(): Promise<IsraelsStoryEdition> {
  return EDITION;
}
