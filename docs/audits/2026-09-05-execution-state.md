# Execution state — where this stopped and what is blocking

**Written:** 2026-09-05, end of session · **Local HEAD:** `3a79efa` ·
**Nothing is committed. Nothing is pushed.**

> ✅ **Follow-through (2026-09-05, later session).** That is no longer true.
> The P0 fixes below were committed to `worktree-workbench` and pushed, as
> five commits starting from `3a79efa`: `2108aab` (P0-6), `0214b0e` (P0-3),
> `7938109` (P0-4), `a6dbc46` (P0-1 docs), and this document pair with the
> blueprint (P0 deliverables). Read the rest as the snapshot it was written
> to be.

> ⚠️ **`main` moved twice more while this document was being written.**
> `origin/main` is now `846e60f`, two commits ahead of the baseline everything
> below was verified against:
>
> | commit | CI |
> | --- | --- |
> | `43df2bd` "fix(auth): the X sign-in button was cancelled by form-action, silently" | **failure** |
> | `846e60f` "fix(csp,ui): unblock Google's own stylesheet; settle button case one way" | in progress |
>
> That makes **seven** consecutive red commits on a branch that auto-deploys to
> Production. Re-run the five test files against the new HEAD before applying
> anything here: the nine failures in §3 were diagnosed at `3a79efa`, and
> `846e60f` touches CSS and button casing, which is the same surface as F1.
> The patches are `diff -u` against `3a79efa` files and may need rebasing.

This is the handoff for the work that followed
[`2026-09-05-repository-modernization-blueprint.md`](2026-09-05-repository-modernization-blueprint.md).
Read that document for *why*; read this one for *where things are* and *what is
waiting on the owner*.

---

## 1. State of the tree

The worktree `.claude/worktrees/workbench` is on branch `worktree-workbench`,
reset onto `origin/main` (`3a79efa`). It carries uncommitted work in three
groups:

| Group | Files | Status |
| --- | --- | --- |
| **P0 fixes (applied, verified)** | 11 modified | Ready for review — see §2 |
| **Backup stubs untracked** | 9 deleted from the index, still on disk | Part of P0-4 |
| **Audit deliverables** | `docs/audits/` (2 files, untracked) | The blueprint and this document |

```
 M .gitignore                              M docs/architecture.md
 M .vercelignore                           M docs/data-model.md
 M AGENTS.md                               M lib/content/fake-resistance-cases.ts
 M CLAUDE.md                               M scripts/backup-briefing-database.sh
 M tsconfig.json                           M tests/briefing-quality.test.ts
                                           M tests/fake-resistance-research.test.ts
 D  backups/briefing/*.dump  (9, untracked from the index; files remain on disk)
 ?? docs/audits/
```

**`main` is red and has been for six consecutive commits, all deployed to
Production.** Nothing in this working tree changes that yet — the CI fixes are
prepared but deliberately **not applied** (§3).

---

## 2. What was done — four P0 fixes, applied and verified

All four are from the blueprint's P0 list. The owner reviewed and approved them
after the fact ("ארבעת התיקונים מאושרים מבחינתי").

### P0-6 — `getCase()` no longer swallows errors
`lib/content/fake-resistance-cases.ts` · `tests/fake-resistance-research.test.ts`

A bare `catch { return null }` became `ENOENT`-only, matching the sibling loader
in `archive.ts:202` that always did this correctly. `allCases()` in the test now
asserts non-null instead of filtering nulls out. **Before:** a corrupted
`cases/*.json` became a silent 404 at build time with `verify:full` green, and
three of the seven published cases were named in no assertion. **After:** it
fails loudly. *Verified: 36/36 pass.*

### P0-3 — the `midjrny` / `midjourny` typo
`.gitignore` · `.vercelignore` · `tsconfig.json`

Both spellings are now listed in all three files, plus root-anchored catch-alls
for loose media and UUID-named screen captures. Verified with
`git check-ignore --no-index`:

| path | before | after |
| --- | --- | --- |
| `midjourny/x.png` | **not ignored** | `.gitignore:85` |
| `lion_mobile_4k_20s.mp4` (167 MiB) | **not ignored** | `.gitignore:89` |
| `3c2a0404-….png` | **not ignored** | `.gitignore:92` |
| `public/video/*.mp4` (tracked) | — | **still not matched** ✓ |

