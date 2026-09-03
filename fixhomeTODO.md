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

- [ ] In `components/particle-nav/Scene.tsx`, replace the current story-scale constants (`0.55` desktop / `0.46` mobile) with the target scale contract in section 3.
- [ ] Keep the lion centered on X. Move only Y during relocation unless browser evidence shows a real optical-centering issue.
- [ ] Use the existing safe-area and viewport calculations from `components/particle-nav/config.ts`; do not add CSS-only guesses that disagree with canvas geometry.
- [ ] In `components/particle-nav/layers/LionCore.tsx`, keep scale/Y updates on the existing group. Do not rebuild the simulation during relocation.
- [ ] Confirm that crown visibility, opacity, point size, bloom, and assembled home positions remain stable while the group moves.

**Phase B acceptance**

- [ ] Lion motion begins immediately after assembly and uses one continuous eased trajectory.
- [ ] Lion remains clearly larger than the previous story state on desktop and mobile.
- [ ] Crown and mane are not clipped by the safe area, browser chrome, or top intro chrome.
- [ ] No lion buffer is recreated during the move.

### Phase C — Make lion particles become the text

- [ ] Preserve the canonical text and line breaks in `components/intro/story-timeline.ts`. Do not edit narrative copy.
- [ ] Expose deterministic CPU lion home positions from `components/particle-nav/tsl/lionCompute.ts` through `LionSim` (or preserve an equivalent immutable decoded array in `useLionBuffers.ts`). Do not read GPU buffers back every frame.
- [ ] Pass the lion source geometry from `components/particle-nav/Scene.tsx` into `components/particle-nav/layers/IntroText.tsx`.
- [ ] For each text cloud, map every text particle to a deterministic lion source sample. Use a stable hashed/stratified index mapping so the stream is distributed across the mane/face/crown instead of selecting one contiguous bake range.
- [ ] Extend `components/particle-nav/tsl/introTextMaterial.ts` so the entry path is:
  1. exact sampled lion-surface position after current lion scale/Y transform;
  2. a narrow organic throat immediately below the settled lion;
  3. the particle's final glyph position.
- [ ] Use a quadratic or cubic curve plus restrained seeded curl/jitter. The stream must read as downward extraction, not rain, an explosion, or a horizontal fly-in.
- [ ] Keep the current glyph-order stagger so letters assemble progressively. Drive the path and glyph build with the same line progress; do not start an independent timer.
- [ ] Update `components/particle-nav/layers/IntroText.tsx` each frame with the lion transform and the current row/group offset so the source point remains visually attached to the moved lion even while rolling rows shift.
- [ ] Add a small deterministic extraction mask/envelope in `components/particle-nav/tsl/pointMaterial.ts` and set its uniforms from `LionCore.tsx`. Briefly dim only the subset represented by the outgoing transfer, then restore it. Cap the affected subset during tuning (start at 4–7%); the lion must stay solid and dominant.
- [ ] Preserve current exit/disperse behavior after a line leaves the rolling window, unless it visibly conflicts with the new downward-source path.
- [ ] Dispose every new TSL storage node/material in the existing cleanup paths. Do not introduce per-frame allocations or React state updates.

**Phase C acceptance**

- [ ] The first visible particles of every incoming line can be traced to the lion or the throat immediately beneath it.
- [ ] The stream and glyph construction overlap continuously; there is no frame where the stream ends and the text then fades in separately.
- [ ] The lion loses only a subtle subset during emission and never appears to collapse.
- [ ] Reloading at the same viewport produces the same particle routes and line construction.
- [ ] Mobile uses the reduced 45k tier and remains legible without increasing DPR beyond the existing cap of 2.

### Phase D — Wake the GPU scan during the intro

