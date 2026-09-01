# Project map

Where everything lives, what owns what, and where a new file goes.

The interactive version is [`project-map.html`](project-map.html) — **generated
by [`scripts/project-map.mjs`](../scripts/project-map.mjs), not written by
hand.** `npm run map` rebuilds it by scanning the repository; `npm run map:check`
fails if it has drifted. Authored Hebrew lives in
[`scripts/project-map-prose.mjs`](../scripts/project-map-prose.mjs): exact entries for
areas and key files, then patterns so a new file still gets a real explanation
instead of vanishing. The page has two modes — a list of every tracked file,
and Flowise-style flow diagrams — and a click opens an explanation drawer.

This file is the reference. The page needs no server and makes no network
request.

Two independent halves share this repository and **no source files**. An
editorial public site under a particle intro, and an information-model API.
They are kept apart by lint rules rather than by convention:
`eslint.config.mjs` states the architecture as errors, so a violation fails
`npm run lint` rather than a review.

**The tree below carries no file counts, deliberately.** It used to, and every
one of them was wrong: `app/` read 97 against 135, `server/` 125 against 189,
`tests/` 27 against 67, `.claude/` 12 against 110 — and the counting rule was
not even consistent between rows. A number nothing regenerates is a number that
rots, and this file's own rule about migration counts applies to itself. What
each area is *for* is stable and belongs here; how many files are in it is
scanned at run time by [`project-map.html`](project-map.html), which is the
exact and only source for a count.

## The tree

```
lions-of-zion/
├── app/                     Every route. Folder name IS the URL — never reorganise.
│   ├── api/                 Route handlers: parse, call one module, serialise.
│   ├── admin/               Hebrew ops dashboard behind Neon Auth.
│   ├── auth/x/              Public X OAuth: begin, callback, signout.
│   ├── october-7/           Hub + ~1,177 prerendered archive pages beneath it.
│   ├── fake-resistance/     Hub + playbook, network, 7 case files.
│   └── …                    8 dossier routes, corrections, methodology
├── components/              Feature directories.
│   ├── intro-scene/         THE scene: one canvas, one clock, the intro lion.
│   ├── content/             Shared editorial blocks + the evidence-margin grid.
│   ├── archive/             One renderer for both archives, no branching.
│   ├── sections/            SectionPage (7 dossiers) and DocPage (~1,180 routes).
│   ├── briefs/              The Geopolitical Brief — the one bespoke layout.
│   ├── support/             Report and volunteer forms.
│   ├── typographic-field/   The home hero's typographic motion engine.
│   ├── intro/               Pure timeline data + CPU text sampling. No rendering.
│   ├── site/                SiteHeader and the editorial shell.
│   └── graphics/            Retired photographic-scene contract. One test holds it up.
├── lib/                     The frontend's content seam. Static today, swappable.
│   └── content/             One module per surface; all async except home.ts.
├── server/                  The API. Never imports the frontend.
│   ├── db/                  Schema, migrations, PGlite test harness.
│   ├── modules/             Fourteen modules: index → service → repo (+ rules).
│   ├── core/                config, versioning, outbox, audit, auth, AI gateway.
│   ├── contracts/           zod only. The one layer the frontend may import.
│   ├── http/                handler(), problem+json, the RLS role boundary.
│   └── jobs/                Queue consumers. Never touches the DB directly.
├── content-packages/        COMMITTED SOURCE DATA, ~14 MB. Not generated.
│   ├── hamas-massacre/      335 records / 670 language versions.
│   ├── october7/            179 records / 505 versions.
│   └── fake-resistance/     7 cases + index + network graph.
├── docs/                    Reference documentation.
│   └── archive/             Closed and superseded. Not sources of truth.
├── tests/                   vitest + PGlite.
├── scripts/                 Verify, import, bake, ops.
├── public/                  Baked output + typeface + scan corpus. Literal paths.
├── assets/                  Bake sources — and runtime imports. This ships.
├── .ai/                     DECISIONS (why), STATE (now), WORKFLOW, ROLLBACK.
├── .claude/                 Agents, hooks, skills. Excluded from deploys.
├── .design-sync/            Design-system export pipeline. Local tooling.
└── .github/                 CI: gate, then headless route smoke.
```

**Generated, never committed:** `.next/`, `node_modules/`, `out/`, `build/`,
`coverage/`, `ds-bundle/`, `.ds-sync/`, `screenshots/`, `.vercel/`,
`.claude/worktrees/`, `public/archive/` (dev symlinks), `.blob-upload/`.
`public/particles/*.bin` and `public/posters/*` **are** generated and **are**
committed, deliberately — they are the shipped artefacts. `public/icons/*.sdf.png`
is the same kind of thing but is now orphaned: it held the orbit node icons, and
`bake:nav-icons` was deleted with the radial navigation.

## Entry points

| Entry | File | Notes |
| --- | --- | --- |
| Home | `app/page.tsx` → `CinematicIntroGate` | Editorial home beneath a once-per-tab particle entrance |
| Root layout | `app/layout.tsx` | 4 fonts and shared metadata |
| The scene | `components/intro-scene/Scene.tsx` | The only live renderer and the only timeline clock |
| Nav contract | `lib/site-navigation.ts` | `SITE_NAVIGATION` — exactly 8, read by the header, sitemap, 404 and section pages |
| Every API request | `server/http/handler.ts` | Classifies, engages the RLS role, translates errors |
| Every versioned write | `server/core/versioning.ts` `recordVersion()` | The only write path. Nothing else may UPDATE a versioned table |
| Job intent | `server/core/outbox.ts` `emit()` | Written inside the causing transaction |
| Env | `server/core/config.ts` | The only application-runtime `process.env` reader |
| Sitemap | `app/sitemap.ts` | Public URLs derived from `SITE_NAVIGATION` and the package indexes |

