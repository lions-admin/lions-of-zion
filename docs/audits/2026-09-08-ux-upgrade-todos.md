# UI/UX upgrade round — audit and task list

**Date:** 8 September 2026.
**Scope, by owner instruction:** the public site and the Ask surface. Not the
admin console. Design, information structure, and copy — with the copy pass
aimed at a **bolder activist register** per `docs/editorial-dna.md` §1
("technological activism … action, exposure, education, documentation, and
tools"; the reader should be *excited*).
**Deliverable of this round:** this document only. Nothing below has been
implemented; no application code, content, or database row was changed.
**Repository baseline for every file reference:** `main` at `a6e3c3c`
(`ai/claude` at `602e603`, which adds only a skill). Every path was checked to
exist at that commit.

**How the evidence was gathered.** A dev server from this worktree on
`http://localhost:3001` against the Preview database. Desktop pass at
1440×900 in Chrome through the `claude-in-chrome` MCP: `/`,
`/geopolitical-brief`, `/fake-resistance`, `/people-of-israel`, `/october-7`,
`/information-war`, `/articles/netanyahu-orders-removal-of-unauthorized-west-ba-ugzzx`,
`/fake-resistance/cases/hinkle-machine`, `/search?q=hezbollah`, `/ask`,
`/support-us`, `/we-are`. Mobile pass at 390×844 (iPhone UA, DPR 2) through
Playwright (`node_modules/playwright`, Chromium 1234) on those plus
`/methodology` and `/fact-check`, with a DOM sweep for text under 13px and
interactive targets under 40px, and the mobile menu opened. Source reads of
the components each finding names. Browser emulation is not iPhone Safari —
`UX-CONTRACT.md` says so and it still holds.

Task IDs are `UX-nn`, a new series; `VA-nn` in
`docs/audits/2026-09-07-visual-audit-implementation-todos.md` is a different
list and this one does not restate it.

---

## 0. How to read this

**Classification** — `FIX` (wrong, must be made right), `IMPROVE` (works, not
good enough), `REDESIGN` (the structure is the problem), `REWRITE` (the words
are the problem), `REMOVE` (too much of it, or in the wrong place).

**Severity** — `A` credibility or correctness; `B` materially holds the site
below premium; `C` polish.

**Status** — `READY` (specified; start now), `NEEDS PRODUCT DECISION` (the
recommendation touches a recorded owner ruling), `NEEDS VISUAL VERIFICATION`
(seen once; confirm before working).

**Path** — everything here is the **development path** (`ai/claude` →
`npm run main:update`). None of it is editorial content a package can fix,
except where a task says so.

**The lenses.** Each finding names the principle it fails so the fix is not a
matter of taste: *Hick* (choices cost decision time), *Miller/chunking*
(ungrouped items overwhelm working memory), *Jakob* (readers arrive with
conventions from other sites), *Peak-End* (an experience is judged by its
peak and its ending), *Doherty* (feedback under 400 ms keeps flow),
*recognition over recall*, *Fitts* (target size and distance), and the
`frontend-design` rule that **structure must mean something** — no decorative
numbering, fake technical labels, or status chips that carry no information.

---

## 1. What is already right — preserve it

- The typographic system: Newsreader display, Plex Sans text, Roboto Mono
  data, the amber accent used sparingly. It is distinctive and it is the
  identity. Nothing below asks for a new palette or a new face.
- The homepage cover (lion + wordmark + standfirst + edition rail) and the
  five-band journey in `components/home/HomepageJourney.tsx`. The order is an
  owner ruling (2026-09-06); the cover's *words* change, its structure does
  not.
- `/information-war`: "This is an *information* war." with the
  repetition-≠-corroboration diagram is the strongest page on the site and
  the register every other page should move toward.
- Image honesty labels ("Editorial illustration — not a photograph of…",
  "Safe cover"), source lines on every card, status-before-claim on
  narrative records, the sensitive-media gate. These are the product; they
  are not clutter.
- The mobile menu's grouping (Reporting & Evidence / People & Purpose) and its
  one-line descriptions — recognition over recall done right. Only the *text*
  of two descriptions is stale (UX-03).
- Body text is never below 16px on a phone; there is no horizontal overflow
  on any of the 13 audited routes.

---

## 2. Voice and copy — the activist register

The site's words describe an institution; the DNA describes an operation.
Today the site introduces itself four different ways in one scroll —
"Evidence desk" (header and footer), "Powered by evidence, not narratives."
(cover), "One desk. A wider record." (journey head), "An independent evidence
network: verified developments, documented sources, and the record behind
them." (footer) — and "Truth Has a Signal" is the `<title>` of every page but
appears nowhere a reader can see. The word "desk" occurs ~90 times in
reader-facing strings. Verbs are passive and archival: *query the corpus, put
a question to the desk, read the record*. Nothing on the site says what the
reader can *do* with what they find, which is §9 of the DNA.

### UX-01 · `REWRITE` · A · `READY` — One sentence about what this is, said the same way everywhere

Decide one positioning line and one one-line descriptor, and use them in the
four places that currently disagree.

- `app/page.tsx:102` cover standfirst — "Powered by evidence, not narratives."
- `components/site/SiteHeader.tsx:216` and `SiteFooter.tsx:37` brand role —
  "Evidence desk"
- `components/home/HomepageJourney.tsx:22` — "One desk. A wider record."
- `lib/site-config.ts:19` — the footer/meta description
- `lib/page-metadata.ts:96–97`, `app/layout.tsx:104,117` — "Truth Has a
  Signal" (title only)

**Direction (proposal, owner picks):** the positioning line is a claim the
reader can act on, not a description of us. Candidates in the register the
DNA asks for: *"Evidence is a weapon. Here is how to use it."* /
*"The information war has a record. Read it, check it, share it."* /
*"Truth has a signal. This is where you find it."* — the last one finally
puts the title on the page. Brand role under the wordmark: *"Open-source
evidence · Israel"* or *"OSINT · AI · The record"* rather than "Evidence
desk". The footer descriptor names the three things the reader can do
(check, trace, share) instead of the three things we hold.

**Done when** the same line appears in all four places, the title matches
the page, and `grep -c "desk" ` across `components/site` and `app/page.tsx`
falls to the instances that name the Ask product.

### UX-02 · `REWRITE` · B · `READY` — Hub ledes and section kickers say what the reader does here

Each hub opens with a kicker + lede written as a catalogue entry:

| Route | Today | Problem |
| --- | --- | --- |
| `/geopolitical-brief` | "The present" / "Reporting on Israel and the region, the daily briefing, and the sources behind every line." | Describes inventory. |
| `/fake-resistance` | "The claim and the record" / "Investigate the record. Distinguish a circulating claim from a finding…" | Closest to right; still addressed to no one. |
| `/people-of-israel` | "A living record" / "People, courage, invention and the living record of Israel — with sources, context and a path to explore further." | "living record" twice; no reason to care. |
| `/october-7` | "Survivor accounts and documented source material preserved with context." | Archive-speak for the page the DNA calls "a destination, not a memorial page". |
| `/search` | "Query the published corpus — briefs, analyses and updates, and the claims behind them." | "corpus" is our word, not the reader's. |
| `/ask` | "Put a question to the desk. Every answer lists what it was built from, or says that it was built from nothing." | Second sentence is the good part; lead with it. |
| `/support-us` | "Ways to join the effort: amplify verified truth, contribute skills, sustain the work." | Fine; make the three verbs the three cards' titles (they already are — align). |

Files: `components/site/HubMasthead.tsx` callers in
`app/geopolitical-brief/page.tsx`, `app/fake-resistance/page.tsx`,
`app/people-of-israel/page.tsx`; `app/october-7/page.tsx`;
`app/search/page.tsx`; `app/ask/page.tsx`; `app/support-us/page.tsx`.

**Direction:** second person, one verb the reader performs, one thing they get.
E.g. Fake Resistance: *"See the claim. See what it was built from. Take the
sourced version with you."* People of Israel: *"The people the narrative
leaves out — with the sources, so you can show them."* October 7: *"What
happened, from the people it happened to. Documented, sourced, and yours to
share."*

### UX-03 · `FIX` · A · `READY` — Stale and contradictory copy

- `lib/site-navigation.ts` News & Analysis description: "News, **war updates**
  and deeper analysis…" — `war_update` was removed 2026-09-05 and
  `/war-update` is a redirect (`CLAUDE.md`). Fake Resistance description:
  "…and **the daily X review**" — no route, section, or component on the site
  is called that.
- `lib/content/october-7.ts:155,164` timeline entries: "see **War Update** for
  the ceasefire process…" / "see War Update for how it has held since" — sends
  the reader to a section that no longer exists.
- Header account control flips label on every signed-out page load:
  server-rendered "Account", then "Sign in" once `/api/public-auth/session`
  answers (`components/site/SiteHeader.tsx:164`). The reasoning in the comment
  is sound (never greet a signed-in reader with "Sign in"); the visible
  consequence is a word that changes in the chrome ~1 s after paint on every
  page. Observed twice in the desktop pass (`/people-of-israel`, `/october-7`).
  Fix: reserve the width and render the neutral label as an icon-only control
  until `known`, or keep "Account" always and let the account page say the
  rest — the description on `ACCOUNT_LINK` already does.

### UX-04 · `REWRITE` · A · `READY` — System language leaks into reader-facing surfaces

Each of these shows the reader a sentence written for an operator:

- Search failure: "The request failed (HTTP 429)." —
  `components/search/http.ts:99`; session: "The session check failed (HTTP
  …)" — `components/auth/PublicSessionProvider.tsx:94`. `SearchPanel.tsx:434`
  already has the right title ("Too many searches, too fast.") and then
  prints the HTTP line under it. A reader never needs a status code; say what
  to do ("Wait a moment and search again.").