### P0-4 — the backup script and the nine stubs
`scripts/backup-briefing-database.sh` · 9 files untracked

Default output moved from `$PWD/backups/briefing` to
`~/.lions-of-zion/backups/briefing`; `BRIEFING_BACKUP_DIR` honoured. The nine
zero-byte dumps were untracked with `git rm --cached` (all nine shared git's
canonical empty blob `e69de29b…`, so nothing was lost), which finally lets the
`/backups/` rule at `.gitignore:75` apply — it had been permanently inert since
the files were tracked before the rule existed.

> **A flaw in the first version of this fix, found by testing it:** `set -e`
> aborted the script on `pg_dump` *before* the new empty-file guard could run,
> leaving the stub behind — the original bug exactly. The `pg_dump` call is now
> inside `if ! …` so both failure modes are caught. Three scenarios tested with
> a stubbed `pg_dump`: non-zero exit, zero exit with an empty file, and the
> success path. Zero stubs left in the first two; dump + manifest + checksum in
> the third.

### P0-1 — the publish gate described truthfully
`CLAUDE.md` · `AGENTS.md` · `docs/architecture.md` · `docs/data-model.md` ·
`tests/briefing-quality.test.ts`

Every place that claimed "two enforcement layers" or "eighteen checks" now
states what is actually true: migration `0049` removed the count from the SQL
trigger, `595ca9d` removed it from `publications/repo.ts`, the deterministic
suite runs on the external-publish path only, and **the internal pipeline
publishes with no quality gate at all.** Hard-coded counts were replaced with
pointers to the source. The stale 20-line comment in `briefing-quality.test.ts`
is now marked HISTORICAL with the reason its assertions are kept.

### Verification of the four

`npm run typecheck` **clean** · `npm run lint` **0 errors** (4 pre-existing
warnings, none in touched files) · **76/76** tests pass across the four affected
files (`fake-resistance-research`, `briefing-quality`, `influence-graph`,
`automatic-publication-gate`).

---

## 3. CI diagnosis — complete, fixes prepared but NOT applied

Nine failing assertions in five test files. Reproduced locally, byte-identical
to CI. **Only the `test` stage is broken** — `typecheck` and `lint` are clean,
and `build` never runs because `&&` short-circuits.

**Ownership:** the last green run was `5c6f734`; the next push carried **19
commits at once**. Two of them own everything currently red — `00240da`
("Refine editorial navigation and information war pages") with 8, and `40806d3`
("Rebuild admin operations workspace") with 1. The four commits after them
changed nothing either way.

| # | Test | Classification | Cause |
| --- | --- | --- | --- |
| F1 | `css-module-contract:96` | 🔴 **real regression** | 9 `styles.*` references with no CSS rule. 4 of the 9 are inside `InformationWarBeams.tsx`, whose only import `00240da` deleted — **dead file** |
| F2 | `motion-runtime:523` | 🔴 **real regression** | `information-war-system.module.css:81` — `animation: travel 3s linear infinite`, below the documented 5-second ambient floor (A11Y-010) |
| F3–F6 | `fake-resistance-watch:113,124,137,144` | 🟡 stale test ×4 | Copy deliberately rewritten; the behavioural contract is intact. `:144` is an *improvement* the test predates — `watchCount` became `number \| null` instead of a fabricated `0` |
| F7 | `no-js-invariant:293` | 🟡 stale test | Route identity renamed "The Daily Brief" → "News & Analysis" |
| F8 | `state-causes:353` | 🟡 stale test | `40806d3` split 401/403 into `AuthRequired` / `PermissionDenied`; every consumer handles both. The test pins an implementation string, not behaviour |
| F9 | `state-causes:421` | 🟡 stale test | The narrative-watch section was removed from the Daily Brief hub and replaced with a pointer to `/fake-resistance` |

⚠️ **F7, F8 and F9 each hide a second assertion** (`:297`, `:359`, `:427`) that
only fails once the first is fixed — the run stops at the first `expect`. They
must be fixed in pairs.

**No environment issue and no build issue was found.**

### Prepared patches

`~/.claude/jobs/21880dd4/tmp/` — `ci-fix-all.patch` plus five individual files.
`git apply --check` **passes** against the current tree, on top of the P0 work.
The 7 patch targets and the 11 P0 files are **disjoint sets** — no conflict.

