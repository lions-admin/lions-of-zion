# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

@AGENTS.md

## What this is

Lions of Zion is a Next.js particle experience with a front page under it. The
preserved story intro hands off to a crowned-lion radial navigation over a
particle-built network scan, which owns the whole first screen; below it the
document continues into a front-page band of real editorial content. There is
no photographic landing page after the intro. The eight destinations behind the
nav are ordinary scrolling document pages.

The home route's below-the-fold band is new (`components/home/`); the invariant
that it had none is retired — see `.ai/DECISIONS.md`. The scene above it still
owns exactly one viewport and is still `position: fixed; inset: 0`, which is
load-bearing and not a style choice.

The repository also carries an independent information-model backend under
`app/api/` and `server/`. The two halves share no source files and are kept
apart by lint rules rather than convention.

Source is the private `lions-admin/lions-of-zion` repository. Git auto-deploy is
not connected; production deployment is a separate manual Vercel operation.

## Journal

Update `.ai/STATE.md` whenever a session moves the work. Keep
`.ai/DECISIONS.md` append-only and newest-first; it records why durable choices
were made, while git records what changed. `TODOS.md` is the Hebrew delivery
plan and is the place to check what is considered unfinished.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
```

```bash
npx vitest run tests/items.test.ts          # one test file
npx vitest run -t "publishes"               # one test by name
npm run test:watch                          # watch mode
```

```bash
npm run verify:graphics -- http://localhost:3000 /tmp/lions-matrix
node scripts/final-verify.mjs http://localhost:3000 /tmp/lions-final
node .claude/skills/verify-intro/capture.mjs
```

Particle assets are rebuilt with `bake:nav-lion`, `bake:nav-icons`, and
`poster:nav`; their source artwork is in `assets/` and their output lands in
`public/particles`, `public/icons`, and `public/posters`.

Database commands (`db:generate`, `db:migrate`, `db:studio`) drive
drizzle-kit against a real `DATABASE_URL`. The test suite never needs one.

## Verification trap

The in-app browser can report `visibilityState === "hidden"` and suspend
`requestAnimationFrame`, making both scenes appear black. Headless Chromium
falls back to SwiftShader, which the GPU probe correctly rejects, so the scene
never mounts there either. Visual checks must use real Chrome via
`playwright-core` with `headless: false`; all three capture scripts hardcode
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome`, so they only
run on the macOS workstation, not in a Linux container.
`scripts/final-verify.mjs` covers intro handoff, keyboard, WebGPU, forced
WebGL2, no-JavaScript fallback, overlays, and console errors.

Any edit to intro timing, copy, or composition must be captured in real Chrome.

## Frontend architecture

`app/page.tsx` renders `components/Experience.tsx`.

- `components/intro/` contains only pure timeline data and CPU text-cloud
  sampling.
- `components/particle-nav/` is the single React Three Fiber scene using Three
  r185, WebGPU and TSL, with a WebGL2 fallback. It owns both intro and nav.
- The nav's DOM links and poster exist in the server HTML. They are inert only
  after hydration while the intro is actually running. Without JavaScript the
  static navigation remains usable immediately.
- `Scene.tsx` owns one timeline clock. Its mutable frame is shared by the lion,
  TSL story text and staged navigation reveal without React state per frame.
- Skip and reduced motion land on the same complete navigation; the root route
  accepts `?forceWebGL=1` for full-flow fallback verification.

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
  links. Do not add a second set of *fallback* links: the front-page band's
  file index is one index for every tier, not a tier-specific copy, which is
  why the static mobile index it replaced was deleted rather than kept.
- **The home route has an unresolved no-JavaScript defect, and it is not the
  band's.** `app/loading.tsx` wraps every route in a Suspense boundary whose
  fallback nothing replaces when JavaScript never runs, so `/` renders as the
  loading shell with the real markup parked in a `display: none` wrapper.
  Verified by removing that one file: the home route then renders completely
  without JavaScript — 8 orbit links, 8 band links, poster, scroll. `/war-update`
  and `/we-are` have the same defect. This predates the front-page band.
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
- A `PostToolUse` hook re-checks these invariants after every edit and also runs
  `tsc --noEmit`, so a broken timeline surfaces before the next command.

### Unified intro and navigation renderer

- `components/particle-nav/Scene.tsx` owns the only live renderer and timeline
  clock. Do not mount a second canvas for the intro.
- The intro and navigation share `public/particles/lion-v2-*.bin`; the crown,
  face and mane must remain one LNP1 bake across both acts.
- Intro copy is sampled on the CPU, then animated and rendered with TSL sprite
  materials. Do not reintroduce raw GLSL or `ShaderMaterial` at runtime.

### Section pages and the nav contract

`components/particle-nav/config.ts` `defaultNodes` is the source of truth for
the eight destinations — id, label, `displayName`, `href`, description and
orbit position. It feeds the particle nodes, the DOM links, the hover cards,
and the page shell. `label` is stored uppercase because the orbit and the
static index set it that way as identity; **reading surfaces use
`displayName`** — a CSS transform can't do this, since `capitalize` turns
"ISRAEL'S STORY" into "Israel'S Story".

- Every node id must have a matching `app/<id>/page.tsx`; `SectionPage` throws
  on an unknown id, and the file-header index it prints is the node's real
  position in `defaultNodes`. The current eight are `geopolitical-brief`,
  `support-us`, `war-update`, `october-7`, `our-heroes`, `israels-story`,
  `fake-resistance`, and `we-are`.
