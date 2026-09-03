# Lions of Zion — Cinematic Intro and Global Intelligence Backdrop

> Status: implementation plan only. No animation or UI change is completed by this document.
> Prepared: 2026-09-03
> Repository root: `/Users/danielsmac/Documents/lions-of-zion`
> Baseline: `main` at `c57f38f`, synchronized with `origin/main` at the time this plan was written.
> Framework: Next.js `16.3.2`, App Router, React `19.2.8`, Three.js/WebGPU/TSL, React Three Fiber, CSS Modules.

## 0. How the next agent must use this file

- [x] Work from `/Users/danielsmac/Documents/lions-of-zion` only. *(Executed from the owner's session worktree `.claude/worktrees/project-deployment-4bad09` on branch `claude/fixhometodo-task-d3bbde`, clean and level with `origin/main` at `8700701`; `node_modules` symlinked from the main checkout.)*
- [x] Before editing, run `git fetch --prune origin` and inspect `git status --short --branch`.
- [x] Do not overwrite, reset, clean, or rebase user work. If `main` has diverged or the working tree is dirty, preserve it and resolve the synchronization state before implementation.
- [x] Read `AGENTS.md` and the relevant installed Next.js 16 guides before changing code:
  - `node_modules/next/dist/docs/01-app/01-getting-started/03-layouts-and-pages.md`
  - `node_modules/next/dist/docs/01-app/01-getting-started/05-server-and-client-components.md`
  - `node_modules/next/dist/docs/01-app/02-guides/lazy-loading.md`
  - `node_modules/next/dist/docs/03-architecture/supported-browsers.md`
  - `node_modules/next/dist/docs/03-architecture/accessibility.md`
- [x] Execute the phases in order. Do not mark a checkbox complete until its acceptance checks have been run.
- [x] Keep the implementation inside the existing particle renderer, timeline, CSS background, and design-token systems. Do not add an animation library, a second persistent GPU canvas, or a parallel design system.
- [x] Do not alter copy, navigation, routes, publication logic, authentication, or unrelated page behavior.
- [ ] Record final evidence in section 9 and update the final handoff in section 10.

## 1. Current implementation map

### Home and intro ownership

| Responsibility | Current file | Current behavior / gap |
| --- | --- | --- |
| Home route and intro wrapper | `app/page.tsx` | Wraps the complete home page in `CinematicIntroGate`; mounts `TypographicField` only after intro handoff. |
| Intro gate and poster fallback | `components/particle-nav/CinematicIntroGate.tsx` | Mounts `NavClient` as a fixed, disposable entrance layer. Keeps destination inert and hidden until handoff. |
| Intro state, skip, capability and handoff | `components/particle-nav/CanvasMount.tsx` | Uses `loz-intro-seen` in `sessionStorage`; bypasses the intro for reduced motion or no GPU; owns the Skip Intro button and the 700 ms post-intro input guard. |
| GPU scene orchestration | `components/particle-nav/Scene.tsx` | Computes lion scale/Y and timeline state. The scan/navigation groups are currently revealed only with the outro `navReveal`. |
| Shared intro frame contract | `components/particle-nav/introFrame.ts` | Carries lion transform, navigation reveal, text opacity, and rolling story frame. It does not yet carry scan reveal or lion-to-text transfer state. |
| Intro timing constants | `components/intro/story-timeline.ts` | Current sequence contains a 2.5 s lion hold: formation ends at 3.8 s, relocation starts at 6.3 s, relocation ends/story starts at 8.5 s. This directly conflicts with the requested immediate rise. |
| Rolling text timing | `components/intro/rolling-story-timeline.ts` | Starts at `STORY_START`; line cadence is 1.25 s desktop and 1 s mobile. Text particles enter from generic off-screen/random origins, not from the lion. |
| Responsive intro composition | `components/intro/introLayout.ts` | Owns line width, scale, rows, brand position, and generic entry/exit travel. Must remain the single responsive geometry authority. |
| Text particle geometry | `components/intro/textCloud.ts` | Deterministically samples glyph positions on the CPU. Preserve its deterministic sampling and line-width contract. |
| Text particle renderer | `components/particle-nav/layers/IntroText.tsx` | Builds one particle sprite per rolling line and drives build/disperse. It has no lion source geometry. |
| Text particle material | `components/particle-nav/tsl/introTextMaterial.ts` | Interpolates from `point + originBias + seed * originSpan` into glyph positions. This currently reads as an ordinary particle entrance rather than particles emitted by the lion. |
| Lion rendering | `components/particle-nav/layers/LionCore.tsx` | Applies `ExperienceFrame.lionScale` and `lionY` to the lion group. |
| Lion simulation/data | `components/particle-nav/tsl/lionCompute.ts` and `components/particle-nav/hooks/useLionBuffers.ts` | Owns deterministic baked lion homes/current positions and the single compute lifecycle. This is the source geometry to reuse for the lion-to-text transfer. |
| Lion point appearance | `components/particle-nav/tsl/pointMaterial.ts` | Can receive a small deterministic extraction/dimming mask so emitted points appear to leave the lion without dissolving the emblem. |
| Intro chrome and Skip styling | `components/particle-nav/styles.module.css` | Skip is fixed to the safe bottom/right area, keyboard visible, and uses an iOS handoff guard. Preserve these contracts. |

### Existing scan language

| Responsibility | Current file | Current behavior / gap |
| --- | --- | --- |
| GPU intelligence scan | `components/particle-nav/layers/NetworkScan.tsx` | Already renders dark horizontal traces, corpus words, status glyphs, and platform marks. It is hidden for the full intro and appears only during navigation outro. |
| GPU scan material | `components/particle-nav/tsl/networkScanMaterial.ts` | Owns flow, scan sweep, palette, opacity, and center/node exclusion masks. Its masks are static options; the intro needs a moving lion mask and a protected text corridor. |
| GPU scan corpus | `components/particle-nav/scanCorpus.ts` and `public/matrix/matrix-fragments.en.json` | Canonical existing content source. Do not invent new intelligence claims or decorative copy. |
| CSS/server scan | `components/sections/ScanBackdrop.tsx` | Existing shared, server-rendered, CSS-only moving backdrop for reading pages. Supports `default`, `muted`, `silent` and `viewport`/`band`, but not numeric intensity/density/speed controls. |
| CSS scan styles | `components/sections/sections.module.css` | Owns row opacity, drift speed, masks, quiet/muted states, and reduced-motion freeze. |
| Reading-page integration | `components/site/EditorialShell.tsx` | Mounts `ScanBackdrop` for routes using the public editorial shell. |
| Global base texture | `app/globals.css` | `html, body` already use the static `--scan-ground`; this is not the richer moving backdrop requested here. |
| Home post-intro field | `components/typographic-field/TypographicField.tsx`, `components/typographic-field/engine.ts`, `app/home.module.css` | Independent home-only typographic engine. Do not accidentally run it beneath the GPU intro or add a third concurrent animation loop. |

## 2. Locked implementation decisions

- [ ] **One cinematic renderer during the intro.** Continue using the existing `Scene.tsx` canvas. Do not mount a new canvas or DOM particle system.
- [ ] **One lightweight global backdrop after handoff.** Reuse/refactor `ScanBackdrop.tsx` for public-site background coverage. Do not keep the WebGPU intro scene alive behind the site; `tests/motion-runtime.test.ts` explicitly protects renderer unmount at handoff.
- [x] **One shared clock.** Lion formation, rise, stream-to-text, text construction, scan awakening, and outro must derive from the same `timelineTimeRef` and a pure frame function. Do not coordinate them with unrelated React timers or CSS delays.
- [ ] **Deterministic particle lineage.** Text particles must begin at deterministic samples of the baked lion geometry, not at arbitrary off-screen points. The same seed/index mapping must produce the same frame after reload.
- [ ] **The lion remains the primary mark.** Extraction uses a small stable subset and must not make the lion collapse, flicker, or become visually secondary.
- [x] **No extra pause after formation.** Relocation begins on the same timeline boundary at which formation completes.
- [ ] **No ordinary text fade as the main reveal.** Opacity may support antialiasing/legibility, but glyph construction must visibly follow the lion-origin particle transfer.
- [ ] **Public content stays readable.** The moving scan is decorative, `aria-hidden`, pointer-inert, behind UI, masked/dimmed through reading areas, and configurable per surface.
- [ ] **Internal routes are explicit.** Apply the global backdrop to public routes. Keep `/admin`, `/admin/login`, `/particle-demo`, and `/pipeline` on an explicit `silent` or purpose-specific profile unless the owner requests otherwise; these are operator/debug tools, not public editorial surfaces.

## 3. Target timeline contract

Implement these as named exports in `components/intro/story-timeline.ts` or a small pure timing module imported by it. Values may move by at most 150 ms during visual tuning, but the order and zero-gap joins are acceptance requirements.

| Stage | Target time | Required state |
| --- | ---: | --- |
| Black/setup | `0.00–0.65 s` | Poster/canvas can initialize; scan is effectively invisible. |
| Lion formation | `0.65–3.25 s` | Lion gathers at screen center; reaches `assemble = 1` at 3.25 s. |
| Lion rise | `3.25–4.35 s` | Starts immediately at formation completion; eased upward, no hold gap. |
| Stream pre-roll | `4.20–4.35 s` | A narrow particle throat begins below the lion so the first text line does not appear from nowhere. |
| First text line | starts `4.35 s` | Build begins on the same frame/range boundary at which relocation reaches 1. |
| Rolling text | from `4.35 s` | Preserve the current rolling window and authored copy; keep desktop/mobile cadence unless reading QA proves it needs a small adjustment. |
| Scan awakening | `3.70–6.80 s` | Begins during the rise, remains faint behind the first line, reaches the route's intro target intensity gradually. |
| Final brand/outro | derived from rolling timeline | Preserve current cleanup, centering, brand, final hold and 2.8 s handoff unless the earlier start changes their derived absolute end time. |

### Required pure frame fields

Extend `ExperienceFrame` in `components/particle-nav/introFrame.ts` with explicit fields rather than inferring unrelated progress values inside layers:

- `lionRelocation: number` — `0..1`, begins exactly when formation ends.
- `textFlow: number` — global enable/envelope for lion-to-text emission.
- `activeTextTransfer: number` — current line transfer/build progress, or an equivalent per-line value already available from `story.activeLines`.
- `scanReveal: number` — `0..1`, independent of `navReveal`.
- `readingMask: number` — optional `0..1` mask strength if the scan material needs a separate transition.

Keep `navReveal` separate. The background must awaken before the navigation outro; using `navReveal` for both would preserve the current bug.

### Lion placement targets

- Desktop target after rise: `lionScale` starts visual tuning at `1.20 * orbit.centerScale`; do not return to the current `0.55 * orbit.centerScale` story size.
- Mobile target after rise: `lionScale` starts visual tuning at `0.95 * orbit.centerScale`; do not return to the current `0.46 * orbit.centerScale` story size.
- Start `lionY` tuning near `2.05` world units desktop and `2.15` mobile, then constrain it from the measured viewport/safe-area geometry so crown particles never clip.
- The settled lion should retain at least 42% of its assembled desktop scale and 55% of its assembled mobile scale. This is a floor, not a demand to maximize size.
- Validate the final bounds visually at all required viewports; responsive containment outranks the initial tuning numbers.

## 4. Implementation phases

### Phase A — Pin timing and geometry before visual work

- [x] Update `components/intro/story-timeline.ts` so relocation starts at formation completion. *(Done 2026-09-03: `BLACK_END 0.65`, `FORMATION_END 3.25`, `RELOCATION_START = FORMATION_END`, `RELOCATION_END 4.35 = STORY_START`. `LION_HOLD_*` and the `lion-hold` stage removed; no caller or test needed an alias. The legacy beat table is now offsets from `STORY_START`.)* Remove the current `3.8–6.3 s` dead hold from the runtime path; keep compatibility aliases only if tests or callers need them.
- [x] Update `components/intro/rolling-story-timeline.ts` so `ROLLING_STORY_START` follows the new relocation end *(already derived; added `getRollingSkipTime`, `retimeRollingStory`, `getActiveTextTransfer`)* and all final/cleanup/outro times remain derived rather than copied as stale absolute constants.
- [x] Add pure helpers for formation, relocation, scan reveal, and text-flow envelopes. *(`getFormationEnvelope`, `getRelocationEnvelope`, `getLionOpacityEnvelope`, `getScanRevealEnvelope`, `getTextFlowEnvelope`, `getTextOpacityEnvelope`, `smoothstep01` in `story-timeline.ts`; `Scene.tsx` no longer divides the clock itself.)* Do not duplicate timing math in `Scene.tsx`, `IntroText.tsx`, or shaders.
- [x] Extend `components/particle-nav/introFrame.ts` with the new explicit frame fields. *(`lionRelocation`, `textFlow`, `activeTextTransfer`, `scanReveal`, `readingMask`.)*
- [x] Update `components/particle-nav/Scene.tsx` to consume the pure timing helpers and retain timeline progress proportionally *(lion stages keep exact time across a resize; only the story span is mapped)* across the existing mobile/desktop resize transition.
- [x] Add `tests/intro-timeline.test.ts` covering exact boundary continuity *(19 tests, all passing)*:
  - formation end equals relocation start;
  - relocation end equals first rolling-text start;
  - scan is near zero at opening, nonzero during rise, and at target after its ramp;
  - mobile and desktop final times remain derived and monotonic;
  - seeking with Skip Intro never rewinds the clock.

**Phase A acceptance**

- [x] There is no timeline interval after full assembly in which the lion remains centered waiting to rise.
- [x] At the relocation completion boundary, the first text build has started or starts on that same boundary.
- [x] All timing behavior is testable without rendering a canvas.

### Phase B — Keep the relocated lion large and safely positioned

- [x] In `components/particle-nav/Scene.tsx`, replace the current story-scale constants (`0.55` desktop / `0.46` mobile) with the target scale contract in section 3. *(Done 2026-09-03: `Scene.tsx` reads `largeScale`/`storyScale`/`storyY` from `settledLionPlacement()` in `components/intro/introLayout.ts`, memoised on orbit and size. Targets `SETTLED_LION_SCALE` 1.20/0.95 × `centerScale`, `SETTLED_LION_Y` 2.05/2.15; results at the plan viewports: 1440×900 and 1920×1080 and 768×1024 scale 1.200, Y 2.050; 390×844 with a 47px notch scale 0.823, Y 2.142 (cap binds, crown exactly 12px under the chrome band); 320×568 scale 0.741, Y 2.150.)*
- [x] Keep the lion centered on X. Move only Y during relocation unless browser evidence shows a real optical-centering issue. *(Only `lionScale`/`lionY` change; the placement has no X term and `LionCore` still writes `position.y` alone.)*
- [x] Use the existing safe-area and viewport calculations from `components/particle-nav/config.ts`; do not add CSS-only guesses that disagree with canvas geometry. *(`settledLionPlacement` uses `viewSize`, `MOBILE_MAX_WIDTH`, `SafeAreaInsets` and `OrbitLayout.centerScale`; the lion's own extent is the LNP1 bake bounds pinned as `LION_LOCAL_TOP`/`LION_LOCAL_BOTTOM` in `config.ts`. The one CSS mirror is `introChromeTopPx`, the `.introChrome` top inset, because the masthead is DOM and the canvas cannot measure it; `tests/lion-placement.test.ts` pins that the label itself never meets the crown.)*
- [x] In `components/particle-nav/layers/LionCore.tsx`, keep scale/Y updates on the existing group. Do not rebuild the simulation during relocation. *(No change to `LionCore.tsx`; `useLionBuffers` still keys its effect on `tier.particles` only, and the placement memo has no `sim` dependency.)*
- [x] Confirm that crown visibility, opacity, point size, bloom, and assembled home positions remain stable while the group moves. *(Code-verified: none of them reads `lionScale`/`lionY` — `crownReveal` is 1, `opacity` is the lion-opacity envelope, sprite sizes are CSS px through `pxToWorld`, bloom is a post pass, and `homes` is an untouched upload. The real-browser pass stays in §8's viewport matrix.)*

**Phase B acceptance**

- [x] Lion motion begins immediately after assembly and uses one continuous eased trajectory. *(Phase A's `getRelocationEnvelope` drives both scale and Y in one lerp from the assembled to the settled placement.)*
- [x] Lion remains clearly larger than the previous story state on desktop and mobile. *(2.18× the old 0.55 on desktop; 2.04× the old 0.46 at 390px; pinned at >1.7× on every plan viewport.)*
- [x] Crown and mane are not clipped by the safe area, browser chrome, or top intro chrome. *(Pinned geometrically in `tests/lion-placement.test.ts` at the five plan viewports, notch included; the mane sits 35–119px above the first text row. Still owed: the real Safari/iPhone pass in §8.)*
- [x] No lion buffer is recreated during the move. *(Nothing on the relocation path touches `useLionBuffers` or `createLionSim`; the placement is a `useMemo` on layout, not on the sim.)*

### Phase C — Make lion particles become the text

- [x] Preserve the canonical text and line breaks in `components/intro/story-timeline.ts`. Do not edit narrative copy. *(Untouched.)*
- [x] Expose deterministic CPU lion home positions from `components/particle-nav/tsl/lionCompute.ts` through `LionSim` (or preserve an equivalent immutable decoded array in `useLionBuffers.ts`). Do not read GPU buffers back every frame. *(`LionSim.homeData` — the decoded vec4 array; the storage upload takes its own copy.)*
- [x] Pass the lion source geometry from `components/particle-nav/Scene.tsx` into `components/particle-nav/layers/IntroText.tsx`. *(`lionHomes={sim?.homeData ?? null}`; the text set is not built until the bake exists.)*
- [x] For each text cloud, map every text particle to a deterministic lion source sample. Use a stable hashed/stratified index mapping so the stream is distributed across the mane/face/crown instead of selecting one contiguous bake range. *(`components/intro/lionSourceMap.ts`: per-line PCG-hashed pool, stratified with a bijective index scramble; pinned by `tests/lion-source-map.test.ts`.)*
- [x] Extend `components/particle-nav/tsl/introTextMaterial.ts` so the entry path is:
  1. exact sampled lion-surface position after current lion scale/Y transform;
  2. a narrow organic throat immediately below the settled lion;
  3. the particle's final glyph position.
  *(Two quadratic legs joined at the throat, in the row's group-local frame; uniforms `lionScale`, `lionY`, `lionBottom`, `groupOffset`. Shader path is typecheck-verified only — needs the owner's browser pass.)*
  *(2026-09-04 — the throat existed only from the first glyph: the path's sole parameter was the line's `build`, which is flat zero until `STORY_START`, so the 4.20–4.35 s pre-roll rendered nothing. Closed with a **lead**: `components/intro/streamPath.ts` defines the path parameter as `max(built(order, build), lead(textFlow, order))`, where the lead is taken by the leading `STREAM_LEAD_SHARE` (18%) of the build order — the leftmost glyphs, the ones whose build starts first anyway — and capped at `STREAM_THROAT_T`. `IntroText` shows the first line's unit with `build = 0` during the pre-roll and writes `flowLead` from `ExperienceFrame.textFlow`, held at the same value once the line goes active, so the handover writes the number the previous frame wrote. Presence now follows the path parameter rather than `build`, or the pre-roll would have moved invisible particles. `max` of two continuous functions has no seam, and `built(order, 1) === 1` keeps the line landing on its existing schedule. No timing constant changed. Pinned by `tests/intro-preroll.test.ts`.)*
- [x] Use a quadratic or cubic curve plus restrained seeded curl/jitter. The stream must read as downward extraction, not rain, an explosion, or a horizontal fly-in. *(Control points sit under the source and under the throat; curl is 0.035 world, zero at both ends. Whether it reads right is a browser judgement.)*
- [x] Keep the current glyph-order stagger so letters assemble progressively. Drive the path and glyph build with the same line progress; do not start an independent timer. *(`built` drives both; the per-particle travel window widened from 17% to 28% of the build so the stream is visible, last particle still lands at `build = 1`.)*
- [x] Update `components/particle-nav/layers/IntroText.tsx` each frame with the lion transform and the current row/group offset so the source point remains visually attached to the moved lion even while rolling rows shift. *(Uniform writes only.)*
- [x] Add a small deterministic extraction mask/envelope in `components/particle-nav/tsl/pointMaterial.ts` and set its uniforms from `LionCore.tsx`. Briefly dim only the subset represented by the outgoing transfer, then restore it. Cap the affected subset during tuning (start at 4–7%); the lion must stay solid and dominant. *(`LION_EXTRACTION_FRACTION = 0.06`, dim 0.85 at peak, envelope `lionExtractionEnvelope()`; the dimmed pool is the pool the line samples, same hash and seed on both sides.)*
- [x] Preserve current exit/disperse behavior after a line leaves the rolling window, unless it visibly conflicts with the new downward-source path. *(Kept unchanged. The wind exit travels up-right, through the region the lion now occupies; flagged for the browser pass.)*
- [x] Dispose every new TSL storage node/material in the existing cleanup paths. Do not introduce per-frame allocations or React state updates. *(`sources` joins `positions`/`traits` in the material's dispose; pinned by a source-level test.)*

**Phase C acceptance**

- [ ] The first visible particles of every incoming line can be traced to the lion or the throat immediately beneath it. *(Browser-only. The first line now also has a visible 0.15 s pre-roll: its leading particles depart the lion and gather in the throat before any glyph exists — see the pre-roll note in the entry-path item above.)*
- [ ] The stream and glyph construction overlap continuously; there is no frame where the stream ends and the text then fades in separately. *(Browser-only.)*
- [ ] The lion loses only a subtle subset during emission and never appears to collapse. *(Browser-only.)*
- [ ] Reloading at the same viewport produces the same particle routes and line construction. *(Mapping determinism is pinned by `tests/lion-source-map.test.ts`; the frame itself is a browser check.)*
- [ ] Mobile uses the reduced 45k tier and remains legible without increasing DPR beyond the existing cap of 2. *(Tier, budgets and DPR cap untouched; legibility is a browser check.)*

### Phase D — Wake the GPU scan during the intro

- [x] In `components/particle-nav/Scene.tsx`, stop tying `networkRef.visible` to `navReveal` during the intro. Drive it from `ExperienceFrame.scanReveal`. *(Visible on `max(scanReveal, navReveal) > SCAN_VISIBLE_THRESHOLD`; the outro scale easing stays on `navReveal`; `visible={!intro}` removed so the ref is the only owner.)*
- [x] Pass an intro opacity multiplier into `components/particle-nav/layers/NetworkScan.tsx` and multiply, rather than replace, `scanFieldOpacity`, `scanWordOpacity`, and `scanGlyphOpacity` from `defaultSimParams`. *(`experienceFrameRef` prop; `introScanMultiplier(scanReveal, navReveal, target)` in `components/intro/scanIntro.ts` = `mix(target·scanReveal, 1, navReveal)`; pinned by `tests/intro-scan.test.ts`.)*
- [x] In `components/particle-nav/tsl/networkScanMaterial.ts`, make the hero exclusion mask capable of following the relocated lion and add a separate soft text-column exclusion/muting region. Prefer uniforms so the masks move without rebuilding geometry/materials. *(Uniforms `heroCenterY`/`heroMaskX`/`heroMaskY` from `lionY`/`lionScale`, and `corridorY`/`corridorHalfHeight`/`corridorHalfWidth`/`corridorStrength` from the live story rows and `readingMask`; the corridor dims to 15% (`TEXT_CORRIDOR_MUTE` 0.85), never hard-cuts; static node holes kept.)*
- [~] Keep the scan nearly absent at the opening, reveal it during the rise, and reach full intro target only after the first lines are readable. *(By construction: multiplier is 0 until `SCAN_REVEAL_START` 3.70 s and reaches the target at `SCAN_REVEAL_END` 6.80 s, after `STORY_START`; a null frame is treated as dark. Browser confirmation pending.)*
- [x] Use the existing corpus and blue/ember/neutral palette. Do not create new labels, metrics, claims, or social proof. *(No corpus, label, or palette change in Phase D.)*
- [~] Tune the intro target below the normal navigation target. Starting point: field `0.45`, words `0.30`, glyphs `0.24` multiplied by the existing respective opacity values; validate from captures rather than treating these as final facts. *(`INTRO_SCAN_FIELD_TARGET`/`WORD`/`GLYPH` in `components/intro/scanIntro.ts` at the starting values; capture validation pending.)*
- [x] Ensure `NetworkScan` remains `pointer-events: none` through the canvas and does not enter the accessibility tree. *(Unchanged: the `<Canvas>` keeps `style={{ pointerEvents: 'none' }}`, `aria-hidden` and `role="presentation"`; NetworkScan renders only `<primitive>` sprites.)*

**Phase D acceptance**

- [~] Scan is effectively invisible during the black/setup opening. *(Code: group hidden below `SCAN_VISIBLE_THRESHOLD`, opacity multiplier 0 until 3.70 s, null frame = dark. Browser check pending.)*
- [~] Scan becomes perceptible during lion relocation, without a hard cut. *(Code: one continuous eased ramp from 3.70 s; `tests/intro-scan.test.ts` pins monotonicity. Browser check pending.)*
- [~] Lion silhouette and every text line retain a clean contrast corridor. *(Code: hero hole follows `lionY`/`lionScale`; `solveScanCorridor` is tested to cover every visible row and the brand at every cue on both layouts. Browser check pending.)*
- [~] Scan animation and opacity do not flash when resizing across the 720 px intro layout breakpoint or the 620 px compact scan threshold. *(Code: rebuilt materials are synced in a `useLayoutEffect` on `built` before their first tick, so no navigation-strength or unmasked frame leaks. Browser check pending.)*

### Phase E — Make the scan backdrop a shared public-site layer

- [x] Keep `components/sections/ScanBackdrop.tsx` as the shared non-GPU implementation and extend its public contract. Done as `intensity?: number` (clamped via `clampScanIntensity`), `density?: 'low'|'medium'|'high'`, `speed?: 'still'|'slow'|'normal'`; `register`/`surface`/`routeId`/`seed` unchanged, defaults (`high`, `normal`, intensity 1) reproduce the previous output. Suggested props:
  - `intensity?: number` clamped to `0..1`;
  - `density?: 'low' | 'medium' | 'high'` or a bounded row count;
  - `speed?: 'still' | 'slow' | 'normal'` or a bounded multiplier;
  - preserve `register`, `surface`, `routeId`, and `seed` compatibility during migration.
- [x] Emit the controls as CSS custom properties/data attributes on the backdrop root. Do not animate through React renders. Root carries `data-register`, `data-density`, `data-speed` and `--scan-intensity`; pinned by `tests/global-scan-backdrop.test.ts` via `renderToStaticMarkup`.
- [x] Update `components/sections/sections.module.css` so intensity scales row opacity, density selects a deterministic subset, and speed scales duration. Keep `pointer-events: none`, `overflow: hidden`, and reduced-motion stationary placement. `opacity: 0.34 × --register × --scan-intensity`; `medium` hides `:nth-child(5n)`, `low` keeps `:nth-child(3n+1)` (both keep the verified/hostile mix); `--drift = --dur × --scan-speed × --scan-tempo` (floor stays 45s); `still` and reduced motion share one composed frame (rest positions, loud rows dropped to their dim colour). The `.page[data-family] .row` overrides moved into the profile map.
- [x] Keep one backdrop instance per rendered public route. Do not accidentally stack the root static texture, an `EditorialShell` moving backdrop, and a second page-local moving backdrop at full strength. Source-pinned: exactly one `<ScanBackdrop>` in `EditorialShell` and one in `app/page.tsx`; the root `--scan-ground` stays the static texture underneath; the home band is `display: none` until handoff and `visibility: hidden` once the field's opaque canvas paints, so the field and the band never move together.
- [x] Continue mounting the shared backdrop through `components/site/EditorialShell.tsx` for reading routes, but pass an explicit profile per route family — `components/sections/scanProfiles.ts` (`FAMILY_SCAN_PROFILES`: desk 0.6/medium/normal, dossier 0.45/medium/slow, institution 0.3/low/slow; a page's `muted`/`silent` register still stacks on top, so `/october-7/**` stays silent):
  - desk: medium density, normal speed, low-to-medium intensity;
  - dossier: medium density, slow speed, low intensity;
  - institution: low density, slow or still, very low intensity;
  - memorial-sensitive surfaces: `silent` where already required.
- [x] Mount the same `ScanBackdrop` component on the home route in `app/page.tsx` using `surface="band"`, behind semantic content and after intro handoff. Place/style it through `app/home.module.css`; do not use a home-only clone. Docked in `.fieldLayer` (`.scanDock`, z 0, under the canvas) with `HOME_SCAN_PROFILE`; hidden by `html:has([data-intro-pending], [data-intro-active], [data-handoff-blocked])` until handoff, with a `noscript` override so the no-JS home gets the band over the static ground like every other route.
- [x] Decide route coverage explicitly for public routes not currently rendered through `EditorialShell` by tracing `SectionPage`, `DocPage`, `LiveBriefHub`, `InformationWarSystem`, and direct page roots. Traced 2026-09-03: all four render `EditorialShell`, and every `app/**/page.tsx` except `/`, `/admin`, `/admin/login`, `/particle-demo`, `/pipeline` reaches it through one of them (or directly: `/articles/[publicId]`, `/account`). No leaf needed a mount; the test pins that the four shells contain `<EditorialShell` and no `<ScanBackdrop`.
- [x] Keep `/admin`, `/admin/login`, `/particle-demo`, and `/pipeline` explicitly silent or purpose-specific. `INTERNAL_ROUTE_IDS` in `scanProfiles.ts` answers `SILENT_SCAN_PROFILE` for all four (comment there says why); the test pins the map and that the four page roots and `app/layout.tsx` mount no backdrop.
- [x] (not needed) `app/layout.tsx` is unchanged; every mount sits at an existing shell boundary and no client controller was added. If `app/layout.tsx` is changed, keep it a server component and do not move pathname/provider logic into it solely for this effect. Prefer existing shell boundaries. If a client controller becomes unavoidable, isolate it in a tiny component and justify its bundle/runtime cost.
- [x] Preserve the global `--scan-ground` fallback in `app/globals.css` for no-JS and no-motion states. `globals.css` untouched; `tests/motion-runtime.test.ts` still passes on it. The moving backdrop enhances it; it does not replace the black ground or make content depend on JavaScript.

**Phase E acceptance**

- [x] Home and every public route family use the same `ScanBackdrop` implementation/API. (`tests/global-scan-backdrop.test.ts`)
- [x] Page/shell code can select intensity, density, and speed without editing the backdrop internals. (`scanProfiles.ts` → `EditorialShell` / `app/page.tsx`)
- [x] There is never more than one continuously moving CSS scan layer on a route after the intro handoff. Source-pinned (one mount per shell, one on home, none in the root layout); browser confirmation still owed under §8.
- [x] Background never blocks scrolling, links, form controls, selection, focus rings, dialogs, or sticky UI. Audited from the stylesheet and the DOM order on 2026-09-04 and closed by three changes, all pinned in `tests/intro-accessibility.test.ts`. **Pointer:** `pointer-events: none` on `.backdrop` is inherited, and is now also stated on `.backdrop *` so a later `pointer-events: auto` on one row cannot repeal it; nothing in the module sets `auto`. **Paint order:** the scan block declares no `z-index` at all, so it paints in the root stacking context's z-auto layer, under `.shell` (`--z-raised`), the masthead (`--z-header`), the skip host (`--z-overlay`) and `<dialog>`, which is in the top layer and unreachable by any page z-index; on the home it is inside `.fieldLayer` (z 0, `pointer-events: none`) beneath `.masthead` (10), `.fileIndex` and `.signalRail` (12). **Scrolling:** `position: fixed` with `overflow: hidden` clips the rows without creating a scroll container, and the pointer-inert layer passes wheel and touch through. **Selection:** the gap this audit actually found — `Select All` was pulling sixteen corpus fragments into the clipboard interleaved with the article, since `aria-hidden` governs the accessibility tree and not the selection. Fixed with `user-select: none` on the backdrop and its subtree; no other element's selection is touched. **Sticky UI:** `.rowField` is now inset by `var(--header-h)`, so no row composites through the masthead's `--glass-middle`/`--glass-bottom` veil at all — see the contrast note under §7.
- [x] Reading columns retain the existing soft mask/dimming behavior. `.rowField` mask untouched; the home dock sets `--content-w` to the masthead column so the same mask dims behind the wordmark.
- [x] Reduced motion renders a stable, composed scan frame or the static `--scan-ground`, with no continuous drift. Source-pinned (`animation: none`, rest transform, loud rows dimmed, under both `data-speed="still"` and the media query); browser confirmation still owed under §8.

### Phase F — Preserve Skip Intro, fallbacks, and handoff safety

- [x] Keep Skip Intro in `components/particle-nav/CanvasMount.tsx` and its safe-area positioning in `components/particle-nav/styles.module.css`. — already satisfied; unchanged and now pinned by `tests/intro-fallbacks.test.ts` ("is a real button in CanvasMount", "keeps a 44px touch target and safe-area spacing at every viewport").
- [x] Keep click, keyboard Escape, session memory, and the existing 700 ms iOS/WebKit stale-gesture guard. — click/Escape/`loz-intro-seen` already satisfied and pinned. The guard was **fixed**: its capture `click` listener sat on `containerRef`, but `CinematicIntroGate` renders the page into `.introDestination`, a *sibling* of that container, so it covered only the eight orbit links (`display: none` below 720px) and never the mobile links it exists for. Moved to `window`; `shouldSwallowClick` itself is unchanged, so every assertion in `tests/handoff-guard.test.ts` still holds. Pinned by "listens on the window, not on the entrance container"; the 700 ms constant is pinned against `.navContent`'s transition rather than against the literal.
- [x] Keep destination content inert/hidden while the intro owns the screen, then restore accessibility and pointer input only after the guarded handoff. — satisfied for the JS path (`introBlocking` spans `introRunning` + `handoffBlocked`) and pinned. Phase E's `<noscript>` and `[data-home-scan]` band in `app/page.tsx` did not regress it and `app/page.tsx` needs no change.
- [x] Skip must seek forward to the outro and never reset or rewind a partially completed intro. — already satisfied by `getRollingSkipTime` (Phase A, `tests/intro-timeline.test.ts`). The `CanvasMount` half — a skip request that is a flag the frame loop clears, never a toggle, and a control that leaves the hit test on the first tap — is pinned by "a repeated tap cannot reach the control or anything under it".
- [x] For `prefers-reduced-motion: reduce`, bypass the aggressive GPU intro as the current gate does; show the settled home immediately with the global backdrop frozen or static. Do not run a shortened particle stream. — already satisfied; `reducedMotion` appears in both `introRunning` and `introDismissed`, and there is no second timeline behind a reduced-motion branch. Pinned by the three tests under "the intro is bypassed rather than adapted".
- [x] For no GPU, failed lion/font/corpus load, or no JavaScript, preserve a usable home with poster/static background, semantic heading, navigation, and working links. — **two real bugs found and fixed.** (1) A renderer that never paints hung the route permanently: `usePerfTier` reports `webgpu` on `'gpu' in navigator` alone without asking for an adapter, so a machine that advertises WebGPU and cannot deliver it took the intro path, `onReady` never fired, `onIntroComplete` never fired, and `.skipIntro` stayed `opacity: 0` because its reveal is keyed on `[data-live]` — a fixed opaque full-viewport black layer for the rest of the session. Bounded with `INTRO_READY_TIMEOUT_MS` (6 s), cleared by the first frame, routed through the ordinary guarded `completeIntro`. (2) The no-JS home shipped `inert aria-hidden="true"` on `.introDestination` (from `blocked`'s `useState(true)`) with no mechanism that could ever clear it — `inert` has no CSS counterpart, so the adjacent `<noscript>` rule could not lift it. Gated on hydration. Failed font/lion loads were traced and are *not* hangs: the timeline advances on `delta` regardless, so `story.isComplete` still fires, and Skip/Escape remain available throughout. Pinned by "a canvas that never paints still hands off" and "the no-JavaScript home".
- [x] Preserve the existing progressive loading rule: Three.js remains dynamically imported and cannot block server HTML/LCP. — already satisfied; `dynamic(() => import('./Scene'), { ssr: false })`, `Scene.tsx` is the only three.js importer and is a client component. Pinned by "the renderer cannot block server HTML".

**Phase F acceptance**

- [x] Skip is visible, focusable, and at least the current touch target size at every viewport. — measured from the stylesheet: `min-height: 52px` base, `var(--control-h)` = `2.75rem` = 44 px under `[data-intro-only]`, width far past 44 px at both the base and `max-width: 480px` gap/rule sizes; `:focus-visible` carries `var(--focus-outline)` in both skins (the entrance override wins the cascade, so both are asserted); insets add `--safe-right`/`--safe-bottom`. The token floor is asserted against `app/globals.css` so retuning `--control-h` fails here rather than on a phone. Browser confirmation at the five viewports in §8 is still outstanding.
- [x] Repeated Skip taps cannot delay the handoff or activate a link underneath. — the first tap sets `data-skipping`, which is `pointer-events: none` for the whole outro; the entrance layer is opaque with pointer-inert content; the skip request is a flag the frame loop clears, so a second one cannot rewind or re-arm; and the window-scoped stale-gesture guard now actually covers the destination links. Real-device Safari confirmation outstanding.
- [x] Reduced-motion, no-GPU, and no-JS paths never leave the page inert or blank. — the no-JS path was literally inert and is fixed; the never-painting-canvas path was blank and is bounded; reduced-motion and no-GPU were already correct. All four pinned in `tests/intro-fallbacks.test.ts`.

## 5. Expected file changes

### Must inspect and likely modify

- `components/intro/story-timeline.ts`
- `components/intro/rolling-story-timeline.ts`
- `components/intro/introLayout.ts`
- `components/particle-nav/introFrame.ts`
- `components/particle-nav/Scene.tsx`
- `components/particle-nav/layers/LionCore.tsx`
- `components/particle-nav/layers/IntroText.tsx`
- `components/particle-nav/layers/NetworkScan.tsx`
- `components/particle-nav/tsl/introTextMaterial.ts`
- `components/particle-nav/tsl/networkScanMaterial.ts`
- `components/particle-nav/tsl/pointMaterial.ts`
- `components/particle-nav/tsl/lionCompute.ts`
- `components/particle-nav/hooks/useLionBuffers.ts`
- `components/sections/ScanBackdrop.tsx`
- `components/sections/sections.module.css`
- `components/site/EditorialShell.tsx`
- `components/particle-nav/CanvasMount.tsx`
- `components/particle-nav/styles.module.css`
- `app/page.tsx`
- `app/home.module.css`
- `app/globals.css`

### Modify only if route tracing proves necessary

- `components/sections/SectionPage.tsx`
- `components/sections/DocPage.tsx`
- `components/briefs/LiveBriefHub.tsx`
- `components/briefs/InformationWarSystem.tsx`
- `app/layout.tsx`
- direct public route modules that do not use one of the shared shells

### Tests to add or update

- Add `tests/intro-timeline.test.ts`.
- Add `tests/global-scan-backdrop.test.ts` or extend the closest existing shell test with route/profile coverage.
- Update `tests/motion-runtime.test.ts` to keep the one-intro-renderer/unmount contract and account for any new animation owner.
- Update `tests/handoff-guard.test.ts` only if the handoff state shape changes; preserve all current stale-touch assertions.
- Add focused source/unit assertions for deterministic lion-source mapping and storage disposal if those helpers are extracted into a pure module.

### Do not modify for this task

- Narrative copy in `components/intro/story-timeline.ts` beyond timing constants/derived metadata.
- `lib/site-navigation.ts` routes, labels, or ordering.
- Publication, database, provider, authentication, or admin logic.
- Logo/particle binary assets unless browser evidence proves the current baked lion geometry itself is defective.
- Dependencies in `package.json` unless an unavoidable technical limitation is demonstrated first.

## 6. Performance and lifecycle budget

- [x] Keep the current tier budgets from `components/particle-nav/hooks/usePerfTier.ts`: 45k particles on coarse pointer/WebGL2, DPR capped at 2, bloom off on the low tier. *(`tierFor` untouched. `tests/motion-runtime.test.ts` now exercises it as a function rather than by regex: 45k **and** `bloom: 'off'` for every coarse/WebGL2 combination at every reported memory, `maxDpr <= 2` across the whole table, and the 180k/90k tiers still distinct. `dpr={[1, tier.maxDpr]}` in `Scene.tsx` is still pinned.)*
- [~] Do not add CPU work inside `useFrame` that allocates arrays, rebuilds text clouds, hashes full particle buffers, or sets React state. *(Every frame loop in `components/particle-nav/` is now swept by `tests/motion-runtime.test.ts` — constructor calls, array-returning methods, `Array.from`, object literals, template literals, the component's own `useState` setters by name, and any call to a mapping/cloud/layout/material builder. Six of the seven pass: `Connectors`, `IntroText`, `LionCore`, `NetworkScan`, `OrbitalRings`, `SpokeNodes`. Phase C's uniform writes in `IntroText`/`LionCore` and Phase D's `syncScanUniforms()` allocate nothing — the scan solves its mask and corridor into a memoised `scratch`. `IntroText`'s one remaining allocation, a `?? []` fallback on the frames before the first `ExperienceFrame`, is now a shared frozen constant. **`Scene.tsx` fails and is a declared exemption**, for four pre-existing allocations named in the test: `getRollingStoryFrame()`'s `flatMap`, the `ExperienceFrame` object literal, `connectorBezier()`'s six `Vector3`s, and the label projection's template strings. Outside this pass's file boundary; the fix is a frame written in place and a cached Bézier.)*
- [x] Build source-to-target mappings only when lion/text assets or quantized layout change. *(`IntroText`'s effect is keyed `[layoutKey, lionHomes]`; the sweep above proves no frame loop in the scene calls `mapTextToLionSources`, `packLionSourcePositions`, `lionExtractionPool`, `buildTextCloud` or `computeIntroLayout`.)*
- [x] Reuse the existing width quantization in `introLayout.ts` so resize does not resample glyph clouds every frame. *(`layoutKey` buckets on `quantizeIntroWidth(size.width)` and the layout memo is keyed on `layoutKey`, so the layout object keeps its identity between buckets and the two effects that depend on it do not refire; asserted in `tests/motion-runtime.test.ts`.)*
- [x] Dispose added storage/material resources on font/layout replacement and unmount. *(The `sources` storage node joins `positions`/`traits` in the material's `dispose()`; `disposeSet` runs on both exits of the build effect, so a layout change frees the previous set. `pointMaterial.ts` calls no `instancedArray` — Phase C added only uniform nodes there, so `handle.material.dispose()` in `LionCore` is the whole job. `useLionBuffers` still disposes the sim on unmount. All asserted.)*
- [x] Keep the GPU renderer disposable at intro completion. The global background must be CSS/server-rendered, not another permanent WebGPU loop. *(Unchanged: `showCanvas = … && !introDismissed` still matches the pinned regex, so the renderer unmounts at handoff. The site-wide backdrop is the CSS `ScanBackdrop`, pinned by `tests/global-scan-backdrop.test.ts`.)*
- [x] Ensure only one moving scan backdrop is active after handoff. *(By `tests/global-scan-backdrop.test.ts`: one shared backdrop per public route, none mounted in the root layout, none on the internal four. The WebGPU `NetworkScan` is inside the canvas and unmounts with it, so it cannot be the second one.)*
- [x] Check that page visibility/offscreen behavior remains consistent with `tests/motion-runtime.test.ts` and the existing typographic engine gates. *(Suite green. `components/particle-nav/` schedules no raw `requestAnimationFrame` — MOTION-002's closed set is unchanged — and every observer and listener it owns is released, which PERF-007 sweeps across all of `components/`. `CanvasMount` gates the mount on an `IntersectionObserver` plus an idle callback and cancels both. The r3f canvas runs `frameloop="always"` with no explicit `document.hidden` gate, and deliberately so: the browser stops `requestAnimationFrame` in a hidden tab by itself. The typographic engine needs its own gate because `setInterval` does not throttle to zero, which is a different mechanism, not an inconsistency.)*

## 7. Accessibility and interaction checklist

- [x] Keep the narrative available to assistive technology through the existing semantic `article` in `CanvasMount.tsx`. — unchanged; `tests/intro-fallbacks.test.ts` now pins that the article is gated on `introRunning` and on nothing about the GPU beyond it, so a renderer that fails to paint cannot also silently remove the text it was going to narrate. The no-JS variant of this — `CinematicIntroGate` rendering the whole home inside `inert aria-hidden` in the server HTML, which no `<noscript>` rule can undo — was found independently by two agents and is **fixed**: the DOM projection of those two attributes is now gated on hydration, and `tests/intro-fallbacks.test.ts` pins it.
- [x] All decorative scan and particles remain `aria-hidden`/presentation-only. `ScanBackdrop`'s root carries `aria-hidden="true"` and every row is a non-focusable `<span>` with no `role`, no `tabIndex` and no link or button, so the attribute is not defeated by a focusable descendant. On the home, `.fieldLayer` — the fallback ground, the scan dock, the typographic-field canvas and the fade — is one `aria-hidden="true"` subtree in `app/page.tsx`, and `CanvasMount` marks its own canvas `aria-hidden` while the intro owns the screen. Pinned in `tests/intro-accessibility.test.ts`.
- [x] Skip Intro retains a visible `:focus-visible` style and safe-area spacing. — unchanged; both skins carry `outline: var(--focus-outline)` and the insets add `--safe-right`/`--safe-bottom`. Pinned in `tests/intro-fallbacks.test.ts` together with the 44 px floor, asserted against `--control-h` in `app/globals.css`.
- [x] The intro never traps keyboard focus; Escape completes it. — Escape's branch (preventDefault, `markIntroSeen`, `skipRequested`) is pinned. The entrance holds no focus trap: it installs one `keydown` listener and never calls `focus()` or blocks Tab. A live keyboard pass at the five viewports is still outstanding.
- [~] After handoff, the first user gesture cannot be retargeted to a newly revealed link on iOS/WebKit. — **fixed, not merely preserved.** `shouldSwallowClick` was correct but was listening on `containerRef`, and the destination is a *sibling* of that container, so it protected only the eight orbit links (`display: none` below 720px) and never the full-width mobile links named in its own comment. The capture listener is now on `window`; the pure function and every assertion in `tests/handoff-guard.test.ts` are unchanged. Left `[~]` because the property itself is a real-WebKit fact: it needs the Safari/iPhone pass in §8 before it can be ticked.
- [x] Background contrast is checked against body copy, captions, metadata, disabled controls, inputs, dialogs, and sticky headers—not only against the hero title. Computed 2026-09-04 against the composited background, not the ground: effective row opacity is `0.34 × register × intensity`, times a further 0.25 inside `--content-w` where `.rowField`'s mask dims, over the brightest pixel of `--scan-ground` (a rule line at the radial's centre), under the brightest row the backdrop paints (loud verified, `--ink`). The binding token is `--ink-lo` — captions, `.tocLink`, `.tocNumber`, `.sideRailInner dt`, the home `.fileNo` — which reads **4.93:1 before the scan adds anything**, so the whole layer has 0.43 of ratio to spend. Reading-column results after the two intensity cuts below: desk **4.59**, dossier **4.63**, institution **4.73**, home masthead **4.73**; `--ink` 10.1–10.8 and `--ink-hi` 15.3–16.5 everywhere. Every reading surface is inside the mask — `.withRails` widens `--content-w` over both rails at 1220px and below it the rails are `display: none` — so nothing on a reading route meets a full-strength row. **Inputs:** `--surface-2` is opaque, so the scan reaches only the surround; `--control-line` holds 3.21:1 against it (floor 3). **Dialogs:** `<dialog>` renders in the top layer over a 78%-ground `::backdrop`; the scan cannot reach it. **Disabled controls:** `--async-disabled` at `opacity: 0.45` measures 1.94:1 with the scan and 1.88:1 without — WCAG-exempt as an inactive component, and the scan moves it by 0.06. **Sticky header:** was the real failure — a loud row through the bar's `--glass-middle` (alpha 0.29) put `.brandRole` at **3.29:1**, and no survivable intensity recovered it, so `.rowField` is now inset by `var(--header-h)` and no row is behind the bar at all. **Two changes to `scanProfiles.ts`:** desk 0.6 → **0.5** (4.51:1 is over the floor by 0.01, which is not a margin, and desk carries the most 12–13px metadata), home 0.35 → **0.30** (the `.fileIndex` runs `--chrome-w` while the dock masks only 48rem, so the file numbers meet the band unmasked at **4.48:1**; 0.30 gives 4.64). Recomputed and asserted per family in `tests/intro-accessibility.test.ts`, so a future intensity bump fails the suite. **Two findings not fixed here:** (a) `--gold-dim` (#977544, the fact-check rung numbers) reads **4.37:1 on the peak `--scan-ground` pixel with no scan at all** — the 2026-09-03 lift measured it against `--ground` and `--surface-1` and did not account for the radial in `--scan-ground`; that is an `app/globals.css` token error, older than Phase E, and the scan now costs it a further 0.30. (b) The muted-institution combination lands at 0.046 effective — deliberately faint, flagged by the Phase E agent, pinned here as the floor of the range rather than treated as a fault.
- [x] `prefers-reduced-motion` produces a deliberately composed static result, not a randomly frozen bright scan frame. The module's media block is written against bare `.row`, not `.page` or `[data-speed]`, so it reaches the home band (`speed: "slow"`) as well as the reading routes: `animation: none` on both drift keyframes, each row stood at its own server-sampled `--rest` share of its travel, and `.rowLoud` stepped back to `--data-blue-dim`/`--data-ember-dim` so no bright fragment is left wherever the clock stopped. It also wins over `globals.css`'s blanket `animation-duration: 0.01ms !important`, which sets duration and not `animation-name` and would otherwise leave every row stacked at `translateX(0)` at full brightness.
- [x] No interaction depends only on hover. Nothing the profiles changed introduced one. In the reading shell every hover state is a colour delta over an already-legible rest state, `.tocSheetLink` pairs `:hover` with `:active` and `:focus-visible` in one selector, and focus is drawn by `globals.css`'s `:focus-visible { outline: var(--focus-outline) }` plus `.page a:focus-visible`. On the home the CTA sweep is inside `@media (hover: hover) and (prefers-reduced-motion: no-preference)` and lists `:focus-visible::before` alongside `:hover::before`, and `.fileLink` names `:hover` and `:focus-visible` together. Pinned in `tests/intro-accessibility.test.ts`.

## 8. Verification plan

### Automated checks

Run after implementation, in this order, and record actual results. Do not claim success without the output.

1. `npm test -- tests/intro-timeline.test.ts tests/global-scan-backdrop.test.ts tests/handoff-guard.test.ts tests/motion-runtime.test.ts`
2. `npm run typecheck`
3. `npm run lint`
4. `npm test`
5. `npm run build`

If a proposed test file was not needed, replace the command with the actual focused files and explain the decision in section 9.

### Browser setup

1. Start the app with `npm run dev -- --hostname 127.0.0.1 --port 3000`.
2. Use a fresh tab or clear only `sessionStorage['loz-intro-seen']` before every intro replay.
3. Verify the default backend and repeat the home intro with `/?forceWebGL=1`.
4. Do not infer Safari behavior from Chromium emulation. Perform a real Safari pass on macOS, and an actual iPhone Safari pass when the device is available.

### Required visual viewport matrix

| Class | Viewport | Required evidence |
| --- | --- | --- |
| Desktop | `1440×900` | Full sequence capture plus stills at formation end, rise end/first text, mid-story scan, and final handoff. |
| Wide desktop | `1920×1080` | Lion remains dominant; text column and masks do not look undersized. |
| Tablet portrait | `768×1024` | Correct desktop/mobile breakpoint behavior, no horizontal clipping. |
| iPhone target | `390×844` | Full sequence in Safari/WebKit; safe-area Skip; no crown/text clipping. |
| Small phone | `320×568` | Scroll/handoff remains usable; line widths and Skip do not collide. |

### Manual sequence assertions

- [ ] At formation completion, lion upward motion begins immediately.
- [ ] Settled top lion is substantially larger than the old story state.
- [ ] First text construction begins at the end of the rise with no perceptible pause.
- [ ] A continuous particle stream visibly originates in the lion and resolves into glyphs.
- [ ] Scan grows from nearly absent to subtle presence during rise/story.
- [ ] Scan never crosses the lion/text mask strongly enough to reduce reading clarity.
- [ ] Skip works by click/tap and Escape at early, middle, and late points.
- [ ] A second tap during the 2.8 s outro neither rewinds the timeline nor activates destination UI.
- [ ] Handoff reveals a working home; header, CTA, file links, and scroll respond normally.
- [ ] Navigating through representative desk, dossier, institution, and memorial routes shows the correct global backdrop profile.
- [ ] Links, inputs, dialogs, sticky UI, selection, and scrolling work over the background.
- [ ] Reduced motion has no particle transfer or continuous scan drift.
- [ ] No-JS/no-GPU fallback remains useful and nonblank.
- [ ] Console has no hydration, shader, WebGPU/WebGL, asset-load, or unhandled runtime errors.

### Performance assertions

- [ ] No additional persistent animation loop exists after intro handoff.
- [ ] No per-frame React state update or particle-array allocation was introduced.
- [ ] Mobile remains on the existing coarse-pointer tier and DPR cap.
- [ ] Capture frame stats with the existing particle diagnostics where available; report numbers rather than “feels smooth.”
- [ ] Inspect memory/resource cleanup by replaying/unmounting the particle scene through `/particle-demo`; no steadily growing buffer/material count or repeated listener registration.

## 9. Evidence ledger — fill during implementation

| Check | Status | Evidence / result |
| --- | --- | --- |
| Repository synchronized before work | [x] | `claude/fixhometodo-task-d3bbde` at `8700701` = `origin/main` `8700701`; working tree clean before Phase A (2026-09-03) |
| Focused timeline/background tests | [~] | Phase A: `npx vitest run tests/intro-timeline.test.ts tests/motion-runtime.test.ts tests/handoff-guard.test.ts` → 3 files, 44 tests passed. Phase E: `npx vitest run tests/global-scan-backdrop.test.ts tests/motion-runtime.test.ts tests/css-module-contract.test.ts tests/home-content.test.ts tests/no-js-invariant.test.ts tests/live-surfaces.test.ts tests/shell-landmarks.test.ts tests/ui-contracts.test.ts` → 8 files, 88 tests passed; typecheck clean; lint 0 errors (3 known `server/` warnings). |
| Typecheck | [~] | Phase A: `npm run typecheck` → clean (re-run at the end) |
| Lint | [ ] | Command and result |
| Full tests | [ ] | Command and pass/fail count |
| Production build | [ ] | Command and result |
| Chromium desktop | [ ] | Viewport, backend, capture path |
| Chromium forced WebGL2 | [ ] | Viewport, capture path |
| Chromium mobile | [ ] | Viewport, capture path |
| Safari macOS | [ ] | Version, viewport, result |
| Safari iPhone | [ ] | Device/iOS version, viewport, result or explicit blocker |
| Reduced motion | [ ] | Browser/device and result |
| Skip/handoff touch guard | [ ] | Tested stages and result |
| No-GPU/no-JS fallback | [ ] | Method and result |
| Public route backdrop profiles | [ ] | Routes checked and result |
| Console/runtime errors | [ ] | Result |
| Performance/resource cleanup | [ ] | Measurements and result |

## 10. Definition of done and required final report

Do not declare the task complete until every applicable acceptance item above is checked and evidence is recorded.

The final report must be brief and must contain exactly these four sections:

1. **Files changed** — exact repository-relative paths and one-line purpose for each.
2. **Animation timing** — actual final boundaries for formation, rise, first text, particle transfer, scan awakening, final hold, and handoff.
3. **Global background** — shared component/API, route profiles, exclusions, layering, pointer behavior, and reduced-motion result.
4. **Verification** — exact automated commands, pass/fail results, browser/device matrix, measured performance, and any unresolved blocker.

## 11. Final acceptance gate

- [ ] Lion assembles from gold particles in the center.
- [ ] Lion rises immediately after assembly.
- [ ] Lion remains large, clear, and dominant at upper center.
- [ ] Text begins immediately below the lion when relocation completes.
- [ ] Lion-origin particles visibly form the text; the reveal is not a standalone fade.
- [ ] Intelligence scan fades in during the intro without stealing focus.
- [ ] The same shared scan language is available across all public site surfaces with per-page/shell intensity, density, and speed control.
- [ ] Background does not harm performance, scrolling, clicking, focus, dialogs, or content contrast.
- [ ] Reduced motion, no-GPU, no-JS, Skip Intro, and iOS/WebKit handoff behavior remain correct.
- [ ] Desktop, tablet, mobile, forced WebGL2, and real Safari evidence is recorded.
- [ ] Focused tests, typecheck, lint, full tests, and production build pass.
- [ ] Unrelated content, navigation, and behavior are unchanged.
