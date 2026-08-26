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

- [ ] `npm install` first — `npm ci` currently fails on nested `@esbuild/*`
      packages missing from `package-lock.json`. The repair is additive and
      belongs in its own commit.
- [ ] Run `npm run typecheck`, `npm run lint` and `npm test` before every push.
      A `PostToolUse` hook re-checks the intro timeline invariants and runs
      `tsc --noEmit` after each edit, so a broken timeline surfaces early.
- [ ] **Every task under "Home experience" needs the macOS workstation.** Four
      verification scripts hardcode the real-Chrome path and cannot run in a
      Linux container; headless Chromium falls back to SwiftShader, which the
      GPU probe correctly rejects, so the scene never mounts. No home-scene
      change is verified until `npm run verify:graphics`,
      `node scripts/final-verify.mjs` and
      `node .claude/skills/verify-intro/capture.mjs` have been run there.
- [ ] Read the finding in the report before acting on the one-line **Do:**
      below it. Several recommendations explicitly rule out the obvious fix,
      and the report says why.

---

## Wave 1 — the ranked queue

Ranked by reader impact × confidence, divided by effort, not by severity
alone. The first nine are one file each. These fifteen are not repeated in
the by-surface list below.

- [ ] **1.** `archive-brief-provenance-renders-at-body-size-not-at-the-data-floor`
      Provenance footer computes 17px full-ink mono instead of the declared 11.5px `--ink-lo`
      **Do:** One edit: `archive.module.css:349` → `.provenance p { margin: 0 0 0.35rem; font-size: var(--t-data); line-height: var(--t-data-lh); color: var(--ink-lo); }`, plus `overflow-wrap: anywhere` on `.provenance a` so a long slug breaks rather than laddering. …
      `components/archive/archive.module.css:338-355`, `components/sections/sections.module.css:376-388`, `components/archive/ArchiveRecord.tsx:103-116`
      `high` · `typography` · `trivial effort`

- [ ] **2.** `cross-cutting-three-webgpu-on-every-route`
      the WebGPU renderer ships to all ~1,190 routes
      **Do:** Change `ParticleChatLauncher.tsx:6` to `const ChatParticleCanvas = dynamic(() => import('./ChatParticleCanvas'), { ssr: false });`. …
      `app/layout.tsx:3`, `app/layout.tsx:70-78`, `components/chat/ParticleChatLauncher.tsx:6`, `components/chat/ChatParticleCanvas.tsx:2-28`, `components/particle-nav/CanvasMount.tsx:30`
      `high` · `performance-perceived` · `trivial effort`

- [ ] **3.** `archive-brief-testimony-opens-with-the-source-sites-breadcrumb`
      367 testimonies open their body with october7.org's nav breadcrumb, set as prose
      **Do:** In `ArchiveBlocks`' `paragraph` case, skip the block at index 0 when it is breadcrumb-shaped, render-time only, stored record unchanged. …
      `components/archive/ArchiveBlocks.tsx:58-59`, `components/archive/archive.module.css:27-32`, `lib/content/archive.ts:214-227`
      `high` · `content-design` · `small effort`

- [ ] **4.** `archive-brief-documentation-record-says-one-sentence-three-times`
      All 670 documentation pages print the title as h1 then again as h2; 336 also as the body paragraph
      **Do:** Split it. **(1)** In `ArchiveBlocks.tsx`, pass the rendered title down from `ArchiveRecordPage`/`ArchiveRecord` and skip a *leading* `heading` block whose normalised text equals it. …
      `components/archive/ArchiveBlocks.tsx:54-59`, `components/archive/ArchiveRecordPage.tsx:55`, `components/archive/archive.module.css:13-21`, `components/archive/archive.module.css:27-32`
      `high` · `hierarchy` · `small effort`

- [ ] **5.** `archive-lang-declared-english`
      661 non-English pages render inside `lang="en"`
      **Do:** Target the parts, not the `<main>`. The filed "put `lang` on the `<main>`" fix would create a new 3.1.2 failure, because `DocPage`'s `<main>` also contains untranslated English chrome: the skip link, the "Lions of Zion" wordmark, "← Back to the scan", the …
      `app/layout.tsx:67`, `components/archive/ArchiveRecordPage.tsx:55-72`, `components/archive/ArchiveRecord.tsx:79-98`, `components/sections/DocPage.tsx:34`, `lib/content/archive.ts:35-40`
      `high` · `accessibility` · `small effort`