- Article corrections block renders operator version notes verbatim
  (`components/content/CorrectionHistory.tsx:55` prints `correction.note`):
  on the audited article the reader sees "v4 — Attach the in-house editorial
  cover illustration after production media materialization was re-verified.
  Article substance unchanged." and "v3 — Attached an original disclosed
  editorial illustration for policy analysis…". This is the **last thing on
  the page** (Peak-End) and it is a changelog. Either the contract carries a
  reader-facing `summary` distinct from the operator `note`, or the block
  shows only substantive corrections and collapses media/metadata versions
  into one line ("Illustration attached · 7 Sept").
- Article metadata labels "Source stack", "Primary actor", "Arena"
  (`app/articles/[publicId]/page.tsx` dossier `<dl>`) — taxonomy names, not
  reader words. "Sources", "Who", "Where".
- October 7 share explainer: "Where original media is held here, X can prepare
  the archived file for native posting; text-only records keep a link-sharing
  fallback." (`app/october-7/ArchiveShareShowcase.tsx`) — one sentence, reader
  terms: "Graphic media stays covered in previews. Share the record; the
  original is one click behind the warning."
- Ask composer placeholder "What does the desk hold on…" reads as a broken
  sentence (`components/ask/AskComposer.tsx:49`, `AskDesk.tsx:236`). "Ask about a claim, an event, a
  source…"