Applying also requires `git rm components/briefs/InformationWarBeams.tsx`.

**Confidence the patches turn `main` green: ~85%.** The residual is entirely the
`build` stage, which **has not executed in CI since `5c6f734`** — seven
Production pushes with that stage never run. Vercel built them (the site is up),
but green-after-fixes is unproven until `npm run build` runs once.

---

## 4. Revalidation against current HEAD — three changes since the audit

`main` moved twice during the audit (`40806d3` → `8623e6c` → `3a79efa`). The
blueprint is a snapshot at `40806d3`. Re-checked:

**✅ `components/typographic-field/` is still dead.** The commit named
"typographic introduction" built a different component entirely
(`components/home/EditorialIntro.tsx`, a native `<dialog>`). Zero importers. The
blueprint's finding stands.

**🆕 A new orphan cluster the audit could not have seen.** `3a79efa` removed
particle-nav from `app/page.tsx`:

| Directory | Size | Now reachable only from |
| --- | --- | --- |
| `components/particle-nav/` | 22 files, 2,749 lines | `/particle-demo` |
| `components/intro/` | 6 files, 2,072 lines | `particle-nav` only |

~4,800 lines, pinned by 7 test files, depending on a dev-bench route that
redirects to `/` in production and imports `leva` (a devDependency). **This was
not among the owner's nine decisions** because it did not exist when they were
made.

**⚠️ Owner decision 6 (`war_update`) is unsafe as written.** Reference map:

- ✅ Safe to delete: the `<option>` in `EditorialDesk.tsx:329`, the model
  instructions, the pipeline-visualizer copy, the documentation.
- 🔴 **Not safe:** `war_update` is a **live Postgres enum value** created in
  `0024` and never removed. Published articles under that section are still
  served at `/articles/[publicId]` with a breadcrumb to `/updates`, and still
  appear in `LiveBriefHub.tsx:95` and `publications/service.ts:509,531`.
  `STORED_ARTICLE_SECTIONS` (`service.ts:49`) exists *precisely* so historical
  artifacts still parse. Postgres cannot drop an enum value any row uses.

**✅ Owner decision 2 (composer) is clean, with one caveat.**
`publish-briefing-package.ts` — the surviving path — imports `submit.ts` and
`verify.ts` from the composer subtree. So: delete
`external-briefing-compose.ts` + `collect/draft/assemble/fixture/types.ts`
(~1,065 lines), **keep** `submit.ts` and `verify.ts`. The composer scripts have
zero test coverage; the three similarly-named test files exercise the server
ingest module, not the scripts.

---

## 5. Open questions — all four block the next step

Nothing further proceeds until these are answered.

### Q1 — The five orphaned `className` references (blocks CI fix F1)
Remove the references, or write the missing CSS rules?

`styles.evidenceLine`, `styles.narrativesLine` (`app/page.tsx:86,87`) ·
`styles.reportingMenu`, `styles.aboutMenu` (`SiteHeader.tsx:168,172`) ·
`styles.heroCopy` (`InformationWarSystem.tsx:15`)

Nothing in the diff suggests design intent — each element is already positioned
by its parent, and none of the five names has ever existed in its stylesheet.
But this is a decision about appearance, not code.

### Q2 — Hebrew error copy (informational, blocks nothing)
`40806d3` switched the admin console's error strings to Hebrew:
`"This session is not signed in."` → `"הכניסה פגה או שהחשבון אינו מחובר…"`, and
the same for `PermissionDenied` / `RouteUnavailable` / timeout. No test covers
language, so CI is silent. Intended?

### Q3 — `war_update` row count from Production (blocks owner decision 6)
```sql
SELECT section, count(*) FROM publication GROUP BY section;
```
Cannot be run from this machine — `.env.local` is Preview
(`DATABASE_RESOURCE_ENV="preview"`) and Production credentials are Vercel
sensitive vars. **If the count is > 0 for `war_update`, the archive half of the
decision must survive and only production of new ones is removed.**

### Q4 — particle-nav + intro (new, not covered by the nine decisions)
Delete ~4,800 lines together with `/particle-demo` and `leva`, or keep the
tuning bench? Deleting also resolves blueprint findings A5-04 and A7-08.

