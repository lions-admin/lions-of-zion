# CLAUDE.md

@AGENTS.md

## What this is

Lions of Zion is a full-viewport Next.js particle experience. The preserved
story intro hands off to a crowned-lion radial navigation over a particle-built
network scan. There is no content below the fold and no photographic landing
page after the intro.

Source is the private `lions-admin/lions-of-zion` repository. Git auto-deploy is
not connected; production deployment is a separate manual Vercel operation.

## Journal

Update `.ai/STATE.md` whenever a session moves the work. Keep
`.ai/DECISIONS.md` append-only and newest-first; it records why durable choices
were made, while git records what changed.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:graphics -- http://localhost:3000 /tmp/lions-matrix
node scripts/final-verify.mjs http://localhost:3000 /tmp/lions-final
```

Particle asset commands are `build:lion-data`, `bake:nav-lion`,
`bake:nav-icons`, and `poster:nav`.

## Verification trap

The in-app browser can report `visibilityState === "hidden"` and suspend
`requestAnimationFrame`, making both scenes appear black. Visual checks must use
real Chrome via `playwright-core` with
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` and
`headless: false`. `scripts/final-verify.mjs` covers intro handoff, keyboard,
WebGPU, forced WebGL2, no-JavaScript fallback, overlays, and console errors.

Any edit to intro timing, copy, or composition must be captured in real Chrome.

## Architecture

`app/page.tsx` renders `components/Experience.tsx`.

- `components/intro/lion-scene.tsx` is the original imperative Three.js intro.
- `components/particle-nav/` is a React Three Fiber scene using Three r185,
  WebGPU and TSL, with a WebGL2 fallback.
- The nav's DOM links and poster exist in the server HTML. They are inert only
  after hydration while the intro is actually running. A `noscript` rule hides
  the intro enhancement so the static navigation remains usable without JS.
- The second GPU scene is deferred until `onOutroStart`. Its 2.8-second lion
  assembly and the intro's 2.8-second veil reveal run together. Intro failure,
  skip, and reduced motion all land on the same complete navigation.
- `reactStrictMode` remains off because the preserved intro is an imperative
  GPU lifecycle with deliberate one-mount semantics.

### Particle navigation invariants

- All visible scan marks, readable context labels, platform symbols, lion,
  rings, connectors, and node icons are particle geometry. There is no star
  field and no raster background in the live scene.
- `OrbitLayout` is the single responsive geometry contract shared by nodes,
  connectors and projected DOM labels. Eight link bounds must stay within the
  viewport at the seven viewports in `scripts/verify-composition.mjs`.
- The real `<a href>` elements own semantics, pointer input and keyboard focus.
  Canvas elements are presentation only.
- The no-WebGL tier uses `public/posters/particle-nav.*` behind those same
  links. Do not add a second set of fallback links.
- The live scene selects 45k, 90k, or 180k lion buffers by performance tier.
- `/particle-demo?forceWebGL=1` is the supported fallback/tuning harness.

### Intro timeline

- `components/intro/story-timeline.ts` owns copy and lion phase timing.
- `components/intro/rolling-story-timeline.ts` owns the rolling line window and
  the final/outro timing.
- Duration is derived from line count. `STORY_PARAGRAPHS` and
  `STORY_BEAT_STARTS` assume exactly 12 beats.
- The id `battlefield-for-truth` is referenced by the renderer.
- Desktop and mobile line arrays must rejoin to the canonical text.

### Intro particle binary

`public/assets/lion-structure.bin` is a `LION` v1 binary consumed by the intro.
The writer and reader duplicate the x/3.1, y/4.65 and z/1.2 quantisation scales;
keep them synchronized or the lion deforms without a parser error.

## Backend

The information-model API remains under `app/api/` and `server/`. Neon, Blob
and AI Gateway are optional and currently unprovisioned. Frontend work must not
silently provision or mutate those services.
