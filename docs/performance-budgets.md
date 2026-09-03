# Performance budgets

Measured on 2026-09-03 against a Next.js 16.3.2 Turbopack production build of
this repository. Every number here was produced by `npm run perf:report` after
`npm run build`; nothing in this document is an estimate, and nothing is a
round number somebody liked the look of.

Regenerate the whole thing with:

```bash
npm run build
npm run perf:report            # the table below, plus the budget check
npm run perf:report -- --json  # the same, machine-readable
```

## Where the numbers come from, and why not from `next build`

Next 16's Turbopack build prints route names, `Revalidate` and `Expire` — and
no sizes. The **"First Load JS" column this repository's notes still refer to
no longer exists**, so a per-route budget cannot be scraped from build stdout
and has to be computed from the build's own manifests.

`scripts/perf-report.mjs` does that:

| Quantity | Read from |
| --- | --- |
| First-load JS | `rootMainFiles` + `polyfillFiles` (`.next/build-manifest.json`) plus the route's own `entryJSFiles` (`.next/server/app/**/page_client-reference-manifest.js`) |
| Route CSS | that manifest's `entryCSSFiles` for the same entry |
| Client boundary | that manifest's `clientModules`, minus `node_modules` |
| Preloaded fonts | `.next/server/next-font-manifest.json` |
| Bytes | the emitted files on disk; gzip is `zlib.gzipSync(level 9)` |

Gzip at level 9 tracks a CDN's `content-encoding: gzip` closely enough to
budget against and is reproducible on any machine. Brotli would be a little
smaller in production; the *relative* movement a budget cares about is the
same.

## PERF-001 — Route-level bundle and client-boundary report

### Every route, measured

`/_global-error` and `/_not-found` are the framework floor: they carry the
shared payload and nothing else.

| Route | First-load JS (gzip) | First-load JS (raw) | Route CSS (gzip) | Preloaded fonts | Client modules |
| --- | ---: | ---: | ---: | ---: | ---: |
| `/admin/login` | 274.9 kB | 970.8 kB | 24.3 kB | 386.1 kB | 3 |
| `/particle-demo` | 242.9 kB | 768.5 kB | 21.2 kB | 386.1 kB | 3 |
| `/pipeline` | 220.0 kB | 718.8 kB | 21.6 kB | 386.1 kB | 3 |
| `/` | 206.5 kB | 660.8 kB | 39.4 kB | 386.1 kB | 4 |
| `/fake-resistance/network` | 189.2 kB | 614.6 kB | 37.1 kB | 386.1 kB | 6 |
| `/support-us` | 188.7 kB | 611.3 kB | 37.1 kB | 386.1 kB | 10 |
| `/october-7/documentation` | 187.8 kB | 609.5 kB | 37.5 kB | 386.1 kB | 5 |
| `/october-7/testimonies` | 187.8 kB | 609.5 kB | 37.5 kB | 386.1 kB | 5 |
| `/ask` | 187.5 kB | 606.5 kB | 37.7 kB | 386.1 kB | 5 |
| `/october-7/documentation/[category]/[slug]` | 186.0 kB | 606.7 kB | 37.1 kB | 386.1 kB | 7 |
| `/october-7/documentation/[category]/[slug]/[locale]` | 186.0 kB | 606.7 kB | 37.1 kB | 386.1 kB | 7 |
| `/october-7/testimonies/[slug]` | 186.0 kB | 606.7 kB | 37.1 kB | 386.1 kB | 7 |
| `/october-7/testimonies/[slug]/[locale]` | 186.0 kB | 606.7 kB | 37.1 kB | 386.1 kB | 7 |
| `/corrections` | 183.9 kB | 595.7 kB | 37.1 kB | 386.1 kB | 5 |
| `/fact-check` | 183.9 kB | 595.7 kB | 39.0 kB | 386.1 kB | 5 |
| `/fake-resistance` | 183.9 kB | 595.7 kB | 38.0 kB | 386.1 kB | 5 |
| `/fake-resistance/cases/[slug]` | 183.9 kB | 595.7 kB | 38.1 kB | 386.1 kB | 5 |
| `/fake-resistance/official-narrative` | 183.9 kB | 595.7 kB | 38.5 kB | 386.1 kB | 5 |
| `/fake-resistance/playbook` | 183.9 kB | 595.7 kB | 38.2 kB | 386.1 kB | 5 |
| `/fake-resistance/social-media` | 183.9 kB | 595.7 kB | 37.1 kB | 386.1 kB | 5 |
| `/israels-story` | 183.9 kB | 595.7 kB | 38.5 kB | 386.1 kB | 5 |
| `/methodology` | 183.9 kB | 595.7 kB | 38.1 kB | 386.1 kB | 5 |
| `/october-7` | 183.9 kB | 595.7 kB | 38.3 kB | 386.1 kB | 5 |
| `/our-heroes` | 183.9 kB | 595.7 kB | 38.0 kB | 386.1 kB | 5 |
| `/war-update` | 183.9 kB | 595.7 kB | 38.1 kB | 386.1 kB | 5 |
| `/we-are` | 183.9 kB | 595.7 kB | 38.2 kB | 386.1 kB | 5 |
| `/information-war` | 183.6 kB | 595.4 kB | 40.2 kB | 386.1 kB | 4 |
| `/search` | 183.5 kB | 594.9 kB | 37.1 kB | 386.1 kB | 5 |
| `/account` | 183.2 kB | 593.6 kB | 37.1 kB | 386.1 kB | 4 |
| `/updates` | 183.2 kB | 594.4 kB | 38.6 kB | 386.1 kB | 4 |
| `/geopolitical-brief` | 182.8 kB | 593.9 kB | 39.5 kB | 386.1 kB | 4 |
| `/admin` | 182.1 kB | 598.4 kB | 39.8 kB | 386.1 kB | 4 |
| `/articles/[publicId]` | 181.6 kB | 588.3 kB | 37.1 kB | 386.1 kB | 4 |
| `/_global-error` | 166.2 kB | 539.9 kB | 0.0 kB | 0.0 kB | 0 |
| `/_not-found` | 166.2 kB | 539.9 kB | 0.0 kB | 386.1 kB | 2 |

