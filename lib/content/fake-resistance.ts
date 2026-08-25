/**
 * Fake Resistance — case-file seam.
 *
 * Same convention as `lib/content/war-update.ts`: a local, hand-sourced
 * module today, swappable later without touching call sites. Every case below
 * was chosen and verified in the authoring session for being multiply
 * corroborated and non-controversial in its mechanics — recycled or
 * out-of-context footage, not a contested claim about casualties or intent.
 * A case that turns out to touch a live dispute (a real death, a contested
 * attribution) does not belong here without much heavier sourcing than a
 * single pass affords; see `.ai/DECISIONS.md` for why one originally briefed
 * case was dropped in favor of a cleaner substitute.
 *
 * `archiveUrl` values were fetched and confirmed live against the Wayback
 * Machine's availability API (archive.org/wayback/available) in the session
 * that added them — real snapshots, not guessed URLs.
 */
import type { AssessmentValue } from '@/server/contracts/enums';
import type { Source } from '@/components/content';

export type FakeResistanceCase = {
  id: string;
  title: string;
  dateLabel: string;
  datetime: string;
  claim: string;
  origin: string;
  amplification: string;
  record: string;
  verdict: AssessmentValue;
  tells: string[];
  sources: Source[];
};

export type FakeResistanceEdition = {
  edition: string;
  publishedAt: string;
  reviewedBy: string;
  sourceCount: number;
  cases: FakeResistanceCase[];
};

const CASES: FakeResistanceCase[] = [
  {
    id: 'arma3-footage',
    title: 'Video-game footage passed off as combat video',
    dateLabel: 'Oct 2023',
    datetime: '2023-10-12',
    claim:
      'Clips shared widely on TikTok and X in the days after October 7, 2023 — one flagged post alone drew more than 3 million views — were captioned as real footage of the fighting between Israel and Hamas.',
    origin:
      'The footage was not war video. It was gameplay recorded from Arma 3, a military simulation game released by Bohemia Interactive in 2013 — a decade before the war it was being used to illustrate.',
    amplification:
      'Clips spread rapidly across TikTok and X in the immediate aftermath of October 7, riding the same surge of search traffic that made any dramatic-looking military footage likely to be reshared uncredited.',
    record:
      'Bohemia Interactive issued its own statement confirming that footage from its game was being falsely presented as real conflict footage. BBC Verify’s Shayan Sardarizadeh independently identified and flagged specific Arma 3 clips being circulated as combat video.',
    verdict: 'false',
    tells: [
      'Imagery that reverse-image and reverse-video search traces to a different time and place.',
      'Synchronized timing — the claim erupting everywhere at once in the days right after October 7.',
    ],
    sources: [
      {
        id: 'axios-arma3',
        label: 'Video game footage used to spread misinformation about Israel-Hamas war',
        kind: 'Axios',
        url: 'https://www.axios.com/2023/10/12/arma3-israel-hamas-conflict-fake-news',
        archiveUrl:
          'https://web.archive.org/web/20260415222407/https://www.axios.com/2023/10/12/arma3-israel-hamas-conflict-fake-news',
      },
    ],
  },
  {
    id: 'haifa-video',
    title: 'A Haifa evacuation video recaptioned as an infiltration',
    dateLabel: 'Oct 2023',
    datetime: '2023-10-13',
    claim:
      'A video showing people rushing out of their homes in Haifa was shared with a caption claiming it showed Hezbollah militants who had infiltrated northern Israel.',
    origin:
      'The footage itself was genuine — recorded in Haifa during the war’s first days. What it showed was residents responding to a siren and moving toward shelter, not an infiltration.',
    amplification:
      'The false caption spread on X in the same window as a wider wave of siren and evacuation footage from northern Israel being reframed as evidence of ground incursions.',
    record:
      'BBC Verify’s senior verification journalist Shayan Sardarizadeh identified and corrected the claim, describing the clip as genuine evacuation footage misattributed to an infiltration that the video does not show.',
    verdict: 'out_of_context',
    tells: [
      'Imagery that reverse-image search traces to a different time and place than the caption claims.',
    ],
    sources: [
      {
        id: 'reuters-institute-bbc',
        label: 'BBC senior verification expert on debunking Israel-Hamas war visuals',
        kind: 'Reuters Institute for the Study of Journalism, University of Oxford',
        url: 'https://reutersinstitute.politics.ox.ac.uk/news/bbc-expert-debunking-israel-hamas-war-visuals-volume-misinformation-twitter-was-beyond',
        archiveUrl:
          'https://web.archive.org/web/20260809062542/https://reutersinstitute.politics.ox.ac.uk/news/bbc-expert-debunking-israel-hamas-war-visuals-volume-misinformation-twitter-was-beyond',
      },
    ],
  },
  {
    id: 'empty-place-film',
    title: 'A 2022 short film mislabeled as staged Hamas propaganda',
    dateLabel: 'Oct 2023',
    datetime: '2023-10-10',
    claim:
      'Instagram posts in October 2023 claimed a video showed Hamas militants "dressing up as Jewish soldiers" to fabricate propaganda footage from the war.',
    origin:
      'The clip was behind-the-scenes footage from "Empty Place," a short film directed by Awni Eshtaiwe and released on YouTube in April 2022 — eighteen months before the war it was later attributed to. The film dramatizes the true story of Ahmad Manasra, a Palestinian boy convicted in 2015 of attempted stabbing; the clip shows cast and crew preparing a scene.',
    amplification:
      'The claim circulated on Instagram alongside a broader wave of October 2023 posts recycling pre-war footage as fabricated "crisis actor" or staged-propaganda evidence.',
    record:
      'PolitiFact traced the clip to Eshtaiwe’s 2022 film, with the director confirming the footage’s origin, and rated the propaganda claim False. A similar claim about the same source footage had already been fact-checked by Reuters in 2022, before the war began.',
    verdict: 'false',
    tells: [
      'Imagery that reverse-image search traces to a different time and place — in this case eighteen months before the war it was attributed to.',
    ],
    sources: [
      {
        id: 'politifact-empty-place',
        label: 'Behind-the-scenes footage of a short film isn’t Hamas propaganda, as some recent social media posts claim',
        kind: 'PolitiFact',
        url: 'https://www.politifact.com/factchecks/2023/oct/10/instagram-posts/behind-the-scenes-footage-of-short-film-isnt-hamas/',
        archiveUrl:
          'https://web.archive.org/web/20260813183820/https://politifact.com/factchecks/2023/oct/10/instagram-posts/behind-the-scenes-footage-of-short-film-isnt-hamas/',
      },
    ],
  },
];

const EDITION: FakeResistanceEdition = {
  edition: 'Reference edition 001',
  publishedAt: 'Aug 25, 2026',
  reviewedBy: 'Editorial desk',
  sourceCount: CASES.reduce((total, item) => total + item.sources.length, 0),
  cases: CASES,
};

/**
 * The frontend's view of Fake Resistance case files. Local today; see the
 * module doc comment on the same seam pattern used by `war-update.ts`.
 */
export async function getFakeResistanceEdition(): Promise<FakeResistanceEdition> {
  return EDITION;
}
