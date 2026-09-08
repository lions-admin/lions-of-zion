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
npm ci && npm run sync:start && npm run dev   # continue on this AI's branch; no config needed
npm run verify:changed                        # adaptive checks for the current diff
npm run verify:full                           # typecheck && lint && test && build — the CI gate
npm run typecheck                             # next typegen && tsc --noEmit
npx vitest run tests/items.test.ts            # one file; add -t "publishes" for one test
npm run db:generate                           # schema → new numbered migration; needs no database
npm run db:migrate                            # apply migrations; needs a real DATABASE_URL
npm run main:update                           # publish this AI's branch -> main, then return to it
```

`npm run lint` is where the architecture boundaries are enforced —
`eslint.config.mjs` states them as errors, so a violation fails the gate rather
than waiting for review. Read that file before moving code between layers.

# Branches: one permanent branch per AI identity

**The AI identity determines the branch. The task does not, and neither does
the session, the prompt, the account, the CLI, or a restart.** Ten Codex
sessions across three days produce exactly one branch: `ai/codex`. The number
of branches follows the number of AI environments, and never the number of
sessions.

```
main = Production
  ▲    │
  │    └──── merge main in ────┐
  └── publish ──┐              ▼
                ai/claude   ai/grok   ai/codex   ai/opencode   ai/gemini-agy