Shared framework payload: **539.9 kB raw / 166.2 kB gzip** across 7 chunks —
90 % of what a reading route ships. A public reading route adds **17.7 kB
gzip** of its own on top of it. The site's own code is not what is large here;
React, the App Router client and the polyfill bundle are.

### Server pages stay server components — with one exception

**`app/particle-demo/page.tsx` is the only `app/**/page.tsx` marked
`"use client"`.** Every other route page in the repository is a server
component, and every client module reaches the browser through an island the
page mounts rather than through the page itself.

`/particle-demo` is a development surface: `next.config.ts` redirects it to `/`
in production. It is still compiled, prerendered and shipped as a 242.9 kB
static route, and it is the second-heaviest route in the build. **Deleting the
route, rather than redirecting it, is the fix** — it belongs to whoever owns
`components/particle-nav/**`, and is recorded here as a finding, not done.

### The client boundary of every route

Routes with identical islands are grouped. `app/error.tsx` and
`components/site/SiteHeader.tsx` appear on everything, because the root layout
mounts both.

| Routes | Islands |
| --- | --- |
| `/corrections`, `/fact-check`, `/fake-resistance` (+ `/cases/[slug]`, `/official-narrative`, `/playbook`, `/social-media`), `/israels-story`, `/methodology`, `/october-7`, `/our-heroes`, `/war-update`, `/we-are` | `Reveal`, `ReadingProgress`, `SectionToc` |
| `/october-7/{documentation,testimonies}/**` record pages | `ArchiveImage`, `ShareRecord`, `SensitiveContent`, `ReadingProgress`, `SectionToc` |
| `/october-7/documentation`, `/october-7/testimonies` | `ArchiveIndex`, `ReadingProgress`, `SectionToc` |
| `/` | `CinematicIntroGate`, `TypographicField` |
| `/support-us` | `Reveal`, `ReadingProgress`, `SectionToc`, `PayPalDonateStep`, `ReportClaimForm`, `ShareControls`, `SupportFlowSwitch`, `VolunteerInterestForm` |
| `/fake-resistance/network` | `Reveal`, `ReadingProgress`, `SectionToc`, `InfluenceGraph` |
| `/ask` | `AskDesk`, `ReadingProgress`, `SectionToc` |
| `/search` | `SearchPageView`, `ReadingProgress`, `SectionToc` |
| `/geopolitical-brief` | `BriefFilters`, `ReadingProgress` |
| `/information-war` | `InformationWarBeams`, `ReadingProgress` |
| `/updates` | `ReadingProgress`, `SectionToc` |
| `/articles/[publicId]` | route `error.tsx`, `ReadingProgress` |
| `/account` | `PublicAuthControl`, `ReadingProgress` |
| `/pipeline` | `pipeline-visualizer/index.tsx` |
| `/admin` | `AdminStatus`, `PublicationManager` |
| `/admin/login` | `AdminLogin` |
| `/particle-demo` | **the page itself** |

