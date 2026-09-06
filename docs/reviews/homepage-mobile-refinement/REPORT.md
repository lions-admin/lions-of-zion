# Homepage editorial journey — mobile refinement report

Updated: 2026-09-06 (Asia/Jerusalem). Implementation for owner review on
branch `claude/create-worktree-9wtvyy`. Nothing was pushed to `main` and
nothing was deployed.

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
| Layout and type | `components/home/homepage-journey.module.css` | The section grid; the phone's single-column reading of each spread with the companion as a thumbnail row; headline scales (lead 26–32px clamped at four lines, companions 20–21px at three, section titles 32–44px); summary / "Why it matters" / source clamps; the Fake Resistance dossier with its cover flush and the companion without an illustration; the disclosure line; the section link's arrow sized in the label's em. Desktop rules are preserved except the action's placement. |
| Cover | `app/page.tsx`, `app/home.module.css` | "Read the latest" is the one arrowed, ruled action (14px, weight 500); "Why this work matters" is a 13px low-ink sentence with no arrow and no rule; the cover ends 28px before the edition on a phone. |
| Ask launcher | `components/ask/AskDock.tsx`, `PublicAskDock.tsx`, `ask.module.css` | Homepage only, below 1100px: the seal over the cover, then a 48px icon that retracts after 24px of downward scroll and returns on 8px of upward scroll, at the end of the page, or on keyboard focus (`data-mode`, `data-retracted`). Focus order, accessible name, `aria-expanded`, safe-area offsets and the panel are unchanged. With scripting off the dead button is not rendered. `data-ask-launcher` marks the trigger for the evidence probe. |
| Media registry | `server/contracts/editorial-media.ts`, `content-packages/homepage/media.json` | Optional `disclosure` field; twelve assets split their combined caption into a disclosure and a description. `alt` text is unchanged and still carries the full sentence. |
| Tests | `tests/homepage-composition.test.tsx`, `tests/motion-runtime.test.ts` | The duplicated "no finding has been reached" sentence is now asserted to appear once; new assertions for destination naming, one action per section after its records, and the disclosure line; the launcher's one-shot frame is registered with the motion policy. |
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
control: the phone rules stop at 767px, and those widths are meant to move
only where the section action was re-placed.

### Distance from the end of the cover to the first story

| Viewport | To the first image, before → after | To the first headline, before → after | Page height, before → after |
| --- | --- | --- | --- |
| w320 | 442px → 280px (-37%) | 787px → 599px (-24%) | 15514px → 10467px (-33%) |
| w375 | 442px → 280px (-37%) | 779px → 595px (-24%) | 15084px → 10363px (-31%) |
| iphone-390x844 | 443px → 281px (-37%) | 789px → 605px (-23%) | 15069px → 10507px (-30%) |
| iphone-430x932 | 447px → 284px (-36%) | 818px → 634px (-23%) | 14647px → 10268px (-30%) |
| w768 | 322px → 318px (-1%) | 696px → 710px (2%) | 9629px → 9542px (-1%) |
| w1440 | 377px → 373px (-1%) | 970px → 983px (1%) | 10482px → 10447px (0%) |

### Lead headlines: lines × size

| Viewport | News lead | Fake Resistance lead | October 7 lead | Our Heroes lead | Israel’s Story lead |
| --- | --- | --- | --- | --- | --- |
| w320 | 6L @ 31px → 4L @ 26px | 5L @ 29px → 4L @ 23px | 4L @ 32px → 4L @ 25px | 2L @ 39px → 2L @ 24px | 2L @ 33px → 1L @ 23px |
| w375 | 5L @ 32px → 4L @ 26px | 5L @ 29px → 3L @ 23px | 4L @ 32px → 3L @ 25px | 2L @ 39px → 2L @ 25px | 1L @ 33px → 1L @ 23px |
| iphone-390x844 | 5L @ 33px → 4L @ 27px | 4L @ 29px → 3L @ 24px | 4L @ 32px → 3L @ 26px | 2L @ 39px → 2L @ 26px | 1L @ 33px → 1L @ 24px |
| iphone-430x932 | 5L @ 36px → 4L @ 30px | 4L @ 32px → 3L @ 27px | 3L @ 32px → 3L @ 28px | 2L @ 39px → 2L @ 28px | 1L @ 33px → 1L @ 27px |
| w768 | 4L @ 32px → 4L @ 32px | 3L @ 29px → 3L @ 29px | 3L @ 30px → 3L @ 30px | 2L @ 34px → 2L @ 34px | 1L @ 29px → 1L @ 29px |
| w1440 | 3L @ 45px → 3L @ 45px | 3L @ 39px → 3L @ 39px | 3L @ 43px → 3L @ 43px | 1L @ 49px → 1L @ 49px | 1L @ 39px → 1L @ 39px |

### Section heights on the page, before → after

