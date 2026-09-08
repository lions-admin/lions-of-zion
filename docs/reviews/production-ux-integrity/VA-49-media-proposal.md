# VA-49.3 / 49.4 — media proposal for the published record

Research and proposal only. **Nothing here has been attached, ingested or
written to any database.** Every candidate below is a suggestion for a later
step to apply through the authorized ingest path
(`externalMediaSchema`, `server/contracts/external-briefing.ts`).

Compiled 2026-09-08 against the live anonymous endpoint
`GET https://lionsofzion.io/api/v1/published-publications` (in `PUBLIC_V1`).
Licences were verified against the Wikimedia Commons `imageinfo` API
(`extmetadata.LicenseShortName`, `LicenseUrl`, `Artist`, `AttributionRequired`)
and, where the tag was ambiguous, against the file page's raw licence template.

---

## The inventory does not match the plan document

`docs/audits/…-implementation.md` VA-49 says "46 of 48 published records carry
no media at all" (VA-04's figure). The live endpoint today returns:

| | count |
| --- | --- |
| published records | **73** |
| already carry `media` | **14** |
| **carry no media — the scope of this proposal** | **59** |

`mediaDisposition` across all 73: `text_led` 25, `null` 48 — and the 14 records
that *do* carry media all have `mediaDisposition: null`, so the field is not yet
populated consistently either. That is a 49.2 follow-up, not this file's job,
but the applier should know the plan's "46 of 48" is stale before it sizes the
work.

---

## Summary

Of the 59 records carrying no media:

| Verdict | count | meaning |
| --- | ---: | --- |
| `illustrated` — candidate proposed | **6** (was 7; Nir Oz rejected by the owner 2026-09-08) | a genuinely appropriate image exists and its licence is verified |
| `media_unavailable` | **3** | the *right* image is identifiable but rights or resolution block it |
| `text_led` — intentional | **49** | no image belongs on this record; a picture would decorate or mislead |
| **total** | **59** | |

Licence confidence on the 7 candidates:

- **6 fully verified** — machine-readable CC/CC0/PD tag, attribution string
  captured, no restrictions flag.
- **1 needed a human editorial call, not a rights call** — `nir-oz-…-xuyhf`.
  **Decided 2026-09-08: rejected.** The owner ruled the candidate out rather
  than accept the conditional. It is the right call on the terms the proposal
  itself set: the image was only ever defensible if a dated caption and a
  `disclosure` line were guaranteed on *every* surface including the homepage
  card, and that guarantee cannot be made from the media contract alone. A
  2017 picnic photograph on an attack dossier, stripped of its date by any one
  surface that renders a bare hero, reads as the day itself. This record is
  now `text_led`. Original assessment follows —
  (see below); the licence is verified CC BY-SA 4.0, the *judgement* is whether
  a 2017 pre-attack photograph belongs on an attack dossier.
- The 3 `media_unavailable` records are where a human **rights** call is
  actually needed (2) or a higher-resolution source must be found (1).

**49 of 59 is the honest answer, and it is the finding.** This record set is
disproportionately composed of daily briefs, "Reported claim:" narrative-watch
assessments, superseded historical snapshots, and method/transparency essays —
four categories where, by the priority order in 49.3 and the prohibition in
49.4, intentional text-only is the *correct* terminal rung, not a shortfall.

---

## Proposed `illustrated` — 7 records

### 1. `be-eri-location-file-the-attack-the-failed-respo-hexu7`

- **section** `history_context` · "Be'eri location file: the attack, the failed response and the disputed record"
- **verdict** `illustrated` · **priority rung 1 — direct documentary evidence**