- [ ] **6.** `archive-brief-mobile-index-rail-pins-351px-of-metadata-over-the-brief`
      351px of sticky evidence-contract chrome over a 760px phone viewport
      **Do:** Scope the fix to ≤719px, **not** the 900px block: between 720 and 900px `.indexRailInner` is `position: static` and `.indexRail` is not sticky, so the evidence contract there is ordinary flow content doing no harm, and adding `.evidenceContract { display: …
      `components/briefs/geopolitical-brief.module.css:798-806`, `components/briefs/geopolitical-brief.module.css:712-714`, `components/briefs/geopolitical-brief.module.css:755-758`, `components/briefs/GeopoliticalBrief.tsx:101-117`
      `high` · `responsive` · `small effort`

- [ ] **7.** `section-pages-war-update-renders-every-source-twice`
      18 source links for 8 sources
      **Do:** Delete `app/war-update/page.tsx:72-74` only. Leave `edition.sources` in `lib/content/war-update.ts`, as Israel's Story left its `chapter.sources`, since `sourceCount` still reads from it for the `PublicationMeta` row that preserves the count. …
      `app/war-update/page.tsx:72-74`, `app/war-update/WireFeed.tsx:124-125`, `app/israels-story/page.tsx:105-111`
      `medium` · `information-density` · `trivial effort`

- [ ] **8.** `section-pages-israels-story-two-contents-lists`
      two chapter lists on one screen, disagreeing on the count
      **Do:** Add `@media (min-width: 1220px) { .contents { display: none; } }` to `app/israels-story/page.module.css`. Do **not** simply delete the block: the rail is client-side only and `display: none` below 1220px, so deleting it leaves mobile and no-JS readers with no …
      `app/israels-story/page.tsx:63-77`, `app/israels-story/page.module.css:11-72`, `components/sections/SectionToc.tsx:49-62`, `components/sections/SectionPage.tsx:148-150`
      `medium` · `composition` · `trivial effort`

- [ ] **9.** `cross-cutting-progress-bar-claims-fully-read`
      the resting state is 100%
      **Do:** Add `transform: scaleX(0);` to all four rules (`sections.module.css:593` and `:611`, `reading-progress.module.css:12`, `geopolitical-brief.module.css:178`). …
      `components/sections/ReadingProgress.tsx:50-54`, `components/sections/sections.module.css:593-601`, `components/sections/sections.module.css:611-618`, `components/sections/reading-progress.module.css:12-20`, `components/briefs/geopolitical-brief.module.css:178`
      `medium` · `interaction` · `trivial effort`

- [ ] **10.** `cross-cutting-four-sub-aa-text-pairs`
      four pairs below 4.5:1, one of them a UA default
      **Do:** `.timestamp` → `var(--ink-lo)` (6.32:1 on the panel). Both placeholders → `var(--ink-lo)` as well (6.36:1 on the support field); add `.field input::placeholder, .field textarea::placeholder { color: var(--ink-lo); …
      `components/chat/ask-the-lion-chat.module.css:183-187`, `components/chat/ask-the-lion-chat.module.css:530`, `components/support/support.module.css:27-38`, `components/home/home.module.css:433-441`, `app/globals.css:64-72`, `app/not-found.module.css:101`, `app/not-found.module.css:137`
      `medium` · `accessibility` · `trivial effort`

- [ ] **11.** `archive-brief-record-pages-have-no-route-back-into-the-archive`
      No link to index, category, hub or neighbour on any record or index page
      **Do:** Give `DocPage` an optional `breadcrumb?: {href,label}[]` prop rendered in the identity band beside the route at `--t-data`, and have `ArchiveRecordPage` pass `[{'/october-7', 'October 7'}, {index path, 'Testimonies'|'Documentation'}]`. …
      `components/sections/DocPage.tsx:40-51`, `components/sections/DocPage.tsx:61-62`, `components/archive/ArchiveRecord.tsx:103-116`
      `high` · `layout` · `small effort`

- [ ] **12.** `archive-brief-october7-videos-reserve-no-layout-height`
      74 videos ship no dimensions; each `<video>` lays out at 300×150 then jumps
      **Do:** Fall back to the poster's dimensions, which the package already holds and a test already guarantees: `width={item.width ?? poster?.width ?? undefined}` and the same for height. That reserves the correct box at first layout for all 74 clips. …
      `components/archive/ArchiveBlocks.tsx:179-189`, `components/archive/archive.module.css:63-79`
      `medium` · `performance-perceived` · `trivial effort`

- [ ] **13.** `reading-system-focus-within-makes-the-quietest-page-louder`
      `:focus-within` outranks `.registerMuted`
      **Do:** The minimal, no-side-effect fix is to demote the focus rule: move it above `.surfaceQuiet .row` and write it `:where(.page:focus-within) .row { --register: 0.6; animation-duration: calc(var(--dur) * 2); …
      `components/sections/sections.module.css:159-172`, `components/sections/sections.module.css:200-211`, `components/sections/sections.module.css:213-217`
      `medium` · `motion` · `trivial effort`

- [ ] **14.** `section-pages-methodology-contains-no-methodology`
      the credibility document states no sourcing standard
      **Do:** Add the three sections the site's own copy implies: what counts as a source and how sources rank; when and how a source is archived; …
      `app/methodology/page.tsx:36-81`, `app/corrections/page.tsx:40-50`, `app/war-update/page.tsx:54-57`, `app/we-are/page.tsx:29-78`
      `high` · `content-design` · `medium effort`

- [ ] **15.** `section-pages-wikipedia-in-the-evidence-margin`
      7 of 8 sources are Wikipedia, printed as the evidence
      **Do:** Two constraints. This reverses a documented decision — `.ai/DECISIONS.md`, 2026-08-25, "Israel's Story ships two chapters, not 'the long arc'", explicitly accepted Wikipedia as the sourcing basis ("each built from a fetched primary source (Wikipedia, itself …
      `lib/content/israels-story.ts:28-82`, `lib/content/war-update.ts:66-71`, `components/content/content.module.css:694-700`, `app/israels-story/page.tsx:117-127`
      `high` · `content-design` · `medium effort`

---

## Wave 2 — the rest, by surface

Sixty tasks. Within each surface, severity first and cheapest first, so a
session can take the top of a section and stop anywhere.

### Home experience — intro, particle navigation, front-page band

15 tasks here.

#### High — 1

- [ ] `home-scene-mobile-intro-runs-nine-seconds-longer`
      the intro is 47.3s on a phone and 38.6s on desktop
      **Do:** Make the cadence per *beat*, not per line, so the twelve sentences take the same wall-clock time on both layouts and a two-line break costs presentation rather than duration: a beat-relative schedule in `getEntryStart` with `ROLLING_BEAT_CADENCE ≈ 2.2s` and …
      `components/intro/rolling-story-timeline.ts:11`, `components/intro/rolling-story-timeline.ts:90-125`, `components/intro/story-timeline.ts:33-118`
      `high` · `motion` · `medium effort`

#### Medium — 6

- [ ] `home-scene-orbit-labels-below-legibility-floor`
      the eight orbit labels render at 9.28–10.35px
      **Do:** File the in-place fix, not a face swap: raise the desktop half — `clamp(0.72rem, 1.4vmin, 0.95rem)` with `letter-spacing: 0.08em` at all widths — which clears the floor and the tracking cap without touching Cinzel, `CLAUDE.md`'s uppercase-as-identity rule, or …
      `components/particle-nav/styles.module.css:390-411`, `components/particle-nav/styles.module.css:485-491`, `app/globals.css:48-52`, `.ai/DESIGN-V2.md:181-186`
      `medium` · `typography` · `small effort`

- [ ] `home-scene-first-screen-names-only-threats`
      the scan's fixed glyph layer is 100% hostile labels
      **Do:** Swap two or three of the ten hostile labels for verdict labels in the same gold ramp — "SOURCE CONFIRMED", "CROSS-CHECKED", "CORRECTION LOGGED" — placed on the opposite diagonal. …
      `components/particle-nav/layers/NetworkScan.tsx:54-88`, `components/particle-nav/HomeSignalLayer.tsx:24-28`, `app/opengraph-image.tsx:68-78`, `lib/content/war-update.ts:171-172`
      `medium` · `content-design` · `medium effort`

- [ ] `home-scene-intro-typeface-is-gentilis-and-brand-is-one-word`
      the brand climax spells "LIONSOFZION"
      **Do:** Split into two items. **Ship now (trivial):** change `IntroText.tsx:122` to `['LIONS OF ZION']`. Verified safe — glyph advances sum to 8.456em vs 7.844em, so at `brandFontScale` 0.38 the cloud goes 2.98→3.21 world units against a desktop `lineMaxWidth` of at …
      `components/particle-nav/layers/IntroText.tsx:88-91`, `components/particle-nav/layers/IntroText.tsx:122-130`, `components/particle-nav/styles.module.css:456-465`, `app/layout.tsx:13-19`
      `medium` · `typography` · `medium effort`

- [ ] `home-scene-mobile-fold-has-no-scroll-affordance`
      the front page has no visible cue on a phone
      **Do:** Add a phone-only cue *inside* the scene box, above the chat dock, on the free `.desktopOrientation` layer (`display: none` below 719px) — a gold chevron plus "The front page" at `--t-data` linking to `#home-masthead`. …
      `components/home/home.module.css:222-226`, `components/home/home.module.css:35-38`, `app/globals.css:195-201`, `components/particle-nav/styles.module.css:493-515`
      `medium` · `interaction` · `medium effort`

- [ ] `home-scene-orbit-order-contradicts-the-band-taxonomy`
      nothing orders the orbit, and a comment says otherwise
      **Do:** Minimum viable: correct the false comment at `HomeFrontPage.tsx:154-156`, and move `support-us` out of index 1 so the ask is not second in tab order. …
      `components/particle-nav/config.ts:75-148`, `components/particle-nav/config.ts:151-153`, `components/home/HomeFrontPage.tsx:40-44`, `components/home/HomeFrontPage.tsx:154-186`
      `medium` · `hierarchy` · `medium effort`

- [ ] `home-scene-poster-tier-has-no-navigation`
      the fallback poster draws nothing at the eight node positions
      **Do:** Do **not** draw node rings and icons at `NODE_CENTRES` as originally filed — they will misregister. The poster's spokes sit at 0.36W/0.40H of a 1600 square, while `NavLinks` places links at 36%/40% of the safe-inset viewport box; …
      `scripts/particle-nav/make-poster.ts:35-43`, `scripts/particle-nav/make-poster.ts:88-104`, `components/particle-nav/ParticleNav.tsx:31-35`, `components/particle-nav/styles.module.css:142-155`
      `medium` · `composition` · `medium effort`

#### Low — 8

- [ ] `home-scene-hover-card-chrome-outranks-its-sentence`
      the card's meta row is 9.28px and spends both accents on chrome
      **Do:** Two real fixes, no inversion. Raise `.cardMeta` to `--t-data` (0.72rem) with `--t-data-tracking` (0.08em), and delete `.cardRoute` — it duplicates the href the browser already shows on hover and is aria-hidden anyway. …
      `components/particle-nav/styles.module.css:278-309`, `components/particle-nav/styles.module.css:253-276`, `components/particle-nav/NavLinks.tsx:46-56`
      `low` · `hierarchy` · `trivial effort`

- [ ] `home-scene-metadata-describes-the-animation-not-the-desk`
      the root description describes the intro
      **Do:** Share one product description between `layout.tsx` (base + openGraph + twitter) and `manifest.ts` via a `SITE_DESCRIPTION` export in `lib/site-config.ts`, which already holds `SITE_URL` and is already imported by both consumers. …
      `app/layout.tsx:41-57`, `app/manifest.ts:3-11`, `app/opengraph-image.tsx:77`, `lib/content/war-update.ts:171-172`
      `low` · `content-design` · `trivial effort`

- [ ] `home-scene-scan-breakpoint-disagrees-with-every-other-layer`
      `NetworkScan` hardcodes 620 where everything else uses 720
      **Do:** Do not blind-swap 620→720: that visibly drops four labels and two platform glyphs across the whole 620–719 band and is a composition change requiring a real-Chrome capture. …
      `components/particle-nav/layers/NetworkScan.tsx:476-481`, `components/particle-nav/config.ts:216-217`, `components/intro/introLayout.ts:86-88`, `components/particle-nav/styles.module.css:493-515`
      `low` · `responsive` · `trivial effort`

- [ ] `home-scene-stylesheet-ignores-the-token-palette`
      the scene consumes no palette token and carries three off-scale colours
      **Do:** Not a find-and-replace. (a) Safe now: `#b6c4d6` (305) → `var(--ink)`. (b) `#a7b8ca` (469) and `#e7c979` (458) are visible changes to the wordmark block; …
      `components/particle-nav/styles.module.css:456-472`, `components/particle-nav/styles.module.css:303-309`, `app/globals.css:54-76`
      `low` · `colour` · `trivial effort`

- [ ] `home-scene-idle-motion-dials-are-all-zero`
      three sim dials ship at 0 under comments describing motion
      **Do:** The zero-risk half needs no visual sign-off: correct or delete the four comments that assert motion. If idle rotation is restored, note that `Scene.tsx:226` rotates the whole rig and `activeAngle` at 238 reads `rig.rotation.z`, so a nonzero value also drifts …
      `components/particle-nav/config.ts:13-39`, `components/particle-nav/layers/OrbitalRings.tsx:2`, `components/particle-nav/layers/OrbitalRings.tsx:41-43`, `components/particle-nav/tsl/lionCompute.ts:153-155`
      `low` · `motion` · `small effort`

- [ ] `home-scene-masthead-repeats-the-wordmark-verbatim`
      the band's kicker restates the scene's, one screen apart
      **Do:** Drop `.brandKicker` from `HomeSignalLayer` so the scene reads wordmark + "Truth has a signal.", and let the band own the framing. Keep the masthead's `<h1>`, rule and lede — `.ai/DECISIONS.md` records the `<h1>` as the home route's only one. …
      `components/particle-nav/HomeSignalLayer.tsx:24-28`, `components/home/HomeFrontPage.tsx:90-95`, `components/home/home.module.css:249-288`
      `low` · `composition` · `small effort`

- [ ] `home-scene-scan-labels-are-arial`
      the scene's canvas text names system faces directly
      **Do:** Do not ship this as a drive-by. `.ai/DESIGN-V2.md:154-161, 313` makes the home scene's typographic voice an explicit open question for the user (Phase 5), so raise it as a decision. …
      `components/particle-nav/layers/NetworkScan.tsx:240`, `components/particle-nav/layers/NetworkScan.tsx:242`, `components/particle-nav/layers/NetworkScan.tsx:404-412`, `scripts/particle-nav/make-poster.ts:98`
      `low` · `typography` · `small effort`

- [ ] `home-scene-story-copy-exists-nowhere-but-the-intro`
      the twelve-beat argument is used once per tab and reused nowhere
      **Do:** Use `STORY_TRANSCRIPT` — already exported and currently unused — as the source for a short typeset statement, so the film and the page share one string by construction. …
      `components/particle-nav/CanvasMount.tsx:161-163`, `components/particle-nav/CanvasMount.tsx:420-424`, `components/particle-nav/CanvasMount.tsx:62-85`, `components/intro/story-timeline.ts:123-135`
      `low` · `content-design` · `small effort`

---

### Reading system — tokens, dossier shell, content components

11 tasks here, plus 1 in Wave 1.

#### Medium — 7

- [ ] `reading-system-body-size-appears-once-in-the-library`
      full-measure prose is set at the secondary tier
      **Do:** Do **not** promote `.cardBody` globally — it would make the common case worse: in the 2-up grids a card is ~330px less 48px padding ≈ 282px, which at 17px is ~33ch, tighter than the 40ch being objected to. …
      `components/content/content.module.css:349`, `components/content/content.module.css:406-412`, `components/content/content.module.css:578`, `components/content/content.module.css:793-799`, `components/content/content.module.css:864-869`
      `medium` · `typography` · `small effort`

- [ ] `reading-system-credibility-label-outranks-credibility-value`
      three editorial pages render no publication metadata
      **Do:** Do the coverage half only: mount `PublicationMeta` with `publishedAt` and `reviewedBy` on `/october-7`, `/israels-story` and `/our-heroes` — at the foot, as a colophon, not the head. Leave `/we-are` and `/support-us` out; …
      `components/content/content.module.css:278-286`, `components/content/content.module.css:294-311`, `components/content/PublicationMeta.tsx:20-31`
      `medium` · `hierarchy` · `small effort`

- [ ] `reading-system-error-page-is-a-preserved-v1-fossil`
      `app/error.tsx` is the last unconverted V1 surface
      **Do:** Retype onto tokens, but **do not delete the inline `<style>`**. The file header's rationale — a broken shared stylesheet can never take the error screen down — applies to a CSS Module chunk too, and token-only values fail open to unstyled if `globals.css` is …
      `app/error.tsx:31-34`, `app/error.tsx:42-48`, `app/error.tsx:49-56`, `app/error.tsx:57-60`, `app/error.tsx:91-96`
      `medium` · `typography` · `small effort`

- [ ] `reading-system-content-w-diverges-from-the-1fr-tracks`
      the rails breakpoint is ~63px too low
      **Do:** The filed "simplest correct fix" — `grid-template-columns: var(--rail-w) var(--reading-w) var(--rail-w)` — fixes nothing on its own: at 1220px that totals 1182.8px against a 1124px content box and overflows the padding by the same 29.4px per side. …
      `components/sections/sections.module.css:620-626`, `components/sections/sections.module.css:228-235`, `components/sections/sections.module.css:131-157`, `components/sections/sections.module.css:515-522`
      `medium` · `layout` · `medium effort`

- [ ] `reading-system-no-spacing-scale-at-all`
      type and colour were collapsed; spacing never was
      **Do:** Add an eight-step scale to `globals.css` beside the type scale, tuned to the body line box (1.0625rem × 1.7 = 28.9px): `--sp-1: 0.25rem; --sp-2: 0.5rem; --sp-3: 0.75rem; --sp-4: 1rem; --sp-5: 1.5rem; --sp-6: 2rem; --sp-7: 3rem; …
      `app/globals.css:12-118`, `components/sections/sections.module.css:342-365`, `components/sections/sections.module.css:379-384`, `components/content/content.module.css:582-588`
      `medium` · `layout` · `medium effort`

- [ ] `reading-system-two-sources-of-truth-for-the-palette`
      `content.module.css` restates the ink scale as literals
      **Do:** The simplest correct fix is smaller than filed: delete `content.module.css:28-30` outright so `var(--ink*)` resolves by inheritance from `:root`, which is guaranteed since `app/layout.tsx` loads `globals.css` on every route — no renaming needed, and the …
      `components/content/content.module.css:22-43`, `components/content/content.module.css:38`, `components/content/content.module.css:872`, `app/globals.css:101-118`
      `medium` · `colour` · `medium effort`

- [ ] `reading-system-verdict-ramp-cannot-signal-its-verdict`
      five of nine assessment ramps are one tan
      **Do:** Do the type half now: raise the badge from `--t-data` to `--t-caption`, drop uppercase and tracking, and retire the file's own declared exception at `content.module.css:79-81` — a verdict is the least micro of all the micro-chrome on this site, and the …
      `components/content/content.module.css:82-105`, `components/content/content.module.css:115-179`, `components/content/VerificationBadge.tsx:11-50`
      `medium` · `hierarchy` · `medium effort`

#### Low — 4

- [ ] `reading-system-anchor-landing-is-inconsistent`
      five anchor offsets, and only the Brief scrolls smoothly
      **Do:** The half worth doing on its own is `scroll-behavior: smooth` on `.page` with `scroll-behavior: auto` added to the existing `@media (prefers-reduced-motion: reduce)` block at `sections.module.css:696`, mirroring `geopolitical-brief.module.css:46/908` — that …
      `components/sections/sections.module.css:367-374`, `components/content/content.module.css:492-497`, `app/israels-story/page.module.css:77-82`, `components/briefs/geopolitical-brief.module.css:42-46`
      `low` · `interaction` · `trivial effort`

- [ ] `reading-system-figures-are-the-same-size-as-headings`
      FigureRow's default is `--t-h2`
      **Do:** Keep only the first half: change `content.module.css:453-455` to `font-size: var(--t-display); font-weight: var(--t-display-weight); …
      `components/content/content.module.css:447-466`, `components/sections/sections.module.css:367-374`, `app/globals.css:26-49`, `app/october-7/page.module.css:37-47`
      `low` · `hierarchy` · `trivial effort`

- [ ] `reading-system-dead-surface-in-the-shell`
      four unreferenced pieces of shell surface
      **Do:** Two cheap, admissible fixes: change `var(--gold-bright, #efd79a)` → `var(--gold-hi, #efd79a)` in `reading-progress.module.css:16` (one line, no visual change, removes a phantom token), and either mount `SensitiveContent` or drop it from the barrel — an …
      `components/sections/reading-progress.module.css:12-20`, `components/sections/sections.module.css:421-446`, `components/sections/sections.module.css:583-601`, `components/sections/AskAboutFileCta.tsx:12-20`, `components/content/index.ts:10`
      `low` · `consistency` · `small effort`

- [ ] `reading-system-uppercase-rule-broken-in-the-files-that-state-it`
      four tracked-caps strings of three or four words ship
      **Do:** Move `text-transform: uppercase` off `.identityBand` onto `.identityMeta` only ("FILE 01 / 08", "/WAR-UPDATE"), and drop it from `.tocTitle` (:544), `.skipLink` (:73) and `not-found.module.css:100` — a wordmark should be set the way the brand is written, and …
      `components/sections/sections.module.css:69-74`, `components/sections/sections.module.css:252-257`, `components/sections/sections.module.css:538-544`, `app/not-found.module.css:96-102`
      `low` · `typography` · `small effort`

---

### The eight destination pages

14 tasks here, plus 4 in Wave 1.

#### High — 1

- [ ] `section-pages-first-content-below-the-fold`
      two pages bury their first exhibit
      **Do:** Fake Resistance: reduce "The machine"/"The tells" (`page.tsx:104-143`, ~250 words of thesis) to a two-sentence standfirst above Exhibit A and keep the taxonomy as a closing section — the exhibits are the argument, the essay is the gloss. …
      `app/fake-resistance/page.tsx:104-143`, `app/israels-story/page.tsx:63-93`, `.ai/DESIGN-V2.md:231-232`
      `high` · `hierarchy` · `medium effort`

#### Medium — 6

- [ ] `section-pages-support-us-toolkit-two-up-in-a-68ch-measure`
      285px form controls
      **Do:** Make `.toolkit` single-column at all widths (`app/support-us/page.module.css:9` → `grid-template-columns: minmax(0, 1fr)`), the resolution We Are's pipeline already took. The two modules are a sequence — report a claim, then offer a skill — not a comparison. …
      `app/support-us/page.module.css:7-12`, `app/support-us/page.module.css:119-124`, `components/support/support.module.css:6-8`, `components/sections/sections.module.css:20-21`
      `medium` · `layout` · `trivial effort`

- [ ] `section-pages-corrections-is-108-words-and-promises-a-column-it-cannot-render`
      /corrections promises "the page it applied to" in copy that CorrectionHistory has no field to render, and gives a reader who has found an error no link to the report f…
      **Do:** Prefer cutting "with the page it applied to" from `page.tsx:55` over adding the field — the log is empty, and a field nothing populates is the weaker half of the pair. …
      `app/corrections/page.tsx:53-56`, `components/content/CorrectionHistory.tsx:17-31`, `lib/content/corrections.ts:12`, `components/support/ReportClaimForm.tsx`
      `medium` · `content-design` · `small effort`

- [ ] `section-pages-our-heroes-consent-boundary-arrives-last-and-unmarked`
      The disclosure that this site has no family-consent process, and that every profile is assembled only from what named press has already published more than once, is a …
      **Do:** Keep the wording verbatim and un-gated. Move the block above the Citations block and give it a bordered/italic standfirst with a gold `--t-data` label, defined **locally** in `app/our-heroes/page.module.css` rather than by `composes:`-ing War Update's module, …
      `app/our-heroes/page.tsx:83-103`, `components/sections/sections.module.css:379`, `app/war-update/page.tsx:49-57`, `app/war-update/page.module.css:15-25`
      `medium` · `hierarchy` · `small effort`

- [ ] `section-pages-war-update-opens-on-a-disclaimer`
      the body opens on apparatus
      **Do:** Reorder to dispatches-first: render the advisory as a one-line `.advisory` strip immediately under `.ledeRule` with no `h2` of its own, and move `PublicationMeta` to the foot of the feed where a reader who has read the entries wants provenance. …
      `app/war-update/page.tsx:49-70`, `lib/content/war-update.ts:171-172`, `components/sections/SectionPage.tsx:154-156`
      `medium` · `content-design` · `small effort`

- [ ] `section-pages-fake-resistance-propagation-manufactures-its-own-pattern`
      a coordination signature inferred from flagging dates
      **Do:** Prefer rewriting over deletion. Deleting the block orphans `Timeline`'s `spread` variant (its only call site, `content.module.css:486/521/552`) and stales the measured example in `.ai/DECISIONS.md:478-488` ("Fake Resistance's claim-propagation entries run …
      `app/fake-resistance/page.tsx:221-241`, `app/fake-resistance/page.tsx:116-142`, `lib/content/fake-resistance.ts:47-48`, `lib/content/fake-resistance.ts:77-78`, `lib/content/fake-resistance.ts:104-105`
      `medium` · `content-design` · `medium effort`

- [ ] `section-pages-margin-citation-repeats-into-wallpaper`
      one identical citation down a run of entries
      **Do:** Prefer the editorial half: source the seven October 7 entries individually — each is a discrete, heavily documented event, and the page's claim is that the record is checkable. …
      `lib/content/october-7.ts:31-36`, `lib/content/israels-story.ts:97-124`, `components/content/Timeline.tsx:49-52`, `components/content/content.module.css:657-710`
      `medium` · `information-density` · `medium effort`

#### Low — 7

- [ ] `section-pages-israels-story-fourth-chapter-is-not-a-chapter`
      Chapter IV is still titled "Peace, when it came" — a thematic name in a set where the other six are event+date — contains a single timeline entry (the 1979 Egypt treat…
      **Do:** Rename `:194` to "Peace with Egypt, 1979" and drop the trailing clause at `:196`. Do **not** rename the `id` `peace-when-it-came`: it is the `#anchor` in the contents nav and the `hasPart` URL in the page's JSON-LD, and ids are load-bearing in this file …
      `lib/content/israels-story.ts:194`, `lib/content/israels-story.ts:196`, `lib/content/israels-story.ts:197-207`, `app/israels-story/page.tsx:117`
      `low` · `content-design` · `trivial effort`

- [ ] `section-pages-primary-ctas-typed-at-the-floor`
      two control labels take uppercase at three words
      **Do:** If changed, set `font-family: var(--face-text); font-size: var(--t-caption); font-weight: var(--t-caption-weight); text-transform: none; …
      `components/support/support.module.css:88-103`, `components/support/share-verified.module.css:4-20`, `app/support-us/page.module.css:85-93`, `app/october-7/page.module.css:166-167`
      `low` · `typography` · `trivial effort`

- [ ] `section-pages-assessment-ramps-are-one-colour`
      the Fake Resistance stamp and the badge disagree
      **Do:** Make the one change worth making now: derive Fake Resistance's `data-tone` from the badge's own assessment→family mapping so Exhibit B stops carrying a grey stamp over an ember badge. …
      `components/content/content.module.css:113-178`, `app/fake-resistance/page.tsx:164-176`
      `low` · `colour` · `small effort`

- [ ] `section-pages-forms-hide-what-is-required-until-after-submit`
      the volunteer form applies no validation at all
      **Do:** Add `required` to the email input (`VolunteerInterestForm.tsx:68-73`) and label it "Email (required)" so it matches the "(optional)" marking on Name; that alone guarantees the mailto carries a reply address. …
      `components/support/VolunteerInterestForm.tsx:16`, `components/support/VolunteerInterestForm.tsx:49`, `components/support/VolunteerInterestForm.tsx:67`, `app/support-us/page.tsx:52-56`
      `low` · `interaction` · `small effort`

- [ ] `section-pages-oslo-flagged-in-the-hostile-colour`
      Israel's Story flags its one disputed chapter with the ember ramp, and hardcodes the flag to an id string literal instead of a chapter field.
      **Do:** The clearly correct half is replacing the id literal with a `contested?: boolean` field on `StoryChapter` (`lib/content/israels-story.ts:14-20`) so the flag travels with the content. …
      `app/israels-story/page.tsx:80`, `app/israels-story/page.module.css:151-163`, `app/globals.css:64-72`, `components/sections/SectionPage.tsx:64-65`
      `low` · `colour` · `small effort`

- [ ] `section-pages-review-metadata-exists-and-is-never-shown`
      October 7, Israel's Story and Our Heroes each declare publishedAt and reviewedBy that no reader-facing surface consumes — Israel's Story's not even by its JSON-LD — wh…
      **Do:** Do the first half only: render `PublicationMeta` as a colophon at the foot of `/october-7`, `/israels-story` and `/our-heroes`, or delete the unused fields from those three modules — either resolves the inconsistency. …
      `lib/content/october-7.ts:147-148`, `lib/content/israels-story.ts:279-280`, `lib/content/our-heroes.ts:102-103`, `components/sections/SectionPage.tsx:133-142`, `components/content/PublicationMeta.tsx:25`
      `low` · `consistency` · `small effort`

- [ ] `section-pages-wire-device-outlives-its-content`
      five filter chips over seven entries
      **Do:** Keep only the filter half, and as a threshold note rather than a deletion: collapse the chips to a single "All / Diplomacy" split, or drop the row until the edition passes ~20 entries, leaving `emptyFilter` in place as the defensive branch it is. …
      `app/war-update/WireFeed.tsx:18`, `app/war-update/WireFeed.tsx:81-94`, `app/war-update/WireFeed.tsx:96-97`, `lib/content/war-update.ts:92-163`, `app/war-update/page.module.css:27-43`
      `low` · `interaction` · `small effort`

---

### October 7 archives and the Geopolitical Brief

11 tasks here, plus 7 in Wave 1.

#### High — 1

- [ ] `archive-brief-index-emits-the-entire-archive-with-no-way-to-narrow-it`
      Both index routes render every record as a ~77px row and stop.
      **Do:** Add one client filter component under `components/archive/` — a single text input over `ArchiveIndexEntry.title` + `witness` + `category`, plus a sticky category jump row on `/documentation` built from the `groups` array already computed at …
      `app/october-7/documentation/page.tsx:41-53`, `app/october-7/testimonies/page.tsx:38-41`, `components/archive/ArchiveRecordList.tsx:26-48`, `components/archive/archive.module.css:240-267`
      `high` · `information-density` · `medium effort`

#### Medium — 6

- [ ] `archive-brief-index-meta-line-is-identical-on-314-of-335-rows`
      meta() composes witness + year + language count.
      **Do:** Accept `showMeta?: boolean` on `ArchiveRecordList` and pass `showMeta={false}` from `app/october-7/documentation/page.tsx:47-51`, keeping it on for testimonies where witness names carry real signal. …
      `components/archive/ArchiveRecordList.tsx:51-60`, `components/archive/archive.module.css:283-309`
      `medium` · `content-design` · `trivial effort`

- [ ] `archive-brief-broken-media-renders-as-an-unlabelled-empty-box`
      const alt = item.alt_text ?? caption ?? '' marks an image decorative when the source published neither, which is 185 of 468 images — so those are unlabelled to a scree…
      **Do:** Both halves of the filed fix are wrong as written. "onError-free CSS-only fallback" is not possible — CSS cannot detect a 404; that needs `onError` (or a build-time manifest check), i.e. a client component the archive renderer currently is not. …
      `components/archive/ArchiveBlocks.tsx:113`, `components/archive/ArchiveBlocks.tsx:115-134`, `components/archive/archive.module.css:63-71`, `lib/content/archive.ts:195-198`
      `medium` · `empty-state` · `small effort`

- [ ] `archive-brief-disinformation-scan-corpus-animates-behind-testimony`
      DocPage seeds ScanBackdrop from routeId, and all ~1,177 archive routes pass routeId="october-7" — so the deterministic PRNG produces the identical nine fragments in id…
      **Do:** Two cheap, in-policy fixes. **(1)** Add `seed?: string` to `ScanBackdropProps`, default it to `routeId`, and have `ArchiveRecordPage` pass the record slug. …
      `components/sections/DocPage.tsx:30`, `components/sections/DocPage.tsx:37`, `components/sections/ScanBackdrop.tsx:107-117`, `components/sections/sections.module.css:157-172`
      `medium` · `composition` · `small effort`

- [ ] `archive-brief-generic-tagline-splits-the-title-from-the-dateline`
      DocPage's header is title → lede → gold ledeRule, and the archive supplies a constant per-package lede on every page.
      **Do:** Give `DocPage` an optional `dateline?: React.ReactNode` slot rendered inside `<header>` between `.lede` and `.ledeRule`, render `.lede` only when a tagline exists, and drop the archive taglines to `undefined` — so the header becomes title → dateline → one …
      `app/october-7/testimonies/[slug]/page.tsx:5`, `app/october-7/documentation/[category]/[slug]/page.tsx:5`, `components/sections/DocPage.tsx:55-60`, `components/sections/sections.module.css:342-355`, `components/archive/ArchiveRecord.tsx:57-99`
      `medium` · `hierarchy` · `small effort`

- [ ] `archive-brief-record-title-set-as-display-headline-regardless-of-length`
      DocPage's .title is --t-display (44px at 1440) with text-wrap: balance and no length branch.
      **Do:** Add a length-responsive title step: have `ArchiveRecordPage` pass a `titleScale` hint (`displayTitle(version.title).length > 90 ? 'long' : 'default'`) that `DocPage` turns into a class setting `--t-h2` (1.55rem) outright — the token clamp floors at 2.1rem, so …
      `components/archive/ArchiveRecordPage.tsx:56`, `components/sections/sections.module.css:333-341`, `components/archive/archive.module.css:290-296`
      `medium` · `typography` · `small effort`

- [ ] `archive-brief-long-testimony-has-no-navigation-through-its-own-structure`
      DocPage was written for /methodology and /corrections — "short policy pages, not documents with sections to navigate" (DocPage.tsx:9-13).
      **Do:** As filed the change is a silent no-op. `ArchiveBlocks.tsx:56` renders `<h2 className={styles.heading}>` with no `id`, and `DocPage` sets neither `data-reading-scroll` (on `<main>`) nor `data-toc-source` (on the body div) — `SectionToc` early-returns when …
      `components/sections/DocPage.tsx:29-31`, `components/sections/DocPage.tsx:54-63`, `components/archive/archive.module.css:13-21`, `components/sections/SectionToc.tsx:44`
      `medium` · `layout` · `medium effort`

#### Low — 4

- [ ] `archive-brief-block-order-contract-rests-on-a-nan-comparator`
      ArchiveBlock.position is typed as a required number and ArchiveBlocks sorts on a.position - b.position.
      **Do:** Prefer honouring rule 3 directly over the filed mixed-key sort: make it `position?: number` and either drop the sort (array order *is* the package's display order) or sort only when every block carries a position — `const ordered = blocks.every(b => typeof …
      `components/archive/ArchiveBlocks.tsx:33-43`, `lib/content/archive.ts:24-33`
      `low` · `correctness` · `trivial effort`

- [ ] `archive-brief-category-group-boundaries-are-24px`
      .groupHeading:first-of-type { margin-top: 0 } was written to suppress the top margin on the first heading only, but each group sits in its own <section> and :first-of-…
      **Do:** Scope the suppression correctly — `section:first-of-type .groupHeading { margin-top: 0 }`, or a modifier class on the first section — which alone restores the intended 2.5rem break. …
      `components/archive/archive.module.css:212-232`, `app/october-7/documentation/page.tsx:41-53`
      `low` · `layout` · `trivial effort`

- [ ] `archive-brief-witness-label-duplicates-the-value-it-labels`
      witness_name is not a name — it is the source site's byline phrase — so the dateline renders "WITNESS Gili Y.'s story" on all 505 testimony version pages and in all 179 index meta lines.
      **Do:** Add `displayWitness()` beside `displayTitle()` in `lib/content/archive.ts` and call it from `ArchiveRecord.tsx:62` and `ArchiveRecordList.tsx:53`. The filed regex `/['’]s\s+story$/i` misses both malformed values; …
      `components/archive/ArchiveRecord.tsx:59-64`, `components/archive/ArchiveRecordList.tsx:52-53`, `components/archive/archive.module.css:137-162`
      `low` · `content-design` · `trivial effort`

- [ ] `archive-brief-two-shells-now-disagree-about-the-card-and-the-closing-apparatus`
      sections.module.css:307-311 records the deliberate removal of the card — "no border, no translucent panel, no blur… the card chrome was reading as a floating box rathe…
      **Do:** Reverse the direction and shrink it: drop `.article`'s two gold-tinted borders and the `0 2rem 7rem` shadow, keep its `rgba(8,14,24,0.965)` ground (load-bearing behind the unmasked `.quietBackdrop`), and record that as the reconciliation. …
      `components/briefs/geopolitical-brief.module.css:316-323`, `components/sections/sections.module.css:307-316`, `components/briefs/GeopoliticalBrief.tsx:217-235`, `components/sections/DocPage.tsx:61-62`
      `low` · `consistency` · `medium effort`

---

### Cross-cutting — accessibility, responsive, motion, interaction

9 tasks here, plus 3 in Wave 1.

#### Medium — 6

- [ ] `cross-cutting-composer-triggers-ios-zoom`
      13.12px text in the composer and the answers
      **Do:** Set `.composer textarea { font-size: var(--t-body); line-height: var(--t-body-lh); }` and raise `min-height`/`max-height` proportionally so the auto-grow at `AskTheLionChat.tsx:180-185` still clips at roughly the same line count — carry the new line-height …
      `components/chat/ask-the-lion-chat.module.css:220`, `components/chat/ask-the-lion-chat.module.css:514-528`, `components/support/support.module.css:27-38`
      `medium` · `interaction` · `trivial effort`

- [ ] `cross-cutting-identity-band-17px-exit`
      the sole exit is a 17px-tall target
      **Do:** In the `@media (max-width: 900px)` block at `sections.module.css:651` — where the band already wraps and `.identityExit` already gets `flex-basis: 100%` — add `.wordmark, .identityExit { display: inline-flex; align-items: center; min-height: 44px; }`. …
      `components/sections/sections.module.css:270-309`, `components/sections/sections.module.css:684-690`, `components/sections/SectionPage.tsx:130-145`, `components/sections/DocPage.tsx:40-51`
      `medium` · `accessibility` · `trivial effort`

- [ ] `cross-cutting-chat-and-archive-touch-targets`
      nine controls at 15–42px
      **Do:** `.retry`, `.newThread` → `min-height: 44px; display: inline-flex; align-items: center;`; `.composer button` → 2.75rem to match `.close`; …
      `components/chat/ask-the-lion-chat.module.css:189-200`, `components/chat/ask-the-lion-chat.module.css:301-313`, `components/chat/ask-the-lion-chat.module.css:381-394`, `components/chat/ask-the-lion-chat.module.css:433-447`, `components/chat/ask-the-lion-chat.module.css:532-542`, `components/archive/archive.module.css:182-208`
      `medium` · `accessibility` · `small effort`

- [ ] `cross-cutting-chat-never-got-v2`
      the chat surface is the last V2 holdout
      **Do:** Give these two files the Phase 3 pass the ten routes got: replace every literal with the nearest of `--ink-hi`/`--ink`/`--ink-lo`/`--gold`/`--gold-hi`; …
      `components/chat/ask-the-lion-chat.module.css:47-64`, `components/chat/ask-the-lion-chat.module.css:144-158`, `components/chat/ask-the-lion-chat.module.css:167-187`, `components/chat/ask-the-lion-chat.module.css:433-473`, `components/chat/particle-chat-launcher.module.css:159-192`, `components/chat/particle-chat-launcher.module.css:296-318`
      `medium` · `typography` · `medium effort`

- [ ] `cross-cutting-forms-die-without-js`
      both `/support-us` forms discard a submission
      **Do:** Ship the aria fix as filed — correct and self-contained: `aria-invalid={touched && !hasContent}` on `#report-url` and `#report-body`, an id on the error `<p>` referenced by `aria-describedby` from both, and focus moved to `#report-url` when the guard trips. …
      `components/support/ReportClaimForm.tsx:102`, `components/support/ReportClaimForm.tsx:127-129`, `components/support/VolunteerInterestForm.tsx:55`, `components/support/VolunteerInterestForm.tsx:112`
      `medium` · `accessibility` · `medium effort`

- [ ] `cross-cutting-inner-scroll-chrome-budget`
      every reading route is its own scroll container
      **Do:** Drop the filed "cheap and immediate" half: a `--chat-dock-h` derived from 57px would under-reserve and put text under the dock, the exact failure `sections.module.css:38-41` warns about, and `CHAT_DOCK_PX = 84` is asserted in …
      `app/globals.css:126-132`, `components/sections/sections.module.css:43-52`, `components/sections/sections.module.css:684-690`, `components/briefs/geopolitical-brief.module.css:37-48`, `components/briefs/geopolitical-brief.module.css:747-800`
      `medium` · `responsive` · `large effort`

#### Low — 3

- [ ] `cross-cutting-breakpoint-sprawl`
      ten widths against a four-width canon
      **Do:** Do not apply the filed sweep. Leave `fake-resistance:201`, `october-7:64`, `our-heroes:176` and `war-update:204` exactly as they are — two carry written or documented justifications and two are padding-only. Three things are worth doing. …
      `components/home/home.module.css:487-490`, `app/we-are/page.module.css:183`, `app/israels-story/page.module.css:166`, `app/october-7/page.module.css:103`
      `low` · `consistency` · `small effort`

- [ ] `cross-cutting-figurerow-three-up-on-phones`
      .figures is repeat(3, minmax(0, 1fr)) with no collapse until max-width: 359px.
      **Do:** Move the collapse into the shared component as its own `@media (max-width: 640px)` block, matching the threshold October 7 already chose: `.figures { grid-template-columns: minmax(0, 1fr); gap: 1.5rem; …
      `components/content/content.module.css:428-436`, `components/content/content.module.css:987-997`, `components/content/content.module.css:1025-1036`, `app/october-7/page.module.css:63-75`
      `low` · `responsive` · `small effort`

- [ ] `cross-cutting-launcher-advertises-offline-desk`
      .label runs attentionCue 7.2s … infinite while the desk is offline: the capability probe hits GET /api/v1/chat/threads, gets a 500 because no database is provisioned, …
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

- [ ] **Provision `NEXT_PUBLIC_ARCHIVE_CDN`.** Every archive record page
      currently logs a 404 for its media. This is the one step the archive
      integration is still waiting on and it needs credentials, not code.
      Upload each package's `assets/originals` and `assets/web` under
      `<package>/`, set the variable, then prove it with
      `node scripts/verify-archive-assets.mjs <base> --all` — a wrong value
      fails quietly: pages build, tests pass, text renders, only media 404s.
- [ ] **Repair `package-lock.json`** in its own commit, as above.
- [ ] **Phase 5 — home-scene orbit labels** is recorded in `.ai/DESIGN-V2.md`
      as open and a user decision, not an audit finding. The audit's
      `home-scene-orbit-labels-below-legibility-floor` is the in-place fix
      that does not pre-empt it.
