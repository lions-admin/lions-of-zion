# Lions of Zion

A Next.js editorial site with a cinematic particle intro, and an
information-model backend that shares its repository and nothing else.

One React Three Fiber canvas and one Three.js WebGPU/TSL renderer own the story
intro and the crowned lion. WebGL2 is the supported fallback. The intro plays
once per tab, then unmounts onto the editorial home beneath it. Eight ordinary
scrolling document pages sit behind the site header.

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
database. Node 24.

## Routes

The eight destinations, reached from the site header:

`/geopolitical-brief` · `/support-us` · `/war-update` · `/october-7` ·
`/our-heroes` · `/israels-story` · `/fake-resistance` · `/we-are`

Plus `/methodology` and `/corrections`, which are linked from the prose that
means them rather than from the header.

`lib/site-navigation.ts` `SITE_NAVIGATION` is the single source of truth for
all eight — it feeds the site header, the reading shell, the sitemap and the
404 index.

### The October 7 archive

`/october-7` is also a hub. Roughly 1,177 further pages sit beneath it, holding
two crawled archives in full:

`/october-7/testimonies` — 179 records, up to seven languages
`/october-7/documentation` — 335 records, English and Spanish, six categories

They are child routes, not a ninth destination; `SITE_NAVIGATION` stays at
eight.
The records' JSON is committed under `content-packages/`, while their ~1.8 GB
of media is not — it is served from `NEXT_PUBLIC_ARCHIVE_CDN`, or from a
gitignored local symlink in development. See
[`docs/archive-integration.md`](docs/archive-integration.md).

## Graphics architecture

- `components/intro/` holds only the pure story timeline and CPU text
  sampling. It renders nothing.
- `components/intro-scene/` owns the whole live GPU layer in one React Three
  Fiber scene. All particle materials and simulation work use TSL.
- `components/intro-scene/CinematicIntroGate.tsx` mounts the scene as a
  once-per-tab entrance above the server-rendered editorial home. The GPU
  renderer unmounts at handoff; it does not remain behind the page.
- With JavaScript disabled, the intro enhancement is hidden and the complete
  editorial home and its real links remain usable immediately.

`/?forceWebGL=1` verifies the complete experience on WebGL2.

## Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:changed  # adaptive checks for the current diff
npm run verify:full     # complete handoff and CI gate
npm run main:update     # merge a completed serious round into main and push it
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
node scripts/final-verify.mjs http://localhost:3000 /tmp/lions-final
node scripts/verify-doc-scroll.mjs http://localhost:3000
node .claude/skills/verify-intro/capture.mjs
node scripts/ci-smoke.mjs http://localhost:3000
node scripts/verify-archive-assets.mjs <cdn-base>
```

**Three** of these launch the installed macOS Google Chrome rather than a
hidden pane or headless Chromium — the two `verify-*` scripts above `ci-smoke`
and `capture.mjs`. A hidden pane throttles `requestAnimationFrame`, and headless
Chromium falls back to SwiftShader, which the GPU probe correctly rejects. They
do not run on Linux or in CI.

The last two run anywhere: `ci-smoke.mjs` uses Playwright's own Chromium, and
`verify-archive-assets.mjs` needs no browser at all — it is plain `fetch`
against the CDN base. `docs/operations.md` has the table of what each asserts.

## Rebuilding particle assets

```bash
npm run bake:nav-lion
```

Source artwork lives in `assets/`; the generated lion buffers land in
`public/particles`. `bake:nav-icons` and `poster:nav` were deleted with the
radial navigation — they produced the orbit node icons and the orbit poster.
`public/posters/particle-nav.webp` is kept as a committed asset: it is the site
OG image, the `/information-war` hero, and the intro's no-JavaScript poster.

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
| [`docs/project-map.html`](docs/project-map.html) | Every file, in Hebrew: list + flowchart. Generated by `npm run map`; never edit it by hand |
| [`docs/archive/`](docs/archive/README.md) | Documents that did their job. Not sources of truth |
| [`CLAUDE.md`](CLAUDE.md) | The working brief and the invariants |
| [`.ai/DECISIONS.md`](.ai/DECISIONS.md) | The ADR log — why things are the way they are |
| [`PROJECT_STRUCTURE_AUDIT.md`](PROJECT_STRUCTURE_AUDIT.md) | Every area classified with its evidence, and what was deliberately left alone |