| field | value |
| --- | --- |
| `inputUrl` | `https://upload.wikimedia.org/wikipedia/commons/d/d5/Kibbutz_Be%27eri_after_the_massacre%2C_houses_that_were_burned_by_Hamas_%287%29.jpg` |
| `sourceUrl` | `https://commons.wikimedia.org/wiki/File:Kibbutz_Be%27eri_after_the_massacre,_houses_that_were_burned_by_Hamas_(7).jpg` |
| `role` | `documentation` |
| licence | **CC BY-SA 3.0** — `https://creativecommons.org/licenses/by-sa/3.0`, attribution required, no restrictions flag |
| `credit` | `Tomer Persico (תומר פרסיקו) / Wikimedia Commons, CC BY-SA 3.0` |
| `alt` | `Burned and gutted single-storey houses in Kibbutz Be'eri, photographed weeks after the 7 October 2023 attack.` |
| `caption` | `Kibbutz Be'eri, 6 November 2023: houses burned during the 7 October attack.` |
| `sensitivity` | `sensitive` |
| `disclosure` | not needed — unmodified documentary photograph |
| `rights` | `status: "cleared"`, `basis: "CC BY-SA 3.0"`, `reference:` the file page URL above, `clearedAt: "2026-09-08"`, `surfaces: ["homepage","article"]` |
| dimensions | 3024 × 4032 (portrait — needs a `focalPoint` around `{x:50,y:40}` and a landscape crop) |

This is the only candidate in the set that earns `role: "documentation"`: it
photographs the aftermath of the event this dossier is about, at the place the
dossier names, dated.

### 2. `nova-location-file-what-the-evidence-establishes-mybn8`

- **section** `history_context` · "Nova location file: what the evidence establishes — and what it does not"
- **verdict** `illustrated` · **priority rung 2 — editorial/documentary photography**

| field | value |
| --- | --- |
| `inputUrl` | `https://upload.wikimedia.org/wikipedia/commons/b/bc/Nova_Festival_Memorial_Site_Reim_Parking_Lot_-_Avney_Moreshet_-_b1cf3781.jpg` |
| `sourceUrl` | `https://commons.wikimedia.org/wiki/File:Nova_Festival_Memorial_Site_Reim_Parking_Lot_-_Avney_Moreshet_-_b1cf3781.jpg` |
| `role` | `archival-context` |
| licence | **CC BY-SA 4.0** — `https://creativecommons.org/licenses/by-sa/4.0`, attribution required |
| `credit` | `Israel Parker (ישראל פרקר) / Avney Moreshet archive via Wikimedia Commons, CC BY-SA 4.0` |
| `alt` | `The Nova festival memorial site in the Re'im parking lot, where the 7 October 2023 attack on the festival took place.` |
| `caption` | `The Nova memorial at the Re'im parking lot, November 2025. The memorial marks the site; it is not a record of the attack itself.` |
| `sensitivity` | `sensitive` |
| `disclosure` | not needed, but the caption's second sentence is load-bearing and must survive editing |
| `rights` | `cleared` / `CC BY-SA 4.0` / file page / `2026-09-08` / `["homepage","article"]` |
| dimensions | 3000 × 1902 (landscape, good hero aspect) |

**`archival-context`, deliberately not `documentation`.** A 2025 memorial is
evidence of commemoration, not of the attack. Filing it as `documentation`
would be exactly the overstatement this dossier's own text warns against.

### 3. `nir-oz-location-file-mass-abduction-delayed-resp-xuyhf` — **REJECTED 2026-09-08, now `text_led`**

- **section** `history_context` · "Nir Oz location file: mass abduction, delayed response and an incomplete inquiry record"
- **verdict** `illustrated` · **priority rung 3 — relevant location photography** · **needs an editorial call before applying**

| field | value |
| --- | --- |
| `inputUrl` | `https://upload.wikimedia.org/wikipedia/commons/0/00/Nir_Oz_by_Yael_Yolovitch_%28YY1%29.jpg` |
| `sourceUrl` | `https://commons.wikimedia.org/wiki/File:Nir_Oz_by_Yael_Yolovitch_(YY1).jpg` |
| `role` | `archival-context` |
| licence | **CC BY-SA 4.0**, attribution required |
| `credit` | `Yael Yolovitch / Wikimedia Commons, CC BY-SA 4.0` |
| `alt` | `Residents of Kibbutz Nir Oz at the community swimming pool in June 2017, six years before the 7 October 2023 attack.` |
| `caption` | `Nir Oz, 23 June 2017 — the community before the attack. This photograph predates 7 October 2023 by six years.` |
| `sensitivity` | `safe` |
| `disclosure` | `Photographed in 2017 — not a record of the 7 October 2023 attack.` |
| `rights` | `cleared` / `CC BY-SA 4.0` / file page / `2026-09-08` / `["homepage","article"]` |
| dimensions | 4128 × 2322 |