| Viewport | News | Fake Resistance | October 7 | Our Heroes | Israel’s Story | System |
| --- | --- | --- | --- | --- | --- | --- |
| w320 | 2456px → 1328px | 2762px → 1460px | 1744px → 1368px | 2136px → 1037px | 2074px → 1216px | 2441px → 2257px |
| w375 | 2313px → 1290px | 2553px → 1389px | 1750px → 1307px | 2174px → 1067px | 2015px → 1250px | 2364px → 2225px |
| iphone-390x844 | 2282px → 1304px | 2516px → 1401px | 1768px → 1314px | 2132px → 1076px | 1974px → 1229px | 2303px → 2170px |
| iphone-430x932 | 2237px → 1321px | 2569px → 1418px | 1677px → 1332px | 2143px → 1085px | 1958px → 1244px | 2129px → 2013px |
| w768 | 1259px → 1260px | 1626px → 1497px | 985px → 1003px | 1184px → 1214px | 1055px → 1053px | 1557px → 1557px |
| w1440 | 1475px → 1476px | 1752px → 1663px | 1309px → 1327px | 1449px → 1507px | 1226px → 1209px | 1663px → 1663px |

### The Ask launcher at seven reading positions (12%–97% of the page)

Each cell: shown and covering text, an image or a control (**over**), shown with nothing meaningful beneath it (clear), or retracted (—). The probe intersects the launcher's rectangle with every visible text line box, image and control. The first position is reached by an upward jump from the preceding section walk, so it also records the scroll-up reveal.

| Viewport | Before | After |
| --- | --- | --- |
| w320 | 12% **over**, 25% **over**, 40% **over**, 55% **over**, 70% **over**, 85% clear, 97% **over** | 12% **over**, 25% —, 40% —, 55% —, 70% —, 85% —, 97% — |
| w375 | 12% clear, 25% clear, 40% **over**, 55% **over**, 70% **over**, 85% **over**, 97% **over** | 12% **over**, 25% —, 40% —, 55% —, 70% —, 85% —, 97% — |
| iphone-390x844 | 12% clear, 25% **over**, 40% **over**, 55% **over**, 70% **over**, 85% **over**, 97% **over** | 12% **over**, 25% —, 40% —, 55% —, 70% —, 85% —, 97% — |
| iphone-430x932 | 12% clear, 25% **over**, 40% **over**, 55% clear, 70% **over**, 85% **over**, 97% clear | 12% clear, 25% —, 40% —, 55% —, 70% —, 85% —, 97% — |
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
  index; the first picture arrives about 280px after the cover on every
  phone instead of about 440px, and the first headline about 600px instead
  of about 790px (`after/iphone-390x844-after-hero.png`,
  `after/iphone-430x932-after-hero.png`).
- **News.** The lead keeps its picture, a four-line headline at 27px, a
  three-line summary, an inline three-line "Why it matters" and a compact
  source line; the companion is a row — category, date, three-line headline,
  thumbnail, then its own disclosure and source (`after/iphone-390x844-news.png`,
  `after/iphone-390x844-full.png`).
- **Fake Resistance.** Titled as its destination; a dossier that reads
  status → claim → source → action, with the diagram flush on the panel and
  the "EDITORIAL DIAGRAM — NOT EVIDENCE" line first under it. The unresolved
  record no longer repeats "no finding has been reached" in a finding block.
  The research case is the compact second dossier without its illustration
  (`after/iphone-390x844-fakeResistance.png`).
- **October 7.** The paper page-turn is preserved; the testimony leads with
  its safe cover and a three-line title; the documentation record is a row
  beside its safe-cover thumbnail with the disclosure and content warning
  intact (`after/iphone-390x844-october7.png`, `after/iphone-390x844-launcher-40.png`).
- **Our Heroes.** Portrait-led: the face beside the role, name and unit; the
  second profile with a smaller portrait (`after/iphone-390x844-heroes.png`).
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
- `npm test` (111 files, two workers): 1074 passed, 1 skipped. Two
  failures were this branch's and are fixed — the launcher's one-shot frame
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
- `npm run build`: passed (Node 22, Next 16.3.2).
- `npm run perf:report` against that build: the homepage JS budget was
  already exceeded before this pass — the previous report recorded 321.3 kB
  gzip against 310 kB as a follow-up — and reads 321.9 kB now, the launcher
  hook's few hundred bytes on top of the same bundle. The "worst public
  reading route" budget (283.4 kB) is the same route. Every other budget
  passes. Trimming the homepage bundle remains the open follow-up it was.
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
2. A story preview is a preview: summaries clamp at three lines, "Why it
   matters" at three, findings at four; the News section is 43% shorter at
   390 and the Fake Resistance section 44% shorter.
3. Both items in a section are discoverable without interaction: both
   remain in the document and on screen, the companion as a row.
4. Summary, analysis and finding blocks do not repeat one idea: the
   unresolved record's finding block is gone; a documentation excerpt equal
   to its title is not printed twice.
5. Real News content arrives materially sooner: first image ~36% closer,
   first headline ~23% closer, at 390.
6. Fake Resistance is recognisable from the homepage: it is the section
   title, the index entry and the action label.
7. Image disclosures remain explicit and lead the caption, on one line at
   390 and above, without competing with the headline.
8. Long headlines: the daily-brief headline is four lines at 27px on 390
   (was five at 33px); no headline fills most of a viewport.
9. Each content family keeps a distinguishable rhythm: open spread, dossier,
   paper archive, portrait rows, era plates, pipeline.
10. No provenance, uncertainty, source disclosure or content-warning
    protection was weakened; `alt` text keeps every full sentence.
11. No new telemetry, urgency, evidence, media or freshness was introduced.
12. Typecheck, lint, tests and build: see Verification.

## Remaining limitations

- Chromium emulation only. A physical iPhone / Safari pass, and enlarged
  dynamic type, remain the owner's to run.
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