### UX-05 · `REWRITE` · B · `READY` — One verb table for every card action

The same action is labelled six ways across the homepage alone: "Read the
story", "Read the record", "Read the full story", "Open the investigation",
"Open the record with a content warning", "View the record" (hub). Readers
learn a verb once (Jakob; recognition over recall). Define:

| Destination | Verb |
| --- | --- |
| News/Israel-update article | Read the story |
| Narrative-watch / fact-check record | See the evidence |
| Investigation case | Open the investigation |
| Testimony | Read the testimony |
| Documented record behind a warning | Open with a content warning |
| Person profile | Read their story |
| Hub "everything" link | All of *Section* → |

Then apply it in `components/home/*Section.tsx`, `HomeJourneyPrimitives.tsx`,
hub pages, and `app/october-7/*`. Put the table in `UX-CONTRACT.md` under a
new "Verbs" heading so the next composer keeps it.

### UX-06 · `IMPROVE` · B · `READY` — Every hub and every article ends with something the reader can do

DNA §9 lists eight reader activations. Today the only surfaces that offer one
are the October 7 share showcase and the article share bar (which is placed
*before* the body — UX-16). Add a closing band to hub pages and article pages
— *"Check it yourself"* — with at most three actions (Hick): trace the sources
(link to the source list), share the sourced record, report a claim
(`/support-us#report`). This is where the activist register lives, and it
gives each page a designed ending (Peak-End) instead of the corrections
changelog or the footer.

Files: new `components/content/ActivationBand.tsx` (one owner; reuse
`components/support/` link primitives and `lib/content/share-text.ts`),
consumed by `app/articles/[publicId]/page.tsx` and the three hub pages.

---

## 3. Chrome, navigation and layout

### UX-07 · `FIX` · A · `READY` — The fixed Ask dock covers content

`components/ask/PublicAskDock.tsx` (mounted in `app/layout.tsx:174`,
`ask.module.css:761–763` `position: fixed`) sits bottom-right on every
non-home page. Observed covering: the footer "Back to the top" control
(`/search`, case page, desktop); the lead headline on `/geopolitical-brief`
at 390px; the hero image on the article at 390px; the "Volunteer a skill"
card on `/support-us` at 390px; body text on `/information-war` at 1440px.
`UX-CONTRACT.md` already says "Ask must not cover links, warnings or media
credits on mobile"; it does.

Fix options, in order of preference: (1) reserve a lane — `padding-inline-end`
on the page container equal to the dock width at ≥1024, and on phones move
the dock into the header row as a fourth icon (the homepage already does this
with `<AskDock home />` at `SiteHeader.tsx:235`); (2) hide the dock while the
footer is in view; (3) shrink it to an icon when the reader scrolls down and
expand on scroll up. Option 1 also resolves UX-08.

### UX-08 · `FIX` · B · `READY` — Two different headers, one site

Home: wordmark · "Ask the desk" pill · search · Menu · Support Us · Sign in,
no section links. Every other page: wordmark · four section links · search ·
Menu · Support Us · Sign in, and the Ask control moves to a floating dock.
`components/site/SiteHeader.tsx` branches on `home`. The reader learns the
bar on the cover and then finds a different bar on page two (Jakob). Keep one
bar: section links appear on the cover too (they are the journey), the Ask
control lives in the bar everywhere (or in the dock everywhere — not both).

### UX-09 · `IMPROVE` · C · `READY` — Arrows mean two things