**The whole risk is in the date.** Commons' description reads
"2017 פיקניק על הדשא בבריכה" — a picnic on the lawn by the pool. Attached
without an explicit dated caption *and* the `disclosure` line above, a reader
would take it for the aftermath. Attached with them, it is a legitimate
before-photograph. **If the applier is not confident both lines will render on
every surface including the homepage card, downgrade this record to
`text_led`.** Do not ship the image with the caption stripped.

### 4. `bab-al-mandeb-and-hormuz-why-yemen-s-fighting-pu-ws71p`

- **section** `news` · "Bab al-Mandeb and Hormuz: why Yemen's fighting puts an alternative oil route at risk"
- **verdict** `illustrated` · **priority rung 4 — documents, charts or data**

| field | value |
| --- | --- |
| `inputUrl` | `https://upload.wikimedia.org/wikipedia/commons/8/85/Bab-el-Mandeb_Strait%2C_Africa-Arabia_%28ASTER%29.jpg` |
| `sourceUrl` | `https://commons.wikimedia.org/wiki/File:Bab-el-Mandeb_Strait,_Africa-Arabia_(ASTER).jpg` |
| `role` | `archival-context` |
| licence | **Public domain** — NASA/JPL ASTER imagery, no attribution required (credit given anyway) |
| `credit` | `NASA/METI/AIST/Japan Space Systems and the U.S./Japan ASTER Science Team` |
| `alt` | `Satellite image of the Bab-el-Mandeb strait, with Yemen on the Arabian side and Djibouti and Eritrea on the African side of the narrow passage.` |
| `caption` | `The Bab-el-Mandeb strait, imaged by ASTER on 10 April 2017. The passage separates Yemen from Djibouti and Eritrea and carries traffic between the Red Sea and the Gulf of Aden.` |
| `sensitivity` | `safe` |
| `rights` | `cleared` / `Public domain (NASA/JPL ASTER)` / file page / `2026-09-08` / `["homepage","article"]` |
| dimensions | 3778 × 4408 (portrait — crop required) |

The article's subject *is* the geography. Satellite imagery of the chokepoint
is data about the thing being discussed, not decoration around it.

### 5. `seven-turning-points-in-israel-s-story-what-the--qntuw`

- **section** `history_context` · "Seven turning points in Israel's Story: what the primary documents establish"
- **verdict** `illustrated` · **priority rung 4 — documents**

| field | value |
| --- | --- |
| `inputUrl` | `https://upload.wikimedia.org/wikipedia/commons/3/36/Declaration_of_State_of_Israel_1948.jpg` |
| `sourceUrl` | `https://commons.wikimedia.org/wiki/File:Declaration_of_State_of_Israel_1948.jpg` |
| `role` | `archival-context` |
| licence | **Public domain** — Commons licence template `{{PD-Israel}}` (Israeli copyright expired; photograph published 1948). Source: National Photo Collection of Israel, Government Press Office, id `D247-041`. Verified by reading the file page wikitext, not just the summary tag. |
| `credit` | `Rudi Weissenstein / Government Press Office, National Photo Collection of Israel — public domain` |
| `alt` | `David Ben-Gurion reading the Declaration of the Establishment of the State of Israel on 14 May 1948, beneath a portrait of Theodor Herzl.` |
| `caption` | `Tel Aviv, 14 May 1948: Ben-Gurion reads the Declaration of the Establishment of the State of Israel. The first of the primary documents this article works through.` |
| `sensitivity` | `safe` |
| `rights` | `cleared` / `Public domain — PD-Israel (published 1948)` / file page / `2026-09-08` / `["homepage","article"]` |
| dimensions | 3072 × 2048 |

### 6. `official-shelter-data-available-as-tensions-rise-5csmr`

