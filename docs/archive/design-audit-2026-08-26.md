# Design audit — 2026-08-26

> **Amended 2026-09-01, by explicit owner decision.** The crowned-lion radial
> navigation was deleted from the project, and the owner ruled that it be purged
> from the historical record as well as from the live documentation. **Eight
> home-scene findings about the orbit menu, the network scan and the hover card
> were removed from this file**, so the counts stated below no longer match what
> it contains. That is a deliberate break of the archive's own "a record is
> never corrected" rule; it is recorded in `.ai/DECISIONS.md` (2026-09-01). The
> cinematic intro was kept, and every intro finding stands as filed.

Five agents audited five surface families of the frontend — the home
experience, the reading system, the eight destination pages, the October 7
archives and the Geopolitical Brief, and the cross-cutting concerns
(accessibility, responsive behaviour, motion, interaction). Every finding
was then re-verified against the source by an adversarial pass that
re-derived each number, re-read each anchor, and checked each
recommendation against `CLAUDE.md`'s invariants and `.ai/DECISIONS.md`.
**84 findings were filed. 10 survived verification unchanged (CONFIRMED),
71 survived with corrected numbers, scope or reasoning (PARTIAL), and 3
were refuted outright.** Six pairs of findings turned out to be the same
defect seen from two surfaces and are merged here, leaving **75 findings**:
12 high, 37 medium, 26 low. Seven were filed as critical; none survived
verification at that level, which is itself the headline result — this
codebase has no reader-facing defect that stops a visitor from reading,
navigating, or trusting a page.

Method: source-only for the home scene and the reading system (the dev
server did not answer for those two agents); live-render measurement in
Playwright's bundled Chromium at 1440×900 and 390×844 for the section
pages, the archives and the cross-cutting sweep. Every contrast ratio
below is a relative-luminance computation against the background the
element actually composites onto, not a token-vs-token comparison. Every
census figure was recomputed from `content-packages/` or from `grep` over
`app/` and `components/` during verification; where the original figure was
wrong the corrected one is used and the correction is stated.

---

## What the audit concludes

The V2 pass worked. The type scale, the six-colour palette and the
centred measure hold across all ten reading routes, the evidence margin is
a genuinely good structural idea and it is implemented as a grid rather
than a hack, and the reduced-motion coverage is unusually complete — 18 of
20 CSS files carry a `prefers-reduced-motion` block covering their own
animations. The reading palette is sound: `--ink-lo` measures 5.0–6.4:1
and `--gold` 6.5–8.2:1 against the composited ground across the full range
of `--scan-ground` overlays. Nothing in the audit argues for redesigning
what V2 produced.

What the audit found instead is three structural problems, and most of the
75 findings are downstream of one of them.

**First: the archive was attached to the site but never designed into it.**
1,175 record pages — 57% of the routes on the site — render through
`DocPage`, a shell whose own header comment says it was written for "short
policy pages, not documents with sections to navigate". The consequences
compound: 661 non-English pages declare `lang="en"`; the provenance footer
computes to 17px full-ink tracked mono instead of the 11.5px `--ink-lo` its
own CSS declares, because `:where(.body) p` outranks an inherited value;
every record page's only exits are two links to `/`; both indexes emit
every row with no filter and sit inside an inner scroll container so Back
never returns you to row 250; and the same nine disinformation-monitor
fragments drift behind every testimony because all 1,175 pages seed the
scan from one `routeId`. None of these is a hard bug. Together they are a
57%-of-the-site surface that reads as generated rather than published,
which is the precise opposite of what an evidentiary archive needs to
project.

**Second: the shell's contracts are stated in comments and enforced by
nothing.** `--content-w` assumes 208px rails at a breakpoint where the grid
resolves them to 178.6px; `MOBILE_MAX_WIDTH`'s comment claims "every layer
that asks" while two layers hardcode their own numbers; `.groupHeading
:first-of-type` zeroes the margin on all seven category headings because
each sits in its own `<section>`; `.page:focus-within` outranks
`.registerMuted` so the one page documented as "the scan nearly holds its
breath" gets 33% louder when a reader engages with it; the reading-progress
bar's painted default is `scaleX(1)`, so with JavaScript off it reports a
document fully read; three simulation dials ship at `0` under comments
describing motion the code cannot produce. Each is a one-line fix. The
pattern is that a written intent and the CSS or TS that implements it
drifted apart with no test between them, and there is now enough of that to
be a maintenance property rather than a set of accidents.

**Third: the type system was collapsed on two axes and left free on the
third.** `globals.css` declares three faces, seven size steps with paired
line-heights and weights, six colours, two hairlines — and not one spacing
token. Seventy-one distinct rem spacing values exist across `app/` and
`components/`, 37 inside the three reading files alone, 15 of them in the
0.2–0.9rem band. That is fifteen different answers to "how big is a small
gap", and it produces a visible defect: body-size prose gets 1.15rem
between paragraphs inside a `SectionBlock` and 0.7rem inside a `Timeline`,
and the two meet mid-column on `/fake-resistance` and `/october-7`. The
same unfinished-axis problem shows in the two surfaces V2 never reached —
`app/error.tsx` and `components/chat/` — which between them hold every
retired pattern the redesign was written to kill, because both hide their
CSS somewhere a CSS grep does not look.

The editorial layer is the strongest part of the site and also carries the
audit's two sharpest content findings: `/methodology`, which three separate
surfaces route readers to for sourcing standards, states none; and
`/israels-story`, the flagship history page, cites Wikipedia for seven of
its eight sources in the very margin device built to display evidence,
directly above a closing block that reads "Every historical claim above is
built to be checked." Neither is a rendering problem. Both are the site's
own claim about itself failing at the one place a hostile reader would
check first.

---

## Do these first

Ranked by reader impact × confidence, divided by effort — not by severity
alone. The first nine are all one file each.

| # | id | What it is | Surface | Sev | Effort |
| --- | --- | --- | --- | --- | --- |
| 1 | `archive-brief-provenance-renders-at-body-size-not-at-the-data-floor` | Provenance footer computes 17px full-ink mono instead of the declared 11.5px `--ink-lo` | 1,175 record pages | high | trivial |
| 2 | `cross-cutting-three-webgpu-on-every-route` | Three.js WebGPU + TSL + R3F in the shared chunk of every route via a static import in the root layout | every route | high | trivial |
| 3 | `archive-brief-testimony-opens-with-the-source-sites-breadcrumb` | 367 testimonies open their body with october7.org's nav breadcrumb, set as prose | `/october-7/testimonies` | high | small |
| 4 | `archive-brief-documentation-record-says-one-sentence-three-times` | All 670 documentation pages print the title as h1 then again as h2; 336 also as the body paragraph | `/october-7/documentation` | high | small |
| 5 | `archive-lang-declared-english` | 661 non-English pages render inside `lang="en"` — WCAG 3.1.1/3.1.2 | archive locale routes | high | small |
| 6 | `archive-brief-mobile-index-rail-pins-351px-of-metadata-over-the-brief` | 351px of sticky evidence-contract chrome over a 760px phone viewport | `/geopolitical-brief` ≤719px | high | small |
| 7 | `section-pages-war-update-renders-every-source-twice` | 18 source links for 8 sources — the duplication Israel's Story already removed | `/war-update` | medium | trivial |
| 8 | `section-pages-israels-story-two-contents-lists` | Two chapter contents lists on one screen, disagreeing on the count; ~420px above the fold | `/israels-story` ≥1220px | medium | trivial |
| 9 | `cross-cutting-progress-bar-claims-fully-read` | Progress bar's painted default is `scaleX(1)` — reports a document fully read with JS off | 7 SectionPage routes + Brief | medium | trivial |
| 10 | `cross-cutting-four-sub-aa-text-pairs` | Four text/background pairs at 3.3–4.3:1, including one unstyled UA-grey placeholder | chat, `/support-us`, home band, `/404` | medium | trivial |
| 11 | `archive-brief-record-pages-have-no-route-back-into-the-archive` | No link to index, category, hub or neighbour on any record or index page | 1,175 record pages | high | small |
| 12 | `archive-brief-october7-videos-reserve-no-layout-height` | 74 videos ship no dimensions; each `<video>` lays out at 300×150 then jumps | 205 video blocks | medium | trivial |
| 13 | `reading-system-focus-within-makes-the-quietest-page-louder` | `:focus-within` outranks `.registerMuted`; October 7's scan gets louder and faster on focus | `/october-7` | medium | trivial |
| 14 | `section-pages-methodology-contains-no-methodology` | Three surfaces route readers there for sourcing standards; it states none, and it and `/corrections` defer to each other | `/methodology` | high | medium |
| 15 | `section-pages-wikipedia-in-the-evidence-margin` | 7 of 8 sources are Wikipedia, printed as the evidence beside the claim, including one mis-citation | `/israels-story` | high | medium |

---

## The home experience

Intro and front page. Audited from source: the dev
server did not answer for this agent (`curl` returned 000), so the WebGPU
scene, the intro and the poster tier were judged from code, CSS, the
decoded poster asset and computed numbers rather than from a live render.
Every one of these findings needs a real-Chrome capture before it lands —
see "What this audit could not check".

### `home-scene-mobile-intro-runs-nine-seconds-longer` — the intro is 47.3s on a phone and 38.6s on desktop

**high** · motion · medium effort
`components/intro/rolling-story-timeline.ts:11`,
`components/intro/rolling-story-timeline.ts:90-125`,
`components/intro/story-timeline.ts:33-118`

**Problem.** The rolling timeline advances one *line* every 1.25s, and
`buildTiming` derives every downstream cue from `joinIndex = lines.length -
1`. The line count is a function of art-directed breaks: desktop is 14
lines, mobile is 21. Same twelve sentences, same words, and the phone sits
through 8.75 extra seconds. That is the inverse of what the device
deserves — the small screen, the impatient context, the metered connection
and the battery all get the longest cut. `.ai/DECISIONS.md` (2026-08-23,
"Intro shortened by cutting words only") set ~39s as the accepted length
after judging ~44.5s too long; mobile at 47.33s is longer than the version
that decision rejected, and was never re-measured.

**Evidence.** `ROLLING_LINE_CADENCE = 1.25` (line 11); `joinStart =
ROLLING_STORY_START + joinIndex * ROLLING_LINE_CADENCE` (92-94), then a
fixed **13.83s** tail (`ENTER 0.8 + JOIN_HOLD 1.8 + 2×CLEANUP 1.1 + EXIT
1.0 + CENTER 0.95 + BRAND_DELAY 0.18 + BRAND_ENTER 0.9 + FINAL_HOLD 3.2 +
OUTRO 2.8` — the filed figure of 8.80s was an arithmetic slip; the
components are right). Recomputed from the real arrays: desktop 14 lines →
`joinStart` 24.75, `finalTime` **38.58**; mobile 21 lines → `joinStart`
33.50, `finalTime` **47.33**; delta 8.75s = 22.7%. Layout is chosen at
`Scene.tsx:110/131` by `size.width < 720`, so every phone gets the 47.33s
cut. Beats at indices 2, 3, 4, 6, 7, 8, 10 are one desktop line and two
mobile lines. Nothing asserts intro duration in `tests/`;
`.claude/hooks/check-story-timeline.mjs:127-144` merely *prints* both
totals, so the divergence is surfaced by tooling and never treated as a
defect. Mitigations exist and do not remove it: a Skip control
(`CanvasMount.tsx:427`), `prefers-reduced-motion` unmount, and
once-per-tab `sessionStorage` (`CanvasMount.tsx:66-74`) — so the cost
lands on every first mobile visit in a tab.

**Recommendation.** Make the cadence per *beat*, not per line, so the
twelve sentences take the same wall-clock time on both layouts and a
two-line break costs presentation rather than duration: a beat-relative
schedule in `getEntryStart` with `ROLLING_BEAT_CADENCE ≈ 2.2s` and
intra-beat lines offset ~0.35s lands mobile near desktop's 38.6s. The
cheaper per-layout-cadence version is *not* the one-constant change it
looks like: `ROLLING_LINE_CADENCE` is read in four layout-blind places —
`getEntryStart` (223-225) and the `latestLineIndex` divisions at 396 and
496 — so it means threading `layout` through all of them. Either fix drops
mobile line dwell from 5.0s to ~3.3s; per *sentence* the read time
equalises, but confirm a two-line beat is still legible at that dwell in
real Chrome before landing. `STORY_BEAT_STARTS`' 12-beat assumption and
the desktop/mobile rejoin rule are untouched.

### `home-scene-intro-typeface-is-gentilis-and-brand-is-one-word` — the brand climax spells "LIONSOFZION"

**medium** · typography · medium effort (split: one part trivial)
`components/particle-nav/layers/IntroText.tsx:88-91`,
`components/particle-nav/layers/IntroText.tsx:122-130`,
`components/particle-nav/styles.module.css:456-465`, `app/layout.tsx:13-19`

**Problem.** The intro's emotional peak renders the name as an unbroken
eleven-letter run, and every glyph of the 38–47s story is sampled from
Gentilis, the stock three.js example face, used nowhere else on the site.
On desktop the visitor then meets the brand again 2.8s later as
`HomeSignalLayer`'s `<strong>Lions of Zion</strong>` in Cinzel — twice in
three seconds, two faces, two spellings.

**Evidence.** `IntroText.tsx:90` loads
`/assets/gentilis_regular.typeface.json` — the only file in
`public/assets/` and the only `FontLoader` call in the app
(`tests/intro-text-cloud.test.ts:18` parses the same path).
`IntroText.tsx:122` passes `['LIONSOFZION']`; every other brand string in
the repo is "LIONS OF ZION" or "Lions of Zion". The space glyph exists
(`" ":{"x_min":0,"x_max":0,"ha":306}`) with no outline, so it costs zero
particles and only advances the pen — the missing space is a choice, not
an asset limitation. Timing recomputed: desktop `brandStart` 31.68s /
`outroStart` 35.78s / `finalTime` 38.58s; mobile 40.43 / 44.53 / 47.33.
The Cinzel double-exposure is desktop-only —
`styles.module.css:501-503` hides `.desktopOrientation` below 720px, so on
a phone the next brand instance is `HomeFrontPage`'s `<h1>` below the fold.
Story charset across both layouts is mixed case plus `7 , .` and space, not
caps-only.

**Recommendation.** Split into two items. **Ship now (trivial):** change
`IntroText.tsx:122` to `['LIONS OF ZION']`. Verified safe — glyph advances
sum to 8.456em vs 7.844em, so at `brandFontScale` 0.38 the cloud goes
2.98→3.21 world units against a desktop `lineMaxWidth` of at most 8.65
(mobile 1.84→1.99 against at most 2.68), so `scale = min(fontScale,
maxWidth/widest)` in `textCloud.ts:132` never clamps and the brand does not
shrink; particle count stays pinned at `maxParticles`. **Separate
(medium):** if a Cinzel or Newsreader typeface JSON is baked to replace
Gentilis, the subset must include lowercase and the digit 7, not just caps
— the filed "A–Z, comma, period" subset would not render the story at all.
That change also needs a real-Chrome capture and `tests/intro-text-cloud
.test.ts:18` repointed, since its width caps are solved against Gentilis
metrics.

### `home-scene-mobile-fold-has-no-scroll-affordance` — the front page has no visible cue on a phone

**medium** · interaction · medium effort
`components/home/home.module.css:222-226`,
`components/home/home.module.css:35-38`, `app/globals.css:195-201`,
`components/particle-nav/styles.module.css:493-515`

**Problem.** The negative `margin-top` that lets the strip's "The front
page ↓" link peek into the orbit's bottom margin is inside `@media
(min-width: 720px) and (min-height: 640px)`. Below either bound the strip
starts exactly at `100dvh`, and the route hides its scrollbar globally
with a comment justifying that by "the anchored strip carries an explicit
'The front page ↓' link" — which is true only at ≥720×640. The band is
where the eight file descriptions live, and `HomeFrontPage`'s own docstring
says it exists because "the eight section descriptions existed only on
hover, so no touch visitor ever saw them".

**Evidence.** Anchors verified verbatim. Three corrections to the filed
severity. The page is not undiscoverable — the document scrolls normally
and, with a live canvas, the orbit still carries all eight destinations
(`.root[data-canvas] .nav { display: block }`); what is lost is the
signpost and the descriptions. The hidden-scrollbar aggravator does not
apply to phones at all (mobile browsers use transient overlay indicators),
so that half bites only the ≥720×<640 short-desktop case. And the flush
behaviour is reasoned in-file at 220-223 ("a phone's bottom band is already
spoken for by the chat dock and the orbit's bottom-node reserve").
`verify-home-band.mjs` asserts only scene-box equality and that the
document scrolls; nothing asserts a peek.

**Recommendation.** Add a phone-only cue *inside* the scene box, above the
chat dock, on the free `.desktopOrientation` layer (`display: none` below
719px) — a gold chevron plus "The front page" at `--t-data` linking to
`#home-masthead`. It costs no orbit radius and is the only option that
survives the 320×568 floor. Do **not** ship the `STRIP_PEEK_PX` +
shortened `heroSpacer` path: at ≤719px the chat launcher is a full-width
fixed dock ≈82px tall pinned to the bottom edge, so a 2.5rem peek renders
behind it, and sizing the reserve to clear the dock (~110px) drives
320×568 to `radiusY` 1.257 — onto the 1.25 emergency floor. (Note the filed
cost was also double: charging N px into `bottomReservePx` costs N/2 of the
radius, since `insetBottom` is halved into `radiusY`; and 320×568 currently
sits at `radiusY` 1.915, 53% above the floor, not "close to" it.) If the
cue lands, update the `globals.css:195-201` comment, which currently claims
an affordance that only exists at ≥720×640.

### `home-scene-masthead-repeats-the-wordmark-verbatim` — the band's kicker restates the scene's, one screen apart

**low** · composition · small effort
`components/particle-nav/HomeSignalLayer.tsx:24-28`,
`components/home/HomeFrontPage.tsx:90-95`,
`components/home/home.module.css:249-288`

**Problem.** "Independent evidence network" renders in the scene's
top-left corner and again as the band masthead's kicker — byte-identical,
same face, same size, one screen apart on desktop.

**Evidence.** `HomeSignalLayer.tsx:25-26` and `HomeFrontPage.tsx:90-91`
(filed as 91-92; off by one). Both are 0.72rem mono uppercase:
`.brandKicker` is Geist Mono 0.72rem/0.16em (`styles.module.css:448-454`),
`.mastheadKicker` is `--face-data`/`--t-data` = 0.72rem, tracking 0.08em
(`home.module.css:253-260`). The masthead stack measures ~195–224px at
1440×900. Scene layer is hidden below 720px, so this is desktop-only. The
repeated *name* and the ~200px masthead are not themselves defects — a
nameplate at the top of a front page is a normal newspaper device; the
verbatim kicker sentence in the same face is.

**Recommendation.** Drop `.brandKicker` from `HomeSignalLayer` so the scene
reads wordmark + "Truth has a signal.", and let the band own the framing.
Keep the masthead's `<h1>`, rule and lede — `.ai/DECISIONS.md` records the
`<h1>` as the home route's only one. Compressing the masthead's bottom
margin is optional polish, not part of the fix.

### `home-scene-stylesheet-ignores-the-token-palette` — the scene consumes no palette token and carries three off-scale colours

**low** · colour · trivial effort (partly)
`components/particle-nav/styles.module.css:456-472`,
`components/particle-nav/styles.module.css:303-309`,
`app/globals.css:54-76`

**Problem.** `particle-nav/styles.module.css` contains zero
`var(--gold)`/`var(--ink)` references and three colours that are not on the
scale. A change to `--gold` or `--ink` in `globals.css` reaches every
surface except the one the brand is judged on.

**Evidence.** 25 hex tokens, of which **6 are in comments** (lines 3, 4,
217, 361, 422 — the accessibility lock and its annotations) and **19 are
live declarations**: `#efd79a` ×5, `#57a7d9` ×6, `#c9a24b` ×3, `#070b14`
×2, plus `#e7c979` (458), `#a7b8ca` (469), `#b6c4d6` (305). So the
tokenizable set is 16, not 22. Deltas: `#b6c4d6` vs `--ink #b9c5d4` =
(3,1,2), indistinguishable; **`#a7b8ca` vs `--ink` = (18,13,10)**, a
distinct grey between `--ink` and `--ink-lo`; **`#e7c979` vs `--gold-hi
#efd79a` = (8,14,33)**, a mid-gold. Contrast on `--ground`: `#a7b8ca`
9.7:1, `--ink` 10.4:1 — no tier at risk either way. And the framing
inverts the record: `.ai/DESIGN-V2.md:30` says "Nothing here touches the
particle home scene" and :160 leaves the orbit's DOM labels as an explicit
Phase 5 question for the user. This is a documented deferral, not drift
that escaped an audit. Reader impact: none — maintainability only.

**Recommendation.** Not a find-and-replace. (a) Safe now: `#b6c4d6` (305)
→ `var(--ink)`. (b) `#a7b8ca` (469) and `#e7c979` (458) are visible changes
to the wordmark block; prefer declaring scene-local `--scene-*` custom
properties once on `.root`, which removes the private-dialect problem
without pre-empting Phase 5. (c) Leave `#c9a24b`/`#efd79a` literal on
`.label`, `:focus-visible` and the header lock — the lock exists precisely
so an edit to a shared token *cannot* reach it, and routing it through
`var(--gold)` makes a 4.5:1 contract editable from another file, reversing
`.ai/DECISIONS.md:250`. If they are tokenized anyway it needs a test
asserting the computed ratio, not a comment. `config.ts`'s `defaultTheme`
stays literal — it feeds the GPU, where CSS variables cannot reach.

### `home-scene-story-copy-exists-nowhere-but-the-intro` — the twelve-beat argument is used once per tab and reused nowhere

**low** · content-design · small effort
`components/particle-nav/CanvasMount.tsx:161-163`,
`components/particle-nav/CanvasMount.tsx:420-424`,
`components/particle-nav/CanvasMount.tsx:62-85`,
`components/intro/story-timeline.ts:123-135`

**Problem.** `STORY_PARAGRAPHS` is imported by exactly one file and
rendered only inside `{introRunning ? …}`, so the intro's voice and the
document tier's own statement of purpose are maintained separately and can
drift.

**Evidence.** `introRunning` at 161-163 with all six conjuncts as quoted;
the transcript `<article className={styles.srOnly}>` sits inside the same
guard (420-424); `INTRO_SEEN_KEY = 'loz-intro-seen'` on `sessionStorage`
(62-78); grep returns four hits across two files. Correction to the
framing: the guarded node is a screen-reader-only transcript, not visible
copy being withheld, and purpose copy already renders unconditionally in
`app/we-are/page.tsx` ("Who we are" plus Organization JSON-LD) and in
`HomeFrontPage.tsx:91-93` (kicker plus `trustStrip` lede). So no visitor is
unable to learn why the site exists.

**Recommendation.** Use `STORY_TRANSCRIPT` — already exported and
currently unused — as the source for a short typeset statement, so the film
and the page share one string by construction. If the full
`STORY_PARAGRAPHS` lands on `/we-are` it must be reconciled with the
existing "Who we are" block rather than stacked on top of it; two
statements of purpose in different registers on one page is worse than one.
Treat an intro-replay control as a separate optional change and cost it
above the filed "three lines" — `.docLinks` is a `<p>` of `<a>`s, so a
replay affordance is a button in a link row plus storage clearing plus
reload, and it must not read as a nav destination.

### `home-scene-metadata-describes-the-animation-not-the-desk` — the root description describes the intro

**low** · content-design · trivial effort
`app/layout.tsx:41-57`, `app/manifest.ts:3-11`,
`app/opengraph-image.tsx:77`, `lib/content/war-update.ts:171-172`

**Problem.** "A cinematic awakening from digital darkness." is the
description for `/` and the web manifest, and it contradicts the OG card
the same repo renders, which ends on "Verified information. Documented
sources."

**Evidence.** The string sits at `layout.tsx:44` (base), `:49`
(openGraph), `:55` (twitter) and `manifest.ts:7` — the only four
occurrences in the repo (the filed 49/54/60 line numbers are off by five).
The blast radius is smaller than filed: every other route already
overrides with a product-shaped TAGLINE (we-are, war-update, israels-story,
support-us, geopolitical-brief, fake-resistance, methodology, corrections
via `export const metadata`; our-heroes and october-7 via
`generateMetadata`, plus the archive routes). Only `/` — which exports no
metadata — and the manifest inherit it.

**Recommendation.** Share one product description between `layout.tsx`
(base + openGraph + twitter) and `manifest.ts` via a `SITE_DESCRIPTION`
export in `lib/site-config.ts`, which already holds `SITE_URL` and is
already imported by both consumers. Do **not** use one string in all three
places: the OG card's line is a 24px, letterSpacing-3 satori text node in a
fixed 1200×630 card with only Geist Regular available, and a 25-word
sentence will not lay out there — keep it as its own constant. The
og:title "LIONS OF ZION — Truth Has a Signal" and the card's `alt` stay.