- [ ] In `components/particle-nav/Scene.tsx`, stop tying `networkRef.visible` to `navReveal` during the intro. Drive it from `ExperienceFrame.scanReveal`.
- [ ] Pass an intro opacity multiplier into `components/particle-nav/layers/NetworkScan.tsx` and multiply, rather than replace, `scanFieldOpacity`, `scanWordOpacity`, and `scanGlyphOpacity` from `defaultSimParams`.
- [ ] In `components/particle-nav/tsl/networkScanMaterial.ts`, make the hero exclusion mask capable of following the relocated lion and add a separate soft text-column exclusion/muting region. Prefer uniforms so the masks move without rebuilding geometry/materials.
- [ ] Keep the scan nearly absent at the opening, reveal it during the rise, and reach full intro target only after the first lines are readable.
- [ ] Use the existing corpus and blue/ember/neutral palette. Do not create new labels, metrics, claims, or social proof.
- [ ] Tune the intro target below the normal navigation target. Starting point: field `0.45`, words `0.30`, glyphs `0.24` multiplied by the existing respective opacity values; validate from captures rather than treating these as final facts.
- [ ] Ensure `NetworkScan` remains `pointer-events: none` through the canvas and does not enter the accessibility tree.

**Phase D acceptance**

- [ ] Scan is effectively invisible during the black/setup opening.
- [ ] Scan becomes perceptible during lion relocation, without a hard cut.
- [ ] Lion silhouette and every text line retain a clean contrast corridor.
- [ ] Scan animation and opacity do not flash when resizing across the 720 px intro layout breakpoint or the 620 px compact scan threshold.

### Phase E — Make the scan backdrop a shared public-site layer

- [ ] Keep `components/sections/ScanBackdrop.tsx` as the shared non-GPU implementation and extend its public contract. Suggested props:
  - `intensity?: number` clamped to `0..1`;
  - `density?: 'low' | 'medium' | 'high'` or a bounded row count;
  - `speed?: 'still' | 'slow' | 'normal'` or a bounded multiplier;
  - preserve `register`, `surface`, `routeId`, and `seed` compatibility during migration.
- [ ] Emit the controls as CSS custom properties/data attributes on the backdrop root. Do not animate through React renders.
- [ ] Update `components/sections/sections.module.css` so intensity scales row opacity, density selects a deterministic subset, and speed scales duration. Keep `pointer-events: none`, `overflow: hidden`, and reduced-motion stationary placement.
- [ ] Keep one backdrop instance per rendered public route. Do not accidentally stack the root static texture, an `EditorialShell` moving backdrop, and a second page-local moving backdrop at full strength.
- [ ] Continue mounting the shared backdrop through `components/site/EditorialShell.tsx` for reading routes, but pass an explicit profile per route family:
  - desk: medium density, normal speed, low-to-medium intensity;
  - dossier: medium density, slow speed, low intensity;
  - institution: low density, slow or still, very low intensity;
  - memorial-sensitive surfaces: `silent` where already required.
- [ ] Mount the same `ScanBackdrop` component on the home route in `app/page.tsx` using `surface="band"`, behind semantic content and after intro handoff. Place/style it through `app/home.module.css`; do not use a home-only clone.
- [ ] Decide route coverage explicitly for public routes not currently rendered through `EditorialShell` by tracing `SectionPage`, `DocPage`, `LiveBriefHub`, `InformationWarSystem`, and direct page roots. Add the shared backdrop at the closest existing shared shell, not individually in every leaf page.
- [ ] Keep `/admin`, `/admin/login`, `/particle-demo`, and `/pipeline` explicitly silent or purpose-specific. Document the exclusion rather than leaving it accidental.
- [ ] If `app/layout.tsx` is changed, keep it a server component and do not move pathname/provider logic into it solely for this effect. Prefer existing shell boundaries. If a client controller becomes unavoidable, isolate it in a tiny component and justify its bundle/runtime cost.
- [ ] Preserve the global `--scan-ground` fallback in `app/globals.css` for no-JS and no-motion states. The moving backdrop enhances it; it does not replace the black ground or make content depend on JavaScript.