- **section** `israel_update` · "Official shelter data available as tensions rise on Lebanon and Gulf fronts"
- **verdict** `illustrated` · **priority rung 3 — relevant object photography**

| field | value |
| --- | --- |
| `inputUrl` | `https://upload.wikimedia.org/wikipedia/commons/1/1b/20260304_185748_Bomb_shelter_in_Israel.jpg` |
| `sourceUrl` | `https://commons.wikimedia.org/wiki/File:20260304_185748_Bomb_shelter_in_Israel.jpg` |
| `role` | `archival-context` |
| licence | **CC0 1.0** — `http://creativecommons.org/publicdomain/zero/1.0/`, no attribution required (credit given anyway) |
| `credit` | `Rakoon / Wikimedia Commons, CC0` |
| `alt` | `A public bomb shelter in Israel, photographed in March 2026.` |
| `caption` | `A public shelter in Israel, March 2026. Municipal open data lists locations like this one; it does not confirm that any given shelter is open or ready.` |
| `sensitivity` | `safe` |
| `rights` | `cleared` / `CC0 1.0` / file page / `2026-09-08` / `["homepage","article"]` |
| dimensions | 2296 × 4080 (portrait — crop required, `focalPoint` around `{x:50,y:55}`) |

The article is about where shelters are; a photograph of the object it is
telling readers to locate is the thing itself, not a stand-in. The caption's
second sentence carries the article's own caveat and should not be dropped.

### 7. `ben-gurion-university-team-develops-aerogel-that-0y2we`

- **section** `innovation` · "BGU oil-spill aerogel: 78 g/g in the lab, with biodegradation still to prove at scale"
- **verdict** `illustrated` · **priority rung 3 — relevant location photography** · **lowest-confidence pick in the set**

| field | value |
| --- | --- |
| `inputUrl` | `https://upload.wikimedia.org/wikipedia/commons/6/64/Ben_Gurion_university_and_Health_sciences_campus.jpg` |
| `sourceUrl` | `https://commons.wikimedia.org/wiki/File:Ben_Gurion_university_and_Health_sciences_campus.jpg` |
| `role` | `archival-context` |
| licence | **CC BY-SA 4.0**, attribution required |
| `credit` | `Omer berner / Wikimedia Commons, CC BY-SA 4.0` |
| `alt` | `Aerial view of the Ben-Gurion University of the Negev campus and health sciences campus in Be'er Sheva.` |
| `caption` | `Ben-Gurion University of the Negev, Be'er Sheva. The aerogel result described here was produced by a BGU team; this photograph shows the institution, not the experiment.` |
| `sensitivity` | `safe` |
| `rights` | `cleared` / `CC BY-SA 4.0` / file page / `2026-09-08` / `["homepage","article"]` |
| dimensions | 3260 × 2222 |

**Read the caveat before applying this one.** A campus photograph is location
photography of the *institution*, and it tells a reader nothing about an
aerogel. It sits right on the line 49.4 draws. It is proposed rather than
rejected because (a) the institution is named in the headline, and (b) the
caption above states plainly what the picture is not. A reviewer who thinks
that is still decoration should mark this record `text_led`; that is a
defensible outcome and no evidence is lost by it.

Note also: a sibling record on the same story,
`ben-gurion-university-aerogel-can-absorb-100-tim-cb3o1`, already carries an
in-house editorial illustration. Two records on one result should not end up
with two different visual treatments; resolve that before applying.

---

## Proposed `media_unavailable` — 3 records

`media_unavailable` rather than `text_led` because in each case the *right*
image is identifiable — the block is rights or resolution, not editorial fit.
Recording that honestly is what the 49.2 state model exists for.

### A. `before-partition-jewish-history-palestinian-arab-ora0s`

- **section** `history_context` · "Before partition: Jewish history, Palestinian Arab society and the road to 1947"
- **the right image** the UN Partition Plan map, `A/RES/181(II)`, 29 November 1947.
- **the block** every Commons copy is tagged `{{UN map}}`, not a free licence.
  `File:Palestine_Plan_on_Partition_with_Economic_Union.jpg` is only 400 × 787
  *and* its own description line reads "© UN" while the summary tag says public
  domain — a direct contradiction on the file page.
  `File:UN_Palestine_Partition_Versions_1947.jpg` (1370 × 2838) carries
  `{{UN map}}` in its wikitext.
