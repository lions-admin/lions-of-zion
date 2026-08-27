# Lions of Zion

A full-viewport Next.js particle experience, and an information-model backend
that shares its repository and nothing else.

One React Three Fiber canvas and one Three.js WebGPU/TSL renderer own the
story intro, the crowned lion, the live network scan and the radial
navigation. WebGL2 is the supported fallback. Behind the navigation are eight
ordinary scrolling document pages.

The backend under `app/api/` and `server/` ingests sources, attaches evidence
to claims, has a second human review an assessment, and publishes what
survives. Neon, Blob and the AI Gateway are provisioned and live in Production
— see [`docs/vercel-infrastructure.md`](docs/vercel-infrastructure.md). Nothing
in the frontend requires them, which is why the app runs with no configuration
at all.

## Run locally

```bash
npm ci
npm run sync:start
npm run dev
```

Open <http://localhost:3000>. No configuration is needed: the frontend reads
no environment variables and the test suite runs against an in-process
database. Node 22.

## Routes

The eight destinations behind the radial navigation:

`/geopolitical-brief` · `/support-us` · `/war-update` · `/october-7` ·
`/our-heroes` · `/israels-story` · `/fake-resistance` · `/we-are`

Plus `/methodology` and `/corrections`, which are linked from the prose that
means them rather than from the orbit.

`components/particle-nav/config.ts` `defaultNodes` is the single source of
truth for all eight — it feeds the particle nodes, the DOM links, the hover
cards, the page shell and the sitemap.

### The October 7 archive

`/october-7` is also a hub. Roughly 1,177 further pages sit beneath it, holding
two crawled archives in full:

`/october-7/testimonies` — 179 records, up to seven languages
`/october-7/documentation` — 335 records, English and Spanish, six categories

They are child routes, not a ninth destination; `defaultNodes` stays at eight.
The records' JSON is committed under `content-packages/`, while their ~1.8 GB
of media is not — it is served from `NEXT_PUBLIC_ARCHIVE_CDN`, or from a
gitignored local symlink in development. See
[`docs/archive-integration.md`](docs/archive-integration.md).

## Graphics architecture

- `components/intro/` holds only the pure story timeline and CPU text
  sampling. It renders nothing.
- `components/particle-nav/` owns every live visual layer in one React Three
  Fiber scene. All particle materials and simulation work use TSL.
- `components/Experience.tsx` mounts that scene and, below it, the front-page
  band. The intro timeline drives the same lion that remains at the centre of
  the navigation.
- The live background is a particle-built network scan. There is no
  photographic background and no star field.
- The real navigation links and a generated poster are server-rendered. With
  JavaScript disabled, the intro enhancement is hidden and the links remain
  usable immediately.

`/?forceWebGL=1` verifies the complete experience on WebGL2.
`/particle-demo?forceWebGL=1` exposes the isolated tuning harness.

## Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:changed  # adaptive checks for the current diff
npm run verify:full     # complete handoff and CI gate
```

```bash
npm run map          # regenerate docs/project-map.html from the actual tree
npm run map:check    # fail if it has drifted
```

`npm run lint` is where the architecture boundaries are enforced —
`eslint.config.mjs` states them as errors, so a violation fails the build
rather than waiting for review.

Visual verification, after starting the dev server:

```bash
npm run verify:graphics -- http://localhost:3000 /tmp/lions-matrix
node scripts/final-verify.mjs http://localhost:3000 /tmp/lions-final
node scripts/verify-home-band.mjs http://localhost:3000 /tmp/lions-home-band
node scripts/verify-doc-scroll.mjs http://localhost:3000
node .claude/skills/verify-intro/capture.mjs
node scripts/ci-smoke.mjs http://localhost:3000
node scripts/verify-archive-assets.mjs <cdn-base>
```

**Five** of these launch the installed macOS Google Chrome rather than a hidden
pane or headless Chromium — the four `verify-*` scripts above `ci-smoke` and
`capture.mjs`. A hidden pane throttles `requestAnimationFrame`, and headless
Chromium falls back to SwiftShader, which the GPU probe correctly rejects. They
do not run on Linux or in CI.

The last two run anywhere: `ci-smoke.mjs` uses Playwright's own Chromium, and
`verify-archive-assets.mjs` needs no browser at all — it is plain `fetch`
against the CDN base. `docs/operations.md` has the table of what each asserts.

## Rebuilding particle assets

```bash
npm run bake:nav-lion
npm run bake:nav-icons
npm run poster:nav
```

Source artwork lives in `assets/`; generated runtime files land in
`public/particles`, `public/icons`, and `public/posters`.

## Deployment

Git auto-deploy is not connected. Production deployment is a separate, manual
Vercel operation — a merge to `main` does not reach production on its own. CI
runs the full gate plus a route smoke test and does not deploy.

## Documentation

Start at [`docs/`](docs/README.md).

| | |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | The system map, the enforced boundaries, the flows, the known gaps |
| [`docs/api.md`](docs/api.md) | Every HTTP route, its guard, its shape |
| [`docs/data-model.md`](docs/data-model.md) | Tables, triggers, versioning, RLS |
| [`docs/environment.md`](docs/environment.md) | Environment variables, by name |
| [`docs/operations.md`](docs/operations.md) | Install, verify, CI, deploy, troubleshoot |
| [`docs/PROJECT_MAP.md`](docs/PROJECT_MAP.md) | The repository's shape: every area's role, the entry points, where a new file goes |
| [`docs/project-map.html`](docs/project-map.html) | The same, drawn — in Hebrew. Generated by `npm run map`; never edit it by hand |
| [`docs/archive/`](docs/archive/README.md) | Documents that did their job. Not sources of truth |
| [`CLAUDE.md`](CLAUDE.md) | The working brief and the invariants |
| [`.ai/DECISIONS.md`](.ai/DECISIONS.md) | The ADR log — why things are the way they are |
| [`PROJECT_STRUCTURE_AUDIT.md`](PROJECT_STRUCTURE_AUDIT.md) | Every area classified with its evidence, and what was deliberately left alone |
