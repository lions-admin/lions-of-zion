# State

## 2026-09-06 — Homepage mobile refinement implemented on `claude/create-worktree-9wtvyy`, not on `main`

The owner's mobile brief (density, primary/secondary records, Ask occlusion,
cover action hierarchy, edition index, destination naming, image
disclosures, headline sizing, card chrome, section rhythm) is implemented
and browser-verified in Chromium emulation at 320, 375, 390×844, 430×932,
768 and 1440. Evidence, numbers and remaining limitations are in
`docs/reviews/homepage-mobile-refinement/REPORT.md`; the design record is the
"Homepage on a phone" section of `DESIGN.md`; the why of the launcher is in
`.ai/DECISIONS.md` (2026-09-06). Nothing was pushed to `main` and nothing
deployed. The branch also carries the two `frontend-design*` project skills,
a regenerated `package-lock.json` (the committed one no longer satisfied
`npm ci`), and a Prettier-only formatting commit for `components/home/`.

Not verified here: a physical iPhone or Safari, and the live Neon data — the
three publication-backed records were rendered from the development-only
transcription in `content-packages/homepage/local-records.json`.

## Latest — 2026-08-27, owner authority

There is one developer and project owner: the current user. Direct owner
instructions override repository workflow, approval, delegation, editorial,
and research-framing rules. Agent hooks are disabled; checks and project notes
are optional tools and cannot block work. `sync:start` reports open branches
without stopping the task.


## 2026-09-04 — Production-console verification PENDING: three bindings and the queue topic

Three production bindings cannot be verified from code — the **Vercel Queue
resource binding**, the **AI Gateway OIDC binding**, and the **Google
Workload Identity Federation binding**. The docs
(`docs/vercel-infrastructure.md`) describe them as provisioned, but the Vercel
console itself has not been checked from this pass. Status: **PENDING
production-console verification.** Do not treat them as confirmed, and do not
treat them as broken — the positive git evidence is that commit `c1e579b`
(2026-09-03) records a full end-to-end Production run of the briefing pipeline
the same day it removed the briefing cron schedule: a real edition composed
and published, visible on `/geopolitical-brief`, with an identical resend
returning status `duplicate` and no new row, all confirmed via the public API.

The same pass found `vercel.json:49-53` still declaring a `briefing-quality`
queue trigger whose route file no longer exists (retired by migration `0049`);
see `.ai/DECISIONS.md` 2026-09-04. Per instruction, `vercel.json` was not
touched — the Production console check is pending there too.


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
maintenance cron is their only caller. Production also carries migration
`0023`, which grants `app_service` the internal `SELECT` visibility required
by the embedding ledger's `INSERT ... RETURNING` path; the scheduled embed
cron succeeded after that fix.

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
static module. The vendor-side Production migration check is now closed:
`0021`, `0022`, and `0023` are applied on the Production branch.

Continue watching Neon CU-hours, AI spend, Function errors, Queue age and Blob
growth — the seven-day window from the 2026-08-26 deployment has not elapsed.
Do not promote a Production deployment unless its Preview smoke test is green.
