# State

## 2026-09-06 — The editorial DNA is written down; the two top-level briefs now agree with it

The owner issued a binding definition of what this site and this system are.
It is now `docs/editorial-dna.md`: purpose and the anti-revenge framing, the
reader's journey, the five destinations and what each owns, the editorial jobs
of a run in priority order, routing (with the destination table read from
`lib/publication-routing.ts`), the image rules against `externalMediaSchema`
and `editorial-media.ts`, homepage composition against the three areas × two
positions in `whole-site-update.ts`, the veto and the auto-fix boundary, reader
activation, reporting and delivery, the launch-period posture, an explicit gap
list, and the canonical operator run prompt as an appendix so the repository
owns it rather than a chat window.

`CLAUDE.md` and `AGENTS.md` were rewritten to agree with it and point at it.
The section titled "The daily briefing, and the one article that may cite
nothing" is now "The whole-site editorial update, …" and carries the five
destinations; the still-true invariants were kept verbatim in substance
(`evidenceBasis` derived not chosen, `narrativeWatchTitle()` the only prefixer,
read `=== "analysis"`, no quality check skipped on the path that has checks).
`.ai/DECISIONS.md` carries the ruling itself at the top.

Two stale claims were corrected while writing: `CLAUDE.md` said the section
contract "has three values" (`PUBLICATION_SECTIONS` has fourteen) and that
`server/modules/` "holds fourteen" modules (nineteen — it was missing
`admin-console`, `editorial-update`, `homepage`, `media` and `ops-agent`,
which is most of the whole-site path). Neither now states a number that has to
be maintained.

**Open, from the DNA's own gap list** (`docs/editorial-dna.md` §12, all
verified against the code): the report recipient is `EDITORIAL_REPORT_EMAIL`
and has to actually be set on the Vercel project or reports go to `ADMIN_EMAIL`;
"what was researched" and a *deliberate* veto are not representable in
`whole-site-update-v1`, so an editorial refusal reads like a technical failure;
October 7 rotates per edition rather than every few minutes; the homepage
edition still has no cron of its own (owner decision, not an oversight);
nothing requires a hero image; image enhancement and illustration generation
both live entirely outside the pipeline; there is no worked
`whole-site-update-v1` example package; and
`lib/content/fake-resistance-watch.ts` still claims a "17-check automated
quality gate" that the whole-site path does not run — left for the agent that
owns that file.

Five items that were on that list this morning closed during the same session,
in files owned by other agents: the run report is emitted and emailed again,
the report gained its per-category, homepage-change, veto and failure-detail
sections, `news` records reach the News & Analysis hub, and
`influence_investigation` gained a reading feed. `docs/whole-site-updates.md`
was written alongside as the mechanism document.

Documentation only — no code, no schema, no deploy.

## 2026-09-06 — Homepage mobile refinement on `main`, corrected the same day after the owner's live-phone review

The owner read the first deploy on an iPhone: headlines and type too small
in several places, a preview cut at "threw…" with its source line beneath,
and the October 7 paper page-turn reading as unrelated to the page. The
same-day correction: phone type floors (16/15/13/11px), previews that end on
sentences (`lib/preview-sentences.ts`, `PreviewText`), the archive on the
page's ground, the Fake Resistance dossier without its box on a phone, a
longer launcher retract for iOS Safari, and a three-line source clamp. The
why is the newer 2026-09-06 entry in `.ai/DECISIONS.md`; the evidence was
re-captured after the correction.

The owner's mobile brief (density, primary/secondary records, Ask occlusion,
cover action hierarchy, edition index, destination naming, image
disclosures, headline sizing, card chrome, section rhythm) is implemented
and browser-verified in Chromium emulation at 320, 375, 390×844, 430×932,
768 and 1440. Evidence, numbers and remaining limitations are in
`docs/reviews/homepage-mobile-refinement/REPORT.md`; the design record is the
earlier mobile implementation (superseded by the owner's current homepage brief); the why of the former launcher is in
`.ai/DECISIONS.md` (2026-09-06). Pushed to `main` on the owner's explicit
instruction the same day, which is a Production deploy through the Vercel
git integration; `vercel rollback` is the undo. The branch also carries the two `frontend-design*` project skills,
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