## How the areas depend on each other

```
app/ ──────────┐
components/ ───┼──> lib/content/ ──> content-packages/     (build-time reads)
               │
               └──> server/contracts/  ← the ONLY server import the frontend may make

app/api/ ──> server/modules/<name>/index.ts ──> service ──> repo ──> server/db/
     │                                              │
     └──> server/http/handler.ts ──> withDatabaseRole() ──> SET ROLE (RLS)
                                                    │
                                   server/core/{versioning,outbox,audit}
                                                    │
                       vercel.json crons ──> app/api/internal/ ──> server/jobs/
```

The frontend cannot reach a Postgres driver: `app/**` and `components/**` may
import `@/server/contracts/*` and nothing else under `server/`. `app/api/**` may
not import `@/server/db` or a module's internals. `server/contracts/**` may
import zod and nothing else, so it stays loadable from an RSC and from a test
with no database.

## Sources of truth

| Topic | Document |
| --- | --- |
| Optional agent working notes — tools, not gates | `.ai/WORKFLOW.md` |
| Invariants an editor must not break | `CLAUDE.md` |
| Why a durable choice was made | `.ai/DECISIONS.md` — append-only, never archived |
| Where the work stands today | `.ai/STATE.md` |
| System map and known gaps | `docs/architecture.md` |
| Routes and guards | `docs/api.md` |
| Tables, triggers, migration counts | `docs/data-model.md` |
| Environment variable names | `docs/environment.md` |
| Verification, CI, deploy | `docs/operations.md` |
| What is deployed and what it costs | `docs/vercel-infrastructure.md` |
| Reading-page type, spacing and colour | the token block at the top of `app/globals.css` — the .ai/DESIGN-V2.md this used to name was folded into those comments and deleted |
| Delivery plan (Hebrew) | `TODOS.md` |
| The eight destinations | `lib/site-navigation.ts` `SITE_NAVIGATION` |
| Repository shape | this file |

A number that appears in two documents will drift. Migration counts were
duplicated into four files and two were wrong; they belong in `data-model.md`
alone, and everywhere else should link rather than restate.

## Where a new file goes

| You are adding | Put it in | Because |
| --- | --- | --- |
| A page | `app/<route>/page.tsx` | The folder name is the URL |
| A ninth destination | **Stop.** `SITE_NAVIGATION` is eight | Both hubs prove sub-routes are not new nodes |
| A component used by 2+ routes | `components/<feature>/` | |
| A component used by exactly one route | Beside its page, or `components/<feature>/` | Both are idiomatic; the repo does both |
| Content a page reads | `lib/content/<surface>.ts` | The seam. Keep call sites stable |
| An API route | `app/api/v1/<noun>/route.ts` | Parse, call one module's `index.ts`, serialise |
| Business logic | `server/modules/<name>/service.ts` | Never in the route |
| A query | `server/modules/<name>/repo.ts` | Not inline in the service — two modules already break this |
| Pure, DB-free policy | `server/modules/<name>/rules.ts` | `assessments/rules.ts` is the reference |
| A schema the frontend also needs | `server/contracts/` | zod only |
| A rule about data | A **new numbered migration** | Status transitions and the publish gate are SQL triggers |
| A test | `tests/<subject>.test.ts` | Flat; PGlite via `freshDatabase()` |
| A verification script | `scripts/` | And add it to the table in `docs/operations.md` |
| A doc | `docs/` | And add a row to `docs/README.md`, or it is born orphaned |
| A decision someone could undo | `.ai/DECISIONS.md` | Append. Never edit an existing entry |
| A finished doc | `docs/archive/` | Lift anything unique out first |
| A local scratch file | Not the repo root | The root has one untracked stray already |

## Two things that will bite

**`public/` is addressed by literal path.** `public/particles/*.bin`,
`public/posters/*` and `public/assets/gentilis_regular.typeface.json` are loaded
by string. A rename breaks the scene at runtime with nothing failing at build
time.

**CI guards the no-JavaScript invariant, but only on `/`.** `CLAUDE.md` marks
"do not reintroduce a root-level `loading.tsx`" load-bearing, and since
2026-08-27 that is enforced in CI: `scripts/ci-smoke.mjs` opens a
`javaScriptEnabled: false` context, loads the home route, and asserts the
server-rendered `nav[aria-label="Primary navigation"]` links and the poster
`<img>` are in the document with **zero** `div[hidden][id^="S:"]` Suspense
shells — the failure message names a root-level `loading.tsx` as the usual
cause. `tests/no-js-invariant.test.ts` is the
cheap tripwire beside it — it fails if `app/loading.tsx`, `app/template.tsx` or
`app/default.tsx` reappears. `scripts/final-verify.mjs` covers the same ground
a second time on the macOS workstation and is no longer the only guard.

What CI still cannot see is every *other* route: the assertion runs on `/`
alone, so a content route that acquires its own Suspense boundary would pass.
Scope any loading state to its own segment and check a sibling content route's
no-JS render by hand.
