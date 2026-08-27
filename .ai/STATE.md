# State

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

Six items were deliberately declined and are listed in
`PROJECT_STRUCTURE_AUDIT.md` so they are not rediscovered: `requireCapability()`
staying inert, the missing `REVOKE` on two `SECURITY DEFINER` functions, the
snapshot chain stopping at `0017`, `leva` in `dependencies`, the dead
`viewport.ts`, and two modules folding `repo()` into their service.

## CI is red on main, and was before this branch

Five consecutive runs including `f8f84ce` fail at `npm ci` with an
out-of-sync lockfile. It reproduces only under CI's Node 22 — `npm ci` passes
locally on both `main` and this branch under Node 25 / npm 11 — and `fast-uri`
is missing from `main`'s lock too, so it predates this work. This branch's
lockfile change is 352 deletions and no additions.

Fixing it will unblock the smoke job, which will then likely fail on archive
media: `NEXT_PUBLIC_ARCHIVE_CDN` is unset in the workflow, so images fall back
to `/archive/…`. The store is public; setting it needs no secret.

## Next

Land the audit branch, then decide the five items above. Continue watching Neon
CU-hours, AI spend, Function errors, Queue age and Blob growth. Do not promote a
Production deployment unless its Preview smoke test is green.