## PERF-003 — The client-marked file census

**70 files carry `"use client"`.** Not 64, which is what the 2026-09-02 audit
recorded, and not 43, which is what `grep -rl '"use client"'` finds: **28 of
the 70 use single quotes**, and the earlier counts each missed part of the
population. Any future re-count must match both quote styles.

| Directory | Files |
| --- | --- |
| `components/particle-nav` | 15 |
| `components/pipeline-visualizer` | 10 |
| `components/ask` | 7 |
| `components/search` | 6 |
| `app/admin` | 5 |
| `components/support` | 5 |
| `components/archive` | 4 |
| `components/ui` | 3 |
| `components/auth`, `components/briefs`, `components/motion`, `components/sections` | 2 each |
| `app/articles`, `app/error.tsx`, `app/particle-demo`, `components/content`, `components/network`, `components/site`, `components/typographic-field` | 1 each |

Only **28** of the 70 are boundary *entry points* — a module a server
component imports directly. The other 42 are pulled in transitively by an
island that already crossed the line, which is what the directory clustering
above shows: `particle-nav` and `pipeline-visualizer` are two components as
far as any route is concerned.

### One consolidation was made

`components/search/vocabulary.ts` imported `ENTITY_TYPES` from
`@/server/contracts/enums` **as a value**. That file builds every one of its
Zod schemas at module scope (`enumOf(...)` is a call, so no bundler may treat
it as pure), and it is reached from `SearchPanel` → `SearchDialog` →
`SearchLauncher` → `SiteHeader`, which the root layout mounts on every public
route. One word therefore linked the whole of `zod` into the client graph:

| | Before | After | Change |
| --- | ---: | ---: | ---: |
| `/` | 269.3 kB gz | 206.5 kB gz | **−62.8 kB gz** |
| every other public route | 246.7 kB gz | 183.9 kB gz | **−62.8 kB gz** |
| raw, all of them | | | **−278.6 kB** |

The import is type-only now, and `entityRank`'s fallback reads
`Object.keys(LABELS)`; `LABELS` is declared `Record<EntityType, string>`, so
TypeScript already refuses to compile it unless it names every type. No second
copy of the enum lives in the client.

**Client module count is unchanged at 70 — the consolidation removed a
dependency, not a boundary.** That is the correct shape of a change under this
task's "does not pull more code into a client bundle" test.

### Consolidations considered and *not* made

- **`SearchLauncher` statically imports `SearchDialog`**, so the entire search
  overlay — panel, results, `useSearch` — hydrates in the header of every
  route whether or not anyone opens it. Deferring it behind `next/dynamic`
  would move roughly 8 kB gzip off the critical path. It was left alone: 8 kB
  against a 166 kB framework floor does not justify a loader boundary in the
  one component every route depends on, and `SearchLauncher`'s own comment
  documents why the anchor and its overlay are deliberately one unit.
- **`components/ui/index.ts` is a `"use client"` barrel.** It does not
  currently widen anything — no route's `clientModules` names a `components/ui`
  module, so the tree-shaking is working — but a barrel with a directive at the
  top is one careless re-export away from dragging `Dialog`, `Tabs` and
  `Tooltip` into every consumer. `components/ui/**` is out of this pass's
  scope; flagged for whoever owns it.

