/**
 * War Update — reference edition seam.
 *
 * `getWarUpdateEdition` returns a local, hand-sourced digest today. Its
 * signature is already async so the eventual swap to a real published-content
 * query is a change to this function's body, not to any call site. It does
 * NOT yet call `GET /api/v1/published-items` — `PublishedItemView` has no
 * field that maps an item to "belongs on War Update" vs. any other page, and
 * guessing at that filter now would be inventing a contract nobody has
 * designed. See `.ai/DECISIONS.md` for the reference-edition convention this
 * follows.
 *
 * Every entry below is a dated, publicly documented administrative,
 * humanitarian or diplomatic milestone — never a live tactical claim. Sources
 * were fetched and verified in the session that authored this file; a future
 * edit that adds an entry must do the same before writing it.
 */
import type { AssessmentValue } from '@/server/contracts/enums';
import type { TimelineEntry, Source, Correction } from '@/components/content';

export type WarUpdateEdition = {
  edition: string;
  coverageWindow: string;
  publishedAt: string;
  reviewedBy: string;
  sourceCount: number;
  trustStrip: string;
  entries: TimelineEntry[];
  sources: Source[];
  corrections: Correction[];
};

const VERIFIED: AssessmentValue = 'verified';

const SOURCES: Source[] = [
  {
    id: 'aj-plan-announced',
    label: 'Trump announces Israel-Hamas ceasefire deal: What we know and what’s next',
    kind: 'Al Jazeera',
    url: 'https://www.aljazeera.com/news/2025/10/9/trump-announces-gaza-ceasefire-deal-what-we-know-and-whats-next',
  },
  {
    id: 'toi-full-text',
    label: 'Full text of Oct. 9 Israel-Hamas deal on Trump’s plan for ‘comprehensive end’ to Gaza war',
    kind: 'The Times of Israel',
    url: 'https://www.timesofisrael.com/full-text-of-oct-9-israel-hamas-deal-on-trumps-plan-for-comprehensive-end-to-gaza-war/',
  },
  {
    id: 'npr-next-steps',
    label: 'Once the Gaza ceasefire goes into effect, what happens next? Here’s what to know',
    kind: 'NPR',
    url: 'https://www.npr.org/2025/10/09/g-s1-92729/gaza-ceasefire-israel-hamas-next-steps',
  },
  {
    id: 'aj-summit',
    label: 'World leaders gather in Egypt for signing of Gaza ceasefire deal',
    kind: 'Al Jazeera',
    url: 'https://www.aljazeera.com/news/2025/10/13/world-leaders-gather-in-egypt-for-signing-of-gaza-ceasefire-deal',
  },
  {
    id: 'cbs-hostages',
    label: '20 living hostages were just released by Hamas under the ceasefire deal. Here’s who they are.',
    kind: 'CBS News',
    url: 'https://www.cbsnews.com/news/israel-hostages-released-by-hamas-who-they-are/',
  },
  /* The Council's own record of the adoption, added beside the encyclopedia
     entry rather than in place of it: the vote this page prints is a fact the
     Council itself published, and a resolution is one of the few claims here
     whose primary source is a single fetchable document. Whether Wikipedia
     stays the sourcing basis elsewhere is an owner decision, not this file's
     — see `.ai/DECISIONS.md`, 2026-08-25. */
  {
    id: 'un-sc-2803',
    label:
      'Security Council authorizes International Stabilization Force in Gaza, adopting resolution 2803 (2025) — SC/16225, 17 November 2025',
    kind: 'UN record',
    url: 'https://press.un.org/en/2025/sc16225.doc.htm',
  },
  {
    id: 'wiki-unsc-2803',
    label: 'United Nations Security Council Resolution 2803',
    kind: 'Wikipedia',
    url: 'https://en.wikipedia.org/wiki/United_Nations_Security_Council_Resolution_2803',
  },
  {
    id: 'aj-six-months',
    label: '‘Neither war nor peace’: What Gaza looks like six months into ‘ceasefire’',
    kind: 'Al Jazeera',
    url: 'https://www.aljazeera.com/news/2026/4/10/neither-war-nor-peace-what-gaza-looks-like-six-months-into-ceasefire',
  },
  {
    id: 'cnn-disarmament',
    label: 'Trump announces a breakthrough in Gaza — but there are major caveats. Here’s what we know',
    kind: 'CNN',
    url: 'https://www.cnn.com/2026/07/31/middleeast/trump-hamas-disarmament-announcement-intl',
  },
];

const bySourceId = (id: string): Source => {
  const found = SOURCES.find((source) => source.id === id);
  if (!found) throw new Error(`war-update: unknown source id "${id}"`);
  return found;
};

