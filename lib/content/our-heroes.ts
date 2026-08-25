/**
 * Our Heroes — seam for real, sourced profiles.
 *
 * This site has no family-consent workflow yet, so nothing here is a
 * submission or a memorial built with a family. Every profile is
 * constructed only from what is already extensively reported by named,
 * mainstream press — the subject or their family has already chosen to
 * make the story public, on the record, more than once. No detail beyond
 * what's cited exists here. See `.ai/DECISIONS.md` for the boundary this
 * follows and why a future addition must hold to it too.
 */
import type { Source } from '@/components/content';

export type HeroRole = 'Fallen' | 'Rescuer' | 'Fighter';

export type HeroProfile = {
  id: string;
  name: string;
  role: HeroRole;
  meta: string;
  summary: string;
  sources: Source[];
};

export type OurHeroesEdition = {
  publishedAt: string;
  reviewedBy: string;
  featured: HeroProfile;
  profiles: HeroProfile[];
};

const PROFILES: HeroProfile[] = [
  {
    id: 'aner-shapira',
    name: 'Aner Elyakim Shapira',
    role: 'Fallen',
    meta: '22 · Nova music festival, Re’im',
    summary:
      'Sheltering with roughly two dozen others in a roadside shelter during the attack on the Nova festival, Shapira stood by the entrance and threw back seven grenades that were hurled in by Hamas gunmen. The eighth exploded in his hands, killing him. At least seven people who sheltered with him survived.',
    sources: [
      {
        id: 'wiki-shapira',
        label: 'Killing of Aner Shapira',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Killing_of_Aner_Shapira',
      },
      {
        id: 'toi-shapira',
        label: 'Staff Sgt. Aner Shapiro, 22: Unarmed, he fended off 7 grenades',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/staff-sgt-aner-elyakim-shapiro-22-unarmed-he-fended-off-7-grenades/',
      },
    ],
  },
  {
    id: 'rami-davidian',
    name: 'Rami Davidian',
    role: 'Rescuer',
    meta: 'Farmer, Moshav Patish',
    summary:
      'A farmer whose moshav sits minutes from the Nova festival grounds, Davidian drove into the attack zone at dawn on October 7 after a call about a friend’s son, and kept driving back — packing his car past capacity each trip — until he had ferried an estimated 700 or more people to safety. He now speaks publicly about that day, including at universities in the United States.',
    sources: [
      {
        id: 'duke-davidian',
        label: 'Rami Davidian recounts saving over 700 people during Oct. 7 attacks',
        kind: 'The Duke Chronicle',
        url: 'https://dukechronicle.com/article/duke-university-rami-davidian-rescued-700-people-october-7-2023-attacks-hamas-provosts-intiative-on-the-middle-east-millet-ben-haim-nova-music-festival-20241119',
      },
      {
        id: 'jns-davidian',
        label: 'Farmer hero saved scores while Hamas massacred 364 at music festival',
        kind: 'JNS',
        url: 'https://www.jns.org/farmer-hero-saved-scores-while-hamas-massacred-364-at-music-festival/',
      },
    ],
  },
  {
    id: 'noam-tibon',
    name: 'Maj.-Gen. (ret.) Noam Tibon',
    role: 'Fighter',
    meta: 'Retired, Israel Defense Forces',
    summary:
      'On the morning of October 7, Tibon and his wife drove from Tel Aviv toward Kibbutz Nahal Oz after their son, journalist Amir Tibon, texted that gunmen were inside the community. Along the way and once inside the kibbutz, Tibon organized and led an ad hoc rescue effort — fighting alongside soldiers he gathered en route — before reaching and extracting his son’s family.',
    sources: [
      {
        id: 'toi-tibon',
        label: 'How Haaretz’s Amir Tibon and family were rescued by his dad, retired general Noam Tibon',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/how-haaretzs-amir-tibon-and-family-were-rescued-by-his-dad-retired-general-noam-tibon/',
      },
      {
        id: 'cbs-tibon',
        label: 'How a retired Israeli general saved his family during the Hamas attack',
        kind: 'CBS News, 60 Minutes',
        url: 'https://www.cbsnews.com/news/retired-idf-general-israeli-family-rescue-60-minutes/',
      },
    ],
  },
];

const EDITION: OurHeroesEdition = {
  publishedAt: 'Aug 25, 2026',
  reviewedBy: 'Editorial desk',
  featured: PROFILES[0],
  profiles: PROFILES.slice(1),
};

export async function getOurHeroesEdition(): Promise<OurHeroesEdition> {
  return EDITION;
}
