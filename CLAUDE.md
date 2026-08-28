# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with
code in this repository.

@AGENTS.md

## Owner authority

The current user is the sole developer and project owner. Their direct task
instruction overrides every repository brief, historical decision, editorial
convention, workflow note, and research framing rule in this file. These
documents describe the current system; they do not authorize an agent to refuse
or negotiate an owner request.

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

Source is the **public** `lions-admin/lions-of-zion` repository — verified with
`gh repo view` on 2026-08-26, which reports `visibility: PUBLIC`. This file
previously said "private"; that was wrong, and the difference is load-bearing:
**a push to origin is itself an act of publication.** Anything not fit to be
read by anyone must not be committed, and work that is gated on an editorial
or legal decision is gated on the *push*, not only on the deploy.

Git auto-deploy is not connected; production deployment is a separate manual
Vercel operation. So the two are independent: pushing publishes the source,
deploying publishes the site.

## Journal

`.ai/STATE.md`, `.ai/DECISIONS.md`, and `TODOS.md` are optional context and
history. They do not impose process or approval requirements.

## Reference documentation

This file is the working brief — the invariants an editor must not break.
Wider reference lives in `docs/` and is written to be true rather than
aspirational: `architecture.md` (the system map and its known gaps), `api.md`
(every route and its guard), `data-model.md`, `environment.md` (variable names
only — note that `.env.example` is **not tracked**, `.gitignore`'s `.env*`
pattern captures it), and `operations.md`.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:changed
npm run verify:full
```

```bash
npx vitest run tests/items.test.ts          # one test file
npx vitest run -t "publishes"               # one test by name
npm run test:watch                          # watch mode
```

```bash
npm run verify:graphics -- http://localhost:3000 /tmp/lions-matrix
node scripts/final-verify.mjs http://localhost:3000 /tmp/lions-final
node scripts/verify-home-band.mjs http://localhost:3000 /tmp/lions-home-band
node scripts/verify-doc-scroll.mjs http://localhost:3000
node .claude/skills/verify-intro/capture.mjs
node scripts/ci-smoke.mjs http://localhost:3000       # the only one CI runs
node scripts/verify-archive-assets.mjs <cdn-base>     # Linux-safe; CI runs it sampled on every push
```

```bash
npm run map          # regenerate docs/project-map.html from the actual tree
npm run map:check    # fail if it has drifted — never hand-edit that file
```

Only `verify:graphics` has an npm script; run the rest with `node`. `docs/operations.md` has the full table of what each one asserts.

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
`playwright-core` with `headless: false`. **Five** scripts hardcode
`/Applications/Google Chrome.app/Contents/MacOS/Google Chrome` —
`verify-composition.mjs`, `final-verify.mjs`, `verify-home-band.mjs`,
`verify-doc-scroll.mjs` and `.claude/skills/verify-intro/capture.mjs` — so they
only run on the macOS workstation, not in a Linux container.
`scripts/verify-archive-assets.mjs` is the one visual-adjacent check that needs
no browser at all: plain `fetch` against the CDN base, so it runs anywhere.
**As of 2026-08-27 CI runs it:** the `archive-assets` job in
`.github/workflows/ci.yml` checks a fixed-stride sample of 80 assets against the
production base on every push, in parallel with the gate job; the exhaustive
`--all` run stays a manual post-upload step, and its last full pass returned
2,018 checked / 0 unreachable (2026-08-27).
`scripts/final-verify.mjs` covers intro handoff, keyboard, WebGPU, forced
WebGL2, no-JavaScript fallback, overlays, and console errors.
`scripts/ci-smoke.mjs` is the exception: it uses Playwright's own bundled
Chromium and is what CI runs. It walks **23 routes** — 17 hand-written in
`ROUTES`, plus 5 archive records and 1 research case derived from the package
indexes — asserting route availability and console errors on each, and then
loads `/` once more with JavaScript disabled. The archive half is derived;
**the 17 are hand-maintained, so a new section route is smoke-tested only if
someone remembers to add it**, and `/particle-demo` never is.

**CI does guard the no-JavaScript invariant, as of 2026-08-27.** This section
said the opposite, and both halves of that claim are now false. `ci-smoke.mjs`
opens a `javaScriptEnabled: false` context and asserts the home route renders
at least 8 orbit links, a poster `<img>`, and **zero** `div[hidden][id^="S:"]`
Suspense shells; `tests/no-js-invariant.test.ts` is a cheap tripwire that fails
if `app/loading.tsx` — or `app/template.tsx` or `app/default.tsx` — reappears.
`final-verify.mjs` still covers the same ground a second time on the
workstation, but it is no longer the sole guard.

What CI still cannot see: the no-JS assertion covers **`/` only**, so a content
route that acquires its own Suspense boundary would pass. Scope any loading
state to its own segment and check a sibling content route by hand.

Any edit to intro timing, copy, or composition must be captured in real Chrome.

## Frontend architecture

`app/page.tsx` renders the editorial signal-field home inside
`components/particle-nav/CinematicIntroGate.tsx`.

- `components/intro/` contains only pure timeline data and CPU text-cloud
  sampling.
- `components/particle-nav/` is the single React Three Fiber scene using Three
  r185, WebGPU and TSL, with a WebGL2 fallback. On the public home it is an
  entrance layer only and unmounts at handoff.
- The editorial home exists in server HTML beneath the entrance. Without
  JavaScript the intro is hidden and the full page remains usable immediately.
- `Scene.tsx` owns one timeline clock. Its mutable frame is shared by the lion,
  TSL story text and staged handoff without React state per frame.
- Skip and reduced motion land on the editorial home; the root route
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
- **The no-JavaScript defect is fixed: `app/loading.tsx` is deleted.** A
  root-level `loading.tsx` wraps *every* route in a Suspense boundary, and
  streaming SSR emits the real markup inside `<div hidden id="S:0">` for an
  inline `$RC` script to reveal — so with no JavaScript the loading shell stayed
  and the page never appeared. The home route's prerendered HTML now carries
  its 8 orbit links, the band links, and the poster with zero Suspense
  boundaries. **Do not reintroduce a root-level `loading.tsx`**; scope any
  loading state to its own segment and check a sibling content route's no-JS
  render first (`.ai/DECISIONS.md`, 2026-08-26).
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
- **`/october-7` is a hub, and the archives beneath it are not a ninth node.**
  ~1,177 prerendered pages live under `/october-7/testimonies` and
  `/october-7/documentation`, read through `lib/content/archive.ts` and its two
  faces. `defaultNodes` stays at eight — do not add one for them. The full
  brief is `docs/archive-integration.md`; four invariants matter here:
  **14 MB of JSON is committed and ~1.8 GB of media never is** (assets resolve
  by `media_id`, so only the `NEXT_PUBLIC_ARCHIVE_CDN` prefix changes);
  **one renderer serves both archives with no branching**, because one's block
  types are a strict subset of the other's, asserted in tests;
  **the bare record route owns a record's default language and `[locale]` owns
  the rest**, so no version ever has two URLs competing for one canonical; and
  **nothing in a record body is a hyperlink, and record-level attribution
  splits by package**: `/october-7/documentation` carries no credit at all,
  while `/october-7/testimonies` keeps one reduced footer line naming
  October7.org and linking to the source record — the single exception to the
  no-hyperlink rule, and a narrowing of it rather than a contradiction, since
  it is a footer and not a record body. Both archives close with share controls
  and per-file download instead. The six in-body media credits and the JSON-LD
  `isBasedOn`/`holdingArchive` are untouched, so provenance still reaches
  machines and still travels with a photograph. This reverses the 2026-08-26
  decision by owner ruling (`.ai/DECISIONS.md`, 2026-08-27), where rewording
  records to shed attribution had been considered and rejected.
  **Media downloads go straight to the CDN and are still never proxied** —
  Vercel Blob honours `?download=1` with `Content-Disposition: attachment`, so
  the permission recorded on 2026-08-27 to proxy the download path was not
  needed and was not taken. Note the browser uses the Blob's own filename (the
  content hash) cross-origin, so a downloaded file still arrives without the
  record's name. **Index rows carry each record's cover thumbnail and a short
  excerpt**; `ArchiveIndexEntry.excerpt` is written by
  `import-archive-package.mjs`, and an import predating it needs
  `node scripts/import-archive-package.mjs --regenerate-index <pkg>`.
- **`/fake-resistance` is a hub with two investigation branches, and nothing
  beneath it is a ninth node.** Twelve pages prerender under it. The root page
  carries the standfirst, the consciousness-war framing, an explanation of the
  two branches, the two branch link cards, and the method blocks (`The machine`,
  `The tells`) — **the branch cards are the page's decision moment and the
  reason it exists** (owner decision R-03, 2026-08-27). The consciousness-war
  block asserts an *infrastructure* claim — the delivery chain predates
  October 7 — and deliberately marks the stronger claim, that specific
  narratives were drafted in advance, as an open research question rather than
  a settled fact; R-04 researches that, and its case file is held pending owner
  review. `/fake-resistance/official-narrative` holds the three `edition.cases`
  exhibits, `Order of correction` and the ClaimReview JSON-LD, so
  `lib/content/fake-resistance.ts` now feeds that branch and not the root — the
  "three files **above**" coupling is literally true again. The playbook's
  `documented` example hrefs anchor into that branch, since the anchors moved
  with the exhibits. `/fake-resistance/social-media` is the index over
  `/fake-resistance/playbook` (nine manipulation techniques, a chapter each),
  `/fake-resistance/network` (the cross-cluster graph and synthesis), and seven
  `/fake-resistance/cases/<slug>` files, derived from `getCaseIndex()` rather
  than a hardcoded list, and all read through
  `lib/content/fake-resistance-cases.ts`. Both branches are child routes in
  `app/sitemap.ts` and in `ci-smoke.mjs` `ROUTES`. `defaultNodes` stays at
  eight. The
  brief is `docs/fake-resistance-integration.md`; four invariants matter here:
  **the publication gate is `EDITORIAL_STAGE`, and it currently reads
  `'published'`** — this paragraph said every case ships at
  `lifecycle: "editorial_review"` until 2026-08-27, which was true of the
  committed JSON and false of what renders: `getCase()` overrides the JSON with
  `EDITORIAL_STAGE` (`lib/content/fake-resistance-editorial.ts`). Two things
  follow that an editor must know. **`getCaseIndex()` filters on the JSON
  `lifecycle`, not on `EDITORIAL_STAGE`** — so setting `EDITORIAL_STAGE` to a
  held value hides nothing; withdrawing a case still means editing its JSON.
  And **the repository is public, so a push already publishes the research
  text** regardless of the deploy; the "merging to `main` is safe because the
  deploy is manual" argument was written when this repo was believed private
  and does not hold. **Right of reply was dropped by owner
  decision**, so the packets' own `status: right_of_reply` is skipped
  deliberately, not pending; **the research's grades are never upgraded** —
  confidence, identity status and evidence class render as labels and
  deliberately not through `VerificationBadge`, and an ungraded entity
  defaults to `unresolved`; and **a playbook technique may not claim an
  example it cannot show**. Those are documented decisions
  (`.ai/DECISIONS.md`, 2026-08-26), not style choices. The importer,
  `scripts/import-research-cases.mjs`, takes each claim's
  `publication_wording` and never the internal `analysis` field, and never
  imports the raw `evidence/**` pulls.
- **Editorial judgment about that research lives in
  `lib/content/fake-resistance-editorial.ts` and is applied at the seam, not
  at import** — technique tags, withheld findings each with a written reason,
  per-case framing and guards, and a glossary rewriting program shorthand
  (`case-05`, `groups 01/03`, `NAMED_PERSON`) into what it refers to. Putting
  it there is what stops a re-import reverting it. Two consequences are
  load-bearing: the playbook's examples are **derived from the tags**, so a
  chapter can never point at something the site is not publishing, and
  `EDITORIAL_STAGE` — not the importer — advances a case's lifecycle.
- `components/sections/SectionPage.tsx` is the dossier shell for seven of them:
  a full-width identity band and a centred 68ch reading measure. There is no
  footer — the page ends where the content ends (`.ai/DECISIONS.md`).
  Above 1220px both margins work: `SectionToc.tsx` builds an "In this file"
  rail on the left from the rendered `h2`s (no per-page data, so it cannot
  drift), and each record's citation moves into the right margin beside it.
  `ScanBackdrop` continues the corpus outside that band, masked via
  `--content-w`, which is `--reading-w` plus both rails on pages that carry
  them. Five props exist: `register` (`muted` — October 7) and `accent`
  (`ember` — Fake Resistance) are the only sanctioned per-section
  *deviations*; `surface="quiet"` is carried by all seven and is not a
  deviation; `aside` is a page-level right rail that exists and is unused; and
  `breadcrumb` — added 2026-08-27 (R-06) with the shape `DocPage` already
  used — renders the trail in the identity band *in place of* the inert route
  slug, and retargets the exit link.
- **The exit link goes one level up, not home.** `a.identityExit` in both
  `DocPage.tsx` and `SectionPage.tsx` derives its href and label from the
  **last `breadcrumb` item** ("← Back to {label}"), falling back to `/` and
  "Back to the scan" when no trail is passed. So the eight destinations,
  `/methodology` and `/corrections` are unchanged, while the archive indexes,
  all ~1,177 archive records and the five `/fake-resistance` child pages now
  step back to their real parent. Archive pages needed no per-page change —
  `ArchiveRecordPage` was already passing `breadcrumb={archiveTrail(pkg)}`, and
  the fix was to *use* it (`.ai/DECISIONS.md`, R-06).
- **The evidence margin is a grid, never absolute positioning.** `marginNote`
  in `content.module.css` makes the record's host a two-track grid whose second
  track is zero-wide, so a citation taller than its record lengthens its own
  row instead of overrunning the next one. A host therefore needs its record
  and its sources as *sibling* elements (`.timelineMain`, `.dispatchMain`,
  `.caseFileMain`). Cards in a multi-column grid opt out — see Our Heroes.
- **`lib/content/` is the frontend's content seam** — static today, shaped so
  the eventual swap to a real published-content query is a change to these
  function bodies rather than to any call site. It is held to the same import
  boundary as `app/` and `components/`. Every module is `async` except
  `home.ts`, which exports synchronously. That was originally load-bearing —
  an `await` in the home route's render path put it behind `app/loading.tsx`'s
  Suspense boundary, which without JavaScript was never replaced. **That file
  is now deleted, so the constraint no longer binds**; the synchronous exports
  are kept because nothing needs them to change, not because an `await` would
  now break the route. Anyone making `home.ts` async should re-check the home
  route's no-JavaScript render rather than assume either way.
  `archive.ts`, `testimonies.ts` and `documentation.ts` are async and safe to
  be: none of them is in the home route's render path.
- `components/briefs/` is the Geopolitical Brief, the one page with its own
  layout and reading-progress treatment; its content is still a static
  reference cut in `geopolitical-reference.ts`, adapted onto
  `components/content/` through `adapters.ts`.
- **Two `app/` subtrees are not otherwise described here.**
  `app/admin/**` is a Hebrew ops dashboard behind Neon Auth
  (`/admin`, `/admin/login`), reading `GET /api/v1/admin/status`.
  `app/auth/x/**` is a public X OAuth2 begin/callback/signout trio. The public
  chat launcher and its X sign-in affordance were removed from the site shell;
  these routes remain backend entry points. Both import
  `@/server/modules/public-x-auth` under a purpose-written carve-out in
  `eslint.config.mjs`. Three things about this are unresolved rather than
  designed: the feature went from `chore(auth): quarantine unfinished X
  sign-in` to `feat(auth): include X public sign-in` with **no entry in
  `.ai/DECISIONS.md`** — on a public repo, for a public identity surface;
  `app/robots.ts` disallows `/particle-demo` and `/api/` but neither `/admin`
  nor `/auth`, so both shells are crawlable.
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
Neon, Blob and AI Gateway **are provisioned and live in Production** — see
"Wired infrastructure" below, and `docs/vercel-infrastructure.md` for the
topology. This paragraph claimed the opposite until 2026-08-27 while the
section 50 lines down described the live stack, so treat the wired list as
authoritative if anything here drifts again. Frontend work must still not
silently provision or mutate those services.

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
directly, as in `assessments/rules.ts`. **All ten data modules follow this**;
`publications` and `reports` kept their repository inline until 2026-08-27.
The eleventh, `public-x-auth`, is a deliberate exception: a pure re-export
facade over `core/auth/public-x.ts`, with no service, no repo and no database,
existing so `app/auth/**/route.ts` can reach it under the carve-out in
`eslint.config.mjs`.

### Cross-cutting rules worth knowing before editing

- `server/core/config.ts` is the only **application-runtime** file that reads
  `process.env`. Three others do, none of them runtime: `drizzle.config.ts`,
  `server/db/testing.ts`, and a build-time `NODE_ENV` check in
  `components/graphics/viewport.ts`.
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

### Wired infrastructure and load-bearing gaps

Verified against the code on 2026-08-26. `docs/architecture.md` carries the
full list; these three change what an editor should assume.

- **Neon Auth is the Production identity boundary.**
  `/api/auth/[...path]` restricts signup to `ADMIN_EMAIL`; `authenticateAdmin()`
  verifies the session, upserts `app_user` and loads the five capability grants.
  The `x-actor-label` shim is development-only.
- **RLS is engaged at runtime.** This bullet said the opposite until
  2026-08-27; it was wrong. `server/http/handler.ts` wraps every classified
  request in `withDatabaseRole(role, identity, invoke)`, which takes a dedicated
  pooled connection, issues `SET ROLE` plus `set_config('app.identity', …)`, and
  `RESET ALL` on release. Migration `0018` grants the owner membership in
  `app_public`/`app_staff`/`app_service` so `SET ROLE` succeeds; `0019` adds the
  policy that lets `INSERT … RETURNING` work under `app_public`.
  **`PUBLIC_V1` is exactly seven entries** — `GET /search`,
  `GET /published-items`, `POST /reports`, and the four chat paths. Everything
  else under `/api/v1/` goes through `authenticateAdmin()` and fails closed, so
  `GET /api/v1/evidence` is staff-only, not anonymous. `docs/api.md`'s guard
  table still describes ~12 of those routes as `anon` and understates the
  lockdown.
  **`requireCapability()` is called from nowhere, and that is now a recorded
  decision rather than a gap** (`.ai/DECISIONS.md`, 2026-08-27). There is one
  account, `authenticateAdmin()` grants it every capability on each sign-in, so
  a check could only ever pass — while adding a way to be locked out. What
  protects those operations is the SQL triggers, which hold on every path, and
  the `evidence_staff_reads_unrestricted` RLS policy, which reads
  `capability_grant` directly. `tests/admin-capabilities.test.ts` pins that the
  owner holds all five. **Wire it up when a second account exists.**
  **One real gap survives:** `withDatabaseRole` has no test:
  `tests/rls.test.ts` proves the policies via `SET LOCAL ROLE` in a transaction
  on PGlite, which is not the pooled session-scope mechanism production uses.

### Tests

`tests/` runs on vitest in a node environment against `server/db/testing.ts`
`freshDatabase()` — PGlite, a real Postgres 18 in WASM, migrated per test, so
triggers and constraints behave as they will in Neon. PGlite has no pgvector:
semantic-search tests skip unless `TEST_DATABASE_URL` points at a Postgres that
has it, while lexical search (`tsvector`, `pg_trgm`) is fully covered locally.
`vitest.config.ts` aliases `server-only` to its empty module rather than
letting tests drop the import.