const ENTRIES: TimelineEntry[] = [
  {
    id: 'plan-announced',
    datetime: '2025-09-29',
    dateLabel: 'Sept 29, 2025',
    category: 'Diplomacy',
    assessment: VERIFIED,
    title: 'A 20-point plan for Gaza is presented at the White House',
    body: 'U.S. President Donald Trump and Israeli Prime Minister Benjamin Netanyahu present a twenty-point plan framed as a comprehensive end to the war — the roadmap that the ceasefire signed eleven days later is built on.',
    sources: [bySourceId('aj-plan-announced'), bySourceId('toi-full-text')],
  },
  {
    id: 'ceasefire-signed',
    datetime: '2025-10-09',
    dateLabel: 'Oct 9, 2025',
    category: 'Diplomacy',
    assessment: VERIFIED,
    title: 'Israel and Hamas sign a ceasefire-hostage agreement in Sharm el-Sheikh',
    body: 'The agreement covers a phased release of hostages and Palestinian detainees, an Israeli withdrawal from parts of Gaza, a surge in humanitarian aid, and the return of displaced Gazans to their home areas.',
    sources: [bySourceId('toi-full-text'), bySourceId('npr-next-steps')],
  },
  {
    id: 'ceasefire-effective',
    datetime: '2025-10-10',
    dateLabel: 'Oct 10, 2025',
    category: 'Front · Home front',
    assessment: VERIFIED,
    title: 'The ceasefire takes effect',
    body: 'A formal ceasefire begins across Gaza. A peace summit follows on October 13 in Sharm El Sheikh to open implementation of the agreement’s first phase.',
    sources: [bySourceId('npr-next-steps'), bySourceId('aj-summit')],
  },
  {
    id: 'hostages-released',
    datetime: '2025-10-13',
    dateLabel: 'Oct 13, 2025',
    category: 'Hostages',
    assessment: VERIFIED,
    title: 'All 20 remaining living hostages are released within 72 hours',
    body: 'Hamas releases all 20 living hostages still held in Gaza within three days of the ceasefire taking effect, in exchange for the release of Palestinian prisoners under the agreement’s terms.',
    sources: [bySourceId('cbs-hostages')],
  },
  {
    id: 'unsc-2803',
    datetime: '2025-11-17',
    dateLabel: 'Nov 17, 2025',
    category: 'Diplomacy',
    assessment: VERIFIED,
    title: 'The UN Security Council adopts Resolution 2803, establishing the Board of Peace',
    body: 'The Council votes 13 in favor with two abstentions (China and Russia). The resolution endorses the October ceasefire plan, welcomes the formation of a Board of Peace as a transitional governing body for Gaza, and authorizes deployment of an International Stabilization Force.',
    sources: [bySourceId('un-sc-2803'), bySourceId('wiki-unsc-2803')],
  },
  {
    id: 'six-months',
    datetime: '2026-04-10',
    dateLabel: 'Apr 10, 2026',
    category: 'Humanitarian',
    assessment: VERIFIED,
    title: 'Six months in, reporting describes conditions as “neither war nor peace”',
    body: 'Coverage marking six months since the ceasefire describes the situation on the ground as fragile — violence reduced but not ended, and little tangible improvement in humanitarian or security conditions for Palestinian civilians.',
    sources: [bySourceId('aj-six-months')],
  },
  {
    id: 'disarmament-breakthrough',
    datetime: '2026-07-31',
    dateLabel: 'Jul 31, 2026',
    category: 'Diplomacy',
    assessment: VERIFIED,
    title: 'The Board of Peace announces a conditional Hamas disarmament agreement',
    body: 'Officials describe a "conditions-based" agreement for the staged disarmament of Hamas and other armed groups. A senior Hamas official says the group will not begin any weapons-related step until Israel halts fire, stops targeted killings, and withdraws to the agreed line — sequencing that, as reported, remains unresolved.',
    sources: [bySourceId('cnn-disarmament')],
  },
];

const EDITION: WarUpdateEdition = {
  edition: 'Reference edition 001',
  coverageWindow: 'Sept 2025 – Jul 2026',
  publishedAt: 'Aug 25, 2026',
  reviewedBy: 'Editorial desk',
  sourceCount: SOURCES.length,
  trustStrip:
    'Every entry here is a dated, sourced, already-documented milestone — not a live front-line feed. The sourcing and correction standard behind it is on the Methodology page.',
  entries: ENTRIES,
  sources: SOURCES,
  corrections: [],
};

/**
 * The frontend's view of War Update content. Returns the local reference
 * edition today; a future version can source the same shape from
 * `GET /api/v1/published-items` once that endpoint carries a filter for
 * which items belong on this page.
 */
export async function getWarUpdateEdition(): Promise<WarUpdateEdition> {
  return EDITION;
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
export const warUpdateEdition: WarUpdateEdition = EDITION;
