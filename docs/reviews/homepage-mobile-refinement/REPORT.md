# Homepage editorial journey — mobile refinement report

Updated: 2026-09-06 (Asia/Jerusalem). Implemented on branch
`claude/create-worktree-9wtvyy` and pushed to `main` on the owner's explicit
instruction the same day, which deploys to Production through the Vercel
git integration. The owner then read it on an iPhone and the design was
corrected the same day — larger type, previews that end on sentences, the
October 7 archive on the page's ground, no box around a dossier, a longer
launcher retract; see *Same-day correction* at the end. Every table and
capture below is from the corrected build.

Brief: *Lions of Zion Homepage Editorial Journey — Mobile UX, Visual
Hierarchy, Density and Interaction Refinement*. The journey's order —
cover → edition → News & Analysis → Fake Resistance → October 7 → Our Heroes
→ Israel's Story → Behind the desk — is unchanged. Every record, source,
verification state, evidence basis, image disclosure, date, content warning
and the deterministic daily selection are unchanged; no content was invented.

## Files changed

| Area | Files | What changed |
| --- | --- | --- |
| Section markup | `components/home/HomepageJourney.tsx`, `HomeJourneyPrimitives.tsx`, `HomeNewsSection.tsx`, `HomeNarrativesSection.tsx`, `HomeArchiveSection.tsx`, `HomeHeroesSection.tsx`, `HomeHistorySection.tsx` | A compact edition masthead; destinations named as the site names them (the "Narratives & fact checks" section is titled **Fake Resistance**, its old title is the kicker, its action is *Explore Fake Resistance*); each pair marked lead/companion (`data-rank`); one `SectionAction` per section, a sibling of the heading so CSS can place it after the records on a phone; captions in a fixed disclosure → description → credit order; an unresolved record without a finding excerpt renders no finding block; a documentation record whose excerpt is its own title no longer prints it twice; the lead image is decoded eagerly. `HomeSystemSection.tsx` is untouched. |
| Layout and type | `components/home/homepage-journey.module.css` | The section grid; the phone's single-column reading of each spread with the companion as a thumbnail row; headline scales (lead 29–36px clamped at four lines, companions 24px at three, section titles 38–48px); phone type floors (body and summaries 16px, "Why it matters" and findings 15px, metadata, captions, credits, sources and status meanings 13px, kickers 11px); line clamps as backstops behind the sentence previews; the Fake Resistance dossier as an open column on a phone (no panel, no border, the cover the column's width) with the companion without an illustration; the October 7 archive on the page's ground; the disclosure line; the section link's arrow sized in the label's em. Desktop rules are preserved except the action's placement. |
| Previews | `lib/preview-sentences.ts`, `components/home/HomeJourneyPrimitives.tsx` (`PreviewText`), the five section components | A phone shows a summary, a research question and "Why it matters" as whole sentences within a budget (about four lines for a lead, three for a companion) and hides the sentences past it; a wide viewport shows the paragraph as written. The first sentence always shows; an abbreviation guard (ranks, initials, U.S., months) fails towards a longer preview. |
| Cover | `app/page.tsx`, `app/home.module.css` | "Read the latest" is the one arrowed, ruled action (14px, weight 500); "Why this work matters" is a 14px low-ink sentence with no arrow and no rule; the cover ends 28px before the edition on a phone. |
| Ask launcher | `components/ask/AskDock.tsx`, `PublicAskDock.tsx`, `ask.module.css` | Homepage only, below 1100px: the seal over the cover, then a 48px icon that retracts after 24px of downward scroll and returns on 8px of upward scroll, at the end of the page, or on keyboard focus (`data-mode`, `data-retracted`). The retract travel is generous (diameter plus 144px plus the safe-area inset) because iOS Safari with its toolbar collapsed left the top of the icon showing at the exact travel. Focus order, accessible name, `aria-expanded`, safe-area offsets and the panel are unchanged. With scripting off the dead button is not rendered. `data-ask-launcher` marks the trigger for the evidence probe. |
| Media registry | `server/contracts/editorial-media.ts`, `content-packages/homepage/media.json` | Optional `disclosure` field; twelve assets split their combined caption into a disclosure and a description. `alt` text is unchanged and still carries the full sentence. |
| Tests | `tests/homepage-composition.test.tsx`, `tests/motion-runtime.test.ts`, `tests/preview-sentences.test.ts` | The duplicated "no finding has been reached" sentence is now asserted to appear once; new assertions for destination naming, one action per section after its records, and the disclosure line; the launcher's one-shot frame is registered with the motion policy; the sentence splitter is pinned on the "threw…" summary, on ranks, initials and U.S., and on keeping every word. |
| Evidence tooling | `scripts/homepage/verify-mobile.mjs`, `scripts/homepage/mobile-report.mjs`, `lib/homepage.ts`, `content-packages/homepage/local-records.json` | A phone-first capture and probe (occlusion by geometry, arrival distances, headline line counts, overflow, keyboard, no-JS, reduced motion); a table generator; and a development-only transcription of the three publication-backed records so the composition can be reviewed on a checkout with no database. |
| Records | `DESIGN.md`, `UX-CONTRACT.md`, `.ai/DECISIONS.md`, `.ai/STATE.md` | The design record, the contract additions, the why of the launcher, and the state entry. |

