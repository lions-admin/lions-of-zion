/**
 * Israel's Story — seam for real, cited historical chapters.
 *
 * This is a deliberately small working edition: four chapters so far, each
 * with dates and sources a reader can check, added one at a time rather
 * than reaching across millennia in one pass. An ancient-continuity chapter
 * needs sourcing no session so far has had time to do carefully — see
 * `.ai/DECISIONS.md`. Do not pad this file with additional chapters that
 * weren't individually verified; add them the same way these were, one at
 * a time, with a fetched source per fact.
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

const WIKI_SIX_DAY_WAR: Source = {
  id: 'wiki-six-day-war',
  label: 'Six-Day War',
  kind: 'Wikipedia',
  url: 'https://en.wikipedia.org/wiki/Six-Day_War',
};

const MFA_TIRAN_BLOCKADE: Source = {
  id: 'mfa-tiran-blockade',
  label: 'Egypt reimposes a naval blockade on the Straits of Tiran, 23 May 1967',
  kind: 'Israel Ministry of Foreign Affairs',
  url: 'https://www.gov.il/en/pages/4-egypt-reimposes-naval-blockade-on-straits-of-tiran-23-may-1967',
};

const WIKI_OSLO_ACCORDS: Source = {
  id: 'wiki-oslo-accords',
  label: 'Oslo Accords',
  kind: 'Wikipedia',
  url: 'https://en.wikipedia.org/wiki/Oslo_Accords',
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
    id: 'six-day-war',
    title: 'The Six-Day War, 1967',
    intro:
      'Israel captured more territory in six days of fighting than the war that founded it ever put in play. What triggered the war and what changed after it are both a matter of record.',
    timeline: [
      {
        id: 'tiran-closed',
        datetime: '1967-05-23',
        dateLabel: 'May 23, 1967',
        title: 'Egypt closes the Straits of Tiran to Israeli shipping',
        body: 'President Gamal Abdel Nasser announces a blockade of the Straits of Tiran and the Gulf of Aqaba to Israeli-flagged vessels — a route roughly 90% of Israel’s oil passed through — days after expelling UN peacekeepers from Sinai and mobilizing Egyptian forces along the border.',
        sources: [MFA_TIRAN_BLOCKADE],
      },
      {
        id: 'operation-focus',
        datetime: '1967-06-05',
        dateLabel: 'Jun 5, 1967',
        title: 'Israel opens the war with a surprise air strike',
        body: 'At 7:45am, the Israeli Air Force launches Operation Focus, destroying most of Egypt’s air force on the ground within hours. Egypt, Syria and Jordan, with smaller forces from Iraq and Lebanon, fight Israel over the six days that follow.',
        sources: [WIKI_SIX_DAY_WAR],
      },
      {
        id: 'ceasefire-1967',
        datetime: '1967-06-10',
        dateLabel: 'Jun 10, 1967',
        title: 'A UN-brokered ceasefire ends the war',
        body: 'Israel ends the war holding the Sinai Peninsula and Gaza Strip (from Egypt), the West Bank including East Jerusalem (from Jordan), and the Golan Heights (from Syria) — about 70,000 square kilometers of territory in total.',
        sources: [WIKI_SIX_DAY_WAR],
      },
    ],
    sources: [WIKI_SIX_DAY_WAR, MFA_TIRAN_BLOCKADE],
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
  {
    id: 'oslo-accords',
    title: 'Oslo, 1993',
    intro:
      'The first direct agreement between Israel and the PLO: mutual recognition and a framework for Palestinian self-government, with the hardest questions deliberately deferred. What it achieved and what it left unresolved are both still argued over — the accords’ long-term legacy is genuinely disputed among historians and analysts, not settled history, and this chapter does not adjudicate that dispute; it states what was signed and by whom.',
    timeline: [
      {
        id: 'mutual-recognition',
        datetime: '1993-09-09',
        dateLabel: 'Sept 9, 1993',
        title: 'Israel and the PLO exchange letters of mutual recognition',
        body: 'The PLO recognizes Israel’s right to exist in peace and security; Israel recognizes the PLO as the representative of the Palestinian people.',
        sources: [WIKI_OSLO_ACCORDS],
      },
      {
        id: 'declaration-of-principles',
        datetime: '1993-09-13',
        dateLabel: 'Sept 13, 1993',
        title: 'The Declaration of Principles is signed in Washington',
        body: 'Negotiated in secret in Oslo, Norway, and signed publicly on the White House lawn by Shimon Peres for Israel and Mahmoud Abbas for the PLO, with Yitzhak Rabin and Yasser Arafat present and U.S. President Bill Clinton witnessing. It establishes the Palestinian Authority, sets a five-year transitional period, and defers Jerusalem, settlements, refugees, borders and final status to later negotiation.',
        sources: [WIKI_OSLO_ACCORDS],
      },
    ],
    sources: [WIKI_OSLO_ACCORDS],
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