`↗` marks external links (PayPal, Buy a coffee, "Every publication ↗") *and*
every internal link in the footer "Explore" grid and the mobile menu
(`components/site/SiteFooter.tsx`, `SiteHeader.tsx` menu). Readers read ↗ as
"leaves the site" (Jakob). Internal navigation uses → or no glyph; ↗ is
reserved for off-site.

### UX-10 · `FIX` · B · `READY` — Type below the floors the contract sets

`UX-CONTRACT.md`: on a phone metadata/captions never below 13px, kickers
never below 11px. Measured at 390px:

- `.header[data-home] .brandRole` **8px** (`site-header.module.css:874`), 9px
  at the next breakpoint (`:862`).
- `/information-war` eyebrows **9–10px**
  (`information-war-system-module` `eyebrow`, `diagramLabel`, figcaption).
- `/october-7` `entryKind` **10px**, `eyebrow`/`entryCount` 11px.
- `dt` labels in every hub masthead and the article dossier **12px**; hub
  kickers 12px; homepage `time.meta` and `editionDate` 11px; image disclosure
  and credit 12px.

Raise `--t-data` consumers on phones to 13px and the hub/article `dt` to
`--t-caption`; delete the 8/9px overrides. The 12px mono is the single most
repeated reason the site reads as a dashboard rather than a publication.

### UX-11 · `FIX` · B · `READY` — Targets under 44px

- Ask composer submit button **32×32** (`components/ask/AskComposer.tsx`).
- Standalone links rendered at 15–22px height: "Original archive record",
  "Killing of Aner Shapira", "Image source", "CC BY 4.0" (homepage);
  "Everything on News & Analysis" (article, 234×22); "Link to this check"
  (fact-check, 130×16); `/methodology` and `/we-are` inline navigation links
  at 22px. Inline links inside prose are exempt; the ones above are standalone
  controls and get `min-block-size: 44px` with the text vertically centred, or
  a padded hit area.

---

## 4. Homepage

### UX-12 · `FIX` · B · `NEEDS VISUAL VERIFICATION` — Lazy images paint as empty dark boxes

On first desktop load, three homepage tiles (Kharg Island, European rabbis,
West Bank outposts) and every "More updates" thumbnail on
`/geopolitical-brief` rendered as bordered empty rectangles for several
seconds and only filled on a later scroll. The geometry is stable (CLS 0 is
preserved) but an empty bordered box reads as "broken image", which on a site
whose product is evidence is a credibility cost, and >400 ms of blank is a
Doherty failure. Confirm whether this is dev-server compile latency or
Production behaviour (check `lionsofzion.io` with cache disabled). If it
reproduces: give `HomeMedia` (`components/home/HomeJourneyPrimitives.tsx`) and
the update-list thumbnails a `placeholder="blur"` from a tiny LQIP stored with
the media record, or at minimum a tonal placeholder with the disclosure label
already visible, so the box is never empty.

### UX-13 · `REMOVE` · B · `NEEDS PRODUCT DECISION` — The ask on the cover

The cover carries "Support the desk · PayPal ↗ | Buy a coffee ↗" below the
edition rail (`components/home/HeroSupportStrip.tsx`). `docs/editorial-dna.md` §2 and
`.ai/DECISIONS.md` (2026-09-07) place the ask in `HomeSupportSection` "after
the reader has seen what it pays for". Two asks on one page, one before any
value is shown, is the pattern the ruling was written against. Recommendation:
remove the cover chips; the header "Support Us" control and the closing band
remain. Owner decides — the chips may have been a deliberate VA-series
addition.

### UX-14 · `IMPROVE` · C · `READY` — "Anatomy of an echo" numbering

`components/home/HomeSystemSection.tsx` numbers "01
Original post / 02 The repost / 03 The headline" — this one *is* a sequence
and the numbers earn their place. Keep. But the "3" display numeral beside
"Three versions. How many sources?" (`components/home/AmplificationFigure.tsx:43`) is a second, decorative statement of the
same count. Drop the numeral or drop the word.

---

## 5. Hub pages

### UX-15 · `REDESIGN` · B · `READY` — The KPI rail