Also on the branch, separately committed: the two `frontend-design*`
project skills; a regenerated `package-lock.json` (the committed one no
longer satisfied `npm ci`: ajv, fast-uri, require-from-string and the esbuild
0.28.2 platform packages were missing); and a Prettier-only formatting of
`components/home/` so the design change lands as a readable diff.

## Routes and viewports tested

Route: `/` only, served by `next dev` at `http://localhost:3000` with the
checked-in local edition (`content-packages/homepage/local-edition.json`).
The three database-backed records (two news items, one narrative-watch
item) were rendered from `local-records.json`, a transcription of the same
published records; everything else came from the content packages.

Chromium (Playwright 1.56, Chromium 141) device emulation — device scale
factor, touch, coarse pointer and viewport meta — at 320×568, 375×667,
390×844, 430×932, and plain viewports at 768×1024 and 1440×900. Plus
390×844 with `prefers-reduced-motion: reduce`, and 390×844 with JavaScript
disabled. This is emulation, not a physical iPhone or Safari; WebKit is not
installed on this machine.

Every capture below is in `before/` and `after/`; the machine-readable
record is `results.json` in each. The baseline phone captures were taken at
device scale 3 and resampled to 2 so both sets share one scale.

## Before / after findings

Measured by `scripts/homepage/verify-mobile.mjs`; regenerate the tables with
`node scripts/homepage/mobile-report.mjs`. The 768 and 1440 rows are the
control: the phone rules stop at 767px, and those widths move only where the
section action was re-placed and, since the same-day correction, by the
shared type floors that apply at every width (captions, metadata, links and
the system section's pipeline a point larger), which is the one to eight per
cent their section heights show.

### Distance from the end of the cover to the first story

| Viewport | To the first image, before → after | To the first headline, before → after | Page height, before → after |
| --- | --- | --- | --- |
| w320 | 442px → 301px (-32%) | 787px → 653px (-17%) | 15514px → 11545px (-26%) |
| w375 | 442px → 301px (-32%) | 779px → 625px (-20%) | 15084px → 11157px (-26%) |
| iphone-390x844 | 443px → 302px (-32%) | 789px → 636px (-19%) | 15069px → 11377px (-25%) |
| iphone-430x932 | 447px → 306px (-32%) | 818px → 665px (-19%) | 14647px → 11193px (-24%) |
| w768 | 322px → 321px (0%) | 696px → 719px (3%) | 9629px → 9842px (2%) |
| w1440 | 377px → 375px (-1%) | 970px → 991px (2%) | 10482px → 10545px (1%) |

### Lead headlines: lines × size

| Viewport | News lead | Fake Resistance lead | October 7 lead | Our Heroes lead | Israel’s Story lead |
| --- | --- | --- | --- | --- | --- |
| w320 | 6L @ 31px → 4L @ 29px | 5L @ 29px → 4L @ 27px | 4L @ 32px → 4L @ 28px | 2L @ 39px → 3L @ 28px | 2L @ 33px → 1L @ 27px |
| w375 | 5L @ 32px → 4L @ 29px | 5L @ 29px → 3L @ 27px | 4L @ 32px → 3L @ 28px | 2L @ 39px → 2L @ 28px | 1L @ 33px → 1L @ 27px |
| iphone-390x844 | 5L @ 33px → 4L @ 30px | 4L @ 29px → 3L @ 28px | 4L @ 32px → 3L @ 29px | 2L @ 39px → 2L @ 29px | 1L @ 33px → 1L @ 28px |
| iphone-430x932 | 5L @ 36px → 4L @ 33px | 4L @ 32px → 3L @ 31px | 3L @ 32px → 3L @ 32px | 2L @ 39px → 2L @ 32px | 1L @ 33px → 1L @ 31px |
| w768 | 4L @ 32px → 4L @ 32px | 3L @ 29px → 3L @ 29px | 3L @ 30px → 3L @ 30px | 2L @ 34px → 2L @ 34px | 1L @ 29px → 1L @ 29px |
| w1440 | 3L @ 45px → 3L @ 45px | 3L @ 39px → 3L @ 39px | 3L @ 43px → 3L @ 43px | 1L @ 49px → 1L @ 49px | 1L @ 39px → 1L @ 39px |

### Section heights on the page, before → after

| Viewport | News | Fake Resistance | October 7 | Our Heroes | Israel’s Story | System |
| --- | --- | --- | --- | --- | --- | --- |
| w320 | 2456px → 1500px | 2762px → 1576px | 1744px → 1564px | 2136px → 1232px | 2074px → 1401px | 2441px → 2457px |
| w375 | 2313px → 1446px | 2553px → 1515px | 1750px → 1399px | 2174px → 1207px | 2015px → 1366px | 2364px → 2373px |
| iphone-390x844 | 2282px → 1460px | 2516px → 1501px | 1768px → 1413px | 2132px → 1217px | 1974px → 1377px | 2303px → 2383px |
| iphone-430x932 | 2237px → 1464px | 2569px → 1519px | 1677px → 1426px | 2143px → 1243px | 1958px → 1387px | 2129px → 2285px |
| w768 | 1259px → 1277px | 1626px → 1566px | 985px → 1036px | 1184px → 1227px | 1055px → 1097px | 1557px → 1679px |
| w1440 | 1475px → 1492px | 1752px → 1681px | 1309px → 1339px | 1449px → 1518px | 1226px → 1220px | 1663px → 1691px |

### The Ask launcher at seven reading positions (12%–97% of the page)

Each cell: shown and covering text, an image or a control (**over**), shown with nothing meaningful beneath it (clear), or retracted (—). The probe intersects the launcher's rectangle with every visible text line box, image and control. The first position is reached by an upward jump from the preceding section walk, so it also records the scroll-up reveal.

| Viewport | Before | After |
| --- | --- | --- |
| w320 | 12% **over**, 25% **over**, 40% **over**, 55% **over**, 70% **over**, 85% clear, 97% **over** | 12% **over**, 25% —, 40% —, 55% —, 70% —, 85% —, 97% — |
| w375 | 12% clear, 25% clear, 40% **over**, 55% **over**, 70% **over**, 85% **over**, 97% **over** | 12% **over**, 25% —, 40% —, 55% —, 70% —, 85% —, 97% — |
| iphone-390x844 | 12% clear, 25% **over**, 40% **over**, 55% **over**, 70% **over**, 85% **over**, 97% **over** | 12% **over**, 25% —, 40% —, 55% —, 70% —, 85% —, 97% — |
| iphone-430x932 | 12% clear, 25% **over**, 40% **over**, 55% clear, 70% **over**, 85% **over**, 97% clear | 12% **over**, 25% —, 40% —, 55% —, 70% —, 85% —, 97% — |
| w768 | 12% clear, 25% clear, 40% **over**, 55% **over**, 70% **over**, 85% **over**, 97% **over** | 12% clear, 25% —, 40% —, 55% —, 70% —, 85% —, 97% — |
| w1440 | 12% clear, 25% clear, 40% clear, 55% clear, 70% clear, 85% clear, 97% **over** | 12% clear, 25% clear, 40% clear, 55% clear, 70% clear, 85% clear, 97% **over** |

The 1440 row is unchanged by design: desktop keeps the fixed seal in the
edition's reserved gutter, and the one **over** is the footer's index under
it, which predates this pass.

### Checks that must hold at every width

| Viewport | Horizontal overflow | Page errors | Launcher reachable by keyboard and visible when focused |
| --- | --- | --- | --- |
| w320 | none | 0 | yes (67 tabs) |
| w375 | none | 0 | yes (67 tabs) |
| iphone-390x844 | none | 0 | yes (67 tabs) |
| iphone-430x932 | none | 0 | yes (67 tabs) |
| w768 | none | 0 | yes (68 tabs) |
| w1440 | none | 0 | yes (72 tabs) |

No JavaScript at 390×844: 10 records, 1 main landmark, 7 fallback navigation links; the launcher is not rendered. Reduced motion at 390×844: video not shown, poster only.

### What the captures show

- **Cover.** Same lion, wordmark and standfirst. "Read the latest" now reads
  as the one invitation; "Why this work matters" sits beneath it as a quiet
  sentence (`after/iphone-390x844-hero.png`).
- **Arrival.** The edition masthead is one line, a date and a three-by-two
  index; the first picture arrives about 300px after the cover on every
  phone instead of about 440px, and the first headline about 625–665px
  instead of about 780–820px (`after/iphone-390x844-after-hero.png`,
  `after/iphone-430x932-after-hero.png`).
- **News.** The lead keeps its picture, a four-line headline at 30px, a
  summary of whole sentences at 16px, an inline "Why it matters" likewise
  and a source line; the companion is a row — category, date, three-line
  headline, thumbnail, then its own disclosure and source
  (`after/iphone-390x844-news.png`, `after/iphone-390x844-full.png`).
- **Fake Resistance.** Titled as its destination; an open column that reads
  status → claim → source → action, the diagram the column's width with the
  "EDITORIAL DIAGRAM — NOT EVIDENCE" line first under it, and no panel or
  border around the record. The unresolved record no longer repeats "no
  finding has been reached" in a finding block. The research case follows
  under a rule without its illustration
  (`after/iphone-390x844-fakeResistance.png`).
- **October 7.** The archive sits on the page's ground — the paper page-turn
  was withdrawn by the owner's review — and keeps its head rule, its record
  kinds and its warnings; the testimony leads with its safe cover and a
  three-line title; the documentation record is a row beside its safe-cover
  thumbnail with the disclosure and content warning intact
  (`after/iphone-390x844-october7.png`, `after/iphone-390x844-launcher-40.png`).
- **Our Heroes.** Portrait-led: the face beside the role, name and unit, the
  story ending on a full stop; the second profile with a smaller portrait
  (`after/iphone-390x844-heroes.png`).
- **Israel's Story.** Era rule, plate, chapter; the second chapter as a row
  with a small plate (`after/iphone-390x844-israelsStory.png`).
- **Ask.** Retracted at every downward-scroll reading position on every
  phone and on the 768 tablet; present over the cover; back after an upward
  scroll and when focused by keyboard
  (`after/iphone-390x844-launcher-40.png`, `-launcher-after-scroll-up.png`,
  `-launcher-focus.png`). Desktop keeps the fixed seal in its reserved
  gutter (`after/w1440-news.png`).
- **Desktop.** Spreads unchanged; the section action now sits on one line
  beside the title, and the archive head rule runs the full width
  (`after/w1440-*.png`).

## Verification

- `npm run typecheck`: passed.
- `npm run lint`: 0 errors, 4 pre-existing warnings.
- `npm test` (112 files, two workers, re-run after the correction): 1083
  passed, 1 skipped. Two failures were this branch's and are fixed — the launcher's one-shot frame
  had to be registered in `tests/motion-runtime.test.ts`, and four new
  class names needed rules for `tests/css-module-contract.test.ts` — and
  both files pass now. Nine failures in four files reproduce on the untouched
  base commit `ae020b2` when its tree is run with the same dependencies, and
  were not changed: `tests/state-causes.test.ts` (2) and
  `tests/fake-resistance-watch.test.ts` (5) — the news and narrative hubs'
  error, empty and count states, whose components were last changed by the
  September 6 polish commit after the tests were last updated;
  `tests/site-navigation.test.ts` (1); `tests/briefing-runtime.test.ts` (1),
  the stale `briefing-quality` queue trigger already recorded in
  `.ai/STATE.md` on 2026-09-04.
- `npm run build`: passed (Node 22, Next 16.3.2), re-run after the
  correction.
- `npm run perf:report` against that build: the homepage JS budget was
  already exceeded before this pass — the previous report recorded 321.3 kB
  gzip against 310 kB as a follow-up — and reads 321.9 kB now, the launcher
  hook's few hundred bytes on top of the same bundle; the correction added
  no client JavaScript (the sentence split runs in the server components,
  the launcher change is CSS), so the figure is the same after it. The
  "worst public reading route" budget (283.4 kB) is the same route. The
  worst route's CSS sits exactly at its 64.3 kB budget after the correction,
  which is worth watching before the next stylesheet grows. Every other
  budget passes. Trimming the homepage bundle remains the open follow-up it
  was.
- `node scripts/homepage/verify-mobile.mjs after`: no horizontal overflow at
  any width, no page errors, the launcher reachable by Tab and visible when
  focused at every width, ten records and the fallback navigation with
  JavaScript off, the poster only under reduced motion.

## Acceptance criteria, as measured

1. No persistent homepage control covers meaningful content on a phone at a
   reading position: **met at every sampled downward-scroll position on
   320, 375, 390, 430 and 768.** The one exception is stated: after an
   upward scroll the 48px icon is present over the column until the next
   downward scroll.
2. A story preview is a preview: a summary and "Why it matters" show whole
   sentences within a budget (about four lines for a lead, three for a
   companion) and never end on a cut word; findings clamp at four lines;
   the News section is 36% shorter at 390 and the Fake Resistance section
   40% shorter, with the type a size up from the first cut.
3. Both items in a section are discoverable without interaction: both
   remain in the document and on screen, the companion as a row.
4. Summary, analysis and finding blocks do not repeat one idea: the
   unresolved record's finding block is gone; a documentation excerpt equal
   to its title is not printed twice.
5. Real News content arrives materially sooner: first image ~32% closer,
   first headline ~19% closer, at 390.
6. Fake Resistance is recognisable from the homepage: it is the section
   title, the index entry and the action label.
7. Image disclosures remain explicit and lead the caption, on one line at
   390 and above, without competing with the headline.
8. Long headlines: the daily-brief headline is four lines at 30px on 390
   (was five at 33px); no headline fills most of a viewport, and no headline
   is smaller than 24px on a phone.
9. Each content family keeps a distinguishable rhythm: open spread, the
   dossier's status line and finding rule, the archive's head rule and
   warnings, portrait rows, era plates, pipeline — on one shared ground.
10. No provenance, uncertainty, source disclosure or content-warning
    protection was weakened; `alt` text keeps every full sentence.
11. No new telemetry, urgency, evidence, media or freshness was introduced.
12. Typecheck, lint, tests and build: see Verification.

## Same-day correction after the owner's live review

The owner read the first deploy on an iPhone (Safari) and sent five
screenshots: headlines too small, type too small in several places, a
preview cut at "threw…" with its source line circled beneath it, and "the
colour change in the middle" — the October 7 paper page-turn — "unrelated"
to the page around it. What changed, all on the phone rules unless stated:

- **Type floors.** Body and summaries 16px (was 15), "Why it matters" and
  findings 15px (was 14), metadata, captions, credits, sources and status
  meanings 13px (was 11–12), kickers and disclosure labels 11px (was 10),
  the section action and record links 15px (was 12–13), the edition index
  14px at 44px targets. Lead headlines 29–36px (was 26–32), companions 24px
  (was 20–21), section titles 38–48px (was 32–44), the system section's
  pipeline and branches 14–16px (was 12–14). The hero thumbnail is 96px
  (was 88) and the companion portrait 112px (was 104).
- **Previews end on sentences.** A line clamp truncates by character, which
  is where "threw…" and "anti-Israe…" came from. `previewSentences()` splits
  a summary at sentence boundaries; the phone shows the first sentence and
  then whole sentences within a budget, and hides the rest. The clamps
  remain a line past what the budget needs at 320px, as backstops.
- **The archive shares the page's ground.** The paper page-turn is gone; the
  October 7 section keeps its head rule, its record kinds, its safe covers
  and its content warnings (the warning's rule is now the page's gold).
- **No box around a dossier on a phone.** The Fake Resistance panel's border,
  background and 16px inset are removed below 768px; the record is the same
  open column as every other, the companion under a rule. Desktop keeps the
  panel.
- **The launcher retracts further.** Its travel was the diameter plus 48px
  plus the safe-area inset; on iOS Safari with the toolbar collapsed the top
  of the icon stayed visible above the bottom edge in three of the five
  screenshots. The travel is now the diameter plus 144px plus the inset.
- **The source line has three lines before it clamps** (was two).

The tables and captures above were regenerated after the correction; the
baseline is unchanged.

## Remaining limitations

- Chromium emulation only. A physical iPhone / Safari pass, and enlarged
  dynamic type, remain the owner's to run. The correction above responds to
  the owner's Safari screenshots; the launcher's longer travel in particular
  is a fix for a behaviour Chromium emulation does not reproduce.
- A sentence-boundary preview is a character budget tuned for 320–430px; a
  single sentence longer than the budget still meets the line clamp's
  ellipsis, and an abbreviation the guard does not know ends a preview a
  sentence early.
- The three publication-backed records were rendered from the
  development-only transcription, not from Neon; wording lengths match the
  published records but the live edition may select different records.
- After an upward scroll the compact launcher is visible over the column
  until the reader scrolls down again; a corner control cannot be both
  reachable at rest and never over the column, and the brief's preferred
  compact-icon direction was chosen over a reserved column or a bottom bar
  (`.ai/DECISIONS.md`, 2026-09-06).
- The cover's own framing at 390 (no lion face) and at 768 (bisected face)
  is `UI-UPGRADE-TASK.md` findings 2 and 3 and was not part of this brief.
- The environment ran Node 22 while `package.json` pins Node 24; `next
  build` and the test suite run on both.