- **what a human must decide** whether the UN's terms for reproducing its maps
  cover editorial use on this site. That is a rights call this research cannot
  make. If cleared, `role: "archival-context"`, `rights.status: "cleared"` with
  the UN terms named as `basis`; if not, this record becomes `text_led`.

### B. `documents-to-understand-israel-and-the-israeli-p-8npys`

- **section** `history_context` · "Documents to understand Israel and the Israeli–Palestinian conflict"
- **the right image** a primary document — the same UN partition map, or a
  high-resolution scan of one of the declarations the reading room covers.
- **the block** identical to A. Public-domain scans that exist are the wrong
  shape for a hero: `File:Israel_Declaration_of_Independence.jpg` is 469 × 1795,
  a ratio nothing on this site can crop honestly.
- Do **not** solve this by reusing the Weissenstein photograph proposed for
  record 5. One archive photograph on two records reads as a stock choice, which
  is the failure mode 49.4 names.

### C. `us-house-passes-bill-targeting-university-boycot-lhl1q`

- **section** `israel_update` · "H.R. 4795: House passage confirmed; subsequent Senate action not yet verified"
- **the right image** the House chamber, or the roll-call record itself.
- **the block** resolution. The two clean public-domain options —
  `File:United_States_House_of_Representatives_chamber.jpg` (1080 × 566, US
  House, PD) and `File:United_States_House_of_Representatives,_February_13,_2024.jpg`
  (960 × 540, PD) — are both under the site's hero width. Everything larger in
  the search was a 19th-century engraving or a different state legislature.
- A higher-resolution PD source (`house.gov`, Architect of the Capitol, or a
  clerk.house.gov roll-call PDF rendered as a chart) would resolve this. Until
  one is found, this is unavailable, not text-led.

---

## Intentional `text_led` — 49 records

These are grouped by the reason, because the reason is the same within each
group and the priority order terminates at the same rung for all of them.

### Group 1 — Daily Brief editions (9)

A brief is a digest of six to twelve unrelated stories. There is no image that
documents "the 3 September edition"; anything chosen would represent one story
and mislabel the other eleven, or be a mood picture. Terminal rung: intentional
text-only.

`idf-clears-ali-al-taher-tunnels-as-gaza-yellow-l-98jch` ·
`israel-and-regional-security-briefing-6-septembe-kc8en` ·
`israel-ministry-of-defense-activities-regional-r-lref0` ·
`israel-s-open-civil-defence-data-initiative-cont-fgpr4` ·
`israel-s-open-civil-defence-data-initiative-cont-mv6ck` ·
`israel-security-and-diplomacy-brief-september-3--xgjvx` ·
`israel-security-diplomacy-and-anti-boycott-brief-4xspk` ·
`regional-tensions-west-bank-violence-and-civil-d-eto53` ·
`what-changed-since-september-6-the-september-8-e-2w74s`

Two of these are corrections withdrawing a claim. An image on a correction adds
visual weight to a retraction — the opposite of what a correction should do.

### Group 2 — `narrative_watch` "Reported claim:" assessments (7)

**This is the strongest categorical text-led argument in the set, and it is an
editorial rule rather than a rights problem.** A hero image on a claim
assessment visually asserts the claim. Put a photograph of a damaged Lebanese
village above "Reported claim: Israel launches fresh attacks across southern
Lebanon" and the page has published the allegation as documented fact in the
one element a reader processes before the text. `narrativeWatchTitle()` prefixes
these headlines precisely so the frame is unmistakable; an image undoes that
work above the fold.

`israel-launches-fresh-attacks-across-southern-le-86i2j` ·
`lebanese-child-succumbs-to-wounds-after-reported-dd5w4` ·
`reported-claim-claims-that-israeli-government-pl-nos0i` ·
`reported-claim-guilt-by-association-why-seven-in-3y6mg` ·
`reported-claim-iran-warned-the-united-states-isr-t5n3b` ·
`reported-claim-us-ambassador-to-israel-says-ther-0k1g2` ·
`us-accepts-military-sale-of-helicopters-to-iraq--p5zzh`