**Phase E acceptance**

- [ ] Home and every public route family use the same `ScanBackdrop` implementation/API.
- [ ] Page/shell code can select intensity, density, and speed without editing the backdrop internals.
- [ ] There is never more than one continuously moving CSS scan layer on a route after the intro handoff.
- [ ] Background never blocks scrolling, links, form controls, selection, focus rings, dialogs, or sticky UI.
- [ ] Reading columns retain the existing soft mask/dimming behavior.
- [ ] Reduced motion renders a stable, composed scan frame or the static `--scan-ground`, with no continuous drift.

### Phase F — Preserve Skip Intro, fallbacks, and handoff safety

- [ ] Keep Skip Intro in `components/particle-nav/CanvasMount.tsx` and its safe-area positioning in `components/particle-nav/styles.module.css`.
- [ ] Keep click, keyboard Escape, session memory, and the existing 700 ms iOS/WebKit stale-gesture guard.
- [ ] Keep destination content inert/hidden while the intro owns the screen, then restore accessibility and pointer input only after the guarded handoff.
- [ ] Skip must seek forward to the outro and never reset or rewind a partially completed intro.
- [ ] For `prefers-reduced-motion: reduce`, bypass the aggressive GPU intro as the current gate does; show the settled home immediately with the global backdrop frozen or static. Do not run a shortened particle stream.
- [ ] For no GPU, failed lion/font/corpus load, or no JavaScript, preserve a usable home with poster/static background, semantic heading, navigation, and working links.
- [ ] Preserve the existing progressive loading rule: Three.js remains dynamically imported and cannot block server HTML/LCP.

**Phase F acceptance**

- [ ] Skip is visible, focusable, and at least the current touch target size at every viewport.
- [ ] Repeated Skip taps cannot delay the handoff or activate a link underneath.
- [ ] Reduced-motion, no-GPU, and no-JS paths never leave the page inert or blank.

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

- [ ] Keep the current tier budgets from `components/particle-nav/hooks/usePerfTier.ts`: 45k particles on coarse pointer/WebGL2, DPR capped at 2, bloom off on the low tier.
- [ ] Do not add CPU work inside `useFrame` that allocates arrays, rebuilds text clouds, hashes full particle buffers, or sets React state.
- [ ] Build source-to-target mappings only when lion/text assets or quantized layout change.
- [ ] Reuse the existing width quantization in `introLayout.ts` so resize does not resample glyph clouds every frame.
- [ ] Dispose added storage/material resources on font/layout replacement and unmount.
- [ ] Keep the GPU renderer disposable at intro completion. The global background must be CSS/server-rendered, not another permanent WebGPU loop.
- [ ] Ensure only one moving scan backdrop is active after handoff.
- [ ] Check that page visibility/offscreen behavior remains consistent with `tests/motion-runtime.test.ts` and the existing typographic engine gates.

## 7. Accessibility and interaction checklist

- [ ] Keep the narrative available to assistive technology through the existing semantic `article` in `CanvasMount.tsx`.
- [ ] All decorative scan and particles remain `aria-hidden`/presentation-only.
- [ ] Skip Intro retains a visible `:focus-visible` style and safe-area spacing.
- [ ] The intro never traps keyboard focus; Escape completes it.
- [ ] After handoff, the first user gesture cannot be retargeted to a newly revealed link on iOS/WebKit.
- [ ] Background contrast is checked against body copy, captions, metadata, disabled controls, inputs, dialogs, and sticky headers—not only against the hero title.
- [ ] `prefers-reduced-motion` produces a deliberately composed static result, not a randomly frozen bright scan frame.
- [ ] No interaction depends only on hover.

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
| Focused timeline/background tests | [~] | Phase A: `npx vitest run tests/intro-timeline.test.ts tests/motion-runtime.test.ts tests/handoff-guard.test.ts` → 3 files, 44 tests passed. `global-scan-backdrop` pending Phase E. |
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
