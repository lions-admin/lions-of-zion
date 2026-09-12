# Homepage operating manual

Manual version: 2026-09-12.1

The daily-use manual for the homepage of `lionsofzion.io`: what every band on
the cover is, where it links, how content gets there, what its date means, and
how the whole-site run records the decisions it took about it. It was written
against the components as they stood on 2026-09-12; every route, anchor and
label below was read from the source, not from memory.

**[`../editorial-dna.md`](../editorial-dna.md) outranks this manual.** It is
the owner's binding definition of what the site is; this document only says
how to operate one page of it. Where the two disagree, this one is wrong.
[`../whole-site-updates.md`](../whole-site-updates.md) is the delivery
mechanism the run uses; this manual does not restate it.

The version line at the top is a contract field. A run echoes it verbatim as
`homepageReview.manualVersion` in its `whole-site-update-v2` package
([§10](#10-the-homepagereview-block)), so a review composed against a stale
manual is visible as such in the run report. Bump it when the operating rules
change, not when a sentence is tidied.

---

## 1. Purpose, readers, and the five steps before a run

**Who must read it.** The external composer that runs the whole-site
editorial update (the ChatGPT Scheduled Task), any human editing the homepage
by hand through the admin console, and any agent changing the homepage
components or the selector. The last group reads it so a code change does not
silently break a rule an editor is relying on.

**Before composing a package, every run does these five things, in order:**

1. **Read the live context.** `GET /api/internal/chatgpt/editorial-context`
   returns today's Israel-local edition date, the homepage as it stands with
   its placements, the live records with their identity and placement, the
   developing stories keyed by `canonicalStoryId`, and computed warnings
   (stale edition, a band on automatic selection, records without a hero).
   Nothing about the homepage is decided from memory of yesterday.
2. **Read this manual**, and note its version line.
3. **Review the homepage section by section**, top to bottom, against the map
   in [§2](#2-the-map-top-to-bottom) — all seven review sections, including
   the four a run cannot place into.
4. **Decide, per placeable slot:** create, update, promote, retain, replace,
   demote, veto, or publish nothing. "Retain" and "publish nothing" are
   decisions, not omissions ([§9](#9-promote-retain-replace-demote-veto)).
5. **State the homepage impact** in the package's `homepageReview` block, with
   the reasons, and let the run report carry it ([§10](#10-the-homepagereview-block)).

## 2. The map, top to bottom

Scroll order on Production, 2026-09-12. "Route" is what the band links to;
"Content source" is where its items come from; "Selection rule" is who chooses
them; "Date rule" is what date the reader sees, if any
([§6](#6-date-policy)).

| # | Homepage section | Menu owner | Route | Content source | Allowed content | Selection rule | Date rule | Owner & cadence |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0 | **Header**: Search, Ask the desk, Menu, Support Us, Account | Chrome | `/search`, `/ask`, `/support-us`, `/account`; menu links from `components/site/navigation-model.ts` | `REPORTING_LINKS`, `ABOUT_LINKS`, `REFERENCE_LINKS`, `SYSTEM_LINK` | Navigation only | Static | None | Development; never a run |
| 1 | **Hero** ("LIONS OF ZION", "Truth has a signal.") + **edition rail** | News & Analysis | Lead's own `/articles/<publicId>`; "Read the latest" `/geopolitical-brief`; "How it works" `/information-war` | `edition.news.items[0]` — the same news lead as band 3 | The one news lead: its label, headline, "Read the story" | The news `lead` placement, else automatic | **Edition date**, `Sat 12 Sept 2026`; the lead itself shows no date here | The run, daily. There is no separate cover pick |
| 2 | **Edition masthead** + "In this edition" contents | — | Six anchors: `#home-news`, `#home-narratives`, `#home-archive`, `#home-people`, `#home-system`, `#home-support` | `lib/homepage-bands.ts` `HOMEPAGE_BANDS` | Band names, byte-identical to the site's own | Static, in band order | **Edition date**, `Edition · Sat 12 Sept 2026` — the same formatter as band 1; `· Previous edition` when the snapshot is not today's | Development |
| 3 | **News & Analysis** (`#home-news`, kicker "The present") | News & Analysis | `/articles/<publicId>`; "All of News & Analysis" `/geopolitical-brief` | Live publications, sections `daily_brief`, `israel_update`, `news` | Lead + companion: distinct significant stories, the Daily Brief, developing-story canonicals | `news.lead` / `news.secondary` placements; an unplaced slot falls to newest-first automatic selection | **Updated** date-time when revised, else **published** date-time; `12 Sept 2026, 17:07 · Israel time` | The run, daily |
| 4 | **Support strip** ("Support the work": PayPal, Buy a coffee) | Support Us | Provider URLs from `lib/donation-channels.ts` | Donation config | Two provider links | Static | None | Owner ruling 2026-09-07 / UX-13: moved after the news, not removed. Not a bug |
| 5 | **Fake Resistance** (`#home-narratives`, kicker "Narratives & fact checks") | Fake Resistance | `/articles/<publicId>`; "All of Fake Resistance" `/fake-resistance` | Live publications, sections `narrative_watch`, `influence_investigation`, `antisemitism`; legacy static cases | Lead + item: one claim record, one investigation, or antisemitism reporting; an unsourced analysis is labelled as ours | `fakeResistance.lead` / `secondary`; automatic prefers two different kinds | **Updated** when revised, else **published**, same format as band 3 | The run, daily (DNA §4 job 1 is mandatory) |
| 6 | **October 7** (`#home-archive`, "The record remains.") | October 7 | `/october-7/…`; "All of October 7" `/october-7` | Static archive catalogue (`lib/content/testimonies.ts`, `documentation.ts`) | One testimony + one documented record, each behind its warning | `selectHomepage()` rotates against display history with a seven-day cutoff, per edition. **Not placeable** | **None**, deliberately: the record's date is an ingestion date, not the event's | Development / archive curation. A run only recommends |
| 7 | **The People of Israel** (`#home-people`, kicker "People, work, context") | The People of Israel | `/articles/<publicId>`; "All of The People of Israel" `/people-of-israel` | Live publications, the eight `people` sections | Feature + companion: innovation, science, technology, achievement, cooperation, people, courage, history & context | `people.lead` / `secondary`; automatic rotates against display history | **None** on the cards today; the article page shows published/updated | The run, daily; History & Context every few days |
| 7a | └ **Courage & service** sub-block | The People of Israel | `/our-heroes#…` | Static Our Heroes edition (`lib/content/our-heroes.ts`) | Portrait profiles | Rotated by display history | **None**: profile dates are ingestion dates | Development; a run recommends |
| 7b | └ **History & context** sub-block ("Beyond the current headline") | The People of Israel | `/israels-story#…` | Static Israel's Story chapters (`lib/content/israels-story.ts`) | Chapter links with an era label; "Contested" where the chapter records disagreement | Rotated by display history | **Era label** only (e.g. `1947`), never a record date | Development; a run recommends |
| 8 | **Behind the desk** (`#home-system`, "More copies. Not more evidence.") + intro dialog | How it works | `/information-war`, `/methodology`; the intro dialog is `EditorialIntro`, closed by default | Static copy and `AmplificationFigure` | The source-counting argument and two doors out | Static | None | Development |
| 9 | **Support** (`#home-support`, "Keep the desk running.") | Support Us | Provider URLs; "Other ways to help" `/support-us` | Donation config | Two provider links + one internal link | Static | None | Owner ruling 2026-09-07: the edition closes on the ask. Stays with band 4 |
| 10 | **Footer** | Chrome | Section links, reference links, `#page-content` | `navigation-model.ts` | Navigation | Static | Copyright year | Development |

Anchors, labels and hub links for bands 3, 5, 6, 7, 8 and 9 are centralised in
`lib/homepage-bands.ts`; a component does not hand-write them.

## 3. What belongs, and what does not, per band

- **Edition rail (1).** The news lead and nothing else. It must never be a
  second selection: a cover that picks its own lead can disagree with the
  band beneath it.
- **News & Analysis (3).** Distinct significant stories and the Daily Brief.
  Not: a claim record (that is Fake Resistance even when it is "news"), a
  second copy of the lead's event under a different headline
  ([§5](#5-update-the-canonical-never-a-near-duplicate)), a People feature.
- **Fake Resistance (5).** A narrative or claim investigated to the DNA §3
  shape, an influence investigation, or antisemitism reporting. Not: ordinary
  news that merely mentions propaganda; legitimate criticism treated as
  propaganda because it is negative.
- **October 7 (6).** Existing documented material only. A run never writes
  into it; new material is a `siteRecommendations` line.
- **The People of Israel (7).** People, work and context — the eight
  sections. Not: a news story that happens to have a person in it. A History &
  Context explainer files here, never under News, because no caller passes
  the routing override.
- **Support (4, 9).** Provider links and the `/support-us` door. No provider
  script, no widget, no ask before the first story (band 4 sits after the
  news for that reason).
- **Behind the desk (8).** The method, not a second product. Content about
  *how* the desk works goes to `/information-war`; it is not an editorial
  slot.

Section is the only routing choice a package makes. If a record seems to
belong on the wrong band, the fix is its `publication.section`, never a
placement into an area whose sections it does not carry —
`setHomepagePlacement()` refuses that.

## 4. Choosing the lead

- The **edition rail and the News & Analysis lead are one selection**: the
  `news.lead` placement. There is no cover-only pick and there must not be
  one.
- The lead is the story a reader most needs first today: consequential,
  distinct, sourced, with a headline that says what happened. A developing
  canonical that had a real development today is a better lead than a new
  record about the same event.
- The companion (`news.secondary`) is the second most important *different*
  story, not a second angle on the lead.
- If nothing published today is stronger than what is live, **leave the slot
  alone** by omitting the placement and record `retain` with the reason.
- A lead without a hero image still takes the slot and renders text-led
  (owner ruling 2026-09-07). Say so in the report; do not veto a lead for a
  picture.

## 5. Update the canonical, never a near-duplicate

A developing story is one canonical record plus updates. Each update carries a
`changeSummary`, moves the record to `updated`, stamps `updatedAt`, and — if
the development is real — is re-promoted with a placement. A new article only
when the development stands on its own.

**Worked example, 2026-09-12.** The news lead read *"Aoun visits south
Lebanon…"*. Its record is
`israel-says-it-has-cleared-hezbollah-s-ali-al-ta-6rr6p`: created on 10 Sept
about the Ali al-Taher tunnel clearance, rewritten on 12 Sept (its fourth
version added the Aoun visit the headline is about). That is the shape working
as intended: one record, one update log, a card that now says
`Updated 12 Sept 2026`.

What went wrong around it: the search index carried **at least four separate
published records** on the same tunnel event. Each was a real story on its own
day, but together they are the near-duplicate pile the DNA forbids. The
correct handling is:

1. Pick the canonical (the one with the most complete body, the placement, or
   the `canonicalStoryId`; set one if none exists).
2. Fold the others' new facts into it as an `update` with a `changeSummary`
   that names what was merged.
3. Archive the duplicates through the automation's `actions` route (the
   `delete_publication` tool is substituted with archival on purpose), or
   record a `siteRecommendations` line asking the owner to.
4. Re-promote the canonical only if the merge added a development.

Two rules the example also teaches:

- **Never change a `publicId` to fix a slug.** The slug above still says
  "Israel says it has cleared" under a headline about a presidential visit.
  That is cosmetic; the URL is the record's permanent address, linked from
  outside, and a changed id is a broken link plus a lost history.
- **A retitled canonical keeps its published date.** The card shows the
  update; the article shows both. Neither is edited by hand.

## 6. Date policy

Five dates exist. Each surface shows exactly one of them, and they are never
substituted for each other.

| Date | Definition | Shown where | Format |
| --- | --- | --- | --- |
| **Event date** | When the thing reported happened; the publisher's stated date on a source | In the body and in "Public sources" (`formatSourceDay`, UTC day) | `10 Sept 2026` |
| **Published** | `publishedAt`: when the record first went live here | News and Fake Resistance cards when not revised; article page; hubs | `10 Sept 2026, 09:14 · Israel time` |
| **Updated** | `updatedAt`: the last `changeSummary` update | News and Fake Resistance cards **instead of** published when it differs (`Updated …`); article page as a second line | `Updated 12 Sept 2026, 17:07 · Israel time` |
| **Edition date** | The Israel calendar date the homepage snapshot was composed for (`israelEditionDate()`) | Edition rail and masthead only | `Sat 12 Sept 2026` |
| **Archive / ingestion date** | When a static testimony, documented record, hero profile or story chapter was entered into the catalogue | **Nowhere on the homepage.** October 7, Courage & service and History & context cards show no date by design; History & context shows an era label | — |

Rules:

- One formatter, `lib/format-date.ts`: locale `en-GB`, zone `Asia/Jerusalem`,
  absolute never relative. Homepage, article page and the three hubs use it.
  A date written by hand in a component is a defect.
- A card must never show a published date older than the story it carries.
  That was the al-Taher defect: the card said 10 Sept under a headline about a
  12 Sept event. The fix was to show `updatedAt` when the record was revised,
  not to touch the record.
- The edition date is not a content date. `· Previous edition` on the
  masthead means the snapshot is yesterday's, and the run should notice that
  in the live-context warnings before composing.
- An event date belongs in prose ("on 10 September the IDF said…"), never in
  a card's timestamp.

## 7. Freshness: daily and evergreen

| Cadence | Bands | Expectation |
| --- | --- | --- |
| **Daily** | News & Analysis, Fake Resistance, The People of Israel (live features) | Reviewed every run; changed when something stronger exists; retained with a reason when not |
| **Evergreen, rotated** | October 7, Courage & service, History & context | Rotate on their own per edition; a run recommends new material and never places it |
| **Evergreen, static** | Hero copy, masthead, Behind the desk, Support, header, footer | Development changes only; a run records a `siteRecommendations` line |

A daily band that still shows the same lead after three runs is not
automatically stale — but the third `retain` needs a better reason than the
first. Say what was considered and why it lost.

## 8. Media on the homepage

DNA §6 is the rule set; this is the operating order.

1. **Decision tree:** exact source or documentary imagery → official IDF /
   government / institutional imagery → another safely attributable relevant
   image → an original editorial illustration made for the story → text-led
   with a media warning. Stop at the first rung that works.
2. **Rights unknown = off every public surface.** Send
   `rights.status: "unknown"` honestly; the asset is stored with its
   provenance and not shown. Never upgrade a status to make a card prettier.
3. **Two bars.** The article bar needs `cleared` + `article` in `surfaces`;
   the homepage bar additionally needs `sensitivity: "safe"` and a
   `clearedAt`. A hero that clears the article bar only leaves the homepage
   card text-led, and that is fine.
4. **An editorial illustration is labelled as one.** `generated: true`
   requires `role: "editorial-illustration"` and a non-empty `disclosure`;
   the CHECK constraint refuses anything else. It must contain no fabricated
   quotation, document, logo, identifiable person, battlefield evidence or
   represented real event. **Never an AI image as documentary evidence.**
5. **Caption and credit travel with the image.** `alt` says what is shown,
   `caption` says what it is and when, `credit` names the source. A homepage
   card with a picture and no credit is a report line, not a shrug.
6. **Technical enhancement only.** Upscale, denoise, sharpen, crop, reframe.
   Never change what the image factually shows.
7. **A picture is not a gate.** A placement without a homepage-safe hero
   lands and renders text-led. Report the gap; do not withhold the story.

## 9. Promote, retain, replace, demote, veto

Five actions, one per decision, each with a reason the report will print.

| Action | Meaning | Pairs with in `homepage` |
| --- | --- | --- |
| `promote` | Put a record into an empty slot, or a slot on automatic selection | A `set` on that slot |
| `replace` | Put a record into a slot something else occupies | A `set` on that slot |
| `retain` | Looked, and left it | Nothing (omit the slot) |
| `demote` | Empty the slot; automatic selection takes over | A `remove` on that slot |
| `veto` | A candidate for the cover was refused | Nothing; the candidate is not placed |

Rules:

- **Newer is not stronger** (DNA §7). A record from today does not displace
  one from yesterday because it is from today. It displaces it when it is more
  consequential, better sourced, or a real development of the same story.
- **A real development re-promotes the canonical**, it does not create a rival.
- **Demote when the slot is wrong**, not when it is old: a claim record on the
  news band, a story superseded and archived, a record whose sources
  collapsed.
- **Veto is for the cover as well as for publication.** A story may publish to
  its hub and still be vetoed off the lead because it is thin, or because two
  records would then say the same thing on one screen.
- **A decision without a position is an area-level note** ("kept the People
  band as it stood"); it is not cross-checked against placements.
- **Support blocks are not decisions.** Bands 4 and 9 are an owner ruling;
  if a run thinks one should move, that is a `siteRecommendations` line.

## 10. The `homepageReview` block

Optional on `whole-site-update-v2`, invalid on v1, and expected on every run:
a v2 report without one prints `No homepage review recorded` under
`HOMEPAGE REVIEW`. The contract is `wholeSiteHomepageReviewSchema` in
`server/contracts/whole-site-update.ts`; the mechanism is in
[`../whole-site-updates.md`](../whole-site-updates.md).

| Field | Type | Rule |
| --- | --- | --- |
| `manualVersion` | string, 1–100 | The `Manual version:` line at the top of this file, verbatim |
| `sectionsReviewed` | array of `cover`, `news`, `fakeResistance`, `october7`, `people`, `system`, `support` | 1–7 entries; the bands you looked at. A full run lists all seven |
| `sectionsChanged` | same vocabulary | ≤ 7; must be a subset of `sectionsReviewed`. `cover` changes whenever the news lead does |
| `decisions[]` | ≤ 12 | One per decision, see below |
| `decisions[].area` | `news`, `fakeResistance`, `people` | The placeable areas only |
| `decisions[].position` | `lead`, `secondary`, or absent | Absent = an area-level note, not cross-checked |
| `decisions[].action` | `promote`, `replace`, `retain`, `demote`, `veto` | [§9](#9-promote-retain-replace-demote-veto) |
| `decisions[].publication` | `{ publicId }`, `{ canonicalStoryId }` or `{ operationKey }` | Optional on every action (the schema does not require it); name the record for `promote`, `replace` and `veto` so the report is readable. Exactly one key when present |
| `decisions[].reason` | string, 1–2,000 | Printed in the report, one line per decision |

Cross-checks the validator runs: a `promote` or `replace` with a position
needs a matching `set` on `homepage.<area>.<position>`; a `demote` with a
position needs a matching `remove`; `sectionsChanged ⊆ sectionsReviewed`.
Everything is `.strict()`; an unknown key is a rejection.

A filled example, taken from the al-Taher day. It validated against the
contract with `npm run editorial:publish -- <file> --dry-run` on 2026-09-12:

```json
{
  "contractVersion": "whole-site-update-v2",
  "runId": "2026-09-12-homepage-manual-example",
  "composer": "ChatGPT",
  "createdAt": "2026-09-12T14:05:00.000Z",
  "creates": [],
  "updates": [
    {
      "key": "al-taher-aoun-visit",
      "target": { "publicId": "israel-says-it-has-cleared-hezbollah-s-ali-al-ta-6rr6p" },
      "publication": {
        "title": "Aoun visits south Lebanon as the army takes over the cleared Ali al-Taher positions",
        "body": "The full rewritten article, in the site's own voice, carrying the earlier reporting and today's development.",
        "changeSummary": "Added President Aoun's visit to the cleared Ali al-Taher positions and the Lebanese army's statement; merged the facts from the three earlier records on the same event."
      }
    }
  ],
  "homepage": {
    "news": {
      "lead": { "action": "set", "publication": { "operationKey": "al-taher-aoun-visit" } }
    }
  },
  "siteRecommendations": [
    "Three additional published records cover the Ali al-Taher tunnel event; their facts are now merged into the canonical. Archive them if the owner agrees."
  ],
  "homepageReview": {
    "manualVersion": "2026-09-12.1",
    "sectionsReviewed": ["cover", "news", "fakeResistance", "october7", "people", "system", "support"],
    "sectionsChanged": ["cover", "news"],
    "decisions": [
      {
        "area": "news",
        "position": "lead",
        "action": "replace",
        "publication": { "operationKey": "al-taher-aoun-visit" },
        "reason": "Real development of the developing story already in the slot: the canonical was updated with the Aoun visit rather than duplicated, and re-promoted."
      },
      {
        "area": "news",
        "position": "secondary",
        "action": "retain",
        "reason": "The Houthi companion remains the second most consequential distinct story; nothing published today outranks it."
      },
      {
        "area": "news",
        "action": "veto",
        "publication": { "publicId": "lebanese-army-enters-ali-al-taher-4k2mq" },
        "reason": "Near-duplicate of the canonical lead on the same event; its facts were merged into the update above instead of taking a second slot."
      },
      {
        "area": "fakeResistance",
        "position": "lead",
        "action": "retain",
        "reason": "Today's narrative candidate is thinner than the live influence investigation; newer is not stronger."
      },
      {
        "area": "people",
        "action": "retain",
        "reason": "Band reviewed and kept as it stood; the History & Context explainer is due in two days."
      }
    ]
  }
}
```

The report renders it as a `HOMEPAGE REVIEW` block after `HOMEPAGE`: the
manual version, the sections reviewed and changed, and one line per decision.
`GET /api/internal/editorial-updates/runs/{runId}` returns it in the stored
report, and the automation's run view echoes it beside `research` and
`vetoes`.

## 11. Daily checklist

1. Read `editorial-context`; note the edition date, placements and warnings.
2. Read this manual; copy its version line.
3. Walk bands 1–9 on the live site, desktop and phone, top to bottom.
4. For each developing story with news today: update the canonical, never a
   near-duplicate; set `changeSummary`.
5. Choose the news lead once; the edition rail follows it.
6. Decide each of the six slots: promote, replace, retain, demote, or veto,
   with a reason.
7. Check every card date: `Updated` where revised, published otherwise, one
   format; no ingestion dates on archive cards.
8. Check every homepage picture: rights, role, credit, caption; illustrations
   labelled; rights unknown stays off.
9. Fill `homepageReview` with `manualVersion`, sections reviewed and changed,
   and the decisions; put anything outside content and placement in
   `siteRecommendations`.
10. Deliver the package, read the run report's `HOMEPAGE` and
    `HOMEPAGE REVIEW` blocks, and confirm the live cover matches them.
