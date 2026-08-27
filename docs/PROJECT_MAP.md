# Project map

Where everything lives, what owns what, and where a new file goes. The
interactive version is [`project-map.html`](project-map.html) — open it from
disk; it needs no server and makes no network request.

Two independent halves share this repository and **no source files**. A
particle-driven public site, and an information-model API. They are kept apart
by lint rules rather than by convention: `eslint.config.mjs` states the
architecture as errors, so a violation fails `npm run lint` rather than a
review.

## The tree

```
lions-of-zion/
├── app/                 97  Every route. Folder name IS the URL — never reorganise.
│   ├── api/             44  Route handlers: parse, call one module, serialise.
│   ├── admin/            5  Hebrew ops dashboard behind Neon Auth.
│   ├── auth/x/           3  Public X OAuth: begin, callback, signout.
│   ├── october-7/        8  Hub + ~1,177 prerendered archive pages beneath it.
│   ├── fake-resistance/  8  Hub + playbook, network, 7 case files.
│   └── …                 8 dossier routes, corrections, methodology, particle-demo
├── components/          97  Ten feature directories.
│   ├── particle-nav/    36  THE scene: one canvas, one clock, intro + nav.
│   ├── content/         18  Shared editorial blocks + the evidence-margin grid.
│   ├── chat/             9  Global launcher, modal, second canvas (desktop only).
│   ├── archive/          8  One renderer for both archives, no branching.
│   ├── sections/         8  SectionPage (7 dossiers) and DocPage (~1,180 routes).
│   ├── briefs/           5  The Geopolitical Brief — the one bespoke layout.
│   ├── support/          5  Report and volunteer forms.
│   ├── intro/            4  Pure timeline data + CPU text sampling. No rendering.
│   ├── home/             2  The below-the-fold front page.
│   └── graphics/         1  Retired photographic-scene contract. One test holds it up.
├── lib/                 15  The frontend's content seam. Static today, swappable.
│   └── content/         14  One module per surface; all async except home.ts.
├── server/             125  The API. Never imports the frontend.
│   ├── db/              60  Schema, 21 migrations, PGlite test harness.
│   ├── modules/         36  Eleven modules: index → service → repo (+ rules).
│   ├── core/            14  config, versioning, outbox, audit, auth, AI gateway.
│   ├── contracts/       11  zod only. The one layer the frontend may import.
│   ├── http/             3  handler(), problem+json, the RLS role boundary.
│   └── jobs/             1  Queue consumers. Never touches the DB directly.
├── content-packages/   535  COMMITTED SOURCE DATA, ~14 MB. Not generated.
│   ├── hamas-massacre/ 341  335 records / 670 language versions.
│   ├── october7/       185  179 records / 505 versions.
│   └── fake-resistance/  9  7 cases + index + network graph.
├── docs/                15  Reference documentation.
│   └── archive/          5  Closed and superseded. Not sources of truth.
├── tests/               27  vitest + PGlite. 397 pass, 1 deliberate skip.
├── scripts/             15  Verify (6), import (3), bake (5), ops (1).
├── public/              15  Baked output + typeface + scan corpus. Literal paths.
├── assets/               9  Bake sources — and runtime imports. This ships.
├── .ai/                  4  DECISIONS (why), STATE (now), DESIGN-V2, ROLLBACK.
├── .claude/             12  Agents, hooks, skills. Excluded from deploys.
├── .design-sync/        31  Design-system export pipeline. Local tooling.
└── .github/              1  CI: gate, then headless route smoke.
```

**Generated, never committed:** `.next/`, `node_modules/`, `out/`, `build/`,
`coverage/`, `ds-bundle/`, `.ds-sync/`, `screenshots/`, `.vercel/`,
`.claude/worktrees/`, `public/archive/` (dev symlinks), `.blob-upload/`.
`public/particles/*.bin`, `public/icons/*.sdf.png` and `public/posters/*` **are**
generated and **are** committed, deliberately — they are the shipped artefacts.

## Entry points

| Entry | File | Notes |
| --- | --- | --- |
| Home | `app/page.tsx` → `components/Experience.tsx` | Fixed full-viewport scene, then a scrolling front-page band |
| Root layout | `app/layout.tsx` | 4 fonts, metadata, the global chat launcher |
| The scene | `components/particle-nav/Scene.tsx` | The only live renderer and the only timeline clock |
| Nav contract | `components/particle-nav/config.ts` | `defaultNodes` — exactly 8, each needs `app/<id>/page.tsx` |
| Every API request | `server/http/handler.ts` | Classifies, engages the RLS role, translates errors |
| Every versioned write | `server/core/versioning.ts` `recordVersion()` | The only write path. Nothing else may UPDATE a versioned table |
| Job intent | `server/core/outbox.ts` `emit()` | Written inside the causing transaction |
| Env | `server/core/config.ts` | The only application-runtime `process.env` reader |
| Sitemap | `app/sitemap.ts` | ~1,190 URLs, derived from `defaultNodes` and the package indexes |

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
| Invariants an editor must not break | `CLAUDE.md` |
| Why a durable choice was made | `.ai/DECISIONS.md` — append-only, never archived |
| Where the work stands today | `.ai/STATE.md` |
| System map and known gaps | `docs/architecture.md` |
| Routes and guards | `docs/api.md` |
| Tables, triggers, migration counts | `docs/data-model.md` |
| Environment variable names | `docs/environment.md` |
| Verification, CI, deploy | `docs/operations.md` |
| What is deployed and what it costs | `docs/vercel-infrastructure.md` |
| Reading-page type and layout | `.ai/DESIGN-V2.md` |
| Delivery plan (Hebrew) | `TODOS.md` |
| The eight destinations | `components/particle-nav/config.ts` `defaultNodes` |
| Repository shape | this file |

A number that appears in two documents will drift. Migration counts were
duplicated into four files and two were wrong; they belong in `data-model.md`
alone, and everywhere else should link rather than restate.

## Where a new file goes

| You are adding | Put it in | Because |
| --- | --- | --- |
| A page | `app/<route>/page.tsx` | The folder name is the URL |
| A ninth destination | **Stop.** `defaultNodes` is eight | Both hubs prove sub-routes are not new nodes |
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
`public/icons/*.sdf.png`, `public/posters/*` and
`public/assets/gentilis_regular.typeface.json` are loaded by string. A rename
breaks the scene at runtime with nothing failing at build time.

**CI cannot see the no-JavaScript invariant.** `CLAUDE.md` marks "do not
reintroduce a root-level `loading.tsx`" load-bearing, but `ci-smoke.mjs` runs
with JavaScript on and nothing in `tests/` mentions it. The only guard is
`scripts/final-verify.mjs`, which needs real Chrome on macOS.