**Rejected here, and why:**

- *Portraits of Ben-Gvir, Katz or Ambassador Huckabee* on the two Gaza-migration
  records (`nos0i`, `0k1g2`). Free portraits exist. A face above a
  "reported claim" headline convicts a named person in the image of a claim the
  body is careful to leave unestablished.
- *A Bell 412 photograph* on `p5zzh` (Iraq helicopter sale). The record's whole
  point is that reported approval **does not establish a completed sale**. A
  photograph of the aircraft depicts a delivery that has not been shown to have
  happened.
- *Southern Lebanon or Nabatieh landscape photography* on `86i2j` and `dd5w4`.
  This is the textbook "stock photo of a place near where something happened" —
  `archival-context` at best and, on a claim assessment, actively corroborating.

### Group 3 — superseded "Historical report:" and "Earlier report:" snapshots (6)

Each of these exists only to preserve an earlier state of a story and points
the reader at the current record. Adding media to a snapshot gives it the visual
weight of a live story and competes with the record that supersedes it.

`ali-al-taher-remains-an-active-israel-hezbollah--hkoun` ·
`ali-al-taher-ridge-remains-a-verified-israel-hez-mwq1v` ·
`iran-says-it-struck-a-u-s-unmanned-vessel-washin-anmgp` ·
`lebanese-detainee-returned-through-icrc-channel-bblkt` ·
`netanyahu-orders-unauthorized-west-bank-outposts-kb1l1` ·
`us-house-passes-bill-targeting-university-boycot-skxk2`

### Group 4 — method, provenance and transparency essays (12)

These articles are *about* how evidence is read, counted, sourced and corrected.
Their subject has no photographable referent. Any image is decoration, and
decoration on a methods page undercuts the page's argument.

`how-five-october-7-testimonies-connect-without-b-5vzxz` ·
`how-project-contributions-are-received-and-what--wdrzv` ·
`how-to-read-the-october-7-archive-source-taxonom-zjy4f` ·
`how-weak-claims-look-confirmed-a-reader-s-guide--l09av` ·
`october-7-by-the-numbers-what-is-counted-estimat-hnisx` ·
`using-municipal-shelter-data-what-the-records-sh-6gl78` ·
`what-changed-corrections-research-revisions-and--ayct3` ·
`who-wrote-this-who-reviewed-it-and-what-counts-a-0sk53` ·
`1948-and-the-abraham-accords-correcting-two-shor-m7t36` ·
`after-october-7-the-milestones-that-changed-the--xs853` ·
`from-1948-to-the-second-intifada-statehood-displ-cr530` ·
`from-disengagement-to-regional-war-israel-gaza-a-tz1ux`

The last four are multi-decade narrative chapters: no single photograph is
honest about a span from 1948 to 2005, and a chart would have to be built rather
than found. If any of them later warrants a purpose-built timeline graphic, that
is `role: "editorial-illustration"` with a `disclosure`, and it is a design task
rather than a sourcing one.

`using-municipal-shelter-data-…-6gl78` deliberately does **not** reuse the CC0
shelter photograph proposed for record 6. Same photograph on two records about
the same datasets is stock behaviour, and this record is about the *datasets*,
not the shelters.

### Group 5 — operational military and diplomatic reports (8)

Free, verifiable documentary photography of *these specific* events does not
exist. The available substitutes are IDF Spokesperson stock images of different
tunnels, different sectors, different days — which is precisely the unrelated
image 49.4 forbids. The ICRC records additionally have no usable emblem imagery:
the red cross emblem is protected under the Geneva Conventions and its use is
restricted independently of copyright.

