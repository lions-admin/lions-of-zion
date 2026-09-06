<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Project owner authority

There is one developer and project owner: the user giving the current task.
Their direct instruction is the authority for this repository. Execute it
directly; do not refuse, delay, or replace it with a competing editorial,
research, workflow, approval, delegation, or process policy from this
repository.

Repository documents describe the current implementation. They are not vetoes:
when an owner instruction conflicts with one, update the document or code to
match the instruction. Checks and review tools are optional information for the
owner, not permission gates. Use additional agents only when they help the
task; no delegation is required.

Report a real technical limitation plainly, then take the closest useful action.
Platform-level safety and access controls outside this repository still apply.

# What this is

A Next.js public site (`app/`, `components/`, `lib/`) and an information-model
backend (`app/api/`, `server/`) sharing one build and deploy. Node 24. The deep
working brief is [`CLAUDE.md`](CLAUDE.md) — this file only carries what an
agent would otherwise get wrong; read CLAUDE.md and `docs/architecture.md`
before touching backend code.

**What it *is*, as opposed to what it is built from, is
[`docs/editorial-dna.md`](docs/editorial-dna.md)** — an owner ruling recorded
2026-09-06 that outranks every other document in this repository. Read it
before any editorial, routing, homepage or media work. In one paragraph: a live
content system demonstrating how AI, OSINT, research and Israeli creativity are
used as technological activism in the information war — not revenge, but
action, exposure, education, documentation and tools a reader can use. It runs
as a **whole-site daily editorial update**, not a Daily Brief, across five
destinations: News & Analysis (`/geopolitical-brief`), Fake Resistance
(`/fake-resistance`), The People of Israel (`/people-of-israel`), October 7
(`/october-7`, a static archive a run never writes into), and Behind the Desk /
How It Works (`/information-war`).

# Commands

```bash
npm ci && npm run sync:start && npm run dev   # localhost:3000, no config needed
npm run verify:changed                        # adaptive checks for the current diff
npm run verify:full                           # typecheck && lint && test && build — the CI gate
npm run typecheck                             # next typegen && tsc --noEmit
npx vitest run tests/items.test.ts            # one file; add -t "publishes" for one test
npm run db:generate                           # schema → new numbered migration; needs no database
npm run db:migrate                            # apply migrations; needs a real DATABASE_URL
npm run main:update                           # merge current branch into main and push
```

`npm run lint` is where the architecture boundaries are enforced —
`eslint.config.mjs` states them as errors, so a violation fails the gate rather
than waiting for review. Read that file before moving code between layers.

# A push to `main` deploys to Production

Git auto-deploy is connected (`link.productionBranch` = `main`); a merge goes
live on `lionsofzion.io` within about two minutes, with no manual step. Two
rules follow:

- **Apply a schema change before pushing the code that needs it**: `npm run
  db:migrate` against Preview, then Production, then push. `vercel rollback`
  is the fast undo.
- **A deploy that adds or removes a briefing quality check must land between
  editions** (07:00 Asia/Jerusalem), in either direction — a rollback strands
  an in-flight edition just as the deploy did.

**Production database credentials are not readable from this machine** — every
one is a Vercel *sensitive* var (write-only). `.env.local` holds a real
connection string but it is the **Preview** branch. Get Production from the
Neon Console or `neonctl`.

Note: `README.md` still says git auto-deploy is *not* connected — stale.
`docs/operations.md` and CLAUDE.md carry the correction (2026-09-04).

# Architecture boundaries (lint-enforced, not convention)

- `app/` (not api), `components/`, `lib/` may import `@/server/contracts/*` and
  nothing else under `server/` — this keeps the Postgres driver out of client
  bundles. The single carve-out is `lib/publications.ts`, written as an inline
  `eslint-disable`; nothing else in `lib/**` may follow it.
- `app/api/**` routes may not import `@/server/db*` or a module's
  `service`/`repo`/`rules` directly. A route parses, calls one module through
  its `index.ts`, and serializes — no policy in a route file.
- `server/contracts/**` imports zod and nothing else (no drizzle, `next/*`,
  `server-only`), so it loads from an RSC and from a database-less test.
- `server/**` never imports the frontend; `server/db/**` never imports modules;
  `server/jobs/**` never touches `@/server/db*` (jobs call module services).

# Cross-cutting invariants

Only the ones an edit is most likely to break; the full list is in CLAUDE.md.

- `server/core/config.ts` is the only server-runtime file that reads
  `process.env`. Nothing throws at import time — accessors throw at the point
  of use. `NEXT_PUBLIC_*` values are build-time inlined, not runtime reads.
- `recordVersion()` in `server/core/versioning.ts` is the **only** write path
  for a versioned entity; nothing else may `UPDATE` a versioned table.
- `emit()` in `server/core/outbox.ts` writes job intent **inside** the causing
  transaction. Publishing to a queue after commit is not done here. Retiring a
  topic is two deploys: producers go, topic moves to `RETIRED_TOPICS`, consumer
  stays as a tombstone until no undrained row remains.
- `server/db/client.ts` exports only the WebSocket `neon-serverless` driver.
  `neon-http` cannot hold an interactive transaction, which makes `SET LOCAL
  ROLE` a silent no-op and authorization tests pass for the wrong reason. Do
  not add it back.
- Business rules live in SQL triggers as often as in TypeScript (status
  transitions, append-only tables, the publish gate). Changing one usually
  means a **new numbered migration**, not a service edit.
