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

export type HeroRole = 'Fallen' | 'Rescuer' | 'Fighter' | 'Survivor';

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
        kind: 'Ynetnews',
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
        kind: 'Ynetnews',
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
  {
    id: 'yonatan-steinberg',
    name: 'Col. Yonatan Steinberg',
    role: 'Fallen',
    meta: '42 · Commander, Nahal Brigade · near Kerem Shalom',
    summary:
      'Col. Yonatan (Jonathan) Steinberg, 42, of Kibbutz Shomria, commanded the IDF’s Nahal Brigade. On October 7 he was on his way to clashes being managed by his subordinates near Kerem Shalom when he encountered a terrorist and was killed. He was the first soldier killed that day whose name the IDF cleared for publication, and one of the most senior Israeli officers killed in combat in recent memory. He was buried on Mount Herzl and left his wife, Yisca, and six children.',
    sources: [
      {
        id: 'toi-steinberg',
        label: 'Col. Jonathan Steinberg, 42: Commander and consummate family man',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/col-jonathan-steinberg-42-let-us-carry-on-his-legacy/',
      },
      {
        id: 'wikipedia-steinberg',
        label: 'Yonatan Steinberg',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Yonatan_Steinberg',
      },
    ],
  },
  {
    id: 'roi-levy',
    name: 'Col. Roi Levy',
    role: 'Fallen',
    meta: '44 · Commander, Multidomain (‘Ghost’) Unit · Kibbutz Re’im',
    summary:
      'Col. Roi Yosef Levy, 44, commanded the IDF’s Multidomain Unit, known as the Ghost Unit. On October 7 he led his forces into Kibbutz Re’im to reach residents besieged in their homes, and was killed in the fighting; by the IDF’s account, about ten terrorists were killed in the exchange. Born in the United States, he immigrated to Israel as a small child. He had been severely wounded in Gaza City’s Shejaiya neighbourhood in 2014 and returned to combat command after a long rehabilitation.',
    sources: [
      {
        id: 'toi-levy',
        label: 'Col. Roi Levy, 44: Wounded, rehabilitated, returned to fight',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/col-roi-levy-44-wounded-rehabilitated-returned-to-fight-and-killed/',
      },
      {
        id: 'wikipedia-levy',
        label: 'Roi Levy',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Roi_Levy',
      },
    ],
  },
  {
    id: 'asaf-hamami',
    name: 'Col. Asaf Hamami',
    role: 'Fallen',
    meta: '41 · Commander, Gaza Division Southern Brigade · Kibbutz Nirim',
    summary:
      'Col. Asaf Hamami, commander of the Gaza Division’s Southern Brigade, was killed on the morning of October 7 fighting Hamas terrorists in Kibbutz Nirim, and his body was taken into Gaza. For eight weeks he was considered a hostage, until the IDF announced in December 2023 that he had been killed that day. He was the highest-ranking officer whose body was held in Gaza. His remains were returned on November 2, 2025, and he was buried at Kiryat Shaul military cemetery in Tel Aviv two days later.',
    sources: [
      {
        id: 'toi-hamami',
        label: 'Col. Asaf Hamami, 40: Witty commander ‘did not hesitate for a moment’',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/col-asaf-hamami-41-witty-commander-did-not-hesitate-for-a-moment/',
      },
      {
        id: 'jns-hamami',
        label: 'Thousands pay final respects as IDF colonel laid to rest after return from Gaza',
        kind: 'JNS',
        url: 'https://www.jns.org/israel-news/thousands-pay-final-respects-as-idf-colonel-laid-to-rest-after-return-from-gaza',
      },
    ],
  },
  {
    id: 'jayar-davidov',
    name: 'Jayar Davidov',
    role: 'Fallen',
    meta: 'Commander, Rahat police station · Re’im',
    summary:
      'Jayar Davidov commanded the Rahat police station. On October 7, told that officers under his command were fighting infiltrators near Re’im, he left his home in Beersheba to join them; reports say he and his team reached the area before IDF soldiers arrived. He was wounded, and before he could be evacuated the vehicle he was in was hit by an RPG, killing him and other officers. Police Commissioner Kobi Shabtai remembered him as a man who “always had a sparkle in his eye.”',
    sources: [
      {
        id: 'toi-davidov',
        label: 'Police Commander Jayar Davidov, 44: ‘Always had a sparkle in his eye’',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/police-commander-jayar-davidov-44-always-had-a-sparkle-in-his-eye/',
      },
      {
        id: 'wikipedia-davidov',
        label: 'Jayar Davidov',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Jayar_Davidov',
      },
    ],
  },
  {
    id: 'itzik-buzukashvili',
    name: 'Itzik Buzukashvili',
    role: 'Fallen',
    meta: '44 · Commander, Segev Shalom police station · Re’im',
    summary:
      'Itzik “Bazuka” Buzukashvili, 44, commanded the Segev Shalom police station. On October 7 he spent hours on the front lines around the Re’im area, fighting alongside his daughter and, by Haaretz’s account, returning four times to bring out people from the Nova party site. He then set out to evacuate his wounded friend, Rahat station commander Jayar Davidov. Their vehicle was hit by an RPG fired by Hamas and Buzukashvili was killed; Davidov also died.',
    sources: [
      {
        id: 'toi-buzukashvili',
        label: 'Commander Itzik Buzukashvili, 44: Battled terrorists with daughter',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/commander-itzik-buzukashvili-44-battled-terrorists-with-daughter/',
      },
      {
        id: 'haaretz-buzukashvili',
        label: '‘Please, Bazooka, Save Us’: Chilling Oct. 7 Recordings of Hero Who Saved Lives – and Lost His Own',
        kind: 'Haaretz',
        url: 'https://www.haaretz.com/jewish/holidays/memorial-day/2025-04-30/ty-article-magazine/.premium/please-bazooka-save-us-chilling-oct-7-recordings-of-hero-who-died-saving-lives/00000196-8285-d9ad-a19e-c69568ef0000',
      },
    ],
  },
  {
    id: 'yossi-tahar',
    name: 'Yossi Tahar',
    role: 'Fallen',
    meta: '39 · Shin Bet officer · Kibbutz Mefalsim',
    summary:
      'Yosef Hai “Yossi” Tahar, 39, of Bitzaron, was deputy head of a unit in the Shin Bet’s operations division. On October 7 he headed toward the front lines; when a comrade was seriously wounded, he got him onto a helicopter to hospital, saving his life. He then went to Kibbutz Mefalsim, where a firefight was under way, and fought several Hamas gunmen until he was shot dead outside the kibbutz. He left his wife, Liat, and four children.',
    sources: [
      {
        id: 'toi-tahar',
        label: 'Yossi Tahar, 39: Shin Bet officer and dad of 4 was a ‘super-warrior’',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/yossi-tahar-39-shin-bet-officer-and-dad-of-4-was-a-super-warrior/',
      },
      {
        id: 'ynet-tahar',
        label: 'Yossi Hai Tahar',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/gal-hed/article/rjekaeydwx',
      },
    ],
  },
  {
    id: 'avi-buzaglo',
    name: 'Master Sgt. Avi Buzaglo',
    role: 'Fallen',
    meta: '26 · Police detective, Rahat station · Ofakim',
    summary:
      'Avi Buzaglo, 26, a detective at the Rahat police station and a former Duvdevan soldier, was at home in Ofakim when the attack began. Hearing automatic fire, he took his weapon and went out to the main road, where he joined an off-duty soldier, Itamar Hadad, and an armed civilian, Itzhak Balti. The three fought the terrorists, killing two of them by Kan’s account, until Buzaglo and Balti were killed and Hadad was seriously wounded; Hadad survived.',
    sources: [
      {
        id: 'toi-buzaglo',
        label: 'Master Sgt. Avi Buzaglo, 26: Police officer slain defending hometown',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/master-sgt-avi-buzaglo-26-police-officer-slain-defending-hometown/',
      },
      {
        id: 'kan-buzaglo',
        label: 'The story of Hadad Family from Ofakim on October 7',
        kind: 'Kan 7.10.360',
        url: 'https://www.710360.kan.org.il/en/ofakim/hadad',
      },
    ],
  },
  {
    id: 'yaakov-krasniansky',
    name: 'First Sgt. Yaakov Krasniansky',
    role: 'Fallen',
    meta: '23 · Border Police undercover team · Kibbutz Nahal Oz',
    summary:
      'Yaakov Krasniansky, 23, a formerly Haredi Jerusalemite, commanded a Border Police undercover team. On October 7 he and other officers fought alongside the Nahal Oz civilian security squad against the terrorists who invaded the kibbutz, helping to stop the first wave before the army arrived hours later. He was killed in the fighting; his body was found together with the bodies of five terrorists.',
    sources: [
      {
        id: 'toi-krasniansky',
        label: 'First Sgt. Yaakov Krasniansky, 23: Cop showed ‘heroism of spirit’',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/staff-sgt-yaakov-krasniansky-showed-heroism-of-spirit-and-soul/',
      },
      {
        id: 'wikipedia-krasniansky',
        label: 'Nahal Oz attack',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Nahal_Oz_attack',
      },
    ],
  },
  {
    id: 'dolev-yehud',
    name: 'Dolev Yehud',
    role: 'Fallen',
    meta: '35 · Volunteer paramedic · Kibbutz Nir Oz',
    summary:
      'Dolev Yehud, 35, of Kibbutz Nir Oz, was a volunteer paramedic with United Hatzalah and Magen David Adom. When terrorists overran the kibbutz on October 7, he left his pregnant wife and three children in the family’s safe room and went out to try to save lives, and was killed. He was at first believed to have been taken to Gaza; in June 2024 the IDF identified his remains, found in Nir Oz. His daughter, born days after the attack, was named Dor.',
    sources: [
      {
        id: 'ynet-yehud',
        label: 'Body of presumed hostage Dolev Yehoud, killed on October 7, discovered in Kibbutz Nir Oz',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/article/r1gwn054r',
      },
      {
        id: 'jns-yehud',
        label: 'Dolev Yehud’s body found at Kibbutz Nir Oz',
        kind: 'JNS',
        url: 'https://www.jns.org/dolev-yehuds-body-found-at-kibbutz-nir-oz/',
      },
    ],
  },
  {
    id: 'alim-abdallah',
    name: 'Lt. Col. Alim Abdallah',
    role: 'Fallen',
    meta: '40 · Deputy commander, 300th Brigade · Lebanon border, 9 October 2023',
    summary:
      'Lt. Col. Alim Abdallah, 40, from the Druze village of Yanuh-Jat, was deputy commander of the IDF’s 300th “Baram” Regional Brigade. On October 9, 2023, two days after the Hamas attack, he responded to an infiltration alert on the Lebanon border and was killed in a gun battle with the infiltrators. He had served close to 23 years and was a week from completing his service. He left a wife and three children.',
    sources: [
      {
        id: 'toi-abdallah',
        label: 'Lt. Col. Alim Abdallah, 40: Druze commander killed near Lebanon',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/lt-col-alim-abdallah-40-druze-commander-killed-near-lebanon/',
      },
      {
        id: 'ynet-abdallah',
        label: 'Israel names Lt. Col. Alim Abdallah as soldier killed in Lebanon border clash',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/article/rjyg9wgbt',
      },
    ],
  },
  {
    id: 'rachel-edri',
    name: 'Rachel Edri',
    role: 'Rescuer',
    meta: 'Resident, Ofakim',
    summary:
      'On October 7, 2023, gunmen broke into Rachel Edri’s home in Ofakim and held her and her husband, David, hostage. During the stand-off, which lasted about 20 hours by Wikipedia’s account, she talked with the captors and offered them drinks and food, including her homemade cookies, in what is described as an effort to buy time until rescue forces arrived. Security forces ended the siege and freed the couple. She later became a national symbol of resilience in Israel.',
    sources: [
      {
        id: 'wikipedia-edri',
        label: 'Rachel Edry hostage stand-off',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Rachel_Edry_hostage_stand-off',
      },
      {
        id: 'ynet-edri',
        label: '‘I want to go back’: Heroic October 7 survivor Rachel Edri rejects turning her home into a museum',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/magazine/article/sktsfuw1je',
      },
    ],
  },
  {
    id: 'ilan-fiorentino',
    name: 'Ilan Fiorentino',
    role: 'Fallen',
    meta: '38 · Security coordinator, Kibbutz Nahal Oz',
    summary:
      'Ilan Fiorentino was born in Nahal Oz and had led the kibbutz’s local security team since 2015. On October 7, 2023, he fought the Hamas-led attackers at the kibbutz’s rear gate and was killed there. Residents credit him with slowing the attackers long enough for families to lock themselves in their safe rooms. He was posthumously recognised as a fallen soldier with the rank of sergeant major in the reserves, and is survived by his wife and three daughters.',
    sources: [
      {
        id: 'toi-fiorentino',
        label: 'Ilan Fiorentino, 38: Kibbutz security chief who was a ‘200% dad’',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/ilan-fiorentino-38-kibbutz-security-chief-who-was-a-200-dad/',
      },
      {
        id: 'inn-fiorentino',
        label: 'Heroic civilian security officer Ilan Fiorentino z"l laid to rest in Kibbutz Nahal Oz',
        kind: 'Israel National News',
        url: 'https://www.israelnationalnews.com/flashes/682927',
      },
    ],
  },
  {
    id: 'tal-eilon',
    name: 'Tal Eilon',
    role: 'Fallen',
    meta: '46 · Civilian defence commander, Kibbutz Kfar Aza',
    summary:
      'Tal Eilon commanded Kfar Aza’s civilian security team and was among the first to mobilise when Hamas-led terrorists broke into the kibbutz on October 7, 2023. He killed three of the attackers before he was killed in the early phase of the fighting, near the kibbutz armoury. Seven members of the kibbutz’s security squad were killed that day. The Defence Ministry retroactively recognised him as a fallen soldier with the rank of sergeant major in the reserves.',
    sources: [
      {
        id: 'toi-eilon',
        label: 'Tal Eilon, 46: Killed three terrorists before falling in battle',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/tal-eilon-46-killed-three-terrorists-before-falling-in-battle/',
      },
      {
        id: 'wikipedia-eilon',
        label: 'Kfar Aza massacre',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Kfar_Aza_massacre',
      },
    ],
  },
  {
    id: 'ofir-libstein',
    name: 'Ofir Libstein',
    role: 'Fallen',
    meta: '50 · Head of Sha’ar HaNegev Regional Council, Kfar Aza',
    summary:
      'Ofir Libstein, head of the Sha’ar HaNegev Regional Council and a resident of Kibbutz Kfar Aza, went out with his weapon on October 7, 2023, to fight the terrorists who had broken into the kibbutz. He was killed in an exchange of fire. He was a member of the local security team and was posthumously recognised as a fallen soldier with the rank of master sergeant in the reserves. His son Nitzan was also killed that day.',
    sources: [
      {
        id: 'wikipedia-libstein',
        label: 'Ofir Libstein',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Ofir_Libstein',
      },
      {
        id: 'toi-libstein',
        label: 'Ofir Libstein, 50: Head of local council killed defending town',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/ofir-libstein-50-head-of-local-council-killed-defending-town/',
      },
    ],
  },
  {
    id: 'tamir-adar',
    name: 'Tamir Adar',
    role: 'Fallen',
    meta: '38 · Deputy security coordinator, Kibbutz Nir Oz',
    summary:
      'Tamir Adar, deputy security coordinator of Kibbutz Nir Oz and a member of its emergency squad, left his home at about 6:30 a.m. on October 7, 2023, after an alert that terrorists had infiltrated the kibbutz. He was killed fighting the attackers and his body was taken to Gaza. His death was confirmed in January 2024. His grandmother Yaffa Adar was also abducted and was freed in November 2023. His body was returned to Israel after 746 days and buried in Nir Oz.',
    sources: [
      {
        id: 'toi-adar',
        label: 'Tamir Adar, part of Nir Oz squad that held off terrorists, is declared dead',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/taken-captive-tamir-adar-part-of-nir-oz-squad-held-off-terrorists/',
      },
      {
        id: 'ynet-adar',
        label: '‘Returned to kibbutz that was his life’s landscape’: slain hostage Tamir Adar laid to rest',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/article/hjls4vw0gl',
      },
    ],
  },
  {
    id: 'ilan-weiss',
    name: 'Ilan Weiss',
    role: 'Fallen',
    meta: '56 · Emergency squad, Kibbutz Be’eri',
    summary:
      'Ilan Weiss was a member of Kibbutz Be’eri’s volunteer emergency response team. On the morning of October 7, 2023, he set out with a key to open the squad’s building and was shot dead. His body was taken to Gaza. His wife, Shiri, and daughter Noga were abducted and released in November 2023. After 693 days, an Israel Defense Forces and Israel Security Agency operation recovered his body from Gaza.',
    sources: [
      {
        id: 'toi-weiss',
        label: 'IDF recovers body of slain hostage Ilan Weiss, remains of another captive, from Gaza',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/idf-recovers-body-of-slain-hostage-ilan-weiss-remains-of-another-captive-from-gaza/',
      },
      {
        id: 'ynet-weiss',
        label: 'IDF recovers body of hostage Ilan Weiss from Gaza',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/article/skrhfeckgg',
      },
    ],
  },
  {
    id: 'avi-korin',
    name: 'Avi Korin',
    role: 'Fallen',
    meta: '56 · Security coordinator, Kibbutz Holit',
    summary:
      'Avi Korin, the Buenos Aires-born security coordinator of Kibbutz Holit, spotted the first gunmen outside the kibbutz at about 6:45 a.m. on October 7, 2023. He was killed fighting them at about 7:10 a.m. The IDF’s investigation found that the kibbutz’s few armed residents faced the attack alone for hours. It praised Korin and his deputy for engaging the enemy and defending the kibbutz ‘with their bodies’.',
    sources: [
      {
        id: 'toi-korin',
        label: 'Kibbutz Holit was left to fight Hamas alone for hours on October 7 -- IDF probe',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/kibbutz-holit-was-left-to-fight-hamas-alone-for-hours-on-october-7-idf-probe/',
      },
      {
        id: 'ynet-korin',
        label: '100 Hamas terrorists, 4 armed civilians and no soldiers: IDF releases Holit Oct. 7 massacre probe',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/article/byaqquna11g',
      },
    ],
  },
  {
    id: 'yaron-shahar',
    name: 'Yaron Shahar',
    role: 'Fallen',
    meta: '51 · Security team, Kibbutz Nir Yitzhak',
    summary:
      'Yaron Shahar was killed on October 7, 2023, confronting dozens of terrorists outside the gate of Kibbutz Nir Yitzhak. He was one of six members of the kibbutz’s 13-strong local security team who were killed that day. According to The Times of Israel, the squad largely prevented the attackers from rampaging through the community. He is survived by his wife, Einat, and three daughters.',
    sources: [
      {
        id: 'toi-shahar',
        label: 'Nir Yitzhak security team resisted terrorists on Oct. 7, preventing murderous rampage',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/nir-yitzhak-security-team-resisted-terrorists-on-oct-7-preventing-murderous-rampage/',
      },
      {
        id: 'wikipedia-shahar',
        label: 'Nir Yitzhak attack',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Nir_Yitzhak_attack',
      },
    ],
  },
  {
    id: 'saar-margolis',
    name: 'Saar Margolis',
    role: 'Fallen',
    meta: '37 · Rapid-response team, Kibbutz Kissufim',
    summary:
      'Saar Margolis had served for years as Kibbutz Kissufim’s security coordinator and was still a member of its rapid-response team. When he heard suspicious sounds on October 7, 2023, he armed his wife, showed her how to lock the safe room and went out with another squad member, Shai Asher. His family says he fought for hours and saved many residents’ lives before he was shot and killed. He was posthumously recognised as a fallen soldier in the reserves.',
    sources: [
      {
        id: 'toi-margolis',
        label: 'Saar Margolis, 37: Dad of two killed while defending Kissufim',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/staff-sgt-res-saar-margolis-37-fell-defending-his-home-in-kissufim/',
      },
      {
        id: 'sajr-margolis',
        label: 'Marathon gunfight takes life of kibbutz hero',
        kind: 'SA Jewish Report',
        url: 'https://www.sajr.co.za/marathon-gunfight-takes-life-of-kibbutz-hero/',
      },
    ],
  },
  {
    id: 'gil-taasa',
    name: 'Gil Taasa',
    role: 'Fallen',
    meta: '46 · Resident, Moshav Netiv HaAsara',
    summary:
      'When terrorists attacked Netiv HaAsara on October 7, 2023, Gil Taasa ran with his two young sons from their house to an outdoor bomb shelter. The attackers threw a grenade into the shelter entrance. Taasa, reported to have shielded the boys with his body, was killed, and both sons survived with shrapnel wounds. His eldest son, Or, was killed the same day in a separate attack at Zikim beach.',
    sources: [
      {
        id: 'toi-taasa',
        label: 'Gil and Or Taasa, 46 & 17: Father, son murdered on same day in two locations',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/gil-and-or-tasa-46-17-father-son-murdered-on-same-day-in-two-locations/',
      },
      {
        id: 'israelhayom-taasa',
        label: 'Netanyahu shows world part of October 7 atrocity footage',
        kind: 'Israel Hayom',
        url: 'https://www.israelhayom.com/2025/08/29/netanyahu-shows-world-part-of-october-7-atrocity-footage/',
      },
    ],
  },
  {
    id: 'israel-chana',
    name: 'Israel Chana',
    role: 'Fallen',
    meta: '30 · Resident, Ofakim',
    summary:
      'Israel Chana, a bank security guard from Ofakim, was out walking with his girlfriend on the morning of October 7, 2023, his 30th birthday, when gunmen entered the town. He went home for his personal weapon and joined about 15 other civilians searching for the attackers. A neighbour said he fought a cell alone, killing one attacker and seriously wounding another and keeping them out of nearby homes, before he was killed.',
    sources: [
      {
        id: 'toi-chana',
        label: 'Israel Chana, 30: Civilian who ‘saved a whole neighborhood’',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/israel-chana-30-civilian-who-saved-a-whole-neighborhood/',
      },
      {
        id: 'wikipedia-chana',
        label: 'Battle of Ofakim',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Battle_of_Ofakim',
      },
    ],
  },
  {
    id: 'ori-danino',
    name: 'Ori Danino',
    role: 'Fallen',
    meta: '25 · Nova music festival, Re’im',
    summary:
      'Ori Danino, an off-duty soldier, was close to escaping the Nova festival on October 7 when he turned back to rescue Omer Shem Tov and siblings Maya and Itay Regev, people he had met hours earlier. Their car was intercepted by Hamas gunmen and all four were taken hostage to Gaza. The Regevs were freed in November 2023 and Shem Tov in February 2025. Danino was one of six hostages killed by their captors in a Gaza tunnel in 2024.',
    sources: [
      {
        id: 'toi-danino',
        label: 'Ori Danino, 25: Off-duty soldier went back to rescue friends at Nova',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/ori-danino-25-off-duty-soldier-went-back-to-rescue-friends-at-nova/',
      },
      {
        id: 'ynet-danino',
        label: 'With hostage’s return, Ori Danino’s final act of heroism is complete',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/magazine/article/r1ww5ay9ye',
      },
    ],
  },
  {
    id: 'oz-davidian',
    name: 'Oz Davidian',
    role: 'Rescuer',
    meta: 'Farmer, Moshav Maslul',
    summary:
      'Oz Davidian, a farmer from Moshav Maslul, drove his pickup truck toward the Nova festival site on October 7 after hearing that young people were fleeing the attack. He is credited with rescuing about 120 people, making some 20 trips between Re’im and the moshavim of Maslul and Patish and taking a different route each time to avoid the gunmen. Dashcam footage from his vehicle, published in November 2023, shows him driving past burnt-out cars and coming under fire.',
    sources: [
      {
        id: 'toi-davidian',
        label: 'Truck dashcam footage shows farmer dodging bullets as he saved 120 from music festival',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/truck-dashcam-footage-shows-farmer-dodging-bullets-as-he-saved-120-from-music-festival/',
      },
      {
        id: 'jpost-davidian',
        label: 'An interview with Oz Davidian, the quiet hero of October 7',
        kind: 'The Jerusalem Post',
        url: 'https://www.jpost.com/israel-hamas-war/article-787314',
      },
    ],
  },
  {
    id: 'nivi-ohana',
    name: 'Nivi Ohana',
    role: 'Rescuer',
    meta: 'Commander, Ofakim police station · Nova festival',
    summary:
      'Nivi Ohana, commander of the Ofakim police station, was the senior police officer at the Nova festival when rockets began falling at about 6:30 a.m. on October 7. Noting the unusually heavy fire, he ordered the event shut down and the crowd dispersed, calling over the loudspeakers alongside the production team. A police investigation credited the early evacuation with saving hundreds of lives and, by its estimate, preventing about 2,000 more deaths and hundreds more abductions.',
    sources: [
      {
        id: 'ynet-ohana',
        label: 'Nova music festival massacre probe: IDF missed warning signs, one cop saved hundreds',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/article/by00khoqpkg',
      },
      {
        id: 'wikipedia-ohana',
        label: 'Nova music festival massacre',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Nova_music_festival_massacre',
      },
    ],
  },
  {
    id: 'bar-kupershtein',
    name: 'Bar Kupershtein',
    role: 'Rescuer',
    meta: '21 · Paramedic and security staff, Nova festival',
    summary:
      'Bar Kupershtein, then 21, was working as a paramedic and security guard at the Nova festival when Hamas attacked on October 7. Instead of escaping, he stayed to treat the wounded and evacuate them from the site, according to his family and supporters, and was abducted to Gaza when he returned for a fourth time. He was released on October 13, 2025, after 738 days in captivity.',
    sources: [
      {
        id: 'wikipedia-kupershtein',
        label: 'Bar Kupershtein',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Bar_Kupershtein',
      },
      {
        id: 'jpost-kupershtein',
        label: 'Paramedic, breadwinner and hero of Nova: Who is hostage Bar Kupershtein? - explainer',
        kind: 'The Jerusalem Post',
        url: 'https://www.jpost.com/israel-news/article-860650',
      },
    ],
  },
  {
    id: 'ron-shemer',
    name: 'Ron Shemer',
    role: 'Fallen',
    meta: '23 · Nova music festival, Re’im',
    summary:
      'Ron Shemer, 23, from Lod, turned down a ride out of the Nova festival on October 7 because his friends Dan and Omer could not run fast or drive. The three took cover in a roadside shelter, where Shemer waited at the entrance. When gunmen threw grenades inside, he shielded his friends with his body and all three were wounded. He then went out toward the attackers and did not return; his body was found a week later near the shelter. Dan Ariel also died of his wounds.',
    sources: [
      {
        id: 'toi-shemer',
        label: 'Ron Shemer, 23: Loved travel and had friends across the globe',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/ron-shemer-23-loved-travel-and-had-friends-across-the-globe/',
      },
      {
        id: 'tablet-shemer',
        label: '‘Now You Are in Heaven, and the Only Thing Left Is Pain’',
        kind: 'Tablet Magazine',
        url: 'https://www.tabletmag.com/sections/community/articles/sigalit-shemer-ron-nova-photo-essay',
      },
    ],
  },
  {
    id: 'debbie-abraham',
    name: 'Sgt. Maj. Debbie Abraham',
    role: 'Fallen',
    meta: '40 · Police officer on duty, Nova festival',
    summary:
      'Dvorah “Debbie” Abraham, 40, a police sergeant major, was on duty securing the Nova festival near Kibbutz Re’im on October 7. By her family’s and witnesses’ accounts reported in the press, she coordinated aid and directed festivalgoers onto dirt paths away from the gunmen, and was shot while shielding people hiding in a small bar. She was killed fighting the attackers. Her family said she could have saved herself at any moment but thought of others first.',
    sources: [
      {
        id: 'toi-abraham',
        label: 'Sgt. Maj. Debbie Abraham, 40: Police officer on duty at rave',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/command-chief-sgt-debbie-abraham-40-police-officer-guarding-rave/',
      },
      {
        id: 'ynet-abraham',
        label: 'Policewoman’s letter turned into chilling prophecy on October 7: ‘Saved hundreds, they shot her first’',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/magazine/article/h1oghrf2el',
      },
    ],
  },
  {
    id: 'neria-sharabi',
    name: 'Neria Sharabi',
    role: 'Fighter',
    meta: 'Infantry soldier · Nova festival, Re’im',
    summary:
      'Neria Sharabi, an infantry soldier, and his brother Daniel were among those who took cover behind a tank near the Nova festival on October 7. With roughly 30 attendees sheltering there, he used weapons found in the tank and later an M-16 taken from a fallen soldier to return fire alongside two other soldiers. For about five hours a reserve officer, Yehonatan Skariszewski, gave the brothers tactical advice by phone until he reached Re’im.',
    sources: [
      {
        id: 'toi-sharabi',
        label: 'Brothers saved dozens at Nova, fighting terrorists with commander’s phoned-in advice',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/brothers-saved-dozens-at-nova-fighting-terrorists-with-commanders-phoned-in-advice/',
      },
      {
        id: 'jns-sharabi',
        label: 'Brothers and survivors: ‘We, the living, have to continue telling their stories’',
        kind: 'JNS',
        url: 'https://www.jns.org/we-the-living-have-to-continue-telling-their-stories/',
      },
    ],
  },
  {
    id: 'daniel-sharabi',
    name: 'Daniel Sharabi',
    role: 'Rescuer',
    meta: 'Combat medic · Nova festival, Re’im',
    summary:
      'Daniel Sharabi, a combat medic, sheltered with his brother Neria behind a tank near the Nova festival on October 7, where about 30 attendees had gathered. While Neria and other soldiers returned fire, Daniel treated the wounded, applying improvised tourniquets during roughly five hours under attack. The brothers are credited with saving dozens of lives. Afterward they founded a non-profit to support survivors and wounded from the festival.',
    sources: [
      {
        id: 'toi-sharabi-d',
        label: 'Brothers saved dozens at Nova, fighting terrorists with commander’s phoned-in advice',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/brothers-saved-dozens-at-nova-fighting-terrorists-with-commanders-phoned-in-advice/',
      },
      {
        id: 'jns-sharabi-d',
        label: 'Brothers and survivors: ‘We, the living, have to continue telling their stories’',
        kind: 'JNS',
        url: 'https://www.jns.org/we-the-living-have-to-continue-telling-their-stories/',
      },
    ],
  },
  {
    id: 'bipin-joshi',
    name: 'Bipin Joshi',
    role: 'Fallen',
    meta: '23 · Nepali agriculture student, Kibbutz Alumim',
    summary:
      'Bipin Joshi arrived from Nepal in September 2023 to study agriculture at Kibbutz Alumim. On October 7 terrorists threw two grenades into the shelter where he hid with fellow Nepali students; he threw one away, and after the second exploded he picked up a grenade and threw it back, according to survivor Himanchal Kattel, who said “He saved our lives.” Joshi was abducted to Gaza and killed in captivity. His body was returned to Israel in October 2025 and cremated in Nepal.',
    sources: [
      {
        id: 'ynet-joshi',
        label: 'He threw a live grenade to save his friends—now he’s a hostage in Gaza',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/article/hkwzvb12jx',
      },
      {
        id: 'jta-joshi',
        label: 'Bipin Joshi was in Israel for 23 days before Oct. 7. This week, he was buried in his native Nepal.',
        kind: 'Jewish Telegraphic Agency',
        url: 'https://www.jta.org/2025/10/22/israel/bipin-joshi-was-in-israel-for-23-days-before-oct-7-this-week-he-was-buried-in-his-native-nepal',
      },
    ],
  },
  {
    id: 'camille-jesalva',
    name: 'Camille Jesalva',
    role: 'Rescuer',
    meta: '31 · Filipino caregiver, Kibbutz Nirim',
    summary:
      'Camille Jesalva, a caregiver from the Philippines, was with her 95-year-old employer, Nitza Hefetz, in Kibbutz Nirim when a Hamas gunman entered their home on October 7. She handed him all the cash in her wallet, NIS 1,500 (about $370), asking him only to leave her plane ticket, and both women survived.',
    sources: [
      {
        id: 'toi-jesalva',
        label: 'Filipino caregiver paid off terrorist, saved herself and 95-year-old employer',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/filipino-caregiver-paid-off-terrorist-saved-herself-and-95-year-old-employer/',
      },
      {
        id: 'jns-jesalva',
        label: 'Filipino caretaker, 31, saves 95-year-old from Hamas terrorist with bribe',
        kind: 'JNS',
        url: 'https://www.jns.org/filipino-caretaker-31-saves-95-year-old-from-hamas-terrorist-with-bribe/',
      },
    ],
  },
  {
    id: 'amer-abu-sabila',
    name: 'Amer Abu Sabila',
    role: 'Fallen',
    meta: '25 · Abu Talul · Sderot',
    summary:
      'Amer Odeh Abu Sabila, a Bedouin from the village of Abu Talul, was in Sderot near the police station on October 7 when he heard Odaya Swissa crying after terrorists shot her husband, Dolev, in their car. He tried to take the driver’s seat and move the car out of the line of fire, and was shot dead alongside Odaya. The couple’s daughters, aged 6 and 3, lay on the floor of the car and were rescued.',
    sources: [
      {
        id: 'toi-abu-sabila',
        label: 'Amer Abu Sabila, 25: Killed trying to save two young girls in Sderot',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/presumed-captive-amer-odeh-abu-sabila-on-guard-duty-in-sderot/',
      },
      {
        id: 'jns-abu-sabila',
        label: 'Sderot woman meets father of Bedouin killed saving her granddaughters on Oct. 7',
        kind: 'JNS',
        url: 'https://www.jns.org/sderot-woman-meets-father-of-bedouin-killed-saving-her-granddaughters-on-oct-7/',
      },
    ],
  },
  {
    id: 'sabitha-baby-and-meera-mohanan',
    name: 'Sabitha Baby and Meera Mohanan',
    role: 'Rescuer',
    meta: 'Home nurses from Kerala, India · Kibbutz Nir Oz',
    summary:
      'Sabitha Baby and Meera Mohanan, home nurses from Kerala, India, were caring for a bedridden woman and her husband, who has Alzheimer’s, in Kibbutz Nir Oz on October 7. For hours they held the metal door of the safe room shut as Hamas gunmen moved through the house, and all four survived. Israel’s embassy in India praised the two women as “Indian superwomen.”',
    sources: [
      {
        id: 'national-baby-mohanan',
        label: 'Indian nurses risked their lives to save elderly Israeli couple from Hamas',
        kind: 'The National',
        url: 'https://www.thenationalnews.com/mena/palestine-israel/2023/10/24/indian-nurses-risked-lives-to-save-elderly-israeli-couple-from-hamas/',
      },
      {
        id: 'outlook-baby-mohanan',
        label: 'Israel Praises 2 Kerala Caregivers For Saving Its Civilians From Hamas, Calls Them ‘Indian Superwoman’',
        kind: 'Outlook India',
        url: 'https://www.outlookindia.com/national/israel-praises-2-kerala-caregivers-for-saving-its-civilians-from-hamas-calls-them-indian-superwoman--news-325356',
      },
    ],
  },
  {
    id: 'angelyn-aguirre',
    name: 'Angelyn Aguirre',
    role: 'Fallen',
    meta: '32 · Filipino caregiver, Kibbutz Kfar Aza',
    summary:
      'Angelyn Aguirre, a newly married caregiver from the Philippines, looked after 86-year-old Nira Ronen in Kibbutz Kfar Aza. When Hamas terrorists entered the kibbutz on October 7, her sister said, Aguirre could have fled but would not leave her employer; she tried to close the safe-room door against the gunmen but was overpowered. The two women were killed side by side. Her remains were flown home to the Philippines for burial.',
    sources: [
      {
        id: 'toi-aguirre',
        label: 'Angelyn Aguirre, 32: Newlywed Filipina caregiver wouldn’t leave patient',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/angelyn-aguirre-32-filipina-caregiver-killed-alongside-her-patient/',
      },
      {
        id: 'inquirer-aguirre',
        label: 'OFW never left patient as Hamas came to kill',
        kind: 'Philippine Daily Inquirer',
        url: 'https://globalnation.inquirer.net/220666/ofw-never-left-patient-as-hamas-came-to-kill',
      },
    ],
  },
  {
    id: 'anula-ratnayaka',
    name: 'Anula Ratnayaka',
    role: 'Fallen',
    meta: '49 · Sri Lankan caregiver, Kibbutz Be’eri',
    summary:
      'Anula Ratnayaka, a mother of two from Sri Lanka, had worked as a caregiver in Israel for ten years and was caring for Eti Mordo, an elderly blind woman, in Kibbutz Be’eri on October 7. By Mordo’s account, Ratnayaka hid her under the bed and went forward to see what was happening, and was shot dead. Mordo survived. Ratnayaka’s body was repatriated to Sri Lanka on October 28, 2023.',
    sources: [
      {
        id: 'toi-ratnayaka',
        label: 'Anula Ratnayaka, 49: Sri Lankan caregiver hid her elderly client',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/anula-ratnayaka-49-sri-lankan-caregiver-hid-her-elderly-client/',
      },
      {
        id: 'khaleej-ratnayaka',
        label: 'Body of Sri Lankan killed in Hamas attack in Israel repatriated',
        kind: 'Khaleej Times',
        url: 'https://www.khaleejtimes.com/world/body-of-sri-lankan-killed-in-hamas-attack-in-israel-repatriated',
      },
    ],
  },
  {
    id: 'hisham-alkarnawi',
    name: 'Hisham Alkarnawi',
    role: 'Rescuer',
    meta: 'Rahat · Kibbutz Be’eri',
    summary:
      'Hisham Alkarnawi, a Bedouin from Rahat, was working at Kibbutz Be’eri on October 7. Fleeing gunmen, he came across Be’eri resident Aya Meydan, who was trying to get home from a bike ride, and hid with her in foliage for hours under fire. Four relatives drove from Rahat to evacuate him, brought them out and sheltered Meydan in their home, and helped dozens of other people escape along the way. Alkarnawi later joined the Israel Police.',
    sources: [
      {
        id: 'toi-alkarnawi',
        label: 'Four Bedouin drove from Rahat to evacuate their cousin in Be’eri; they rescued dozens',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/four-bedouin-drove-from-rahat-to-evacuate-their-cousin-in-beeri-they-rescued-dozens/',
      },
      {
        id: 'jns-alkarnawi',
        label: 'Bedouin who helped rescue lone runner on Oct. 7 is now an Israel Police officer',
        kind: 'JNS',
        url: 'https://www.jns.org/feature/bedouin-who-helped-rescue-lone-runner-on-oct-7-is-now-an-israel-police-officer',
      },
    ],
  },
  {
    id: 'mhamad-el-atrash',
    name: 'Sgt. Maj. Mhamad el-Atrash',
    role: 'Fallen',
    meta: '39 · IDF tracker, Gaza Division · Sawa',
    summary:
      'Sgt. Maj. Mhamad el-Atrash, a Bedouin from the Negev village of Sawa and a father of 13, served as a tracker in the Gaza Division’s Northern Brigade. On October 7 he was killed fighting Hamas terrorists near Nahal Oz and his body was taken to Gaza. His family learned in December 2023 that he was held there, and in June 2024 the IDF announced he had been killed. Hamas returned his body in October 2025.',
    sources: [
      {
        id: 'toi-el-atrash',
        label: 'Mohammed Alatrash, Bedouin father of 13',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/taken-captive-mohammed-altarash-bedouin-father-of-13/',
      },
      {
        id: 'jns-el-atrash',
        label: 'Bedouin IDF tracker confirmed killed on Oct. 7, body taken to Gaza',
        kind: 'JNS',
        url: 'https://www.jns.org/bedouin-idf-tracker-confirmed-killed-on-oct-7-body-taken-to-gaza/',
      },
    ],
  },
  {
    id: 'daniel-rashed',
    name: 'Staff Sgt. Daniel Rashed',
    role: 'Fallen',
    meta: '19 · Golani Brigade · Nahal Oz outpost',
    summary:
      'Staff Sgt. Daniel Rashed, a Druze Golani soldier from Shfaram, was killed on October 7 when Hamas terrorists overran the Nahal Oz army outpost where he was on guard. He had permission to stay off base after a family wedding but returned to his unit a day early. He is described as the first Druze soldier to fall in the war; his aunt wrote that he “fought like a lion.”',
    sources: [
      {
        id: 'toi-rashed',
        label: 'Staff Sgt. Daniel Rashed, 19: Druze soldier who ‘fought like a lion’',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/staff-sgt-daniel-rashed-19-druze-soldier-who-fought-like-a-lion/',
      },
      {
        id: 'ynet-rashed',
        label: 'These are the 12 fallen Druze heroes who gave their life to defend Israel',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/magazine/article/r1s071bxye',
      },
    ],
  },
  {
    id: 'ehsan-daxa',
    name: 'Col. Ehsan Daxa',
    role: 'Fallen',
    meta: '41 · Commander, 401st Armored Brigade · Daliyat al-Karmel',
    summary:
      'Col. Ehsan Daxa, a Druze officer from Daliyat al-Karmel and a veteran of the 2006 Lebanon war, took command of the IDF’s 401st Armored Brigade in 2024. On October 20, 2024, he was killed by an explosive device while leading his brigade’s operation in Jabaliya, in the northern Gaza Strip. He was described as the highest-ranking officer to fall in the ground fighting in Gaza up to that point.',
    sources: [
      {
        id: 'ynet-daxa',
        label: 'IDF 401st Brigade Commander Colonel Ehsan Daxa killed in Gaza operation',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/article/bk1jutfl1e',
      },
      {
        id: 'wikipedia-daxa',
        label: 'Ehsan Daxa',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Ehsan_Daxa',
      },
    ],
  },
  {
    id: 'arnon-zamora',
    name: 'Chief Insp. Arnon Zamora',
    role: 'Fallen',
    meta: '36 · Yamam counterterrorism unit, Nuseirat rescue, June 2024',
    summary:
      'Arnon Zamora, an officer in the Israel Police’s Yamam counterterrorism unit from Sde David near Sderot, commanded the team that rescued three of the four hostages freed from Nuseirat in central Gaza on June 8, 2024. He was critically wounded by Hamas fire during the daylight raid, which freed Noa Argamani, Almog Meir Jan, Shlomi Ziv and Andrey Kozlov after 246 days in captivity, and died of his wounds. The operation was renamed Operation Arnon in his honour. He was survived by his wife and two children.',
    sources: [
      {
        id: 'toi-zamora',
        label: 'Officer dies of wounds from hostage rescue raid in Gaza; entire op renamed in his honor',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/officer-who-fought-hamas-on-oct-7-dies-of-wounds-from-hostage-rescue-raid-in-gaza/',
      },
      {
        id: 'ynet-zamora',
        label: 'Israel Police say commando killed in hostage rescue operation',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/article/rkunwcwsc',
      },
    ],
  },
  {
    id: 'yuval-castleman',
    name: 'Yuval Doron Castleman',
    role: 'Fallen',
    meta: '38 · Jerusalem city entrance attack, November 30, 2023',
    summary:
      'Yuval Castleman, a former police officer, was driving to work in Jerusalem on November 30, 2023 when two Hamas gunmen opened fire at a bus stop at the city’s entrance, killing three people. He stopped his car, drew his pistol and shot at the attackers. Moments later he was shot and killed by an off-duty reservist who mistook him for an attacker; footage showed Castleman had put down his gun and raised his hands. The reservist was later charged with manslaughter.',
    sources: [
      {
        id: 'cnn-castleman',
        label: 'Yuval Castleman: Backlash grows over police shooting of Israeli civilian after Jerusalem attack',
        kind: 'CNN',
        url: 'https://www.cnn.com/2023/12/04/middleeast/castleman-israel-jerusalem-hamas-shot-backlash-intl/index.html',
      },
      {
        id: 'toi-castleman',
        label: 'Family says Yuval Castleman, killed after taking out terrorists, was ‘executed’',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/family-says-yuval-castleman-killed-after-taking-out-terrorists-was-executed/',
      },
    ],
  },
  {
    id: 'shira-suslik',
    name: 'Sgt. Shira Chaya Suslik',
    role: 'Fallen',
    meta: '19 · Border Police, Beersheba central bus station, October 6, 2024',
    summary:
      'Shira Suslik, a 19-year-old Border Police officer from Beersheba, was killed on October 6, 2024 while confronting a gunman who opened fire at the city’s central bus station, according to reports of the attack. The shooter, who began firing at people at a McDonald’s in the station, was killed at the scene; about ten other people were wounded. She was the only person killed in the attack.',
    sources: [
      {
        id: 'toi-suslik',
        label: 'Border cop killed, 10 wounded in terror shooting attack at Beersheba central bus station',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/border-cop-killed-10-wounded-in-terror-shooting-attack-at-beersheba-central-bus-station/',
      },
      {
        id: 'wiki-suslik',
        label: '2024 Beersheba bus station shooting',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/2024_Beersheba_bus_station_shooting',
      },
    ],
  },
  {
    id: 'lev-kreitman',
    name: 'Lev Kreitman',
    role: 'Fighter',
    meta: 'Reservist and Nova survivor · Jaffa attack, October 1, 2024',
    summary:
      'Lev Kreitman, an IDF reservist who had helped rescue wounded people at the Nova festival on October 7, was in a Jaffa restaurant on October 1, 2024 when two Hamas gunmen attacked passengers at the light rail station on Jerusalem Boulevard. He went out with his rifle, came upon one of the attackers from the side and shot him. Seven people were killed and 16 wounded in the attack. He was widely hailed as a hero afterwards.',
    sources: [
      {
        id: 'cnn-kreitman',
        label: 'Jaffa, Tel Aviv attack: Nova festival survivor, IDF reservist hailed as a ‘hero’ after confronting shooters',
        kind: 'CNN',
        url: 'https://www.cnn.com/2024/10/03/middleeast/tel-aviv-jaffa-attack-hero-intl-hnk/index.html',
      },
      {
        id: 'toi-kreitman',
        label: 'Man, who rescued wounded from Nova festival, shoots dead one of the terrorists in Jaffa attack',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/liveblog_entry/man-who-rescued-wounded-from-nova-festival-shoots-dead-one-of-the-terrorists-in-jaffa-attack/',
      },
    ],
  },
  {
    id: 'aaron-bours',
    name: 'Aaron Bours',
    role: 'Rescuer',
    meta: 'Givati reservist · Beit Hanoun, Gaza',
    summary:
      'Aaron Bours, a reservist in the Givati Brigade’s Rotem Battalion who grew up on Long Island and moved to Israel at 19, was shot by a sniper in Gaza while trying to rescue his officer during an ambush. He sprinted about 20 metres under fire to reach the officer and was hit in the right leg as he lifted him. He was flown to Sheba Medical Center, where surgeons saved his leg, and spent months in rehabilitation.',
    sources: [
      {
        id: 'toi-bours',
        label: 'A year on, wounded Israeli reserves soldiers face long road to recovery',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/a-year-on-wounded-israeli-reserves-soldiers-face-long-road-to-recovery/',
      },
      {
        id: 'jpost-bours',
        label: 'Aaron Bours, high tech executive and IDF reservist wounded in Gaza',
        kind: 'The Jerusalem Post',
        url: 'https://www.jpost.com/israel-news/article-828068',
      },
    ],
  },
  {
    id: 'elad-winkelstein',
    name: 'Elad Yaakov Winkelstein',
    role: 'Fallen',
    meta: '35 · Police investigator, al-Funduq attack, January 6, 2025',
    summary:
      'Elad Winkelstein, a 35-year-old investigator at the Ariel police station and father of two from Kibbutz Ein Hanatziv, was driving with his son through al-Funduq in the West Bank on January 6, 2025 when three gunmen opened fire on cars and a bus. He returned fire and tried to get his son away, firing two shots before he was killed. His son was unharmed. Two women were also killed in the attack.',
    sources: [
      {
        id: 'ynet-winkelstein',
        label: 'Minute-by-minute: Chilling details of deadly West Bank attack',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/article/rykfj5yiye',
      },
      {
        id: 'wiki-winkelstein',
        label: '2025 al-Funduq shooting',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/2025_al-Funduq_shooting',
      },
    ],
  },
  {
    id: 'agam-naim',
    name: 'Staff Sgt. Agam Naim',
    role: 'Fallen',
    meta: '20 · Combat paramedic, 401st Armored Brigade, Rafah, September 2024',
    summary:
      'Agam Naim, a 20-year-old combat paramedic from Kibbutz Mishmarot, served six months in Gaza with the 52nd Battalion of the 401st Armored Brigade, alongside engineering and Givati forces, and volunteered with Magen David Adom on leave. On September 17, 2024 she was killed with three other soldiers in an explosion in a building in Rafah’s Tel Sultan neighbourhood during a weapons search. She was the first female soldier killed in the Gaza ground offensive.',
    sources: [
      {
        id: 'jpost-naim',
        label: 'Staff-Sergeant Agam Naim becomes first female IDF soldier to fall in Gaza combat',
        kind: 'The Jerusalem Post',
        url: 'https://www.jpost.com/israel-hamas-war/article-820642',
      },
      {
        id: 'ih-naim',
        label: 'First female KIA in Iron Swords War',
        kind: 'Israel Hayom',
        url: 'https://www.israelhayom.com/2024/09/18/israel-mourns-first-female-soldier-killed-in-gaza/',
      },
    ],
  },
  {
    id: 'eitan-oster',
    name: 'Capt. Eitan Itzhak Oster',
    role: 'Fallen',
    meta: '22 · Egoz Unit, southern Lebanon, October 2, 2024',
    summary:
      'Eitan Oster, 22, from Modi’in-Maccabim-Re’ut, was a squad commander in the Egoz commando unit. He was killed in a battle with Hezbollah fighters in a village in southern Lebanon on October 2, 2024, the first Israeli soldier killed in the ground operation there. The Defence Ministry later named its laser air-defence system, Or Eitan (“Eitan’s Light”), in his memory.',
    sources: [
      {
        id: 'ynet-oster',
        label: 'IDF officer identified as first fatality in Lebanon ground offensive',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/article/bkqeb2ccc',
      },
      {
        id: 'wiki-oster',
        label: 'Eitan Oster',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Eitan_Oster',
      },
    ],
  },
  {
    id: 'liri-albag',
    name: 'Liri Albag',
    role: 'Rescuer',
    meta: 'Nahal Oz lookout soldier · Hostage in Gaza, released January 2025',
    summary:
      'Liri Albag, a lookout soldier abducted from the Nahal Oz base on October 7, 2023, was held in Gaza until her release in January 2025. Fellow hostage Amit Soussana has said Albag saved her life: when captors beat and threatened to kill Soussana unless she admitted to being an IDF officer, Albag spoke to the guards and persuaded them she was not in the military. Soussana told Israeli television, “as far as I’m concerned, you saved my life.”',
    sources: [
      {
        id: 'toi-albag',
        label: 'Ex-hostage says Liri Albag saved her life as Hamas captors tortured, threatened her',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/ex-hostage-says-liri-albag-saved-her-life-as-hamas-captors-tortured-threatened-her/',
      },
      {
        id: 'jpost-albag',
        label: '‘Liri Albag saved my life’ Amit Soussana reveals for first time in Uvda interview',
        kind: 'The Jerusalem Post',
        url: 'https://www.jpost.com/israel-news/article-839739',
      },
    ],
  },
  {
    id: 'adir-shlomo',
    name: 'Command Sgt. Maj. Adir Shlomo',
    role: 'Fallen',
    meta: '47 · Head of logistics, Sderot police station',
    summary:
      'Shlomo ran logistics at the Sderot police station. When terrorists began attacking the station at 7:03 a.m. on October 7, he was the first officer to reach it, and was shot dead at the entrance.',
    sources: [
      {
        id: 'toi-shlomo',
        label: 'Command Sgt. Maj. Adir Shlomo, 47: ‘Soul’ of the Sderot police station',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/sgt-maj-adir-shlomo-47-the-soul-of-the-sderot-police-station/',
      },
      {
        id: 'kan-shlomo',
        label: 'The story of the Sderot police station on October 7th',
        kind: 'Kan 7.10.360',
        url: 'https://www.710360.kan.org.il/en/sderot/police',
      },
    ],
  },
  {
    id: 'matan-abergil',
    name: 'Sgt. Matan Abergil',
    role: 'Fallen',
    meta: '19 · Golani Brigade, 13th Battalion · Kibbutz Nir Am',
    summary:
      'During the fighting near Kibbutz Nir Am on October 7, a grenade was thrown into the armored vehicle carrying Abergil and six other Golani soldiers. He tried to grab it and throw it out; when he could not, he threw himself on it and took the blast with his body. The six soldiers with him survived. His comrades recalled his last words: “I tried to protect all of us and all the people of Israel.”',
    sources: [
      {
        id: 'toi-abergil',
        label: 'Sgt. Matan Abergil, 19: Used body to shield 6 friends from grenade',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/cpl-matan-abergil-19-used-body-to-shield-6-friends-from-grenade/',
      },
      {
        id: 'ynet-abergil',
        label: 'Heroic soldier dies after jumping on a grenade to save others',
        kind: 'Ynetnews',
        url: 'https://www.ynetnews.com/magazine/article/hjyj7ldzp',
      },
    ],
  },
  {
    id: 'emily-damari',
    name: 'Emily Damari',
    role: 'Survivor',
    meta: 'British-Israeli · 471 days a hostage in Gaza, released January 2025',
    summary:
      'Emily Damari, a British-Israeli, was shot in the leg and hand when she was abducted on October 7, 2023, losing two fingers, and was held by Hamas for 471 days — by her account in homes, tunnels and UNRWA facilities, with almost no medical care. She has described correcting her captors that she was a hostage, not a prisoner. On her release on January 19, 2025 she raised her wounded hand in a three-finger wave that became a widely shared image of resilience.',
    sources: [
      {
        id: 'wiki-damari',
        label: 'Kidnapping of Emily Damari',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Kidnapping_of_Emily_Damari',
      },
      {
        id: 'jpost-damari',
        label: 'Former hostage Emily Damari reflects on captivity',
        kind: 'The Jerusalem Post',
        url: 'https://www.jpost.com/israel-news/article-869543',
      },
    ],
  },
  {
    id: 'eli-sharabi',
    name: 'Eli Sharabi',
    role: 'Survivor',
    meta: 'Kibbutz Be’eri · 491 days a hostage in Gaza, released February 2025',
    summary:
      'Eli Sharabi was abducted from Kibbutz Be’eri on October 7, 2023, where his wife, Lianne, and their two teenage daughters were murdered, and was held for 491 days, much of it underground in chains, until his release on February 8, 2025. He learned only after release that his family had been killed and that his brother Yossi had died in captivity. He has since addressed the UN Security Council and written a memoir, Hostage.',
    sources: [
      {
        id: 'wiki-sharabi',
        label: 'Eli Sharabi',
        kind: 'Wikipedia',
        url: 'https://en.wikipedia.org/wiki/Eli_Sharabi',
      },
      {
        id: 'toi-sharabi',
        label: 'Full text: Freed hostage Eli Sharabi asks UN Security Council, ‘Where was the world?’',
        kind: 'The Times of Israel',
        url: 'https://www.timesofisrael.com/full-text-freed-hostage-eli-sharabi-asks-un-security-council-where-was-the-world/',
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