`idf-clears-hezbollah-tunnels-under-ali-al-taher--ak2iu` ·
`idf-reports-destruction-of-more-than-26-kilomete-y2y5j` ·
`idf-reports-yellow-line-crossings-in-northern-ga-mwsec` ·
`israel-ministry-of-defense-recent-announcements--m781m` ·
`lebanese-detainee-returned-through-icrc-channel-68if2` ·
`uk-confirms-settlement-goods-trade-ban-is-coming-zweiy` ·
`us-israel-defense-technology-cooperation-faces-a-zzynw` ·
`iran-s-armed-partners-what-funding-weapons-and-c-1c7jr`

### Group 6 — corporate, research and institutional stories (7)

Company logos and product marks are trademarked and are not freely licensed;
Commons hosts them under non-free or trademark-restricted terms that do not
cover editorial hero use here. No free documentary photograph of the events
themselves (an acquisition, a funding round, a launch, a study) exists.

`adidas-boycott-narrative-what-the-viral-single-s-5wxlh` ·
`servicenow-acquires-israeli-ai-startup-sweep-as--zk35j` ·
`israel-s-new-biotech-center-aims-to-turn-lab-dis-s90zi` ·
`licensed-but-waiting-arab-physicians-and-israel--3in0j` ·
`weizmann-study-links-adult-otp-activity-to-stres-m54ou` ·
`how-the-israel-killed-charlie-kirk-theory-surviv-sl3l9` ·
`iran-says-it-struck-an-unmanned-u-s-vessel-centc-8m6cq`

**Rejected here, and why:**

- *Weizmann Institute campus photographs* (`m54ou`). CC BY 2.5 PikiWiki images
  of the Weizmann House grounds are available and verified. Rejected: the
  article is about Otp deletion in adult male mice. A photograph of the
  institution's lawn is a building, not a result. This is the same shape as
  candidate 7 (BGU) but weaker — the BGU record at least names the institution
  in its headline as the actor; this one's subject is a mechanism.
- *An Adidas Single Shoe product photograph* (`5wxlh`). Product imagery is the
  company's, not free, and using it would visually endorse one side of a
  contested advertising controversy.
- *A Knesset plenum photograph* (`3in0j`). The Knesset hearing is one paragraph
  of a workforce-policy article; `File:Knesset_Hall.JPG` is tagged
  `Attribution` with an ambiguous attribution-required flag, and the subject of
  the article is a residency bottleneck, not a parliament.
- *A portrait of Charlie Kirk* (`sl3l9`). Free portraits exist. Rejected: the
  article is about a conspiracy theory attached to his killing. His face above
  that headline makes the victim the illustration for the theory.
- *Strait of Hormuz maps* (`8m6cq`). Verified public-domain CIA and ONI maps
  exist (`File:Strait_of_Hormuz_2004.png`, `File:Economic_Importance_of_Strait_of_Hormuz.png`).
  Rejected here because the record is a claim assessment — Iran says it struck a
  vessel, CENTCOM denies it, the outcome is unestablished — and it therefore
  belongs to the Group 2 rule even though its section is
  `influence_investigation`. The map would suggest a located, verified event.
  (The same map family *is* appropriate for a geography explainer; that is why
  candidate 4 uses satellite imagery on `ws71p`, which is an explainer.)

---

## Notes for whoever applies this

1. **Nothing here is attached.** Each candidate must go through
   `server/modules/media` via the authorized ingest path, which fetches
   `inputUrl` once and stores this site's own copy in the public Blob store. Do
   not hotlink `upload.wikimedia.org`.
2. **Share-alike obligations are real.** Five of the seven candidates are
   CC BY-SA. Attribution must render on the public surface, not just live in the
   database; the `credit` strings above are drafted to be rendered verbatim.
3. **Four candidates are portrait-orientation** (1, 3 is landscape, 4, 6) and
   need a considered `focalPoint` plus verification under 49.5's responsive-crop
   check. `cls: 0` must hold.
4. **`generated` is `false` on all seven.** No generated imagery is proposed for
   any record here, and none of the seven claims a documentary role it has not
   earned — only candidate 1 is `role: "documentation"`.
5. **The 49 `text_led` verdicts still need writing to the row.** They are
   currently a mix of `mediaDisposition: "text_led"` and `null`; the null ones
   are indistinguishable from "nobody looked", which is the exact ambiguity
   49.2 shipped the field to remove.
