# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

@AGENTS.md

## What this is

A single-page cinematic experience for Lions of Zion, merged from two previously separate Next.js apps: a particle-lion intro and a photographic-lion landing page. Everything on screen is WebGL. There is no page content below the fold.

Deployed at `lionsofzion1/lions-of-zion` on Vercel; source is `lions-admin/lions-of-zion` (private). Git auto-deploy is **not** connected — the Vercel account cannot see private repos under `lions-admin`, so deploys are run from the CLI.

## The journal

`.ai/STATE.md` (where the work stands, what is in flight, what is blocked) and
`.ai/DECISIONS.md` (why things are as they are, append-only) are loaded into
every session automatically by a `SessionStart` hook — you do not need to open
them.

The split is deliberate and worth keeping: **this file is what stays true**
(architecture, invariants, traps), the journal is **what changes**. A newly
found trap that will still hold in six months belongs here, not there.

When a session moves the work, update the journal before finishing — `/sync`
walks through it. A `Stop` hook says so when source files are newer than
`.ai/STATE.md`.

## Commands

```bash
npm run dev              # next dev
npm run build            # next build
npm run lint             # eslint
npx tsc --noEmit         # typecheck — there is no typecheck script
```

There is no test framework in this repo. Verification is visual; see below.

Regenerating the lion particle data from a source image (needs `sharp`, a devDependency used only here):

```bash
npm run build:lion-data -- /absolute/path/to/source.png [public/assets/lion-structure.bin]
```

## Verifying changes — read this before trusting a screenshot

**The in-app browser pane cannot render this project.** It reports `document.visibilityState === "hidden"`, so the browser suspends `requestAnimationFrame` (measured: 0 callbacks/sec). Both scenes animate entirely in rAF, so the pane shows a black, frozen rectangle no matter what the code does. Fronting the tab does not fix it.

Verify in real Chrome instead, driven by `playwright-core` (already a devDependency):

```js
chromium.launch({ headless: false,
  executablePath: '/Applications/Google Chrome.app/Contents/MacOS/Google Chrome' })
```

Headless Chromium is also wrong for the homepage scene — it falls back to SwiftShader, and a software rasteriser is exactly the case the GPU probe rejects. `scripts/final-verify.mjs` is an existing example of the real-Chrome pass.

Any change to the intro's timing, copy, or composition **must** be screenshotted before moving on. Text sits in a lane the lion vacates; a change that looks correct in the timeline can still land the copy across the lion's face.

## Architecture

### Two WebGL scenes on one page, overlapping

`app/page.tsx` → `components/Experience.tsx`, which mounts both at once:

- `components/LionExperience.tsx` — the photographic lion homepage (three.js, displacement shader, ~38k sampled particles from `public/lions/lion.jpg`).
- `components/intro/lion-scene.tsx` — the particle intro, mounted **over** it with `mode="handoff"`.

They are not sequential mounts. The homepage renders from the first frame and the intro plays on top of it. The intro's renderer is `alpha: true` with `setClearColor(0x000000, 0)`, so what holds the black is the intro's own `.introVeil`, which fades over 2.8s when the outro starts. By the time the veil lifts, the homepage lion has been waking underneath for ~20s.

That is also why every escape is free: `Skip intro`, a WebGL failure (`onFailure`), and `prefers-reduced-motion` all just unmount the intro, and the finished page is already there. `Experience.tsx` reads reduced-motion during render via `useSyncExternalStore` so such a viewer never sees one frame of the intro.

**Stacking gotcha:** `LionExperience`'s wrapper is `position: fixed` with `z-index: auto`, so its own z-indexed typography (20–22) would escape into the root stacking context and paint through the intro. It carries `isolation: isolate` to contain them, and `.scene` in `lion-scene.module.css` carries `z-index: 1` to sit above. Both are load-bearing.

### The intro timeline

Split across two modules, and the split matters:

- `components/intro/story-timeline.ts` — the copy (`STORY_BEATS`), the phase constants (black → formation → lion hold → relocation → story), and `getTimelineFrame()`, which drives the lion's shader uniforms (`lionFormation`, `lionWind`, `lionRelocation`).
- `components/intro/rolling-story-timeline.ts` — turns beats into the rolling four-line window that is actually rendered, and owns `isComplete` / `outroProgress` / `brandProgress`. This is the module the scene reads for text.

Couplings that break silently if you edit copy:

1. **Duration is derived from line count**, not declared. Each line starts at `ROLLING_STORY_START + index * ROLLING_LINE_CADENCE` (1.25s). `desktopLines`/`mobileLines` are flattened across all beats, so adding or removing a *line* changes how long the intro runs. The tail after the last line (join hold, cleanup, centering, brand, final hold, outro) is fixed at roughly 20s and does not shrink with the copy.
2. **`STORY_PARAGRAPHS` indexes `STORY_BEATS[0]` through `[11]` explicitly**, and `STORY_BEAT_STARTS` has exactly 12 entries. Changing the *number* of beats breaks both. Shortening the words inside 12 beats does not.
3. **`lion-scene.tsx` emphasises one beat by id**: `beatId === "battlefield-for-truth"`. Renaming that id silently drops the emphasis.
4. **`desktopLines` and `mobileLines` must each rejoin to `text` with a single space.** The file documents this; nothing enforces it. Watch separators — splitting `"A · B · C"` across rows drops the middot unless you keep it on the first row.

Layout (`desktop` | `mobile`) is chosen from viewport in `resize()` and switches which line set renders, so both sets need art-directed breaks.

### The lion structure binary

`public/assets/lion-structure.bin` (1.3 MB) is the intro's particle cloud: a `LION` v1 header then 84,773 × 16-byte records, sampled 360×540. Written by `scripts/build-lion-data.mjs`, parsed in `loadStructure()` in `lion-scene.tsx`.

Positions are quantised with hardcoded scales — x/3.1, y/4.65, z/1.2 — that appear **separately in the writer and the reader**. They must stay in sync or the lion silently deforms. The parser validates magic, version, record size and byte length, so a stale `.bin` fails loudly; a mismatched *scale* does not.

`public/assets/gentilis_regular.typeface.json` (627 KB) feeds `three/addons/loaders/FontLoader` for the particle text in `particle-text.ts`.

### Known cruft

`components/LionExperience.tsx` still carries a headless-verification harness from its original repo: it sets `window.__ceedErrors`, appends a hidden `#__errlog` node, and adds `error`/`unhandledrejection` listeners that its cleanup never removes. It is the source of the repo's three standing lint warnings. Nothing reads it.

`scripts/gen-image.mjs` and `scripts/prompt-*.txt` are leftovers that call OpenRouter to generate source imagery; they are not part of the build.

`reactStrictMode` is deliberately **off**. `lion-scene.tsx` was written to survive a strict-mode double mount; `LionExperience.tsx` was not.