## The reading system

Tokens, the dossier shell, the shared content components. Audited from
source (the dev server did not answer for this agent), with the grid
arithmetic computed by hand: 68ch at IBM Plex Sans' 0.6em digit advance ×
17px = 693.6px. No finding here is critical; all twelve are system
integrity rather than reader-blocking defects.

### `reading-system-error-page-is-a-preserved-v1-fossil` — `app/error.tsx` is the last unconverted V1 surface

**medium** · typography · small effort
`app/error.tsx:31-34`, `app/error.tsx:42-48`, `app/error.tsx:49-56`,
`app/error.tsx:57-60`, `app/error.tsx:91-96`
*(Filed independently by the reading-system and cross-cutting agents;
merged here.)*

**Problem.** The error boundary is the one reading surface the V2 pass
never touched, because its CSS is an inline `<style>` string inside a
client component and therefore invisible to every CSS grep the audit ran.
It is a complete specimen of the design the redesign was built to kill:
Cinzel as the H1 face, uppercase, +0.18em tracking. `.ai/DESIGN-V2.md:21`
claims "Cinzel no longer appears on any reading surface";
`.ai/DECISIONS.md:526-553` says "Do not reintroduce it to a reading
surface"; `CLAUDE.md` restates it as binding. This is not a proposal to
reverse a decision — it is the decision not having been executed.

**Evidence.** `:50` `font-family: var(--font-cinzel), Georgia, 'Times New
Roman', serif;` with `:52-54` `font-size: clamp(1.6rem, 5vw, 2.6rem);
letter-spacing: 0.18em; text-transform: uppercase;` — DESIGN-V2 Part 1
names exactly this pattern as root cause #1. `:45` `letter-spacing: 0.32em`
is the largest value in the repo (next: 0.25em in
`ask-the-lion-chat.module.css:52`); the corrected repo-wide census is **18**
declarations above the 0.08em cap, 5 of them in this file, plus `.loz-error
-retry` (72) and `.loz-error-home` (85) at 0.14em and `.loz-error-digest`
(94) at 0.12em. `:93` `font-size: 0.66rem` = 10.56px, the only sub-floor
declaration outside `components/particle-nav/` and `components/chat/`.
`:58` `font-size: 0.96rem` is not one of the seven steps. `:33`
`color: #9fb3c8` is off the three-ink scale (9.14:1 on `--ground`, so
legible, just off-system — and `--ink` at 11.25:1 would be a small gain).
`:32` `background: #070b14` is `--ground`'s value but opaque, so it hides
body's `--scan-ground` (`globals.css:135`). Contrast is adequate
throughout; this is a system-consistency and unexecuted-decision defect,
not a legibility one, on a route reached only when something throws.

**Recommendation.** Retype onto tokens, but **do not delete the inline
`<style>`**. The file header's rationale — a broken shared stylesheet can
never take the error screen down — applies to a CSS Module chunk too, and
token-only values fail open to unstyled if `globals.css` is the thing that
broke. Keep the block and write each token with a literal fallback:
`font-family: var(--face-display, Charter, Georgia, serif); font-size:
var(--t-display, 2.1rem); font-weight: var(--t-display-weight, 600);
line-height: var(--t-display-lh, 1.15); color: var(--gold, #c9a24b);` with
no text-transform and no letter-spacing — matching
`app/not-found.module.css:53-60`, which is the correct sibling of this page
and already does it right. Same pattern for `.code`/`.retry`/`.home`
(`--t-data`, `--t-data-tracking`, which also drops 0.14em/0.12em to the
cap) and `.lede` (`--t-body`, `--t-body-lh`, `--ink`). For the ground, keep
a paint but make it the real one: `background-color: var(--ground,
#070b14); background-image: var(--scan-ground);`. Dropping `text-align:
center` is a defensible consistency call with `not-found.tsx` but is the
one taste-level item — treat it as optional. Add the file to the
greppable-rule review: a `.tsx` inline-style block is the one place the
type rules cannot be enforced by inspecting `*.css`.

### `reading-system-two-sources-of-truth-for-the-palette` — `content.module.css` restates the ink scale as literals

**medium** · colour · medium effort
`components/content/content.module.css:22-43`,
`components/content/content.module.css:38`,
`components/content/content.module.css:872`, `app/globals.css:101-118`

**Problem.** `.tokens` is composed into the root of every content component
and it does not alias the global scale — it restates it. `--ink-hi:
#e9eef6; --ink: #b9c5d4; --ink-lo: #8494a8;` are raw hexes. The literals
are byte-identical to `globals.css` today, so nothing renders wrong; the
defect is duplicate ownership. Change `--ink` in `globals.css` and the
shell's prose, the identity band, the 404 and the Brief move while every
Timeline body, card body, source label and correction note stays behind.
The `--loz-*` compatibility layer's comment in `globals.css` is now wrong in
both directions: it names `sections.module.css`,
`geopolitical-brief.module.css`, `support.module.css` and
`share-verified.module.css` as consumers, and none of those four reads
`--loz-*` any more, while the one real consumer, `content.module.css`, is
not named.