- `components/sections/SectionPage.tsx` is the dossier shell for seven of them:
  a full-width identity band and a centred 68ch reading measure. There is no
  footer — the page ends where the content ends (`.ai/DECISIONS.md`).
  Above 1220px both margins work: `SectionToc.tsx` builds an "In this file"
  rail on the left from the rendered `h2`s (no per-page data, so it cannot
  drift), and each record's citation moves into the right margin beside it.
  `ScanBackdrop` continues the corpus outside that band, masked via
  `--content-w`, which is `--reading-w` plus both rails on pages that carry
  them. `register` and `accent` remain the only sanctioned per-section
  deviations.
- **The evidence margin is a grid, never absolute positioning.** `marginNote`
  in `content.module.css` makes the record's host a two-track grid whose second
  track is zero-wide, so a citation taller than its record lengthens its own
  row instead of overrunning the next one. A host therefore needs its record
  and its sources as *sibling* elements (`.timelineMain`, `.dispatchMain`,
  `.caseFileMain`). Cards in a multi-column grid opt out — see Our Heroes.
- `components/briefs/` is the Geopolitical Brief, the one page with its own
  layout and reading-progress treatment; its content is still a static
  reference cut in `geopolitical-reference.ts`.
- `components/chat/ParticleChatLauncher.tsx` is mounted globally in
  `app/layout.tsx`. Desktop upgrades the server-rendered image to a second
  particle canvas after hydration; mobile deliberately never pays for that
  second renderer. `AskTheLionChat` is an accessible modal talking to
  `/api/v1/chat/threads`.
- The skip control and all section-page type are DOM text rather than
  particles — the documented exception to the all-particles rule
  (see `.ai/DECISIONS.md`).
- **Type and colour on every reading surface come from the V2 tokens in
  `app/globals.css`** — three faces (Newsreader display, IBM Plex Sans text,
  Geist Mono data), seven size steps, six colours. Read `.ai/DESIGN-V2.md`
  before touching reading-page CSS. Hard rules: nothing below `--t-data`
  (0.72rem); uppercase+tracking only for data labels of two words or fewer;
  sentence case everywhere else. **Cinzel belongs to the home particle scene
  only** — it is not a heading face, and reintroducing it to a reading page
  reverses a documented decision.

## Backend architecture

An information-model API: sources are ingested, evidence is attached to items,
assessments are reviewed by a second human, and published items are searchable.
Neon, Blob and AI Gateway are optional and currently unprovisioned. Frontend
work must not silently provision or mutate those services.

### Layering, enforced by ESLint

`eslint.config.mjs` states the architecture as lint errors, so a violation
fails `npm run lint` rather than a review. Read it before moving code between
layers.

- `app/**` and `components/**` may import `@/server/contracts/*` and nothing
  else under `server/`. This is what keeps a Postgres driver out of the client
  bundle.
- `app/api/**` may not import `@/server/db` or a module's `service`/`repo`/
  `rules` directly. A route parses, calls one module through its `index.ts`,
  and serializes.
- `server/contracts/**` may import zod and nothing else — no drizzle, no
  `next/*`, no `server-only` — so it stays loadable from an RSC and from a
  test with no database.
- `server/db/**` never imports modules; `server/**` never imports the
  frontend; `server/jobs/**` never touches the database directly.

### Module shape

Each `server/modules/<name>/` exposes `index.ts` (binds `db()` lazily and
returns the service), `service.ts` (the transactional workflow), `repo.ts`
(queries), and sometimes `rules.ts` — pure, DB-free policy that is unit-tested
directly, as in `assessments/rules.ts`.

### Cross-cutting rules worth knowing before editing

- `server/core/config.ts` is the only file that reads `process.env`.
- `server/core/versioning.ts` `recordVersion()` is the only write path for a
  versioned entity: row update, version row, head pointer, audit trail and
  reindex emit happen in one transaction. Nothing else may `UPDATE` a versioned
  table.
- `server/core/outbox.ts` `emit()` writes job intent inside the causing
  transaction; `drainOutbox` and the queue/cron routes under
  `app/api/internal/` deliver it. Publishing to a queue after commit is not
  atomic and is not done here.
- `server/db/client.ts` exports only the WebSocket `neon-serverless` driver.
  `neon-http` cannot hold an interactive transaction, which makes `SET LOCAL
  ROLE` a silent no-op and every authorization test pass for the wrong reason.
  Do not add it back.
- `server/http/handler.ts` wraps every route with request-id propagation and
  error translation; errors are RFC 9457 problem+json with a stable `code`
  from `responses.ts`. Internal routes go through `internal-guard.ts`.
- Business rules live in SQL triggers as often as in TypeScript — status
  transitions, append-only tables, derived columns and the publish gate are all
  enforced in `server/db/migrations/`. Changing a rule usually means a new
  numbered migration, not just a service edit.

### Tests

`tests/` runs on vitest in a node environment against `server/db/testing.ts`
`freshDatabase()` — PGlite, a real Postgres 18 in WASM, migrated per test, so
triggers and constraints behave as they will in Neon. PGlite has no pgvector:
semantic-search tests skip unless `TEST_DATABASE_URL` points at a Postgres that
has it, while lexical search (`tsvector`, `pg_trgm`) is fully covered locally.
`vitest.config.ts` aliases `server-only` to its empty module rather than
letting tests drop the import.