`components/site/HubMasthead.tsx:46` renders a `<dl class="facts">` on every
hub: "LAST PUBLISHED · STORIES ON FILE 23 · DAILY BRIEFINGS 8 · TIMES
Jerusalem" (news); "INVESTIGATIONS 7 · ON THE WATCH 7 · ANTISEMITISM RECORDS
1 · INFLUENCE INVESTIGATIONS 4" (fake resistance); "PUBLISHED RECORDS 5 ·
DOCUMENTED HERO PROFILES 3" (people). Small integers in 12px mono caps are a
dashboard convention and, at these values, advertise thinness ("1
antisemitism record"). `frontend-design` §5: structure must encode real
information; a count the reader cannot act on does not. Replace with one
sentence in the lede's voice that carries the *useful* fact — when the hub
last changed ("Updated 4:18 this morning · Jerusalem time") — and move any
count that matters into the section head it belongs to.

### UX-16 · `REDESIGN` · B · `READY` — People of Israel is a narrow column in an empty room

At 1440px `app/people-of-israel/page.tsx` renders its groups in a single
column roughly a third of the measure wide with the rest of the viewport
empty; there is a blank band between the tab row and "New records from the
desk"; the hub holds 5 records. The layout tells the reader the section is
unfinished. Options: (1) a two-column editorial grid at ≥1024 with the hero
profiles (already rich: portraits, "Rescuer / Fallen / Fighter") promoted to
the top band; (2) merge the sparse `Innovation` / `Technology & AI` /
`Science & Medicine` groups into one "New records" list with section kickers
instead of three headed groups. This hub is where the DNA wants the reader
"excited about Israeli creativity"; it is currently the quietest page on the
site.

### UX-17 · `REMOVE` · C · `READY` — Topic chips on the news hub

At 390px each "More updates" entry on `/geopolitical-brief` carries up to
three boxed chips — "Yemen And Red Sea", "Houthis And Yemeni Government
Forces", "West Bank Settler Outposts" — machine title-case (capital "And")
in bordered boxes. They triple the vertical cost of each entry
(Miller/chunking) and are not links. Either make them filters that do
something, or render them as one plain-text kicker line in sentence case
("Yemen and Red Sea · Houthis"), which the entry already has above the
headline. Source: the update-list entry in `components/briefs/LiveBriefHub.tsx`.

### UX-18 · `IMPROVE` · C · `READY` — Rank numbers in "More updates"

"02 … 05" beside update entries are rank, not sequence. Remove, or make them
the "1–5" of a "top five today" the copy names.

---

## 6. Article and case pages

### UX-19 · `REDESIGN` · B · `READY` — The share bar asks before the reader has read

`app/articles/[publicId]/page.tsx` places "Copy the sourced record · Share… ·
Share on X · Facebook" between the dossier and the first paragraph. Four
buttons (Hick) at the moment of least commitment. Move the bar to the end of
the body inside the activation band (UX-06), keep one quiet "Copy the sourced
record" affordance at the top if the owner wants a top action at all.

### UX-20 · `IMPROVE` · B · `READY` — The article's ending

Today the order after the body is: "Also on this desk" → "Everything on News
& Analysis" (22px link) → "Corrections and updates" with operator notes
(UX-04) → footer. The ending should be, in order: sources (the proof), the
activation band (what to do with it), corrections (only substantive ones),
related reading. Peak-End: the last screen is the one the reader keeps.

### UX-21 · `IMPROVE` · C · `READY` — Dossier labels

"AUTHORSHIP / PUBLISHED / UPDATED / SOURCE STACK / TOPIC / PRIMARY ACTOR /
ARENA" — seven 12px mono labels in a 3×3 grid above the fold. Keep
Published/Updated/Sources as one metadata line; move Topic/Actor/Arena into
the kicker ("West Bank · Benjamin Netanyahu") or drop them. "Researched,
written and published by the Lions of Zion editorial system" is the honest
machine-authorship disclosure and stays — one line, not a cell.

---

## 7. October 7

### UX-22 · `REDESIGN` · B · `READY` — Ten buttons and a 12-second clock on the memorial destination

`app/october-7/ArchiveShareShowcase.tsx`: two cards, each with five controls
("Copy story to share", "Share…", "Share original image/video", "Post on X",
"Facebook"), the primary in solid amber — the only solid-filled buttons on the
site — and the pair auto-rotates every 12 s (`ROTATION_MS = 12000`, `:41`)
with "A new selection every 12 seconds. Pause to take your time." Ten
controls is a Hick failure; an auto-advancing carousel of testimonies is the
wrong motion for the subject and the `frontend-design` rule (one purposeful
motion idea; motion here is the timer, not the content). Recommendation: no
auto-rotation (arrows stay; reduced-motion already forces this — make it the
default); one primary "Share this testimony" that opens the app-owned share
sheet with the four targets inside it; the explanatory paragraph shortened
per UX-04.

### UX-23 · `IMPROVE` · C · `READY` — Count lines

"179 survivor stories · 335 documented records · 7 languages" in the hero and
again as "179 STORIES" / "335 RECORDS" on the collection cards — the same
counts twice within one viewport. Keep one.

---

## 8. Ask

### UX-24 · `IMPROVE` · B · `READY` — Ask's first screen should invite the reader's own question

`app/ask/page.tsx` / `components/ask/AskDesk.tsx`: lede (passive, UX-02), a
serif prompt line, "SUGGESTED QUESTIONS" label, three suggestions in bordered
boxes, then the composer below the fold at 390px. Reorder: composer first
with the activist placeholder (UX-04), suggestions as plain-text chips under
it, one line of provenance promise ("Every answer shows what it was built
from — or says it found nothing."). The suggestions themselves should be the
questions an activist asks: *"Is this video really from Gaza?"*, *"Who first
posted this claim?"*, *"What does the record say about the Nova festival?"*.

### UX-25 · `REMOVE` · B · `NEEDS PRODUCT DECISION` — The drifting monitoring rows behind Ask, Search, Support and Fact-check

`components/sections/ScanBackdrop.tsx` renders "server-rendered rows of the
real monitoring corpus, drifting by CSS" — "SOURCE MONITOR: recycled Syrian
war footage…", "LIVE HASHTAG: #Palestine", "PROPAGANDA WATCH: …" — at 12px,
very low contrast, behind the page. It is `aria-hidden`, so accessibility is
fine. Two problems: at 1440px the rows are faint enough to read as a rendering
smudge at the page edges (seen on `/ask`, `/search`, `/support-us`,
`/we-are`), and the labels "LIVE HASHTAG" / "SOURCE MONITOR" are the fake
telemetry the `frontend-design` skill warns against — `/fake-resistance`
itself says "Published monitoring. Not a live scan." Recommendation: remove
the backdrop from Ask/Search/Support (task surfaces need a quiet ground) and
keep it, if at all, on `/fact-check` where the rows are the content. Owner
decision because it was an intentional replacement for the retired WebGPU
layer (comment in the file, 2026-09-05).

### UX-26 · `FIX` · C · `READY` — Ask submit target

32×32 (UX-11). Also give the composer a visible "Send" label at ≥768 rather
than the ↵ glyph alone.

---

## 9. Search and system states

### UX-27 · `FIX` · A · `NEEDS VISUAL VERIFICATION` — Search rate-limited inside one short session

`/search?q=hezbollah` returned "The search failed. The request failed (HTTP
429)." after fewer than ten searches from one browser, against
`SEARCH_QUERIES = { limit: 120, windowSeconds: 60 }`
(`server/core/rate-limit.ts:29`). Either the panel issues far more requests
than the reader's keystrokes (check `useSearch.ts` debounce and retry), or the
bucket is shared across every dev server pointed at the Preview database
(`rateLimit` in `server/modules/reports`, keyed by `bucketFor(request,
"search")`). Reproduce on Production before changing the policy; fix the copy
regardless (UX-04) and make the `limited` branch in `SearchPanel.tsx:434` the
only text shown when it is a 429.

### UX-28 · `IMPROVE` · C · `READY` — Pending and keyboard-hint copy

"Searching the index…" (`SearchPanel.tsx:215`) → "Searching…"; "Matching on
words and names." (`vocabulary.ts:151`) is a capability note nobody asked for
— remove or move to the empty state. The
keyboard legend (↑ ↓ move · ↵ open · esc clear) is right; it is 12px mono and
should follow UX-10.

---

## 10. Support and We Are

### UX-29 · `FIX` · B · `NEEDS VISUAL VERIFICATION` — Reveal-on-scroll leaves in-viewport content ghosted

At 1440×900, two seconds after load, `/support-us` showed "Choose how to help"
and its four cards at low opacity, and `/we-are` showed "Who we are" and its
paragraph the same way — content already inside the first viewport waiting
for a scroll it does not need (`components/motion/Reveal.tsx`, shared
IntersectionObserver). The 390px Playwright pass (which scrolls) shows full
opacity, so this may be timing-only; confirm with a no-scroll screenshot at
3 s. If it holds: elements intersecting at registration time reveal
immediately, and `prefers-reduced-motion` reveals everything at once.

### UX-30 · `REWRITE` · C · `READY` — Support page prose

"Four ways to act, and one of them is enough. Pick one — the other three stay
a single step away, and nothing you have already typed is lost by looking."
is three sentences about the form's state machine. The reader needs one:
*"Pick one. Nothing you type is lost if you change your mind."* The four card
titles (Report a claim / Volunteer a skill / Share what is verified / Donate)
are right.

---

## 11. Design-system consolidation

### UX-31 · `IMPROVE` · B · `READY` — One rule for the mono-caps eyebrow

Kickers, eyebrows, `dt` labels, dates, counts and keyboard hints all use the
same 11–12px tracked mono caps. The reader cannot tell a section label from a
timestamp from a warning. Define three roles in `app/globals.css`
(`--t-data` is one; add `--t-kicker` at 13px serif-or-sans small caps for
section labels and keep mono strictly for machine values: dates, counts,
keys) and sweep the consumers. This is the sweep that turns "dashboard" into
"publication" and it pairs with UX-10 and UX-15.

### UX-32 · `IMPROVE` · C · `READY` — Solid-filled buttons

Only the October 7 share primaries are solid amber; everywhere else the
primary action is an underlined text link with an arrow. Decide the button
hierarchy once (`components/ui/Button`, `UX-CONTRACT.md` "Canonical owners")
and use it: solid for the one primary action on a task surface (Ask send,
Support cards' action, share sheet primary), outline for secondary, link for
navigation. Then the October 7 stack (UX-22) and the article share bar
(UX-19) follow the same rule.

---

## 12. Execution plan for the next round

### Order

1. **Words first** (UX-01, 02, 03, 04, 05, 30) — every later task touches the
   same strings; settle them before layout moves.
2. **Chrome** (UX-07, 08, 09, 10, 11) — visible on every page; unblocks
   mobile verification of everything else.
3. **Endings and activation** (UX-06, 19, 20, 21) — the article, then hubs.
4. **Hubs** (UX-15, 16, 17, 18, 23).
5. **October 7 and Ask** (UX-22, 24, 26, 28).
6. **Verification-gated** (UX-12, 27, 29) — verify first, then fix if real.
7. **Owner decisions** (UX-13, 25) — ask, do not assume.
8. **Consolidation sweep** (UX-31, 32) last, once the surfaces above are
   stable, so the sweep is mechanical.

### Parallel workstreams and file ownership

Splittable into five streams with no shared files, provided the copy table
from stream W1 is written **before** W2–W5 start (it is a document, not a
code dependency).

| Stream | Owns | Tasks |
| --- | --- | --- |
| **W1 Copy & voice** | `lib/site-navigation.ts`, `lib/site-config.ts`, `lib/page-metadata.ts`, `lib/content/october-7.ts`, `components/site/navigation-model.ts`, `components/search/http.ts`, `UX-CONTRACT.md` (Verbs + Voice sections), a copy table `docs/audits/2026-09-08-copy-table.md` | UX-01 (strings), 02 (table), 03, 04 (strings), 05 (table), 30 |
| **W2 Chrome** | `components/site/SiteHeader.tsx` + `.module.css`, `SiteFooter.tsx` + `.module.css`, `components/ask/PublicAskDock.tsx`, `AskDock.tsx`, `ask.module.css` (dock rules only), `app/globals.css` type floors | UX-07, 08, 09, 10, 11 (header/footer/dock), 31 (tokens only) |
| **W3 Hubs** | `components/site/HubMasthead.tsx` + css, `app/geopolitical-brief/*`, `components/briefs/LiveBriefHub.tsx`, `app/fake-resistance/page.tsx` + css, `app/people-of-israel/*` | UX-02 (apply), 15, 16, 17, 18 |
| **W4 Article & October 7** | `app/articles/[publicId]/*`, `components/content/CorrectionHistory.tsx`, new `components/content/ActivationBand.tsx`, `app/october-7/*` | UX-04 (article/oct-7 strings), 06, 19, 20, 21, 22, 23 |
| **W5 Ask, Search, Support** | `components/ask/*` except the dock files W2 owns, `app/ask/*`, `components/search/SearchPanel.tsx`, `useSearch.ts`, `app/search/*`, `app/support-us/*`, `components/motion/Reveal.tsx`, `components/sections/ScanBackdrop.tsx` | UX-24, 26, 27, 28, 29, (25 after decision) |

Homepage tasks (UX-12, 13, 14) go to whichever stream finishes first; they
touch `app/page.tsx` and `components/home/*`, which no stream above owns.

`components/ui/Button` (UX-32) is a shared primitive: one owner (W2), and
W4/W5 consume it only after W2 lands it.

### Verification, once, at the end

- `npm run verify:changed` per stream; `npm run verify:full` before publish
  because `app/globals.css` and `components/ui` are shared.
- The 390px Playwright sweep used for this audit (script in the session
  scratchpad; recreate as `scripts/ui-audit.mjs` input if it is not already
  covered) on the 13 routes, asserting: no text under 13px except inline data
  values, no standalone target under 44px, no horizontal overflow, Ask dock
  not intersecting any link or image.
- Desktop screenshots at 1440 and 1280 of the four hubs, the article, Ask.
- One read-only review pass on a light model (`invariant-reviewer` is not
  needed — nothing here touches `server/`; use `Agent` with `model: haiku`
  against `references/anti-patterns.md` and `verification-checklist.md` in
  `.claude/skills/frontend-design-premium`).
- Real-device iPhone Safari check remains the owner's, per `TODOS.md` §1.

### Do not change

The palette, the three type families, the amber-scarcity rule, the journey
order, the section→surface derivation in `lib/publication-routing.ts`, the
image-honesty labels, the sensitive-media gate, `evidenceBasis` rendering,
`narrativeWatchTitle()`, and anything under `server/` or `app/api/`.

---

## 13. Execution record — round two, 8–9 September 2026

Owner rulings before work started: **UX-13 relocate, do not remove**;
**UX-25 keep the backdrop**. Six streams ran on disjoint files; W1 and W4
completed, W2/W3/W5/W6 were cut off by the account's session limit after
most of their work had landed, and the lead finished the remainder in the
main session (owner ruling: no respawn). The decided copy is
`docs/audits/2026-09-08-copy-table.md`; the register rule and the verb table
are now in `UX-CONTRACT.md`.

| Task | Result |
| --- | --- |
| UX-01 | Done. Cover "Truth has a signal. Find it, check it, share it."; brand role "Evidence, not narratives"; journey head; site description. |
| UX-02 | Done. Kicker + lede on all four hubs (`SectionPage` gained a `kicker` prop for October 7), Search, Ask, Support; six nav descriptions. |
| UX-03 | Done. "war updates" / "daily X review" gone (nav, `/geopolitical-brief` metadata, `StorySections`, import script); October 7 timeline no longer points at War Update; the account control no longer flips label after the session check. |
| UX-04 | Done. Search/session errors carry no status code (and `http.ts` now parses the API's nested `{ error: { code } }`, which is why the `limited` branch never fired before); corrections block classifies notes and collapses attachment versions behind "Version history"; dossier labels Written by / Sources; October 7 explainer; Ask placeholder. |
| UX-05 | Done. `lib/publication-routing.ts` DESTINATIONS carry the verb table (See the evidence / Read the story / Read their story); an analysis record that cites nothing says "Read the assessment" — there is no evidence to see. |
| UX-06 | Done. `components/content/ActivationBand.tsx` (+ `ShareSheet`) on the article and the three hubs. |
| UX-07 / 08 | Done. `PublicAskDock` removed; the Ask control lives in the header row on every page at every width; one header. Sweep at 390 and 1440: no fixed element intersects a link, image or heading. |
| UX-09 | Done. ↗ only on off-site links. |
| UX-10 / 31 | Done. `--t-kicker` role + `.kickerLabel`; `--t-data` is 13px under 48rem; 8/9px overrides deleted; hub, narrative-record, October 7, information-war and homepage labels raised. Remaining below 13px on phones, by design: the "01–04" numerals inside the `/information-war` diagram (9–10px, decorative glyphs beside 13px labels) and the `↗︎` icon glyph. |
| UX-11 | Done for standalone controls (header/footer, breadcrumb, source lists, Ask send 44px, search clear 44px, TOC rails, fact-check permalinks, people names, we-are/methodology "Read next"). Fact-check entry titles measure 39px tall at 390 — block links wrapping two lines; left as is. |
| UX-12 | Verified: the blank tiles were dev-server compile latency plus lazy decode; the media contract carries no LQIP, so `HomeMedia` now paints the disclosure label on a tonal ground instead of an empty box. |
| UX-13 | Relocated per owner: `HeroSupportStrip` renders after `HomeNewsSection`, before the Narratives band; cover keeps wordmark, standfirst, "Read the latest", edition rail. |
| UX-14 | Done (numeral dropped, sequence kept). |
| UX-15–18 | Done. KPI rail → "Updated 7 September at 4:18 · Jerusalem time"; People hub two-column at ≥64rem with hero profiles promoted and one merged records list; topic chips → one sentence-case kicker; rank numbers gone. |
| UX-19–23 | Done. Article ends sources → activation band → corrections → "Keep reading"; no auto-rotation on October 7, one primary share per card opening the app-owned sheet; counts once. |
| UX-24 / 26 / 28 | Done. Composer first, three activist suggestions, 44px Send with a label at ≥768; "Searching…"; matching note only in the empty state. |
| UX-25 | Kept per owner. Row opacity ceiling 0.1 → 0.2 with the two dimmers re-tuned so a row reads as decoration, not a smear; `tests/scan-register-intent.test.ts` updated to the new ceiling. |
| UX-27 | Two causes, both fixed. Client: `useSearch.ts` debounce was 120 ms, so a slow typist sent one request per keystroke and the server counted every aborted one (15 requests for one query, measured); now 300 ms. Server: the semantic arm's embedder is gated by `assertWithinBudget`, and an exhausted AI budget made *every* search a 429 on Preview — `searchService` now degrades a query-time embedder failure to lexical and reports `semantic: false` (reindexing stays strict; `tests/search.test.ts` covers it). `server/core/rate-limit.ts` untouched. The Preview AI budget itself ($0.50/month, $1.68 spent) is an operations setting for the owner. |
| UX-29 | Not reproduced: 0 ghosted in-viewport elements 3 s after load on `/support-us` and `/we-are` at 1440×900. The 2026-09-08 sighting was dev-server timing. `Reveal.tsx` unchanged. |
| UX-30 / 32 | Done. |

**Verification on the integrated tree:** `npm run typecheck` clean; `npm run
lint` 0 errors (12 pre-existing warnings in files this round did not touch);
full `vitest run` 1661 passed, 1 skipped, **8 failed in
`tests/publication-provenance-copy.test.ts` and
`tests/public-copy-truthfulness.test.ts` — pre-existing**: the phrases they
assert ("AI output is never evidence", "privately funded independent
initiative", "Gate — human path only", …) are absent from `/we-are` and
`/methodology` at `main` `a6e3c3c` as well, so those tests describe a
trust-page copy task that never landed and are outside this round.
Playwright sweep at 390×844 and 1440×900 over 13 routes: no horizontal
overflow, no page errors, no stale strings, no fixed-element overlap.
Screenshots in the session scratchpad only.

**Not done, deliberately:** a production build was not run here (owner
publishes with `npm run main:update`, whose CI runs it); real iPhone Safari
remains the owner's check.