---

## 6. Owner decisions on record

Given this session, for the blueprint's open items. Recorded here because they
are not yet written into `.ai/DECISIONS.md`.

| # | Decision |
| --- | --- |
| 1 | **Internal briefing pipeline** — retire and delete entirely. No quality gate needed; a new system will replace it |
| 2 | **Legacy composer** (`npm run briefing:compose`) — delete after verifying every caller, script, package command, doc and test |
| 3 | **Ask citations** — the capability **is** planned. Do **not** delete the sources/citations infrastructure; mark for redesign if unsuitable |
| 4 | **`assets/brand/` + `assets/marketing/`** — move to external storage, verify the copy, *then* remove from the repo. Never delete the source outright |
| 5 | **Old plan/TODO docs** — delete rather than archive, after verifying against HEAD and git history that they are genuinely superseded |
| 6 | **`war_update`** — retire and delete, after a reference map ⚠️ *see Q3* |
| 7 | **LICENSE** — MIT |
| 8 | **Codex tree refs** — delete only if old **and** all work is in `main` **and** nothing unique is unmerged. If in doubt, keep |
| 9 | **Prettier** — add with a locked version; the initial format must be a commit entirely separate from code changes |

**GitHub settings:** the owner will enable secret scanning, push protection,
Dependabot alerts and Dependabot security updates. **No required status check
until CI is reliably green** — enabling it while `main` is red would lock the
owner out of their own branch.

---

## 7. Agreed order of work

| | | Status |
| --- | --- | --- |
| **A** | Finish CI diagnosis, root cause per failure | ✅ done — §3 |
| **B** | Present what must change for green, no convenience fixes | ✅ done — §3, awaiting Q1 |
| **C** | Revalidate the deletion decisions against current HEAD | ✅ done — §4 |
| **D** | Updated execution plan: P0 + briefing retirement | ⏸ **blocked on Q1–Q4** |
| **E** | Broad P1/P2/P3 | ⏸ not until CI is green and P0 is closed |

**Standing constraints:**
- No commit and no push until the owner approves the first change set.
- A push to `main` deploys to Production in ~2 minutes.
- Never make a failing test pass by deleting or weakening it. Every failure is
  classified as real regression / stale test / environment / build issue, and
  the cause and proposed fix are presented before the change.

---

## 8. Where everything is

| What | Path |
| --- | --- |
| The blueprint (2,510 lines, 153 findings) | `docs/audits/2026-09-05-repository-modernization-blueprint.md` |
| This document | `docs/audits/2026-09-05-execution-state.md` |
| CI diagnosis, full detail + per-run timeline | `~/.claude/jobs/21880dd4/tmp/ci-diagnosis.md` |
| CI patches (`git apply --check` passes) | `~/.claude/jobs/21880dd4/tmp/ci-fix-all.patch` + 5 individual |
| Raw CI logs, local vitest/typecheck/lint logs | `~/.claude/jobs/21880dd4/tmp/*.log` |
| The eight source audit reports + 20 MB of evidence | `~/Documents/lions-of-zion-audit-2026-09-05/` |

⚠️ `~/.claude/jobs/21880dd4/tmp/` is a job scratch directory and is **deleted
when the job is deleted.** The patches and the CI diagnosis are not yet copied
anywhere durable. Copy them out before ending the session if they matter.

---

## 9. To resume

1. Answer Q1–Q4 (§5).
2. Apply the CI patches, run the five test files, then `npm run verify:full`
   once — the `build` stage is the unproven 15%.
3. Review the 11-file P0 change set and decide the commit shape (the audit
   documents are untracked and probably belong in their own commit).
4. Then D: the execution plan for the briefing retirement, sequenced against
   decisions 1, 2 and 6.

---

## 10. Program state — 2026-09-05, end of session

Sections 1–9 above are a record of an earlier moment and are left as written.
This section is the current one; read it first.

### Completed and in Production (`main = c35c71f`)

| Batch | State |
| --- | --- |
| P0 hardening | integrated, deployed, verified |
| `war_update` retirement (migration `0053`) | integrated, deployed, verified |
| Particle / WebGPU retirement | integrated, deployed, verified |
| Root plan/TODO cleanup | integrated, deployed, verified |
| Batch A — security/governance closure | integrated, deployed, verified |