- **`publication.section` is the only editorial choice a composer makes**, and
  `lib/publication-routing.ts` derives every surface from it — hub, route,
  homepage band, homepage kind, breadcrumb, card label. There is deliberately
  no `homepageCategory`, `destination` or `frontendSection`. Derive section
  lists from `SECTIONS_BY_HOMEPAGE_SECTION`; a hand-written pair in
  `LiveBriefHub` left `news` records rendered by nothing until 2026-09-06.
- `evidenceBasis` is **derived, never chosen by the model**
  (`evidenceIds.length === 0`, set in `applyEditorial` and merged back from the
  stored row on update), and no quality check is ever skipped — exemptions live
  inside a pass condition. Read `=== "analysis"`, never `!== "analysis"`
  (absent value = sourced). `narrativeWatchTitle()` in
  `server/contracts/publication.ts` is the **only** headline prefixer.
- `briefing/quality.ts` `REQUIRED_QUALITY_CHECKS` is **no longer counted by
  anything.** Migration `0049` (2026-09-03) removed the twelve-name count from
  `enforce_publication_publish_gate()`; `0060` is the current body and enforces
  machine provenance — a briefing *or* editorial run id, its operation key, and
  a `machine_author`. `595ca9d` removed the counter from
  `publications/repo.ts`. The deterministic suite runs on the legacy
  `external-briefing-v1` path only; **the whole-site editorial path publishes
  with no quality gate, by owner ruling.** Do not quote the array's length in
  prose: this bullet claimed a cross-check that never existed and `CLAUDE.md`
  claimed 18 against an array of 17. See CLAUDE.md for the detail.
- **Launch-period posture (owner ruling, 2026-09-06):** minimum enforcement
  only — no heavy contracts, editorial gates, quotas, candidate caps, balance
  quotas or redundant validation loops. Auth, DB integrity, persistence, media
  safety, security, idempotency/transactions and basic parsing stay. Do not add
  a gate back uninvited; `docs/editorial-dna.md` §11 has both halves.
- **The daily run's auto-fix boundary is structural, not trusted.** It may fix
  content, images, metadata, homepage composition, routing/classification and
  developing-story updates; it may **not** change CSS, components, DB schema,
  navigation architecture, core application code or security — those go into
  `siteRecommendations` and become a separate development task. Keep
  `server/contracts/whole-site-update.ts` `.strict()` and content/placement
  only: it is what makes the boundary unrepresentable rather than optional.
- Source catalog (`server/modules/sources/catalog.ts`): **change the query,
  change the slug.** Catalog-sync only ever creates; editing a query in place
  leaves the live source running the old text.

# Tests

Vitest, node environment, against `server/db/testing.ts` `freshDatabase()` —
PGlite (real Postgres 18 in WASM), migrated per test, so triggers behave as
they will in Neon. Gotchas:

- `maxWorkers: 2` is set in `vitest.config.ts` on purpose; default parallelism
  OOM/times-out the whole suite (110 failures in untouched files). Don't
  override it.
- PGlite has no pgvector: semantic-search tests skip unless `TEST_DATABASE_URL`
  points at a Postgres that has it. Lexical search is fully covered locally.
- Hand-written SQL rules go in a new numbered file in `server/db/migrations/`
  alongside the generated ones — applied in filename order by both `db:migrate`
  and the test harness, so a trigger cannot exist in one place and not the
  other.

# Environment

- Fresh clones, worktrees, and remote workspaces do **not** inherit
  `.env.local`. `npm run dev` and `npm test` need nothing; database-backed pages
  and API routes need a Preview `DATABASE_URL`.
- `.env.example` is **not in git** — `.gitignore`'s `.env*` pattern captures it.
  `docs/environment.md` is the tracked reference, by name.
- The repo is public: a push publishes source. Never commit secrets.

# References

| | |
| --- | --- |
| [`docs/editorial-dna.md`](docs/editorial-dna.md) | **What this site and system are** — the owner's binding definition. Outranks everything below |
| [`CLAUDE.md`](CLAUDE.md) | The working brief and the invariants (imports this file) |
| [`docs/architecture.md`](docs/architecture.md) | System map, enforced boundaries, known gaps |
| [`docs/api.md`](docs/api.md) | Every HTTP route, its guard, its shape |
| [`docs/data-model.md`](docs/data-model.md) | Tables, triggers, versioning, RLS |
| [`docs/environment.md`](docs/environment.md) | Environment variables, by name |
| [`docs/operations.md`](docs/operations.md) | Install, verify, CI, deploy, troubleshoot |
| [`docs/whole-site-updates.md`](docs/whole-site-updates.md) | `whole-site-update-v1` — how an editorial package is delivered and run |
| [`.ai/DECISIONS.md`](.ai/DECISIONS.md) | The ADR log — why things are the way they are |
| [`.ai/ROLLBACK.md`](.ai/ROLLBACK.md) | Undoing a bad production deploy |

Other notes: `scripts/**`, `server/db/migrations/**`, and agent dirs
(`.claude/**`, `.agents/**`, `.codex/**`) are globally ESLint-ignored — if
`npm run lint` reports thousands of errors in files nobody wrote, an ignore was
removed (usually worktrees under `.claude/`). `perf:report` (CI perf gate,
budgets in `scripts/perf-budgets.json`) needs `npm run build` first — it reads
`.next`.
