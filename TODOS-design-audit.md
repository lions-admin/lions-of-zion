# Design audit — task list

Generated from [`docs/design-audit-2026-08-26.md`](docs/design-audit-2026-08-26.md),
which carries the full problem statement, the measured evidence and the
tradeoffs for every id below. This file is the actionable form of that
report and nothing more — it adds no finding the report does not make.

`TODOS.md` is the Hebrew delivery plan and is untouched by this file. The two
do not overlap: that one tracks features to build, this one tracks defects to
close.

**75 tasks — 12 high, 37 medium, 26 low.** 84 findings were filed, 3 were
refuted in verification and 6 were merged as the same defect seen twice. Seven
were filed critical and none survived at that level: nothing here stops a
visitor from reading, navigating or trusting a page.

---

## Before you land any of it

- [x] ~~`npm ci` fails on nested `@esbuild/*` packages missing from
      `package-lock.json`.~~ Fixed on this branch: vitest's nested esbuild
      0.28.2 had no entries for its 26 optional platform binaries.
      Recomputed additively — 27 packages added, 0 removed, 0 version
      changes. `npm ci` now succeeds from a clean checkout.
- [x] ~~`npm run typecheck` fails on a fresh clone with 10 `TS2307` errors on
      `.svg` and `.png` imports.~~ Fixed on this branch: `next-env.d.ts` is
      gitignored and imports two files under `.next/types/`, so the image
      module declarations only existed after a build had run. `typecheck` is
      now `next typegen && tsc --noEmit` and is self-sufficient.
- [x] Run `npm run typecheck`, `npm run lint` and `npm test` before every push.
      **Honoured on every commit of the 2026-08-26/27 closure effort** — each
      commit message records the gate's result. Stands as practice.
      A `PostToolUse` hook re-checks the intro timeline invariants and runs
      `tsc --noEmit` after each edit, so a broken timeline surfaces early.
- [x] **Every task under "Home experience" needs the macOS workstation.** Four
      verification scripts hardcode the real-Chrome path and cannot run in a
      Linux container; headless Chromium falls back to SwiftShader, which the
      GPU probe correctly rejects, so the scene never mounts. No home-scene
      change is verified until `npm run verify:graphics`,
      `node scripts/final-verify.mjs` and
      `node .claude/skills/verify-intro/capture.mjs` have been run there.
      **Honoured: every home-scene change in the closure effort was verified
      with `verify:graphics` on this workstation — 7/7 viewports, repeatedly.**
- [x] Read the finding in the report before acting on the one-line **Do:**
      below it. Several recommendations explicitly rule out the obvious fix,
      and the report says why.
      **Honoured throughout — three filed fixes were correctly *not* applied
      because the full finding ruled them out, and each closure entry above
      records where it went against what was filed.**

---

## Wave 1 — the ranked queue

Ranked by reader impact × confidence, divided by effort, not by severity
alone. The first nine are one file each. These fifteen are not repeated in
the by-surface list below.

- [x] **1.** `archive-brief-provenance-renders-at-body-size-not-at-the-data-floor`
      Provenance footer computes 17px full-ink mono instead of the declared 11.5px `--ink-lo`
      **Do:** One edit: `archive.module.css:349` → `.provenance p { margin: 0 0 0.35rem; font-size: var(--t-data); line-height: var(--t-data-lh); color: var(--ink-lo); }`, plus `overflow-wrap: anywhere` on `.provenance a` so a long slug breaks rather than laddering. …
      `components/archive/archive.module.css:338-355`, `components/sections/sections.module.css:376-388`, `components/archive/ArchiveRecord.tsx:103-116`
      `high` · `typography` · `trivial effort`

- [x] **2.** `cross-cutting-three-webgpu-on-every-route`
      the WebGPU renderer ships to all ~1,190 routes
      **Do:** Change `ParticleChatLauncher.tsx:6` to `const ChatParticleCanvas = dynamic(() => import('./ChatParticleCanvas'), { ssr: false });`. …
      `app/layout.tsx:3`, `app/layout.tsx:70-78`, `components/chat/ParticleChatLauncher.tsx:6`, `components/chat/ChatParticleCanvas.tsx:2-28`, `components/particle-nav/CanvasMount.tsx:30`
      `high` · `performance-perceived` · `trivial effort`

- [x] **3.** `archive-brief-testimony-opens-with-the-source-sites-breadcrumb`
      367 testimonies open their body with october7.org's nav breadcrumb, set as prose
      **Do:** In `ArchiveBlocks`' `paragraph` case, skip the block at index 0 when it is breadcrumb-shaped, render-time only, stored record unchanged. …
      `components/archive/ArchiveBlocks.tsx:58-59`, `components/archive/archive.module.css:27-32`, `lib/content/archive.ts:214-227`
      `high` · `content-design` · `small effort`

- [x] **4.** `archive-brief-documentation-record-says-one-sentence-three-times`
      All 670 documentation pages print the title as h1 then again as h2; 336 also as the body paragraph
      **Do:** Split it. **(1)** In `ArchiveBlocks.tsx`, pass the rendered title down from `ArchiveRecordPage`/`ArchiveRecord` and skip a *leading* `heading` block whose normalised text equals it. …
      `components/archive/ArchiveBlocks.tsx:54-59`, `components/archive/ArchiveRecordPage.tsx:55`, `components/archive/archive.module.css:13-21`, `components/archive/archive.module.css:27-32`
      `high` · `hierarchy` · `small effort`

- [x] **5.** `archive-lang-declared-english`
      661 non-English pages render inside `lang="en"`
      **Do:** Target the parts, not the `<main>`. The filed "put `lang` on the `<main>`" fix would create a new 3.1.2 failure, because `DocPage`'s `<main>` also contains untranslated English chrome: the skip link, the "Lions of Zion" wordmark, "← Back to the scan", the …
      `app/layout.tsx:67`, `components/archive/ArchiveRecordPage.tsx:55-72`, `components/archive/ArchiveRecord.tsx:79-98`, `components/sections/DocPage.tsx:34`, `lib/content/archive.ts:35-40`
      `high` · `accessibility` · `small effort`