## PERF-005 — Media, fonts and layout dimensions

**No avoidable CLS was found, responsive `sizes` are correct, and below-fold
media is lazy.** The archive media pipeline is already careful; the findings
below are byte-weight and dead weight, not layout stability.

### Every media call site

| Call site | Dimensions | `sizes` | Loading | Verdict |
| --- | --- | --- | --- | --- |
| `app/page.tsx:97` `<Image src={lionMark} fill priority>` | `.brandMark` sets `aspect-ratio: 1226 / 1283` | `(max-width: 768px) 180px, 250px` | `priority` | correct — no CLS, correct DPR ceiling |
| `components/archive/ArchiveImage.tsx:72` `<img>` | `width`/`height` from the package | `(max-width: 720px) 100vw, 720px` | `lazy` + `decoding="async"` | correct |
| `components/archive/ArchiveRecordList.tsx:219` `<img>` | `width`/`height` from the package | `160px` | `lazy` + `decoding="async"` | correct |
| `components/archive/ArchiveBlocks.tsx:508` `<video>` | `width`/`height` fall back to the poster's | — | `preload="metadata"`, no autoplay | correct |
| `components/particle-nav/CinematicIntroGate.tsx:50` `<picture>` | none on the `<img>`, but the frame is `position: absolute; inset: 0` inside a `MediaBlock aspectRatio="1 / 1"` | — | default | no CLS; see finding below |

The two `<img>` elements are deliberate, with an ESLint disable and a written
reason: they are CDN-hosted archive derivatives whose dimensions the package
already carries, and `next/image` would re-optimise 1.8 GB of already-derived
WebP for no gain. That reasoning holds.

### Fonts — the largest per-route number on the site

`app/layout.tsx` loads Newsreader (variable, `opsz`, normal + italic), IBM Plex
Sans (400/500/600, normal + italic) and JetBrains Mono (400/500/600), all
`display: "swap"`, all `subsets: ["latin"]`. Next's size-adjusted fallback
faces are generated for all three, so **`swap` costs no layout shift**.

Twenty-four woff2 files are emitted; **five are preloaded, on every route
but `/_global-error`**, totalling **386.1 kB**:

| woff2 | Face | Bytes |
| --- | --- | ---: |
| `2b7d3311…` | Newsreader **italic**, variable, latin | 147,060 |
| `d38f3bca…` | Newsreader normal, variable, latin | 131,848 |
| `37a1c047…` | IBM Plex Sans italic 400/500/600, latin | 44,916 |
| `03fc1b4a…` | IBM Plex Sans normal 400/500/600, latin | 40,240 |
| `051742…` | JetBrains Mono, latin | 31,340 |

**386 kB of fonts is more than double the 166 kB framework payload and more
than twenty times a reading route's own JS.** The single largest item is
Newsreader *italic* at 147 kB, preloaded on every route while italic display
type appears on six: the homepage standfirst, `/fake-resistance/playbook`,
`/our-heroes`, `/war-update`, the fact-check desk, and archive pull-quotes.
Every italic rule in the repository is on `--face-display`; **IBM Plex Sans
italic is loaded but no rule ever asks for it** (it is not preloaded, so it
costs nothing at runtime — only six emitted files).

The fix is a second `Newsreader({ style: ["italic"], preload: false })`
instance with its own CSS variable, and one rule in `app/globals.css` binding
the italic display face to it. **Not done**: `app/globals.css` is outside this
pass's surface, and `next/font` has no per-style `preload`, so it cannot be
done in `app/layout.tsx` alone. Expected saving: **147 kB of preload on the 27 routes
that set no italic**.

The generated `@font-face` set also carries Cyrillic, Cyrillic-Ext, Greek and
Vietnamese ranges for IBM Plex Sans despite `subsets: ["latin"]`. Those are not
preloaded and only download if such a glyph appears, so this is build weight,
not runtime weight.

### Static assets

7,472 kB across `public/` and `logos/`. Four files over 512 kB:

| File | Bytes | Status |
| --- | ---: | --- |
| `logos/79eef03d-…png` | 2,106,151 | the homepage brand mark, 1226×1283, rendered at 180–250 px. `next/image` optimises it per request, so this is build weight; the source is ~5× larger than any variant served. |
| `public/editorial/geopolitical-brief.png` | 2,030,583 | **referenced by nothing.** |
| `public/particles/lion-v2-180k.bin` | 1,406,494 | particle tier data — the motion surface owns it |
| `public/particles/lion-v2-90k.bin` | 703,357 | same |

`public/editorial/` (2,039 kB across three PNGs) is named by no `.ts`, `.tsx`,
`.css`, `.mjs` or `.json` in `app/`, `components/`, `lib/` or `scripts/`. Two
of its three files are byte-identical in size to `public/icons/october-7.sdf.png`
and `our-heroes.sdf.png`, which is what a stale copy of a directory looks like.
It is served publicly at `/editorial/*`. **Deletion is CLEAN-008's**; this is
the evidence.

The SDF icons under `public/icons/` are reached only through the template
literal `` `/icons/${item.id}.sdf.png` `` in `components/particle-nav/config.ts`,
which is why `perf-report.mjs` matches interpolated directory paths as well as
literal filenames.

### Findings deferred to the surfaces that own them

- `components/particle-nav/CinematicIntroGate.tsx:52` — the poster `<img>` is
  the homepage LCP element on the no-WebGPU fallback path and carries no
  `fetchPriority="high"`. One attribute; the motion surface owns the file.
- The archive record pages' lead image is `loading="lazy"`. A `priority` prop
  threaded from `ArchiveBlocks` was written, built and **measured to fire on
  zero of the 1,219 prerendered pages**, so it was reverted rather than
  committed as dead code: documentation records gate every image behind
  `SensitiveContent` (`sensitivity.gate: 'all'`), and no testimony record opens
  on a photograph — all 691 archive `<img>` elements in the build are genuinely
  below the fold. Re-open this only if a record type is added that leads with
  an image.
- `next.config.ts` declares no `images.formats`. Adding `image/avif` would
  shrink the one `next/image` call site on the homepage. Left alone: PERF-005's
  acceptance is CLS, `sizes` and lazy loading, all of which already pass.

## PERF-008 — CSS output, and the evidence for deletion

**Report only. Nothing was deleted; deletion is CLEAN-008.**

- 56 CSS Modules, 20,122 source lines
- 408.1 kB emitted raw / 63.8 kB gzip across all emitted stylesheets
- Per route, 37–40 kB gzip on public reading routes

**70 CSS Module class selectors are named by no `.ts` or `.tsx` file in the
repository.** The check is deliberately loose in the safe direction: a class is
treated as *referenced* if it appears after a `styles.` accessor, inside a
`styles[...]` index, or anywhere as a quoted string — so a class assembled by
template literal or passed through a lookup map is never reported. It
over-reports safety and never under-reports it.

| Module | Dead / total | Classes |
| --- | ---: | --- |
| `components/pipeline-visualizer/visualizer.module.css` | 28 / 182 | `canvasFloatingToolbar` `canvasToolBtn` `canvasToolBtnActive` `drawerCloseBtn` `explainerToggleBtn` `glossaryCatTab` `glossaryCatTabActive` `glossaryModalContent` `glossaryModalHeader` `glossaryModalSubtitle` `glossaryModalTitle` `glossaryPillBtn` `glossaryTermEn` `htmlCodeBadge` `htmlLaneTitleEn` `inspectorDrawer` `interactiveCanvasContainer` `journeyTab` `journeyTabActive` `modalBackdrop` `modalCloseBtn` `nodeLinkEn` `playbackBtn` `playbackBtnPlay` `speedBtn` `speedBtnActive` `viewModeBtn` `viewModeBtnActive` |
| `components/content/content.module.css` | 17 / 76 | `cardBody` `cardEyebrow` `cardFooter` `cardMeta` `dateStamp` `entryTitle` `networkCaption` `networkCenter` `networkCenterSub` `networkCount` `networkDisc` `networkFigure` `networkLabel` `networkRing` `networkScroll` `networkSvg` `tokens` |
| `app/war-update/page.module.css` | 12 / 20 | `byline` `colophonNote` `datelinePlace` `dispatchActions` `dispatchMain` `dispatchSources` `emptyFilter` `filterRow` `headline` `latest` `wire` `wireBody` |
| `components/briefs/live-brief.module.css` | 5 / 35 | `emptyState` `evidenceContract` `heroFigure` `statHero` `statQualifier` |
| `components/ask/ask.module.css` | 4 / 55 | `askButton` `primerBody` `primerExampleArrow` `resetButton` |
| `components/support/support.module.css` | 2 / 8 | `checkboxRow` `fieldset` |
| `app/admin/admin.module.css` | 1 / 67 | `editorPanel` |
| `components/sections/sections.module.css` | 1 / 49 | `askCta` |