Verification of `c35c71f` in Production: Railway `zippy-joy / production`
deployment `6284756673` = `success`; Vercel Production `ljo26rosr` = `Ready`;
`https://lionsofzion.io/` = 200; unauthenticated
`POST /api/internal/briefing/external-publish` = **401**, which is the proof
that `requireExternalBriefingSecret` now runs *inside* `withDatabaseRole`.

### Stage 2 — security-surface tests: done, by two sessions at once

**Both sessions worked `R3-13`, `R3-06` and `R3-05` in parallel, unaware of each
other.** The concurrent session pushed first (`2ec7792`, eight commits). Its
work supersedes most of this session's, and the duplicates were discarded rather
than merged — a repository does not benefit from two suites proving the same
three things.

Landed on `main` by the concurrent session:

- `tests/public-v1-guard-matrix.test.ts` (528 lines) — `R3-13`.
- `tests/admin-auth-production-branch.test.ts` (299 lines) — `R3-06`, driven
  through `vi.stubEnv("VERCEL_ENV", …)`, including the development control that
  makes the production refusal mean something.
- `withTestDatabaseRole()` in `server/db/testing.ts` (138 lines) — `R3-05`.
  This is the **better** answer to R3-05: it establishes a real Postgres role
  and `app.identity` on PGlite and runs the console route tests inside it,
  including a nested-transaction patch so a `db().transaction()` in the route
  cannot commit the role away early. The alternative attempted here — recording
  what the pass-through stub was asked for and asserting the sequence — proves
  only that the wrapper was called, not that the work ran under the role. It was
  discarded.
- `export const PUBLIC_V1` in `server/http/handler.ts`.

Kept from this session, because it is not duplicated by any of the above:

- **`server/db/client.ts` — a real defect, fixed.** A connection whose
  `RESET ROLE` failed was released back into the pool still carrying its role
  and a stale `app.identity`; the next request to draw it inherited both,
  silently. It is now destroyed with `release(err)`. Neither session's test
  suite would have caught this; it surfaced while writing the one below.
- **`tests/database-role.test.ts`** — the production `withDatabaseRole` itself,
  against a fake pool with the real drizzle driver and the real generated SQL.
  This is the half `withTestDatabaseRole` explicitly cannot cover ("the literal
  wrapper cannot run here: it connects a Neon WebSocket pool"). Pins statement
  order with both statements on the wire before the handler is entered,
  `set_config(…, false)` and not `true`, the identity as a bound parameter,
  `db()` inside the callback being the roled connection, no bleed between calls,
  and reset-then-release on the returning path, the throwing path, and a refused
  `SET ROLE` — where the handler must also never run.

Also attempted and discarded: hoisting `SERVICE_PREFIXES` out of `accessFor()`
into an exported table. It is better code — the nested ternary is the shape that
let `/api/internal/briefing/` be forgotten — but with the duplicate test gone it
had no consumer, and it is a refactor of a security-critical file that nobody
asked for. **Deferred to Stage 3**, where boundaries are the subject.

Still only proven in Production: that `SET ROLE` on a pooled Neon connection
behaves as assumed. No test anywhere covers that, and none can.

### The lesson for the rest of the program

Two sessions picked the same three findings off the same re-baseline and spent
the same hour on them. Fetching `origin/main` *before* starting a stage is not
enough — the overlap appeared during the work, not before it. Either the stages
are divided between the sessions in advance, or each stage is announced on
`main` before it begins.

### To resume

1. **Stage 3** — boundaries, migrations, canonical constants. Begin with
   `R1-05`: a raw NUL byte at `server/modules/admin-console/service.ts:1168`
   makes plain `grep` return silence for that whole 81 KB file, so every
   grep-driven step in Stages 3–5 is unreliable until it lands. `R2-01` (the
   ESLint blocks that replace two documented boundaries wholesale) and the
   deferred `SERVICE_PREFIXES` hoist belong in the same batch.
2. Stages 4–14 as written in the approved plan.

⚠️ The estimate for the remainder is **6–9 hours** of wall clock, of which
roughly two hours is mechanical: ~12 × `verify:full` at ~5 minutes and ~12
dual-target deploy waits at ~4 minutes.
