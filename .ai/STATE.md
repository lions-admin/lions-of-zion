# State

## Latest — 2026-08-27, shared agent loop implemented

The repository now has one tool-agnostic five-stage workflow rooted at
`AGENTS.md` and `.ai/WORKFLOW.md`. `verify:changed` selects checks from the
working-tree diff and requires explicit real-Chrome evidence for visual work;
`verify:full` is the single local and CI handoff gate. Tool-specific Claude
hooks remain accelerators rather than a second source of process truth.

Every task now uses a mandatory manager-worker model. The receiving agent owns
decomposition, delegates at least one bounded subtask, prevents overlapping
edits, inspects worker evidence, integrates, and performs final verification.
Small tasks may use a read-only review worker; unavailable subagent support
requires an explicit user waiver before implementation.

Every task now starts with `npm run sync:start`: clean tree, fetch origin,
switch to main, fast-forward main, and remove branches already merged there.
It stops if a remote branch remains open, so a merge or deletion decision is
made before new work begins. A completed serious round uses `npm run main:update`
to merge, verify, push, and remove its completed branch. Open branches are never
merged automatically.

The workflow is merged and pushed to `main`. Startup cleanup removed branches
already merged into main; `claude/test-server-setup-391c0b` remains open on the
remote, so the next task stops for a merge or deletion decision before work
begins. The verification result for the implementation belongs in the handoff
for this task rather than as a durable state claim.

## Latest — 2026-08-27, structure audit; the design-audit wave is closed

`main` is at `f8f84ce` (merged PR #16). The branch
`docs/architecture-audit-and-design-sync` that the previous entry described as
in flight was pushed, merged and deleted; every item it listed is done.

Two waves landed since: the design audit closed **83 of 83** with zero open
items (`69fd027`), and the reading routes were converted to scroll the document
rather than themselves (`423b9f5`) — which is why a phone's URL bar now
collapses and back-navigation restores position without `sessionStorage`.

The work in progress is a full structure audit on
`codex/project-structure-audit`: every project-owned file classified with
evidence, the closed audit archived, the documentation reconciled against the
code, and an interactive project map. `PROJECT_STRUCTURE_AUDIT.md` carries the
per-path table; `docs/PROJECT_MAP.md` carries the shape.

**Read [`docs/vercel-infrastructure.md`](../docs/vercel-infrastructure.md)**
for the deployed topology, environment names, cost guardrails and runbook. The
canonical production site is `https://lionsofzion.io`. Git pushes do not deploy;
production remains a deliberate Vercel CLI action. **The repository is public,
so a push is itself an act of publication.**

## Decided and applied 2026-08-27

The publication gate is real now: `EDITORIAL_STAGE` withdraws every Fake
Resistance case when set to `held`, index and sitemap included, and two tests
pin it. `/admin` and `/auth` are disallowed in `robots.ts`. The
no-JavaScript invariant finally has a guard that runs on Linux — a
`javaScriptEnabled: false` check in `ci-smoke.mjs` plus a fast tripwire test.
`vercel-infrastructure-costs.html` is gitignored.

The two security items are closed too, in opposite directions.
`requireCapability()` stays uncalled — one account holds every capability, so a
check could only pass while adding a lockout path, and that is now a recorded
decision with a test pinning it. The two `SECURITY DEFINER` prune functions are
closed by migration `0022`, granted to `app_service` alone after verifying the
maintenance cron is their only caller.

`publications` and `reports` had their repositories extracted into sibling
`repo.ts` files, so all ten data modules now match the shape `CLAUDE.md`
documents. Nothing from the audit is left open.

## CI is green on main — the red entry this replaced is closed

The lockfile failure is fixed. `dd3a7bf` diagnosed it as a version skew rather
than a missing package — the lock was written by npm 11, while CI's Node 22
ships npm 10 — regenerated it under npm 10, and verified `npm ci` exits 0 under
both. `fast-uri` now has a real entry in `package-lock.json`, not just a
dependency reference.

The prediction in the entry this replaces came true and was also handled: with
`npm ci` unblocked, the smoke job failed on archive media exactly as expected.
`7effa0c` set `NEXT_PUBLIC_ARCHIVE_CDN`, and `d244fb3` scoped it to the smoke
job alone so `tests/archive-content.test.ts` keeps asserting the fallback
instead of inheriting the live value.

Verified 2026-08-27 with `gh run list`: the most recent `CI` runs on `main`
conclude `success`. `npm test` passes locally at **418 passed, 1 skipped, 32/32
files**. One caveat for the workstation, not for CI — the suite starts a PGlite
instance per test file, and at default parallelism alongside another heavy
process it will be OOM-killed (exit 137); `--maxWorkers=2` is reliable.

## Next

The audit branch landed (PR #18, merged as `75e782b`) and nothing from it is
left open. `TODOS.md` was rewritten on 2026-08-27 against live code and is now
the list of what remains: **93 open items**, with its 610 lines of wave
narrative moved to `docs/archive/TODOS-waves-2026-08.md`. It is now split by
what is needed to close an item rather than by topic: **§א׳-1 code-only (70),
§א׳-2 provider integration (14), §א׳-3 decision or human process (4)** — so the
code track and the vendor track can run in parallel without blocking each other.

Start at §א׳-1.1: `PublishedItemView` has no field mapping an item to a
destination page, which is what keeps every `lib/content/` module on a local
static module. The most urgent item on the vendor side is §א׳-2.2 — confirm
migration `0022` is applied to the Production branch, because until it is, the
repo looks like the `SECURITY DEFINER` exposure is closed while it may not be.

Continue watching Neon CU-hours, AI spend, Function errors, Queue age and Blob
growth — the seven-day window from the 2026-08-26 deployment has not elapsed.
Do not promote a Production deployment unless its Preview smoke test is green.