**Evidence.** `content.module.css:28-30` are bare literals against
`globals.css:58-60` declaring the same three. `grep -rn 'var(--loz-' app
components lib` returns exactly **7** hits, all at `content.module.css
:25-34` (the filed prose said three are aliased; seven are, and three of
the ten aliases — `--loz-blue-dim`, `--loz-ember-dim`, `--loz-body` — have
zero readers). The mechanical reason the inks are literal is real: `--ink:
var(--ink, …)` on the same element is a custom-property cycle and computes
to guaranteed-invalid, so the author could only alias names that had a
`--loz-*` twin. `:872` `.claimPanel .claimRecordBody { color: #c8b6b0; }`
is a genuine `.ai/DESIGN-V2.md:204-207` violation ("no page keeps a private
paragraph color") but not an accessibility one: it composites to 9.92:1
over the claim panel and 9.46:1 over the ember wash, versus 11.05:1 /
10.54:1 for `--ink` — a barely perceptible warm shift. The file also
carries 8 further untokenised `--badge-color` literals at :116, :127, :133,
:139, :149, :155, :162, :172, and surface grounds live in four places:
`--surface-raised: #0d1523` (:38), `rgba(8,14,24,0.965)`,
`geopolitical-brief.module.css:19-20`'s re-declared `--surface: #090f1b` /
`--surface-raised: #0d1523`, and a fourth literal `#070c15` at :561/:572.
Note `.ai/DECISIONS.md:168-170` ("content.module.css is 217 var()
references and one literal") is itself inaccurate: the file has 218
`var(--` references and 20 hex literals, 7 of them legitimate `var()`
fallbacks and 13 bare.

**Recommendation.** The simplest correct fix is smaller than filed: delete
`content.module.css:28-30` outright so `var(--ink*)` resolves by
inheritance from `:root`, which is guaranteed since `app/layout.tsx` loads
`globals.css` on every route — no renaming needed, and the "renderable
outside globals.css" hedge protects a scenario that does not exist. Keep
the `var(--loz-*, literal)` pattern only until `globals.css:101-118` is
deleted and lines 25-34 are repointed at
`--ground/--gold/--gold-hi/--data-blue/--data-blue-peak/--data-ember/--data-ember-peak`
(the same rename-free path applies to `--gold` and `--ground`, which do not
collide). Replace `:872` with `var(--ink)` — the ember left border and the
90deg wash at :837 already say which panel this is. Adding
`--surface`/`--surface-raised` to `globals.css` is right, but reconcile all
four existing grounds first rather than tokenising two and leaving the
others, and fold the 8 `--badge-color` literals into the same pass or the
"one palette" claim stays half-true. Correct
`.ai/DECISIONS.md:168-170` while you are there.

### `reading-system-content-w-diverges-from-the-1fr-tracks` — the rails breakpoint is ~63px too low

**medium** · layout · medium effort
`components/sections/sections.module.css:620-626`,
`components/sections/sections.module.css:228-235`,
`components/sections/sections.module.css:131-157`,
`components/sections/sections.module.css:515-522`

**Problem.** The rails switch on at 1220px, but 13rem rails plus a 68ch
measure plus padding and gaps do not fit until ~1283px. Between those
widths the TOC and the citation margin overflow their `1fr` tracks into the
shell's 48px padding — the TOC's left edge lands 18.6px from the viewport
edge — and the scan loses its full-strength outer strips entirely. The page
reads as having lost its outer margin at exactly the width where it just
gained its rails.

**Evidence.** At W=1220: padding `clamp(1.25rem,4vw,3rem)` = 48px, gap
36.6px, `min(68ch,100%)` ≈ 693.6px, so each `1fr` track =
(1220−96−693.6−73.2)/2 = **178.6px** against `--rail-w` 208px — a 29.4px
overflow per side. `--content-w` = 693.6 + 2×244.6 = **1182.8px**, so the
first mask stop `calc(50% − C/2 − 2.75rem)` = **−25.4px** and the 0.25
plateau covers the screen. Full-strength strips return at W≈1274px; tracks
reach 208px at W≈1282.5px. For reference the strips are ~81px each at
1440px and ~3px at the very common 1280px viewport. Two corrections to the
filed reasoning. `--content-w` does **not** drift: `.tocRail` is `width:
--rail-w; justify-self: end` and `.marginNote` is `width: --rail-w;
margin-left: --rail-gap` off the measure, so the real centred content
extent is exactly `reading-w + 2×(rail-w + rail-gap)` however wide the
track is — the rail overflows by precisely the amount the formula
over-assumes, and the protected band's left edge lands on the TOC's real
left edge to the pixel. And the scan does not vanish: composited it is
0.34 × 0.7 × 0.25 = 0.0595 of `#3e7fa8` over `#070b14` = a delta of (3,7,9),
*above* the (2,4,6) `globals.css:90-95` calls sub-threshold, so it flattens
to the interior whisper rather than disappearing. `verify-composition.mjs`
captures 1254px but asserts only orbit bounds on `/`, so nothing covers
this.

**Recommendation.** The filed "simplest correct fix" —
`grid-template-columns: var(--rail-w) var(--reading-w) var(--rail-w)` —
fixes nothing on its own: at 1220px that totals 1182.8px against a 1124px
content box and overflows the padding by the same 29.4px per side. Use the
second half only: `--rail-w: clamp(9rem, 14vw, 13rem)` so the rails scale
into the space that exists, keeping the 1220px breakpoint. Do not raise the
breakpoint to ~1370px without argument — 1220 is a site-wide breakpoint
restated in `home.module.css:490-497` and is the threshold the
chat-launcher label decision keys on (`.ai/DECISIONS.md`, 2026-08-25).
Apply the same fix to `home.module.css:496`, which carries an identical
`--content-w` override. The `content.module.css:662` `.marginNote` media
block is not scoped to `.withRails`, so a `DocPage` route that ever mounts
a Timeline or SourceList would throw citations into an unmasked margin —
file that separately as low, since no DocPage route mounts one today.

### `reading-system-verdict-ramp-cannot-signal-its-verdict` — five of nine assessment ramps are one tan

**medium** · hierarchy · medium effort
`components/content/content.module.css:82-105`,
`components/content/content.module.css:115-179`,
`components/content/VerificationBadge.tsx:11-50`
*(Overlaps `section-pages-assessment-ramps-are-one-colour`, which reaches
the same measurement from the page side and adds the Fake Resistance stamp
contradiction. Read together.)*

**Problem.** `false` (hue 11.1°), `manipulated` (18.3°), `misleading`
(20.3°), `out_of_context` (21.6°) and `contested` (28.4°) occupy a **17.3°
hue band** at 40–56% saturation and 87–93% value; four of the five share an
identical filled circle. Contrast against `--ground` for those five is
7.75 / 8.17 / 8.75 / 9.11 / 9.64 — a 1.9 spread, so no lightness separation
either. This is a real defect in the shared badge that will bite when live
assessment data lands.

**Evidence.** Hues and contrasts recompute exactly as filed. Only
`verified`, `manipulated`, `unsupported` and `satire` override `.badge i`
(121-124, 144-146, 167-169, 177-179); `false`, `misleading`,
`out_of_context`, `contested` and `unverified` all fall through to the
default circle at 97-105. But today it is latent CSS, not a reader's
experience: grepping every render site, the only values that ever reach the
badge are `verified` (14×, hardcoded as `const VERIFIED` in
`lib/content/october-7.ts:29` and `war-update.ts:33`), `false` (2×) and
`out_of_context` (1×) in `lib/content/fake-resistance.ts`, plus
`verified`/`unverified` on the home card and the Brief via
`STATUS_TO_ASSESSMENT`. `contested`, `misleading`, `manipulated`, `satire`
and `unsupported` render nowhere. The one page where two tans co-occur
already mitigates: `app/fake-resistance/page.tsx:162-177` with
`page.module.css:57-82` adds a rotated, bordered, 700-weight verdict stamp
at `--t-data` with a three-tone collapse (gold / ember / muted), so `false`
and `out_of_context` are already ember vs muted there — and the label word
plus `aria-label`/`title` mean colour is never the sole carrier. Two filed
details are imprecise: `#e8c979` is neither `--gold` nor `--gold-hi` but a
distinct value between them, and `sections.module.css:277/304/444` are
`:hover`/`:focus-visible` states, not the resting link colour.

**Recommendation.** Do the type half now: raise the badge from `--t-data`
to `--t-caption`, drop uppercase and tracking, and retire the file's own
declared exception at `content.module.css:79-81` — a verdict is the least
micro of all the micro-chrome on this site, and the exception was granted
on the assumption the stamp does visual work. For the colour half, widen
glyph differentiation to all nine marks first (cheap, no token change,
survives colour-blindness) and only then revisit hue. Note a cost the
original missed: verified-is-gold is held in two places —
`content.module.css:116` and the `data-tone='gold'` branch of Fake
Resistance's stamp — so taking `verified` off gold without changing the
stamp makes the two disagree on the same page. Avoid "add a green as a
fourth semantic ramp"; that adds a token to the six-colour V2 set and needs
its own argument.

### `reading-system-no-spacing-scale-at-all` — type and colour were collapsed; spacing never was

**medium** · layout · medium effort
`app/globals.css:12-118`,
`components/sections/sections.module.css:342-365`,
`components/sections/sections.module.css:379-384`,
`components/content/content.module.css:582-588`

**Problem.** `globals.css` declares faces, seven type steps with their own
line-heights and weights, six colours, two hairlines and a background
texture — and not one spacing token. `grep -rn '\-\-sp-[0-9]' app
components --include=*.css` returns nothing repo-wide. The visible
consequence: body-size prose has two paragraph gaps for one role.
Hand-authored prose inside a `SectionBlock` gets 1.15rem (18.4px); every
paragraph rendered by a content component gets 0.7rem (11.2px). The type
scale ships line-heights precisely so a consumer sets one property and gets
a designed result; nothing snaps vertical space to them.

**Evidence.** 71 distinct rem spacing values across `app/` + `components/`;
**37** across `components/sections/sections.module.css` +
`components/content/content.module.css` + `app/not-found.module.css` (note
the filed path `components/sections/not-found.module.css` does not exist
and returns 33); **15** distinct values inside the 0.2–0.9rem band in those
three files (0.2, 0.25, 0.3, 0.35, 0.4, 0.45, 0.5, 0.55, 0.6, 0.65, 0.7,
0.75, 0.8, 0.85, 0.9). The paragraph split: `sections.module.css:380`
`margin: 0 0 1.15rem` vs `content.module.css:587/:806/:884` `margin-top:
0.7rem` — a 39% difference in the gap, 15% in total paragraph advance
against the 28.9px body line box. The headline block alone uses four
unrelated values: `:343` 0.85rem, `:353` 1.5rem, `:360` 2.75rem, `:364`
1rem. Correction to the filed narrative: the adjacency occurs on
`app/fake-resistance/page.tsx:222-227` and `app/october-7/page.tsx:143-144`,
**not** on War Update (whose WireFeed uses its own `.dispatch*` styles) or
We Are (which mounts no Timeline). No `CLAUDE.md` invariant or DECISIONS
entry governs spacing, so nothing is reversed.

**Recommendation.** Add an eight-step scale to `globals.css` beside the
type scale, tuned to the body line box (1.0625rem × 1.7 = 28.9px):
`--sp-1: 0.25rem; --sp-2: 0.5rem; --sp-3: 0.75rem; --sp-4: 1rem; --sp-5:
1.5rem; --sp-6: 2rem; --sp-7: 3rem; --sp-8: 4.5rem;` plus one named
editorial value, `--flow: 1.15rem`, for the gap between sibling paragraphs.
Migrate the shell first — `sections.module.css:343`→`--sp-3`,
`:353`→`--sp-5`, `:360`→`--sp-7`, `:364`→`--sp-4`, `:234`'s 6rem
padding-bottom→`--sp-8`. Narrow the paragraph fix: change only
`content.module.css:587` (`.timelineBody p + p`) and `:884`
(`.claimRecordBody p + p`) to `var(--flow)` — those are full-measure
body-size prose abutting shell prose in one column. Leave `:806`
(`.cardBody p + p`) tighter; cards are a multi-column register `CLAUDE.md`
already treats as an exception, and widening them changes card height and
grid rhythm for no reading gain.

### `reading-system-body-size-appears-once-in-the-library` — full-measure prose is set at the secondary tier

**medium** · typography · small effort
`components/content/content.module.css:349`,
`components/content/content.module.css:406-412`,
`components/content/content.module.css:578`,
`components/content/content.module.css:793-799`,
`components/content/content.module.css:864-869`

**Problem.** Of the 37 font-size declarations in `content.module.css`, 16
are `--t-data`, 9 `--t-caption`, 6 `--t-small`, 4 `--t-h3`, 1 `--t-h2`, and
exactly **one** is `--t-body` (`.timelineBody`) — 67.6% caption-or-smaller.
Where that actually costs a reader is `.cardBody` (:797) and
`.claimRecordBody` (:867), both `--t-small` (15px) where DESIGN-V2 reserves
`--t-body` for paragraphs: on `/support-us` a single-column card grid runs
the full 68ch at 15px, and ClaimRecordPair — the fact-check signature
device — sets its comparison below the tier its own table reserves for
paragraphs.

**Evidence.** Counts confirmed exactly. The measure computation holds:
`body` is `--t-body`/`--face-text` (`globals.css:236-237`), so `.shell`
resolves `min(68ch,100%)` at 17px Plex Sans ≈ 693.6px, halved by
`content.module.css:824` and less 1.5rem padding each side (:832) ≈ 297px
per panel, roughly 40ch at 0.9375rem. Three corrections to the framing.
Paragraphs are not the content library's job: `sections.module.css` sets
`:where(.body) p` (:381), `li` (:397) and `.lede` (:345) at `--t-body`, so
most prose a reader meets by volume is at 17px, and "the site's declared
reading size is not the size most of the site is read at" is not supported.
The `/we-are` example is wrong on layout — `.roleGrid` is `repeat(2,
minmax(0,1fr))` (`app/we-are/page.module.css:148`) and home `.cards` is
2-up, so those are ~330px half-measure columns; the genuine full-measure
case is `.skillGrid` `repeat(1, minmax(0,1fr))`
(`app/support-us/page.module.css:58-63`). And `content.module.css
:1008-1014` already stacks `.claimRecord` to one column below 719px, so the
40ch case is desktop-only across 2 usages on one page.

**Recommendation.** Do **not** promote `.cardBody` globally — it would make
the common case worse: in the 2-up grids a card is ~330px less 48px padding
≈ 282px, which at 17px is ~33ch, tighter than the 40ch being objected to.
Scope it: set `--t-body` on card bodies only where the grid is
single-column (support-us `.skillGrid`), via a data attribute or a
container query on the card, and leave the 2-up cards at `--t-small`. Drop
`.corrections p` (:410) and `.unknownGrid li` (:349) from the fix — both
are secondary prose in narrow multi-column hosts, exactly what `--t-small`
is documented for (`.ai/DESIGN-V2.md:179`). `.claimRecordBody` (:867) is
the one clear promotion, but `--t-body` in a 297px panel is ~35ch, so
raising it argues for the stacked layout — file restructuring the
fact-check signature device on its own, not as the tail of a small
typography fix.

### `reading-system-focus-within-makes-the-quietest-page-louder` — `:focus-within` outranks `.registerMuted`

**medium** · motion · trivial effort
`components/sections/sections.module.css:159-172`,
`components/sections/sections.module.css:200-211`,
`components/sections/sections.module.css:213-217`

**Problem.** The three register rules are written as a ladder from loud to
quiet and the comment on the last says "Keyboard focus anywhere in the page
calms the scan further." On six of the seven pages it does. On October 7 it
does the opposite, because `.page:focus-within .row` scores (0,3,0) and
`.registerMuted .row` scores (0,2,0). Focus wins, the register jumps from
0.45 to 0.6, and `animation-duration` drops from ×3 to ×2 — the nine rows
travel 50% faster. The trigger is not exotic: `:focus-within` fires when a
reader tabs to the skip link, clicks any identity-band or TOC link, or
activates anything in the document, and despite the comment it is not
keyboard-only — a mouse click on any in-page link triggers it too.

**Evidence.** `:214` `.page:focus-within .row { --register: 0.6;
animation-duration: calc(var(--dur) * 2); }` against `:207`
`.registerMuted .row { --register: 0.45; ... * 3 }` under the comment
"October 7: the scan nearly holds its breath". Row opacity is `:171`
`opacity: calc(0.34 * var(--register, 1))`. `register="muted"` appears in
exactly one page file (`app/october-7/page.tsx:64`). The brightness half is
subtle: `--data-blue-dim` `#3e7fa8` composited over `--ground` goes
rgb(15,29,43) → rgb(18,35,50), a delta of about (3,6,7), reduced to a
quarter of that inside the masked reading column — the visible half is the
motion, not the opacity. `ScanBackdrop.tsx:118` confirms muted pages carry
9 rows rather than 16. The `prefers-reduced-motion` block at `:696` sets
`animation: none`, killing the pace half for those users but leaving the
opacity jump.

**Recommendation.** The minimal, no-side-effect fix is to demote the focus
rule: move it above `.surfaceQuiet .row` and write it
`:where(.page:focus-within) .row { --register: 0.6; animation-duration:
calc(var(--dur) * 2); }` at (0,1,0), so both per-page calms win and October
7 simply stays at 0.45/×3 when focused — which is what "calms further"
already implies for the quietest page. The `--calm`/`--pace` multiplier
version is sound but not behaviour-neutral: it also moves the six
`surfaceQuiet` pages (focused opacity 0.6 → 0.56, duration ×2 → ×2.88), so
it needs a look in real Chrome rather than landing as a pure specificity
repair.

### `reading-system-credibility-label-outranks-credibility-value` — three editorial pages render no publication metadata

**medium** · hierarchy · small effort
`components/content/content.module.css:278-286`,
`components/content/content.module.css:294-311`,
`components/content/PublicationMeta.tsx:20-31`

**Problem.** `/october-7`, `/israels-story` and `/our-heroes` carry
`publishedAt` and `reviewedBy` in `lib/content` and render neither, so
three editorial files on a verification desk show no visible publication
date or reviewer.

**Evidence.** Census confirmed: `PublicationMeta` mounts at
`app/war-update/page.tsx:60`, `app/fake-resistance/page.tsx:145` and
`components/briefs/GeopoliticalBrief.tsx:132` — nowhere else. The filed
hierarchy claim, though, fails on measurement: over `--ground`, `dd`
`--ink #b9c5d4` is **11.25:1 at 13px** while `dt` `--gold #c9a24b` is
**8.2:1 at 11.52px**, so the value is both larger and higher-contrast than
the label; the label leads on hue only. DESIGN-V2's "least legible thing"
indicted the 8px terms, which this pass already fixed. The three-line-wrap
scenario is invented: `reviewedBy` is "Editorial desk" (14 chars), the
longest value anywhere is "Reference edition 001" (21 chars), and
`content.module.css:965-968`/`1023-1027` already drop the grid to 2 and 1
columns. And "every one of the five has the data" is false — there is no
`lib/content/we-are.ts` or `support-us.ts`, and neither page has
`publishedAt`, `reviewedBy` or a `sourceCount`. Nor is provenance absent
from those pages: `/october-7` renders a SourceList of archives
(`page.tsx:121`), `/our-heroes` per-profile sources (`:44-45`),
`/israels-story` a "Sources and further reading" block (`:117`), and
october-7 and our-heroes emit `datePublished` in JSON-LD.

**Recommendation.** Do the coverage half only: mount `PublicationMeta` with
`publishedAt` and `reviewedBy` on `/october-7`, `/israels-story` and
`/our-heroes` — at the foot, as a colophon, not the head. Leave `/we-are`
and `/support-us` out; they have no content module and no such data, and
are an about page and a donation page rather than dated records. Do **not**
recolour `dt` to `--ink-lo` in this one component — gold/mono/uppercase at
`--t-data` is the library-wide canonical data-label treatment shared with
`.kicker` (:46-55) and `.correctionsKicker` (:364-372), sanctioned by
`CLAUDE.md`'s ≤2-word rule and by the in-file comment at :292-293; if the
label voice is wrong it is wrong system-wide and must be argued that way.
Do not change the grid, and do not route this through `SectionPage`'s
`aside` prop — that rail renders only at ≥1220px.

### `reading-system-figures-are-the-same-size-as-headings` — FigureRow's default is `--t-h2`

**low** · hierarchy · trivial effort
`components/content/content.module.css:447-466`,
`components/sections/sections.module.css:367-374`,
`app/globals.css:26-49`, `app/october-7/page.module.css:37-47`

**Problem.** On the Geopolitical Brief — FigureRow's only consumer of the
default — pulled figures set at `--t-h2` in the same face and weight as
`.blockHeading h2`, so the row reads as a third heading level rather than
as emphasis. Against a `--t-caption` label the ratio is 1.91:1; a
broadsheet pulls a figure at 3–5× its caption.

**Evidence.** `content.module.css:453` `font-size: var(--t-h2, 1.55rem)`
(with `:454` weight 500 and `:452` the display face) vs
`sections.module.css:369` `font-size: var(--t-h2)` — same token, face and
weight, differing only in colour. 24.8px over 13px = 1.91:1;
`--t-display` would be 33.6–44px = 3.38:1 at max. `globals.css:26-48` has
no step between 1.55rem and `clamp(2.1rem, 4vw, 2.75rem)`. Scope is one
page: FigureRow is used only at `GeopoliticalBrief.tsx:154` and
`app/october-7/page.tsx:133`. The filed inference from October 7's
off-scale override is wrong — `.ai/DECISIONS.md:637-650` (2026-08-25)
pre-assigns October 7 "a restrained monument (large inscribed figures,
slower rhythm)" and requires each page's device to live in its own `.body`
module, so that override is a documented decision.

**Recommendation.** Keep only the first half: change
`content.module.css:453-455` to `font-size: var(--t-display); font-weight:
var(--t-display-weight); line-height: 1;` — on-scale, and the Brief's three
figures ("≈500 km", "80 km", "NIS 5.5B") fit comfortably in a 48rem/3
column. Do **not** delete `app/october-7/page.module.css:37-47`: it is that
page's documented device and it carries `white-space: nowrap` plus
`line-height: 1`, the guard the in-file comment records was added after a
real-Chrome review caught "1,200+" breaking. (October 7's cell is also
~160–185px, not the ~201px filed, because `.inscription > dl > div` adds
`padding: 0 1.5rem`.) If the off-scale clamp is worth removing on its own
merits, file that separately and keep the nowrap.

### `reading-system-uppercase-rule-broken-in-the-files-that-state-it` — four tracked-caps strings of three or four words ship

**low** · typography · small effort
`components/sections/sections.module.css:69-74`,
`components/sections/sections.module.css:252-257`,
`components/sections/sections.module.css:538-544`,
`app/not-found.module.css:96-102`

**Problem.** "Uppercase+tracking only for ≤2-word data labels" is stated
three times — DESIGN-V2 Part 2, `CLAUDE.md`, and the header comment of
`content.module.css` itself (18-19). Four rules break it on live routes,
including the sole exit control on all nine shell routes.

**Evidence.** `sections.module.css:256` puts `text-transform: uppercase` on
the whole `.identityBand` flex row, inherited by `SectionPage.tsx:131`
"Lions of Zion" and `:144` "← Back to the scan" — neither overrides it at
`.wordmark:270` or `.identityExit:297`. `:544` `.tocTitle` on "In this
file"; `:73` `.skipLink` on "Skip to content" (focus-only);
`not-found.module.css:100` on "Open files · monitoring active". Two of the
six filed anchors render on **zero** routes and should not be filed as
shipped defects: `grep -rn "<SensitiveContent"` returns nothing outside its
own file and README (`.ai/STATE.md:595` lists the October 7 gate as future
work), and `AskAboutFileCta` is referenced only by `.design-sync` previews
— `.ai/DECISIONS.md` 2026-08-25 records the boxed Ask CTA as deliberately
removed, so `.askCta` is dead CSS. That guts the filed severity argument:
"the most consequential consent decision on the site rendered as 11.5px
shouting" is an unrendered library component. Nine shell routes confirmed
(`SectionPage` in 9 app files, plus `DocPage.tsx:39` reusing the band).

**Recommendation.** Move `text-transform: uppercase` off `.identityBand`
onto `.identityMeta` only ("FILE 01 / 08", "/WAR-UPDATE"), and drop it from
`.tocTitle` (:544), `.skipLink` (:73) and `not-found.module.css:100` — a
wordmark should be set the way the brand is written, and a navigation
instruction is not a data label. Fix `.sensitiveButton`
(`content.module.css:929-933`) as a library-component correction before the
October 7 gate is ever mounted (drop uppercase and tracking, raise to
`--t-caption`), noting the copy "View — contains difficult material" is not
final. `.askCta` needs no typography fix; delete it with `AskAboutFileCta`
under the dead-surface finding.

### `reading-system-dead-surface-in-the-shell` — four unreferenced pieces of shell surface

**low** · consistency · small effort
`components/sections/reading-progress.module.css:12-20`,
`components/sections/sections.module.css:421-446`,
`components/sections/sections.module.css:583-601`,
`components/sections/AskAboutFileCta.tsx:12-20`,
`components/content/index.ts:10`

**Problem.** Editor-facing dead code only: the shared `ReadingProgress`
defaults never render (all three call sites pass explicit class names),
`AskAboutFileCta` and `.askCta` have zero call sites, and
`SensitiveContent` is exported from the barrel and rendered nowhere.

**Evidence.** All anchors and greps verified. The sharpest filed claim —
that `.progressValue` "silently depends on a broken variable" — has no
consequence: `globals.css:62` sets `--gold-hi` to `#efd79a`, byte-identical
to the literal fallback in `reading-progress.module.css:16`, and the rule
never renders anyway. Same for `--accent`, declared only in
`sections.module.css:36/:56`, so its `#57a7d9` fallback is by design for
any non-section consumer. The three call sites are
`SectionPage.tsx:113-116` (topProgressTrack/Value),
`SectionToc.tsx:131-134` (depthTrack/Value) and
`GeopoliticalBrief.tsx:59`, which uses the Brief's *own* differently-styled
pair (`geopolitical-brief.module.css:168/178`: absolute, 1px,
`--data-blue`→`--gold-hi`). `SensitiveContent` appears in
`components/content/index.ts:10`, its own file, `content.module.css:887`
and `README.md:37/236-253` — a documented member of a content-block
library, not an orphan of the section shell.

**Recommendation.** Two cheap, admissible fixes: change
`var(--gold-bright, #efd79a)` → `var(--gold-hi, #efd79a)` in
`reading-progress.module.css:16` (one line, no visual change, removes a
phantom token), and either mount `SensitiveContent` or drop it from the
barrel — an unmounted consent gate is a claim the site is not making. Do
**not** collapse the two hairlines: `sections.module.css:575-581` carries
an explicit comment stating why they are separate ("The shared component's
own default classes are left alone so a future consumer does not inherit
this page's breakpoint"), which the filed recommendation proposes to undo.
Deleting `AskAboutFileCta` is also weaker than claimed — the comment at
421-423 records the retention as deliberate and DECISIONS 2026-08-25
documents its pre-fill behaviour as something to re-decide consciously.
Raise both as a separate decision rather than as cleanup.

### `reading-system-anchor-landing-is-inconsistent` — five anchor offsets, and only the Brief scrolls smoothly

**low** · interaction · trivial effort
`components/sections/sections.module.css:367-374`,
`components/content/content.module.css:492-497`,
`app/israels-story/page.module.css:77-82`,
`components/briefs/geopolitical-brief.module.css:42-46`

**Problem.** The seven dossiers jump to anchors while the Brief glides, and
anchor offsets are set ad hoc in five places with no shared token.

**Evidence.** `sections.module.css:373` `2rem` (`.blockHeading h2`),
`content.module.css:496` `6rem` (`.timelineEntry`),
`app/israels-story/page.module.css:81` `2.5rem` (`.chapter`),
`app/war-update/page.module.css:48` `6rem` (`.dispatch`), plus
`geopolitical-brief.module.css:399` `6rem` and `:859` `7rem` at a
breakpoint and `scroll-padding-top: 6.8rem` at `:758` — five distinct
offsets, not three. `grep -rn 'scroll-behavior' components/sections` is
empty, while the Brief sets `smooth` at `:46` with a reduced-motion reset
at `:908`. The filed 64px in-rail discrepancy on `/war-update` does **not**
occur: `SectionToc` queries `h2` only and dispatch headlines are `h3`
(`WireFeed.tsx:120`), so that rail is uniformly 2rem. The only mixed rail
is `/israels-story`, and the delta there is 0.5rem = 8px — below what a
reader would notice. No fixed element justifies the 6rem values: the only
fixed top chrome on a dossier is `.topProgressTrack` at `height: 2px`, and
it is `display: none` above the rail breakpoint.

**Recommendation.** The half worth doing on its own is `scroll-behavior:
smooth` on `.page` with `scroll-behavior: auto` added to the existing
`@media (prefers-reduced-motion: reduce)` block at
`sections.module.css:696`, mirroring `geopolitical-brief.module.css:46/908`
— that closes the one difference a reader can perceive. The token is a
normalization, not a bug fix: publish `--anchor-offset: 2rem` on `.page`
beside `--reading-w` (`:19`) and point the four declarations at it; the two
6rem values have no sticky element behind them and can collapse to the
token without an override.

---

## The eight destination pages

Audited as editorial documents rather than as layouts, with live
measurement in bundled Chromium at 1440×900 and 390×844. Two findings here
are about what the site claims about itself and fails to deliver; those are
the ones to read first.

### `section-pages-methodology-contains-no-methodology` — the credibility document states no sourcing standard

**high** · content-design · medium effort
`app/methodology/page.tsx:36-81`, `app/corrections/page.tsx:40-50`,
`app/war-update/page.tsx:54-57`, `app/we-are/page.tsx:29-78`

**Problem.** `/methodology` is the site's load-bearing credibility document
and it is four SectionBlocks and ~228 body words. It never states a
sourcing standard: no rule about primary vs. secondary sources, no
archiving policy (though Fake Resistance's data carries verified Wayback
snapshots), no statement of what evidence strength or each assessment label
requires, and no mention of the ingest→evidence→assessment→human-review→
publish pipeline, which lives on the About page instead. Three surfaces
route readers there for exactly what is missing: War Update says "Full
sourcing standards and the corrections policy live on the Methodology
page"; `.ai/DECISIONS.md:61` (2026-08-26) says "A single site-level
sources-and-method page (/methodology already exists) replaces per-record
link lists" for ~1,180 archive records; and `/corrections` points back at
it. Worse, the two pages defer to each other in a closed loop.

**Evidence.** `app/corrections/page.tsx:47-48` says "Full sourcing
standards are on the Methodology page" while `app/methodology/page.tsx
:78-79` says "The full policy and public log are on the Corrections page".
Four of five sentences in `/methodology`'s Corrections block are identical
to `/corrections`' Policy block (`corrections/page.tsx:40-50`; the file is
61 lines, so the filed 124-133 anchor does not exist, and the fifth
sentence differs, so "byte-for-byte" is overstated). The reader-facing
label vocabulary is `VerificationBadge`'s 9 `ASSESSMENT_PRESENTATION`
explanations plus 3 `CONFIDENCE_LABELS` (`VerificationBadge.tsx:11-56`) —
not the backend's ten confidence dimensions
(`server/contracts/enums.ts:71`), which live in an unwired layer `CLAUDE.md`
keeps out of the frontend. `METHOD_STEPS` at `app/we-are/page.tsx:29-78` is
5 stages with human review flagged `gate: true`.
`archiveUrl`/`accessedAt` are supported in `SourceList.tsx:8-42` and used
only by `lib/content/fake-resistance.ts`.

**Recommendation.** Add the three sections the site's own copy implies:
what counts as a source and how sources rank; when and how a source is
archived; and what each of the nine labels requires as evidence, worded to
match `VerificationBadge`'s `explanation` strings plus the three confidence
levels. Cut the duplicated Corrections paragraph to one sentence linking
out, and fix `corrections:47-48` so it no longer promises sourcing
standards until they exist. Do **not** move the pipeline out of
`/we-are`: `.ai/DECISIONS.md` (2026-08-25) assigns We Are "an actual
pipeline diagram, its human-review stage breaking shape" as its one
deliberate compositional device. `/methodology` should carry the pipeline
as prose in its own voice and each page should link the other. Do not
import the backend's confidence dimensions or evidence-strength enum.

### `section-pages-wikipedia-in-the-evidence-margin` — 7 of 8 sources are Wikipedia, printed as the evidence

**high** · content-design · medium effort
`lib/content/israels-story.ts:28-82`, `lib/content/war-update.ts:66-71`,
`components/content/content.module.css:694-700`,
`app/israels-story/page.tsx:117-127`

**Problem.** The site's premise is that the answer to organized falsehood is
organized evidence, and the margin device is built to put that evidence
where a reader cannot miss it. On Israel's Story the margin therefore
prints "Wikipedia" as the first line of the citation beside claims about
the founding of the state, the Six-Day War, Oslo and the Abraham Accords.
War Update does the same for UNSC Resolution 2803. A hostile reader
checking whether this site is what it says it is will scan that column and
find a tertiary source with an edit history — directly above a closing
block asserting "Every historical claim above is built to be checked."

**Evidence.** `kind: 'Wikipedia'` on 7 of 8 Source constants (`:31, :38,
:45, :59, :66, :73, :80`); only `MFA_TIRAN_BLOCKADE` (`:49-54`) is primary
— seven of eight, not the filed six. By entry rather than by constant it is
worse: **22 of the 23** `sources: [...]` arrays in the file point at a
Wikipedia constant. The founding chapter compounds it: all four entries
(`:97, :105, :113, :121`) plus the chapter roll-up (`:124`) cite
`WIKI_DECLARATION`, the "Israeli Declaration of Independence" article —
**including the `:97` entry whose claim is UNGA Resolution 181(II)**. That
citation does not cover its claim; it is a mis-citation, not merely a
tertiary one. `war-update.ts:66-71` confirmed for UNSC 2803.
`content.module.css:694-700` renders `.sourceKind` in `--mono`/`--blue` as
the margin note's first line, but only inside `@media (min-width: 1220px)`;
below that the base rule at `:218` renders it in `--ink-lo` in the text
face — so "blue mono" is desktop-only, though the word leads every citation
at every width. One filed evidence claim is wrong: `accessedAt` appears
**zero** times in the repo (`archiveUrl` appears 4 times in
`fake-resistance.ts`), so Fake Resistance does not "already use" it.

**Recommendation.** Two constraints. This reverses a documented decision —
`.ai/DECISIONS.md`, 2026-08-25, "Israel's Story ships two chapters, not
'the long arc'", explicitly accepted Wikipedia as the sourcing basis
("each built from a fetched primary source (Wikipedia, itself citing
further primary documents)"). The reversal is arguable on the merits, but
it must be filed as a reversal with a new DECISIONS entry, not as a defect
fix. And the same entry sets a rule the filed recommendation would break:
"each fact tied to a source actually fetched and checked in the session
that adds it." Do **not** paste UN / Treaty Series / State Department /
undocs.org URLs from memory — every replacement must be WebFetch-verified
in the session that swaps it, one at a time. Highest-value first step, and
one that needs no reversal at all: fix the mis-citation at
`israels-story.ts:97`. Second: populate `accessedAt` alongside the existing
`archiveUrl` on any source kept as secondary — `SourceList.tsx:34-46`
already renders both. A dated, archived secondary source reads as method; a
bare Wikipedia link reads as a placeholder.

### `section-pages-first-content-below-the-fold` — two pages bury their first exhibit

**high** · hierarchy · medium effort
`app/fake-resistance/page.tsx:104-143`, `app/israels-story/page.tsx:63-93`,
`.ai/DESIGN-V2.md:231-232`

**Problem.** DESIGN-V2's stated signature is that "the first real content
lands above the fold on every page", with the measured win recorded as
"~140px from masthead to first sentence (was ~320px)". On Fake Resistance
and Israel's Story that no longer holds — not because the shell regressed
(the shell is lean; `h1` is at y=107 on every route) but because essays and
duplicated apparatus were put in front of the material that justifies them.

**Evidence.** Chromium at 1440×900, viewport height 900. `/fake-resistance`
first `[class*=caseTitle]` = **1398px** (1925px at 390×844).
`/israels-story` first `ol li h3` = **1100px**, chapter `h2` at 891px, with
the in-column `nav[aria-label="Chapters"]` 462px tall starting at 253px.
Two of the four filed pages are **not** instances and are dropped:
`/war-update`'s first dispatch `h3` is at **768px**, above the fold; and
`/october-7`'s figure row is at 1246px but the archive index it sits below
renders "Testimonies" with its live record count at **y=419**, so that
page's primary evidence is above the fold. `.ai/DESIGN-V2.md:91` defines
"first real content" as "a milestone, a case, a figure".

**Recommendation.** Fake Resistance: reduce "The machine"/"The tells"
(`page.tsx:104-143`, ~250 words of thesis) to a two-sentence standfirst
above Exhibit A and keep the taxonomy as a closing section — the exhibits
are the argument, the essay is the gloss. Israel's Story: delete the
in-column Contents nav (`page.tsx:63-77`), which is a chapter-for-chapter
duplicate of the rail already rendered in the left margin above 1220px, so
this is redundancy removal that also recovers 462px (see
`section-pages-israels-story-two-contents-lists` for the correct
width-scoped form of the fix). Do not hoist October 7's FigureRow as part
of this; if it is ever hoisted, note the surrounding copy says "the figures
below" and "the two archives above" and must be edited with it.

### `section-pages-israels-story-two-contents-lists` — two chapter lists on one screen, disagreeing on the count

**medium** · composition · trivial effort
`app/israels-story/page.tsx:63-77`, `app/israels-story/page.module.css:11-72`,
`components/sections/SectionToc.tsx:49-62`,
`components/sections/SectionPage.tsx:148-150`
*(Filed independently by the reading-system and section-pages agents;
merged here. Both verified CONFIRMED.)*

**Problem.** The shell grew a document-navigation rail; the page-level
device it duplicates was never removed. Above 1220px a reader opening
Israel's Story is offered the same chapter list twice within one screen:
"IN THIS FILE" in the left rail in mono with Arabic numerals, and a
bordered "CONTENTS" panel at the top of the reading column in Newsreader
with Roman numerals — and they give different totals. The document
contradicts itself about its own shape before it has said anything.

**Evidence.** `page.tsx:63-77` renders `<nav className={styles.contents}
aria-label="Chapters">` with `toRoman(index + 1)` over `edition.chapters`;
`SectionPage.tsx:148-150` renders `<SectionToc>` unconditionally;
`SectionToc.tsx:58` resolves `h.id ? h : h.closest('[id]')`, which picks up
the seven `<article id={chapter.id}>` chapter titles **plus**
`SectionPage.tsx:209`'s `<h2 id={anchor}>` for the "Sources and further
reading" block. Rail = **8** entries, column = **7**
(`lib/content/israels-story.ts` has exactly 7 chapters: the-founding,
six-day-war, yom-kippur-war, peace-when-it-came, oslo-accords,
jordan-treaty, abraham-accords). The rail is a superset, not a complement.
`SectionToc.tsx:49-52`'s comment says the ancestor resolution exists so
Israel's Story does not "declare its contents a second time", which
`page.tsx:63-77` then does. `page.module.css:36-41` gives each link
`min-height: 44px`; the box measures ~420–430px (7×44 rows + 6×0.15rem
gaps + 2.8rem padding + kicker + 1.75rem margin), consistent with the
measured 459px — so the filed "roughly 300px" recovered is low, and 462px
was measured in Chromium. `page.module.css` contains no media query
touching `.contents`; the rail turns on at `sections.module.css:620`.

**Recommendation.** Add `@media (min-width: 1220px) { .contents { display:
none; } }` to `app/israels-story/page.module.css`. Do **not** simply delete
the block: the rail is client-side only and `display: none` below 1220px,
so deleting it leaves mobile and no-JS readers with no contents at all. And
drop the alternative of teaching `SectionToc` a numbering formatter —
`.ai/DECISIONS.md` 2026-08-25 puts shared chrome (`SectionPage`,
`sections.module.css`, the rail) explicitly off-limits to per-page
compositional devices, with differentiation living only in each page's own
`.body`. If the numerals are worth preserving they belong to the chapter
heads, which already carry them (`.chapterNumeral`, `page.tsx:86-88`).

### `section-pages-war-update-renders-every-source-twice` — 18 source links for 8 sources

**medium** · information-density · trivial effort
`app/war-update/page.tsx:72-74`, `app/war-update/WireFeed.tsx:124-125`,
`app/israels-story/page.tsx:105-111`

**Problem.** Every dispatch already carries its own sources in the right
margin via `.dispatchSources` / `marginNote`. The page then renders a
"Source stack" section listing the same eight sources again in the reading
column. This is precisely the defect Israel's Story fixed, and the comment
recording that fix explains why it was invisible before and obvious after:
"rendering it here printed every citation on this page twice — invisible
while both sat in the column, obvious once each entry's sources moved out
to the margin beside it." The fix was not carried across. It also breaks
the margin device's premise: if the definitive list is at the foot of the
page, the margin note is a preview rather than the evidence, and the
numbered `.sourceNumber` the margin deliberately hides
(`content.module.css:690-692`) reappears downstairs pointing at nothing.

**Evidence.** `lib/content/war-update.ts` holds 8 unique sources; entries
cite 10 source references (2+2+2+1+1+1+1), no `archiveUrl` anywhere, so
exactly **18** `a[target="_blank"]` source links render. **Two** sources
appear three times (`toi-full-text`, `npr-next-steps` — two dispatches each
plus the stack), not the filed three; the other six appear twice. All 8
stack sources are the union of the entries' sources, so deleting the block
orphans nothing — the same property that justified the identical removal on
Israel's Story (`.ai/DECISIONS.md:499-504`). Two anchors had drifted line
numbers: the margin sources are `WireFeed.tsx:124-125` (the file is 135
lines) and the source-count row is `PublicationMeta.tsx:26-30` (45 lines).
The margin only takes effect at ≥1220px (`content.module.css:663`); below
that both renderings sit in the column, which is the "invisible" pre-fix
state, not an absence of duplication.

**Recommendation.** Delete `app/war-update/page.tsx:72-74` only. Leave
`edition.sources` in `lib/content/war-update.ts`, as Israel's Story left
its `chapter.sources`, since `sourceCount` still reads from it for the
`PublicationMeta` row that preserves the count. Fake Resistance has the
same defect in a smaller form — `page.tsx:221-238` passes each case's
`sources` into the "Claim propagation" Timeline, a second rendering of the
lists already shown at `:214-216` — which the propagation finding below
resolves.

### `section-pages-fake-resistance-propagation-manufactures-its-own-pattern` — a coordination signature inferred from flagging dates

**medium** · content-design · medium effort
`app/fake-resistance/page.tsx:221-241`,
`app/fake-resistance/page.tsx:116-142`,
`lib/content/fake-resistance.ts:47-48`,
`lib/content/fake-resistance.ts:77-78`,
`lib/content/fake-resistance.ts:104-105`

**Problem.** The closing block tells the reader that three campaigns
"flagged within four days of each other" show "the same synchronized-timing
signature 'The tells' describes above, visible across cases rather than
within one". The three datetimes are the publication dates of the three
fact-checks the page cites, on three cases the authors selected. Reading a
cluster of n=3 self-selected fact-check flagging dates as a coordination
signature is the pattern-from-noise inference the page has just spent 400
words teaching readers to distrust — on the one page where the site's own
method is the subject. The device is also inert: every entry renders the
identical visible label "Oct 2023", so the timeline shows three rows with
the same date, sorted by a value the reader never sees, re-citing the same
sources shown directly above.

**Evidence.** `page.tsx:223-225` verbatim. All three cases carry
`dateLabel: 'Oct 2023'` with `datetime` 2023-10-12 / 2023-10-13 /
2023-10-10; the Axios URL is `/2023/10/12/` and the PolitiFact URL is
`/2023/oct/10/`, so two of three are provably the cited fact-check's
publication date, and the module doc confirms the cases were "chosen and
verified in the authoring session". `Timeline.tsx:41` renders
`entry.dateLabel`, not `datetime`. "Within four days" is defensible (Oct
10–13 is a 3-day span across 4 calendar days), and the copy is more careful
than the filed claim allowed — "flagged and corrected by the source cited
below" correctly labels what the dates are; the defect is the *inference*,
not a mislabeling. Tells coverage: 4 enumerated at `page.tsx:122-133`; the
`tells` arrays name imagery in all 3 cases and synchronized timing in
exactly **1** (arma3-footage), so the cross-case timing claim is supported
by one exhibit. Also note `page.tsx:69` and `:74` use the same
`c.datetime` as both the ClaimReview `datePublished` and the reviewed
Claim's `datePublished`, which is only coherent if the value is the review
date.

**Recommendation.** Prefer rewriting over deletion. Deleting the block
orphans `Timeline`'s `spread` variant (its only call site,
`content.module.css:486/521/552`) and stales the measured example in
`.ai/DECISIONS.md:478-488` ("Fake Resistance's claim-propagation entries
run 97–127px tall against citations of 136–150px"), which produced the
margin-grid rule. Lower-cost fix: drop the second half of the sentence —
the "same synchronized-timing signature … visible across cases" inference —
retitle the block to what it honestly is (the order in which each file was
flagged and corrected), and give each entry a real day-level `dateLabel`
("Oct 10, 2023") naming the flagging outlet, which makes the sort visible
and the device non-inert. File the tells-coverage gap — two of four
signatures demonstrated, no exhibit documenting an amplifier network
despite "The machine" making them the second link in the supply chain — as
a separate, lower-severity editorial item.

### `section-pages-support-us-toolkit-two-up-in-a-68ch-measure` — 285px form controls

**medium** · layout · trivial effort
`app/support-us/page.module.css:7-12`,
`app/support-us/page.module.css:119-124`,
`components/support/support.module.css:6-8`,
`components/sections/sections.module.css:20-21`

**Problem.** `.toolkit` is a two-column grid, but its container is the 68ch
reading measure, not the viewport. Above 900px every form control is 285px
— too narrow to read back a URL a reader has just pasted, on the single
most important field of the site's only public write path — and the skill
cards get ~234px of text, about 28 characters a line.

**Evidence.** `--reading-w: min(68ch, 100%)` = 693.6px (68 × 0.6em × 17px,
`--t-body: 1.0625rem`, IBM Plex Sans 600/1000 digit advance). Modules =
(694−24)/2 = **335px**; `#report-url`, `#report-body`, `#report-email`,
`#volunteer-*` and the `.skillGrid` ContentCards all **285px**; card text
~234px after 1.5rem padding and the 2px accent border. Two filed anchors
had wrong line numbers (the file is 124 lines, not 300+) and two evidence
claims are wrong: `.form { max-width: 30rem }` is **not** dead code — below
the 900px query the toolkit is single-column and the module's inner width
runs ~590–644px between roughly 730px and 900px viewport, where the 480px
cap binds. And "six lines to say 'Seen a claim that needs checking?'"
misreads the markup: that sentence is one line; the six lines are the full
213-character lede at ~35–40 chars. The `/we-are` pipeline parallel is
overstated at the lede level — that comment describes 110px stages at 2–3
words a line. No container queries exist anywhere in the repo, and the
`max-width: 900px` query is viewport-keyed, so 901px upward is unrescued.

**Recommendation.** Make `.toolkit` single-column at all widths
(`app/support-us/page.module.css:9` → `grid-template-columns: minmax(0,
1fr)`), the resolution We Are's pipeline already took. The two modules are
a sequence — report a claim, then offer a skill — not a comparison. This
edits only the page's own `.body` CSS, which the 2026-08-25 per-page
composition decision permits, and leaves the toolkit device (panel chrome
for the two live tools, none for Amplify/Sustain) intact. Once
single-column, keep `.form { max-width: 30rem }` — it stops being inert and
becomes the thing preventing 694px inputs — but let the URL field
specifically take the full measure. Leave `.practiceGrid` two-up; it
carries no controls.

### `section-pages-corrections-is-108-words-and-promises-a-column-it-cannot-render`

**medium** · content-design · small effort
`app/corrections/page.tsx:53-56`,
`components/content/CorrectionHistory.tsx:17-31`,
`lib/content/corrections.ts:12`, `components/support/ReportClaimForm.tsx`

**Problem.** `/corrections` promises "the page it applied to" in copy that
`CorrectionHistory` has no field to render, and gives a reader who has
found an error no link to the report form that exists on `/support-us`.

**Evidence.** `page.tsx:54-55` — "Every correction issued across the site
appears here, dated, with the page it applied to and what changed" — against
`CorrectionHistory.tsx:20-26`, which renders `correction.date`, optional
`correction.version` and `correction.note` only. `CorrectionsLogEntry`
carries `page` and `slug` (`lib/content/corrections.ts:12`) and grep
confirms nothing repo-wide reads them, so the promised column cannot appear
even once the log fills. `ReportClaimForm` is mounted only at
`app/support-us/page.tsx:58`; `/corrections` links solely to `/methodology`
(`page.tsx:48`). Word count verified at ~107 body words. Anchors were badly
drifted in the filing (the file is 61 lines, `lib/content/corrections.ts`
is 16, `DocPage.tsx` is 67) but the quotes are all real. The atmospheric
half of the complaint is refuted: the 373px margins carrying corpus
fragments are `ScanBackdrop`, and `DocPage.tsx:9-12` documents the
rail-less full-reach scan as intended for exactly these two pages.

**Recommendation.** Prefer cutting "with the page it applied to" from
`page.tsx:55` over adding the field — the log is empty, and a field nothing
populates is the weaker half of the pair. Add a link to the report form as
a prose sentence inside the existing SectionBlock, not a trailing CTA
block: `DocPage.tsx:61-62` states "No closing apparatus" and
`.ai/DECISIONS.md:806` rejects footer-shaped additions, while an in-prose
link is already the established pattern. Do **not** edit
`CorrectionHistory`'s empty state: `correctionsEmpty` is shared with
`GeopoliticalBrief.tsx:114`, and "None recorded" is a documented decision
(`.ai/DECISIONS.md:411`; `content.module.css:414-416` defends its
non-uppercase setting as the deliberate way the page "admits to having
nothing" without shouting). Add the context as a page-level sentence
instead, mirroring the line `HomeFrontPage.tsx:135-137` already ships —
which is worth noting on its own: the home card currently explains the
empty log better than the page devoted to it.

### `section-pages-our-heroes-consent-boundary-arrives-last-and-unmarked`

**medium** · hierarchy · small effort
`app/our-heroes/page.tsx:83-103`,
`components/sections/sections.module.css:379`,
`app/war-update/page.tsx:49-57`, `app/war-update/page.module.css:15-25`

**Problem.** The disclosure that this site has no family-consent process,
and that every profile is assembled only from what named press has already
published more than once, is a binding commitment (`.ai/DECISIONS.md`,
2026-08-25). It renders as an unmarked body paragraph in the page's last
block, after three formally framed citations for real, named, dead and
living people — by which point the corner-bracketed frame, the "In
recognition — October 7, 2023" formula and the commendation register have
already told a reader these are memorials built with families, which is
exactly what they are not. The heading over it, "How these stories are
built", also mis-describes it: it reads as a production note, not as a
limit on what the page claims.

**Evidence.** `page.tsx:83-90` renders `<SectionBlock heading="Citations">`
(featured citation plus a two-up `.citationGrid`); `:92-103` renders the
consent paragraph last, with no className, inheriting `:where(.body) p`.
The War Update contrast is stronger than filed: `app/war-update/page.tsx
:49-57` puts its comparable `.advisory`/`.advisoryLabel` editor's note in
the **first** block, so the in-repo precedent is both a typographic
treatment and a top-of-page placement, and Our Heroes — with the stricter
commitment — does the opposite of both. The filed pixel measurements
("2272px page", "first citation name at y=404") could not be reproduced and
should be re-measured; the page carries only three profiles. One partial
mitigation the filing missed: the page's two `h2`s meet `SectionToc`'s
`MIN_HEADINGS = 2`, so above 1220px with JS the disclosure is listed by
name in the rail — weak, but not nothing.

**Recommendation.** Keep the wording verbatim and un-gated. Move the block
above the Citations block and give it a bordered/italic standfirst with a
gold `--t-data` label, defined **locally** in
`app/our-heroes/page.module.css` rather than by `composes:`-ing War
Update's module, and without touching `SectionPage`/`sections.module.css`
(2026-08-25 composition decision). Renaming the `h2` to name the limit
("What this page will not publish") is fine. Drop the proposal to rename
"Citations": that heading is the page's documented compositional device
(`.ai/DECISIONS.md`, 2026-08-25, "Our Heroes as formal citations"), and the
"In recognition — October 7, 2023" kicker already disambiguates it from a
source citation.

### `section-pages-margin-citation-repeats-into-wallpaper` — one identical citation down a run of entries

**medium** · information-density · medium effort
`lib/content/october-7.ts:31-36`, `lib/content/israels-story.ts:97-124`,
`components/content/Timeline.tsx:49-52`,
`components/content/content.module.css:657-710`

**Problem.** "The source travels beside the claim" only carries information
when the evidence differs record to record. All seven October 7 timeline
entries cite the same ADL backgrounder, so the citation prints unchanged
beside each record; Israel's Story repeats a single Wikipedia note across
runs of 4, 3, 2 and 2 consecutive entries. The device stops reading as
evidence and starts reading as a repeating ornament — and it tells an
attentive reader that the site's most solemn page rests on a single
secondary source, which is true but is being presented as though it were
seven corroborations.

**Evidence.** `october-7.ts:31-36` defines one `ADL_SOURCE`, used at `:53,
:63, :73, :83, :92, :103, :113` — 7 of 7 entries. `israels-story.ts`:
`WIKI_DECLARATION` at `:97/:105/:113/:121` (the 5th occurrence at `:124` is
the chapter field and is deliberately no longer rendered, per
`.ai/DECISIONS.md:499`), plus `WIKI_YOM_KIPPUR_WAR` at `:171/:179/:187`,
`WIKI_OSLO_ACCORDS` at `:221/:229`, `WIKI_ABRAHAM_ACCORDS` at
`:263/:271` — so the repetition is broader than filed. The render path is
`Timeline.tsx:49-52` (the file is 58 lines; the filed `:296-300` does not
exist). Two scope corrections: there is no truncation rule on
`.sourceLabel`, so the label renders in full rather than ellipsised; and
the repetition is visible below 1220px too, in the column. Nothing dedupes,
and DECISIONS records only the chapter-vs-entry duplication fix, not this
one.

**Recommendation.** Prefer the editorial half: source the seven October 7
entries individually — each is a discrete, heavily documented event, and
the page's claim is that the record is checkable. The code-level dedupe is
the weaker fix and must **not** be done by suppressing `.timelineSources`:
the CSS header and `.ai/DECISIONS.md:469-490` both rest on the citation
staying inside its entry in the markup so reading order, screen readers and
the no-JS page are unchanged, and dropping the element strips attribution
for non-visual readers. If a visual collapse is wanted, keep the markup and
hide only the repeated visible label while keeping an accessible copy, or
render one run-level note at the first entry while leaving each entry's
`sources` in the DOM.

### `section-pages-war-update-opens-on-a-disclaimer` — the body opens on apparatus

**medium** · content-design · small effort
`app/war-update/page.tsx:49-70`, `lib/content/war-update.ts:171-172`,
`components/sections/SectionPage.tsx:154-156`

**Problem.** Read the `h2` list alone and the document's argument is: Trust
/ Documented milestones · Sept 2025 – Jul 2026 / Source stack. Two of three
are apparatus; the content carries no heading of its own. The page then
opens on the apparatus — an editor's note telling the reader what the page
is *not*, a second paragraph pointing at Methodology, a metadata grid, five
filter chips, and only then the first dispatch. The caveat is right and
worth keeping; leading with it is a hedge, and stacking three layers of
framing before the first dated fact rebuilds the ~320px opening ceremony
DESIGN-V2 removed, out of content instead of chrome. A wire desk earns the
right to caveat by filing first.

**Evidence.** `page.tsx:49-58` renders `<SectionBlock heading="Trust">` as
the first body child; the advisory is `war-update.ts:171-172`. Rendered
`h2` list (SectionBlock is the only `h2` source — `PublicationMeta` emits a
`<dl>`, `CorrectionHistory` a `<span>`, `WireFeed` only `h3`s): ["Trust",
"Documented milestones · Sept 2025 – Jul 2026", "Source stack"]. Filter
chips: 5 (`WireFeed.tsx:18`). The metadata grid is **not** six rows:
`PublicationMeta.tsx:20-31` pushes 5 entries into `repeat(3, ...)`
(`content.module.css:281`), so it renders as 2 rows of 3, ~130px — the
pre-feed stack is lighter than described, which is why this is medium. The
first-dispatch y=768 could not be re-measured here but is consistent with
the stack. The standard violated is `.ai/DESIGN-V2.md:231`.

**Recommendation.** Reorder to dispatches-first: render the advisory as a
one-line `.advisory` strip immediately under `.ledeRule` with no `h2` of
its own, and move `PublicationMeta` to the foot of the feed where a reader
who has read the entries wants provenance. Do **not** use the `tagline`
slot — `tagline` is bound to `TAGLINE` at `page.tsx:10-11` and reused as
`metadata.description` and the OG description, so putting the advisory
there would overwrite the page's real lede and its search summary. Retitle
the feed heading so it states the period's argument rather than its filing
status. And do not literally delete the "Source stack" `h2` — `SourceList`
would then merge into the feed with no heading; the duplication is between
that heading and `PublicationMeta`'s "Source stack" `<dt>`
(`PublicationMeta.tsx:26-31`), so rename one or drop the `sourceCount` row
once the meta moves next to the list.

### `section-pages-wire-device-outlives-its-content` — five filter chips over seven entries

**low** · interaction · small effort
`app/war-update/WireFeed.tsx:18`, `app/war-update/WireFeed.tsx:81-94`,
`app/war-update/WireFeed.tsx:96-97`, `lib/content/war-update.ts:92-163`,
`app/war-update/page.module.css:27-43`

**Problem.** Five category chips sit above seven entries; three of them
return exactly one dispatch, and the `emptyFilter` branch cannot fire on
the current data. Filtering a seven-item list to one item is a slower way
of scrolling.

**Evidence.** `WireFeed.tsx:18` (not `:97`) — `const FILTERS = ['All',
'Diplomacy', 'Hostages', 'Front · Home front', 'Humanitarian']`; filter row
at `:81-94`; `.latest` at `:116` (not `:195`); the file is 135 lines.
Category counts over `war-update.ts:92-163`: Diplomacy 4, Hostages 1,
Front·Home front 1, Humanitarian 1 — so the filed prose claim "Hostages
returns 2" contradicts its own evidence block, which is right. The rest of
the filed complaint is already handled or reverses a decision. `wireRise`
is switched off by `@media (prefers-reduced-motion: reduce)` at
`page.module.css:210-214`. The "disclosed provenance" the recommendation
asked for is already on the page: `PublicationMeta` (`page.tsx:60-66`)
renders Edition "Reference edition 001", Published "Aug 25, 2026" and
Coverage window "Sept 2025 – Jul 2026" directly above a section headed
"Documented milestones · Sept 2025 – Jul 2026", under a trust strip saying
in prose "not a live front-line feed" — against that frame "Latest" reads
as latest-in-this-edition. And `.ai/DECISIONS.md`, 2026-08-25, adopts the
Latest marker deliberately as the honest substitute for a fabricated
visit-diff, to be revisited only if real visit-tracking is added;
`TODOS.md:190` and `:988` commissioned the filters and the per-entry share
as deliverables.

**Recommendation.** Keep only the filter half, and as a threshold note
rather than a deletion: collapse the chips to a single "All / Diplomacy"
split, or drop the row until the edition passes ~20 entries, leaving
`emptyFilter` in place as the defensive branch it is. Do not remove the
`.latest` pill (reverses a documented decision, and its replacement is
already rendered), do not remove `wireRise` (already reduced-motion gated),
and do not remove the per-dispatch Share (a `TODOS.md:988` deliverable
paired with Support Us's `ShareVerifiedButton` by design).

### `section-pages-review-metadata-exists-and-is-never-shown`

**low** · consistency · small effort
`lib/content/october-7.ts:147-148`, `lib/content/israels-story.ts:279-280`,
`lib/content/our-heroes.ts:102-103`,
`components/sections/SectionPage.tsx:133-142`,
`components/content/PublicationMeta.tsx:25`

**Problem.** October 7, Israel's Story and Our Heroes each declare
`publishedAt` and `reviewedBy` that no reader-facing surface consumes —
Israel's Story's not even by its JSON-LD — while the other three editorial
destinations render the same fields through `PublicationMeta`.

**Evidence.** `grep -rn reviewedBy app/ components/` shows consumers only
at `app/fake-resistance/page.tsx:148`, `app/war-update/page.tsx:64` and
`components/briefs/GeopoliticalBrief.tsx:91` — so `PublicationMeta` ships
on **3** of 8 destinations, not 2. October 7 and Our Heroes use
`publishedAt` for JSON-LD only; `app/israels-story/page.tsx` references it
nowhere. `PublicationMeta.tsx` is 45 lines; the `reviewedBy` row is line
25. The masthead half of the filed finding is largely refuted:
`SectionPage.tsx:141` hardcodes "Reference edition" on the 7 SectionPage
routes (not 8 — the Brief has its own layout, and methodology/corrections
use `DocPage`, whose band has no edition slot), and `.ai/DECISIONS.md`
2026-08-25 ("Marathon content is real and sourced, or labeled a reference")
explicitly replaced a hardcoded `Monitoring · active` rail label with
`Reference edition` and says do not reintroduce a live-sounding label. The
string is uniform because all seven pages genuinely are reference editions.

**Recommendation.** Do the first half only: render `PublicationMeta` as a
colophon at the foot of `/october-7`, `/israels-story` and `/our-heroes`,
or delete the unused fields from those three modules — either resolves the
inconsistency. Drop the masthead change: an "Updated 25 Aug 2026" status
would reintroduce exactly the freshness claim `lib/content/home.ts:12-23`
forbids, since all editions share one authoring-pass `publishedAt`. If a
per-page status prop is still wanted it must carry only non-temporal, true
states, defaulting to the current string.

### `section-pages-primary-ctas-typed-at-the-floor` — two control labels take uppercase at three words

**low** · typography · trivial effort
`components/support/support.module.css:88-103`,
`components/support/share-verified.module.css:4-20`,
`app/support-us/page.module.css:85-93`,
`app/october-7/page.module.css:166-167`

**Problem.** "Continue by email" and "Share what's verified" are set in
uppercase+tracking at three words, contradicting four other stylesheets
that decline it by name for the same reason.

**Evidence.** Both controls set `font-family: var(--face-data); font-size:
var(--t-data); letter-spacing: var(--t-data-tracking); text-transform:
uppercase` — 11.52px at a 16px root. The filed word count is wrong: "Send
report" is two words and in bounds, and "Copied — paste it anywhere" is
four, not five, so the real count is **two** violating labels, not three.
The reader-harm claim is also overstated: `--gold #C9A24B` on `--ground
#070B14` is 8.2:1 and both controls carry a 1px gold border and 44px
min-height, so they are neither the dimmest nor indistinguishable from
metadata. Counter-anchors are real but were mis-numbered:
`app/support-us/page.module.css:85-93` and `app/october-7/page.module.css
:166-167`, plus `components/home/home.module.css:159` and `:394` — four
refusals by name. And `support.module.css:88-89` carries an explicit
authored carve-out: "two or three words, and a control label is the one
place the data voice still reads as a button", with
`share-verified.module.css:1-2` pointing back to it. This is a contested
convention, not an unnoticed slip.

**Recommendation.** If changed, set `font-family: var(--face-text);
font-size: var(--t-caption); font-weight: var(--t-caption-weight);
text-transform: none; letter-spacing: 0`, keeping the gold rule and 44px
target — use the token weight (500), not a fresh 600, which would introduce
an eighth weight by the back door. Treat a filled `--gold` background as a
separate call: it changes the page's visual hierarchy well beyond a
typography fix and needs a checked dark foreground. Because
`support.module.css:88-89` documents the current choice on purpose, the fix
must replace that comment rather than silently contradict it. War Update's
`.permalink`/`.shareButton` are genuinely secondary and can stay in the
data voice.

### `section-pages-forms-hide-what-is-required-until-after-submit` — the volunteer form applies no validation at all

**low** · interaction · small effort
`components/support/VolunteerInterestForm.tsx:16`,
`components/support/VolunteerInterestForm.tsx:49`,
`components/support/VolunteerInterestForm.tsx:67`,
`app/support-us/page.tsx:52-56`

**Problem.** No field in the volunteer form carries `required`, so an empty
submit opens a `mailto:` whose whole body is "I would like to volunteer." —
a form that collects nothing on a page that just asked for five things. And
`mailto` has no failure state, so a reader with no configured mail client
gets silence and no receipt.

**Evidence.** `grep -rn "required" components/support/` returns nothing.
`VolunteerInterestForm.tsx:16` is `const VOLUNTEER_INBOX =
'volunteers@lionsofzion.io'`; `:10-11` is the "placeholder pending a
confirmed real address" comment; `:49` is the fallback string; `:67` is the
unmarked "Email" label against `:57` "Name (optional)". The file is 119
lines, so the filed `:172-177`/`:198-213`/`:228` anchors do not exist. The
report-form half of the finding is **refuted**:
`app/support-us/page.tsx:52-56` already states the rule in prose above the
form — "Send a link or a short description … giving an email is entirely
optional" — and `ReportClaimForm.tsx:116`'s label literally reads "Or
describe it", so "the true rule surfaces only after a failed submit" is
false. The placeholder inbox is a documented decision
(`.ai/DECISIONS.md`, 2026-08-25) and a tracked pre-production item
(`.ai/STATE.md:601-602`, `TODOS.md:427`), not an undiscovered defect.

**Recommendation.** Add `required` to the email input
(`VolunteerInterestForm.tsx:68-73`) and label it "Email (required)" so it
matches the "(optional)" marking on Name; that alone guarantees the mailto
carries a reply address. Do not disable the submit until an email plus a
skill area are present — the extra gate buys little and the checkbox group
has no error affordance. Drop the report-form hint recommendation entirely;
if anything is done there it is `aria-describedby` wiring the two fields to
a shared hint id, not new copy (see
`cross-cutting-forms-die-without-js` for the aria fix that is worth
shipping). Leave the placeholder inbox to its existing tracking, and treat
the field-reorder suggestion as unsupported taste.

### `section-pages-oslo-flagged-in-the-hostile-colour`

**low** · colour · small effort
`app/israels-story/page.tsx:80`,
`app/israels-story/page.module.css:151-163`, `app/globals.css:64-72`,
`components/sections/SectionPage.tsx:64-65`

**Problem.** Israel's Story flags its one disputed chapter with the ember
ramp, and hardcodes the flag to an id string literal instead of a chapter
field.

**Evidence.** `page.tsx:80` is `const flagged = chapter.id ===
"oslo-accords";`; `page.module.css:157-163` gives the chapter an ember left
rule, an `rgba(168, 90, 97, 0.08)` panel and a `--data-ember-peak` drop
cap. Nothing in `.ai/DECISIONS.md` sanctions the colour choice, so the
recommendation reverses nothing. But the filed premise that ember has
exactly one meaning is wrong: besides `ScanBackdrop`'s hostile streams and
Fake Resistance's `accent="ember"`, it carries form validation errors
(`support.module.css:121-125`) and brief assessment warnings
(`geopolitical-brief.module.css:505-540`), so its real sense is *caution*,
which "this legacy is genuinely disputed" is not wholly outside. No
accessibility issue: composited over `--ground` the panel reads ~`#141a1a`
and the ember-peak drop cap sits at ~7.0:1.

**Recommendation.** The clearly correct half is replacing the id literal
with a `contested?: boolean` field on `StoryChapter`
(`lib/content/israels-story.ts:14-20`) so the flag travels with the
content. On colour, `contested` (#e6a972) is the right semantic match and
its published meaning — "credible sources disagree and the record does not
yet settle it" (`VerificationBadge.tsx:34-37`) — fits exactly, but it is a
raw hex inside the badge component, not a token, so copying it into the
page module would spread an untokenised value. Promote it to a variable in
`globals.css` alongside the ramps first, or reuse `VerificationBadge` with
`data-assessment="contested"` above the intro rather than restyling by
hand. A "Contested" `--t-data` label is permitted (one word, data label).

### `section-pages-israels-story-fourth-chapter-is-not-a-chapter`

**low** · content-design · trivial effort
`lib/content/israels-story.ts:194`, `lib/content/israels-story.ts:196`,
`lib/content/israels-story.ts:197-207`, `app/israels-story/page.tsx:117`

**Problem.** Chapter IV is still titled "Peace, when it came" — a thematic
name in a set where the other six are event+date — contains a single
timeline entry (the 1979 Egypt treaty), and forward-references chapters VI
and VII in its intro. The closing block's heading, "Sources and further
reading", names neither.

**Evidence.** `:194` `title: 'Peace, when it came'`; `:196` ends "— both
covered as their own chapters below"; `:197-207` is a `timeline` of exactly
one entry. Jordan (`:236-249`) also holds one, Abraham Accords
(`:253-274`) two, chapter I (`:87-123`) four.
`app/israels-story/page.tsx:117` wraps a single paragraph about a gap in
the ancient/biblical period under "Sources and further reading". The name
is a leftover, and the history explains it: `.ai/DECISIONS.md:789-799`
shows it was coined when the edition had two chapters and Egypt was the
*only* peace chapter, and `TODOS.md:201-202` records the later deliberate
choice to add Jordan 1994 as a separate chapter rather than merging it in.
Two filed claims are overstated: the chapter does not "spend its opening
paragraph apologising" (the forward reference is a trailing clause of a
two-sentence intro), and "seven equal movements" is a taste reading —
uneven chapter lengths are normal in a book.

**Recommendation.** Rename `:194` to "Peace with Egypt, 1979" and drop the
trailing clause at `:196`. Do **not** rename the `id`
`peace-when-it-came`: it is the `#anchor` in the contents nav and the
`hasPart` URL in the page's JSON-LD, and ids are load-bearing in this file
(`flagged = chapter.id === "oslo-accords"`). The Yom Kippur entry at `:186`
still reads correctly after the rename. Retitle the closing block "What
this edition does not yet cover"; note that per-chapter source lists were
deliberately removed (`.ai/DECISIONS.md:499-503`), so restoring a literal
"further reading" list would need to avoid re-introducing the
duplicate-citation problem that decision fixed.

### `section-pages-assessment-ramps-are-one-colour` — the Fake Resistance stamp and the badge disagree

**low** · colour · small effort
`components/content/content.module.css:113-178`,
`app/fake-resistance/page.tsx:164-176`
*(The measurement half is the same defect as
`reading-system-verdict-ramp-cannot-signal-its-verdict`; what is new here
is the on-page contradiction.)*

**Problem.** Fake Resistance stamps `out_of_context` grey while the
`VerificationBadge` two lines below renders it ember — visible on Exhibit B
right now. The five-value ember family also sits within ΔE 7.7–10.2, which
is a latent vocabulary weakness rather than a live one.

**Evidence.** Hexes confirmed at `content.module.css:116/127/133/139/149/
155/162/172`; shape variants at `:121-124, :144-146, :167-169, :177-179`
(**not** in `VerificationBadge.tsx`, which is 80 lines — that filed anchor
is invalid). ΔE (CIE76) recomputed: false/manipulated 8.8,
misleading/manipulated 7.7, misleading/out_of_context 10.2,
misleading/contested 10.0. Two filed figures are wrong in the code's
favour: verified↔contested is **18.7** with an opposed a\*, the largest gap
in the warm set, not "a short step"; and false/out_of_context is 20.4, so
the two badges that actually share a page today are far apart. Live values:
`war-update.ts` all `verified`; `adapters.ts` `STATUS_TO_ASSESSMENT` emits
only verified/unverified/contested; `fake-resistance.ts:57/86/114` false,
out_of_context, false. `misleading` and `manipulated` render nowhere.

**Recommendation.** Make the one change worth making now: derive Fake
Resistance's `data-tone` from the badge's own assessment→family mapping so
Exhibit B stops carrying a grey stamp over an ember badge. Do **not**
collapse the nine-value ramp to three tiers — `README.md:59-61` states the
four colour groups as designed intent, and the proposal is mostly that same
grouping with two values reassigned, so it needs an argument against the
documented one. Moving `contested` to the neutral `#a3b4c6` is the one
defensible piece (an unresolved state sitting in the refuted family). Shape
is already the second channel and is exhaustive-by-construction; leaning on
it harder is fine, but nothing here justifies a colour-system rewrite
before real content exercises more than 5 of the 9 values.

---

## The October 7 archives and the Geopolitical Brief

514 records across two packages — 179 testimonies (505 language versions,
16,265 blocks) and 335 documentation records (670 versions, 2,010 blocks) —
served as 1,175 prerendered record pages plus two indexes. This is 57% of
the routes on the site and it carries seven of the audit's twelve high
findings. Live measurement in bundled Chromium at 1440×900 and 390×844;
every census figure below was recomputed from `content-packages/` during
verification.

### `archive-brief-documentation-record-says-one-sentence-three-times`

**high** · hierarchy · small effort
`components/archive/ArchiveBlocks.tsx:54-59`,
`components/archive/ArchiveRecordPage.tsx:55`,
`components/archive/archive.module.css:13-21`,
`components/archive/archive.module.css:27-32`

**Problem.** All 670 documentation record pages print the record title
twice in a row — as the 34–44px `h1` and again as a 20px `h2` — and 336 of
them print it a third time as the body paragraph. The reader meets the same
sentence in three sizes and three colours before the video or image that is
the actual record. On a single-exhibit page that repeats its own caption,
the page looks automated and unedited, which is the opposite of the
evidentiary register the section claims.

**Evidence.** Recomputed over all 335 hamas-massacre records / 670
versions: **first heading == title in 670 of 670** (normalised,
whitespace-collapsed, case-insensitive) — stronger than the filed claim.
First paragraph == title in **336** (not the filed 334/668, and the filing
contradicted itself between 668 and 334), near-identical (ratio ≥ 0.9) in
79 more. In ~215 Spanish versions the paragraph is the *untranslated
English* of the same sentence — a separate and arguably worse defect the
filed fix would not catch (e.g.
`records/a-demolished-israeli-home-with-bloodstains-all-over.json`, es
title "Una casa israelí demolida con manchas de sangre por todas partes",
paragraph "A demolished Israeli home with bloodstains all over"). Every
version is exactly 3 blocks: 418 heading/paragraph/video, 252
heading/paragraph/image, which `.ai/DECISIONS.md` (2026-08-26)
independently confirms. `ArchiveRecordPage` passes
`displayTitle(version.title)` to `DocPage`'s `<h1>` (`.title` =
`--t-display`); `.heading` is `--t-h3`/`--face-display`/`--ink-hi` and
`.paragraph` is `--t-body`/`--ink`. The testimonies package is unaffected:
4 of 505 versions have heading == title. `tests/archive-content.test.ts`
asserts only media resolution and the block-type subset, so a render-time
skip breaks nothing, and package rule 3 in `docs/archive-integration.md` is
about preserving display *order*, rule 5 about credits.

**Recommendation.** Split it. **(1)** In `ArchiveBlocks.tsx`, pass the
rendered title down from `ArchiveRecordPage`/`ArchiveRecord` and skip a
*leading* `heading` block whose normalised text equals it. That fixes all
670 pages, loses no text (the same string still renders as the `h1`), and
touches no stored data. **(2)** Treat the paragraph separately: a
byte-equality skip catches only 336, and on the ~215 Spanish pages the
duplicate is an untranslated English sentence, which is a content/import
problem rather than a rendering one. If the paragraph is suppressed at
render, re-read `ArchiveRecord.tsx:105`'s provenance footer, which
currently promises the record is "reproduced as published — its text … 
unaltered".

### `archive-brief-index-emits-the-entire-archive-with-no-way-to-narrow-it`

**high** · information-density · medium effort
`app/october-7/documentation/page.tsx:41-53`,
`app/october-7/testimonies/page.tsx:38-41`,
`components/archive/ArchiveRecordList.tsx:26-48`,
`components/archive/archive.module.css:240-267`

**Problem.** Both index routes render every record as a ~77px row and stop.
There is no text filter, no sort, no pagination, no count-scoped view, and
no cross-archive search — which `docs/archive-integration.md:321-323` names
as the one thing this site has that neither source does. Worse, `DocPage`'s
`.page` is an inner scroll container, so browser scroll restoration does
not return a reader to row 250 after they open a record and press Back;
they restart at the top of a 300-row list.

**Evidence.** Counts confirmed at source:
`content-packages/hamas-massacre/records` = 335 files,
`content-packages/october7/records` = 179. Row height recomputed from CSS:
0.95rem×2 padding (30.4px) + title 1.125rem × 1.45 (26.1px) + 0.2rem gap +
meta 0.72rem × 1.45 (16.7px) = **76.4px**, so the filed 77px is right;
335 × 76.4 ≈ 25.6k px for single-line rows, and the browser-measured
31,311px implies roughly a third of titles wrapping — plausible at a 68ch
measure but not independently confirmed here. The 657,516-byte /
2,478-node figures could not be reproduced without a build; treat them as
unverified. Confirmed by reading: neither route file contains an input,
select or slice; `app/october-7/documentation/[category]/` has only
`[slug]/`, so there is no per-category index route to jump to; `.page` is
`height: 100dvh; overflow-y: auto` (`sections.module.css:45-46`) and
nothing restores its `scrollTop`. One mitigation the filing did not
acknowledge: `/documentation` is already grouped into six source categories
with headings and per-group counts, and because every row is in the server
HTML, native find-in-page genuinely answers "anything about Kfar Aza" —
crude, but real.

**Recommendation.** Add one client filter component under
`components/archive/` — a single text input over `ArchiveIndexEntry.title`
+ `witness` + `category`, plus a sticky category jump row on
`/documentation` built from the `groups` array already computed at
`documentation/page.tsx:18`. Keep the numbered-file register: filtering
hides rows, the file number stays the record's identity. Type it in
`--face-data` at `--t-data` so it reads as a console field. The rows stay
in the server HTML and remain fully usable with no JavaScript, and this is
not the archive's first client component in spirit —
`components/sections/SectionToc.tsx` and `ReadingProgress.tsx` are already
`'use client'` rails built from rendered content. Prefer a sticky
in-flow category jump row over a rail: `DocPage` deliberately omits
`withRails` (`DocPage.tsx:9-12`), and `docs/archive-integration.md` warns
that adding one must fix `--content-w`, which assumes both rails or
neither. Also ship the cheaper half the filing buried: persist and restore
`.page` `scrollTop` on the index route, which helps every long `DocPage`.

### `archive-brief-record-pages-have-no-route-back-into-the-archive`

**high** · layout · small effort
`components/sections/DocPage.tsx:40-51`,
`components/sections/DocPage.tsx:61-62`,
`components/archive/ArchiveRecord.tsx:103-116`

**Problem.** `DocPage` renders `/october-7` as an inert `<span
className={styles.identityRoute}>`, and the only exits are two links to
`/`. `ArchiveRecord` closes with a provenance footer and nothing else —
`DocPage.tsx:61` says "No closing apparatus… these two pages already link
to each other from their own prose", which is true of `/methodology` and
`/corrections` and false of record pages whose prose is a witness account
and links to nothing. Moving from one testimony to the next costs a full
round trip through the particle scene. The two *index* pages have the same
defect: `testimonies/page.tsx:25` and `documentation/page.tsx:29` also
render through `DocPage`, so they carry no link back to the `/october-7`
hub either.

**Evidence.** `DocPage.tsx:47` is `<span
className={styles.identityRoute}>/{routeId}</span>`; `:40` and `:49` are
the only two `<Link href="/">`. `ArchiveRecord.tsx:103-116` is a provenance
`<footer>` whose only anchor is `version.source_url`. `grep` over
`ArchiveBlocks.tsx` and `app/layout.tsx` returns zero further links, so the
served anchor set on a monolingual record is exactly {`#page-content`, `/`,
`/`, source_url} = 4, and 5 with one language chip. `recordJsonLd`
(`ArchiveRecordPage.tsx:118-138`) emits no `BreadcrumbList`, so the
hierarchy is invisible to machines too. The decision defence is genuinely
inapplicable: `SectionPage.tsx:161-172` states the rationale as "the order
is the orbit's spoke order, geometry rather than reading order, so 'next
file' pointed at nothing in particular" — a premise that is false for a
date-sorted 179-record index with a real parent. Severity is high, not
critical: the reader is not stranded, and `.ai/DECISIONS.md`'s archive entry
says "do not plan on traffic from the record pages", which deflates the
search-landing scenario; downward links exist, only upward and lateral are
missing.

**Recommendation.** Give `DocPage` an optional `breadcrumb?:
{href,label}[]` prop rendered in the identity band beside the route at
`--t-data`, and have `ArchiveRecordPage` pass `[{'/october-7', 'October
7'}, {index path, 'Testimonies'|'Documentation'}]`. Apply it to the two
index pages as well, and add a `BreadcrumbList` to `recordJsonLd`. Prev/
next needs an argument the filing does not make: `.ai/DECISIONS.md:506-511`
records that a prev/next footer was deleted in `4b13229` and the user was
asked and confirmed the deletion stands — that reasoning is scoped to the
eight-file orbit and does not bind an ordered archive, but it is close
enough to put to the user rather than assume. It is also more than "two
lines": documentation needs its own index loader, and the neighbour must
preserve the current locale, or a reader in Español is silently thrown back
to English.

### `archive-lang-declared-english` — 661 non-English pages render inside `lang="en"`

**high** · accessibility · small effort
`app/layout.tsx:67`, `components/archive/ArchiveRecordPage.tsx:55-72`,
`components/archive/ArchiveRecord.tsx:79-98`,
`components/sections/DocPage.tsx:34`, `lib/content/archive.ts:35-40`
*(Filed independently by the archive-brief and cross-cutting agents;
merged here. The cross-cutting half verified CONFIRMED.)*

**Problem.** `<html lang="en">` in the root layout is the only `lang`
attribute on the entire site, and nothing in the archive path overrides or
supplements it — while the locale routes render a complete record in
another language: title, body, captions, credits. WCAG 3.1.1 Language of
Page is Level A. A screen reader announces a Portuguese or Japanese
first-person account of an atrocity with an English voice and English
phoneme rules, which is not merely accented but close to unintelligible.
The language switcher compounds it as a 3.1.2 Language of Parts failure:
the option labels are themselves foreign strings ("Español", "Français",
"日本語", "Português") carrying only `hrefLang`, which describes the
destination, not the text.

**Evidence.** `grep -rn 'lang=' app/ components/ --include=*.tsx` returns
exactly one line, `app/layout.tsx:67` (both filings cited it as 63-65).
`DocPage.tsx:34` is `<main className={pageClass}>`; its props interface has
no `lang`. `ArchiveRecord.tsx:92` sets `hrefLang={locale}` and never
`lang`; `LANGUAGE_NAMES` at `:22-30` supplies the foreign labels.
Recomputed locale census from `content-packages/*/index.json`: october7 179
records, 505 versions, **326** non-default {pt 104, fr 69, ja 60, es 45, de
34, it 14}; hamas-massacre 335 records, **335** non-default {es 335}. Total
**661** — not the filed 998, because every record's `default_language` is
`"en"`, so there are zero non-English default-language versions. The
metadata layer already gets this right — `alternates.languages`,
`openGraph.locale` and JSON-LD `inLanguage` all carry the real locale — so
the data is present and only the render drops it. All 1,175 versions carry
`direction: "ltr"`; no RTL content exists in the repo. Note
`.ai/DECISIONS.md:112` says 338 hamas records; the shipped index carries
335.

**Recommendation.** Target the parts, not the `<main>`. The filed "put
`lang` on the `<main>`" fix would create a new 3.1.2 failure, because
`DocPage`'s `<main>` also contains untranslated English chrome: the skip
link, the "Lions of Zion" wordmark, "← Back to the scan", the tagline
(which by its own doc comment "describes the archive, not the record"), and
inside `ArchiveRecord` the `dt` labels "Witness"/"Published"/"Archive",
"Read in", and the whole provenance footer. Instead: (a) add an optional
`titleLang` to `DocPage` that lands on the `<h1>` only; (b) wrap
`<ArchiveBlocks>` in `<div lang={version.locale} dir={version.direction}>`
— `ArchiveRecord` returns a fragment, so the blocks are already a clean
seam separate from the English metadata and footer, and the `dir` binding
gives the eventual RTL round something already wired; (c) add
`lang={locale}` alongside `hrefLang` on each switcher link and
`lang={version.locale}` on `.languageCurrent`. That satisfies 3.1.2 fully.
Strict 3.1.1 conformance needs `lang` on `<html>`, which a nested layout
cannot set in the App Router without a root `[locale]` segment — name that
as the residual gap rather than pretending the parts fix closes it. Treat
the logical-property CSS conversion (`archive.module.css:36-37, 155, 259,
321`) as a separate, lower-priority item: with zero RTL versions it changes
nothing a reader sees today, and `.recordArrow`'s `translateX` needs a
`dir`-scoped rule rather than a logical property.

### `archive-brief-provenance-renders-at-body-size-not-at-the-data-floor`

**high** · typography · trivial effort
`components/archive/archive.module.css:338-355`,
`components/sections/sections.module.css:376-388`,
`components/archive/ArchiveRecord.tsx:103-116`

**Problem.** `.provenance` declares `font-size: var(--t-data)` and `color:
var(--ink-lo)` on the `<footer>`, but its `<p>` children sit inside
`DocPage`'s `.body`, where `:where(.body) p { font-size: var(--t-body);
color: var(--ink) }` is a real declaration *on the p* and therefore beats
inheritance. `.provenance p` exists (`:349`) but only sets `margin`. The
result is two full sentences in Geist Mono at 17px with 0.92px tracking at
full body ink — the loudest mono on the page and visually equal to the
testimony itself. That reverses the documented decision
(`.ai/DECISIONS.md`, 2026-08-26): "Credits sit at `--t-data`, the smallest
step in the type system: present, recessive." It also breaks the DESIGN-V2
rule that mono is never for sentences, and it is why a long source URL
renders as a 173px multi-line block of raw slug as the last thing on the
page.

**Evidence.** Footer computes `{font-size: 11.52px, color:
rgb(132,148,168)}`; its `<p>` children compute `{font-size: 17px,
font-family: Geist Mono, color: rgb(185,197,212), letter-spacing:
0.9216px, line-height: 28.9px}` — same size and colour as the adjacent
`.paragraph`. The 173px "Source record:" paragraph is ~6 lines at 28.9px,
not the filed nine. One filed extension is refuted: `.externalMedia` does
**not** share the defect — its class sits on the `<p>` itself
(`ArchiveBlocks.tsx:160`), specificity (0,1,0), so it already computes at
11.52px/`--ink-lo`.

**Recommendation.** One edit: `archive.module.css:349` → `.provenance p {
margin: 0 0 0.35rem; font-size: var(--t-data); line-height:
var(--t-data-lh); color: var(--ink-lo); }`, plus `overflow-wrap: anywhere`
on `.provenance a` so a long slug breaks rather than laddering. Dropping
`letter-spacing` from `.provenance` (`:345`) is consistent with "never for
sentences", but `.credit` (`:111-117`) uses the identical mono+tracking
treatment for the same kind of prose, so either both change or neither, to
avoid two credit styles. Do not touch `.externalMedia`.

### `archive-brief-mobile-index-rail-pins-351px-of-metadata-over-the-brief`

**high** · responsive · small effort
`components/briefs/geopolitical-brief.module.css:798-806`,
`components/briefs/geopolitical-brief.module.css:712-714`,
`components/briefs/geopolitical-brief.module.css:755-758`,
`components/briefs/GeopoliticalBrief.tsx:101-117`

**Problem.** At ≤719px `.indexRail` becomes `position: sticky; top:
calc(3.5rem + env(safe-area-inset-top,0px)); z-index: 20` with an opaque
`background: var(--ground)`. The 900px rule hides `.railIdentity` and
`.railTrust` but leaves `.contents` **and** the whole `.evidenceContract`
block (Status / Primary records / Corrections) inside that sticky box. The
result is a 351px opaque slab pinned from y=56 to y=407 for the entire
read, over a viewport already shortened to 760px by the chat dock. The
reading window is 353px — about twelve lines — and the slab visibly
guillotines content: scrolled to 1600, the FigureRow's values emerge in
fragments from under an opaque edge. The evidence contract is document
metadata a reader consults once; it has no business being sticky.

**Evidence.** Measured at 390×844: rail `{pos: "sticky", top: "56px", h:
351, z: "20"}`, unchanged after `scrollTop = 1600`. Recomputed from tokens
independently: 7.2 padding + ~46.6 TOC row + ~281 evidence contract + 1px
border ≈ 336px statically, within ~4% of the measured 351px once
`VerificationBadge`'s pill height is counted. 844 − 5.25rem dock = 760px
scrollport; 760 − 407 = 353px = **46.2%**. Full brief `scrollHeight` at 390
is 5,504px, so the slab is present for 100% of the read. `--ground
#070b14` is opaque. Nothing mitigates: no `max-height` or `overflow` on
`.indexRail`, no JS in `components/briefs/*.tsx`, and the ≤359px block only
changes padding. The "~320px of ceremony" quote is accurate to
`.ai/DECISIONS.md:572` / `.ai/DESIGN-V2.md:91` but describes the dossier
shell's scroll-away opening ceremony, so it is a comparator rather than a
like-for-like precedent.

**Recommendation.** Scope the fix to ≤719px, **not** the 900px block:
between 720 and 900px `.indexRailInner` is `position: static` and
`.indexRail` is not sticky, so the evidence contract there is ordinary flow
content doing no harm, and adding `.evidenceContract { display: none }` at
`:712` would delete content at widths that have no defect. Prefer the
structural fix: in `GeopoliticalBrief.tsx` make the sticky element wrap
only `<nav className={styles.contents}>`, leaving `.evidenceContract` in
normal flow at every width. The sticky bar should be the TOC scroller alone
— roughly 90px — which is the affordance a reader needs continuously.

### `archive-brief-testimony-opens-with-the-source-sites-breadcrumb`

**high** · content-design · small effort
`components/archive/ArchiveBlocks.tsx:58-59`,
`components/archive/archive.module.css:27-32`,
`lib/content/archive.ts:214-227`

**Problem.** The crawler captured october7.org's breadcrumb as the first
`paragraph` block, and `ArchiveBlocks` renders it with `.paragraph` at
`--t-body` in `--ink` — identical to the witness's own words. So the first
sentence a reader meets on 367 testimonies is "October 7 > Gaza Border
Communities > Testimony of Gili Y" — another site's chrome wearing this
site's body voice, immediately below an `h1` that is
`displayTitle(version.title)`, so the breadcrumb's last segment restates
the heading two lines above it, and directly above
`ArchiveRecord.tsx:105`'s "reproduced as published" note. It also sits
under the identity band, so a reader arriving from search sees breadcrumbs
above breadcrumbs. `displayTitle` (`archive.ts:223`) already establishes
the precedent that source-site furniture is stripped at render time rather
than mutated in storage; this is the same class of furniture and is not
stripped.

**Evidence.** Recomputed over `content-packages/october7/records`: 179
files, 505 versions, **367** whose first block is breadcrumb-shaped
(72.7%). `records/looking-death-in-the-eye.json` is verbatim `{"type":
"paragraph", "text": "October 7\n>\nNova Festival\n> Testimony of Almog
S"}`. 504 of 505 versions open with a `paragraph` block at position 0, and
the breadcrumb shape appears at index 0 **only** — zero blocks at any later
position match `\n>` with length < 200, so the guard carries no
mid-record false-positive risk. Separately, 858 october7 paragraphs contain
hard newlines (up to 16 in one block) that HTML collapses. The
hamas-massacre package has 0 breadcrumb-first blocks and 0 newline
paragraphs, so both changes are no-ops there. Nothing in the repo strips
it; `tests/archive-content.test.ts` guards title chrome only — the very
precedent this cites.

**Recommendation.** In `ArchiveBlocks`' `paragraph` case, skip the block at
index 0 when it is breadcrumb-shaped, render-time only, stored record
unchanged. Both filed thresholds are wrong and must not be used as
written: `/^October 7\s*\n?>/` catches only 330 of the 367 — 37 open with a
localised root ("7 de outubro\n>\nComunidades da fronteira com gaza\n> …")
— and "under ~120 characters" misses 71 of 367 (19%; the longest real
breadcrumb is 163 chars, median 76). Use the shape rule alone at index 0:
text contains `\n>` and is under 200 characters, which matches all 367 and
nothing else in either package. File the bundled `white-space: pre-line`
change on `.paragraph` separately — it is also real (858 paragraphs) but is
a different fix.

### `archive-brief-record-title-set-as-display-headline-regardless-of-length`

**medium** · typography · small effort
`components/archive/ArchiveRecordPage.tsx:56`,
`components/sections/sections.module.css:333-341`,
`components/archive/archive.module.css:290-296`

**Problem.** `DocPage`'s `.title` is `--t-display` (44px at 1440) with
`text-wrap: balance` and no length branch. That is correct for
"Testimonies"; it is wrong for hamas-massacre titles, which are captions
the source wrote as whole paragraphs. The longest — a 296-character
sentence naming three hostages and describing a severed hand — becomes a
455px block of 44px display serif occupying half the viewport before a
single piece of metadata appears. Display type is a signal about importance
and scale; applying it to a paragraph destroys that signal and reads as a
layout error rather than as gravity.

**Evidence.** Title-length census recomputed over 335 documentation
records: min 9 / median 54 / p90 87 / max 296; **>120 chars = 6, >90 chars
= 25** (the filed surface line said 31 and contradicted its own evidence
block). october7: 179 records, max 100, >90 = 30. `--t-display:
clamp(2.1rem, 4vw, 2.75rem)` → 44px at 1440, line-height 1.15, in a
`min(68ch, 100%)` column. `displayTitle` only strips an "| October7 Blog"
suffix; there is no length branch, clamp or truncation anywhere, and at
≤525px the clamp drops to 33.6px in a narrower column, which is if anything
worse. The 455/112/116px block heights were measured in real Chrome and
could not be re-measured here, but are consistent with the token maths.

**Recommendation.** Add a length-responsive title step: have
`ArchiveRecordPage` pass a `titleScale` hint
(`displayTitle(version.title).length > 90 ? 'long' : 'default'`) that
`DocPage` turns into a class setting `--t-h2` (1.55rem) outright — the
token clamp floors at 2.1rem, so the class must set `font-size` rather than
adjust the clamp — with `max-width: 34ch` and `text-wrap: pretty`. Still
the largest type on the page, still in the display face, but it treats a
caption as a caption and stays inside the seven-step scale. Fix the cause
alongside it: since 335/335 documentation records duplicate the title as
their first heading block, the leading-heading skip from
`archive-brief-documentation-record-says-one-sentence-three-times` removes
the second copy on every record, not just the long ones.

### `archive-brief-index-meta-line-is-identical-on-314-of-335-rows`

**medium** · content-design · trivial effort
`components/archive/ArchiveRecordList.tsx:51-60`,
`components/archive/archive.module.css:283-309`

**Problem.** `meta()` composes witness + year + language count. For the
hamas archive `witness` is null on all 335 records, the year is the
crawl-era publication date rather than the event date, and every record has
exactly two languages — so the per-row meta line resolves to just two
strings. It adds ~20px per row of text that cannot distinguish two rows,
cannot be sorted by, and is not true of the event it describes; and the 21
rows reading "2024" attach a wrong year to a 2023 event.

**Evidence.** Recomputed over `content-packages/hamas-massacre/index.json`:
335 rows, `witness` null 335/335, `languages.length > 1` 335/335, **2
distinct meta strings** — ("2023 · 2 languages", 314), ("2024 · 2
languages", 21). october7 `index.json`: 179 rows, 177 distinct — the
component is genuinely right for one archive and dead weight for the other.
Per-row cost is `--t-data` × `--t-data-lh` (16.7px) + 0.2rem gap ≈
**19.9px**, i.e. ~6,700px total, not the filed ~8,700px; rows measure ~77px
as filed. Record dates are source-CMS timestamps
(`2023-11-01T14:18:23Z`, `2023-12-06T14:52:43Z`), confirming the year is
publication, not event. Nothing overrides it; the "no branching" invariant
in `docs/archive-integration.md:44` is about the record *body* renderer, so
a list-level prop is admissible.

**Recommendation.** Accept `showMeta?: boolean` on `ArchiveRecordList` and
pass `showMeta={false}` from
`app/october-7/documentation/page.tsx:47-51`, keeping it on for
testimonies where witness names carry real signal. Collapsing the rows to a
single title line makes the file number, the title and the arrow the whole
row — which is what `ArchiveRecordList.tsx:18-24` says the register is. Do
**not** take the filed fallback of using `category` instead: documentation
rows are already grouped into six `<section>`s each headed by its category,
so a per-row category would be constant within every group and reproduce
the identical defect. The only field that varies within a group is the
misleading crawl timestamp, so the right answer is no second line at all.

### `archive-brief-long-testimony-has-no-navigation-through-its-own-structure`

**medium** · layout · medium effort
`components/sections/DocPage.tsx:29-31`,
`components/sections/DocPage.tsx:54-63`,
`components/archive/archive.module.css:13-21`,
`components/sections/SectionToc.tsx:44`

**Problem.** `DocPage` was written for `/methodology` and `/corrections` —
"short policy pages, not documents with sections to navigate"
(`DocPage.tsx:9-13`). It now also serves 505 testimony versions, 160 of
them with 3+ headings, the longest running 15 sections and 91 paragraphs
with exactly four links on the page. There is no reading-progress line, no
contents rail, and no heading anchors. On a first-person account of a
family's murder, giving the reader no sense of the document's shape is the
difference between committing to a read and abandoning one.

**Evidence.** Recomputed from `content-packages/october7/records`: heading
census {0: 179, '1-2': 166, '3-9': 155, '10+': 5}; **160** versions have
≥3 headings — exact as filed. hamas-massacre: 0 versions with ≥3 headings,
so the proposed gate never touches a documentation record and
`.ai/DECISIONS.md:92-99` ("Documentation records take no rails") stays
intact — that entry explicitly invites this revisit "as a prop on the
existing shell, never a fork". The longest record
(`i-saw-my-father-propel-…:en`) is 15 headings and 91 paragraphs across 108
blocks (the filed 95 paragraphs counted the shell's lede/caption/credits).
Text census: median 5,286 / p90 12,115 / max 39,811 characters (filed
figures were under 1% off). Four links on the page confirmed. Two filed
claims are overstated: `.heading` is differentiated by `--face-display`
against Plex Sans body, `--ink-hi` against `--ink`, and a 2.25rem top
margin, so the 1.176× size step is the weakest of four cues rather than the
only one; and the native scrollbar already gives coarse position, so what
is missing is section structure, not "how far in you are".

**Recommendation.** As filed the change is a silent no-op.
`ArchiveBlocks.tsx:56` renders `<h2 className={styles.heading}>` with no
`id`, and `DocPage` sets neither `data-reading-scroll` (on `<main>`) nor
`data-toc-source` (on the body div) — `SectionToc` early-returns when
either selector misses, then drops every heading via its `h.id.length > 0`
filter. Three prerequisites, not details: slugify an id onto each archive
heading, add `data-reading-scroll`, add `data-toc-source`. Then sequence by
payoff: `.tocRail` is `display: block` only at ≥1220px, so the rail helps
nobody on a laptop or narrower, while `ReadingProgress` through
`topProgressTrack` is width-independent and covers all 505 testimonies —
ship the progress line first, the rail second. Add `rails?: 'none' | 'toc'`
to `DocPage`, opted into when the version has ≥3 heading blocks; a toc-only
variant needs `--content-w: calc(var(--reading-w) + var(--rail-w) +
var(--rail-gap))`, which is the `--content-w` fix the decision entry asked
for. The `--t-h3` → `--t-h2` bump on `.heading` is a nicety, not the
defect.

### `archive-brief-generic-tagline-splits-the-title-from-the-dateline`

**medium** · hierarchy · small effort
`app/october-7/testimonies/[slug]/page.tsx:5`,
`app/october-7/documentation/[category]/[slug]/page.tsx:5`,
`components/sections/DocPage.tsx:55-60`,
`components/sections/sections.module.css:342-355`,
`components/archive/ArchiveRecord.tsx:57-99`

**Problem.** `DocPage`'s header is title → lede → gold `ledeRule`, and the
archive supplies a constant per-package lede on every page. The rule that
is supposed to close a headline block therefore closes a piece of
boilerplate, and the record's actual dateline — witness, publication date,
archive — renders below it as the first item of `.body`, fenced by a second
hairline. A reader gets two horizontal rules ~87px apart, both claiming to
end the header, with generic text above the first and the record's identity
between them. The masthead anatomy DESIGN-V2 designed — identity band, one
gold hairline, then the first piece of actual content — is inverted here:
the hairline separates the page from its own metadata.

**Evidence.** Two taglines, not one: `'Archived testimony from October 7.'`
(34 chars, 505 pages) and `'An archived record of October 7.'` (670
pages), so the filed "same 34-character tagline on all 1,177 records" is
wrong on both counts. `DocPage.tsx:55-60` is `<h1 .title>` → `<p
.lede>{tagline}</p>` → `<div .ledeRule>`; `sections.module.css:342-355`
gives `.lede` `--t-body` with margin-top 0.85rem and `.ledeRule` a 56px,
1px, `--gold` stub at margin-top 1.5rem. `.body` has no top-margin rule, so
`ArchiveRecord`'s `.recordHeader` begins ~24px under the gold rule, and
with `padding-bottom: 1.25rem; border-bottom: 1px solid var(--line)`
(`archive.module.css:121-125`) plus the meta `dl` and the `.languages` nav
the second rule lands ~87px below the first — matching the measurement. The
two rules are not identical devices: one is a gold stub, the other a
full-width `--line` hairline. The Brief precedent is accurate —
`GeopoliticalBrief.tsx:122-144` puts eyebrow/topic/h1/dek/`PublicationMeta`
inside one `<header>` whose `border-bottom` closes the block after the
dateline.

**Recommendation.** Give `DocPage` an optional `dateline?: React.ReactNode`
slot rendered inside `<header>` between `.lede` and `.ledeRule`, render
`.lede` only when a tagline exists, and drop the archive taglines to
`undefined` — so the header becomes title → dateline → one rule → the
record. One implementation correction: `.recordMeta`/`.languages` render
inside `ArchiveRecord`, which is `DocPage`'s `children`, so the dateline
node must be built in `ArchiveRecordPage` (which already holds `record`,
`version`, `sourceLabel`) and passed as the prop; `ArchiveRecord` then
drops `.recordHeader` and its border. Making `tagline` optional must not
disturb `/methodology` and `/corrections`, which pass real page-specific
taglines and keep them.

### `archive-brief-disinformation-scan-corpus-animates-behind-testimony`

**medium** · composition · small effort
`components/sections/DocPage.tsx:30`,
`components/sections/DocPage.tsx:37`,
`components/sections/ScanBackdrop.tsx:107-117`,
`components/sections/sections.module.css:157-172`

**Problem.** `DocPage` seeds `ScanBackdrop` from `routeId`, and all ~1,177
archive routes pass `routeId="october-7"` — so the deterministic PRNG
produces the identical nine fragments in identical positions on every
record and both indexes. The corpus is the disinformation monitor's:
beside a first-person account of a father dying, the page runs "CLAIM
DEBUNKED: the footage was published in 2019 and was unrelated to the
current war" and "VIRAL CLAIM: Israel deliberately engineers famine as its
only war objective". The identical repetition also removes the one thing
the seeding was for — each page showing its own slice. Underneath it is a
sharper defect the filing did not name: `DocPage` builds `pageClass` from
`styles.page` + `styles.surfaceQuiet` only and never applies
`styles.registerMuted`, so its `register="muted"` prop cuts row count but
not opacity — every archive record runs at `--register` 0.7 while the
`/october-7` hub that owns them runs at 0.45.

**Evidence.** Re-running `mulberry32(hashSeed("october-7"))` against
`public/matrix/matrix-fragments.en.json` reproduces the quoted fragments in
order, and both index routes pass the same `routeId`. Two numbers are
corrected: it is **nine** rows, not eight (`rowCount = register ===
'muted' ? 9 : 16`, `ScanBackdrop.tsx:117`), and
"plainly readable at 1440" is overstated — outside the mask the composite
over `--ground` is 0.34 × 0.7 = 0.238 of `--data-ember-dim` `#7a4048` =
rgb(34,24,32) at **1.14:1**, or 1.24:1 for the four `rowLoud` rows, well
under the 3:1 non-text floor; inside the reading column the mask's 0.25
puts it at 0.0595, a delta of roughly (7,3,3). The 81–162s loop is right
(45–90s base × the `surfaceQuiet` 1.8 multiplier). The rows are
`aria-hidden="true"`, so screen readers are exempt — but under
`prefers-reduced-motion: reduce` (`sections.module.css:696-704`) the
animation is dropped and all nine fragments park at fixed positions
permanently, i.e. become static text rather than passing traffic.

**Recommendation.** Two cheap, in-policy fixes. **(1)** Add `seed?: string`
to `ScanBackdropProps`, default it to `routeId`, and have
`ArchiveRecordPage` pass the record slug. **(2)** Fix the register wiring
rather than inventing a new level: `DocPage` already declares
`register="muted"` but never applies `styles.registerMuted`, so adding that
class to `pageClass` drops archive records to the 0.45 already sanctioned
for October 7 in `CLAUDE.md`, cutting the composite to about 1.09:1 with no
new deviation. Do **not** filter the corpus to `tone: 'neutral' | 'blue'`
— that reverses `ScanBackdrop`'s documented ember-left/blue-right monitor
semantics and shrinks the pool from 521 fragments to 79. If the topical
mismatch still reads wrong after (2), that is a separate editorial argument
for an archive-specific corpus slice and belongs in `.ai/DECISIONS.md`
before any code moves.

### `archive-brief-broken-media-renders-as-an-unlabelled-empty-box`

**medium** · empty-state · small effort
`components/archive/ArchiveBlocks.tsx:113`,
`components/archive/ArchiveBlocks.tsx:115-134`,
`components/archive/archive.module.css:63-71`,
`lib/content/archive.ts:195-198`

**Problem.** `const alt = item.alt_text ?? caption ?? ''` marks an image
decorative when the source published neither, which is 185 of 468 images —
so those are unlabelled to a screen reader even when they load. And there
is no unavailable state at all: a failed or not-yet-uploaded asset renders
as a bordered translucent rectangle with no filename, no message, no
indication whether the archive holds it. On an evidentiary surface an
unexplained blank frame is worse than a stated gap, because the reader
cannot tell whether the record is incomplete, the site is broken, or
something was removed. The component already gets this right for the two
YouTube videos (`ArchiveBlocks.tsx:157-167` renders an honest note framed
"as a gap in the holding, not an error").

**Evidence.** Census recomputed including block-level captions from every
`records/*.json`: october7 349 images, 76 with neither `alt_text` nor any
caption; hamas-massacre 119 images, 109 — **185 of 468**, exactly as filed.
`archive.ts:196` is `const base = (process.env.NEXT_PUBLIC_ARCHIVE_CDN ??
'/archive')`, and `public/archive` does not exist in this tree. Three
corrections pull the severity down from high. The "live" driver is a
documented, tracked pre-launch provisioning gap, not an unknown defect:
`.ai/STATE.md:34` says "The CDN is not yet provisioned — that is the one
step left", `docs/environment.md:55` repeats it, and
`scripts/verify-archive-assets.mjs` exists precisely because "a wrong value
fails quietly… only the media 404s". The cited console/screenshot evidence
is a *video* block (poster + source 404, 694×630 pure black), whose black
comes from `.video { background: #000 }` (`:74-79`), not the `.image`
background quoted — no failing image block was actually observed. And the
`alt=""` choice is reasoned in-code at 109-112 against package rule 4,
`docs/archive-integration.md:81` ("Null means null… do not invent values").

**Recommendation.** Both halves of the filed fix are wrong as written.
"onError-free CSS-only fallback" is not possible — CSS cannot detect a 404;
that needs `onError` (or a build-time manifest check), i.e. a client
component the archive renderer currently is not. And gating on "no
configured CDN base at build time" would fire in development too, since the
documented dev path is exactly the `/archive` default with a gitignored
symlink (`archive.ts:184-188`, `.vercelignore:1-6`) — it would replace
every image with a "not available" note on the machine where the assets do
resolve. Instead: (a) synthesize an alt only where the record itself
supplies the words (title, source label), noting this reads against package
rule 4, so argue it or route it through the package rather than the
renderer; (b) style a real unavailable state via a small client wrapper's
`onError`, reusing `.externalMedia`'s dashed treatment; (c) leave CDN
provisioning to the existing `verify-archive-assets.mjs` gate.

### `archive-brief-october7-videos-reserve-no-layout-height`

**medium** · performance-perceived · trivial effort
`components/archive/ArchiveBlocks.tsx:179-189`,
`components/archive/archive.module.css:63-79`
*(Filed by the archive-brief agent and, from the CLS angle, by
cross-cutting as `archive-image-cls`; merged here. The archive half
verified CONFIRMED, and the cross-cutting half's image census corrects the
scope.)*

**Problem.** `<video width={item.width ?? undefined} height={item.height ??
undefined}>` reserves an aspect ratio only when the package carries
dimensions. Every october7 video item has `width: null, height: null`, so
no `aspect-ratio` is derived, the element lays out at the 300×150 intrinsic
default, and it jumps to its real portrait box when the poster and then the
metadata arrive. On a 17,000px testimony with several videos this is a
series of mid-read jumps that push the paragraph a reader is on off screen.

**Evidence.** `content-packages/october7/media.json`: 499 items — 349
image, 74 thumbnail, 76 video — and the 76 with null width/height are
**exactly the videos**; 2 of them are external/YouTube with no
`package_path`, so **74** render a real `<video>`.
`content-packages/hamas-massacre/media.json`: 528 items (119 image, 200
thumbnail, 209 video), 0 missing dimensions. All 423 october7 images and
thumbnails carry both dimensions, so **no archive image is affected** —
which refutes the cross-cutting half's proposed `.image:not([width])
{ aspect-ratio: 3 / 2 }` rule twice over: it would match nothing, and 3:2
is inverted for this corpus (286 of 394 measured images are portrait,
clustering at 0.8 and 0.75). 205 video blocks across 47 of 179 records, up
to 25 in a single record. `tests/archive-content.test.ts:107` asserts every
locally held video *has* a poster, and 74 of 74 posters carry width and
height. `max-height: 70vh` is not a CLS source: it resolves against the
attribute-derived aspect ratio at initial layout without waiting for bytes,
so the 209 hamas-massacre videos are reserved and clamped deterministically
— letterboxing is a look issue, not a shift.

**Recommendation.** Fall back to the poster's dimensions, which the package
already holds and a test already guarantees: `width={item.width ??
poster?.width ?? undefined}` and the same for height. That reserves the
correct box at first layout for all 74 clips. Skip the `aspect-ratio: 16 /
9` CSS floor — these are overwhelmingly portrait phone clips (the `.video`
comment says so), so a landscape floor would reserve a wrong-shaped box and
produce its own jump. Drop the `.image:not([width])` rule entirely. Moving
the `max-height` ceiling to `.figure` and switching `70vh` to `70dvh` are
reasonable but cosmetic and separate.

### `archive-brief-witness-label-duplicates-the-value-it-labels`

**low** · content-design · trivial effort
`components/archive/ArchiveRecord.tsx:59-64`,
`components/archive/ArchiveRecordList.tsx:52-53`,
`components/archive/archive.module.css:137-162`

**Problem.** `witness_name` is not a name — it is the source site's byline
phrase — so the dateline renders "WITNESS Gili Y.'s story" on all 505
testimony version pages and in all 179 index meta lines. A label/value
category mismatch on the pages that most need to look edited.

**Evidence.** 179 october7 records, all carrying `witness_name`; **173**
distinct values (not the filed 174); 505 version pages render it. **177 of
179** end in the possessive suffix; the two exceptions are malformed in the
source data: `"Avram R'.s story"` and `"Yuval H.s story"`. hamas-massacre
has no `witness_name`, so documentation pages are unaffected. Rendered as
uppercase "WITNESS" + 0.4rem gap + value (`archive.module.css:148-157`),
not the "Witness — value" the title implies. `displayTitle`
(`archive.ts:223`) is direct precedent for render-time removal of
source-site furniture with stored data untouched, and the 2026-08-26
provenance decision forbids rewording record *bodies*, which this does not
touch.

**Recommendation.** Add `displayWitness()` beside `displayTitle()` in
`lib/content/archive.ts` and call it from `ArchiveRecord.tsx:62` and
`ArchiveRecordList.tsx:53`. The filed regex `/['’]s\s+story$/i` misses both
malformed values; use `/\s*['’.]?s['’]?\s+story$/i` (or strip a trailing
" story" after a normalised possessive) so "Avram R'.s story" and "Yuval
H.s story" also resolve. Fall back to the raw string when the result is
empty, same shape as `displayTitle`'s `|| title.trim()` guard.

### `archive-brief-category-group-boundaries-are-24px`

**low** · layout · trivial effort
`components/archive/archive.module.css:212-232`,
`app/october-7/documentation/page.tsx:41-53`

**Problem.** `.groupHeading:first-of-type { margin-top: 0 }` was written to
suppress the top margin on the first heading only, but each group sits in
its own `<section>` and `:first-of-type` is scoped to the parent — so every
one of the seven headings is the first `h2` of its own section and every
one loses its 2.5rem top margin. The intended break never renders; the only
gap between the end of a 99-row list and the next category's title is
`.recordList`'s 1.5rem bottom margin.

**Evidence.** All seven headings compute `margin-top: 0px`; the six
inter-group gaps are 24px. The 2.5rem rule is dead code on the only page
that uses `.groupHeading` (grep: those two files only, no override
anywhere). Two filed figures are wrong: it is 335 records in 7 groups
(99/81/68/60/15/11/1), not "514 rows"; and internal row rhythm is a 1px
border between ~75px rows, not 24px — so a heading in Newsreader at
`--t-h2` in `--ink-hi` above a count line is still a visible boundary, just
an under-separated one. `.recordItemTitle` at `font-size: 1.125rem`
(`:292`) is separately an eighth step off the scale `globals.css` declares
with "no exceptions".

**Recommendation.** Scope the suppression correctly —
`section:first-of-type .groupHeading { margin-top: 0 }`, or a modifier
class on the first section — which alone restores the intended 2.5rem
break. Treat the proposed 4.5rem plus `border-top: 1px solid
var(--gold-line)` as a separate design change, not part of the fix: a gold
rule above every category heading competes with the identity band's own
rule. The `.recordItemTitle` size is independently worth fixing;
`--t-body` (1.0625rem) is the conservative substitution, while moving 335
row titles up to `--t-h3` is a taste call.

### `archive-brief-block-order-contract-rests-on-a-nan-comparator`

**low** · correctness · trivial effort
`components/archive/ArchiveBlocks.tsx:33-43`, `lib/content/archive.ts:24-33`

**Problem.** `ArchiveBlock.position` is typed as a required `number` and
`ArchiveBlocks` sorts on `a.position - b.position`. Not one october7 block
carries the field, so every comparison returns `NaN`. `content_blocks`
order is the order in which a witness said things, package rule 3 makes
preserving it a contract, and that contract is currently enforced by a
comparator that cannot fire.

**Evidence.** Census reproduced: october7 = 179 files / 505 versions /
16,265 blocks, **16,265 missing `position`**, 504 versions affected;
hamas-massacre = 335 files / 670 versions / 2,010 blocks, 0 missing.
Additionally, in all 670 hamas versions `position === array index`, so the
sort reorders nothing in either package — it is a no-op today, not a live
mis-ordering. No normalization exists in `lib/content/` or
`scripts/import-archive-package.mjs`; `tests/archive-content.test.ts` walks
`content_blocks` three times and asserts nothing about order. The
consequence is nil in practice: these pages are prerendered at build on
Node/V8 only, where a `NaN` comparator result is treated as not-less and
TimSort's stability preserves JSON order. The React-key half is not a
defect either — the key at `:39` already ends in `-${i}`, so
`paragraph-undefined-7` is ugly, not broken.

**Recommendation.** Prefer honouring rule 3 directly over the filed
mixed-key sort: make it `position?: number` and either drop the sort (array
order *is* the package's display order) or sort only when every block
carries a position — `const ordered = blocks.every(b => typeof b.position
=== 'number') ? [...blocks].sort((a,b) => a.position! - b.position!) :
blocks;`. The filed `(b.position ?? i)` form silently interleaves two
numbering spaces if a package is ever partially annotated. Key on
`${block.type}-${i}` and drop `position` from the key.

### `archive-brief-two-shells-now-disagree-about-the-card-and-the-closing-apparatus`

**low** · consistency · medium effort
`components/briefs/geopolitical-brief.module.css:316-323`,
`components/sections/sections.module.css:307-316`,
`components/briefs/GeopoliticalBrief.tsx:217-235`,
`components/sections/DocPage.tsx:61-62`

**Problem.** `sections.module.css:307-311` records the deliberate removal
of the card — "no border, no translucent panel, no blur… the card chrome
was reading as a floating box rather than a page" — while the Brief's
`.article` still carries a near-opaque ground, two gold-tinted borders and
a `0 2rem 7rem` shadow, and still ends with a three-part closing stack. A
reader comparing `/geopolitical-brief` to an archive record sees a bordered
column with a foot versus an unbordered one with none.

**Evidence.** Anchors and measurements verified; the Brief's body measure
is 630px / ~62ch (768px column − 2×68.8px `.section` padding) against the
dossier's ~694px, so the Brief is the *narrower* of the two. But the
"neither answer is wrong, holding both is indefensible" framing does not
survive the code: the Brief mounts `.quietBackdrop` (`position: fixed;
inset: 0`) with no carve-out for the article, so its near-opaque ground is
functionally required, whereas `SectionPage`/`DocPage`'s `ScanBackdrop` is
masked out of the reading band by `--content-w`
(`sections.module.css:35, 142-154`). The difference is mechanically
explained. Two decisions also blunt it: `CLAUDE.md` names
`components/briefs/` as "the one page with its own layout", and
`.ai/DECISIONS.md` 2026-08-25 ("No global footer") deliberately sited the
Methodology/Corrections row in the Brief's closing nav. The filed
recommendation is worse than inadmissible: a `surface="panel"` card variant
for archive records rests on a false premise, since the scan is already
masked out of a `DocPage` record's reading band.

**Recommendation.** Reverse the direction and shrink it: drop `.article`'s
two gold-tinted borders and the `0 2rem 7rem` shadow, keep its
`rgba(8,14,24,0.965)` ground (load-bearing behind the unmasked
`.quietBackdrop`), and record that as the reconciliation. Reconciling the
measure at 68ch is cheap (48rem → the shared `--reading-w` plus padding).
Leave the Brief's closing nav alone or re-argue it against the 2026-08-25
footer decision explicitly. `BriefError.tsx` is separately unreachable —
imported only by `.design-sync/previews` and `ds-entry`, so no route or
error boundary reaches it, which means "what does a reader see when the
brief fails" currently has no answer; file that on its own.

---

## Cross-cutting: accessibility, responsive, motion, interaction

Measured across 360/390/600/719/768/1024/1440 on eight routes in bundled
Chromium, plus five routes rendered with JavaScript disabled. Every ratio
is a real relative-luminance computation against the composited background
the element sits on. The reduced-motion sweep found 18 of 20 CSS files
carrying a `prefers-reduced-motion` block covering their own animations,
which is unusually complete and is deliberately not reported as a defect.

### `cross-cutting-three-webgpu-on-every-route` — the WebGPU renderer ships to all ~1,190 routes

**high** · performance-perceived · trivial effort
`app/layout.tsx:3`, `app/layout.tsx:70-78`,
`components/chat/ParticleChatLauncher.tsx:6`,
`components/chat/ChatParticleCanvas.tsx:2-28`,
`components/particle-nav/CanvasMount.tsx:30`

**Problem.** `ParticleChatLauncher` is mounted unconditionally in the root
layout and statically imports `ChatParticleCanvas`, which statically
imports `@react-three/fiber`, `three/webgpu` and `three/tsl`. Because the
import is static and the launcher is a client component in the *root*
layout, those bytes land in the client reference manifest of every route —
a reader opening a testimony downloads a WebGPU renderer to decorate a
button in the corner. It also makes a claim in the code false:
`ParticleChatLauncher.tsx:30-32` says "mobile never pays for a second GPU
renderer" and `:184` genuinely never mounts it on mobile, but the module
graph already pulled it down, so a phone pays the download and gets
nothing. The home scene shows this was understood: `CanvasMount.tsx:30`
uses `dynamic(() => import('./Scene'), { ssr: false })` with the comment
"three.js bytes only download after the DOM nav is interactive."

**Evidence.** `ParticleChatLauncher.tsx:6` is a plain static `import {
ChatParticleCanvas } from './ChatParticleCanvas'`. `ChatParticleCanvas.tsx
:2-28` imports `Canvas`/`useFrame`/`useThree` plus **7** symbols from
`three/webgpu` and **13** from `three/tsl` (the filing said 11 and 14).
`node_modules/three/build/three.webgpu.min.js` is 667,861 bytes minified
(~180–200 KB gzipped) before R3F. `useMobileChatSculpture`'s server
snapshot is `true`, so mobile mounts nothing yet still downloads and
evaluates the module. Nothing in `CLAUDE.md`, `.ai/DECISIONS.md` (including
the 2026-08-25 "launcher is absent during the intro" entry, which reasons
the same way about the second renderer's cost) or `next.config.ts` makes
the static import deliberate. `ChatParticleCanvas` is imported nowhere else
(`ParticleChatLauncher.tsx:6` and `:185` only), so the change is fully
local.

**Recommendation.** Change `ParticleChatLauncher.tsx:6` to `const
ChatParticleCanvas = dynamic(() => import('./ChatParticleCanvas'), { ssr:
false });`. Because the canvas is never server-rendered anyway
(`getServerSnapshot` returns `true`), this changes no rendered output, and
the server-rendered `<img>` fallback at `:177` already covers the resolve
window. Consider also gating the import on first hover or focus rather than
mount, so desktop readers who never touch the launcher never fetch it. One
framing correction: archive record pages are prerendered, so text paints
from HTML regardless — the cost is transfer bytes, parse/evaluate time and
hydration TBT on a phone, not delayed first paint.

### `cross-cutting-identity-band-17px-exit` — the sole exit is a 17px-tall target

**medium** · accessibility · trivial effort
`components/sections/sections.module.css:270-309`,
`components/sections/sections.module.css:684-690`,
`components/sections/SectionPage.tsx:130-145`,
`components/sections/DocPage.tsx:40-51`

**Problem.** `.wordmark` and `.identityExit` are bare inline anchors at
`--t-data` with no padding and no minimum box, so they inherit a 17px line
box on every reading route including all ~1,177 archive records. What makes
this more than a generic nit is the decision it rests on:
`SectionPage.tsx:163-172` removed the closing apparatus on the reasoning
that "the way back to it is in the identity band at the top of every page."
With JavaScript off, `/we-are` renders exactly three links — skip,
wordmark, exit — so a phone reader's entire navigation out of the file is
two 17px stripes.

**Evidence.** `.wordmark` (`:270-273`) and `.identityExit` (`:297-301`)
carry no padding or `min-height`; the band sets `--t-data`/`--t-data-lh` =
0.72rem × 1.45 = **16.7px**, and `.identityExit` measures 350px wide at
390px (viewport minus the shell's 2×20px clamp floor). Correction to the
standard invoked: this does **not** fail WCAG 2.5.8 (AA, 24px) — the
Spacing exception is satisfied. At ≤900px `.identityExit` takes
`flex-basis: 100%` and the row gap drops to 0.5rem, putting the two
targets' centres 16.7 + 8 = **24.7px** apart on DocPage/archive rows and
~29.3px on SectionPage (whose 1.6rem emblem deepens the first row), so the
24px circles do not intersect. What it fails is 2.5.5 (AAA, 44px) and this
codebase's own convention: `min-height: 44px` is set in `.askCta`
(`:428`, not the filed `:392`), `.sensitiveButton`, `.share`, the support
submits and the orbit `.link`.

**Recommendation.** In the `@media (max-width: 900px)` block at
`sections.module.css:651` — where the band already wraps and
`.identityExit` already gets `flex-basis: 100%` — add `.wordmark,
.identityExit { display: inline-flex; align-items: center; min-height:
44px; }`. Growing the flex box rather than adding padding keeps the gold
text on the band's baseline. Justify it as ergonomics and internal
convention, not AA conformance, and weigh the cost: +27px of band height on
a phone, against `.ai/DESIGN-V2.md:229-233`'s "first real content lands
above the fold on every page" — consider applying it in the ≤719px block
instead, or pairing it with a small reduction in `.identityBand`
padding-top.

### `cross-cutting-chat-never-got-v2` — the chat surface is the last V2 holdout

**medium** · typography · medium effort
`components/chat/ask-the-lion-chat.module.css:47-64`,
`components/chat/ask-the-lion-chat.module.css:144-158`,
`components/chat/ask-the-lion-chat.module.css:167-187`,
`components/chat/ask-the-lion-chat.module.css:433-473`,
`components/chat/particle-chat-launcher.module.css:159-192`,
`components/chat/particle-chat-launcher.module.css:296-318`

**Problem.** The chat launcher and modal never got the V2 type pass, and
the root layout puts them on every route. It breaks all four hard rules at
once. The floor: `.eyebrow` 9.28px, `.messageMeta` 8.96px, `.newThread` and
`.undelivered` 9.28px, the launcher label 11.04px. The tracking cap:
0.25em, 0.22em, 0.2em, 0.18em, 0.16em against a stated maximum of 0.08em.
The ≤2-word rule: "AI intelligence desk" is three words in tracked
capitals. And Cinzel — which `CLAUDE.md` says "belongs to the home particle
scene only" — is the modal's `h2` *and* sets the welcome sentence "What
would you like to verify?" at 16.8px, the exact faux-small-caps sentence
DESIGN-V2 Part 1 names as the single biggest "hard to read" driver. On top
of that the two files carry ~26 raw hexes, the twelve-drifting-greys
problem the token scale was built to end.

**Evidence.** Anchors verbatim: `:50` `font-size: 0.58rem`, `:52`
`letter-spacing: 0.25em`, `:59-62` Cinzel + 1.06rem + 0.2em uppercase on
`.header h2`, `:147-149` Cinzel 1.05rem on `.welcome p`, `:173-175`
0.56rem/0.18em, `:343-345` and `:440-442` 0.58rem/0.16em;
`particle-chat-launcher.module.css:172-177` Cinzel/0.69rem/0.22em uppercase
with a 9rem cap derived in the comment at 146-150 whose own longest value
is "Ask about the fake resistance" — five words. Root stays at 16px, so
every px figure holds. Two filed figures are corrected. The grep is wider
than reported: across all 13 CSS files under `app/` + `components/`,
sub-0.72rem `font-size` returns **11** hits (10 chat, 1
`particle-nav/styles.module.css:287`) and over-0.08em `letter-spacing`
returns **15** (9 chat, 6 particle-nav) — 26 total, not 13, with 7
non-chat lines rather than 2. Hex count is 23 distinct in the modal plus 3
in the launcher (26 distinct, ~35 declarations). Contrast is not a failure
mode: over the panel ground (~#070c16) `#7695aa` is 6.2:1, `#75899c`
5.4:1, `#8699ab` 6.7:1, `#e8edf5` 16.6:1; only `.timestamp` `#5b6d7f` is
weak (see the next finding). The launcher label is `aria-hidden="true"`
and `display: none` between 720px and 1219px, so it is not literally on
every page at every width; the modal is. `.message p` is not among the
sub-floor hits — the answer text is at or above the floor.

**Recommendation.** Give these two files the Phase 3 pass the ten routes
got: replace every literal with the nearest of
`--ink-hi`/`--ink`/`--ink-lo`/`--gold`/`--gold-hi`; map every size onto the
seven steps (`.eyebrow`, `.messageMeta`, `.timestamp`, `.undelivered`,
`.newThread`, `.requestId`, `.retry`, `.counter`, `.citationChip` →
`--t-data`; `.welcome small`, `.starter`, `.offline`, `.citationQuote`,
`.messageError` → `--t-caption`); cap tracking at `--t-data-tracking`. Set
`.header h2` and `.welcome p` in `var(--face-display)` sentence case —
"Ask the Lion" at `--t-h3`, the welcome line at `--t-h2`. Set the launcher
label in `var(--face-data)` at `--t-data` with
`letter-spacing: var(--t-data-tracking)`, sentence case; note that
`--t-data` is 0.72rem, i.e. **larger** than the label's current 0.69rem, so
say plainly that the label grows — it still fits because `max-width: 9rem`
+ `text-wrap: balance` already wrap it, but the ≤719px dock block
(`:296-318`) resets `max-width` and sets `white-space: nowrap` at
0.62rem/0.14em and needs the same treatment or the mobile bar overflows.
Leave `components/particle-nav/styles.module.css` alone — its 7
sub-floor/over-tracked lines are the home particle scene, which the
2026-08-25 decision exempts. The one point worth arguing is Cinzel: the
launcher's particle lion is arguably part of the home scene's identity, but
the modal's `h2` and welcome sentence are read text on a reading page, and
`CLAUDE.md`'s rule is unambiguous about those.

### `cross-cutting-four-sub-aa-text-pairs` — four pairs below 4.5:1, one of them a UA default

**medium** · accessibility · trivial effort
`components/chat/ask-the-lion-chat.module.css:183-187`,
`components/chat/ask-the-lion-chat.module.css:530`,
`components/support/support.module.css:27-38`,
`components/home/home.module.css:433-441`, `app/globals.css:64-72`,
`app/not-found.module.css:101`, `app/not-found.module.css:137`
*(Filed by the cross-cutting agent as four pairs and by the home-scene
agent as the `.entryIndex` case in isolation; merged here, with the 404
duplicate the home-scene pass found.)*

**Problem.** The reading palette is sound; all four failures are local
dialects outside it. Two are placeholders, which WCAG treats as content
under 1.4.3 and which carry real instructions here ("What did you see, and
where?", "Only if you want a follow-up") — and one of those is not styled
at all, because `support.module.css` never declares `::placeholder`, so the
site's only real form inherits Chrome's UA grey. The fourth is the home
band's "File NN / 08" index set in `--data-blue-dim`, which is doubly
wrong: `globals.css:64-72` defines the blue ramp as semantic
("verified/hostile streams, assessment badges, the scan's two directions")
and says it is "never used to express text hierarchy", and here the ramp's
dim step is doing exactly that while failing AA.

**Evidence.** `.timestamp` `#5b6d7f` on the panel's rgb(7,12,22) =
**3.67:1** at 8.96px. `.composer textarea::placeholder` `#647687` on
`rgba(3,8,15,0.86)` = **4.28:1**. Support-form placeholder = Chrome UA
`#757575` on `rgba(7,11,20,0.6)` = **4.27:1**. `.entryIndex`
`--data-blue-dim #3e7fa8` at 11.52px: **4.50:1** against flat `--ground`
(so it fails AA rather than "clearing it by 0.01"), **4.13:1** on the
weave's lit rows rgb(13,23,35), and **3.54:1** where both `--scan-ground`
layers composite to rgb(20,38,53) — the radial wash the original filing
missed. Under `.entry:hover`'s `rgba(201,162,75,0.05)` it drops to 3.30:1.
The same defect ships on `/404`: `app/not-found.module.css:137` and `:101`
carry the identical `.entryIndex` via the `--blue-dim` alias at line 16.
`sections.module.css:175` uses the token for decorative scan rows and is a
legitimate semantic use — leave it. No `prefers-contrast` block exists
anywhere in the CSS, and no test covers contrast.

**Recommendation.** `.timestamp` → `var(--ink-lo)` (6.32:1 on the panel).
Both placeholders → `var(--ink-lo)` as well (6.36:1 on the support field);
add `.field input::placeholder, .field textarea::placeholder { color:
var(--ink-lo); }` scoped to `.field` so it does not leak to the chat
composer, which has its own. For `.entryIndex` prefer `var(--ink)` over
`--ink-lo` or `--data-blue`: `--ink-lo` clears AA on every layer (4.99:1
worst case) but `.ai/DESIGN-V2.md:200` describes it as "the floor, AA at
≥0.8125rem" and this is 0.72rem, while `--data-blue` clears AA (7.44:1
flat, 6.59:1 composited) but leaves a semantic data ramp carrying text
hierarchy, which DESIGN-V2 forbids in the same breath. `--ink` is 8.83:1
worst case and argument-free. Apply the same change to
`app/not-found.module.css:137` and `:101`. None of these changes a hue,
only a step.

### `cross-cutting-progress-bar-claims-fully-read` — the resting state is 100%

**medium** · interaction · trivial effort
`components/sections/ReadingProgress.tsx:50-54`,
`components/sections/sections.module.css:593-601`,
`components/sections/sections.module.css:611-618`,
`components/sections/reading-progress.module.css:12-20`,
`components/briefs/geopolitical-brief.module.css:178`

**Problem.** `ReadingProgress` renders `<span className={valueClassName}
/>` with no inline transform; the CSS gives that span `width: 100%` and
`transform-origin: left`, and only the client effect applies
`scaleX(progress)`. So the element's painted default is `scaleX(1)`. With
JavaScript off, every section page shows a 2px blue-to-gold gradient
spanning the entire top of the viewport, glowing, never moving, telling the
reader they have finished a document they have not started. On a site whose
proposition is that its indicators mean something, a progress indicator
whose resting state is a false 100% is the worst possible default.

**Evidence.** `ReadingProgress.tsx:52` is `<span ref={valueRef}
className={valueClassName ?? styles.progressValue} />`, no style attribute.
`grep -rn scaleX` over all CSS/TSX outside `node_modules` returns exactly
one hit — the client effect at `:36` — so nothing sets a resting transform.
`SectionPage.tsx:109-116` server-renders the component inside `<main
data-reading-scroll>` with no Suspense boundary, so the full bar is in the
prerendered HTML; above 1220px `.topProgressTrack { display: none }` swaps
in the rail's `.depthValue`, which is full-width too. Confirmed by
rendering `/we-are` with `javaScriptEnabled: false`: the track element is
present and its value span is unscaled. Two corrections. The JS-on symptom
is worse than a first-paint flash: `update()` defers to
`requestAnimationFrame`, so the first painted frame is `scaleX(1)` and the
set to `scaleX(0)` is interpolated by `transition: transform 80ms linear` —
a visible right-to-left collapse of a full bar on every load. And there are
four consumers, not three: the fixed 2px hairline, the rail's `.depthValue`
(no box-shadow), the shared default, and the Brief's own 1px bar absolutely
positioned at the bottom of its sticky header.

**Recommendation.** Add `transform: scaleX(0);` to all four rules
(`sections.module.css:593` and `:611`, `reading-progress.module.css:12`,
`geopolitical-brief.module.css:178`). State the rationale accurately: the
first `update()` is not synchronous, it schedules a rAF, so with
`scaleX(0)` the first painted frame is an empty track that then fills —
which is the desired behaviour. If an empty 2px track looks like a
rendering artifact, gate the component on hydration instead, but `scaleX(0)`
is one declaration and preserves the smooth first fill.

### `cross-cutting-inner-scroll-chrome-budget` — every reading route is its own scroll container

**medium** · responsive · large effort
`app/globals.css:126-132`,
`components/sections/sections.module.css:43-52`,
`components/sections/sections.module.css:684-690`,
`components/briefs/geopolitical-brief.module.css:37-48`,
`components/briefs/geopolitical-brief.module.css:747-800`

**Problem.** Because the document never scrolls, the mobile browser's URL
bar never auto-collapses: a phone reader permanently loses the ~60–90px
every other website reclaims after the first swipe. Browser scroll
restoration on back-navigation also does not apply — which is the same
mechanism that makes the archive indexes lose a reader's place. This is not
a reversal of a documented decision: `.ai/DESIGN-V2.md` Phase 2 explicitly
plans "Document scroll restored" and defers it with evidence, and
`.ai/DECISIONS.md` (2026-08-26) says only that sticky rails did not require
it and "That remains its own phase." This is the reader-facing cost that
deferral note does not record, and it grows with every route added — it now
covers ~1,190 routes, since archive records reach the same `.page` through
`ArchiveRecordPage` → `DocPage`.

**Evidence.** `globals.css:126-132` `html, body { height: 100%; overflow:
hidden; }`; `sections.module.css:45-46` `height: 100dvh; overflow-y: auto;`
with the comment "`height` (not `min-height`) is load-bearing: this element
is the scroll container." Measured at 390×844 on `/war-update`: `.page`
computed height **760px**, and
`document.documentElement.scrollHeight === window.innerHeight` (844) — zero
document scroll range. Two filed numbers are wrong and change the case. The
dock over-reserve is ~2px, not 16px:
`particle-chat-launcher.module.css:265-289` gives the dock as 0.65rem
offset + 1px borders + 0.46rem×2 padding + a 3.45rem launcher ≈ **82px**
from the viewport bottom, exactly what `CHAT_DOCK_PX`'s comment in
`components/particle-nav/config.ts:205-214` records, against the 84px
reserve; the measured 57px rect is the launcher plus border, not the padded
`.root`. And the "23% of the screen" figure double-counts: the Brief's
3.5rem sticky `.siteHeader` and sticky `.indexRail` (the 6.8rem
`scroll-padding-top` admits to 109px) are `position: sticky` and stay
exactly as costly once the document scrolls, so restoring document scroll
recovers none of that — only the URL bar plus ~2px.

**Recommendation.** Drop the filed "cheap and immediate" half: a
`--chat-dock-h` derived from 57px would under-reserve and put text under
the dock, the exact failure `sections.module.css:38-41` warns about, and
`CHAT_DOCK_PX = 84` is asserted in
`tests/particle-nav-layout.test.ts`. If the repeated literal is worth
centralising, define `--chat-dock-h: 5.25rem` (the existing, correct value)
and reference it from `sections.module.css:688`, `home.module.css:552` and
`geopolitical-brief.module.css:757`. The real work is the already-planned
Phase 2 remainder, and its two blockers are now smaller than DESIGN-V2
recorded, because `app/loading.tsx` is gone and `globals.css` already
scopes the lock with `html:has([data-home-scroll])`: invert that `:has()`
so `overflow: hidden` reaches the home route alone — noting DECISIONS
2026-08-25, that locking `html` alone was insufficient (body became the
scroller) and that `:has()` specificity must stay attribute-for-attribute
so the intro lock still wins by source order — and move
`ReadingProgress.tsx:24` and `SectionToc.tsx:44` off `[data-reading-scroll]`
to `window.scrollY` / `root: null`. Sell it on URL-bar collapse and scroll
restoration across ~1,190 routes, not on the Brief's sticky rails.

### `cross-cutting-forms-die-without-js` — both `/support-us` forms discard a submission

**medium** · accessibility · medium effort
`components/support/ReportClaimForm.tsx:102`,
`components/support/ReportClaimForm.tsx:127-129`,
`components/support/VolunteerInterestForm.tsx:55`,
`components/support/VolunteerInterestForm.tsx:112`

**Problem.** Both are `<form onSubmit={handler}>` with no `action` and no
`method`. With JavaScript disabled — or in the window between paint and
hydration on a slow connection, which is the same thing for anyone who
types fast — pressing submit performs a native GET to `/support-us`,
nothing is sent, and the reader gets a reload that looks like a successful
navigation. This is `.ai/DECISIONS.md`'s "no false live state" principle
inverted: the form reports success by appearing to have done something. The
rest of the site is scrupulous about the no-JS tier — `app/loading.tsx` was
deleted for exactly this class of bug, and the orbit ships real `<a
href>`s — which makes the forms the one place the principle stops.
Separately, the report form's validation message is announced but not
associated: the `role="alert"` paragraph sits between two fields, neither
input carries `aria-invalid`, and focus never moves, so a screen-reader
user hears "A report needs a link or a description" with no way to know
which of four fields it means.

**Evidence.** `ReportClaimForm.tsx:102` `<form className={styles.form}
onSubmit={submit}>` (no action), `:63` `event.preventDefault()`, `:127-129`
the `role="alert"` paragraph, and neither `#report-url` (`:105-112`) nor
`#report-body` (`:117-124`) carries `aria-invalid` or `aria-describedby`.
`VolunteerInterestForm.tsx:55` is the same shape; `:51` sets
`window.location.href = 'mailto:…'`. No `<noscript>` exists anywhere under
`app/` or `components/`. One evidence correction that matters: `grep -n
"name=" components/support/*.tsx` returns nothing, so no input carries a
`name` attribute — a native submit is a GET to `/support-us` with an
**empty** query string. The typed report is silently dropped, not appended
to any URL, so nothing leaks into the URL, referrer or server logs.

**Recommendation.** Ship the aria fix as filed — correct and
self-contained: `aria-invalid={touched && !hasContent}` on `#report-url`
and `#report-body`, an id on the error `<p>` referenced by
`aria-describedby` from both, and focus moved to `#report-url` when the
guard trips. For the no-JS tier, prefer a `<noscript>` block in both
modules naming a real submission address over `action="/api/v1/reports"`:
`server/http/handler.ts:64-70` `parseBody` calls `request.json()` and
throws `VALIDATION_ERROR` on anything else, so a native form POST would
send `application/x-www-form-urlencoded` and render a raw problem+json page
— worse than the current silent reload unless the route learns to parse
form encoding and return HTML. Do **not** replace the volunteer form with a
static `mailto:` anchor: the handler builds the body from the five typed
fields, which a fixed href cannot carry, and the mailto composition is a
documented decision (`.ai/DECISIONS.md`, 2026-08-25). A noscript mailto
beside the form preserves both.

### `cross-cutting-chat-and-archive-touch-targets` — nine controls at 15–42px

**medium** · accessibility · small effort
`components/chat/ask-the-lion-chat.module.css:189-200`,
`components/chat/ask-the-lion-chat.module.css:301-313`,
`components/chat/ask-the-lion-chat.module.css:381-394`,
`components/chat/ask-the-lion-chat.module.css:433-447`,
`components/chat/ask-the-lion-chat.module.css:532-542`,
`components/archive/archive.module.css:182-208`

**Problem.** The modal opens full-bleed on a phone, so every control in it
is a touch control, and almost none were sized as one. `.citationChip` is a
1.35rem square — 21.6px — and it is the control that opens a cited quote,
the verification gesture this entire site is about. `.copy` is bare text at
8.96px. `.retry` and `.newThread` come out at 30.7px and 28.7px. The send
button is 41.6px, four pixels short of the 44 that `.close` beside it gets
right. The archive language switcher is the same story: `--t-data` text
with 0.15rem of vertical padding gives a 23.5px chip, and a testimony with
seven languages is a row of seven. The pattern is that anything set in the
data voice was sized as a label and then given a click handler.

**Evidence.** Every computed number reproduces exactly.
`.retry`/`.newThread` inherit body's line-height 1.7. The archive chip is
11.52 × 1.45 + 4.8 + 2 = 23.5px. Counts verified: 107 of 179 october7
records are multi-language with a max of 7 locales, and all 335
hamas-massacre records carry 2. Nothing mitigates: the modal sheet's only
three media queries (`:585`, `:604`, `:613`) re-inset the panel and repad
the header but resize no control. Correction to the standard: WCAG 2.5.8's
spacing exception is satisfied in every case — citation chips sit at 0.3rem
gap (26.4px centre-to-centre), language chips at 0.5rem (31.5px), and
`.copy` has no adjacent target — so none of these actually fails AA. The
failing criterion is 2.5.5 (AAA, 44px), plus internal inconsistency with
`min-height: 44px` already set in six other stylesheets
(`sections.module.css:428`, `content.module.css:924`,
`support.module.css:29/91`, `geopolitical-brief.module.css:112/593/749`,
`particle-nav/styles.module.css:212-213`, `home.module.css:140/204`, the
last of which comments it by name).

**Recommendation.** `.retry`, `.newThread` → `min-height: 44px;
display: inline-flex; align-items: center;`; `.composer button` → 2.75rem
to match `.close`; and add the same `min-height` to the shared
`.languageLink, .languageCurrent` rule at `archive.module.css:182`, which
already has `flex-wrap: wrap` at `:168` so taller chips reflow rather than
overflow (a seven-language testimony grows from one row to two on a phone —
the correct trade). Two exceptions to the filed list. `.citationChip`
should grow its hit area via an inner `::before` rather than becoming a
44px square: the chips are circles in a wrapping row and squaring them
changes the visual. And do **not** give `.copy` `min-height: 44px` —
`.messageMeta` is `align-items: baseline` with a 0.55rem gap and sits above
every message bubble, so that would inflate the meta row on every turn and
add ~30px of vertical drift per exchange; enlarge its hit area with an
`::after` inset overlay, or move it out of the baseline row.

### `cross-cutting-composer-triggers-ios-zoom` — 13.12px text in the composer and the answers

**medium** · interaction · trivial effort
`components/chat/ask-the-lion-chat.module.css:220`,
`components/chat/ask-the-lion-chat.module.css:514-528`,
`components/support/support.module.css:27-38`

**Problem.** iOS Safari zooms the page whenever a focused text control has
a computed font-size below 16px, and the viewport meta sets `initial-scale
=1` with no `maximum-scale` (correctly — pinch-zoom must stay available).
The composer computes to 13.12px, so tapping it scales the whole viewport
up, and because the panel at ≤719px is `position: fixed` inset from all
four edges, the zoom crops the modal rather than reflowing it. The site
already knows the answer: `support.module.css:36` sets its real form inputs
to `var(--t-body)` — 17px — with a comment about "real controls a person
fills in". The same 0.82rem also sets `.message p` at `:220`, i.e. the
answer text a reader came to read, two steps below the site's body size.

**Evidence.** `:525` `font-size: 0.82rem` on `.composer textarea` and
`:220` the same on `.message p`; `globals.css` sets font-size only on
`body` (`:237`), so rem = 16px and 0.82rem = 13.12px against `--t-body`
1.0625rem = 17px. The ≤719px block (`:585`) makes `.panel` fixed inset on
all four edges and overrides no font-size; no other rule, media query or
token raises the composer to 16px+. Two corrections. `app/layout.tsx` does
**not** emit the viewport meta — its `viewport` export at `:59` sets only
`themeColor` and `colorScheme`, so the tag is Next's default (conclusion
unchanged: no `maximum-scale`, zoom-on-focus active). And the defect is
latent, not live: `AskTheLionChat.tsx:519` renders the textarea `disabled`
when the desk is offline, which per `.ai/DECISIONS.md:213` is its
production state today, and a disabled control cannot be focused.

**Recommendation.** Set `.composer textarea { font-size: var(--t-body);
line-height: var(--t-body-lh); }` and raise `min-height`/`max-height`
proportionally so the auto-grow at `AskTheLionChat.tsx:180-185` still clips
at roughly the same line count — carry the new line-height (1.7, not the
old 1.45) into that maths and verify the one-line resting height rather
than trusting the ratio. Apply the same to `.message p`. Do **not** add
`maximum-scale=1` to the viewport meta as a shortcut; that disables
pinch-zoom and is a WCAG 1.4.4 failure.

### `cross-cutting-figurerow-three-up-on-phones`

**low** · responsive · small effort
`components/content/content.module.css:428-436`,
`components/content/content.module.css:987-997`,
`components/content/content.module.css:1025-1036`,
`app/october-7/page.module.css:63-75`

**Problem.** `.figures` is `repeat(3, minmax(0, 1fr))` with no collapse
until `max-width: 359px`. The ≤719px block only shrinks the gap and unsets
the `dd` max-width, so three columns survive the entire phone range. A
key-figures row exists to be read at a glance, and at four lines to a
column it is the slowest thing on the page.

**Evidence.** Widths re-derived from the CSS rather than from the browser
dump (the Brief's article is `padding-inline: 1.25rem` at ≤900px): at 360px
content = 320px and (320 − 2×0.8rem gap)/3 = **98.13px**; at 390px
**108.13px**; at 600px **178.13px** — matching the Chromium measurements
exactly. Caption line counts 3/4/3 at 360px, 2/4/3 at 390px, 1/2/2 at
600px; item heights 131px at 360px, 79px at 600px. No container query
exists anywhere in the repo. Two corrections: the "1,200+" comment the
finding leans on is at `app/october-7/page.module.css:38-41` and explains
the `dt` `clamp()` and `white-space: nowrap`, **not** the 640px collapse at
`:63`, so the codebase does not "already know" as directly as claimed; and
the filed 719px threshold is refuted by the finding's own numbers — at
600px the row is a working three-up.

**Recommendation.** Move the collapse into the shared component as its own
`@media (max-width: 640px)` block, matching the threshold October 7 already
chose: `.figures { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; }`
plus the top-border treatment currently written at `:1031-1035`, then
delete the 359px `.figures` rules (leave `.publicationMeta` there).
October 7's local override then becomes redundant for the grid but must
stay for its `dt` sizing and centring. Do not collapse at 719px — that
trades a working three-up for ~190px of scroll.

### `cross-cutting-breakpoint-sprawl` — ten widths against a four-width canon

**low** · consistency · small effort
`components/home/home.module.css:487-490`,
`app/we-are/page.module.css:183`, `app/israels-story/page.module.css:166`,
`app/october-7/page.module.css:103`

**Problem.** `home.module.css:487-490` states the system — "The site's
breakpoints, restated: 1220 (rails), 900 (shell to one column), 719
(phone), 359 (the 320px floor)" — and six other files use five widths that
are not in it. The canon exists only in one file's comment and is enforced
by discipline.

**Evidence.** The 10-width enumeration is correct and reproduced: 359, 480,
540, 600, 640, 719, 736 (46rem), 900, 1219.98, 1220. But the filed
reader-visible mechanism — page grid in desktop mode while nested
components are in phone mode between 601 and 718px — is contradicted by the
code. `.figures` collapses at **359**, not 719; the ≤719px block in
`content.module.css` changes only gap, padding and a few sub-grids. At the
one real nesting site (`app/october-7/page.tsx:132`, `.inscription > dl`
hosting `.figures`) the page collapses *earlier* than the component, the
reverse of the claim, and deliberately — `content.module.css:447-449` names
October 7 by hand. Likewise `.card`'s only 719 rule is padding. Three of
the six rules the filed recommendation targets are padding-only, not grids;
`our-heroes` already uses 719 for its grid at `:170` (the 600 block is at
`:176`); and `fake-resistance:201` carries a written measured justification
("No room for a floating corner stamp beside wrapped header text") that the
proposed change would override. The 480 pair is internally consistent, not
sprawl: `home:556` and `not-found:157` are the identical rule for the same
file-index entry pattern.

**Recommendation.** Do not apply the filed sweep. Leave
`fake-resistance:201`, `october-7:64`, `our-heroes:176` and
`war-update:204` exactly as they are — two carry written or documented
justifications and two are padding-only. Three things are worth doing.
(1) `october-7:103`'s `min-width: 46rem` is the only rem-unit width query
in the codebase; note the real tradeoff the filing missed — rem in a media
query resolves against the user's font-size preference, so it is arguably
the *more* accessible form. If it was chosen for that reason, keep it and
say so in a comment; otherwise normalise to 720px. (2) `we-are:183` (600)
and `israels-story:166` (640) are the only genuinely unexplained grid
collapses: move them to 719 or add a one-line comment giving the measured
width at which the grid runs out of room — this codebase's own convention
is that an off-canon breakpoint earns its place with a written
justification. (3) Repeat `home.module.css:487-490`'s comment block at the
top of `content.module.css` and `sections.module.css` and extend it to name
the sanctioned deviations, so the canon is enforceable by reading. Custom
properties cannot be used in media queries, so a comment is the only
greppable form available.

### `cross-cutting-launcher-advertises-offline-desk`

**low** · interaction · small effort
`components/chat/particle-chat-launcher.module.css:182`,
`components/chat/particle-chat-launcher.module.css:242-264`,
`components/chat/AskTheLionChat.tsx:136-150`,
`components/chat/AskTheLionChat.tsx:485-489`,
`components/chat/AskTheLionChat.tsx:516-520`

**Problem.** `.label` runs `attentionCue 7.2s … infinite` while the desk is
offline: the capability probe hits `GET /api/v1/chat/threads`, gets a 500
because no database is provisioned, and the modal opens with the composer
disabled, the starters suppressed and a note saying so. The launcher has no
knowledge of that state — `chat-open-context.tsx` carries only `{open,
initialQuestion}` — so a repeated attention cue keeps inviting readers into
a dead end, which the modal itself is scrupulous about not doing.

**Evidence.** Anchors verbatim, including `disabled={offline}` at `:519`
with placeholder "The desk is offline for now" and the starters gated at
`:379`. Scope is narrower than filed, in two ways the filing had backwards.
`.label` is the only animated element in the file, and it is `animation:
none` inside the ≤719px block (`:317`) and `display: none` in the
720–1219px block (`:188-192`) — so the infinite cue exists only at
**≥1220px**, and the claim that the 720–1219px band shows "an unlabelled
gold blob that pulses" is false: nothing pulses there.
`@media (prefers-reduced-motion: reduce)` at `:326-341` already sets
`animation: none !important` on `.label`, so the accessibility axis is
handled. Note `.ai/STATE.md:203-205` records that with a database
provisioned in production the probe would report *online* and every POST
would still fail, so the launcher-vs-desk mismatch outlives the current
500.

**Recommendation.** Do **not** hoist the probe into `ChatOpenProvider` as
filed: that fires a `GET /api/v1/chat/threads` on first paint of every
route, including ~1,177 prerendered archive pages, to decide a decorative
animation — a network request per page view for a CSS property. The
`data-desk` interim is also unavailable, since the modal that learns the
state only mounts once opened. The proportionate fix is to stop the loop
regardless of desk state: change `infinite` to a finite count (e.g. `3`) at
`:182`, matching the mobile and 720–1219px tiers that already run no cue at
all. If desk state really should reach the launcher, cache one probe result
in `sessionStorage` from the modal's existing effect and let the launcher
read it on subsequent navigations.

---

## Merged findings

Six pairs were filed twice, by agents looking at the same defect from
different surfaces. Each pair is written once above; the retired id is
listed here so a search for it lands somewhere.

| Filed as | Written above as |
| --- | --- |
| `archive-brief-998-non-english-pages-are-served-as-lang-en` + `cross-cutting-archive-lang-declared-english` | `archive-lang-declared-english` |
| `cross-cutting-error-page-cinzel` | `reading-system-error-page-is-a-preserved-v1-fossil` |
| `reading-system-two-tables-of-contents-at-once` | `section-pages-israels-story-two-contents-lists` |
| `cross-cutting-archive-image-cls` | `archive-brief-october7-videos-reserve-no-layout-height` |
| `home-scene-file-index-numbers-fail-contrast` | `cross-cutting-four-sub-aa-text-pairs` |

Two further pairs overlap without being the same finding and are
cross-referenced in place rather than merged:
`reading-system-verdict-ramp-cannot-signal-its-verdict` with
`section-pages-assessment-ramps-are-one-colour` (same ΔE measurement,
different consequence), and `section-pages-first-content-below-the-fold`
with `section-pages-israels-story-two-contents-lists` (the second is the
correctly width-scoped form of the first's Israel's Story fix).

---

## Considered and rejected

Three findings were filed and did not survive verification. They are
recorded here so the next session does not refile them.

**`reading-system-aside-is-still-a-zero-caller-prop`** — "`aside` has zero
callers, `surface="quiet"` has no non-callers, `accent` reaches only
bullets and a slug". The counts are real, but the first two legs are the
documented accepted state, not drift: `CLAUDE.md` says verbatim that
`surface="quiet"` is carried by all seven and is not a deviation, and that
`aside` "exists and is unused". Neither dead branch is visible to any
reader. The third leg is inadmissible: `.ai/DESIGN-V2.md:204` states that
blue and ember survive "only as semantic data ramps … never as text
hierarchy", so `--accent` reaching the route slug, `li::marker`,
`.tocNumber` and two progress gradients while `.blockHeading h2` and
`.ledeRule` stay `--gold` is the rule being obeyed. The recommendation was
also hazardous: `--accent` defaults to `var(--data-blue)`
(`sections.module.css:36`), so `color: var(--accent)` on `h2` would turn
the other six dossiers' headings blue.

**`reading-system-masthead-status-is-a-constant`** — "'Reference edition'
is hardcoded into every masthead, so the status slot carries no
information". `.ai/DECISIONS.md` 2026-08-25 ("Marathon content is real and
sourced, or labeled a reference") records that this string deliberately
*replaced* a hardcoded `Monitoring · active` label and ends "Do not
reintroduce a live-sounding label". The constant is a filled slot, not an
empty one: it is uniform because the claim is uniformly true, and the data
agrees (`war-update.ts:166` and `fake-resistance.ts:132` both literally
read `edition: 'Reference edition 001'`). The premise that War Update is a
live edition is contradicted by its own trust strip. The proposed
replacements make it worse — "Edition Sept 2025 – Jul 2026" is precisely
the freshness-flavoured label the decision forbids, and "Working edition ·
N of N chapters" invents an unknown target count against the same entry's
no-invented-facts rule. The real per-page status already renders where a
reader meets it, in `PublicationMeta`.

**`cross-cutting-colour-only-links`** — "the front page's closing links are
gold on grey with no underline, 1.29:1 against their own surrounding text".
The 1.29:1 figure recomputes exactly, but the mechanism does not exist:
`HomeFrontPage.tsx:189-193` is a two-item link row with no surrounding
prose, and the only thing `--ink-lo` paints is the `aria-hidden` middot, so
the two colours never sit adjacent as body-text vs link. WCAG 1.4.1 /
G183's 3:1 rule governs links embedded in a block of text; against its
actual background (`--ground`) `--gold` is 8.20:1. The "no `:focus-visible`
companion" claim is also false: `home.module.css:482-486` is
`.frontPage a:focus-visible { outline: 2px solid var(--gold-hi);
outline-offset: 3px; }`, marked "lock: … never removed", and `.docLinks` is
inside `.frontPage`. The sibling closing row in
`geopolitical-brief.module.css:617-625` is likewise underline-free, so the
pattern is consistent for this element. What remains is only that the two
anchors are ~15px tall with no resting non-colour cue on touch — a
touch-target point, already covered by
`cross-cutting-identity-band-17px-exit`'s class of finding.

---

## What this audit could not check

**The WebGPU scene never rendered.** Two of the five agents worked from
source only because the dev server did not answer, and no agent ran a real
browser with a GPU. Everything in "The home experience" — label sizes, ring
geometry, intro timing, poster composition, the sim dials — is computed
from code and CSS. The repo's own verification trap applies in full: the
in-app browser can report `visibilityState === "hidden"` and suspend
`requestAnimationFrame`, and headless Chromium falls back to SwiftShader,
which the GPU probe correctly rejects, so the scene never mounts in either.
Before any home-scene change lands it needs `npm run verify:graphics`, `node
scripts/final-verify.mjs` and `node .claude/skills/verify-intro/capture.mjs`
on the macOS workstation, in real Chrome with `headless: false`. Four
scripts hardcode the macOS Chrome path and cannot run in a Linux container
at all. Specifically unresolved: whether an 11.52px orbit label wraps
"GEOPOLITICAL BRIEF" to three lines and overruns the 44px ring; whether a
two-line intro beat is legible at a 3.3s dwell; and what the no-canvas link
ring's alpha needs to be to read as a node.

**The home band was not captured.** `node scripts/verify-home-band.mjs` is
also macOS-only, so the strip-overlap arithmetic, the masthead stack height
and the phone fold measurements in the home section are derived from CSS
rather than observed.

**No real media.** `NEXT_PUBLIC_ARCHIVE_CDN` is unset and `public/archive`
does not exist in this tree, so no archive image or video was ever
displayed. The layout-shift and empty-state findings are reasoned from the
package registries (`media.json`) and the render path, not from watching a
page reflow. `scripts/verify-archive-assets.mjs` exists precisely to gate
this and should be run once the bucket is provisioned.

**No production build.** Bundle-size claims are structural — a static
import from a root-layout client component reaches every route — not
measured against emitted chunks. The 657,516-byte / 2,478-node index
figures and the 31,311px / 42,540px scroll heights come from one agent's
dev-server session and could not be reproduced during verification; treat
them as indicative.

**A handful of browser measurements are single-source.** Where a figure was
measured once in Chromium and could not be re-derived from source during
verification, the finding says so: the 455/112/116px archive title blocks,
`/corrections`' `scrollHeight === clientHeight`, `/our-heroes`' 2272px page
and y=404 first citation, and `/war-update`'s y=768 first dispatch.

**No user testing, no screen-reader session, and no real assistive
technology.** The accessibility findings are computed contrast, computed
box geometry and DOM inspection. Nobody listened to a Portuguese testimony
announced with an English voice, nobody tabbed the identity band on a
phone, and nobody tried to hit a 21.6px citation chip with a thumb. The
WCAG citations were re-checked against the criteria during verification —
which is how four filed "AA failures" turned out to satisfy 2.5.8's spacing
exception and be AAA target-size findings instead — but a real session
would find things this method cannot.

**Nothing was checked at 320px in the agent pass.** The smallest viewport
those five reasoned about is 360px, except where the orbit's 320×568 floor
was computed directly from `computeOrbitLayout`. The appendix below closes
this: a later sweep measured every reading route at 320×568 directly.

---

## Appendix — independent browser sweep

Run after the five agents finished, against `next dev` on this container,
in Playwright's bundled Chromium: 16–17 routes at 320×568, 390×844,
768×1024, 1440×900 and 1920×1080, 82 probes in total. It measures computed
style on every element that owns text, the composited background each of
those elements actually sits on, element geometry, focus style under
programmatic focus, and the console. It exists to put numbers under the
claims above and to close two of the gaps the previous section names. It
cannot mount the WebGPU scene, so it says nothing about the home
experience beyond that route's DOM layer.

Three of its raw flags were withdrawn on inspection; they are recorded
below because the same flags will reappear in any automated sweep and
should die the same way.

### Nothing overflows, at any width

`document.scrollWidth > clientWidth` was false on every route at every one
of the five viewports, 320px included. This closes "Nothing was checked at
320px" above: the reading shell, both archive indexes, the brief and the
404 all hold 320px without a horizontal scrollbar.

Two internal scrollers at 320px are deliberate and verified as such:
`.contents ol` in the brief is `overflow-x: auto` under a comment that
calls it a horizontal scroller (`geopolitical-brief.module.css:817-824`),
and `.rowField` is the `ScanBackdrop` drift field, which is `aria-hidden`.

One is not. On `/fake-resistance` the chat launcher's own container
overflows its box — `aside.…__root` measures `scrollWidth 331 > clientWidth
294` — and on `/war-update` the row inside it does, `289 > 272`. The cause
is the label the findings above already cover: "Ask about the fake
resistance" does not fit the launcher at 320px. It is the same defect, one
viewport further down than the sweep that found it.

### The rendered type census

Twenty-five distinct font sizes are painted across the site against seven
declared steps:

```
9.28  9.92  11.04  11.52  12.32  12.42  13  15  16  17  18  20  23.2
24.8  30.4  30.72  33.6  35.1  38.4  41.6  44  48  65.6  69.12  88
```

Four faces render: Newsreader, IBM Plex Sans, Geist Mono and — on every
reading route, not only the scene — Cinzel. Three sizes fall below the
0.72rem/11.52px floor. All three are the same two elements: the orbit
label at 9.28px on the home scene, and the chat launcher's label at
11.04px desktop / 9.92px mobile (`particle-chat-launcher.module.css:173`,
`:311`), which also carries `letter-spacing: 0.22em` over strings of up to
five words. That single selector breaks the floor, the
uppercase-for-two-words rule and the Cinzel-is-scene-only invariant at
once, on all sixteen routes.

The clamp-derived sizes (23.2, 30.4, 35.1, 65.6, 69.12, 88) are the type
scale resolving at a viewport, not new steps. The census is a ceiling on
the drift, not a count of violations.

### Focus is clean

Every focusable element sampled under programmatic focus across all
routes paints `outline: solid 2px rgb(239,215,154)` — the launcher's is
`rgb(255,226,154)`. Nothing carries a bare `outline: none`. This is a pass
and worth recording so a later sweep does not re-open it.

### Tap targets under 44px at 320px

Present on every reading route and dominated by the identity band: the
wordmark measures 101.81×16.69 and the exit link 280×16.69, both 16.69px
tall. `/war-update` carries 23 sub-44px targets, `/israels-story` 18,
`/october-7` 10, `/fake-resistance` 9, `/geopolitical-brief` 8. The skip
link is 148.25×43.94 — 0.06px under, i.e. a rounding result rather than a
design decision. Per the verification pass on the filed accessibility
findings, most of these satisfy 2.5.8's spacing exception and are AAA
target-size items, not AA failures; the numbers are recorded so that
judgement can be re-made rather than re-derived.

### The media 404s are live

Every archive record probe logs `Failed to load resource: 404` for
`/archive/<package>/originals/images/…`. This is the unprovisioned
`NEXT_PUBLIC_ARCHIVE_CDN` documented in `docs/archive-integration.md`,
observed rather than inferred. The `<img>` itself is well-formed — `width`
and `height` attributes present, `aspect-ratio: auto 719 / 1280`, `srcset`
and `sizes: (max-width: 720px) 100vw, 720px` — so the box is reserved and
nothing shifts. What the reader gets is a correctly-sized empty frame.

The launcher's own fallback image is the exception: no `width`, no
`height`, `aspect-ratio: auto`. It is fixed-position, so it costs no
document reflow.

### Withdrawn: three contrast flags

The sweep reported `.identitySep` at 2.04:1 across 26 probes, and the
`ScanBackdrop` rows at 2.49:1 (`--data-ember-dim`) and 4.03:1
(`--data-ember`) across 52. All three are withdrawn.
`sections.module.css:292` styles a `·` separator that `SectionPage.tsx:134`
renders `aria-hidden="true"`, and `ScanBackdrop.tsx:143` marks the whole
field `aria-hidden="true"`. Both are decorative by construction, so
neither is a text-contrast obligation, and the report's finding that the
reading palette measures 5.0–8.2:1 stands unchallenged.

Similarly withdrawn: the brief's wordmark measuring 1×1 at 320px is the
visually-hidden pattern at `geopolitical-brief.module.css:776-782`, not a
collapsed grid column.