Three of the eight tell a story worth knowing before CLEAN-008 runs:

- **`visualizer.module.css`** carries a whole second interaction model —
  toolbars, tabs, a modal backdrop, playback and speed controls — that no
  component mounts. It is 28 of the file's 182 classes.
- **`content.module.css`**'s eleven `network*` classes describe a ring diagram
  with an SVG and a scroller. `components/network/InfluenceGraph.tsx` renders
  the network page today and uses none of them.
- **`app/war-update/page.module.css`** is 12 dead of 20. `war_update` is
  retired from production (see `CLAUDE.md`); the route still renders, on eight
  classes.

Spot-checked by hand: `networkSvg`, `cardBody`, `askCta`, `editorPanel`,
`glossaryModalTitle`, `headline`, `wire` and `latest` each have **zero**
occurrences anywhere under `app/`, `components/` or `lib/`.

## PERF-009 — The budgets, and the gate

`scripts/perf-budgets.json` holds them. Bundle budgets are the measurements
above plus 5 % on a size or one whole unit on a count.

| Budget | Measured | Budget | Basis |
| --- | ---: | ---: | --- |
| shared framework JS | 166.2 kB gz | 174.5 kB gz | the floor every route pays |
| worst public reading route JS | 188.7 kB gz | 198.1 kB gz | `/support-us`, the heaviest non-tool public route |
| homepage JS | 206.5 kB gz | 216.8 kB gz | `/`, which carries the GPU field |
| worst route CSS | 40.2 kB gz | 42.2 kB gz | `/information-war` |
| preloaded fonts per route | 386.1 kB | 405.4 kB | identical on every route |
| `"use client"` files | 70 | 74 | the boundary census |
| client route pages | 1 | 2 | `/particle-demo`; a second one must be argued for |

`npm run perf:report` exits non-zero when any of these is exceeded, so it is
usable as a CI gate directly after `npm run build`. `--warn-only` reports
without failing.

### Runtime budgets are declared and uncalibrated

`home_lcp_ms`, `home_cls`, `home_gpu_first_frame_ms`, `reading_lcp_ms`,
`reading_cls`, `archive_lcp_ms`, `archive_cls`, `archive_filter_ms` and
`archive_inp_ms` are all `null`. The script measures every one of them in
headless Chromium — LCP and layout shift through `PerformanceObserver`, INP
from the `event` entry's duration on a driven interaction, GPU startup as wall
time to the homepage canvas's first painted frame, archive interaction as wall
time from a filter keystroke to the list settling — but it needs an origin:

```bash
npm run build && npm run start        # a server you control
npm run perf:runtime -- http://localhost:3000 --update-budgets
```

They are `null` rather than guessed because **this pass was not permitted to
take a port**, and PERF-009 asks for budgets derived from real measurements. A
`null` budget reports as `uncalibrated` and warns; it never silently passes.
Whoever runs the calibration should read the diff before committing it — the
first run on a fast laptop will set generous numbers for CI hardware.

## What this pass changed

- `components/search/vocabulary.ts` — the zod removal above.
- `scripts/perf-report.mjs`, `scripts/perf-budgets.json`, `package.json` — the
  tooling and the three npm scripts.
- This document.

Everything else in this file is a finding, with the surface that owns it named.
