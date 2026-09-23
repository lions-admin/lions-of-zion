import type { EditorialMediaReference } from '@/server/contracts/editorial-media';
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
  mediaRef?: EditorialMediaReference;
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
    mediaRef: 'rami-davidian',
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
    mediaRef: 'noam-tibon',
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
  {
    id: 'youssef-ziadna',
    name: 'Youssef Ziadna',
    role: 'Rescuer',
    meta: '47 · Minibus driver, Rahat',
    summary:
      'A Bedouin citizen of Israel who drives a minibus for hire, Ziadna was called by a regular customer as the attack on the Nova festival began and drove directly into it. He packed his 14-seat van far past capacity, cut through dirt roads to avoid the ambushed main route, and made repeated trips, ferrying an estimated 30 people to safety while dodging gunfire.',
    sources: [
      {
        id: 'toi-ziadna',
        label: 'Bedouin bus driver credited with saving 30 Israelis from Hamas’s outdoor party massacre',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/bedouin-bus-driver-credited-with-saving-30-israelis-from-hamass-outdoor-party-massacre/',
      },
      {
        id: 'jta-ziadna',
        label: 'This Bedouin bus driver is credited with saving 30 people from the outdoor party massacre',
        kind: 'Jewish Telegraphic Agency',
        url: 'https://www.jta.org/2023/10/19/israel/this-bedouin-bus-driver-is-credited-with-saving-30-people-from-the-outdoor-party-massacre',
      },
    ],
  },
  {
    id: 'remo-salman-el-hozayel',
    name: 'Sgt. Remo Salman El-Hozayel',
    role: 'Rescuer',
    meta: 'Israel Police, on duty at the Nova festival',
    summary:
      'A Bedouin Muslim police officer from Rahat, El-Hozayel was working his first private-event security shift at the Nova festival when the attack began — and learned within minutes that his own brother had been shot. He spent the following hours packing an abandoned car with festivalgoers and driving them out in repeated trips, credited alongside a colleague and a civilian with getting an estimated 200 people to safety.',
    sources: [
      {
        id: 'jns-el-hozayel',
        label: 'How a Bedouin Muslim saved 200 lives at Nova',
        kind: 'JNS',
        url: 'https://www.jns.org/how-a-bedouin-muslim-saved-200-lives-at-nova/',
      },
      {
        id: 'jc-el-hozayel',
        label: 'Bedouin policeman who saved lives at Nova festival to run Jerusalem Marathon',
        kind: 'The Jewish Chronicle',
        url: 'https://www.thejc.com/news/israel/bedouin-policeman-who-saved-lives-at-nova-festival-to-run-jerusalem-marathon-dwrwdqhp',
      },
    ],
  },
  {
    id: 'amit-mann',
    name: 'Amit Mann',
    role: 'Fallen',
    meta: '22 · Magen David Adom paramedic, Kibbutz Be’eri',
    summary:
      'A Magen David Adom paramedic who dreamed of becoming a doctor, Mann grabbed her medical kit and ran under fire to the Be’eri clinic as terrorists stormed the kibbutz, then spent more than seven hours treating the wounded as the fighting closed in around the building. When the defenders inside ran out of ammunition, she stepped outside with her hands raised in the hope that her role would be recognized; she was shot, and terrorists then threw grenades into the clinic and killed those inside.',
    sources: [
      {
        id: 'toi-mann',
        label: 'Paramedic Amit Mann, 22: Sacrificed herself to protect patients',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/paramedic-amit-mann-22-sacrificed-herself-to-protect-patients/',
      },
      {
        id: 'afmda-mann',
        label: 'Paramedic Amit Mann, 22: Sacrificed herself to protect patients',
        kind: 'American Friends of Magen David Adom',
        url: 'https://afmda.org/news/amit-mann-obit/',
      },
    ],
  },
  {
    id: 'inbal-rabin-lieberman',
    name: 'Inbal Rabin-Lieberman',
    role: 'Fighter',
    meta: '26 · Security coordinator, Kibbutz Nir Am',
    summary:
      'Appointed Nir Am’s civilian security coordinator less than a year earlier, Rabin-Lieberman was woken by the morning’s sirens, opened the kibbutz armory and called her twelve-member security team to arms. Her squad held a three-hour battle at the gate until army forces arrived; Nir Am was one of the few Gaza-border communities Hamas never breached, and none of its residents were killed or taken that day.',
    sources: [
      {
        id: 'jpost-rabin-lieberman',
        label: 'Inbal Rabin-Lieberman: The heroine of Kibbutz Nir Am',
        kind: 'The Jerusalem Post',
        url: 'https://www.jpost.com/israel-news/defense-news/article-767920',
      },
      {
        id: 'wiki-rabin-lieberman',
        label: 'Inbal Rabin-Lieberman',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Inbal_Rabin-Lieberman',
      },
    ],
  },
  {
    id: 'ran-gvili',
    name: 'Master Sgt. Ran Gvili',
    role: 'Fallen',
    meta: '24 · Yasam special patrol unit, Israel Police',
    summary:
      'On medical leave with a broken shoulder, Gvili put on his uniform when the attack began and drove toward the fighting in the western Negev. He fought his way into Kibbutz Alumim, was shot twice and kept fighting until he was killed; his body was taken into Gaza and was not returned to Israel until January 2026, more than two years later.',
    sources: [
      {
        id: 'toi-gvili',
        label: 'Master Sgt. Ran Gvili, 24: Motorcycle-loving cop ‘united the country’',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/master-sgt-ran-gvili-24-motorcycle-loving-cop-united-the-country/',
      },
      {
        id: 'wiki-gvili',
        label: 'Ran Gvili',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Ran_Gvili',
      },
    ],
  },
  {
    id: 'awad-darawshe',
    name: 'Awad Darawshe',
    role: 'Fallen',
    meta: '23 · Paramedic, Yossi Ambulances, Iksal',
    summary:
      'An Arab citizen of Israel from the village of Iksal, Darawshe was one of the paramedics posted to the medical tent at the Nova festival. When the station’s leader ordered the team to evacuate, he refused to leave the people he was treating, and was shot dead while bandaging a wounded festivalgoer. His ambulance was taken into Gaza. Israel’s Foreign Ministry called him a hero.',
    sources: [
      {
        id: 'toi-darawshe',
        label: 'Paramedic Awad Darawshe, 23: Killed treating wounded at rave massacre',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/paramedic-awad-darawshe-23-killed-treating-wounded-at-rave-massacre/',
      },
      {
        id: 'ap-darawshe',
        label: 'An Arab paramedic who treated Israelis injured by Hamas militants is remembered as a hero',
        kind: 'Associated Press, via The Hill',
        url: 'https://thehill.com/homenews/ap/ap-international/ap-an-arab-paramedic-who-treated-israelis-injured-by-hamas-militants-is-remembered-as-a-hero/',
      },
    ],
  },
  {
    id: 'elhanan-kalmanson',
    name: 'Capt. (res.) Elhanan Kalmanson',
    role: 'Fallen',
    meta: '41 · Otniel',
    summary:
      'When the attack began, Kalmanson set out from Otniel with his brother Menachem and their nephew Itiel Zohar before any call-up reached them, and drove to Kibbutz Be’eri. Over hours of fighting they went house to house and brought out dozens of residents — more than a hundred, by their team’s account. On the morning of October 8, clearing one more house, Kalmanson was ambushed and killed. The group, known as “Team Elhanan”, was awarded the Israel Prize for civilian heroism.',
    sources: [
      {
        id: 'toi-kalmanson',
        label: 'Cpt. Elhanan Kalmanson, 41: Family man who saved dozens of lives',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/capt-elhanan-kalmanson-41-family-man-who-saved-dozens-of-lives/',
      },
      {
        id: 'ynet-kalmanson',
        label: 'Winners of Israel Prize for civic heroism saved dozens in Kibbutz Be’eri on October 7',
        kind: 'Ynet News',
        url: 'https://www.ynetnews.com/article/bjbh6bva6',
      },
    ],
  },
  {
    id: 'salman-habaka',
    name: 'Lt. Col. Salman Habaka',
    role: 'Fallen',
    meta: '33 · Commander, 53rd Battalion, Yanuh-Jat',
    summary:
      'A Druze officer from Yanuh-Jat in the Galilee, Habaka drove south on October 7, took tanks from a base near Tze’elim and brought them into Kibbutz Be’eri, where he was among the first forces to fight their way into the community and free residents held by the attackers. Less than four weeks later, on November 2, he was killed in battle in the northern Gaza Strip — the most senior officer to fall in the ground operation up to that point.',
    sources: [
      {
        id: 'toi-habaka',
        label: 'Lt. Col. Salman Habaka, 33: Responded to Hamas assault; fell in Gaza',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/lt-col-salman-habaka-33-responded-to-hamas-assault-fell-in-gaza/',
      },
      {
        id: 'ynet-habaka',
        label: 'Lt. Col. Salman Habakah, the hero of Be’eri battles, killed in Gaza',
        kind: 'Ynet News',
        url: 'https://www.ynetnews.com/article/r1gxjxzmp',
      },
    ],
  },
  {
    id: 'karni-gez',
    name: 'Capt. Karni Gez',
    role: 'Fighter',
    meta: 'Company commander, Caracal Battalion',
    summary:
      'Stationed at Nitzana on the Egyptian border, some 40 kilometers south of Gaza, Gez led an all-women tank company north when the attack began, leaving one tank to hold the border and splitting the rest between Kibbutz Holit and Kibbutz Sufa. Her crews fought for 17 hours. The IDF credited them with killing some 50 attackers and halting the assault’s push further south — the first combat in modern history by an all-female armored unit.',
    sources: [
      {
        id: 'toi-gez',
        label: 'Female IDF tank crews ran down dozens of Hamas terrorists on October 7',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/female-idf-tank-crews-ran-down-dozens-of-hamas-terrorists-on-october-7/',
      },
      {
        id: 'wiki-gez',
        label: '2023 Israeli female tank crew fight',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/2023_Israeli_female_tank_crew_fight',
      },
    ],
  },
  {
    id: 'ben-shimoni',
    name: 'Ben Shimoni',
    role: 'Fallen',
    meta: '31 · Nova music festival, Re’im',
    summary:
      'Shimoni got out of the Nova festival by car with four strangers, drove them to Beersheba, and — over their pleas to stay — turned back. He brought out a second group of five and went back again. On his third trip, with Romi Gonen and two others in the car, he ran into an ambush and was killed; Gonen was taken hostage in Gaza. He is credited with saving at least nine people.',
    sources: [
      {
        id: 'toi-shimoni',
        label: 'Ben Shimoni, 31: Music-loving ‘angel’ who saved 9 from Supernova',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/ben-shimoni-31-music-loving-angel-who-saved-9-from-supernova/',
      },
      {
        id: 'wiki-shimoni',
        label: 'Kidnapping of Romi Gonen',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Kidnapping_of_Romi_Gonen',
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
