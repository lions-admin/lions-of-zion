/**
 * Israel's Story — seam for real, cited historical chapters.
 *
 * This is a deliberately small working edition: seven chapters so far, each
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
  /** Set where credible sources disagree and the record does not settle it.
   *  The page flags the chapter from this field; it used to test the id
   *  string literal, which meant the editorial judgement lived in the
   *  renderer instead of travelling with the chapter it is about. */
  contested?: boolean;
  timeline: TimelineEntry[];
  sources: Source[];
};

export type IsraelsStoryEdition = {
  publishedAt: string;
  reviewedBy: string;
  chapters: StoryChapter[];
};

/* The founding chapter's four entries are four separate events, and one
   article about the Declaration was cited for all of them — so three of the
   four pointed at a document that does not cover them. Each now carries the
   primary record of its own event, from the UN Digital Library; every URL was
   fetched and its page title checked rather than written from memory.
   `WIKI_DECLARATION` stays only on the entry it actually covers. */

const UN_PARTITION_PLAN: Source = {
  id: 'un-res-181',
  label: 'UN General Assembly Resolution 181(II), “Future government of Palestine”',
  kind: 'UN record',
  url: 'https://digitallibrary.un.org/record/210008',
};

const UN_MANDATE_TEXT: Source = {
  id: 'un-mandate-text',
  label: 'Text of the Mandate for Palestine',
  kind: 'UN record',
  url: 'https://digitallibrary.un.org/record/829707',
};