```

| AI | Branch | Workspace |
| --- | --- | --- |
| Claude | `ai/claude` | `<repo-parent>/lions-of-zion-workspaces/claude` |
| Grok | `ai/grok` | `…/lions-of-zion-workspaces/grok` |
| Codex | `ai/codex` | `…/lions-of-zion-workspaces/codex` |
| OpenCode | `ai/opencode` | `…/lions-of-zion-workspaces/opencode` |
| Gemini AGY | `ai/gemini-agy` | `…/lions-of-zion-workspaces/gemini-agy` |

Each of these five branches is **permanent**: never deleted, never renamed,
never replaced by a `-v2`, a dated variant or a continuation. The workspaces
are git worktrees in a sibling directory of the repository, so five AIs can
each hold uncommitted files without those files ever mixing. The primary
checkout of the repository itself stays neutral on `main` and is used for
publishing and maintenance, not for development.

## No branch is created by default

**A new branch requires an explicit owner request.** None of the following is
one: a new session, a restarted agent, a different CLI, a different OpenAI or
Anthropic account, a new prompt, a continuation of yesterday's task, a new
"wave" of an implementation plan, or a task that feels large.

Never create by default: `fix/*`, `feat/*`, `claude/*`, `codex/*`, `grok/*`,
`opencode/*`, `gemini/*`, `task/*`, `session/*`, `*-v2`, `*-continuation`,
`*-wave-*`.

**Sub-agents inherit their parent AI's branch and workspace.** They commit
where their parent commits and must never create a remote branch. Twenty agent
sessions must not produce twenty branches.

## Identity resolution

The tooling resolves which AI it is running as, in this order:

1. the `LIONS_AI` environment variable, if set — an explicit declaration
   outranks everything, so a shared checkout can change hands;
2. otherwise the current branch, if it is already `ai/*` — the ordinary case
   inside a workspace, where nothing needs setting at all;
3. otherwise a known CLI marker for one of the five environments;
4. otherwise **nothing** — it prints the mapping and changes no Git state
   rather than guessing. Putting an agent on another agent's branch would mix
   two sets of work, which is worse than doing nothing.

## `main`

`main` is Production, not a development branch. `npm run main:update` checks it
out for a few seconds during a publish; that does not make it somewhere to
work. Do not commit unfinished work to it. A session begins and ends on this
AI's own branch.

When `main` advances while an AI still has unpublished work, **`main` is merged
*into* the AI branch** — an ordinary merge commit, no rebase and no force-push.
A conflict is reported and left for a human to resolve. It is never
auto-resolved, and it is never worked around by starting a new branch.

## The editorial branches are not stale development branches

`chatgpt-editorial-updates` and `editorial-updates` are **operational editorial
delivery branches**, outside this model entirely. The first is where whole-site
update packages are committed for the delivery workflow to pick up; the second
is the retired historical archive of packages delivered before the rename.
They are **orphan branches that share no history with `main`**, they are
**never merged into `main` or into any `ai/*` branch**, they are never cleaned
up, and they are never used as an AI's workspace. A future agent must not read
them as abandoned development branches and "tidy" them.

`vercel.json` names all three delivery branches — `briefing-packages`,
`editorial-updates` and `chatgpt-editorial-updates` — under
`git.deploymentEnabled`, so none of them can deploy the site. Count them there
rather than trusting a number in prose; this file, `CLAUDE.md` and
`docs/operations.md` each stated a different, wrong count until 2026-09-08.

**No `ai/*` branch produces a Vercel Preview build**, and it takes two
controls, not one. `git.deploymentEnabled` in `vercel.json` lists all five
alongside the editorial delivery branches — that is what stops a deployment
from being created at all. `scripts/vercel-ignore-build.sh` then skips every
branch that is not `main`, which stops the build.

The second alone is not enough, and this was measured rather than assumed: on
2026-09-08 pushing the five new branches produced five *queued* preview
deployments, because `ignoreCommand` runs inside a deployment that already
exists. Read the CI run on GitHub instead of looking for a preview URL.

## Chrome

Every agent drives a real Chrome through the `chrome-devtools` MCP server,
registered in `.mcp.json`. That file is tracked and identical in all five
worktrees, so the capability arrives with the checkout — nothing to install
per agent.

**Each agent gets its own Chrome profile.** `.mcp.json` points at
`scripts/chrome-mcp.mjs`, which resolves who is asking — `LIONS_AI`, else the
checked-out branch, else the directory name — and hands
`chrome-devtools-mcp` a `--userDataDir` under
`<repo-parent>/lions-of-zion-workspaces/.chrome-profiles/<ai>`. This is not
tidiness: Chrome locks its user-data directory, so a shared profile means the
second agent to open a browser either fails or fights the first for the same
tabs, cookies and session. It is the worktree problem one layer up, and it
gets the same answer.

Two things that will bite an editor of that wrapper. **stdout belongs to the
protocol** — an MCP server speaks JSON-RPC on stdin/stdout, so every
diagnostic goes to stderr; a stray `console.log` corrupts the stream and the
client drops the connection with no useful error. And the server version is
**pinned**, not `@latest`, because a tool surface that changes underneath five
running agents is a debugging problem nobody asked for. Bump it deliberately.

The repository's own browser scripts — `npm run audit:ui`,
`npm run audit:interaction`, `npm run perf:report` — are separate and use
Playwright rather than the MCP server. They need `node_modules` in that
worktree; the Chromium binary itself lives once in
`~/Library/Caches/ms-playwright` and is shared by all five.

## The commands

| Command | What it does |
| --- | --- |
| `npm run sync:start` | Stay on this AI's branch, fast-forward it, reconcile it with `main`, and report. It never switches you to `main` and never creates another branch. |
| `npm run main:update` | Publish: merge this AI's branch into `main`, push (**Production deploys**), then return to the AI branch and level it with the new `main`. The branch is not deleted. |
| `npm run workspace:status` | Print the five mappings, which worktrees exist, the current branch and identity, dirty state, and ahead/behind `main`. |
| `npm run workspace:add -- codex` | Create that AI's worktree on demand. |

Nothing here is destructive. None of these commands runs `reset --hard`, a
force push, `stash`, `clean`, a rebase or a destructive checkout. **A dirty
working tree is preserved and reported, never moved.** If a branch cannot
fast-forward, or a merge conflicts, the command says so and stops rather than
guessing — publishing aborts the merge and puts you back on your own branch.

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

Only the ones an edit is most likely to break. The full list — layering,
module shape, wired infrastructure and the test harness — lives in
[`.claude/skills/project-invariants/SKILL.md`](.claude/skills/project-invariants/SKILL.md),
which is a plain Markdown file any agent can read.

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

# Verification and CI policy

**Do not run `verify:full` after every edit.** Verification is proportional to
the change: read the diff, run the smallest check that actually covers it, and
escalate when the change reaches something shared. Before 2026-09-08 every
commit — a Markdown edit included — ran typecheck, lint, all 166 test files and
**two** production builds; that is what this policy replaces.

`npm run verify:changed` is the default. It classifies the diff with
`scripts/verify-changed.ts` and runs exactly the steps that diff needs. **CI
runs the same classifier**, so a local pass and a green pipeline cannot
disagree about whether a change was risky.

## What runs for what

| The diff touches | Checks | Notes |
| --- | --- | --- |
| Only `*.md`, `docs/`, `.ai/`, `.claude/`, `.codex/`, `.agents/` | none | No build. None of it reaches the bundle. |
| A component, page, style or `lib/` module — edited, not added or moved | typecheck · lint · **`vitest related`** · build | `related` walks the module graph and runs only the tests that import the change (measured: 198 ms against 176 s). |
| `content-packages/**`, `public/**` | full suite · build | Static generation reads these; an edit can break a build every other check passes. |
| Anything under `server/` other than the high-risk paths below | full suite · typecheck · lint · build | A service is reached through boundaries the module graph does not show. |
| `server/db/**`, `server/core/**`, `server/contracts/**`, `server/http/**`, anything matching `auth`, `package*.json`, `next.config.ts`, `vercel.json`, `vitest.config.ts`, `eslint.config.mjs`, `tsconfig*.json`, `drizzle.config.ts`, `.github/**`, `tests/fixtures/**`, `middleware.ts`, `instrumentation.ts` | **everything** | High risk. Never narrowed. |
| A path the classifier cannot place | **everything** | Unknown escalates. Over-verifying costs minutes; under-verifying costs a deploy. |
| A file added, renamed or deleted | full suite, never `related` | A new import edge may have no test covering it. |

## Commands

| Command | Use it for |
| --- | --- |
| `npm run verify:changed` | The default after an edit. Classifies and runs only what the diff needs. |
| `npx vitest related --run <files…>` | The tests that import specific files. Fast, and what `verify:changed` picks for isolated presentational edits. |
| `npx vitest run tests/<file>.test.ts` | One suite. Add `-t "name"` for one test. |
| `npm test` | The whole suite locally, serial-ish at `maxWorkers: 2`. |
| `npm run test:shard -- 1/4` | Reproduce a specific CI shard failure. |
| `npm run typecheck` / `npm run lint` | On their own when only one is in question. |
| `npm run build` | Production-build validation. Needed when the change reaches the bundle — **not** needed to see a change locally. |
| `npm run verify:full` | The whole gate. **Required** for schema, security, dependency, build-config and CI changes, before a release, and whenever you are unsure. |

## Rules

- Inspect the diff before choosing checks; do not choose from habit.
- Documentation-only changes never need a build.
- An isolated frontend change does not need the database suites.
- Run targeted tests first, broader ones when shared code is touched.
- Production- or deployment-affecting changes need a real production build.
- Do not build twice. If a valid build artifact exists, reuse it.
- Prefer independent checks in parallel over one serial chain.
- **Never skip a failing relevant test, and never weaken a test, to save time.**
- When unsure whether a change crosses a high-risk boundary, escalate.

## Local development is not a build

`npm run dev` and hot reload are how frontend work is seen. A production build
is a verification and deployment concern; it is not a prerequisite for looking
at a change.

## How CI is arranged

`.github/workflows/ci.yml`: a `classify` job publishes the change classes, and
`typecheck`, `lint`, `test` (four `--shard` matrix runners) or `test-related`,
`build` and `archive-assets` run in parallel behind it. `smoke` consumes the
**build artifact** rather than building again. `.next/cache` and the Playwright
browser are cached. Superseded PR runs are cancelled; `main` runs are not.

Two aggregator jobs keep the required status-check names branch protection
knows — `typecheck, lint, test, build` and
`route smoke test (headless Chromium)` — and pass when their dependencies
passed *or were skipped*. **Renaming them breaks branch protection**; see
`docs/operations.md`.

## `vercel.json` takes no comments

The published schema sets `additionalProperties: false`. A `"//note": "..."`
key — harmless in `package.json` — fails the deploy at schema validation,
**before the build starts**, so there are no build logs to read: only
`should NOT have additional property`. That cost a production deploy on
2026-09-08. Put the explanation in this file or `docs/operations.md`;
`tests/briefing-runtime.test.ts` now fails on any key outside the known-valid
set.

## There are no crons

`vercel.json` carries no `crons` array (owner ruling, 2026-09-08). Nothing
collects, drains the outbox, embeds or reconciles alerts on its own. The routes
under `app/api/internal/cron/` still exist and still work — run them from the
admin console (`POST /api/v1/admin/console/{sources/collect-sweep,
outbox/drain, maintenance/tick}`) or from the **Operations tick** workflow in
GitHub Actions. Do not restore a schedule without an owner instruction.

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