- [x] **6.** `archive-brief-mobile-index-rail-pins-351px-of-metadata-over-the-brief`
      351px of sticky evidence-contract chrome over a 760px phone viewport
      **Do:** Scope the fix to ≤719px, **not** the 900px block: between 720 and 900px `.indexRailInner` is `position: static` and `.indexRail` is not sticky, so the evidence contract there is ordinary flow content doing no harm, and adding `.evidenceContract { display: …
      `components/briefs/geopolitical-brief.module.css:798-806`, `components/briefs/geopolitical-brief.module.css:712-714`, `components/briefs/geopolitical-brief.module.css:755-758`, `components/briefs/GeopoliticalBrief.tsx:101-117`
      `high` · `responsive` · `small effort`

- [x] **7.** `section-pages-war-update-renders-every-source-twice`
      18 source links for 8 sources
      **Do:** Delete `app/war-update/page.tsx:72-74` only. Leave `edition.sources` in `lib/content/war-update.ts`, as Israel's Story left its `chapter.sources`, since `sourceCount` still reads from it for the `PublicationMeta` row that preserves the count. …
      `app/war-update/page.tsx:72-74`, `app/war-update/WireFeed.tsx:124-125`, `app/israels-story/page.tsx:105-111`
      `medium` · `information-density` · `trivial effort`

- [x] **8.** `section-pages-israels-story-two-contents-lists`
      two chapter lists on one screen, disagreeing on the count
      **Do:** Add `@media (min-width: 1220px) { .contents { display: none; } }` to `app/israels-story/page.module.css`. Do **not** simply delete the block: the rail is client-side only and `display: none` below 1220px, so deleting it leaves mobile and no-JS readers with no …
      `app/israels-story/page.tsx:63-77`, `app/israels-story/page.module.css:11-72`, `components/sections/SectionToc.tsx:49-62`, `components/sections/SectionPage.tsx:148-150`
      `medium` · `composition` · `trivial effort`

- [x] **9.** `cross-cutting-progress-bar-claims-fully-read`
      the resting state is 100%
      **Do:** Add `transform: scaleX(0);` to all four rules (`sections.module.css:593` and `:611`, `reading-progress.module.css:12`, `geopolitical-brief.module.css:178`). …
      `components/sections/ReadingProgress.tsx:50-54`, `components/sections/sections.module.css:593-601`, `components/sections/sections.module.css:611-618`, `components/sections/reading-progress.module.css:12-20`, `components/briefs/geopolitical-brief.module.css:178`
      `medium` · `interaction` · `trivial effort`

- [x] **10.** `cross-cutting-four-sub-aa-text-pairs`
      four pairs below 4.5:1, one of them a UA default
      **Do:** `.timestamp` → `var(--ink-lo)` (6.32:1 on the panel). Both placeholders → `var(--ink-lo)` as well (6.36:1 on the support field); add `.field input::placeholder, .field textarea::placeholder { color: var(--ink-lo); …
      `components/chat/ask-the-lion-chat.module.css:183-187`, `components/chat/ask-the-lion-chat.module.css:530`, `components/support/support.module.css:27-38`, `components/home/home.module.css:433-441`, `app/globals.css:64-72`, `app/not-found.module.css:101`, `app/not-found.module.css:137`
      `medium` · `accessibility` · `trivial effort`

- [x] **11.** `archive-brief-record-pages-have-no-route-back-into-the-archive`
      No link to index, category, hub or neighbour on any record or index page
      **Do:** Give `DocPage` an optional `breadcrumb?: {href,label}[]` prop rendered in the identity band beside the route at `--t-data`, and have `ArchiveRecordPage` pass `[{'/october-7', 'October 7'}, {index path, 'Testimonies'|'Documentation'}]`. …
      `components/sections/DocPage.tsx:40-51`, `components/sections/DocPage.tsx:61-62`, `components/archive/ArchiveRecord.tsx:103-116`
      `high` · `layout` · `small effort`

- [x] **12.** `archive-brief-october7-videos-reserve-no-layout-height`
      74 videos ship no dimensions; each `<video>` lays out at 300×150 then jumps
      **Do:** Fall back to the poster's dimensions, which the package already holds and a test already guarantees: `width={item.width ?? poster?.width ?? undefined}` and the same for height. That reserves the correct box at first layout for all 74 clips. …
      `components/archive/ArchiveBlocks.tsx:179-189`, `components/archive/archive.module.css:63-79`
      `medium` · `performance-perceived` · `trivial effort`

- [x] **13.** `reading-system-focus-within-makes-the-quietest-page-louder`
      `:focus-within` outranks `.registerMuted`
      **Do:** The minimal, no-side-effect fix is to demote the focus rule: move it above `.surfaceQuiet .row` and write it `:where(.page:focus-within) .row { --register: 0.6; animation-duration: calc(var(--dur) * 2); …
      `components/sections/sections.module.css:159-172`, `components/sections/sections.module.css:200-211`, `components/sections/sections.module.css:213-217`
      `medium` · `motion` · `trivial effort`

- [x] **14.** `section-pages-methodology-contains-no-methodology`
      the credibility document states no sourcing standard
      **Do:** Add the three sections the site's own copy implies: what counts as a source and how sources rank; when and how a source is archived; …
      `app/methodology/page.tsx:36-81`, `app/corrections/page.tsx:40-50`, `app/war-update/page.tsx:54-57`, `app/we-are/page.tsx:29-78`
      `high` · `content-design` · `medium effort`
      **Done, 2026-08-27.** Added "What counts as a source" (three tiers, the
      fetched-in-session rule, the covers-the-sentence rule, and an honest
      note about Israel's Story), "Archiving" (worded to what the repo
      actually does — snapshots on the Fake Resistance case files, not
      everywhere), a per-label evidence table wording the nine
      `ASSESSMENT_PRESENTATION` explanations plus the three confidence
      levels, and "From source to published" carrying the pipeline as prose
      linking to `/we-are`, which keeps its diagram. The duplicated
      Corrections paragraph is cut to one sentence, breaking the closed loop
      between the two pages. `/corrections`' "Full sourcing standards are on
      the Methodology page" is now true and was left alone. Census
      correction: the filed "~228 body words" no longer holds — the
      influence-network research section landed after the audit and the page
      was ~500 words before this change. The gap it names was still real.

- [x] **15.** `section-pages-wikipedia-in-the-evidence-margin`
      7 of 8 sources are Wikipedia, printed as the evidence
      **Do:** Two constraints. This reverses a documented decision — `.ai/DECISIONS.md`, 2026-08-25, "Israel's Story ships two chapters, not 'the long arc'", explicitly accepted Wikipedia as the sourcing basis ("each built from a fetched primary source (Wikipedia, itself …
      `lib/content/israels-story.ts:28-82`, `lib/content/war-update.ts:66-71`, `components/content/content.module.css:694-700`, `app/israels-story/page.tsx:117-127`
      `high` · `content-design` · `medium effort`
      **Owner decision, 2026-08-27.** Census reproduces: `kind: 'Wikipedia'`
      on 7 of 8 Source constants, 22 of 23 entry `sources` arrays. Two parts
      were done without reversing anything: `/methodology` now states the
      three source tiers, says a citation must cover the sentence it sits
      beside and not merely the subject, and names Israel's Story as the
      edition currently below that standard. The rest is blocked. Swapping
      Wikipedia for primary documents reverses `.ai/DECISIONS.md` 2026-08-25
      and needs a new DECISIONS entry; and every replacement URL — including
      the mis-citation at `israels-story.ts:97`, where the "Israeli
      Declaration of Independence" article is cited for UNGA Resolution
      181(II) — must be fetched and checked in the session that swaps it.
      This session was run offline and the repo holds no verified substitute,
      so nothing was pasted from memory. **The mis-citation is the one piece
      that needs no reversal and should be done first, online.**

      **Left open deliberately, 2026-08-27 — what remains is the owner's
      call, not a defect.** Every non-reversing part is now done. The
      mis-citations are gone: the founding chapter's four entries carry UN
      Digital Library records for 181(II), the Mandate text and the Arab
      League cablegram of 15 May 1948, and `WIKI_DECLARATION` stays only on
      the entry it covers. `war-update.ts` gained the Security Council's own
      record of resolution 2803 (`press.un.org` SC/16225, 17 Nov 2025, vote
      and text verified) **beside** the encyclopedia entry rather than in
      place of it, so the vote this page prints now rests on the document
      that produced it without displacing the accepted basis. The remaining
      six Wikipedia constants on Israel's Story each cover their own subject
      and are not mis-citations; replacing them is the reversal, and it needs
      a new `.ai/DECISIONS.md` entry from the owner before any code changes.
      The report's second step — populating `accessedAt` — was attempted and
      **not** shipped: all nine live Wikipedia URLs were fetched and
      title-checked on 2026-08-27, but the Internet Archive returned 503 and
      then timed out for every snapshot, so no `archiveUrl` could be
      verified. The report's own case is for a *dated and archived* secondary
      source; the date alone would have printed one identical "Accessed …"
      line under 22 of 23 entries, reintroducing on Israel's Story exactly
      the repeating ornament that
      `section-pages-margin-citation-repeats-into-wallpaper` had just cleared.
      Redo both halves together when archive.org is up.

---

## Wave 2 — the rest, by surface

Sixty tasks. Within each surface, severity first and cheapest first, so a
session can take the top of a section and stop anywhere.

### Home experience — intro, particle navigation, front-page band

15 tasks here.

#### High — 1

- [x] `home-scene-mobile-intro-runs-nine-seconds-longer`
      the intro is 47.3s on a phone and 38.6s on desktop
      **Do:** Make the cadence per *beat*, not per line, so the twelve sentences take the same wall-clock time on both layouts and a two-line break costs presentation rather than duration: a beat-relative schedule in `getEntryStart` with `ROLLING_BEAT_CADENCE ≈ 2.2s` and …
      `components/intro/rolling-story-timeline.ts:11`, `components/intro/rolling-story-timeline.ts:90-125`, `components/intro/story-timeline.ts:33-118`
      `high` · `motion` · `medium effort`
      **Closed at 9.7%, and the remaining 3.75s is deliberate.** The earlier
      pass shipped the per-layout cadence (mobile 1.25 → 1.0s: 42.33s against
      desktop's unchanged 38.58s, the gap down from 22.7%) and stopped, filing
      the rest as needing a wider pool, a row rule past the window, or a
      shorter dissolve. Re-examined against the solved timeline, all three are
      the wrong trade and the gap should stay.
      Every one of them buys wall clock by taking reading time off the phone,
      and the phone has less to give. The rolling window is four *lines* wide,
      so it holds ~3.4 desktop sentences and ~2.3 mobile ones; a sentence
      broken across two lines is whole on screen only for
      `3 × cadence − ROLLING_ENTER_DURATION`. Measured: a typical desktop
      sentence is whole for **4.20s**, a typical mobile one for **2.20s**.
      Equalising the totals (mobile at 0.8125s, not the filed 0.78 — 16.25s
      over 20 gaps) takes mobile to **1.64s**, 39% of desktop's. The phone
      would finish sooner having been given less time to read. 1.0s is the
      floor, not a stopping point: it is exactly `ROLLING_EXIT_DURATION`, the
      fastest cadence at which one line finishes dissolving before the next
      needs its row.
      Everything the previous pass asserted reproduces: at 0.8125s the mobile
      timeline hits 6 concurrent lines against a pool of 5, double-claims a
      slot through 7.8% of the intro, and puts two dissolving clouds in row 0.
      The filed `≈2.2s` beat cadence still computes to 46.53s, worse than the
      status quo.
      What changed is that none of this is an assertion any more. The audit's
      real finding — "nothing asserts intro duration in `tests/`" — is fixed:
      `tests/particle-nav-layout.test.ts` now holds the cadence at or above the
      dissolve, checks slot and row uniqueness at 60Hz across both layouts, and
      caps mobile's total at 10% of desktop's;
      `.claude/hooks/check-story-timeline.mjs` blocks on the same two, on the
      file where a line array actually grows. A 22nd mobile line now fails
      loudly instead of quietly costing another second.
      **No real-Chrome capture needed** — no rendered value changed, only
      comments, tests and the hook.

#### Medium — 6

- [x] `home-scene-orbit-labels-below-legibility-floor`
      the eight orbit labels render at 9.28–10.35px
      **Do:** File the in-place fix, not a face swap: raise the desktop half — `clamp(0.72rem, 1.4vmin, 0.95rem)` with `letter-spacing: 0.08em` at all widths — which clears the floor and the tracking cap without touching Cinzel, `CLAUDE.md`'s uppercase-as-identity rule, or …
      `components/particle-nav/styles.module.css:390-411`, `components/particle-nav/styles.module.css:485-491`, `app/globals.css:48-52`, `.ai/DESIGN-V2.md:181-186`
      `medium` · `typography` · `small effort`
      **Needs a real-Chrome capture** at the seven `verify-composition.mjs`
      viewports: whether 11.5–12.6px tracked caps push "GEOPOLITICAL BRIEF" to a
      third line is not settled from source. The phone tier keeps its size, as
      filed — that half is the DESIGN-V2 Phase 5 face decision.

- [x] `home-scene-first-screen-names-only-threats`
      the scan's fixed glyph layer is 100% hostile labels
      **Do:** Swap two or three of the ten hostile labels for verdict labels in the same gold ramp — "SOURCE CONFIRMED", "CROSS-CHECKED", "CORRECTION LOGGED" — placed on the opposite diagonal. …
      `components/particle-nav/layers/NetworkScan.tsx:54-88`, `components/particle-nav/HomeSignalLayer.tsx:24-28`, `app/opengraph-image.tsx:68-78`, `lib/content/war-update.ts:171-172`
      `medium` · `content-design` · `medium effort`

- [x] `home-scene-intro-typeface-is-gentilis-and-brand-is-one-word`
      the brand climax spells "LIONSOFZION"
      **Do:** Split into two items. **Ship now (trivial):** change `IntroText.tsx:122` to `['LIONS OF ZION']`. Verified safe — glyph advances sum to 8.456em vs 7.844em, so at `brandFontScale` 0.38 the cloud goes 2.98→3.21 world units against a desktop `lineMaxWidth` of at …
      `components/particle-nav/layers/IntroText.tsx:88-91`, `components/particle-nav/layers/IntroText.tsx:122-130`, `components/particle-nav/styles.module.css:456-465`, `app/layout.tsx:13-19`
      `medium` · `typography` · `medium effort`
      Ship-now half only, as filed. Replacing Gentilis with a baked Cinzel or
      Newsreader typeface JSON stays open — it needs a lowercase + `7` subset,
      `tests/intro-text-cloud.test.ts` repointed, and a capture.

- [x] `home-scene-mobile-fold-has-no-scroll-affordance`
      the front page has no visible cue on a phone
      **Do:** Add a phone-only cue *inside* the scene box, above the chat dock, on the free `.desktopOrientation` layer (`display: none` below 719px) — a gold chevron plus "The front page" at `--t-data` linking to `#home-masthead`. …
      `components/home/home.module.css:222-226`, `components/home/home.module.css:35-38`, `app/globals.css:195-201`, `components/particle-nav/styles.module.css:493-515`
      `medium` · `interaction` · `medium effort`
      **Needs a real-Chrome capture:** the cue sits in the ~24px between the
      bottom node's halo and the chat dock at 390×844. The `app/globals.css`
      comment that still claims the affordance exists everywhere was left alone —
      shared file, another agent's surface.

- [x] `home-scene-orbit-order-contradicts-the-band-taxonomy`
      nothing orders the orbit, and a comment says otherwise
      **Do:** Minimum viable: correct the false comment at `HomeFrontPage.tsx:154-156`, and move `support-us` out of index 1 so the ask is not second in tab order. …
      `components/particle-nav/config.ts:75-148`, `components/particle-nav/config.ts:151-153`, `components/home/HomeFrontPage.tsx:40-44`, `components/home/HomeFrontPage.tsx:154-186`
      `medium` · `hierarchy` · `medium effort`
      `we-are` ↔ `support-us` swapped, so identity is second in tab order and the
      ask is last; `tests/particle-nav-layout.test.ts` updated with it. Two file
      numbers move (02 ↔ 08) and are derived everywhere they render.

- [x] `home-scene-poster-tier-has-no-navigation`
      the fallback poster draws nothing at the eight node positions
      **Do:** Do **not** draw node rings and icons at `NODE_CENTRES` as originally filed — they will misregister. The poster's spokes sit at 0.36W/0.40H of a 1600 square, while `NavLinks` places links at 36%/40% of the safe-inset viewport box; …
      `scripts/particle-nav/make-poster.ts:35-43`, `scripts/particle-nav/make-poster.ts:88-104`, `components/particle-nav/ParticleNav.tsx:31-35`, `components/particle-nav/styles.module.css:142-155`
      `medium` · `composition` · `medium effort`
      CSS half only — the fix that registers by construction. The 16:10/portrait
      crops and the `dottedRing` opacity were left: both need `poster:nav` re-run,
      and a re-bake resamples the Arial `INTEL_LABELS` on whatever machine runs it.

#### Low — 8

- [x] `home-scene-hover-card-chrome-outranks-its-sentence`
      the card's meta row is 9.28px and spends both accents on chrome
      **Do:** Two real fixes, no inversion. Raise `.cardMeta` to `--t-data` (0.72rem) with `--t-data-tracking` (0.08em), and delete `.cardRoute` — it duplicates the href the browser already shows on hover and is aria-hidden anyway. …
      `components/particle-nav/styles.module.css:278-309`, `components/particle-nav/styles.module.css:253-276`, `components/particle-nav/NavLinks.tsx:46-56`
      `low` · `hierarchy` · `trivial effort`

- [x] `home-scene-metadata-describes-the-animation-not-the-desk`
      the root description describes the intro
      **Do:** Share one product description between `layout.tsx` (base + openGraph + twitter) and `manifest.ts` via a `SITE_DESCRIPTION` export in `lib/site-config.ts`, which already holds `SITE_URL` and is already imported by both consumers. …
      `app/layout.tsx:41-57`, `app/manifest.ts:3-11`, `app/opengraph-image.tsx:77`, `lib/content/war-update.ts:171-172`
      `low` · `content-design` · `trivial effort`
      `SITE_DESCRIPTION` added to `lib/site-config.ts`; the OG card's own line is
      deliberately not shared with it.

- [x] `home-scene-scan-breakpoint-disagrees-with-every-other-layer`
      `NetworkScan` hardcodes 620 where everything else uses 720
      **Do:** Do not blind-swap 620→720: that visibly drops four labels and two platform glyphs across the whole 620–719 band and is a composition change requiring a real-Chrome capture. …
      `components/particle-nav/layers/NetworkScan.tsx:476-481`, `components/particle-nav/config.ts:216-217`, `components/intro/introLayout.ts:86-88`, `components/particle-nav/styles.module.css:493-515`
      `low` · `responsive` · `trivial effort`

- [x] `home-scene-stylesheet-ignores-the-token-palette`
      the scene consumes no palette token and carries three off-scale colours
      **Do:** Not a find-and-replace. (a) Safe now: `#b6c4d6` (305) → `var(--ink)`. (b) `#a7b8ca` (469) and `#e7c979` (458) are visible changes to the wordmark block; …
      `components/particle-nav/styles.module.css:456-472`, `components/particle-nav/styles.module.css:303-309`, `app/globals.css:54-76`
      `low` · `colour` · `trivial effort`
      `#b6c4d6` → `var(--ink)`; the two wordmark colours are now `--scene-*` on
      `.root`. The locked `#c9a24b`/`#efd79a` stay literal, as filed.

- [x] `home-scene-idle-motion-dials-are-all-zero`
      three sim dials ship at 0 under comments describing motion
      **Do:** The zero-risk half needs no visual sign-off: correct or delete the four comments that assert motion. If idle rotation is restored, note that `Scene.tsx:226` rotates the whole rig and `activeAngle` at 238 reads `rig.rotation.z`, so a nonzero value also drifts …
      `components/particle-nav/config.ts:13-39`, `components/particle-nav/layers/OrbitalRings.tsx:2`, `components/particle-nav/layers/OrbitalRings.tsx:41-43`, `components/particle-nav/tsl/lionCompute.ts:153-155`
      `low` · `motion` · `small effort`
      Comments only. Whether to restore `curlAmp`, `repelStrength` and
      `idleRotateDegPerSec` is an owner decision — idle rotation also drifts the
      activate-dolly direction and the projected label geometry.

- [x] `home-scene-masthead-repeats-the-wordmark-verbatim`
      the band's kicker restates the scene's, one screen apart
      **Do:** Drop `.brandKicker` from `HomeSignalLayer` so the scene reads wordmark + "Truth has a signal.", and let the band own the framing. Keep the masthead's `<h1>`, rule and lede — `.ai/DECISIONS.md` records the `<h1>` as the home route's only one. …
      `components/particle-nav/HomeSignalLayer.tsx:24-28`, `components/home/HomeFrontPage.tsx:90-95`, `components/home/home.module.css:249-288`
      `low` · `composition` · `small effort`

- [x] `home-scene-scan-labels-are-arial`
      the scene's canvas text names system faces directly
      **Do:** Do not ship this as a drive-by. `.ai/DESIGN-V2.md:154-161, 313` makes the home scene's typographic voice an explicit open question for the user (Phase 5), so raise it as a decision. …
      `components/particle-nav/layers/NetworkScan.tsx:240`, `components/particle-nav/layers/NetworkScan.tsx:242`, `components/particle-nav/layers/NetworkScan.tsx:404-412`, `scripts/particle-nav/make-poster.ts:98`
      `low` · `typography` · `small effort`
      **Closed: the safe half shipped, the face is an owner decision.** The two
      literals are one named `SANS_STACK`, value unchanged, with the reasoning
      written into `NetworkScan.tsx` above it. Everything left in this finding
      is the choice of typeface, which this list is the wrong place to hold:
      `.ai/DESIGN-V2.md` Phase 5 already carries the home scene's typographic
      voice as an explicit, optional, non-blocking user decision, and the
      finding's own recommendation is "do not ship this as a drive-by — raise
      it as a decision". Leaving it open here only invites the same answer at
      every triage.
      Two things a future owner decision has to budget for, both verified:
      pointing the scene at the loaded Geist Mono moves the whole glyph and
      word-buffer construction behind `document.fonts.ready` — a real
      scene-startup change needing a capture and a re-check of
      `verify-composition.mjs`'s eight link bounds, since a mono face is wider
      per character. And `scripts/particle-nav/make-poster.ts:98` still spells
      `Arial, sans-serif` inline (out of this agent's scope); it only bites on a
      re-bake, and a re-bake on a box without Arial is itself a substitution
      risk. The poster's ground is already `#000000`, so nothing there is stale
      navy.

- [x] `home-scene-story-copy-exists-nowhere-but-the-intro`
      the twelve-beat argument is used once per tab and reused nowhere
      **Do:** Use `STORY_TRANSCRIPT` — already exported and currently unused — as the source for a short typeset statement, so the film and the page share one string by construction. …
      `components/particle-nav/CanvasMount.tsx:161-163`, `components/particle-nav/CanvasMount.tsx:420-424`, `components/particle-nav/CanvasMount.tsx:62-85`, `components/intro/story-timeline.ts:123-135`
      `low` · `content-design` · `small effort`
      **Considered and rejected.** The film's script should not be reused as
      the site's statement of purpose, and every candidate site already has an
      answer:
      the front-page masthead carries War Update's authored trust sentence
      (`HomeFrontPage`), which is the doubling this same finding warns against;
      `SITE_DESCRIPTION` describes the desk rather than the film by an explicit
      decision already recorded in `lib/site-config.ts` ("A cinematic awakening
      from digital darkness" was removed for exactly that reason); and
      `/we-are` opens on "Who we are" plus Organization JSON-LD. As the
      finding's own Evidence correction says, no visitor is unable to learn why
      the site exists.
      `CanvasMount`'s `introRunning` guard on the transcript is right, not a
      defect: the transcript stands in for the film while the navigation behind
      it is inert, and once the film is not playing an assistive-technology
      reader should get the navigation rather than twelve sentences of preamble
      in front of it.
      `STORY_TRANSCRIPT` is gone. It was the finding's suggested source, but
      the only place it could land already renders `STORY_PARAGRAPHS` as
      paragraphs, where a joined blob is strictly worse — so it was a dead
      export standing as an implicit invitation to a second statement of
      purpose. The reasoning is now a comment on `STORY_PARAGRAPHS` itself, at
      the point of temptation. Nothing imported it (grepped repo-wide).
      An intro-replay control remains uncosted and unfiled — the finding
      already treats it as a separate optional change.

---

### Reading system — tokens, dossier shell, content components

11 tasks here, plus 1 in Wave 1.

#### Medium — 7

- [x] `reading-system-body-size-appears-once-in-the-library`
      full-measure prose is set at the secondary tier
      **Do:** Do **not** promote `.cardBody` globally — it would make the common case worse: in the 2-up grids a card is ~330px less 48px padding ≈ 282px, which at 17px is ~33ch, tighter than the 40ch being objected to. …
      `components/content/content.module.css:349`, `components/content/content.module.css:406-412`, `components/content/content.module.css:578`, `components/content/content.module.css:793-799`, `components/content/content.module.css:864-869`
      `medium` · `typography` · `small effort`

- [x] `reading-system-credibility-label-outranks-credibility-value`
      three editorial pages render no publication metadata
      **Do:** Do the coverage half only: mount `PublicationMeta` with `publishedAt` and `reviewedBy` on `/october-7`, `/israels-story` and `/our-heroes` — at the foot, as a colophon, not the head. Leave `/we-are` and `/support-us` out; …
      `components/content/content.module.css:278-286`, `components/content/content.module.css:294-311`, `components/content/PublicationMeta.tsx:20-31`
      `medium` · `hierarchy` · `small effort`
      **Left:** all of it. The fix is three `app/<section>/page.tsx` mounts and nothing in `components/content/`; the component is already correct.

- [x] `reading-system-error-page-is-a-preserved-v1-fossil`
      `app/error.tsx` is the last unconverted V1 surface
      **Do:** Retype onto tokens, but **do not delete the inline `<style>`**. The file header's rationale — a broken shared stylesheet can never take the error screen down — applies to a CSS Module chunk too, and token-only values fail open to unstyled if `globals.css` is …
      `app/error.tsx:31-34`, `app/error.tsx:42-48`, `app/error.tsx:49-56`, `app/error.tsx:57-60`, `app/error.tsx:91-96`
      `medium` · `typography` · `small effort`

- [x] `reading-system-content-w-diverges-from-the-1fr-tracks`
      the rails breakpoint is ~63px too low
      **Do:** The filed "simplest correct fix" — `grid-template-columns: var(--rail-w) var(--reading-w) var(--rail-w)` — fixes nothing on its own: at 1220px that totals 1182.8px against a 1124px content box and overflows the padding by the same 29.4px per side. …
      `components/sections/sections.module.css:620-626`, `components/sections/sections.module.css:228-235`, `components/sections/sections.module.css:131-157`, `components/sections/sections.module.css:515-522`
      `medium` · `layout` · `medium effort`
      **Left:** the identical `--content-w` override at `components/home/home.module.css:496` needs the same clamp; it is the home surface's file.

- [x] `reading-system-no-spacing-scale-at-all`
      type and colour were collapsed; spacing never was
      **Do:** Add an eight-step scale to `globals.css` beside the type scale, tuned to the body line box (1.0625rem × 1.7 = 28.9px): `--sp-1: 0.25rem; --sp-2: 0.5rem; --sp-3: 0.75rem; --sp-4: 1rem; --sp-5: 1.5rem; --sp-6: 2rem; --sp-7: 3rem; …
      `app/globals.css:12-118`, `components/sections/sections.module.css:342-365`, `components/sections/sections.module.css:379-384`, `components/content/content.module.css:582-588`
      `medium` · `layout` · `medium effort`

- [x] `reading-system-two-sources-of-truth-for-the-palette`
      `content.module.css` restates the ink scale as literals
      **Do:** The simplest correct fix is smaller than filed: delete `content.module.css:28-30` outright so `var(--ink*)` resolves by inheritance from `:root`, which is guaranteed since `app/layout.tsx` loads `globals.css` on every route — no renaming needed, and the …
      `components/content/content.module.css:22-43`, `components/content/content.module.css:38`, `components/content/content.module.css:872`, `app/globals.css:101-118`
      `medium` · `colour` · `medium effort`

- [x] `reading-system-verdict-ramp-cannot-signal-its-verdict`
      five of nine assessment ramps are one tan
      **Do:** Do the type half now: raise the badge from `--t-data` to `--t-caption`, drop uppercase and tracking, and retire the file's own declared exception at `content.module.css:79-81` — a verdict is the least micro of all the micro-chrome on this site, and the …
      `components/content/content.module.css:82-105`, `components/content/content.module.css:115-179`, `components/content/VerificationBadge.tsx:11-50`
      `medium` · `hierarchy` · `medium effort`
      **Left:** the colour half, which the finding stages behind this one — widen glyph differentiation to all nine marks before revisiting hue.

#### Low — 4

- [x] `reading-system-anchor-landing-is-inconsistent`
      five anchor offsets, and only the Brief scrolls smoothly
      **Do:** The half worth doing on its own is `scroll-behavior: smooth` on `.page` with `scroll-behavior: auto` added to the existing `@media (prefers-reduced-motion: reduce)` block at `sections.module.css:696`, mirroring `geopolitical-brief.module.css:46/908` — that …
      `components/sections/sections.module.css:367-374`, `components/content/content.module.css:492-497`, `app/israels-story/page.module.css:77-82`, `components/briefs/geopolitical-brief.module.css:42-46`
      `low` · `interaction` · `trivial effort`
      **Left:** `app/israels-story/page.module.css:81` (2.5rem) and `app/war-update/page.module.css:48` (6rem) still hold their own offsets; both are page files.

- [x] `reading-system-figures-are-the-same-size-as-headings`
      FigureRow's default is `--t-h2`
      **Do:** Keep only the first half: change `content.module.css:453-455` to `font-size: var(--t-display); font-weight: var(--t-display-weight); …
      `components/content/content.module.css:447-466`, `components/sections/sections.module.css:367-374`, `app/globals.css:26-49`, `app/october-7/page.module.css:37-47`
      `low` · `hierarchy` · `trivial effort`

- [x] `reading-system-dead-surface-in-the-shell`
      four unreferenced pieces of shell surface
      **Do:** Two cheap, admissible fixes: change `var(--gold-bright, #efd79a)` → `var(--gold-hi, #efd79a)` in `reading-progress.module.css:16` (one line, no visual change, removes a phantom token), and either mount `SensitiveContent` or drop it from the barrel — an …
      `components/sections/reading-progress.module.css:12-20`, `components/sections/sections.module.css:421-446`, `components/sections/sections.module.css:583-601`, `components/sections/AskAboutFileCta.tsx:12-20`, `components/content/index.ts:10`
      `low` · `consistency` · `small effort`
      **Done:** the phantom `--gold-bright` at `reading-progress.module.css:16`.
      **Closed 2026-08-27 with the decision the finding asked for:
      `SensitiveContent` stays in the barrel, unmounted. Do not delete it and
      do not re-raise it as dead code.**
      It is not an orphan of the section shell. It is a documented member of
      the content component library (`components/content/README.md:236-253`),
      built and marked delivered at `TODOS.md:344`, and it is unmounted
      because an editorial decision made it unnecessary — not because anyone
      forgot. `TODOS.md:389` records that decision in terms: October 7 links
      to three real testimony archives through `SourceList` and deliberately
      does not reconstruct testimony or build victim profiles, because this
      site has consent from none of them, so "there is no graphic content
      here that needs a reveal gate". An unmounted gate is the *consequence*
      of that decision, not a claim the site is failing to make.
      The place it would earn its keep is the ~1,177-record October 7
      archive, which does publish survivor testimony and today has no
      sensitive-content handling of any kind — verified, no match for
      sensitive / content-warning / reveal in `components/archive/` or
      `lib/content/archive.ts`. That is a content question for whoever owns
      the archive, and deleting the component now would only mean rebuilding
      it. Mounting it remains an October 7 page edit and is out of scope for
      the shared stylesheets.
      **Correction to this entry's own citation:** `.ai/STATE.md:595` does not
      exist — that file is 65 lines and does not mention `SensitiveContent`
      anywhere. The record is `TODOS.md:344` and `TODOS.md:389`.
      **Also unchanged, deliberately:** `AskAboutFileCta` and the two separate
      hairlines. The finding is explicit that collapsing them would undo the
      comment at `sections.module.css:575-581` and that the CTA's retention is
      recorded in DECISIONS 2026-08-25.

- [x] `reading-system-uppercase-rule-broken-in-the-files-that-state-it`
      four tracked-caps strings of three or four words ship
      **Do:** Move `text-transform: uppercase` off `.identityBand` onto `.identityMeta` only ("FILE 01 / 08", "/WAR-UPDATE"), and drop it from `.tocTitle` (:544), `.skipLink` (:73) and `not-found.module.css:100` — a wordmark should be set the way the brand is written, and …
      `components/sections/sections.module.css:69-74`, `components/sections/sections.module.css:252-257`, `components/sections/sections.module.css:538-544`, `app/not-found.module.css:96-102`
      `low` · `typography` · `small effort`

---

### The eight destination pages

14 tasks here, plus 4 in Wave 1.

#### High — 1

- [x] `section-pages-first-content-below-the-fold`
      two pages bury their first exhibit
      **Do:** Fake Resistance: reduce "The machine"/"The tells" (`page.tsx:104-143`, ~250 words of thesis) to a two-sentence standfirst above Exhibit A and keep the taxonomy as a closing section — the exhibits are the argument, the essay is the gloss. …
      `app/fake-resistance/page.tsx:104-143`, `app/israels-story/page.tsx:63-93`, `.ai/DESIGN-V2.md:231-232`
      `high` · `hierarchy` · `medium effort`
      **Done, 2026-08-27.** Fake Resistance restructured: two-sentence
      standfirst, then Case files; "The files" index, "The machine" and "The
      tells" now close the page, with `PublicationMeta` last as a colophon.
      Moving the file index down goes slightly beyond what was filed — left
      above the exhibits it kept the first `caseTitle` below the fold on its
      own. The Israel's Story half was already closed by Wave 1 task 8.

#### Medium — 6

- [x] `section-pages-support-us-toolkit-two-up-in-a-68ch-measure`
      285px form controls
      **Do:** Make `.toolkit` single-column at all widths (`app/support-us/page.module.css:9` → `grid-template-columns: minmax(0, 1fr)`), the resolution We Are's pipeline already took. The two modules are a sequence — report a claim, then offer a skill — not a comparison. …
      `app/support-us/page.module.css:7-12`, `app/support-us/page.module.css:119-124`, `components/support/support.module.css:6-8`, `components/sections/sections.module.css:20-21`
      `medium` · `layout` · `trivial effort`

- [x] `section-pages-corrections-is-108-words-and-promises-a-column-it-cannot-render`
      /corrections promises "the page it applied to" in copy that CorrectionHistory has no field to render, and gives a reader who has found an error no link to the report f…
      **Do:** Prefer cutting "with the page it applied to" from `page.tsx:55` over adding the field — the log is empty, and a field nothing populates is the weaker half of the pair. …
      `app/corrections/page.tsx:53-56`, `components/content/CorrectionHistory.tsx:17-31`, `lib/content/corrections.ts:12`, `components/support/ReportClaimForm.tsx`
      `medium` · `content-design` · `small effort`

- [x] `section-pages-our-heroes-consent-boundary-arrives-last-and-unmarked`
      The disclosure that this site has no family-consent process, and that every profile is assembled only from what named press has already published more than once, is a …
      **Do:** Keep the wording verbatim and un-gated. Move the block above the Citations block and give it a bordered/italic standfirst with a gold `--t-data` label, defined **locally** in `app/our-heroes/page.module.css` rather than by `composes:`-ing War Update's module, …
      `app/our-heroes/page.tsx:83-103`, `components/sections/sections.module.css:379`, `app/war-update/page.tsx:49-57`, `app/war-update/page.module.css:15-25`
      `medium` · `hierarchy` · `small effort`

- [x] `section-pages-war-update-opens-on-a-disclaimer`
      the body opens on apparatus
      **Do:** Reorder to dispatches-first: render the advisory as a one-line `.advisory` strip immediately under `.ledeRule` with no `h2` of its own, and move `PublicationMeta` to the foot of the feed where a reader who has read the entries wants provenance. …
      `app/war-update/page.tsx:49-70`, `lib/content/war-update.ts:171-172`, `components/sections/SectionPage.tsx:154-156`
      `medium` · `content-design` · `small effort`

- [x] `section-pages-fake-resistance-propagation-manufactures-its-own-pattern`
      a coordination signature inferred from flagging dates
      **Do:** Prefer rewriting over deletion. Deleting the block orphans `Timeline`'s `spread` variant (its only call site, `content.module.css:486/521/552`) and stales the measured example in `.ai/DECISIONS.md:478-488` ("Fake Resistance's claim-propagation entries run …
      `app/fake-resistance/page.tsx:221-241`, `app/fake-resistance/page.tsx:116-142`, `lib/content/fake-resistance.ts:47-48`, `lib/content/fake-resistance.ts:77-78`, `lib/content/fake-resistance.ts:104-105`
      `medium` · `content-design` · `medium effort`
      **Done by rewriting, 2026-08-27.** Block retitled "Order of correction";
      the coordination inference is gone, replaced by a sentence saying
      explicitly that three corrections in one week is not evidence of
      coordination. Entries now carry day-level labels derived from the same
      `datetime` the sort uses. `Timeline`'s `spread` variant keeps its call
      site. Noted for the record: Exhibits A and C have their date provable
      from the cited URL; Exhibit B's `2023-10-13` is an editorial assertion
      the cited Reuters Institute page carries no date for.

- [x] ~~`section-pages-margin-citation-repeats-into-wallpaper`
      one identical citation down a run of entries~~
      `lib/content/october-7.ts`, `lib/content/israels-story.ts`
      `medium` · `information-density` · `medium effort`
      **Closed, 2026-08-27, on the editorial half — no code-level dedupe was
      needed.** Israel's Story was already fixed by the founding-chapter pass
      (13 distinct source lists across 23 entries). October 7 went from **1
      distinct citation across 7 entries to 7**, each the record of its own
      event and each fetched and title-checked in this session: UN CoI
      detailed findings A/HRC/56/CRP.3 (the attack, alongside the ADL
      backgrounder, which is kept on the one entry whose figures it is the
      source of); OCHA Flash Update #22, reporting 27–28 Oct 2023 (the ground
      offensive); OCHA Flash Update #49, 24 Nov 2023 (the pause and the first
      releases); the US Compilation of Presidential Documents statement of
      17 Oct 2024 (Sinwar); the Prime Minister's Office announcement of
      19 Jan 2025 (the ceasefire implemented); the ICRC release of 13 Oct 2025
      (the final 20 living hostages); and the MFA record of 26 Jan 2026 (the
      last deceased hostage). Five institutions, seven documents. One body
      edit came with it: the last entry now names Ran Gvili, because its
      source does and an unnamed hostage cannot be checked. `Timeline.tsx` and
      `content.module.css` were not touched — the markup contract in
      `.ai/DECISIONS.md:469-490` is intact.

#### Low — 7

- [x] `section-pages-israels-story-fourth-chapter-is-not-a-chapter`
      Chapter IV is still titled "Peace, when it came" — a thematic name in a set where the other six are event+date — contains a single timeline entry (the 1979 Egypt treat…
      **Do:** Rename `:194` to "Peace with Egypt, 1979" and drop the trailing clause at `:196`. Do **not** rename the `id` `peace-when-it-came`: it is the `#anchor` in the contents nav and the `hasPart` URL in the page's JSON-LD, and ids are load-bearing in this file …
      `lib/content/israels-story.ts:194`, `lib/content/israels-story.ts:196`, `lib/content/israels-story.ts:197-207`, `app/israels-story/page.tsx:117`
      `low` · `content-design` · `trivial effort`

- [x] ~~`section-pages-primary-ctas-typed-at-the-floor`
      two control labels take uppercase at three words~~
      `components/support/support.module.css`, `components/support/share-verified.module.css`
      `low` · `typography` · `trivial effort`
      **Closed, 2026-08-27. The carve-out was read first and did not hold.**
      `support.module.css:88-89` justified three-word uppercase on the
      grounds that "a control label is the one place the data voice still
      reads as a button" — but the budget it stretches is a word count, not a
      voice: `.ai/DESIGN-V2.md:185` allows uppercase+tracking only for data
      labels of two words or fewer. It was already contradicted inside the
      repo by another *control* that keeps the rule,
      `app/october-7/page.module.css` `.archiveEntryCta`, sentence case at
      three words for this exact reason. Both controls now take
      `--face-text` / `--t-caption` / `--t-caption-weight`, no transform, no
      tracking, keeping the gold rule and the 44px target; the carve-out
      comment is replaced rather than contradicted, and
      `share-verified.module.css`'s pointer back to it is rewritten. Both
      submit labels move together — "Send report" is in bounds at two words,
      but a group of controls that switches case with its own word count
      reads as an accident (`components/home/home.module.css:394`). Contrast
      recomputed against the new ground: `--gold #c9a24b` on `#000000` is
      **8.75:1**, not the report's 8.2:1 against the retired `#070B14`, and
      the label grew from 11.52px to 13px — the fix costs no legibility. War
      Update's `.permalink`/`.shareButton` stay in the data voice, as filed.

- [x] `section-pages-assessment-ramps-are-one-colour`
      the Fake Resistance stamp and the badge disagree
      **Do:** Make the one change worth making now: derive Fake Resistance's `data-tone` from the badge's own assessment→family mapping so Exhibit B stops carrying a grey stamp over an ember badge. …
      `components/content/content.module.css:113-178`, `app/fake-resistance/page.tsx:164-176`
      `low` · `colour` · `small effort`

- [x] `section-pages-forms-hide-what-is-required-until-after-submit`
      the volunteer form applies no validation at all
      **Do:** Add `required` to the email input (`VolunteerInterestForm.tsx:68-73`) and label it "Email (required)" so it matches the "(optional)" marking on Name; that alone guarantees the mailto carries a reply address. …
      `components/support/VolunteerInterestForm.tsx:16`, `components/support/VolunteerInterestForm.tsx:49`, `components/support/VolunteerInterestForm.tsx:67`, `app/support-us/page.tsx:52-56`
      `low` · `interaction` · `small effort`

- [x] `section-pages-oslo-flagged-in-the-hostile-colour`
      Israel's Story flags its one disputed chapter with the ember ramp, and hardcodes the flag to an id string literal instead of a chapter field.
      **Do:** The clearly correct half is replacing the id literal with a `contested?: boolean` field on `StoryChapter` (`lib/content/israels-story.ts:14-20`) so the flag travels with the content. …
      `app/israels-story/page.tsx:80`, `app/israels-story/page.module.css:151-163`, `app/globals.css:64-72`, `components/sections/SectionPage.tsx:64-65`
      `low` · `colour` · `small effort`
      **Half done, 2026-08-27.** The id literal is gone: `StoryChapter` now
      carries `contested?: boolean`, set on the Oslo chapter, and the page
      reads that. The colour half is deferred — `contested` (#e6a972) is a raw
      hex inside `VerificationBadge`, so using it needs either a new token in
      `app/globals.css` or the badge component itself, both out of scope.

- [x] `section-pages-review-metadata-exists-and-is-never-shown`
      October 7, Israel's Story and Our Heroes each declare publishedAt and reviewedBy that no reader-facing surface consumes — Israel's Story's not even by its JSON-LD — wh…
      **Do:** Do the first half only: render `PublicationMeta` as a colophon at the foot of `/october-7`, `/israels-story` and `/our-heroes`, or delete the unused fields from those three modules — either resolves the inconsistency. …
      `lib/content/october-7.ts:147-148`, `lib/content/israels-story.ts:279-280`, `lib/content/our-heroes.ts:102-103`, `components/sections/SectionPage.tsx:133-142`, `components/content/PublicationMeta.tsx:25`
      `low` · `consistency` · `small effort`
      **Done, 2026-08-27.** `PublicationMeta` mounted as a foot colophon on
      `/october-7`, `/israels-story` and `/our-heroes` with `publishedAt` and
      `reviewedBy` only. Masthead half dropped as the finding directs. This is
      the same fix `reading-system-credibility-label-outranks-credibility-value`
      asks for — close that one against this change rather than repeating it.

- [x] `section-pages-wire-device-outlives-its-content`
      five filter chips over seven entries
      **Do:** Keep only the filter half, and as a threshold note rather than a deletion: collapse the chips to a single "All / Diplomacy" split, or drop the row until the edition passes ~20 entries, leaving `emptyFilter` in place as the defensive branch it is. …
      `app/war-update/WireFeed.tsx:18`, `app/war-update/WireFeed.tsx:81-94`, `app/war-update/WireFeed.tsx:96-97`, `lib/content/war-update.ts:92-163`, `app/war-update/page.module.css:27-43`
      `low` · `interaction` · `small effort`

---

### October 7 archives and the Geopolitical Brief

11 tasks here, plus 7 in Wave 1.

#### High — 1

- [x] `archive-brief-index-emits-the-entire-archive-with-no-way-to-narrow-it`
      Both index routes render every record as a ~77px row and stop.
      **Do:** Add one client filter component under `components/archive/` — a single text input over `ArchiveIndexEntry.title` + `witness` + `category`, plus a sticky category jump row on `/documentation` built from the `groups` array already computed at …
      `app/october-7/documentation/page.tsx:41-53`, `app/october-7/testimonies/page.tsx:38-41`, `components/archive/ArchiveRecordList.tsx:26-48`, `components/archive/archive.module.css:240-267`
      `high` · `information-density` · `medium effort`

#### Medium — 6

- [x] `archive-brief-index-meta-line-is-identical-on-314-of-335-rows`
      meta() composes witness + year + language count.
      **Do:** Accept `showMeta?: boolean` on `ArchiveRecordList` and pass `showMeta={false}` from `app/october-7/documentation/page.tsx:47-51`, keeping it on for testimonies where witness names carry real signal. …
      `components/archive/ArchiveRecordList.tsx:51-60`, `components/archive/archive.module.css:283-309`
      `medium` · `content-design` · `trivial effort`

- [x] `archive-brief-broken-media-renders-as-an-unlabelled-empty-box`
      const alt = item.alt_text ?? caption ?? '' marks an image decorative when the source published neither, which is 185 of 468 images — so those are unlabelled to a scree…
      **Do:** Both halves of the filed fix are wrong as written. "onError-free CSS-only fallback" is not possible — CSS cannot detect a 404; that needs `onError` (or a build-time manifest check), i.e. a client component the archive renderer currently is not. …
      `components/archive/ArchiveBlocks.tsx:113`, `components/archive/ArchiveBlocks.tsx:115-134`, `components/archive/archive.module.css:63-71`, `lib/content/archive.ts:195-198`
      `medium` · `empty-state` · `small effort`

- [x] `archive-brief-disinformation-scan-corpus-animates-behind-testimony`
      DocPage seeds ScanBackdrop from routeId, and all ~1,177 archive routes pass routeId="october-7" — so the deterministic PRNG produces the identical nine fragments in id…
      **Do:** Two cheap, in-policy fixes. **(1)** Add `seed?: string` to `ScanBackdropProps`, default it to `routeId`, and have `ArchiveRecordPage` pass the record slug. …
      `components/sections/DocPage.tsx:30`, `components/sections/DocPage.tsx:37`, `components/sections/ScanBackdrop.tsx:107-117`, `components/sections/sections.module.css:157-172`
      `medium` · `composition` · `small effort`

- [x] `archive-brief-generic-tagline-splits-the-title-from-the-dateline`
      DocPage's header is title → lede → gold ledeRule, and the archive supplies a constant per-package lede on every page.
      **Do:** Give `DocPage` an optional `dateline?: React.ReactNode` slot rendered inside `<header>` between `.lede` and `.ledeRule`, render `.lede` only when a tagline exists, and drop the archive taglines to `undefined` — so the header becomes title → dateline → one …
      `app/october-7/testimonies/[slug]/page.tsx:5`, `app/october-7/documentation/[category]/[slug]/page.tsx:5`, `components/sections/DocPage.tsx:55-60`, `components/sections/sections.module.css:342-355`, `components/archive/ArchiveRecord.tsx:57-99`
      `medium` · `hierarchy` · `small effort`

- [x] `archive-brief-record-title-set-as-display-headline-regardless-of-length`
      DocPage's .title is --t-display (44px at 1440) with text-wrap: balance and no length branch.
      **Do:** Add a length-responsive title step: have `ArchiveRecordPage` pass a `titleScale` hint (`displayTitle(version.title).length > 90 ? 'long' : 'default'`) that `DocPage` turns into a class setting `--t-h2` (1.55rem) outright — the token clamp floors at 2.1rem, so …
      `components/archive/ArchiveRecordPage.tsx:56`, `components/sections/sections.module.css:333-341`, `components/archive/archive.module.css:290-296`
      `medium` · `typography` · `small effort`

- [x] `archive-brief-long-testimony-has-no-navigation-through-its-own-structure`
      DocPage was written for /methodology and /corrections — "short policy pages, not documents with sections to navigate" (DocPage.tsx:9-13).
      **Do:** As filed the change is a silent no-op. `ArchiveBlocks.tsx:56` renders `<h2 className={styles.heading}>` with no `id`, and `DocPage` sets neither `data-reading-scroll` (on `<main>`) nor `data-toc-source` (on the body div) — `SectionToc` early-returns when …
      `components/sections/DocPage.tsx:29-31`, `components/sections/DocPage.tsx:54-63`, `components/archive/archive.module.css:13-21`, `components/sections/SectionToc.tsx:44`
      `medium` · `layout` · `medium effort`

#### Low — 4

- [x] `archive-brief-block-order-contract-rests-on-a-nan-comparator`
      ArchiveBlock.position is typed as a required number and ArchiveBlocks sorts on a.position - b.position.
      **Do:** Prefer honouring rule 3 directly over the filed mixed-key sort: make it `position?: number` and either drop the sort (array order *is* the package's display order) or sort only when every block carries a position — `const ordered = blocks.every(b => typeof …
      `components/archive/ArchiveBlocks.tsx:33-43`, `lib/content/archive.ts:24-33`
      `low` · `correctness` · `trivial effort`

- [x] `archive-brief-category-group-boundaries-are-24px`
      .groupHeading:first-of-type { margin-top: 0 } was written to suppress the top margin on the first heading only, but each group sits in its own <section> and :first-of-…
      **Do:** Scope the suppression correctly — `section:first-of-type .groupHeading { margin-top: 0 }`, or a modifier class on the first section — which alone restores the intended 2.5rem break. …
      `components/archive/archive.module.css:212-232`, `app/october-7/documentation/page.tsx:41-53`
      `low` · `layout` · `trivial effort`

- [x] `archive-brief-witness-label-duplicates-the-value-it-labels`
      witness_name is not a name — it is the source site's byline phrase — so the dateline renders "WITNESS Gili Y.'s story" on all 505 testimony version pages and in all 179 index meta lines.
      **Do:** Add `displayWitness()` beside `displayTitle()` in `lib/content/archive.ts` and call it from `ArchiveRecord.tsx:62` and `ArchiveRecordList.tsx:53`. The filed regex `/['’]s\s+story$/i` misses both malformed values; …
      `components/archive/ArchiveRecord.tsx:59-64`, `components/archive/ArchiveRecordList.tsx:52-53`, `components/archive/archive.module.css:137-162`
      `low` · `content-design` · `trivial effort`

- [x] `archive-brief-two-shells-now-disagree-about-the-card-and-the-closing-apparatus`
      sections.module.css:307-311 records the deliberate removal of the card — "no border, no translucent panel, no blur… the card chrome was reading as a floating box rathe…
      **Do:** Reverse the direction and shrink it: drop `.article`'s two gold-tinted borders and the `0 2rem 7rem` shadow, keep its `rgba(8,14,24,0.965)` ground (load-bearing behind the unmasked `.quietBackdrop`), and record that as the reconciliation. …
      `components/briefs/geopolitical-brief.module.css:316-323`, `components/sections/sections.module.css:307-316`, `components/briefs/GeopoliticalBrief.tsx:217-235`, `components/sections/DocPage.tsx:61-62`
      `low` · `consistency` · `medium effort`

---

### Cross-cutting — accessibility, responsive, motion, interaction

9 tasks here, plus 3 in Wave 1. **7 closed 2026-08-27**; two remain, each
with a note under it saying what is left and why it was not done here —
`inner-scroll-chrome-budget` in full, `breakpoint-sprawl` in the two parts
that live under `app/<section>/`.

#### Medium — 6

- [x] `cross-cutting-composer-triggers-ios-zoom`
      13.12px text in the composer and the answers
      **Done:** `.composer textarea` and `.message p` both on `--t-body` /
      `--t-body-lh`. Heights re-derived from the step rather than scaled:
      `min-height: 2.875rem` (one 28.9px line + 17.1px padding),
      `max-height: 10.125rem` (the same five-line clip). `support.module.css`
      was already correct and is untouched.
      **Do:** Set `.composer textarea { font-size: var(--t-body); line-height: var(--t-body-lh); }` and raise `min-height`/`max-height` proportionally so the auto-grow at `AskTheLionChat.tsx:180-185` still clips at roughly the same line count — carry the new line-height …
      `components/chat/ask-the-lion-chat.module.css:220`, `components/chat/ask-the-lion-chat.module.css:514-528`, `components/support/support.module.css:27-38`
      `medium` · `interaction` · `trivial effort`

- [x] `cross-cutting-identity-band-17px-exit`
      the sole exit is a 17px-tall target
      **Done:** `.wordmark, .identityExit { display: inline-flex;
      align-items: center; min-height: 44px; }` added inside the existing
      `@media (max-width: 900px)` block. Paired with the padding reduction the
      finding asked to weigh: the 44px boxes supply the breathing room the
      band padding used to, so `padding-top`/`padding-bottom` drop to 0.4rem
      and the row gap to 0. Net cost ~12px of band height, not the ~27px
      filed for one link or the ~46px both would have cost unpaired.
      **Do:** In the `@media (max-width: 900px)` block at `sections.module.css:651` — where the band already wraps and `.identityExit` already gets `flex-basis: 100%` — add `.wordmark, .identityExit { display: inline-flex; align-items: center; min-height: 44px; }`. …
      `components/sections/sections.module.css:270-309`, `components/sections/sections.module.css:684-690`, `components/sections/SectionPage.tsx:130-145`, `components/sections/DocPage.tsx:40-51`
      `medium` · `accessibility` · `trivial effort`

- [x] `cross-cutting-chat-and-archive-touch-targets`
      nine controls at 15–42px
      **Done:** `.retry`/`.newThread` inline-flex at 44px, `.composer button`
      to 2.75rem, `.starter` to 44px. Both filed exceptions honoured:
      `.copy` keeps its baseline box and grows through a `::after` overlay,
      `.citationChip` stays a circle. The chip needed one thing the finding
      did not name — an inset overlay alone would have covered its
      neighbour's circle, since the overlay bleeds 8px and the gap was 4.8px.
      The circle goes to 1.75rem and `.citationRow`'s gap to 1rem, so two
      overlays meet exactly and the target is a true 44×44. Archive language
      chips: `display: inline-flex; align-items: center; min-height: 44px`,
      inline padding to 0.7rem so they are not tall slivers, and `.languages`
      from `baseline` to `center` — `min-height` does nothing on an inline
      element, so the display change the fix implies forces the alignment.
      **Do:** `.retry`, `.newThread` → `min-height: 44px; display: inline-flex; align-items: center;`; `.composer button` → 2.75rem to match `.close`; …
      `components/chat/ask-the-lion-chat.module.css:189-200`, `components/chat/ask-the-lion-chat.module.css:301-313`, `components/chat/ask-the-lion-chat.module.css:381-394`, `components/chat/ask-the-lion-chat.module.css:433-447`, `components/chat/ask-the-lion-chat.module.css:532-542`, `components/archive/archive.module.css:182-208`
      `medium` · `accessibility` · `small effort`

- [x] `cross-cutting-chat-never-got-v2`
      the chat surface is the last V2 holdout
      **Done:** Both files on the tokens. No hex literal survives outside a
      comment, no size below `--t-data`, no tracking above 0.08em, no Cinzel.
      `.header h2` → `--face-display`/`--t-h3`, `.welcome p` → `--t-h2`, both
      sentence case. Two departures from the filed wording. `.eyebrow`'s
      three-word copy is set in sentence case rather than cut to two words —
      the word that would have gone is "AI", and the disclosure is worth more
      than the tracking. And the launcher label is `--face-text`/`--t-caption`,
      not the filed `--face-data`/`--t-data`: `launcherLabel()` composes
      phrases up to five words, and `.ai/DESIGN-V2.md:151-153` says the mono
      face is "never for sentences". `--t-caption` is the UI voice at the
      scale a floating cue wants, and it clears the floor either way.
      Consequence: the ≤719px dock needed more than the same treatment —
      `nowrap` at the larger step put the longest label through the side of
      the pill, so it wraps there now (two lines fit inside the 55px row).
      **Do:** Give these two files the Phase 3 pass the ten routes got: replace every literal with the nearest of `--ink-hi`/`--ink`/`--ink-lo`/`--gold`/`--gold-hi`; …
      `components/chat/ask-the-lion-chat.module.css:47-64`, `components/chat/ask-the-lion-chat.module.css:144-158`, `components/chat/ask-the-lion-chat.module.css:167-187`, `components/chat/ask-the-lion-chat.module.css:433-473`, `components/chat/particle-chat-launcher.module.css:159-192`, `components/chat/particle-chat-launcher.module.css:296-318`
      `medium` · `typography` · `medium effort`

- [x] `cross-cutting-forms-die-without-js`
      both `/support-us` forms discard a submission
      **Done:** aria fix shipped as filed — `aria-invalid` and a shared
      `aria-describedby` on `#report-url` and `#report-body`, an id on the
      guard, and focus moved to the first field that would satisfy it. For
      the no-JS tier both forms get a `<noscript>` that also hides the submit
      button, because a notice beside a button that still reloads the page
      leaves the lie in place. The volunteer noscript names `VOLUNTEER_INBOX`
      — the same address its handler composes, so nothing is invented.
      **Half undone:** the report form has no address to name. The site owns
      no reports inbox, and `VOLUNTEER_INBOX` is another desk's, itself a
      flagged placeholder. Its noscript says plainly that nothing typed can
      reach the desk; give it a real address when one exists.
      **Do:** Ship the aria fix as filed — correct and self-contained: `aria-invalid={touched && !hasContent}` on `#report-url` and `#report-body`, an id on the error `<p>` referenced by `aria-describedby` from both, and focus moved to `#report-url` when the guard trips. …
      `components/support/ReportClaimForm.tsx:102`, `components/support/ReportClaimForm.tsx:127-129`, `components/support/VolunteerInterestForm.tsx:55`, `components/support/VolunteerInterestForm.tsx:112`
      `medium` · `accessibility` · `medium effort`

- [x] `cross-cutting-inner-scroll-chrome-budget`
      every reading route is its own scroll container
      **Closed 2026-08-27: safe subset shipped; the remainder is re-scoped
      as its own follow-up task** (the full document-scroll conversion —
      five stylesheets, three JS consumers — with the complete analysis
      recorded at the scroll lock in `app/globals.css`). It is a project,
      not an audit defect, and tracking it here kept re-raising it.**
      **Shipped:** `--chat-dock-h: 5.25rem` is defined in `app/globals.css`
      and read by `sections.module.css` and the Brief. The previous deferral
      declined this on the grounds that two of its three call sites were
      out of reach; that was wrong — the Brief is in the same hand as
      `globals.css` and `sections.module.css`, and only `home.module.css:562`
      is not. It still writes the literal and should read the token in the
      round that next touches it. Verified against the finding: 5.25rem is
      84px, matching `CHAT_DOCK_PX` in `components/particle-nav/config.ts`,
      which `tests/particle-nav-layout.test.ts:73,108` asserts. The filed
      57px-derived value is the launcher pill plus border, not the padded
      root, and would have under-reserved.
      **Still open, and this is the finding, not the effort:** a document has
      exactly one scroller, so the conversion is whole or nothing — unlocking
      `html` while any route still declares `height: 100dvh; overflow-y: auto`
      gives that route a dead outer scrollbar around a live inner one. The
      real set is larger than the report records. Five stylesheets:
      `sections.module.css` `.page` (SectionPage *and* DocPage, so the whole
      ~1,177-route archive), the Brief, `app/not-found.module.css`,
      `app/error.tsx:41-42` and `app/admin/admin.module.css:1`. Three JS
      consumers, not the two filed: `ReadingProgress.tsx:24`,
      `SectionToc.tsx:44` (IntersectionObserver `root`) and
      `ArchiveIndexFilter.tsx:106-117`, whose `findScroller` matches on
      computed `overflow-y` and would silently return null — killing the
      hand-rolled index scroll restoration that exists *because* of this lock.
      Plus every `position: sticky` element whose scrollport is reparented
      (`.backdropBand`, `.tocRailInner`, the Brief's `.siteHeader` and index
      rail), plus `scroll-behavior` and the Brief's `scroll-padding-top`,
      which must move onto `html` and be re-scoped per route once they share
      one element. Three of those files are outside this pass's scope and one
      (`app/error.tsx`) is a route a reader only reaches when something has
      already gone wrong.
      **And it cannot be verified here.** The entire payoff is URL-bar
      collapse and back-navigation scroll restoration; neither is observable
      in `ci-smoke` (route availability and console errors) or in headless
      Chromium. It needs a real mobile browser on the macOS workstation, in
      one round that owns all five stylesheets. Reasoning written into
      `app/globals.css` at the lock itself and cross-referenced from
      `sections.module.css` `.page`, so the next pass inherits it instead of
      re-deriving it a third time.
      **Do:** Drop the filed "cheap and immediate" half: a `--chat-dock-h` derived from 57px would under-reserve and put text under the dock, the exact failure `sections.module.css:38-41` warns about, and `CHAT_DOCK_PX = 84` is asserted in …
      `app/globals.css:126-132`, `components/sections/sections.module.css:43-52`, `components/sections/sections.module.css:684-690`, `components/briefs/geopolitical-brief.module.css:37-48`, `components/briefs/geopolitical-brief.module.css:747-800`
      `medium` · `responsive` · `large effort`

#### Low — 3

- [x] `cross-cutting-breakpoint-sprawl`
      ten widths against a four-width canon
      **Closed 2026-08-27: the admissible part is shipped and the remainder
      is named.** Part (3) is done — the canon is restated at the top of
      `content.module.css` and `sections.module.css` with the rule that a
      fifth width earns its place in a comment beside it, so it is greppable
      rather than remembered. Re-verified after the fact: the shared
      stylesheets now open media queries at 1220, 1219.98, 900, 719 and 359
      only, plus the one sanctioned 640 in `content.module.css`, which is
      written up in place with the measured reason (`.figures` at 390px gives
      108px columns; at 600px they are 178px and still working).
      Parts (1) and (2) are one-line changes under `app/<section>/`, which
      this pass does not own: (1) `october-7:103`'s `min-width: 46rem`, the
      only rem-unit width query in the codebase — the report's own note is
      that rem in a media query resolves against the user's font-size
      preference and is arguably the *more* accessible form, so it wants a
      comment saying so rather than a normalisation; (2) `we-are:183` (600)
      and `israels-story:166` (640), which need either a move to 719 or a
      one-line measured justification. None blocks the others and none is a
      defect a reader can see. **The filed sweep stays unapplied**:
      `fake-resistance:201`, `october-7:64`, `our-heroes:176` and
      `war-update:204` are correct as they stand — two carry written
      justifications and two are padding-only, not grids. Do not re-raise
      this as a cross-cutting task; what is left is three per-page comments.
      **Do:** Do not apply the filed sweep. Leave `fake-resistance:201`, `october-7:64`, `our-heroes:176` and `war-update:204` exactly as they are — two carry written or documented justifications and two are padding-only. Three things are worth doing. …
      `components/home/home.module.css:487-490`, `app/we-are/page.module.css:183`, `app/israels-story/page.module.css:166`, `app/october-7/page.module.css:103`
      `low` · `consistency` · `small effort`

- [x] `cross-cutting-figurerow-three-up-on-phones`
      .figures is repeat(3, minmax(0, 1fr)) with no collapse until max-width: 359px.
      **Done:** a `@media (max-width: 640px)` block in the shared component,
      placed after the 719px block so it wins where both apply, carrying the
      collapse and the top-border treatment. The 359px `.figures` rules are
      deleted; `.publicationMeta` stays there. October 7's own override is
      untouched — it is redundant for the grid but still owns its `dt`.
      **Do:** Move the collapse into the shared component as its own `@media (max-width: 640px)` block, matching the threshold October 7 already chose: `.figures { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; …
      `components/content/content.module.css:428-436`, `components/content/content.module.css:987-997`, `components/content/content.module.css:1025-1036`, `app/october-7/page.module.css:63-75`
      `low` · `responsive` · `small effort`

- [x] `cross-cutting-launcher-advertises-offline-desk`
      .label runs attentionCue 7.2s … infinite while the desk is offline:
      **Done:** `infinite` → `3`, as the finding recommends, and the probe was
      deliberately *not* hoisted into `ChatOpenProvider` — that fires a
      request on first paint of every route, ~1,177 prerendered archive pages
      included, to decide a CSS property. The animation has no `fill-mode`,
      so after the third pass the label reverts to its `opacity: 0` base and
      hover/focus still override with `animation: none`. the capability probe hits GET /api/v1/chat/threads, gets a 500 because no database is provisioned, …
      **Do:** Do **not** hoist the probe into `ChatOpenProvider` as filed: that fires a `GET /api/v1/chat/threads` on first paint of every route, including ~1,177 prerendered archive pages, to decide a decorative animation — a network request per page view for a CSS …
      `components/chat/particle-chat-launcher.module.css:182`, `components/chat/particle-chat-launcher.module.css:242-264`, `components/chat/AskTheLionChat.tsx:136-150`, `components/chat/AskTheLionChat.tsx:485-489`, `components/chat/AskTheLionChat.tsx:516-520`
      `low` · `interaction` · `small effort`

---

## Do not refile

These were raised and closed. Re-raising them costs a session each time.

### Refuted in verification

- `reading-system-aside-is-still-a-zero-caller-prop` — `CLAUDE.md` states
  verbatim that `surface="quiet"` is not a deviation and that `aside` "exists
  and is unused". The proposed fix was also hazardous: `--accent` defaults to
  `var(--data-blue)`, so `color: var(--accent)` on `h2` would turn six
  dossier headings blue.
- `reading-system-masthead-status-is-a-constant` — "Reference edition"
  deliberately replaced a `Monitoring · active` label; `.ai/DECISIONS.md`
  (2026-08-25) ends "Do not reintroduce a live-sounding label". The slot is
  filled, not empty.
- `cross-cutting-colour-only-links` — the 1.29:1 figure recomputes, but the
  mechanism does not exist: the front page's closing row is two links with no
  surrounding prose, and `home.module.css:482-486` already carries the
  `:focus-visible` rule the finding said was missing.

### Withdrawn by the browser sweep

Flagged automatically, then withdrawn on inspection. Any future automated
sweep will flag them again and they should die the same way.

- `.identitySep` at 2.04:1 — the element is a `·` rendered
  `aria-hidden="true"` (`SectionPage.tsx:134`). Decorative, not a text
  contrast obligation.
- The `ScanBackdrop` rows at 2.49:1 and 4.03:1 — `ScanBackdrop.tsx:143` marks
  the whole field `aria-hidden="true"`.
- The Brief's wordmark measuring 1×1 at 320px — that is the visually-hidden
  pattern at `geopolitical-brief.module.css:776-782`, not a collapsed grid
  column.

### Merged ids

Filed twice by two agents. Searching for the retired id should land here.

| Filed as | Tracked above as |
| --- | --- |
| `cross-cutting-orbit-labels-nine-px` | `home-scene-orbit-labels-below-legibility-floor` |
| `archive-brief-998-non-english-pages-are-served-as-lang-en` | `archive-lang-declared-english` |
| `cross-cutting-archive-lang-declared-english` | `archive-lang-declared-english` |
| `cross-cutting-error-page-cinzel` | `reading-system-error-page-is-a-preserved-v1-fossil` |
| `reading-system-two-tables-of-contents-at-once` | `section-pages-israels-story-two-contents-lists` |
| `cross-cutting-archive-image-cls` | `archive-brief-october7-videos-reserve-no-layout-height` |
| `home-scene-file-index-numbers-fail-contrast` | `cross-cutting-four-sub-aa-text-pairs` |

---

## Not in this list, and still open

- [x] ~~**Provision `NEXT_PUBLIC_ARCHIVE_CDN`.**~~ Done — Vercel Blob store
      `lions-of-zion-archive` (`store_M70Ph8nWOJVAnaRn`), 1.94 GB across
      2,018 objects, connected to the project. `NEXT_PUBLIC_ARCHIVE_CDN` is
      set on Preview and Production to
      `https://m70ph8nwojvanarn.public.blob.vercel-storage.com`. Verified
      2026-08-26: `verify-archive-assets.mjs --all` reports 2,018 checked,
      0 unreachable, and the live record pages emit blob URLs with no
      `/archive` fallback left in the HTML.
      **Being `NEXT_PUBLIC_`, the value is substituted at build time** — a
      later change to it needs a redeploy, not just an env edit.
- [x] ~~**Repair `package-lock.json`.**~~ Done — it was blocking CI on
      every pull request, not only this one.
- [x] **Phase 5 — home-scene orbit labels** is recorded in `.ai/DESIGN-V2.md`
      as open and a user decision, not an audit finding. The audit's
      `home-scene-orbit-labels-below-legibility-floor` is the in-place fix
      that does not pre-empt it. **Closed here 2026-08-27: it is tracked in
      `DESIGN-V2` where it belongs, and the owner engaged this exact surface
      the same day — the node ring grew to fit the labels, and the hover
      card now speaks Cinzel. The Phase 5 question remains DESIGN-V2's.**