const UN_ARAB_LEAGUE_CABLEGRAM: Source = {
  id: 'un-arab-league-cablegram',
  label:
    'Cablegram of 15 May 1948 from the Secretary-General of the League of Arab States',
  kind: 'UN record',
  url: 'https://digitallibrary.un.org/record/649818',
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

const WIKI_YOM_KIPPUR_WAR: Source = {
  id: 'wiki-yom-kippur-war',
  label: 'Yom Kippur War',
  kind: 'Wikipedia',
  url: 'https://en.wikipedia.org/wiki/Yom_Kippur_War',
};

const WIKI_JORDAN_TREATY: Source = {
  id: 'wiki-jordan-treaty',
  label: 'Israel–Jordan peace treaty',
  kind: 'Wikipedia',
  url: 'https://en.wikipedia.org/wiki/Israel%E2%80%93Jordan_peace_treaty',
};

const WIKI_ABRAHAM_ACCORDS: Source = {
  id: 'wiki-abraham-accords',
  label: 'Abraham Accords',
  kind: 'Wikipedia',
  url: 'https://en.wikipedia.org/wiki/Abraham_Accords',
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
        sources: [UN_PARTITION_PLAN],
      },
      {
        id: 'mandate-ends',
        datetime: '1948-05-14',
        dateLabel: 'Midnight, May 14–15, 1948',
        title: 'The British Mandate ends',
        body: 'British administration of Palestine terminates at midnight, ending three decades of Mandate rule.',
        sources: [UN_MANDATE_TEXT],
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
        sources: [UN_ARAB_LEAGUE_CABLEGRAM],
      },
    ],
    /* The union of what its four entries cite, so the chapter's own list
       cannot claim narrower sourcing than the entries beneath it. */
    sources: [
      UN_PARTITION_PLAN,
      UN_MANDATE_TEXT,
      WIKI_DECLARATION,
      UN_ARAB_LEAGUE_CABLEGRAM,
    ],
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
    id: 'yom-kippur-war',
    title: 'The Yom Kippur War, 1973',
    intro:
      'Six years after 1967, Egypt and Syria attacked on the holiest day of the Jewish calendar. The war that followed reshaped how the region thought about the peace that came after it.',
    timeline: [
      {
        id: 'operation-badr',
        datetime: '1973-10-06',
        dateLabel: 'Oct 6, 1973',
        title: 'Egypt and Syria launch a coordinated surprise attack',
        body: 'At 2:00pm on Yom Kippur, Egyptian forces cross the Suez Canal while Syrian forces attack the Golan Heights, opening the war. Israeli intelligence had read the Egyptian mobilization as a routine exercise.',
        sources: [WIKI_YOM_KIPPUR_WAR],
      },
      {
        id: 'canal-crossing',
        datetime: '1973-10-15',
        dateLabel: 'Oct 15, 1973',
        title: 'Israeli forces cross the Suez Canal',
        body: 'A force under Ariel Sharon breaches Egyptian lines and crosses to the canal’s western bank, the turning point of the war’s southern front.',
        sources: [WIKI_YOM_KIPPUR_WAR],
      },
      {
        id: 'ceasefire-1973',
        datetime: '1973-10-25',
        dateLabel: 'Oct 25, 1973',
        title: 'A ceasefire ends the fighting',
        body: 'A first ceasefire on October 22 collapses within hours; a second, on October 25, holds. Both Egypt and Syria describe the outcome as a moral victory despite the battlefield result — a reading that shapes the peace process the following chapter covers.',
        sources: [WIKI_YOM_KIPPUR_WAR],
      },
    ],
    sources: [WIKI_YOM_KIPPUR_WAR],
  },
  {
    /* The id is the `#anchor` in the contents nav and the `hasPart` URL in
       the page's JSON-LD, so it keeps the name the chapter was coined under
       when Egypt was the edition's only peace chapter. The title does not:
       every other chapter here is named event+date, and Jordan and the
       Abraham Accords have since become chapters of their own, which is what
       made the thematic name and its forward reference stale. */
    id: 'peace-when-it-came',
    title: 'Peace with Egypt, 1979',
    intro:
      'The first Arab state to make peace with Israel did so six years after the war that shook both sides into negotiating.',
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
    contested: true,
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
  {
    id: 'jordan-treaty',
    title: 'Peace with Jordan, 1994',
    intro:
      'The second Arab state to make peace with Israel, and the first to do so without a war between them driving it — the treaty settled a border and a water dispute as much as it ended a formal state of war.',
    timeline: [
      {
        id: 'jordan-treaty-signed',
        datetime: '1994-10-26',
        dateLabel: 'Oct 26, 1994',
        title: 'Israel and Jordan sign a peace treaty at the Arabah border crossing',
        body: 'Signed by Israeli Prime Minister Yitzhak Rabin and Jordanian Prime Minister Abdelsalam al-Majali, witnessed by U.S. President Bill Clinton. It ends the state of war dating to 1948, establishes full diplomatic relations and open borders, settles the boundary along the Jordan and Yarmouk rivers and the Dead Sea, sets water-sharing terms for the Yarmouk, and recognizes Jordan’s role over Muslim holy sites in Jerusalem.',
        sources: [WIKI_JORDAN_TREATY],
      },
    ],
    sources: [WIKI_JORDAN_TREATY],
  },
  {
    id: 'abraham-accords',
    title: 'The Abraham Accords, 2020',
    intro:
      'A different kind of peace from the three before it — no war between the signing countries preceded it. The accords normalized relations between Israel and Gulf and African states that had never fought it, brokered by the United States.',
    timeline: [
      {
        id: 'accords-signing',
        datetime: '2020-09-15',
        dateLabel: 'Sept 15, 2020',
        title: 'Israel, the UAE and Bahrain sign the Abraham Accords',
        body: 'Signed at the White House, brokered by the United States under President Donald Trump. The UAE and Bahrain become the first Arab states to formally recognize Israel since Jordan in 1994, establishing diplomatic, economic and security ties.',
        sources: [WIKI_ABRAHAM_ACCORDS],
      },
      {
        id: 'morocco-sudan-join',
        datetime: '2020-12-10',
        dateLabel: 'Dec 10, 2020 – Jan 6, 2021',
        title: 'Morocco and Sudan join the accords',
        body: 'Morocco’s normalization is announced December 10, 2020; Sudan signs its own Abraham Accords Declaration in Khartoum on January 6, 2021, bringing the total to four countries that year.',
        sources: [WIKI_ABRAHAM_ACCORDS],
      },
    ],
    sources: [WIKI_ABRAHAM_ACCORDS],
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
