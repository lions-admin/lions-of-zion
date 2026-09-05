# Engineering Repository Modernization Blueprint

**Repository:** `lions-of-zion` · **Commit audited:** `40806d3` ("Rebuild admin
operations workspace") · **Date:** 2026-09-05 ·
**Mode:** read-only audit. No file in the repository was created, edited, moved
or deleted to produce it, other than this document.

> **Snapshot boundary.** `40806d3` was `origin/main` when the audit started. It
> is not any more: `8623e6c` ("feat(auth): connect Google and X sign-in to the
> public interface") landed on `main` at 09:16 UTC while this audit was running,
> and its CI run was still in progress at the time of writing. **Nothing in this
> document covers `8623e6c`.** Given finding A7-16 below — that `main` has been
> red for five consecutive commits and every one of them deployed to
> Production — the state of that run is worth checking before anything else here
> is acted on.

**Method.** Eight auditors worked in parallel over separate surfaces, each
required to prove findings with commands rather than assert them, and each
required to list what it could not verify. Their eight reports were then
cross-checked against each other and the highest-consequence findings
re-verified directly against the tree before entering this document. Where two
auditors disagreed, the disagreement is recorded and resolved in the open
(§C.0). Nothing here rests on a single auditor's word where a second surface
could confirm it.

| Auditor | Surface | Findings | Report |
| --- | --- | ---: | --- |
| 1 | Documentation truth, root hygiene, agent-instruction layer | 21 | `01-docs-truth-and-root.md` |
| 2 | Reference graph, orphans, duplication, naming | 17 | `02-orphans-and-duplication.md` |
| 3 | Binary assets, backups, ignore-file truth, repo size | 13 | `03-assets-backups-hygiene.md` |
| 4 | `server/**` architecture, layering, invariants | 18 | `04-server-architecture.md` |
| 5 | Frontend structure (`app/**`, `components/**`) | 17 | `05-frontend-structure.md` |
| 6 | Test architecture and `scripts/**` | 21 | `06-tests-and-scripts.md` |
| 7 | Dependencies, configuration, CI/CD, governance | 26 | `07-deps-config-cicd.md` |
| 8 | `content-packages/**` as a data system | 20 | `08-content-packages.md` |

**What this document is for.** It is not a cleanup list. It is the input to a
later implementation phase, and its job is to make that phase safe: to say
which files are genuinely dead and which merely look dead, which documents can
be trusted and which are actively lying, and in what order the fixes must land
so that one does not strand another. Every recommendation carries the evidence
that justifies it and the risk of acting on it.

**The one-sentence summary.** This is a well-engineered system whose map has
come loose from its territory: the layering is real and lint-enforced, the
migration discipline is genuine, the CSS token system is unusually good — and
the documents that describe all of it, including the two loaded into every
agent session, describe a repository that stopped existing several commits ago.

---
## A. Executive Assessment

### A.1 The 15-30 minute test

The brief sets a specific standard: **can a senior engineer clone this
repository today and, in roughly 15-30 minutes, understand what the system does,
how to run it, how it is structured, where business logic lives, how migrations
work, how tests work, how deployment works, what is dangerous, and what is
authoritative?**

Answered honestly, question by question:

| Question | Verdict | What decides it |
| --- | --- | --- |
| What does the system do? | ✅ **Yes** | `README.md` opens well. The three briefing jobs and the information-model are stated clearly in `CLAUDE.md`. |
| How do I run it? | ✅ **Yes** | `npm ci && npm run sync:start && npm run dev` — "no config needed" is accurate; `npm run dev` and `npm test` genuinely need nothing. |
| How is it structured? | ✅ **Yes, unusually well** | `eslint.config.mjs` states the architecture as lint errors and 624 files pass. A reader can predict the contents of `server/modules/<name>/` in 13 of 16 cases. |
| Where does business logic live? | ⚠️ **Partly** | The module shape is clear, but "business rules live in SQL triggers as often as in TypeScript" means the real answer is split across `server/db/migrations/**` — 53 files, 27 of them hand-written — and no document maps rule → migration. |
| Where is the database layer? | ✅ **Yes** | `server/db/`, one driver, one documented reason for it. |
| How do migrations work? | ❌ **No** | The documented mechanism is **wrong**: `AGENTS.md` says both `db:migrate` and the test harness apply in filename order. `db:migrate` follows `meta/_journal.json`; only the harness sorts filenames. A hand-written migration without a journal entry is applied in tests and skipped in Production (A4-09). |
| How do tests work? | ✅ **Yes** | PGlite, migrated per test, `maxWorkers: 2` with the reason stated. Genuinely well documented. |
| How does deployment work? | ⚠️ **Yes, on the fourth try** | Four documents get it right; `.ai/DECISIONS.md:685` — billed as the ADR log — says the opposite, unmarked (A1-14), and `AGENTS.md:71-73` discredits the correct README. |
| What operations are dangerous? | ❌ **No** | The most dangerous thing in the repository — that the internal briefing pipeline can now publish with no quality check — is not merely undocumented, it is documented as the reverse (A1-01/A4-01). The backup script defaulting inside the repository (A3-03) is undocumented. The `midjrny` typo (A3-01) is invisible. |
| What is the Source of Truth? | ❌ **No** | Four documents claim authority with no ordering. Five plan documents claim the same surface, one forbidding the existence of the other four (A1-16). |
| Which documents are authoritative? | ❌ **No** | The three files loaded automatically into every session hold 11 of the 13 false statements found (§F). A reader cannot tell which paragraph is current without checking each against the code. |
| Where do assets and data live? | ⚠️ **Partly** | `content-packages/` and `public/` are discoverable. `assets/` — 24% of the repository — has no manifest, no consumer, and two documents that justify it are themselves archival candidates (A3-06). |
| Which subsystems are production-critical? | ⚠️ **Partly** | `PUBLIC_V1`'s nine entries are exact and verifiable. But `docs/api.md` — the file designated authoritative — covers 56 of 104 routes and mis-states fourteen guard rows in both directions (A1-05/06/07). |

**Score: 5 clear passes, 4 partial, 4 failures.** The failures cluster in one
place, and it is not the code.

### A.2 What actually blocks the 15-30 minute test

Four things, in order of how much time they cost the hypothetical engineer:

1. **The auto-loaded files are the least accurate in the repository.** This is
   the inversion at the centre of this audit. `CLAUDE.md`, `AGENTS.md` and
   `.ai/STATE.md` load into every session without being asked for, and they
   carry a deleted publish gate, a module count two short, a check count off by
   one, a deploy rule whose cron and whose gate both no longer exist, and a
   `.env.example` claim false since 2026-09-01. `docs/**` — which nobody loads
   automatically — is the most accurate documentation here.

2. **Nine of seventeen hard-coded numbers are wrong**, and every one is
   hand-maintained prose with no mechanism keeping it true. The engineer cannot
   trust a count anywhere, which means they must verify everything, which is the
   opposite of what documentation is for.

3. **There is no `docs/plans/` and no archive**, so 587 KB of finished and
   half-finished plans sit at the repository root reading as current, in four
   naming conventions, with `UI-UX-REBUILD-TODOS.md` declaring itself the single
   source of truth while four documents created after it claim the same surface.

4. **`verify:full` cannot see the repository's dominant failure mode.**
   `typecheck && lint && test && build` reports nothing about an unreferenced
   module, so five of the last dozen commits each left their predecessor in the
   tree and HEAD itself ships with 23 pieces of residue. It is a tooling gap,
   not carelessness — and it is the one finding in this audit where a single
   `devDependency` closes the whole class.

### A.3 What is genuinely good, and should not be disturbed

An audit that only lists faults misleads the reader about where the risk is.
These properties were tested and held, and several are better than typical:

- **The layering is real, not aspirational.** Eight documented boundary rules
  re-checked against a 720-module import graph: **seven hold with zero
  violations**. One import-boundary `eslint-disable` exists in the entire
  repository, documented in two places. **Zero** `@ts-ignore` /
  `@ts-expect-error` / `@ts-nocheck` in 720 files.
- **The authorization boundary is exact.** `PUBLIC_V1` is precisely the nine
  documented entries; all 105 exported `/api/v1` methods are wrapped and fail
  closed. `withDatabaseRole` is correctly implemented on a dedicated pooled
  connection with `RESET ALL` in a nested `finally`.
- **Migration discipline is genuine.** 53 contiguous files, **none ever edited
  after being committed**, and the one historical duplicate-number incident was
  caught by CI and fixed correctly.
- **The outbox is transactional and its retirement mechanism works.** All 13
  `emit()` sites pass a transaction; `RETIRED_TOPICS` makes a retired topic a
  type error; the tombstone consumer is present with its reason.
- **`evidenceBasis` is derived, never model-chosen** — at both write sites, read
  through `=== "analysis"` everywhere, with the single `!==` occurrence being
  inside the warning comment that forbids it.
- **The CSS token discipline is rare.** 74 literal colours across 21,411 lines
  of Module CSS (44 of them in one gradient-mask file), 45 dead classes out of
  1,399, zero orphaned CSS Modules.
- **Zero client components leak a `node:` or `server-only` module** — checked by
  walking value-only import edges from all 102 client roots.
- **The correction culture is honest.** Every error in this audit was findable
  because the repository writes down when it was wrong. That is why an audit
  this specific was possible at all.
- **The archive-media policy is the right model** and is already proven at
  36× the scale of the problem it is not yet applied to (~1.8 GB on Blob vs
  49.4 MB of hero video in git).

---
### A.4 Scores

Sub-scores are the auditors' own, each justified in its report. The overall
figure is this synthesis's, and its reasoning follows.

| Dimension | Score | The one sentence that decides it |
| --- | ---: | --- |
| **Structure** | **74** | Eight documented layering rules re-checked against a 720-module graph: seven hold with zero violations; the naming "inconsistency" is 21 of 23 files inside a deliberate, lint-enforced vendored boundary. |
| **Architecture** | **72** | `PUBLIC_V1` is exactly its nine documented entries, all 105 `/api/v1` methods fail closed, `withDatabaseRole` is correctly implemented, the outbox is transactional — against documentation describing a publish gate that was deleted. |
| **Dependency hygiene** | **74** | 19 of 46 packages are exactly at latest and **none is deprecated, renamed or superseded**; the gaps are toolchain, not product — but `@types/node@20` type-checks Node-24 code against a Node-20 stdlib. |
| **Asset / data hygiene** | **62** | *Data side 78* — every declared count matches, zero dangling references across 1,027 media rows and 17,105 blocks. *Asset side 52* — 4.6 MB of dead duplicates, 24.5 MB of unmanifested masters, 49.4 MB of video against the project's own policy. |
| **Testing** | **68** | 104 files asserting real properties against a real Postgres, zero `.only`/`.skip` in committed code — but 13.9% of routes are exercised as handlers, none of the nine public ones, and the production auth branch is never executed. |
| **Repository hygiene** | **62** | *Code side 74* — one `eslint-disable`, zero `@ts-ignore` in 720 files. *File side 58* — the controls are broken rather than absent: an ignore rule guarding a misspelled directory, another permanently inert. |
| **Documentation** | **58** | `docs/**` is honest, dated and cross-linked, and right about the two things that changed most recently — while `docs/api.md` covers 56 of 104 routes claiming to cover all, and `docs/environment.md` covers 21 of ~50. |
| **Scripts / tooling hygiene** | **54** | `prune-briefing-raw-blobs.ts` is a model of guarded operations; five other scripts can reach Production by default, one deploys the site with no confirmation, and 3,793 lines of `.mjs` sit in neither static gate. |
| **Agent / documentation hygiene** | **44** | The files loaded automatically into every session are the least accurate in the repository — and this audit contains its own proof, in an auditor who repeated a false `AGENTS.md` claim rather than checking it. |
| **CI/CD** | **38** | The gate is well designed — `verify:full` plus a Chromium smoke test plus a CDN reachability job — and it has been failing, unwatched and non-binding, for five consecutive deployed commits. |
| **Security / repository governance** | **22** | Public repository, no license, no branch protection, no rulesets, secret scanning **and push protection disabled**, Dependabot disabled — while ~350 MB sits unignored behind a one-character typo. |

### **Overall repository engineering maturity: 58 / 100**

The spread between the top of that table and the bottom — 74 down to 22 — is
itself the finding, and an average would hide it. This is not a repository with
uniform problems. It is **well-built code inside a shell with no working
controls.**

The engineering is genuinely good, and better than most repositories this age:
the architecture is stated as lint errors rather than as prose and passes, the
migration history has never been rewritten, the authorization boundary is exact,
the CSS token discipline is rare, and the content data is close to flawless. A
senior engineer reading `server/` or `components/` would find little to argue
with.

What pulls the number to 58 is that **every mechanism intended to keep it that
way is either off, misspelled, or describing a system that no longer exists**:

- The CI gate has been red for five commits and cannot block a deploy anyway.
- There is no branch protection at all, on a public repository that
  auto-deploys to Production.
- Secret-scanning push protection — the last net before a credential becomes
  public — is disabled, while an ignore rule with a typo leaves ~350 MB of
  scratch one `git add -A` from the index.
- `verify:full` cannot see an unreferenced module, so five of the last dozen
  commits each left their predecessor in the tree.
- The two documents loaded into every session describe a publish gate that
  migration `0049` deleted, and one publish path now has no quality check at all.

None of that is decay. Every one of these findings dates from the last two
weeks, most from the last three days, and they share a single shape: **the work
outran the controls.** That is a good problem to have and a cheap one to fix —
the P0 list is one documentation pass, one settings toggle, one typo, one script
default and one `accessFor` line. What it is not is a problem that stays cheap:
each of the five bullets above is a mechanism that, while it stays broken, lets
the next instance of the same class through unnoticed.

**A repository that scored 58 today would score in the high 70s on the P0 and P1
lists alone**, without touching a single line of product code.

---
## B. Current Repository Map

1,465 tracked files, 107.06 MB at HEAD. Sizes from `git ls-files -z | xargs -0 stat`.

| Directory | Size | Files | What it is | Owner / domain | Verdict |
| --- | ---: | ---: | --- | --- | --- |
| `public/` | 55.0 MB | 31 | Served static: hero video (49.4 MB), particle binaries, SDF icons, emblems, manifest icons | Frontend runtime | **Misclassified** — 46% of the repo is video that policy says belongs on Blob (A3-13) |
| `assets/` | 26.9 MB | 25 | `source/` + `reference/` are bake inputs; `brand/` + `marketing/` are non-regenerable masters | Design | **Undocumented** — 24.5 MB with no manifest and no consumer (A3-06) |
| `content-packages/` | 13.2 MB | 536 | October-7 / Hamas-massacre / fake-resistance record sets read at build time | Editorial data | Auditor 8 |
| `server/` | 4.6 MB | 209 | The information-model backend: 16 modules, contracts, db, http, core, jobs | Backend | Sound; see §C |
| `lionsofzion-essential-logo-pack/` | 2.4 MB | 5 | Unzipped logo pack at repo root | — | **Dead** — every byte exists elsewhere (A3-05) |
| `logos/` | 2.3 MB | 4 | The same pack unzipped a second time | — | **Dead** (A3-04, A3-05) |
| `components/` | 1.5 MB | 221 | 31 directories: two primitive systems, feature areas, the WebGPU entrance | Frontend | Sound; 2 dead dirs |
| *(root files)* | 1.2 MB | 30 | 13 markdown (604 KB) + every tool config | — | **The least navigable directory** (A1-21) |
| `app/` | 1.0 MB | 205 | 34 pages, 104 API route files, the 9.4k-line admin console | Frontend + API | Sound; console is a query-string SPA (A5-03) |
| `tests/` | 830 KB | 104 | Vitest against PGlite, flat directory | QA | Auditor 6 |
| `scripts/` | 266 KB | 40 | Bake pipelines, backup, perf, briefing composer | Tooling | Auditor 6; ESLint-ignored (A4 §3.3) |
| `docs/` | 181 KB | 12 | The reference set | Documentation | Good writing, half-indexed (A1-18) |
| `lib/` | 164 KB | 22 | The frontend's content seam | Frontend | One inverted dependency (A2-14, A5-08) |
| `.ai/` | 105 KB | 4 | `DECISIONS` (94 KB), `STATE`, `WORKFLOW`, `ROLLBACK` | Agent layer | ADR log unnavigable (A1-14) |
| `.claude/` | 8.6 KB | 5 | Hooks (unwired), sync skill, launch config | Agent layer | Documents a wiring that was removed (A1-10) |
| `backups/` | **0 KB** | 9 | Nine zero-byte `pg_dump` stubs | — | **Untrack + harden the script** (A3-03) |
| `examples/`, `.github/` | 7.8 KB | 3 | Two fixtures; CI workflows | — | Auditor 7 |

**Source vs generated vs operational** — the distinction the repository does
not currently record anywhere:

| Class | Paths | Regenerable? |
| --- | --- | --- |
| Source, hand-authored | `app/ components/ lib/ server/ tests/ scripts/ docs/` | n/a |
| Source, non-regenerable binary | `assets/source/icons/*.svg`, `assets/reference/crowned-lion-*.png`, `assets/brand/**` | **No** — image-model output, marked "never redraw" |
| Generated, deterministic | `public/icons/*.sdf.png`, `public/particles/*.bin`, `public/posters/*` | **Yes** — `npm run bake:*` |
| Generated, hand-copied | `public/emblems/*.svg` | Should be, is not (A3-10) |
| Generated, machine | `server/db/migrations/meta/*_snapshot.json` (30 files) | drizzle-kit |
| Operational | `scripts/backup-briefing-database.sh`, `.github/**`, `vercel.json` | n/a |
| Historical / residue | `backups/**`, `logos/**`, root logo pack, 10 root plan documents | n/a |

**Does the structure reflect the architecture?** In the code, yes — the
directory tree and the lint-enforced layering agree, and a reader can predict
what is in `server/modules/<name>/` from the name in thirteen of sixteen cases.
Above the code, no: the repository root mixes four naming conventions, ten
plan/audit documents totalling 587 KB, two dead logo trees and a `backups/`
directory, with nothing distinguishing live from historical. There is no
`docs/plans/`, no `docs/archive/` and no `project-history/`, which is precisely
why finished work has nowhere to go and stays at root reading as current.

---
## C. Findings

Findings keep the ID assigned by the auditor who filed them (`A1-`…`A8-`), so
every entry here is traceable back to the report that carries its full
evidence. Presented in full schema below are the findings that are **P0 or P1**,
or whose severity or meaning **changed when two reports were read together**.
The complete index of all findings — every severity, every surface — is §C.5.

### C.1 Critical

---

### C.0 Cross-report reconciliation

Eight auditors working independently over overlapping surfaces produced four
kinds of result worth separating: findings two or more of them reached by
different methods (strong), findings only one could see (unconfirmed but not
weak), findings where they disagreed (resolved below), and one case where a
finding changed severity once a second auditor's evidence was added.

### C.0.1 Independently confirmed by two or more auditors

| Finding | Auditors | Why the convergence matters |
| --- | --- | --- |
| `server/modules/` holds 16, docs say 14 | 1, 2, 4 | Three different methods (`ls`, import graph, module-shape census) hit the same number. Certain. |
| The publish gate no longer exists | 1, 4 | A1 found it by reading migration `0049` against `CLAUDE.md`; A4 found it by tracing `evaluateCandidate` call sites. Same conclusion, two directions. |
| `.env.example` is tracked, two docs say otherwise | 1, 3 | `git ls-files --error-unmatch` plus `git check-ignore --no-index` from both. |
| `components/graphics/viewport.ts` is dead | 2, 4, 5 | Import graph (A2), route reachability (A5), and the `process.env` invariant sweep (A4) all land on it. |
| The dead-code cluster (typographic-field, `lib/content/home.ts`, `InformationWarBeams`, `CommandBackground`, `message-scroller`) | 2, 5 | A2 built a 720-module reference graph; A5 built a route-reachability graph over `app`+`components`+`lib`. Independently written, same nine units. |
| The narrative-watch **recogniser** regex is duplicated | 2, 4 | Both note the prefixer is correctly single-owner and the *reader* half is not — the exact bug the invariant exists to prevent, re-created. |
| `docs/performance-budgets.md` is stale and wrong | 2, 3, 5 | A3 measured 7.7× understatement; A5 found a false premise in its reasoning; A2 found two components it lists as live are orphans. |
| `lib/content/*` imports types from the `components/content` barrel | 2, 5 | A2 found 8 modules doing it; A5 found the resulting cycle. A2's scope is the correct one. |
| Dead CSS in `app/admin/**` | 2, 5 | Two independently written extractors (`css2.mjs`, `deadcss.mjs`), 22 vs 24 classes — the delta is `dashboard`/`lanes`, which A2 excluded as computed-key candidates. Take A2's stricter list. |

### C.0.2 Disagreements, resolved

**1. `vercel.json`'s dangling `briefing-quality` trigger — delete it or leave it?**

- A4-02 (High): DELETE lines 50-53; the route was removed 171 commits ago.
- A1-17 and A2-12: leave `vercel.json` alone — `.ai/DECISIONS.md:123-150`
  records the owner's standing instruction "don't add and don't delete right
  now", pending a Production console check.

**Resolution: A1/A2 are right on the immediate action, A4 is right about the
end state.** The ADR is not a judgement that the config is correct; it is a
hold pending information (whether a Production queue topic has undrained
messages). The blocker is therefore a *question*, not a policy. The correct
next step is to answer it — check the Vercel queue dashboard for pending
`briefing-quality` messages — and then delete, which is exactly the
two-deploy topic-retirement rule the repository already applies to
`item.detected`. What must not happen is deleting it blind, which is what A4-02
as written would do. Recorded as **P1**, gated on the console check, not P0.

**2. Does `server/**` violate the "never imports the frontend" rule?**

- A2-13: yes — `server/modules/briefing/external-publish.ts:61` imports
  `@/lib/site-config`.
- A4 §3.2: no — rule 9 is "**Enforced**".

**Resolution: both are correct about different things, and the gap between
them is the finding.** ESLint rule 9's group is `@/app/*`, `@/app/**`,
`@/components/*`, `@/components/**` — `@/lib` is absent, so the lint rule as
written is satisfied (A4) while the rule as *documented* is violated (A2),
because `AGENTS.md` and `eslint.config.mjs`'s own frontend block both count
`lib/**` as frontend ("it is the frontend's content seam, and should be held to
the same boundary"). One import uses the gap today. This is the more
interesting version of the finding than either auditor filed alone: a boundary
that is asymmetric by omission.

**3. `components/ai-elements/sources.tsx` + `components/shadcn/collapsible.tsx`**

- A2-03: orphaned, but "needs owner confirmation — citations planned?"
- A5-05: lists them flatly as dead.

**Resolution: A2's caution is correct.** Whether the Ask desk will render
citations is a product intention, not a code fact, and `components/ask/`
already has a `CitationList.tsx` doing that job by another route. Held as an
owner question, not a deletion.

**4. Is `.env.example` tracked? — and the audit's own proof case**

- A1-03 and A3-07: **yes**, tracked since 2026-09-01; `AGENTS.md:143` is wrong.
  Both ran `git ls-files --error-unmatch` and `git check-ignore --no-index`.
- A8, in a passing out-of-scope note: "`.env.example` exists at the repo root
  and is **untracked** (`.gitignore`'s `.env*`), exactly as `AGENTS.md` warns."

**Resolution: A1 and A3 are right, and *how* the third auditor got it wrong is
itself the finding.** Verified directly for this document:

```
$ git ls-files --error-unmatch .env.example
.env.example                                    # exit 0 — TRACKED
$ git check-ignore -v --no-index .env.example
.gitignore:39:!.env.example   .env.example      # the negation wins
$ sed -n '37,39p' .gitignore
# env files (can opt-in for committing if needed)
.env*
!.env.example
$ grep -vc "^#\|^$" .env.example
0                                               # no values, no secrets
```

Auditor 8 was working a different surface, saw the claim in `AGENTS.md`, and
repeated it without checking — which is **exactly the failure A1-03 predicts**:
*"An agent trusting this will not read `.env.example`."* Within a single audit,
a stale line in the entry-point document propagated into a fresh report. It is
the clearest evidence available that A1-03's severity is right, and it is the
argument for fixing the auto-loaded files before anything else (§K, P0-1).

**5. Is `components/graphics/viewport.ts` referenced by `CLAUDE.md` correctly?**

- A2-04 and A1-04 treat `CLAUDE.md`'s sentence as a correction that was applied
  to `CLAUDE.md` but not to `docs/environment.md`.
- A4 §3.4 flags that `CLAUDE.md`'s wording ("which no longer exists") reads as
  though the *file* is gone, when what is gone is the `NODE_ENV` check inside
  it.

**Resolution: A4's reading is the precise one.** The invariant is intact, the
sentence is ambiguous, and `docs/environment.md:244` is flatly wrong. All three
are fixed by the same edit, and the file is deleted anyway under A2-04.

### C.0.3 Severity changed by cross-checking

**The publish gate: Documentation error → Critical, with a live behavioural
gap behind it.**

Auditor 1 filed A1-01 as a Critical documentation finding: `CLAUDE.md` and
`AGENTS.md` describe a two-layer publish gate (a twelve-name SQL trigger plus a
`publications/repo.ts` counter) that migration `0049` deleted on 2026-09-03.

Auditor 4 independently traced the *code* rather than the docs and found the
second half: with both counters gone, the deterministic quality suite now runs
on exactly one path — the external composer ingest at
`POST /api/internal/briefing/external-publish` — while the **internal**
briefing pipeline (`enrich → cluster → triage → draft → publish`, still wired
in `vercel.json`, still reachable through `POST /api/v1/admin/briefing/run`)
can publish to `publication` with **no deterministic quality check at all**,
and the SQL trigger no longer refuses it.

Neither auditor could see the whole thing. Together they describe a repository
whose agent instructions tell every future contributor that a safety mechanism
is catching mistakes on a path where nothing is. That is the single most
consequential finding in this audit, and it is why the executive assessment
leads with it rather than with the 66 MB of removable weight.

**Verified directly before entering this document:**

```
$ sed -n '77,95p' server/modules/briefing/quality.ts | grep -c '^\s*"'
17                                    # docs say 18
$ grep -c 'REQUIRED_QUALITY_CHECKS' server/modules/publications/repo.ts
0                                     # docs say it counts them
$ grep -c 'quality_passes' server/db/migrations/0049_remove_briefing_quality_gate.sql
0                                     # the twelve-name raise is gone
```

### C.0.4 Seen by one auditor only

Not weaker — simply on a surface only one auditor held. Recorded so a later
reader knows the confirmation level.

| Finding | Auditor | Confirmation available? |
| --- | --- | --- |
| ESLint rules 7 and 8 are shadowed by rule 9 (flat-config replacement semantics) | 4 | Cheap: `npx eslint --print-config server/contracts/enums.ts` |
| `/api/internal/briefing/external-publish` runs as table owner, outside RLS | 4 | **Verified here** — `accessFor` covers only `cron`/`queue`/`codex` |
| `.gitignore`'s `midjrny/` typo leaves ~350 MB unignored | 3 | **Verified here** — the same typo is in `.vercelignore:33` and `tsconfig.json:33` |
| 40 committed versions of `docs/project-map.html` = 16.16 MB of permanent public history | 3 | `git rev-list --objects` |
| The root layout now pulls the whole Ask desk into every route's client graph | 5 | **Verified here** — `app/layout.tsx:133` |
| Migration apply order differs between `db:migrate` (journal) and the test harness (filename) | 4 | Reading both code paths |
| The backup script's default output directory is inside the repository | 3 | `scripts/backup-briefing-database.sh:13` |

---
### C.0.5 One auditor claim corrected by direct check

**A6-20 as filed says the Production-migration guard scripts abort before they
guard, because `pnpm` is not installed. The mechanism does not reproduce.**

```
$ grep -n 'pnpm' scripts/briefing-predeploy.sh scripts/briefing-migrate-preflight.sh
briefing-predeploy.sh:11:       pnpm exec vitest run \
briefing-predeploy.sh:18:       pnpm typecheck
briefing-predeploy.sh:21:       exec pnpm briefing:migrate:preflight "$target"
briefing-migrate-preflight.sh:28: pnpm exec vitest run tests/migrations.test.ts
briefing-migrate-preflight.sh:30: pnpm db:migrate

$ command -v pnpm
pnpm FOUND                       <-- the premise of the High severity is false here

$ ls package-lock.json pnpm-lock.yaml
package-lock.json                 (no pnpm-lock.yaml)
```

**Resolution: the severity drops, the finding survives in weaker form.** The
scripts genuinely invoke a different package manager from the rest of the
repository — there is no `pnpm-lock.yaml`, CI runs `npm ci`, and every other
script uses npm. On this machine `pnpm` happens to be installed, so
`set -euo pipefail` does not abort where the auditor predicted, and the guard
chain in front of a Production schema change is **not** currently inert.

What remains real, and is worth fixing anyway: the two scripts standing in front
of a Production migration depend on a tool the repository never declares, never
installs, and does not lock. They work by accident of this developer's machine.
A fresh clone, a CI runner, or a new machine has no reason to have `pnpm`, and
there the auditor's failure mode would be exactly right. **Re-graded from High to
Medium; the recommended action — change the five calls to `npm` — is unchanged
and costs nothing.**

Recorded at length because it cuts both ways: it is the one place in eight
reports where a stated mechanism did not survive a direct check, and finding it
required running one command the auditor did not.

---
#### **A7-16 — `main` has been red for five consecutive commits, and every one of them deployed to Production**

- **Severity:** **Critical**
- **Path(s):** `.github/workflows/ci.yml`, branch `main`, Vercel Production
- **Evidence:** Re-verified directly for this document at 12:22 local:

  ```
  $ gh run list --workflow=ci.yml --branch=main --limit 12
  2026-09-05T09:16:29Z  (in_progress)  8623e6c  feat(auth): connect Google and X sign-in…
  2026-09-05T08:15:11Z  failure        40806d3  Rebuild admin operations workspace
  2026-09-05T07:33:05Z  failure        c840cb0  Elevate desktop Ask launcher
  2026-09-05T07:27:58Z  failure        ca1f8c9  Elevate the desktop Ask desk trigger
  2026-09-05T07:12:22Z  failure        00240da  Refine editorial navigation and information war pages
  2026-09-04T23:18:58Z  failure        0ffdcf5  docs: record what this design pass found and did not fix
  2026-09-04T20:11:09Z  success        5c6f734  feat(ask): the panel stops shouting
  ```

  Of the last 30 runs on `main`: **21 failure, 9 success.** The failures are real
  test assertions, not flakes:

  ```
  $ gh run view <id> --log-failed | tail
  AssertionError: expected '<script type="application/ld+json">{"…' to contain 'The Daily Brief'
  AssertionError: expected '/**\n * STATE-005 — the console's fi…' to contain 'response.status === 401 || …'
     ❯ tests/state-causes.test.ts:353:20
  AssertionError: expected '<div class="_skipHost_…"><a href…' to contain 'No narrative record matches this sele…'
  Process completed with exit code 1.
  ```

  And the second gate has not run either, because it is chained to the first:

  ```
  $ gh api repos/:owner/:repo/actions/runs/<id>/jobs
  archive assets reachable (CDN)          success
  typecheck, lint, test, build            failure
  route smoke test (headless Chromium)    skipped     <-- needs: gate
  ```

- **Problem:** The `gate` job — `npm run verify:full` = `typecheck && lint && test
  && build`, which `package.json`, `AGENTS.md` and `vitest.config.ts` all call
  "the CI gate" — has failed on every commit since 2026-09-04 20:11. Because
  `smoke` declares `needs: gate`, the headless-Chromium route smoke test has been
  **skipped** on all five as well. So neither gate has run against a passing tree
  for a day.
- **Why it matters:** `AGENTS.md` states plainly that *"a merge goes live on
  `lionsofzion.io` within about two minutes, with no manual step."* Combined with
  the absence of branch protection and required status checks (A7-19),
  **every one of those five failing commits was deployed to Production, and CI
  reported the failure afterwards, to nobody who had to act on it.** The
  repository's stated gate is currently a notification, not a gate.

  This finding reframes the rest of the audit. Every other recommendation here
  assumes a signal that tells you whether a change worked. That signal has been
  off for a day, which means: (a) the failures may already include a real
  Production defect nobody has looked at, and (b) **no dependency bump, deletion
  or refactor in §K can be attributed while the gate is red** — a change landed on
  a red gate cannot be told apart from the red it landed on.
- **Recommended action:** In this order, and nothing else first:
  1. **Get `main` green.** The failing assertions are in
     `tests/state-causes.test.ts` and page-content tests — root cause belongs to
     whoever owns those surfaces; this finding is about the gate, not the bug.
  2. **Make the gate binding** — branch protection on `main` with `gate` as a
     required status check (A7-19).
  3. **Only then** take anything else in §K.
- **Risk of action:** None. Making a currently-ignored gate binding cannot break
  anything that is not already broken.
- **Confidence:** **High.** Re-verified against the GitHub API for this document.

---
#### **A7-19 + A7-20 + A3-01 + A3-03 + A7-16 — There is no mechanical barrier at any layer between a mistake on the developer's machine and a public, deployed Production artifact**

- **Severity:** **Critical** *(no single auditor filed this; it is what the five
  findings say together)*
- **Path(s):** GitHub repository settings; `.gitignore:81`; `.vercelignore:33`;
  `tsconfig.json:33`; `scripts/backup-briefing-database.sh:13,20`;
  `.github/workflows/ci.yml`
- **Evidence:** Every layer that would normally stop a mistake was checked. All
  of them are off, missing, or misspelled. Verified directly for this document:

  ```
  $ gh api repos/:owner/:repo/branches/main/protection
  {"message":"Branch not protected","status":"404"}
  $ gh api repos/:owner/:repo/rulesets
  []
  $ gh api repos/:owner/:repo --jq '{visibility, license, security_and_analysis}'
  visibility: "public"
  license:    null
  secret_scanning:                 disabled
  secret_scanning_push_protection: disabled      <-- the last-resort net
  dependabot_security_updates:     disabled
  $ gh run list --workflow=ci.yml --branch=main --limit 6
  40806d3 failure · c840cb0 failure · ca1f8c9 failure · 00240da failure · 0ffdcf5 failure
  $ git check-ignore -v --no-index midjourny/x.png
  exit 1                                          <-- NOT ignored (rule says "midjrny")
  ```

  Laid out as a chain, with what each layer would have caught:

  | Layer | Intended to stop | State |
  | --- | --- | --- |
  | 1. Local ignore rules | Scratch files entering the index | **Misspelled** — `midjrny/` guards a directory named `midjourny/`; ~350 MB unignored (A3-01) |
  | 2. Tool defaults | Artifacts landing where `git add -A` finds them | **Inverted** — the backup script defaults its `pg_dump` output *inside* the repository (A3-03) |
  | 3. CI gate | A broken commit reaching Production | **Red for five commits, and never binding** (A7-16) |
  | 4. Branch protection / required checks | A push bypassing the gate | **Does not exist** — 404, no rulesets, empty environment protection (A7-19) |
  | 5. Secret-scanning push protection | A credential reaching a public repo | **Disabled** (A7-20) |
  | 6. Deploy | — | **Automatic on push, live in ~2 minutes** |

- **Problem:** Each finding is defensible on its own. Read together they describe
  a system with six places a mistake could be stopped and **zero** that would stop
  it. The `.gitignore` typo is the same class of mistake as the one that already
  put nine files into the index via `git add -A` (A3-03); the difference next time
  is that the untracked tree now holds ~350 MB, and if what rides in is a
  credential rather than a video, layer 5 — the one net designed for exactly that
  — is switched off on a **public** repository.
- **Why it matters:** The repository already knows this risk. `.gitignore:78`
  carries a `*.rtf` rule whose comment reads *"Loose credential drops (a pasted
  key file must never reach a public repo)"* — someone wrote that rule because the
  hazard was real. The controls built in response are a hand-maintained ignore
  list with a typo in it, while every platform control that would catch what the
  list misses is disabled. And the CI gate that would at least report the damage
  has been failing, unwatched, for a day.

  The near-misses so far have been lucky rather than caught: nine `pg_dump` runs
  produced zero-byte files because the database connection was broken, not because
  anything refused them. A working connection would have committed a full
  production dump — every publication, every piece of evidence, `app_user` and
  `capability_grant` rows — to a public repository, irreversibly.
- **Recommended action:** These are cheap, and none of them is a code change.
  In order:
  1. **Enable secret-scanning + push protection** (one toggle, free on public
     repositories, blocks the push rather than reporting it afterwards).
  2. **Fix the `midjrny`/`midjourny` typo** in all three files, plus root-anchored
     `/*.mp4`, `/*.mov` and UUID-PNG rules (P0-3).
  3. **Move the backup script's default output outside the repository** and make
     it fail loudly on an empty dump (P0-4).
  4. **Get `main` green, then require `gate` as a status check with branch
     protection** (P0-0) — this is the layer that also makes every other
     recommendation in §K verifiable.
  5. **Enable Dependabot alerts and security updates.**
- **Risk of action:** Effectively none. Every step is additive; the only one with
  any friction is branch protection, and that friction is the point. For a
  single-developer repository, protection with `gate` required and the owner able
  to merge is not bureaucracy — it is the difference between a red test run
  blocking a Production deploy and merely describing one.
- **Confidence:** **High.** Every claim in the chain re-verified for this
  document against the GitHub API and the working tree.

---
#### **A1-01 + A4-01 + A4-03 — The publish gate described in every agent instruction no longer exists, and one publish path is now unguarded**

- **Severity:** **Critical**
- **Path(s):** `CLAUDE.md:163-169`, `AGENTS.md:112-114`,
  `docs/architecture.md`, `docs/data-model.md:132,286,301,308`,
  `server/db/migrations/0049_remove_briefing_quality_gate.sql`,
  `server/modules/briefing/quality.ts:77-95`,
  `server/modules/briefing/service.ts:375`,
  `server/modules/briefing/external-publish.ts:265`,
  `server/modules/publications/repo.ts`, `tests/briefing-quality.test.ts:274-300`
- **Evidence:**

  The documented invariant, in the two files auto-loaded into every agent
  session:

  > "the trigger `enforce_publication_publish_gate` counts a frozen twelve-name
  > subset and raises unless exactly twelve pass, while `publications/repo.ts`
  > counts `REQUIRED_QUALITY_CHECKS.length` (now 18). Skipping a check breaks
  > both." — `CLAUDE.md:163-169`

  > "`briefing/quality.ts` `REQUIRED_QUALITY_CHECKS` is counted by both a SQL
  > trigger and `publications/repo.ts`; the counts must agree." — `AGENTS.md:112-114`

  Four independent falsifications, three of them re-verified for this document:

  1. `0049_remove_briefing_quality_gate.sql:11-55` is a
     `CREATE OR REPLACE FUNCTION` whose new body contains **no**
     `briefing_quality_check` query, **no** `check_name IN (…)` list and **no**
     `quality_passes <> 12` raise. It requires machine provenance instead.
     `grep -c 'quality_passes' 0049…sql` → **0**.
  2. `grep -c 'REQUIRED_QUALITY_CHECKS' server/modules/publications/repo.ts` →
     **0**. Commit `595ca9d` removed `qualityCandidatePassed()` and the import.
     The constant is now referenced by `quality.ts` and five test files only.
  3. `sed -n '77,95p' server/modules/briefing/quality.ts | grep -c '^\s*"'` →
     **17**, not 18. `docs/architecture.md` and `docs/data-model.md` say
     "eighteen" in six further places.
  4. `grep -rn "evaluateCandidate"` → the only non-test call site is
     `server/modules/briefing/external-publish.ts:265`.
     `server/modules/briefing/service.ts` imports only `type DraftPassage` from
     `./quality`; its `publish` stage never evaluates a candidate.

- **Problem:** Both enforcement layers were removed on 2026-09-03 and four
  documents still describe them as live. Behind the documentation error sits a
  behavioural one: the deterministic quality suite now runs on exactly one
  path — the external composer ingest — while the internal briefing pipeline
  (`enrich → cluster → triage → draft → publish`, still wired in `vercel.json`,
  still reachable through `POST /api/v1/admin/briefing/run` and `runStage`) can
  publish to `publication` with **no deterministic quality check at all**, and
  the SQL trigger no longer refuses it.
- **Why it matters:** This is the most load-bearing claim in the repository's
  agent instructions, and it is false in the most dangerous direction. An agent
  told "no quality check is ever skipped" and "skipping a check breaks both"
  will reason about a mechanism that was deleted, and will either (a) leave the
  genuinely unguarded internal path unguarded because it believes SQL is
  catching it, or (b) "restore" a gate the owner deliberately retired
  (`0049…sql:59`: "Quality-review stage retired by owner instruction"). It is
  also a content-safety surface on a site whose stated purpose is evidence-based
  refutation: auto-publication with no evidence check.
- **Recommended action:** **DOCUMENT**, then an owner decision.
  1. Rewrite the publish-gate paragraph in `CLAUDE.md`, `AGENTS.md`,
     `docs/architecture.md` and `docs/data-model.md` to state what is now true:
     the trigger enforces provenance and human-approver rules only (post-`0049`);
     the quality suite runs in TypeScript on the external-publish path only; the
     internal pipeline has no quality gate. Replace every hard-coded count with
     a pointer to `server/modules/briefing/quality.ts` so the number cannot
     drift again.
  2. Correct the now-false 20-line comment at `tests/briefing-quality.test.ts:274-302`.
  3. **Owner decision, separately:** either have the internal pipeline call
     `evaluateCandidate` before `publish`, or retire the internal pipeline and
     its six `vercel.json` queue triggers. Do not do this in the documentation
     commit.
- **Risk of action:** The documentation change is zero-risk and should land
  immediately. Re-adding a gate to the internal path is a behaviour change on
  the publish path — apply schema first if any, and land it when no edition is
  in flight.
- **Confidence:** **High.** Re-verified against the tree for this document.

---

### C.2 High

---

#### **A3-01 — A one-character typo leaves ~350 MB unignored in a public repository**

- **Severity:** High
- **Path(s):** `.gitignore:81`, `.vercelignore:33`, `tsconfig.json:33`;
  untracked working-tree paths `midjourny/`, `lion_mobile_4k_20s.mp4`,
  `3c2a0404-626e-4b59-a901-55d246e135c4.png`
- **Evidence:** Re-verified for this document:

  ```
  .gitignore:81:midjrny/
  tsconfig.json:33: "exclude": [… "midjrny*"]
  .vercelignore:33:midjrny*

  $ git check-ignore -v --no-index midjrny/x.png     → .gitignore:81  (ignored)
  $ git check-ignore -v --no-index midjourny/x.png   → exit 1  (NOT ignored)
  $ git check-ignore -v --no-index lion_mobile_4k_20s.mp4 → exit 1 (NOT ignored)
  ```

  The rule is spelled `midjrny`; the directory that exists is `midjourny`. The
  weight is already resident in the local object store via Codex refs:
  `lion_mobile_4k_20s.mp4` is a single 167.8 MiB blob; `midjourny/` holds a
  19.1 MiB PNG, a 17.5 MiB MP4 and 14 PNGs of 6.3-8.6 MiB each. Delta between
  all-refs (517.49 MB) and `origin/main` (169.18 MB) is **~348 MB**.
- **Problem:** Three files guard a directory name that does not exist. A single
  `git add -A && git commit` — the exact gesture that produced the nine tracked
  `backups/` stubs — would commit ~350 MB permanently to a **public**
  repository, where deleting it does not reclaim the weight.
- **Why it matters:** The repo is public and a push to `main` auto-deploys.
  `.vercelignore` carries the same typo, so `midjourny/` is not excluded from a
  CLI deploy either — and that file's own comment records this precise failure
  already killing a production deploy once on 2026-09-04. The fix applied then
  hardened the wrong spelling.
- **Recommended action:** **DOCUMENT + fix the pattern.** Add spelling-tolerant
  pairs to all three files (`midjrny*/` **and** `midjourny*/`), plus
  root-anchored catch-alls for the loose drops that recur: `/*.mp4`, `/*.mov`,
  and UUID-named PNG captures. Then move the source material out of the
  repository tree entirely.
- **Risk of action:** Near zero — additive ignore rules only. Verify the
  `tsconfig.json` exclude matches nothing tracked: `git ls-files | grep midjourny`
  is empty.
- **Confidence:** High

---

#### **A4-05 — The highest-consequence write path in the system runs outside RLS**

- **Severity:** High
- **Path(s):** `server/http/handler.ts:116-124`,
  `app/api/internal/briefing/external-publish/route.ts`,
  `server/modules/briefing/index.ts:14`
- **Evidence:** Re-verified for this document — `accessFor()` classifies only
  three internal prefixes:

  ```
  server/http/handler.ts:118
    if (path.startsWith("/api/internal/cron/") ||
        path.startsWith("/api/internal/queue/") ||
        path.startsWith("/api/internal/codex/")) { … role: "app_service" … }
    if (!path.startsWith("/api/v1/")) return null;
  ```

  `/api/internal/briefing/external-publish` matches none of them, so `accessFor`
  returns `null`, `withDatabaseRole` is skipped, and `invoke()` runs on the
  ambient owner pool. The module facade is
  `externalBriefingPublish = () => externalBriefingPublishService(db())` —
  plain `db()`, no role. Its sibling `/api/internal/codex/briefing-import` —
  the same job with a different composer — *was* added to `accessFor` and runs
  as `app_service`.
- **Problem:** The one route that publishes an entire edition from an
  out-of-repo composer runs as the **table owner**, outside RLS and outside
  `set_config('app.identity', …)`. The asymmetry with its sibling looks
  accidental; no ADR explains it. The publish-gate trigger branch
  `IF current_user = 'app_service' AND NEW.auto_published_at IS NULL THEN RAISE`
  (`0049…sql:21`) cannot fire for this caller.
- **Why it matters:** RLS is the documented Production authorization boundary
  (`CLAUDE.md:186`). A write path that bypasses it is exactly the
  "passes for the wrong reason" failure the repository warns about elsewhere.
  Not a vulnerability today — the route is gated by a timing-safe shared secret
  that fails closed — but it removes defence-in-depth from the highest-
  consequence write in the system, and it silently disables one branch of the
  publish-gate trigger.
- **Recommended action:** **MOVE** — add `/api/internal/briefing/` to the
  `app_service` branch of `accessFor()` with identity
  `service:external-briefing`, matching `/api/internal/codex/`.
- **Risk of action:** **Medium.** Running the publish transaction under
  `app_service` subjects it to the RLS policies and to the `app_service` branch
  of the publish-gate trigger — it may surface a policy gap that owner privilege
  has been hiding. Exercise against Preview before Production. This is the one
  P0 item that is a behaviour change rather than a documentation fix, and it
  must not be batched with others.
- **Confidence:** High on the mechanism; Medium on whether the asymmetry is
  deliberate.

---

#### **A2-08 — The edition-date key is computed six times, and nothing pins the copies together**

- **Severity:** High
- **Path(s):** `server/modules/briefing/service.ts:301`,
  `server/modules/briefing/jobs.ts:717-721`,
  `server/modules/sources/index.ts:281`,
  `scripts/external-briefing/assemble.ts:74`,
  `app/admin/briefing-shapes.ts:100`,
  `components/briefs/LiveBriefHub.tsx:286`
- **Evidence:** The Israel-local calendar-day key — the briefing pipeline's
  edition partition key — is implemented six times under three names, every one
  of them `new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Jerusalem", … })`
  with byte-identical option objects. Confirmed for this document:
  `grep -rln 'en-CA' server app components scripts lib` returns exactly these
  six plus `components/live/feed-time.ts`, which is a genuinely different
  presentation and not a seventh copy.

  Exactly **one** of the six carries a justification, and it is real —
  `app/admin/briefing-shapes.ts:95-99` explains that the lint boundary forbids
  `app/**` from importing `server/modules/*`, so the formula is mirrored. The
  other four have no boundary excuse at all: `briefing/jobs.ts`,
  `sources/index.ts` and `scripts/**` can all import
  `server/modules/briefing/service.ts` today, and `LiveBriefHub.tsx` faces the
  same boundary as `briefing-shapes.ts` and wrote its own rather than copying
  the documented mirror.
- **Problem:** The value that decides *which edition a story belongs to* is
  derived by six independent expressions across four layers, unpinned by any
  test.
- **Why it matters:** This is the one duplication in the repository with a
  production failure mode. If any single copy is edited — a locale change, a
  timezone constant, a DST assumption — the pipeline files an edition under one
  key while the admin preview, the public hub and the source scheduler read
  another. The symptom is "yesterday's brief on the front page", not a test
  failure. The `briefing-shapes.ts` comment names this exact outcome and then
  accepts a copy rather than fixing it.
- **Recommended action:** **MERGE** into one exported helper in
  `server/contracts/` (e.g. `server/contracts/edition-date.ts`). This is
  precisely what the contracts layer is for: `eslint.config.mjs` permits
  `app/**`, `components/**` and `lib/**` to import `@/server/contracts/*`, and
  the "zod and nothing else" rule is satisfied — `Intl` is a language builtin.
  Delete all six copies. That removes the boundary excuse *and* the four copies
  that never had one.
- **Risk of action:** Low-Medium. One commit across `server/`, `app/`,
  `components/` and `scripts/`. Run `npm run lint` (the boundary rules are lint
  errors) and the briefing tests. Land when no edition is in flight.
- **Confidence:** High

---

#### **A5-01 — The root layout pulls the entire Ask desk into every route's client graph**

- **Severity:** High
- **Path(s):** `app/layout.tsx:133`, `components/ask/PublicAskDock.tsx`,
  `components/ask/AskDock.tsx:41`, `components/ask/AskDesk.tsx:38-64`
- **Evidence:** Re-verified — `app/layout.tsx:19` imports and `:133` renders
  `<PublicAskDock />` in `<body>` on every route. It is `"use client"`, calls
  `usePathname()`, and statically imports `AskDock` → `AskDesk`. Nothing on the
  path is deferred; the only `next/dynamic` in all of `app/`+`components/` is
  `components/particle-nav/CanvasMount.tsx:25`.

  Modules reachable from `app/layout.tsx`: all four `components/ai-elements/*`,
  five `components/ask/*`, six `components/motion/*`, **fourteen**
  `components/shadcn/*`, four `components/ui/*` — carrying `radix-ui` (10
  import sites), `lucide-react` (10), `cmdk`, `use-stick-to-bottom`,
  `class-variance-authority`, `nanoid`. `components/ai-elements/prompt-input.tsx`
  alone is **1,463 lines, the largest TS/TSX file in the repository**.
- **Problem:** The whole Ask desk, the AI-Elements layer, 14 shadcn/Radix
  primitives and the entire motion library are in the client graph of every
  route including `/` — for a control that is closed until clicked. `AskDock`
  already knows the desk is deferrable: it renders `<AskDesk />` inside a
  `<Dialog open={open}>` whose `open` starts `false`.
- **Why it matters:** It is the single largest structural lever on the public
  bundle and it is brand new — `git log -S'PublicAskDock' -- app/layout.tsx`
  returns exactly one commit, **HEAD itself**. The CI performance budget
  (`scripts/perf-budgets.json`, `measuredOn: 2026-09-03`) predates it, so
  nothing has weighed this. `components/ui/index.ts`'s own docblock states the
  constraint being crossed: *"none of the four may reach the home route."*
  `Dialog` now does, on every route.
- **Recommended action:** **KEEP** the dock, **MOVE** the desk behind a
  boundary: `const AskDesk = dynamic(() => import("./AskDesk"), { ssr: false })`
  inside `AskDock.tsx`, rendered on first open. The trigger button, `Icon` and
  `Dialog` stay eager — roughly 4 modules instead of ~35. Then run
  `npm run build && npm run perf:report -- --update-budgets` and refresh the
  stale baseline.
- **Risk of action:** Low. A one-frame loader inside an already-animating
  drawer. `thread-store.ts` is the shared-state seam and lives below `AskDesk`,
  so the split does not cut a stateful edge.
- **Confidence:** High for the graph; the byte figure is unmeasured (a build was
  out of scope).

---

#### **A3-13 — 49.4 MB of hero video was committed in direct contradiction of the repository's own media policy**

- **Severity:** High
- **Path(s):** `public/video/` (6 files), vs `.gitignore:53-56`,
  `.vercelignore:20-22`, `lib/content/archive.ts:223`,
  `scripts/import-archive-package.mjs:29`, `next.config.ts:12-13`
- **Evidence:** The repository already operates a working, documented,
  large-media-out-of-git policy — for one class of media and not the other.
  Archive media (~1.8 GB) is barred from git by three concordant statements and
  served from `NEXT_PUBLIC_ARCHIVE_CDN`. Meanwhile `dcf4355` (2026-09-04)
  committed `lion-hero-intro-desktop.mp4` (32.6 MB),
  `lion-hero-loop-desktop.mp4` (9.6 MB), two mobile cuts and two posters —
  **49.4 MB, 46% of the entire tracked repository.** All six are genuinely
  referenced (`components/sections/HeroVideo.tsx:51-58`,
  `app/globals.css:336-338`), so this is a placement finding, not an orphan one.
  `next.config.ts:13` already permits `media-src https://*.public.blob.vercel-storage.com`,
  so moving them needs **no CSP change**.
- **Problem:** Two classes of large media, one policy each, and they contradict.
  Nothing generalises the archive rule, which is how 49.4 MB landed in `public/`
  without violating any written rule.
- **Why it matters:** Committed video is permanent. A re-encode or re-cut adds
  the full new file to history without removing the old one, so the repository
  grows monotonically at ~30-50 MB per hero revision — and two superseded cuts
  (`public/video/cinematic-home/*.mp4`, 7.2 MB) are already permanent history.
  The archive policy exists precisely because someone reasoned this through for
  a bigger number.
- **Recommended action:** **MOVE.** Serve the four `.mp4` files from Vercel Blob
  behind `NEXT_PUBLIC_MEDIA_CDN`, mirroring `lib/content/archive.ts:223`, with a
  `/video` fallback for local development. **Keep** the two poster `.jpg`s
  (560 KB) in `public/` — they are LCP-critical and small. Add `public/video/`
  to `.gitignore` once the move lands, and record the general rule in
  `AGENTS.md`: *media over ~1 MB is served from Blob, not committed.*
- **Risk of action:** **Medium.** The hero is the homepage LCP path, so this is
  user-visible: a Blob fetch adds a DNS lookup and a cross-origin connection the
  current same-origin fetch avoids, and the poster must cover the gap. Test on a
  preview deploy. The already-spent 49.4 MB of history is not recoverable
  without a rewrite, which this audit argues against — so this stops the
  bleeding rather than reversing it.
- **Confidence:** High on the measurement and the policy contradiction; Medium
  on LCP impact, which could not be measured.

---

#### **A3-03 — The mechanism that would commit a production database dump to a public repository is intact**

- **Severity:** Medium as filed; **treated as High here** because the control,
  not the artifact, is the finding
- **Path(s):** `backups/briefing/*.dump` (9 files),
  `scripts/backup-briefing-database.sh:13,20`, `.gitignore:75`
- **Evidence:** **There is no leak.** All nine tracked dumps are git's canonical
  empty blob `e69de29bb2d1d6434b8b29ae775ad8c2e48c5391` — zero bytes, no
  credentials, no rows, no schema.

  How they entered: `git log --diff-filter=A -- backups/` → `5c30c63`, a
  three-file UI commit, via `git add -A`. Why the ignore rule did not stop
  them — a branch race: `bf1e5dc` wrote `/backups/` into `.gitignore` on a side
  branch at 19:20; `5c30c63` committed the dumps on `main` at 20:27 where the
  rule did not yet exist; they merged at 23:07 with the files already tracked.
  Git ignore rules never apply to tracked paths, so the rule arrived permanently
  inert.

  Why they are empty: `scripts/backup-briefing-database.sh:20` uses
  `pg_dump --file="$dump"`, which creates the target **before** it connects.
  When the connection fails, `set -e` aborts before the manifest is written.
  `find backups -name '*.manifest'` → none, nine times, inside 13 minutes.
- **Problem:** Three defects compound. (1) The script's default output directory
  is **inside the repository** (`$PWD/backups/briefing`), so its artifacts land
  where `git add -A` finds them. (2) It does not verify `pg_dump` produced a
  non-empty file, so total failure looks like success. (3) The `/backups/` rule
  is permanently inert against these nine paths.
- **Why it matters:** No data leaked *this time* only because every dump failed.
  Had one succeeded, `git add -A` would have committed a full production
  `pg_dump` — every publication, every piece of evidence, `app_user` and
  `capability_grant` rows — to a **public** repository, irreversibly. The
  near-miss margin was a broken database connection, not a control. The restore
  path is safe (`scripts/verify-briefing-restore.sh:33-40` refuses without a
  manifest and matching checksum); it is the write path that is unguarded.
- **Recommended action:** **DELETE + harden.**
  1. `git rm --cached backups/briefing/*.dump` — the `.gitignore:75` rule then
     takes effect for anything new.
  2. Change line 13 so the default directory is **outside** the repository
     (`${BRIEFING_BACKUP_DIR:-$HOME/.lions-of-zion/backups/briefing}`).
  3. After line 20, fail loudly on an empty dump and remove the stub:
     `[[ -s "$dump" ]] || { rm -f "$dump"; echo "pg_dump produced an empty file" >&2; exit 1; }`
  4. Keep the manifest+checksum write; `verify-briefing-restore.sh` depends on it.
- **Risk of action:** Low. `git rm --cached` on nine zero-byte files changes no
  behaviour. The default-path change is behaviour-visible to anyone relying on
  `npm run briefing:backup` writing into `./backups` — which is the point.
- **Confidence:** High

---

#### **A1-05 + A1-06 + A1-07 — `docs/api.md` is the security-review artifact and it is wrong in three directions at once**

- **Severity:** High
- **Path(s):** `docs/api.md:11-17,109-362,137-140,429-450`,
  `server/http/handler.ts:104-135`, `app/api/**`
- **Evidence:**
  - **Undercounts the anonymous surface.** `docs/api.md:11-13` says `PUBLIC_V1`
    is "exactly **seven** entries". `handler.ts:104-113` holds **nine**. The two
    misses are `GET /published-publications` and **`POST /volunteer-interest`** —
    an unauthenticated *write* endpoint that appears nowhere in the file
    (`grep -c 'volunteer-interest' docs/api.md` → 0).
  - **Twelve guard rows say `anon` for staff-only routes** (`:109,111,114,115,118,130,146,148,174,176,360,362`),
    and drift runs the other way too: `:315` and `:317` mark two genuinely
    anonymous chat POSTs as `actor`. A prose correction at `:14-15` says the
    rows are wrong; the rows were never changed.
  - **A phantom vulnerability.** `docs/api.md:137-140` carries a boxed "**Gap**"
    callout stating `GET /api/v1/evidence` is anonymous and RLS is not engaged.
    It is staff-only, and RLS *is* engaged (`withDatabaseRole`). The same file
    contradicts itself at line 15.
  - **Coverage.** `find app/api -name route.ts | wc -l` → **104**; ~48 have no
    mention at all (46%). The file's own self-assessment says "**Four** routes
    are undocumented", and two of the four it names do not exist as route files.
- **Problem:** The document whose stated contract is "Every HTTP route, its
  guard, its shape" covers just over half of them, mis-states fourteen guard
  rows in both directions, hides an unauthenticated POST entirely, and
  manufactures a security gap that was closed.
- **Why it matters:** This is the artifact a security reviewer reads.
  `README.md:89`, `AGENTS.md` and `docs/README.md` all designate it
  authoritative. An unauthenticated write endpoint missing from the guard table
  is exactly the class of thing that review exists to catch. The two largest
  coverage holes are the entire `internal/briefing/*` fulfilment path — which
  `README.md:75-80` names as *the* way an edition is published — and most of
  the `v1/admin/console/*` surface.
- **Recommended action:** **DOCUMENT now, GENERATE next.** Immediately: correct
  the count to nine, add rows for `published-publications` and
  `volunteer-interest`, flip the twelve rows to `actor` and the two chat POSTs
  to `anon`, delete the obsolete Gap callout and the now-redundant preamble, and
  state the real coverage honestly. Then add a script that walks
  `app/api/**/route.ts`, extracts exported methods, and diffs against
  `docs/api.md`, failing CI on divergence — generating the *inventory* while
  keeping the prose, which is this file's real value.
- **Risk of action:** Low. Do not delete the Gap callout without confirming that
  `dataClass` filtering is genuinely handled by RLS rather than merely intended
  to be.
- **Confidence:** High

---

#### **A1-14 — The ADR log tells the reader that a push to `main` cannot reach Production**

- **Severity:** High
- **Path(s):** `.ai/DECISIONS.md:475,629,685-690,512-576`
- **Evidence:** 1,606 lines, 93,766 bytes, 74 `##` entries over 13 days.
  `grep -c '^\*\*Status'` → **0**. `grep -c 'ADR-'` → **0**. The supersession
  convention exists and is used properly once (`:692`) but is not applied to the
  most consequential reversal in the file:

  > "## 2026-08-26 — Production deploys remain an explicit CLI action
  > The GitHub integration is not the deployment trigger for this project. A
  > push to the repository therefore cannot silently publish a new Production
  > build…" — `.ai/DECISIONS.md:685-690`

  This is flatly false as of 2026-09-04 — `README.md:66-71`, `AGENTS.md:54-56`,
  `CLAUDE.md` and `docs/operations.md` all document git auto-deploy — and it
  carries **no superseded marker**. Same for `:475` and `:629` ("`PUBLIC_V1` is
  exactly seven entries"). A fourth contradiction: four 2026-08-27 entries
  (`:512-576`) mandate a manager/worker agent protocol with a waiver
  requirement, while a fifth entry of the same date (`:448`), `AGENTS.md:22-24`
  and `.ai/WORKFLOW.md` all reverse it. Nothing says so.
- **Problem:** As an ADR log it has no stable IDs, no status field, and applies
  its own supersession convention selectively — with at least four entries that
  are actively false and unmarked.
- **Why it matters:** `README.md:94` and `AGENTS.md` bill this as "the ADR
  log — why things are the way they are", and `.claude/hooks/session-context.mjs`
  was built to inject entries at session start. An agent that greps it for
  "deploy" finds the 2026-08-26 entry: dated, authoritative in tone, and wrong
  in the most dangerous possible direction on the repository's highest-risk
  operation.
- **Recommended action:** **DOCUMENT** — add a `Status: Active | Superseded by
  <date — title>` line to every entry, starting with the four identified. Then
  split entries older than ~30 days into `.ai/DECISIONS-archive-2026-08.md` so
  the live log stays readable. Retain append-only discipline: supersession is an
  *annotation*, never a rewrite of an entry's body.
- **Risk of action:** Low.
- **Confidence:** High

---

#### **A1-04 — The canonical environment reference covers under half the live surface**

- **Severity:** High
- **Path(s):** `docs/environment.md`, `.env.example`, `server/core/config.ts`
- **Evidence:** `docs/environment.md` is designated "Every environment variable,
  by name" by `README.md:91`, `AGENTS.md` and `docs/README.md`. It names ~21.
  `.env.example` names **50**. `server/core/config.ts` reads **36**.

  Read by `config.ts` and absent from the doc (22 names), including every Google
  Agent Search variable, `RATE_LIMIT_HMAC_SECRET`, `GOOGLE_AUTH_SESSION_SECRET`,
  and all four `*_RESOURCE_ENV` guards. Documented but read by nothing:
  `DATABASE_URL_UNPOOLED`. Documented with a false attribution:
  `docs/environment.md:244` credits `NODE_ENV` to
  `components/graphics/viewport.ts`, which reads no `process.env` at all —
  `CLAUDE.md` already carries that correction and it was never applied here.
- **Problem:** The document three others designate canonical covers well under
  half the live surface, documents a variable nothing reads, and carries an
  attribution already identified as dead.
- **Why it matters:** Secrets management on a public repository with a
  Production auto-deploy. An engineer provisioning a new environment from this
  file misses the rate-limit HMAC secret and all four `*_RESOURCE_ENV` guards —
  the last of which are what keep Preview from writing to Production data
  (`server/core/config.ts:61-64`).
- **Recommended action:** **GENERATE** — make the document derived: a script
  that lists `process.env` reads from `server/core/config.ts` and diffs them
  against `.env.example`, failing when they disagree. Until then MERGE the 22
  missing names in, delete the `viewport.ts` row, and point the doc at
  `.env.example` as the authoritative name list.
- **Risk of action:** Low.
- **Confidence:** High

---

#### **A1-03 + A3-07 — `AGENTS.md` is wrong about `.env.example`, in the one file class where being wrong publishes secrets**

- **Severity:** High
- **Path(s):** `AGENTS.md:143-145`, `docs/environment.md:14-15,131,190,262-267`,
  `.gitignore:37-39`, `.env.example`
- **Evidence:**

  ```
  $ git ls-files --error-unmatch .env.example    → tracked, exit 0
  $ git check-ignore -v --no-index .env.example  → .gitignore:39:!.env.example
  $ grep -vc "^#\|^$" .env.example                → 0 uncommented lines
  ```

  `AGENTS.md:143-145` says "`.env.example` is **not in git** — `.gitignore`'s
  `.env*` pattern captures it." False since **2026-09-01**: the same commit
  (`0860369`) that added the file added the `!.env.example` negation that
  un-ignores it. `docs/environment.md:262-267` proposes as a *future fix*
  exactly the negation `.gitignore:39` already contains.
- **Problem:** Two authoritative documents — one of them the entry point every
  agent reads first — assert that `.env.example` is untracked and that
  `.gitignore` captures it. Both are wrong.
- **Why it matters:** Two harms. An agent trusting it will not read
  `.env.example`, the most complete env inventory in the repository and
  materially better than the file designated canonical (A1-04). And it teaches
  the false belief that `.env*` files cannot be committed here — in a **public**
  repository where the real protection is that the file carries names only.
  Someone acting on "gitignore captures it" could add a value.
- **Recommended action:** **DOCUMENT** — rewrite `AGENTS.md:143-145` to
  "`.env.example` **is** tracked (un-ignored by `.gitignore:39`) and holds names
  only, never values", keeping the "never commit secrets" line immediately
  after. Rewrite `docs/environment.md:14-15`, delete the satisfied
  recommendation at `:262-267`, and fix the two incidental mentions at `:131`
  and `:190`.
- **Risk of action:** None.
- **Confidence:** High

---

#### **A3-04 + A3-05 — 4.6 MB of exact-duplicate brand assets, all dead**

- **Severity:** High
- **Path(s):** `logos/` (4 files), `lionsofzion-essential-logo-pack/` (5 files)
- **Evidence:** Commit `10bfd8b` unzipped the same downloaded logo pack twice —
  once at the repository root, once under `logos/` — in one 268-file commit.
  Proved by sha256: **four of the root pack's five files are byte-identical to
  files under `logos/`, and the fifth is byte-identical to `app/apple-icon.png`.
  Every byte of the root pack exists elsewhere in the repository.**

  The 2.01 MiB `79eef03d-…png` exists twice and is referenced by nothing:
  `git log -S'79eef03d' --all -- app components lib` shows `eeb08e5`
  (2026-09-04) deleting its only import — `-import lionMark from "@/logos/…"` —
  while `docs/performance-budgets.md:259` still calls it "the homepage brand
  mark … `next/image` optimises it per request".

  The live icons predate the pack: `app/apple-icon.png` was added `ca86df5`,
  five days earlier; `public/icon-{192,512}.png` are what `app/manifest.ts:15-16`
  actually serve.
- **Problem:** 4.60 MiB of tracked binary with no consumer, in two redundant
  trees, neither of which is under `public/` and therefore neither servable.
- **Why it matters:** 4.3% of the tracked repository for zero function, plus a
  genuine ambiguity — a contributor updating the brand mark has three plausible
  places to put it and no manifest saying which is right.
- **Recommended action:** **DELETE** `logos/` and `lionsofzion-essential-logo-pack/`
  entirely, and correct `docs/performance-budgets.md:255-262` in the same
  change. If the pack has value as a designer hand-off, keep it out of git.
- **Risk of action:** Low, with one mechanical caution: `scripts/perf-report.mjs:294`
  hard-codes `logos/` in its scan list and will `walk()` a missing directory
  unless that entry is removed in the same commit.
- **Confidence:** High

---

#### **A3-02 — 37% of the public repository's permanent history is files that no longer exist**

- **Severity:** High
- **Path(s):** `docs/project-map.html` (deleted), `TODOS.md`,
  `TODOS-design-audit.md`, `scripts/project-map.mjs` (all deleted)
- **Evidence:** `git rev-list --objects origin/main` → 169.18 MB of unique blobs
  against **107.06 MB at HEAD** — about **62 MB (37%)** is files absent from the
  tree. `docs/project-map.html` alone is **16.16 MB across 40 committed
  versions** of a ~940 KB machine-generated artifact. The pattern repeats:
  `TODOS-design-audit.md` 23 versions, `TODOS.md` 22, `scripts/project-map.mjs`
  14. Commit `04d9388` — "map:check could never pass once the map was
  committed" — is the project's own record that committing it was
  self-defeating.
- **Problem:** A generated file was committed on every regeneration. It has
  since been deleted, but git history is permanent: every clone of the public
  repository still downloads all 40 copies.
- **Why it matters:** It is the largest avoidable line item in the public
  repository's history and it is a *pattern*, not a one-off. Any future decision
  to reintroduce a generated map or a machine-written audit repeats it — which
  is directly relevant, because this document is itself a machine-written audit.
- **Recommended action:** **DOCUMENT the rule; do not rewrite history.** Add to
  `AGENTS.md`: *generated artifacts (project maps, audit HTML, rendered reports)
  are produced on demand and gitignored; only the generator is committed.* Add
  `docs/project-map.html` and `/*.generated.html` to `.gitignore` as a tripwire.
  **Do not** run `git filter-repo`/BFG: the remote carries 22 PR refs that a
  rewrite would invalidate, for a saving that is real but not urgent at a
  ~51 MiB pack.
- **Risk of action:** None for the documentation route. History rewriting —
  explicitly not recommended — breaks every PR ref and every existing clone.
- **Confidence:** High

---

#### **A5-02 — An eleven-way god component in a directory where the extraction pattern already exists four times**

- **Severity:** High
- **Path(s):** `app/admin/SystemPanel.tsx` (1,430 lines)
- **Evidence:** `SubArea` is an eleven-member union; the body is an eleven-branch
  ternary chain. **Four** branches delegate to sibling files that already
  exist — `ReportsSection` (385), `ChatThreadsSection` (268), `PromptsSection`
  (211), `LineageSection` (211). The other **seven** are defined inline in the
  same file: `UsersSection`, `CostsSection` (+`Meter`, `CostTable`),
  `AuditSection` (+`AuditFilters`, `auditQuery`, `AuditDetail`, `useAuditDetail`,
  `AuditDetailBody`, `AuditCard`, `AuditRow`), `IncidentsSection` (271 lines),
  `SecuritySection`, `SettingsSection`, `EnvironmentSection`.
- **Problem:** A router over eleven independent admin features living in one
  file, where the correct shape is already demonstrated four times in the same
  directory.
- **Why it matters:** Every one of the eleven areas is edited through a
  1,430-line file, and it is a single client module — so opening "Settings"
  downloads `AuditSection`, `IncidentsSection`, `CostsSection` and their tables.
  It is also the file most likely to produce merge conflicts between unrelated
  console work.
- **Recommended action:** **MOVE** — extract the seven inline sections to
  sibling files following the four that already exist. `SystemPanel.tsx` then
  shrinks to the ~50-line router it already is.
- **Risk of action:** Low-Medium. Mechanical, but `IncidentsSection` takes six
  callbacks closing over `ops`/`setConfirmIntent` in the parent; those props
  must move with it. `AuditCard` is exported — check for external consumers
  first.
- **Confidence:** High

---
### C.3 Medium — the ones that drive the remediation plan

---

#### **A2-13 — A boundary three documents assert, that lint cannot see**

- **Severity:** Medium
- **Path(s):** `server/modules/briefing/external-publish.ts:61`,
  `lib/site-config.ts`, `eslint.config.mjs` (the `server/**` block)
- **Evidence:** Re-checking every documented layering rule against the real
  import graph, seven of eight hold with **zero** violations. The eighth:

  ```
  ### server/** -> never the frontend: 1 violation
      server/modules/briefing/external-publish.ts -> lib/site-config.ts
  ```

  The invariant is stated in `AGENTS.md`, in `docs/architecture.md`'s boundary
  table, and in `eslint.config.mjs` itself ("The backend does not import the
  frontend"). But the rule's pattern list is
  `["@/app/*", "@/app/**", "@/components/*", "@/components/**"]` — **`@/lib` is
  not in it**, while the *frontend* block one screen earlier deliberately
  includes `lib/**` and explains why: *"it is the frontend's content seam, and
  should be held to the same boundary as `app/` and `components/`."*
- **Problem:** `lib/` is frontend when importing *from* server, and not-frontend
  when imported *by* server. The rule is one-directional by omission, and
  exactly one file uses the gap today.
- **Why it matters:** `eslint.config.mjs`'s opening comment is explicit about
  why these rules live in lint: *"stating them in a document makes them an
  opinion someone can disagree with in review; stating them here makes a
  violation fail the build."* The build is not failing. The same file already
  records a near-identical bug in its own history. The import is benign at
  runtime — `lib/site-config.ts` is 929 B of string constants — which is
  precisely why it went unnoticed.
- **Recommended action:** **MOVE + DOCUMENT** — move `SITE_URL` to
  `server/contracts/` or `server/core/config.ts` so both sides import downward,
  then add `"@/lib/*", "@/lib/**"` to the `server/**` rule's group so the next
  one fails the build. If the owner prefers `lib/site-config.ts` remain the
  single spelling of the domain, DOCUMENT it as a named carve-out the way
  `lib/publications.ts` is. What is not acceptable is an invariant three
  documents assert and lint cannot see.
- **Risk of action:** Low. One import line.
- **Confidence:** High

---

#### **A4 §3.1 — Two lint rules are silently shadowed by a later rule in the same config**

- **Severity:** Medium *(latent — both properties currently hold by discipline)*
- **Path(s):** `eslint.config.mjs` rules 7, 8, 9
- **Evidence:** ESLint flat config **replaces** a rule key per matching config
  object rather than merging. `server/contracts/**` is matched by rule 7
  (denies drizzle, `next/*`, `server-only`, `@/server/db*`, `@/server/modules*`)
  **and** by rule 9 (`server/**/*.ts`, denies only `@/app`/`@/components`).
  Rule 9 comes later, so **rule 7 is overridden for `server/contracts/**`** —
  the zod-only rule is inert. The same applies to `server/db/**` (rule 8).
  `server/jobs/**` escapes because rule 10 comes *after* 9.

  This is the exact failure `eslint.config.mjs`'s own comment at lines 110-120
  documents biting once before, "visible only as the `eslint-disable` in
  `lib/publications.ts` going unused".
- **Problem:** Two of the architecture's stated boundaries are documented,
  believed enforced, and not enforced.
- **Why it matters:** Lint is green because nothing violates them anyway, so the
  gap is invisible. The properties hold today by discipline — verified by reading
  every import in all 15 contract files (`zod` ×15, `./enums` ×12, `./item` ×9,
  `./source` ×1; no drizzle, no `next/*`, no `server-only`) — but the mechanism
  the repository relies on to keep them true is not running.
- **Recommended action:** **DOCUMENT + fix.** Confirm cheaply first:
  `npx eslint --print-config server/contracts/enums.ts`. Then merge the denials
  into the later-winning object, or reorder so the specific rules follow the
  general one. Add a comment naming the flat-config semantics at the fix site —
  this is the second time it has bitten.
- **Risk of action:** Low. Nothing currently violates the restored rules, so the
  fix should be a no-op against the tree — which is also how to verify it.
- **Confidence:** High on the mechanism (flat-config semantics + the config's own
  recorded history); not proven by constructing a violating import, which would
  mean writing into the repository.

---

#### **A4-09 — `db:migrate` and the test harness apply migrations by different rules**

- **Severity:** Medium
- **Path(s):** `server/db/migrations/meta/_journal.json`,
  `server/db/testing.ts:57-84`, `AGENTS.md`, `docs/data-model.md`
- **Evidence:** `package.json:18` `db:migrate` = `drizzle-kit migrate`, which
  reads `meta/_journal.json` and applies its `entries` array in order.
  `server/db/testing.ts:60` instead does
  `readdir(...).filter(.sql).sort()` — pure filename order, no journal.
  `AGENTS.md` states they are the same mechanism: "applied in filename order by
  both `db:migrate` and the test harness".

  They agree **today** (53 files, 53 journal entries), but 27 of the 53
  migrations are hand-written SQL whose journal entries were added by hand —
  only 26 have a drizzle snapshot.
- **Problem:** A hand-written `.sql` dropped into the directory **without** a
  manual `_journal.json` entry is applied by the test harness and **skipped** by
  `db:migrate`. Nothing checks that the file set and the journal set agree.
- **Why it matters:** The suite would be green against a schema Production does
  not have. This repository adds hand-written migrations routinely, auto-deploys
  `main` to Production, and states in three places that schema must be applied
  before code. A missed journal edit is a schema/code split that surfaces only
  in Production.
- **Recommended action:** **DOCUMENT + GENERATE.** Correct `AGENTS.md` and
  `docs/data-model.md` to say `db:migrate` follows the journal while the test
  harness follows filename order, and add a one-line test asserting
  `readdir(migrations).filter(.sql).sort()` equals
  `_journal.entries.map(e => e.tag + ".sql")`. That single assertion closes the
  whole class.
- **Risk of action:** None — a test addition.
- **Confidence:** High

---

#### **A2-01 + A2-02 + A2-06 + A5-05 — Five of the last dozen commits each left their predecessor in the tree**

- **Severity:** Medium *(individually Low-Medium; the pattern is the finding)*
- **Path(s):** `components/typographic-field/**` (4 files, ~66 KB),
  `lib/content/{home,war-update,particle-bank}.ts`,
  `components/briefs/{adapters,geopolitical-reference,InformationWarBeams}.ts(x)`,
  `components/graphics/viewport.ts`, `app/brand-logo.ts` (71 KB),
  `app/admin/_command/CommandBackground.tsx`, `app/admin/lexicon.ts:72`,
  `components/shadcn/message-scroller.tsx`, 41 CSS classes
- **Evidence:** Two independently written graph tools — a 720-module reference
  graph (A2) and a route-reachability graph (A5) — agree on the same set. Each
  unit traces to a specific commit that replaced it and left it:

  | Unit | Replaced by | Left behind since |
  | --- | --- | --- |
  | `components/typographic-field/**` + `particle-bank.ts` | `dcf4355` — video hero | 2026-09-04 |
  | `lib/content/{home,war-update}.ts` + 2 adapters (532 lines) | route gutted by `00240da` | 2026-09-05 |
  | `components/shadcn/message-scroller.tsx` | `7fd836c` — AI Elements `Conversation` | live for **30 minutes** on 2026-09-04 |
  | `components/graphics/viewport.ts` | `bd3dfe3` | 2026-09-02 |
  | `components/briefs/InformationWarBeams.tsx` | `00240da` | 2026-09-05 |
  | `CommandBackground.tsx`, `LANE_LABEL`, 22 CSS classes | **`40806d3` — HEAD itself** | today |

  Two tests keep part of it type-checking-alive without importing it:
  `tests/motion-runtime.test.ts` reads `engine.ts` and `TypographicField.tsx` as
  **source strings** and asserts on their text, so it reports green for
  behaviour no visitor can reach. `tests/home-content.test.ts` is the sole
  consumer of the 532-line `lib/content/home.ts` cluster — which commit
  `00240da` **edited** yesterday, relabelling sections in a module that renders
  nowhere.
- **Problem:** Roughly 1,100 lines and ~140 KB of dead code, accumulating at a
  measurable rate, with the newest commit in the repository already carrying 23
  pieces of residue.
- **Why it matters:** The root cause is a tooling gap, not carelessness.
  `npm run verify:full` is `typecheck && lint && test && build` and **none of
  the four reports an unreferenced module**; there is no knip/ts-prune/depcheck
  in `devDependencies`. Editorial effort is being spent maintaining files that
  render nowhere, and two green tests are meaningless.
- **Recommended action:** **DELETE** each cluster together with the tests that
  pin it, in the same commit — the test edits must land with the deletion or the
  suite goes red. Then **DOCUMENT the gap**: add a dead-code detector (`knip`)
  to `devDependencies` and to `verify:full`. That is the only measure here that
  stops the pattern recurring; without it the next rewrite leaves the next
  predecessor.
- **Risk of action:** Low per cluster. `lib/content/october-7.ts` is imported by
  `app/october-7/page.tsx` as well as by `home.ts` and must **stay** — check
  that boundary before deleting. `components/particle-nav/tsl/seededRandom.ts`
  is the one orphan to **keep**: it is the correctly-named canonical copy of a
  PRNG that four call sites reimplemented (A2-10), so it should become the one
  implementation rather than the sixth casualty.
- **Confidence:** High

---

#### **A5-03 — A 9.4k-line application addressed by query string rather than by route**

- **Severity:** Medium
- **Path(s):** `app/admin/**` (29 files, 9,441 lines),
  `app/admin/OperationsConsole.tsx:34-50`
- **Evidence:** The console is one Next.js route. `app/admin/page.tsx` is 17
  lines and renders `<OperationsConsole />` inside a `Suspense`.
  `OperationsConsole` declares 15 nav entries and navigates between them with
  `<Link href={`${pathname}?area=${key}`}>`, resolving the area from
  `useSearchParams()`. All fifteen panels are static imports in one
  `"use client"` module. There is **no `app/admin/layout.tsx`**.
- **Problem:** No per-area code splitting, no `loading.tsx`, no error boundary,
  no metadata, and no server rendering of any panel. One panel's runtime error
  blanks the whole console — the only boundary is `app/error.tsx` at the root.
- **Why it matters:** App Router segments would give all five for free and let
  the shell stay a server component. It also compounds A5-16: the console's two
  fonts are declared in the *root* layout because the console has no layout of
  its own, so every public route carries them.
- **Recommended action:** **DOCUMENT the choice now** — `docs/admin-workspace.md`
  was added in the same HEAD commit and is the right home for the `?area=` URL
  contract — and **MOVE** to segments when a second operator or a slower panel
  makes it pay. Cheap intermediate step available today: add an
  `app/admin/layout.tsx` (which also gives A5-16 its home) and `next/dynamic`
  the four heaviest panels; `OpsChat` is already gated behind `chatMounted`, so
  the pattern exists in the file.
- **Risk of action:** Medium if segments are adopted — the `?area=` URLs are
  presumably bookmarked and documented. Low for the layout + `dynamic()` step.
- **Confidence:** High

---

#### **A3-06 — 24.5 MB of brand masters that are plausibly essential and plausibly deletable, with nothing in the repository to decide**

- **Severity:** Medium
- **Path(s):** `assets/brand/generated-2026-08-28/` (10 files, 13.4 MB),
  `assets/marketing/` (6 files, 11.1 MB)
- **Evidence:** Zero code references (`grep` across `app components lib scripts
  server` for every filename and the directory name → empty). The only mentions
  are prose in `GRAPHICS-SYSTEMS-PLAN.md:34` and
  `GRAPHICS-PRODUCTION-PROMPT-LIBRARY.md:30-34`, which mark them
  "REUSE / DERIVE only; never redraw with an image model" — i.e. deliberately
  kept *source*, not oversight. But there is no manifest recording that, no
  derivative pipeline consuming them (unlike `assets/source/icons` →
  `bake:nav-icons` → `public/icons/*.sdf.png`), and `scripts/perf-report.mjs:294`
  does not even scan `assets/`, so the existing report never sees these 16 files.
- **Problem:** The largest ambiguous block in the repository — 23% of tracked
  bytes — with nothing in the repository resolving whether it is essential
  source or superseded output.
- **Why it matters:** Every future size review re-litigates it from scratch, and
  the two documents that justify keeping them are themselves candidates for
  archival (A1-16), which would leave the justification in an archive.
- **Recommended action:** **DOCUMENT first, then decide.** Add `assets/README.md`
  classifying each subtree explicitly — `source/` = bake input for
  `npm run bake:nav-icons`; `reference/` = bake input for `bake:nav-lion` +
  `poster:nav`; `brand/generated-2026-08-28/` = approved masters, REUSE/DERIVE
  only, no automated consumer; `marketing/` = campaign output, no automated
  consumer — and record which are safe to prune. Then extend
  `scripts/perf-report.mjs:294` to scan `assets/` so masters without a recorded
  consumer surface in the existing report rather than in an audit.
- **Risk of action:** Documentation only — none. A later deletion of
  `assets/marketing/` carries real risk only if the PayPal gallery is
  regenerated from it, which nothing in the repository indicates.
- **Confidence:** High that they are code-unreferenced; **Medium** on whether
  they should be kept — that is an owner decision the repository does not record,
  which is the finding.

---

#### **A1-16 + A1-21 — Five overlapping plan documents, one of which forbids the existence of the other four**

- **Severity:** Medium
- **Path(s):** repository root — 13 markdown files, 604 KB, ten of them
  plan/audit documents (587 KB)
- **Evidence:** `UI-UX-REBUILD-TODOS.md:11` declares itself "the **single source
  of truth** for the future UI/UX rebuild" and `:25` says "**Do not create a
  competing plan document.**" Since it was written, four competing UI plan
  documents were created or extended: `fixhomeTODO.md` (2026-09-03),
  `HOMEPAGE-ADMIN-CONSOLE-TODOS.md` (2026-09-04), `GRAPHICS-SYSTEMS-PLAN.md`
  (2026-09-04), `DESIGN.md` (2026-09-05, edited at HEAD).

  A direct contradiction between them is already live:
  `UI-UX-REBUILD-TODOS.md:429` still carries an open section for War Update
  whose route row says "**Decide product role**; merge or make genuine feed" —
  a decision that was made and implemented. `DESIGN.md` records the owner
  retiring the page and `app/war-update/page.tsx` is now a `permanentRedirect`.

  By comparison the entire `docs/` tree is 185 KB.
- **Problem:** 587 KB of plan and audit documents at the repository root in four
  naming conventions, with no `docs/plans/` or archive to move to, no stated
  precedence, and no way for a reader to tell which are live.
- **Why it matters:** An agent given "improve the homepage" finds four documents
  claiming authority over it, one asserting exclusivity, and no way to resolve
  the conflict. `DESIGN.md` is in practice the live one — it is edited every
  session — but nothing says so. This is also the structural cause of A1-21: with
  nowhere for finished work to go, completed plans stay at root and read as
  current.
- **Recommended action:** **DOCUMENT precedence, then MOVE.** Declare `DESIGN.md`
  the live design authority in `README.md`. Create `docs/plans/` (live,
  incomplete) and `project-history/` (finished, kept for provenance) and move the
  ten documents per §I. Strike the "single source of truth" and "do not create a
  competing plan document" claims from `UI-UX-REBUILD-TODOS.md:11,25` since they
  are no longer operative, and add `docs/plans/README.md` with one status line
  per plan — the artifact whose absence caused this.
- **Risk of action:** Medium. `UI-UX-REBUILD-TODOS.md` has **69 genuinely open
  items**; archiving must not read as closing them. The owner should confirm
  which plans are live before anything moves. Every rename breaks inbound links —
  `GRAPHICS-PRODUCTION-PROMPT-LIBRARY.md:9-13` and
  `HOMEPAGE-ADMIN-CONSOLE-TODOS.md:15` cross-reference siblings by exact name.
- **Confidence:** High

---

#### **A1-15 — Nine invariants maintained in two files, with a pointer between them that loses two rules**

- **Severity:** Medium
- **Path(s):** `AGENTS.md:88-121`, `CLAUDE.md:106-180`
- **Evidence:** `AGENTS.md:90` states its own contract: "Only the ones an edit is
  most likely to break; **the full list is in CLAUDE.md**." Verbatim overlap is
  low (2 shared sentences), but semantic duplication is near-total — nine
  invariants are stated in full in both files.

  **AGENTS.md is not a subset, contradicting its own framing.** Two invariants
  appear *only* in AGENTS.md: `grep -c 'change the slug' CLAUDE.md` → 0
  (the source-catalog rule) and `grep -c 'maxWorkers' CLAUDE.md` → 0. A reader
  who believes "the full list is in CLAUDE.md" and reads only CLAUDE.md **misses
  both**.
- **Problem:** Nine invariants maintained in two places with no mechanical link,
  and the pointer between them is false in the direction that loses information.
- **Why it matters:** The duplication has already produced identical drift —
  A1-01 went stale in *both* files simultaneously, and having two copies caught
  nothing. Two copies of a rule do not double the chance of it being right; they
  double the maintenance cost and halve the chance either gets updated.
- **Recommended action:** **MERGE** with an explicit ownership split —
  `AGENTS.md` owns owner authority, the Next.js version warning, commands, the
  deploy rule, and a *pointer-only* invariants section; `CLAUDE.md` owns every
  invariant in full, including the two currently orphaned in AGENTS.md;
  `docs/**` owns reference detail; `.ai/DECISIONS.md` owns *why*, dated, never
  *what is true now*.
- **Risk of action:** Medium. `AGENTS.md` is the entry point for non-Claude
  agents too; reducing it to pointers assumes those agents follow the link. Keep
  the three or four highest-consequence rules inline (auto-deploy,
  `recordVersion`, `neon-http`) and pointer the rest.
- **Confidence:** High

---

#### **Also Medium, filed in full in the source reports**

| ID | Finding | Report |
| --- | --- | --- |
| A1-02 | The 07:00 "deploy between editions" rule is obsolete on both premises — the cron was removed `c1e579b` and the quality-check count it gates on is dead | 01 |
| A1-09 | `.ai/STATE.md`'s "Next" section directs the reader to `TODOS.md` (deleted 2026-09-02) and `docs/archive/` (never created) | 01 |
| A1-10 | `.claude/skills/sync/SKILL.md` documents a `SessionStart` hook; `.claude/settings.json` is `{"hooks": {}}`. `.ai/STATE.md` has become a log with a "Latest" heading eight days older than the content below it | 01 |
| A1-13 | Two committed audit reports (66 KB) rest on 87+ screenshots in a gitignored directory that does not exist | 01 |
| A1-17 | `vercel.json:49-53` declares a queue trigger for a route that does not exist — correctly documented, but with no closure path | 01 |
| A2-03 | `components/shadcn/message-scroller.tsx` is the sole consumer of the `@shadcn/react` production dependency, and has no consumer itself | 02 |
| A2-09 / A4-13 | The narrative-watch **recogniser** regex is hand-copied in two frontend files — the exact bug `narrativeWatchTitle()` was centralised to prevent | 02, 04 |
| A2-14 / A5-08 | Eight `lib/content/*` modules import their core domain types from the `components/content` React barrel, inverting the dependency and closing a cycle | 02, 05 |
| A4-04 | Three constants named `PIPELINE_STAGES` with three different contents; the contract's still contains the retired `quality` stage, so the console draws a step that can never advance | 04 |
| A4-06 | `admin-console` (a 4,264-line cross-domain read model reading 35 tables in 98 raw queries) and `ops-agent` appear in **no** architecture document | 04 |
| A4-07 | Ten independently checkable numeric claims in `docs/architecture.md` and `docs/data-model.md` are wrong, all in the same direction | 04 |
| A4-08 | `gdeltConnector` is exported, never registered, and `briefing/repo.ts:489` still selects `gdelt` rows for scheduling | 04 |
| A4-10 | `ai/service.ts:400` updates `informationItem` — another module's versioned table — the only cross-module table write in `server/**` | 04 |
| A4-11 | Module encapsulation is lint-enforced only inside `app/api/**`; 23 deep cross-module imports exist in `server/**`, including a `sources ← briefing` back-edge | 04 |
| A5-04 | `app/particle-demo/page.tsx` imports `leva`, declared in **devDependencies**, on a route that builds and deploys to Production | 05 |
| A5-06 | `components/content/NetworkFigure.tsx` is a finished-migration pass-through shim with one caller, plus 10 dead CSS rules | 05 |
| A5-07 | The workspace rebuild landed a new stylesheet without removing the old shell's rules: 24 dead classes across three stylesheets for one route, with no membership rule | 05 |
| A3-09 | `.vercelignore` excludes six paths that no longer exist while omitting ~31 MB that does | 03 |
| A3-08 | `docs/performance-budgets.md` understates static assets by **7.7×**; `perf-budgets.json` has no `assets` budget, so no asset growth can fail the gate | 03 |

---
### C.5 Complete findings index

Every finding from all eight reports. Full evidence for each lives in the
report named in the last column, under the same ID.

**Auditor 1 — documentation truth, root hygiene, agent layer**

| ID | Sev | Finding |
| --- | --- | --- |
| A1-01 | **Critical** | `CLAUDE.md`/`AGENTS.md` describe a publish gate deleted by migration `0049`; the count is off by one and the cross-check module never performed it |
| A1-02 | High | The 07:00 "deploy between editions" rule is obsolete on both premises |
| A1-03 | High | `AGENTS.md` says `.env.example` is not in git; it has been tracked since 2026-09-01 |
| A1-04 | High | `docs/environment.md` documents ~21 of ~50 variables while three files designate it canonical |
| A1-05 | High | `docs/api.md` says `PUBLIC_V1` is seven; it is nine — the misses include an unauthenticated POST absent from the whole file |
| A1-06 | High | Twelve guard rows say `anon` for staff-only routes; two say `actor` for anonymous ones; a boxed "Gap" callout describes a vulnerability that was closed |
| A1-07 | High | ~48 of 104 routes are undocumented; the file's own self-assessment says four |
| A1-08 | High | `server/modules/` holds 16, `CLAUDE.md` says fourteen — the two omitted are the newest and most actively edited |
| A1-09 | High | `.ai/STATE.md` directs the reader to `TODOS.md` (deleted) and `docs/archive/` (never created) |
| A1-10 | Medium | The sync skill documents a `SessionStart` hook; `settings.json` is `{"hooks": {}}`. `.ai/STATE.md` has become a log with a stale "Latest" heading |
| A1-11 | Medium | `AGENTS.md:71-73` calls README stale; README is correct — the note is the stale one |
| A1-12 | Medium | README names eight primary destinations; `SITE_NAVIGATION` holds seven |
| A1-13 | Medium | Two committed audit reports rest on 87+ screenshots in a gitignored, absent directory |
| A1-14 | **High** | `.ai/DECISIONS.md`: 74 entries, no IDs, no status fields, ≥4 flatly false and unmarked — including one saying a push cannot reach Production |
| A1-15 | Medium | Nine invariants in two files; the pointer between them loses two rules |
| A1-16 | Medium | Five overlapping plan documents; one forbids the existence of the other four |
| A1-17 | Medium | `vercel.json` declares a queue trigger for a nonexistent route — correctly documented, no closure path |
| A1-18 | Low | `docs/README.md` indexes 7 of 12 docs, omitting the 533-line largest one and the file carrying A1-01's correction |
| A1-19 | Low | `fixhomeTODO.md` hard-codes the owner's username and absolute path in a public repo |
| A1-20 | Cleanup | Five markdown naming conventions coexist with no rule |
| A1-21 | Medium | 13 root markdown files, 604 KB; ten are plan/audit documents with nowhere to go |

**Auditor 2 — reference graph, orphans, duplication, naming**

| ID | Sev | Finding |
| --- | --- | --- |
| A2-08 | **High** | The Israel-local edition-date key is computed six times; nothing pins the copies together |
| A2-01 | Medium | `components/typographic-field/**` (~66 KB) replaced by the video hero, held up by two tests that read it as text |
| A2-02 | Medium | 532 lines of home/war-update content modules whose only consumer is one test — and which HEAD-1 edited |
| A2-03 | Medium | `message-scroller.tsx` was live for 30 minutes and is the sole consumer of the `@shadcn/react` dependency |
| A2-04 | Medium | `components/graphics/viewport.ts` is dead, self-describes as live, and is named by a doc as an env reader it is not |
| A2-09 | Medium | The narrative-watch recogniser regex re-created in two frontend files — the exact bug the invariant prevents |
| A2-13 | Medium | `server/** → lib/` : an invariant three documents assert and the lint rule cannot see |
| A2-14 | Low | Eight `lib/content/*` modules import domain types from the `components/content` barrel, closing a cycle |
| A2-05 | Low | `app/brand-logo.ts` — 71 KB of base64 PNG in `app/`, zero references |
| A2-06 | Low | HEAD itself ships 23 pieces of residue: one component, one constant, 22 CSS classes |
| A2-07 | Low | Ten `network*` CSS rules survived the component that drew them, in a 20-consumer stylesheet |
| A2-10 | Low | Mulberry32 implemented five times; the canonical, correctly-named copy is the orphan |
| A2-16 | Low | `CLAUDE.md`'s module count, from the import graph's side |
| A2-17 | Cleanup | One genuine filename outlier — `app/admin/console-primitives.tsx` |
| A2-11 | Cleanup | The five identical queue route files are a platform requirement — **KEEP**, documented |
| A2-12 | Low | `HOMEPAGE-ADMIN-CONSOLE-TODOS.md:46` still carries an item the ADR log closed |
| A2-15 | Cleanup | The drizzle mutual-FK cycle is intentional and load-bearing — **KEEP**, documented |

**Auditor 3 — assets, backups, ignore-file truth, repository size**

| ID | Sev | Finding |
| --- | --- | --- |
| A3-01 | **High** | `midjrny/` vs `midjourny/` — a one-character typo in three files leaves ~350 MB unignored |
| A3-02 | High | 37% of the public repo's permanent history is deleted files; `docs/project-map.html` alone is 16.16 MB across 40 versions |
| A3-04 | High | A 2.01 MiB logo exists twice and is referenced by nothing; a doc calls it "the homepage brand mark" |
| A3-05 | Medium | The same logo pack was unzipped twice in one commit; every byte exists elsewhere |
| A3-13 | Medium | 49.4 MB of hero video committed against the repository's own, working, documented media policy |
| A3-03 | Medium | The nine backup stubs are empty — **no leak** — but the mechanism that would commit a production dump is intact |
| A3-06 | Medium | 24.5 MB of brand masters, code-unreferenced, with no manifest and no scanner that looks at them |
| A3-07 | Medium | `AGENTS.md` and `docs/environment.md` wrong about `.env.example` (with A1-03) |
| A3-08 | Medium | `docs/performance-budgets.md` understates static assets 7.7×; no asset budget exists to fail on |
| A3-09 | Medium | `.vercelignore` names six paths that no longer exist while omitting ~31 MB that does |
| A3-10 | Low | Eight icon SVGs kept identical in two places by hand, with no copy step and no check |
| A3-11 | Low | 34 Codex tree refs pin ~348 MB locally; `.git` is 507 MB against a 51 MiB pack |
| A3-12 | Cleanup | **Negative result, recorded as evidence:** the tracked index is free of `.DS_Store`, build output, caches, archives and secrets |

**Auditor 4 — `server/**` architecture, layering, invariants**

| ID | Sev | Finding |
| --- | --- | --- |
| A4-01 | **Critical** | Both publish-gate layers are gone; the internal pipeline can publish with no deterministic quality check |
| A4-02 | High | `vercel.json` declares a `functions` entry for a route deleted 171 commits ago |
| A4-05 | **High** | `/api/internal/briefing/external-publish` runs as table owner, outside RLS — its sibling does not |
| A4-03 | Medium | `REQUIRED_QUALITY_CHECKS` holds 17; six places say eighteen |
| A4-04 | Medium | Three `PIPELINE_STAGES` constants with three different contents; the console draws a stage that can never advance |
| A4-06 | Medium | `admin-console` (4,264 lines, 35 tables, 98 raw queries) and `ops-agent` appear in no architecture document |
| A4-07 | Medium | Ten checkable numeric claims in the two reference documents are wrong, all in the same direction |
| A4-08 | Medium | `gdeltConnector` is exported and never registered, while `repo.ts:489` still schedules `gdelt` rows |
| A4-09 | Medium | `db:migrate` follows the journal; the test harness sorts filenames. A missing journal entry = green tests, absent Production schema |
| A4-10 | Medium | `ai/service.ts:400` writes another module's versioned table — the only such site in `server/**` |
| A4-11 | Medium | Module encapsulation is lint-enforced only inside `app/api/**`; 23 deep imports and a `sources ← briefing` back-edge exist |
| A4 §3.1 | Medium | ESLint rules 7 and 8 are shadowed by rule 9 — the zod-only and no-modules boundaries are inert |
| A4-12 | Low | `publication.quality_approved_at` is written by nothing, read by nothing, and named for a guarantee no longer made |
| A4-13 | Low | The recogniser duplication, from the server side (with A2-09) |
| A4-14 | Low | One of three shared-secret comparisons uses `!==` where its siblings use `timingSafeEqual` |
| A4-15 | Low | Five admin API responses have no contract; their shapes are hand-declared in the client |
| A4-16 | Low | One module is a sixth of the backend in three undecomposed files |
| A4-17 | Cleanup | Four cosmetic inconsistencies in the migration layer — **do not** rename an applied migration |
| A4-18 | Low | **Positive:** no migration has ever been edited after commit; the one duplicate-number incident was caught by CI and fixed correctly |

**Auditor 5 — frontend structure**

| ID | Sev | Finding |
| --- | --- | --- |
| A5-01 | **High** | The root layout pulls the whole Ask desk, AI-Elements, 14 Radix primitives and the motion library into every route — for a closed drawer |
| A5-02 | High | `SystemPanel.tsx`: an eleven-way god component where the extraction pattern already exists four times in the same directory |
| A5-03 | Medium | `app/admin/**` is a 9,441-line query-string SPA: no code splitting, no `loading`, no error boundary, no layout |
| A5-04 | Medium | `app/particle-demo/page.tsx` imports `leva`, a **devDependency**, on a route that deploys to Production |
| A5-05 | Medium | Nine unreachable units, ~2,000 lines (handed to Auditor 2 for the verdict) |
| A5-06 | Medium | `NetworkFigure.tsx` is a finished-migration shim with one caller, plus 10 dead CSS rules |
| A5-07 | Medium | The workspace rebuild left 24 dead classes and three stylesheets for one route with no membership rule |
| A5-08 | Low | The single import cycle in 385 modules — `lib → components` barrel, both edges type-only |
| A5-09 | Low | Two barrels state a convention the codebase contradicts 133 times out of 136 |
| A5-10 | Low | Twelve `composes:` reach up to four levels into a component stylesheet while `globals.css` hosts the correct pattern |
| A5-11 | Low | Two of four DOM event channels are bare string literals duplicated across two files |
| A5-12 | Low | Zero `loading.tsx` in the repository; four DB/content-backed routes block on their slowest await |
| A5-13 | Low | `components.json` aliases `hooks` to a directory that does not exist |
| A5-14 | Low | The performance doc and CI budget describe a tree two days old, and one claim rests on a misread of the file |
| A5-15 | Cleanup | No formatter config; quote style splits cleanly by directory |
| A5-16 | Cleanup | Two admin-only fonts declared in the root layout because the console has no layout |
| A5-17 | Cleanup | One duplicated fetch per refresh, already worked around in the code |

**Auditor 6 — test architecture and `scripts/**`**

| ID | Sev | Finding |
| --- | --- | --- |
| A6-01 | High | No DOM anywhere in the suite; all frontend coverage is SSR strings or source-text regex |
| A6-03 | High | 13.9% of HTTP routes are ever invoked as handlers; **zero** of the nine `PUBLIC_V1` routes has a route test |
| A6-04 | High | `withDatabaseRole` untested and **mocked away** in the two tests that reach it; the pooled-session reset is the untested part |
| A6-08 | High | The production `authenticateAdmin` branch is never executed — every test forces `APP_ENV=development` or nulls the Neon session, including the file `CLAUDE.md` cites as the pin |
| A6-13 | High | 1,065 archivable lines of superseded, credit-spending composer that **defaults to publishing to `lionsofzion.io`**, with no caller |
| A6-18 | High | Destructive-script guards applied inconsistently: five guard well, three of identical hazard class guard not at all |
| A6-20 | ~~High~~ **Medium** | The two pre-migration guard scripts call `pnpm` in an npm-only repo — **re-graded, see §C.0.5**: `pnpm` is installed here, so they do not abort; the undeclared dependency remains |
| A6-02 | Medium | No coverage instrumentation at all; `tsconfig` excludes a `coverage/` directory nothing can produce |
| A6-05 | Medium | The one skipped block asserts its own skip condition, and `freshDatabase()` has no path to `TEST_DATABASE_URL` — so the remedy four documents describe cannot work |
| A6-06 | Medium | Admin console tests: 10 files, 3,935 lines, split by **commit phase** (`-p2`, `-p3`) rather than subject; ops-agent tested in two homes |
| A6-07 | Medium | `route-inventory.test.ts` asserts a hard-coded `34` and nothing else — its only failure mode is "update the number" |
| A6-09 | Medium | Zero helper files in `tests/`; `seedUser` copy-pasted five times with three signatures, `ROOT` 19×, `read` 15× |
| A6-11 | Medium | Tests asserting literal source formatting and Markdown prose; `not.toContain("--force")` does not hold the property it claims |
| A6-12 | Medium | `perf:report` is documented twice as "the CI gate"; CI never calls it |
| A6-14 | Medium | `npm run briefing:sources:verify` **writes** to the database — every other `verify:*` in the repo is read-only |
| A6-15 | Medium | A one-off script does a raw `UPDATE publication`, violating the "only `recordVersion()`" invariant stated absolutely in two documents |
| A6-16 | Medium | 1,283 lines of actively-cited measurement tooling with **no npm entry point** — live capability, invisible |
| A6-19 | Medium | `npm run main:update` deploys Production with no confirmation; its only test asserts the *spelling* of the push command |
| A6-21 | Medium | Ten script-required environment variables in neither `.env.example` nor `docs/environment.md`, including the publish secret and the delete confirmation |
| A6-10 | Low | **Correction to a likely assumption:** Playwright is *not* orphaned — it is the only e2e lane, wired to CI through `scripts/ci-smoke.mjs` |
| A6-17 | Cleanup | Three spent one-way importers (1,217 lines), consistent with ten siblings already pruned |

**Auditor 7 — dependencies, configuration, CI/CD, governance**

| ID | Sev | Finding |
| --- | --- | --- |
| A7-16 | **Critical** | `main` red for five consecutive commits, every one deployed; the smoke test skipped on all five |
| A7-19 | **Critical** | No branch protection, no rulesets, empty environment protection — nothing between `git push` and a Production deploy |
| A7-01 | High | `@types/node@^20` type-checks Node-24 code against a Node-20 stdlib — a silent false-negative in the `verify:full` gate |
| A7-13 | High | 11 `.mjs` scripts (3,793 lines) in **neither** typecheck nor lint, including the smoke gate, the perf gate, and the script that deploys Production |
| A7-17 | High | Every GitHub Action floats on a major tag, `allowed_actions: "all"`, no SHA pinning — in a workflow holding the publish secret |
| A7-20 | High | Secret scanning, **push protection**, Dependabot alerts and security updates all disabled on a public repository |
| A7-25 | High | Public repository, `license: null`, forking enabled — see §G |
| A7-02 | Medium | The Production identity boundary depends on `@neondatabase/auth@0.5.0-beta`, and **every published version is a beta** |
| A7-03 | Medium | `vercel.json` declares a `functions` entry for a route deleted 171 commits ago |
| A7-04 | Medium | Five names read but absent from `.env.example`, including a `required()` secret that throws when unset |
| A7-05 | Medium | `AGENTS.md`'s `.env.example` claim, from the config side |
| A7-08 | Medium | `leva` is a devDependency imported by a production route; the `/particle-demo` redirect does not un-deploy it |
| A7-12 | Medium | Dependency modernization — see §H |
| A7-15 | Medium | `proxy.ts` (Next 16's renamed Middleware) is the highest-privilege file in the repo: unguarded by lint, unlisted in the boundary docs, matcher broader than its logic |
| A7-18 | Medium | A second workflow lives only on the `briefing-packages` branch and has been failing |
| A7-21 | Medium | `perf:report` documented as the CI gate; CI never runs it (with A6-12) |
| A7-06 | Low | **Correction to a repository belief:** `npm ci` is *not* demonstrably broken — 0 drift, 0 unresolvable refs across 1,932 dependency references |
| A7-07 | Low | No `packageManager` pin; three environments can run three npm majors against one lockfile |
| A7-09 | Low | `@shadcn/react` has one consumer, and it is dead code |
| A7-11 | Low | `playwright` and `playwright-core` declared as siblings with independent ranges |
| A7-14 | Low | `strict: true` is on, but `noUncheckedIndexedAccess` is off on a codebase that parses untrusted RSS and indexes evidence arrays |
| A7-22 | Low | `components.json` aliases `hooks` to a nonexistent directory (with A5-13) |
| A7-23 | Cleanup | `.mcp.json` verified clean — no tokens, no machine-specific paths |
| A7-24 | info | Configuration file matrix — every config file, owner, source of truth, state |
| A7-26 | info | Upstream state of the majors, verified against the live registry rather than training data |

**Auditor 8 — `content-packages/**` as a data system**

| ID | Sev | Finding |
| --- | --- | --- |
| A8-05 | High | `ResearchSource.sha256` — documented as "proof the packet held a file" — is empty on **all 269** source rows, while 44 cite a third-party X mirror and only 62 carry an archive URL |
| A8-13 | High | `getCase()`'s bare `catch` turns a corrupted research file into a **silent 404 with CI green**; three of seven cases are named in no assertion |
| A8-02 | Medium | The only integrity artefact (`recordsDigest`) is write-only and hashes **ids, not content** — a truncated record leaves it identical |
| A8-03 | Medium | `languages.json` keys rows `locale` in one package and `code` in the other; the package the contract is named after declares `contract: null` |
| A8-06 | Medium | `https://www.sotwe.com` — a scraper's front page, not a permalink — is cited as a source in five of seven published cases |
| A8-09 | Medium | The importer's fallback reads `.locale`, which october7's rows do not have — a latent silent-corruption path in the script that writes 37% of the repo. Also: `importedAt` is the **only** thing standing between the import and byte-reproducibility |
| A8-14 | Medium | The archive index pages ship ~189 KB / ~272 KB of row props to the client, and no budget covers RSC payload |
| A8-16 | Medium | Five specific test gaps, each a one-assertion fix, all passing against current data |
| A8-19 | Medium | A **fourth content package nobody calls one**: `public/matrix/matrix-fragments.en.json` is served verbatim from `public/`, so its editorial labels, `sourceIds` and 30 `public_actor` entries are publicly fetchable stripped of the rendering that carries the context |
| A8-01 | Low | **Positive, and load-bearing:** every declared count matches; zero dangling media references across 1,027 media rows, 1,175 locale versions and 17,105 blocks |
| A8-04 | Low | ~500 KB written by the importer and read by nothing — keep, but label "carried, not consumed" |
| A8-07 | Low | The held case is the best-sourced one (100% Wayback-captured); the double gate is a recorded decision, but nothing tests that files and index agree |
| A8-08 | Low | All 74 of october7's video thumbnails are unreachable from any record — a third undocumented shape difference |
| A8-10 | Low | `record_count` is supplied by one package, absent from the other, read by nothing |
| A8-11 | Low | `content-packages/` holds two different kinds of object under one name; `importedFrom: "fakeresitenstod"` is the only package-level provenance and is unreadable |
| A8-12 | Low | Both `examples/*.json` are valid against their schemas — and nothing pins that |
| A8-15 | Low | Two records assert `translation_status: "complete"` for a Spanish version whose text is the English text verbatim |
| A8-17 | Low | 14/14 sampled CDN media URLs return 200; the media half is better guarded than the JSON half |
| A8-18 | Low | No archive record or research case is in Postgres or the search index — **`/search` cannot find a single testimony**, and that is nowhere documented |

---
## D. Orphan Candidate Matrix

Built from a 720-module reference graph parsing seven import forms (static,
bare, `export…from`, dynamic `import()`, `require()`, CSS `@import`, CSS
`composes`), resolving `@/*`, relative and index specifiers. Exactly **one**
local specifier in 720 files failed to resolve — a JSON import, out of the
module set by design.

**Before calling anything dead, these non-import consumers were checked for
every candidate:** the 19 Next.js App Router entrypoint conventions (153
`app/**` entrypoints seeded), `next/dynamic` (exactly one site repo-wide,
a static string literal), `React.lazy` (zero), computed `import(var)` (zero),
`package.json` scripts, `vercel.json` `functions`/`crons`, `.github/`,
`docs/**`, tests **including tests that read a file as text rather than
importing it**, barrel re-exports, CSS `composes`, and `git log --follow` /
`git log -S` history.

| File | Size | Direct refs | Indirect consumers checked | Git context | Conf. | Action |
| --- | ---: | --- | --- | --- | --- | --- |
| `app/brand-logo.ts` | 71 KB | **0** — sole hit is its own definition | all clear; no doc, no string, no `public/` fallback | never had an importer in its history | High | **DELETE** |
| `components/graphics/viewport.ts` (whole dir) | 6.5 KB | **0** | `introLayout.ts:17-20` explicitly declines it; `docs/environment.md:244` names it falsely | last consumer removed `bd3dfe3` | High | **DELETE** dir + fix the doc row |
| `components/typographic-field/engine.ts` | 40 KB | **0** imports | read as *text* by `tests/motion-runtime.test.ts:91,202` | unmounted by `dcf4355` | High | **DELETE** with its test |
| `components/typographic-field/TypographicField.tsx` | 4.6 KB | **0** imports | read as *text* by `tests/motion-runtime.test.ts:176` | same | High | **DELETE** with its test |
| `components/typographic-field/stream-generator.ts` | 5.3 KB | 1 — `tests/particle-bank.test.ts:16` | test-only | same | High | **DELETE** with its test |
| `components/typographic-field/dataset.ts` | 280 B | **0** | all clear | same | High | **DELETE** |
| `lib/content/particle-bank.ts` | 15 KB | 2 dead + 1 test | reachable only through the dead cluster | same | High | **DELETE** with cluster |
| `lib/content/home.ts` | 135 ln | 1 test | **edited by `00240da` today** while rendering nowhere | last real consumer removed pre-`b401479` | High | **DELETE** or **DOCUMENT** |
| `lib/content/war-update.ts` | 196 ln | 1 dead + 1 test | its route is now a bare `permanentRedirect` | `00240da` gutted the route | High | **DELETE** with `home.ts` |
| `components/briefs/adapters.ts` | 98 ln | 1 — `lib/content/home.ts` | dead-by-transitivity | — | High | **DELETE** with `home.ts` |
| `components/briefs/geopolitical-reference.ts` | 103 ln | 1 — `adapters.ts` | dead-by-transitivity | — | High | **DELETE** with `home.ts` |
| `components/briefs/InformationWarBeams.tsx` | — | **0** | `docs/performance-budgets.md:118` and `UI-UX-REBUILD-TODOS.md:470` still list it as live | import removed by `00240da` | High | **DELETE** + fix both docs |
| `app/admin/_command/CommandBackground.tsx` | — | **0** | owns `command.module.css` `.field` | orphaned by **HEAD `40806d3`** | High | **DELETE** |
| `components/shadcn/message-scroller.tsx` | 4.0 KB | **0** — 2 hits are prose comments | sole consumer of dependency `@shadcn/react` | added `355ae33` 21:49, replaced `7fd836c` 22:19 **same day** | High | **DELETE** + drop the dep |
| `components/ai-elements/sources.tsx` | 1.9 KB | **0** | `AskDesk` imports the other four ai-elements, not this | added `7fd836c`, never wired | Medium | ⚠️ **owner question** — are Ask citations planned? |
| `components/shadcn/collapsible.tsx` | 795 B | 1 — `sources.tsx` (itself dead) | dead-by-transitivity | same | Medium | ⚠️ **owner question** (with `sources.tsx`) |
| `components/particle-nav/tsl/seededRandom.ts` | 377 B | **0** | four copies of its body exist elsewhere | added `511c9fe`, never imported | High | **KEEP** — make it the one implementation (A2-10) |
| `server/modules/sources/connectors/gdelt.ts` | 143 ln | 1 test | `connectors/index.ts:22-27` documents the deliberate exclusion | — | High | **KEEP** helper, **ARCHIVE** the connector object |

**Categories checked with a nil return** — recorded so they are evidence rather
than omissions: dead CSS Modules (all 58 have importers); unused contracts (all
15 under `server/contracts/` have production importers); unused fixtures (both
`examples/*.json` are referenced); `-old`/`-legacy`/`.bak`/`v2`/`New` filenames
(**zero**); files referenced only in comments (one — `message-scroller`).

**Explicitly KEPT despite looking orphaned:** `server/db/testing.ts` (39 tests,
harness by design); `app/particle-demo/**` (`next.config.ts` redirects it to
`/` outside development and `app/robots.ts:18` disallows it — a documented
decision); `app/pipeline/**` (linked from `OperationsConsole.tsx:78`); the five
identical `app/api/internal/queue/briefing/*/route.ts` files (see §E).

---

## E. Duplicate Matrix

### E.1 Exact byte-identical files

Hashed with `sha256` across `public/ logos/ lionsofzion-essential-logo-pack/
assets/`, extended into `app/` where hashes collided. **12 groups.**

| sha256 (16) | Paths | Size ea. | Referenced by | Canonical | Action |
| --- | --- | ---: | --- | --- | --- |
| `1d39944fda5ef399` | `logos/79eef03d-…png`, `lionsofzion-essential-logo-pack/79eef03d-…png` | 2,106,151 | **nothing** — import deleted `eeb08e5`; only stale prose | — (dead) | **DELETE both** |
| `090e6b6025f4a45e` | `public/icon-512.png` + 2 pack copies | 236,263 | `app/manifest.ts:16` | `public/icon-512.png` | DELETE 2 |
| `d893a12975477f6d` | `public/icon-192.png` + 2 pack copies | 42,843 | `app/manifest.ts:15` | `public/icon-192.png` | DELETE 2 |
| `0a428867eee01b51` | `app/favicon.ico` + 2 pack copies | 7,376 | Next.js file convention | `app/favicon.ico` | DELETE 2 |
| `8ef5d634990d90ef` | `app/apple-icon.png`, pack `apple-touch-icon.png` | 38,032 | Next.js file convention; the app copy **predates the pack by 5 days** | `app/apple-icon.png` | DELETE pack copy |
| 8 × icon SVG pairs | `assets/source/icons/<n>.svg` ↔ `public/emblems/<n>.svg` | ~292 ea. | source → `bake-icons.ts:16`; served → `lib/site-navigation.ts` | **both** — different roles | **GENERATE** the copy (A3-10) |

**Redundant bytes removable at HEAD: 4,823,298 (4.60 MiB)**, 4.21 MB of it the
dead logo pair.

**Near-duplicates investigated and cleared:** `05-app-icon-master.png` vs
`lionsofzion-consent-icon-master.png` (same 1254² canvas, different artwork —
not duplicates); `public/icons/*.sdf.png` vs `public/emblems/*.svg` (a real,
correctly one-way derivative relationship). A repo-wide basename-collision sweep
returned exactly the 12 groups above and nothing further.

### E.2 Duplicated code and duplicated responsibility

| # | Duplicated thing | Sites | Identical? | Boundary excuse? | Action |
| --- | --- | ---: | --- | --- | --- |
| 1 | **Israel-local edition-date key** (`en-CA`/`Asia/Jerusalem`) | **6** | yes, byte-for-byte option objects | 2 of 6 face the lint boundary; **4 have none** | **MERGE** into `server/contracts/` — **A2-08, the one with a production failure mode** |
| 2 | Mulberry32 PRNG | **5** | yes (one commuted, arithmetically identical) | none | **MERGE** into the existing orphan `seededRandom.ts` |
| 3 | Narrative-watch prefix **recogniser** `/^(Reported claim\|Analysis):\s*/` | 2 | yes | none — contracts are importable | **MERGE** into `publication.ts` beside the prefixer |
| 4 | `PIPELINE_STAGES` | **3**, with three different contents | **no** | none | **MERGE** into `contracts/admin-console.ts`; drop the retired `quality` |
| 5 | `ARTICLE_SECTIONS` | **3** | no | intra-`server` coupling (A4-11) | **MERGE** into `server/contracts/`; delete the test that regexes the source file |
| 6 | `CAMERA_FOV` | 2 — **34** vs **45** | **no — different values** | n/a | resolved by deleting the dead one |
| 7 | Nine invariants in `CLAUDE.md` **and** `AGENTS.md` | 2 files | semantically yes | none | **MERGE** per A1-15's ownership split |
| 8 | Queue route bodies | 5 identical files | yes | **yes** — `vercel.json` binds one topic per file path | **KEEP** + document, so the next scan does not re-litigate it |
| 9 | `narrativeWatchTitle()` prefixer | 1 | — | — | **KEEP** — invariant verified true |
| 10 | `cn()` helper, human-readable date formatting | 1 / ~10 distinct presentations | — | — | **KEEP** — not duplication |

---

## F. Documentation Truth Matrix

55 checkable claims across `README.md`, `AGENTS.md`, `CLAUDE.md`, `docs/**` and
`.ai/**`, each resolved against the code or config that owns it. Status:
**TRUE** / **FALSE** (verified wrong) / **STALE** (was true, no longer) /
**PARTIAL** / **UNVERIFIABLE**.

**Headline: 9 of the 17 hard-coded numbers in the documentation are wrong.**
Every one of them is hand-maintained prose.

| Number claimed | Where | Actual | Verdict |
| --- | --- | ---: | --- |
| "fourteen" modules | `CLAUDE.md:95` | **16** | ✗ off by 2 |
| "ten data modules" | `.ai/STATE.md` | **16** | ✗ off by 6 |
| "exactly nine" `PUBLIC_V1` | `CLAUDE.md:193`, `docs/architecture.md` | 9 | ✓ |
| "exactly seven" `PUBLIC_V1` | `docs/api.md:12`, `.ai/DECISIONS.md:475,629` | **9** | ✗ off by 2 |
| "(now 18)" quality checks | `CLAUDE.md:167` | **17** | ✗ off by 1 |
| "eighteen" checks ×6 | `docs/architecture.md`, `docs/data-model.md` | **17** | ✗ off by 1 |
| "17 `REQUIRED_QUALITY_CHECKS`" | `docs/api.md:441` | 17 | ✓ |
| "twelve-name subset" | `CLAUDE.md:165-168` | **mechanism deleted** | ✗ obsolete |
| "~12 routes marked anon" | `CLAUDE.md:198-200` | 12 | ✓ |
| "eight primary destinations" | `README.md:26,33` | **7** | ✗ off by 1 |
| "Four routes undocumented" | `docs/api.md:16` | **~48** | ✗ off by ~44 |
| "93 open items" in `TODOS.md` | `.ai/STATE.md` | **file deleted** | ✗ dangling |
| "59 tables, 48 migrations" | `docs/architecture.md` | **60 tables, 53 migrations** | ✗ |
| "five schedules in `vercel.json`" | `docs/architecture.md` | **4** | ✗ |
| "One connector registered: RSS" | `docs/architecture.md` | **3** | ✗ |
| "66 `/api/**` routes" | `docs/architecture.md` | **104** | ✗ |
| "179 / 335 records, six categories" | `README.md:40-41` | 179 / 335 / 6 | ✓ |
| "five capability grants" | `CLAUDE.md:184` | 5 | ✓ |
| "maxWorkers: 2" | `AGENTS.md:124` | ✓ | ✓ |

**The structural claims, resolved:**

| Claim | Document | Reality | Status |
| --- | --- | --- | --- |
| Publish-gate trigger counts twelve names | `CLAUDE.md:165` | `0049` replaced the function; no count remains | **FALSE** |
| `publications/repo.ts` counts the checks | `CLAUDE.md:166`, `AGENTS.md:112` | `grep` → 0 hits in that file | **FALSE** |
| Deploys must land between 07:00 editions | `AGENTS.md:62-65`, `docs/vercel-infrastructure.md:128` | no briefing cron since `c1e579b` | **STALE** |
| `.env.example` is not in git | `AGENTS.md:143`, `docs/environment.md:14` | tracked since 2026-09-01 | **FALSE** |
| README still says auto-deploy is not connected | `AGENTS.md:71-73` | README is correct and current | **FALSE** — *the note is the stale one* |
| Push to `main` cannot silently publish | `.ai/DECISIONS.md:685` | it can, and does | **FALSE**, unmarked |
| `GET /api/v1/evidence` is anon, RLS not engaged | `docs/api.md:137-140` | staff-only; RLS engaged | **FALSE** |
| `POST /chat/threads` guard = `actor` | `docs/api.md:315,317` | anonymous (in `PUBLIC_V1`) | **FALSE** |
| docs/api.md documents "Every HTTP route" | `README.md:89`, `AGENTS.md` | 56 of 104 | **FALSE** |
| docs/environment.md lists "every variable" | `README.md:91` | ~21 of ~50 | **FALSE** |
| `NODE_ENV` read by `components/graphics/viewport.ts` | `docs/environment.md:244` | reads no `process.env` | **STALE** |
| The journal loads via a `SessionStart` hook | `.claude/skills/sync/SKILL.md` | `settings.json` → `"hooks": {}` | **FALSE** |
| `TODOS.md` is the live list; `docs/archive/` holds the waves | `.ai/STATE.md` | both nonexistent | **FALSE** |
| `SITE_NAVIGATION` is the source of truth for all eight destinations | `README.md:33` | it holds seven; `/war-update` retired | **FALSE** |
| `config.ts` is the only server-runtime env reader | `CLAUDE.md`, `AGENTS.md` | exactly the documented six files | **TRUE** |
| `db/client.ts` exports only `neon-serverless` | `CLAUDE.md`, `AGENTS.md` | confirmed; `neon-http` absent | **TRUE** |
| `emit()` in-transaction; `item.detected` retired with a tombstone | `CLAUDE.md`, `AGENTS.md` | all four sub-claims hold | **TRUE** |
| `evidenceBasis` derived, read `=== "analysis"` | `CLAUDE.md`, `AGENTS.md` | derived at both sites; one `!==` hit, inside the warning comment itself | **TRUE** |
| `narrativeWatchTitle()` is the only prefixer | `CLAUDE.md` | 3 call sites, all through it | **TRUE** (reader half duplicated) |
| `requireCapability()` is called from nowhere | `CLAUDE.md:201` | zero production call sites | **TRUE** |
| `withDatabaseRole` has no test | `CLAUDE.md:209` | still true | **TRUE** |
| `lib/publications.ts` is the single `lib/**` carve-out | `AGENTS.md:76` | sole `eslint-disable` under `lib/` | **TRUE** |
| Source catalog: change the query, change the slug | `AGENTS.md` | history-verified across 3 commits | **TRUE** |
| `PUBLIC_V1` = 9 and everything else fails closed | `CLAUDE.md:193` | 9 entries; all 105 methods wrapped | **TRUE** |
| `vercel.json` declares a `briefing-quality` route that is absent | `.ai/DECISIONS.md:123` | correct | **TRUE** — *correctly documented drift* |

**The pattern.** Drift correlates almost perfectly with **auto-loaded** files.
`CLAUDE.md`, `AGENTS.md` and `.ai/STATE.md` — the three an agent reads without
asking — hold 11 of the 13 false statements found. `docs/**` holds 4 across 12
files and 185 KB. The likely cause is visible in the git history: `docs/**` gets
corrected during focused documentation passes, while `CLAUDE.md`/`AGENTS.md` are
*appended to* during feature work and never re-read end to end.

**A second-order pattern worth naming.** Nine passages across `CLAUDE.md`,
`README.md`, `docs/api.md` and `docs/architecture.md` take the form *"this said
the opposite until &lt;date&gt;"*. The practice is honest and it is why every error
in this audit was findable rather than hidden. But it has a failure mode the
repository has already hit: a correction written as an *annotation about another
file* rots independently of the file it describes. `AGENTS.md:71-73` says
"README still says auto-deploy is not connected — stale"; README was fixed in
the same 2026-09-04 pass, so the note now discredits an accurate document. **The
rule that follows: a correction is applied in the file that was wrong, never
annotated elsewhere.**

---
## G. Missing Files and Missing Infrastructure

Only items with a project-specific justification. A file is not recommended
because it is customary — this repository has one developer, no external
contributors, a public repository and an auto-deploy to Production, and each
verdict is reasoned from those four facts.

| Item | Exists? | Verdict | Why, for **this** project |
| --- | --- | --- | --- |
| **`LICENSE`** | **No** (`license: null`) | **NEEDED** | Public repository, forking enabled, no license. See below — the one item with real legal consequence. |
| **`SECURITY.md`** | No | **NEEDED (five lines)** | Not customary — structural. This is a public repository running a live site that takes public input (`POST /reports`, `POST /volunteer-interest`, four public chat paths) and whose subject makes hostile attention a design assumption. Issues are enabled, so someone finding a hole in `/api/v1/*` today has **no non-public channel** — the obvious one discloses it to everyone at the moment of reporting. Five lines and one contact address closes that. Pair it with enabling private vulnerability reporting. |
| **Dependabot config** | No, and the feature is **disabled** | **NEEDED, narrowly** | Not for npm: 46 direct dependencies, one developer, and manual currency is already good (19 packages exactly at latest). But `package-ecosystem: "github-actions"` is what makes SHA-pinning actions sustainable — it opens a PR only when a pinned action actually moves, a handful per year. Enable Dependabot **alerts** separately; that is a settings toggle, not this file. |
| **Branch protection / required checks** | **No** — 404, no rulesets, empty environment rules | **NEEDED** | The single highest-value missing control in the repository. Without it the CI gate is advisory on a branch that deploys to Production on push. |
| **Secret scanning + push protection** | **Disabled** | **NEEDED** | Free on public repositories. Push protection blocks the push rather than reporting afterwards, which is the difference that matters when the mistake is a pasted key. `.gitignore:78`'s `*.rtf` rule — commented "Loose credential drops (a pasted key file must never reach a public repo)" — is the repository's own evidence that this hazard is not hypothetical. |
| **PR template** | No | **OPTIONAL — mild yes** | Worth it only if repo-specific. Three checkboxes drawn from preconditions this project has already got wrong: (1) migration applied to Preview **then** Production before push; (2) a briefing quality-check change lands between editions; (3) `verify:full` green. `CLAUDE.md` records the first being wrong "twice in one session". A generic template is not worth adding. |
| **`CONTRIBUTING.md`** | No | **UNNECESSARY** | `AGENTS.md` + `CLAUDE.md` already carry far more contribution guidance than any `CONTRIBUTING.md` would, addressed to the actual contributors. A third file would be a third thing to drift. If humans ever contribute, the right version is one line pointing at `AGENTS.md`. |
| **`CODEOWNERS`** | No | **UNNECESSARY** | Its only function is routing review requests. One owner, no required reviews. It would be a file that does nothing. |
| **`CHANGELOG.md`** | No | **UNNECESSARY** | `version: 0.1.0`, `private: true`, zero tags, zero releases; the deploy unit is a commit on `main`. A changelog answers "what changed between the version I have and the version I want" — a question nobody can ask about a continuously-deployed site. `.ai/DECISIONS.md` already holds the *why*, which is the part worth keeping. |
| **Issue templates** | No | **UNNECESSARY** | No external reporter population to shape. Revisit if public bug reports start arriving. |
| **ADR convention** | **Yes — `.ai/DECISIONS.md`** | **EXISTS, keep** | Dated entries with file:line evidence and recorded owner rulings; it is doing the job a `docs/adr/` tree would do, and three findings in this audit resolve by reading it. Its one structural lack is a way to see which decisions have open verification items — A7-03's "PENDING" has been open since 2026-09-04 (A1-14 fixes this with a `Status:` line). |
| **Release / versioning policy** | No | **UNNECESSARY as a file** | The policy exists and is written in three places ("a push to `main` deploys to Production", plus the migration-ordering and between-editions rules). It does not need a document; it needs the documents that contradict it corrected (P2-5). |

### The LICENSE question, stated precisely

The repository is **public**, forking is **enabled**, and `license` is **null**.
That is not a neutral state, and the consequences run in both directions:

- **For the owner, it is maximally protective.** Copyright attaches automatically
  at creation. With no license the owner retains **exclusive** rights: nobody may
  legally copy, modify, distribute or build on this code. Making the repository
  public did not give anything away.
- **For everyone else, they have almost nothing.** The only rights a reader has
  are the ones GitHub's Terms of Service grant to public repositories: **view**
  and **fork within GitHub**. Copying a file into another project is
  infringement, however inviting a public repository looks.
- **The asymmetry is in what it communicates, which is nothing.** The widespread
  assumption that "public on GitHub means open source" is wrong, and it is the
  assumption a reader arrives with. So the likely real-world outcome of the
  current state is that someone copies code believing it is free, and the owner
  is left with a grievance to pursue rather than a boundary that was clear.

**Does the owner want reuse? The repository gives evidence both ways and this
audit cannot settle it.** Against: `private: true`, no publish configuration, no
releases, and content, branding and infrastructure specific to one organisation.
For: the repository was made public deliberately — both `AGENTS.md` and
`CLAUDE.md` state "the repo is public: a push publishes source" as an operating
constraint, which reads as a considered choice about transparency for an
organisation whose credibility rests on being checkable.

**Transparency and reuse are separate goals, and a license is how you get the
first without conceding the second.** Three coherent options:

1. **A proprietary "all rights reserved" notice.** Keeps today's legal position
   exactly and *says so*, so a reader knows where they stand. Zero concession.
   This is the option that matches "public for transparency, not for reuse".
2. **AGPL-3.0.** Permits reuse but requires anyone running a modified version as
   a network service to publish their source — for a counter-disinformation
   project, the option that allows building on the work while making it hard to
   quietly fork the platform into something adversarial.
3. **Apache-2.0.** Maximum reuse, no obligations; preferred over MIT for its
   explicit patent grant and trademark reservation, the latter mattering for a
   named organisation. Only if the owner affirmatively wants the code taken.

⚠️ **Adding a permissive license is effectively irreversible** — anyone who
receives a copy under it keeps those rights for that version permanently. Adding
a proprietary notice, or adding nothing, is fully reversible. That asymmetry is
the reason to decide deliberately rather than by default. **The choice is the
owner's alone**; record it in `.ai/DECISIONS.md` so it is not silently revisited.

---

## H. Dependency Modernization Report

Verified against the live npm registry on 2026-09-05, including
`npm view <pkg> deprecated` for all 38 direct packages: **nothing in this
manifest is deprecated, renamed or superseded.**

**The headline is that the runtime stack is unusually current.** Exactly at
latest: `react`/`react-dom` 19.2.8, `three` 0.185.1, `@react-three/fiber` 9.7.0,
`@react-three/drei` 10.7.8, `drizzle-orm` 0.45.2, `drizzle-kit` 0.31.10,
`@neondatabase/serverless` 1.1.0, `@vercel/blob` 2.8.0, `@vercel/oidc` 3.8.5,
`radix-ui` 1.6.7, `nanoid` 6.0.1, `cmdk` 1.1.1, `class-variance-authority`,
`clsx`, `tailwind-merge`, `leva`, `server-only` — **19 of 46**. The gaps are
concentrated in the toolchain, not the product.

| Package | Current → Recommended | Reason | Breaking risk |
| --- | --- | --- | --- |
| **`@types/node`** | 20.19.43 → **`^24`** | Runtime is Node 24 in `engines`, `.nvmrc`, `.node-version` and all three CI jobs; the **types** are Node 20, and `^20` cannot float across a major. `tsc --noEmit` — the `verify:full` gate — checks Node-24 code against a Node-20 stdlib. | **Medium** — expect new errors on first bump; they are bugs the pin was hiding. **Do this one alone.** |
| `next` + `eslint-config-next` | 16.3.2 → **16.3.4**, together | Two patches behind; the exact-pin pairing is deliberate and correct | Low |
| `zod` | 4.4.3 → **4.5.4** | In range, just not installed. 32 import sites including all of `server/contracts` | Low |
| `tailwindcss` + `@tailwindcss/postcss` | 4.2.1 → **4.3.3**, as a pair | Both exact-pinned and must match | Low |
| `playwright` + `playwright-core` | 1.62.1 → **1.63.0, exact-pinned** | Sibling `^` ranges can drift apart, and the driver protocol between them is version-locked. `next`/`eslint-config-next` is the in-repo precedent for the fix | Low |
| `@electric-sql/pglite` | 0.5.6 → **0.5.8** | Every test runs on it | Low |
| `fast-xml-parser` | 5.11.0 → **5.11.1** | Security-adjacent: it is the parser between untrusted remote RSS and the ingest pipeline | Low |
| `sharp`, `@types/react-dom`, `tsx`, `@vercel/queue` | patches | Routine | Low |
| `nodemailer` | 9.0.5 → **9.1.1** (not 10) | v10 is a major; one import site. Note `@types/nodemailer@8.0.1` **is** the latest — the 8-vs-9 numbering is a DefinitelyTyped artefact, **not drift** | Medium for v10 |
| `ai` + `@ai-sdk/openai` + `@ai-sdk/xai` | 6.0.264 → **6.0.277** now; **v7 is a Medium, not a High** | v7 needs Node ≥22 (have 24) and is ESM-only (already). Its breaking symbols — `experimental_customProvider`, `needsApproval`/`dynamicTool`, `toUIMessageStreamResponse`, `toTextStreamResponse` — **appear in zero of this repo's 9 `ai` import sites**. Residual risk is the system-message change in `core/ai/gateway.ts` and the `tool()`/`ToolSet` shape in `ops-agent/service.ts` | Medium (re-graded down after checking call sites) |
| `lucide-react` | 0.555.0 → **1.41.0, deliberately** | 0.x → 1.0 is the stabilisation release; 10 import sites, and `tsc` finds every icon rename | Low-Medium |
| **`typescript`** | 5.9.3 → **stay on `^5`** | TS 7.0 (the Go rewrite, 8-12× faster) ships **without a stable programmatic API** until 7.1, so typescript-eslint cannot run on it — and `eslint.config.mjs` loads `eslint-config-next/typescript`, i.e. typescript-eslint. Upgrading today breaks `npm run lint`, **the file that holds this project's architecture boundaries as errors**. Note the tsconfig is otherwise already well positioned for the move | **High** — decisive repo-specific blocker |
| **`eslint`** | 9.39.5 → **stay on `^9`** | `eslint-config-next` is exact-pinned and dictates the ESLint major | **High** — a silent rule drop here removes boundary enforcement. Bump only with a before/after diff of the resolved rule set |
| **`vitest`** | 4.1.11 → **defer** | v5 is two days old, and `vitest.config.ts` carries a v4-specific note (`maxWorkers` is "the vitest 4 spelling") whose regression is a 110-failure OOM | Medium |
| `@neondatabase/auth` | 0.5.0-beta → **KEEP** | `dist-tags.latest` **is** `0.5.0-beta`; every published version is a beta. There is no stable to move to — which is the finding, not the version | n/a — see below |

**Sequencing.** Take the whole Low column as **one** patch/minor commit. Then
`@types/node@^24` **alone**. Leave TypeScript 7, ESLint 10, Vitest 5 and AI SDK
v7 as separately scheduled majors. ⚠️ **Do none of it while `main` is red
(A7-16)** — a dependency bump landed on a red gate is unattributable.

**The one dependency finding that is not a version.** `@neondatabase/auth` at
`0.5.0-beta` is the **only** non-stable version string in `dependencies`, and it
is the Production identity boundary: `proxy.ts:16` calls
`neonAuth().middleware()` on every `/admin/*` request. A beta auth SDK carries no
API-stability or security-support commitment, and there is no stable release to
upgrade to. **Keep the exact pin** — widening to `^0.5.0-beta` would be the
mistake — and record in `.ai/DECISIONS.md` that it is exact on purpose, who owns
the upgrade, and that `readGoogleSession()` (`proxy.ts:14`) is the second
admission path to verify standalone before any bump. Read alongside A6-08:
**the production branch of this boundary is also the one no test executes.**

---
## I. Proposed Target Repository Structure

Nothing below has been moved. This is the destination the File Action Matrix
(§J) and the remediation plan (§K) work toward.

The design principle is narrow: **every path should answer "is this live?"
without the reader opening it.** Today the repository root cannot answer that
question for ten of its thirteen markdown files, which is the root cause of
A1-16, A1-21 and most of §F.

```
lions-of-zion/
├── README.md                     public landing page; links, never restates
├── AGENTS.md                     agent entry point: owner authority, commands,
│                                 deploy rules, POINTERS to invariants
├── CLAUDE.md                     every invariant, in full, exactly once
├── DESIGN.md                     the live design authority (visual only)
├── .env.example                  names only, never values (tracked, un-ignored)
│
├── app/                          unchanged — 34 pages, 104 API routes
│   └── admin/
│       ├── layout.tsx            NEW — console fonts, metadata, error boundary
│       └── …                     seven inline sections extracted (A5-02)
├── components/                   unchanged minus two dead directories
│   ├── ui/  shadcn/  ai-elements/    the governed two-system seam — keep
│   ├── graphics/                 ← DELETED (single dead file)
│   └── typographic-field/        ← DELETED (replaced by the video hero)
├── lib/
│   └── content/
│       └── types.ts              NEW — Source, TimelineEntry, Correction,
│                                 Figure; reverses the components→lib inversion
├── server/                       unchanged; 16 modules, both newcomers documented
│   └── contracts/
│       ├── edition-date.ts       NEW — the one Israel-local day key (A2-08)
│       └── publication.ts        + stripNarrativeWatchPrefix() (A2-09/A4-13)
├── scripts/                      unchanged; backup script's default moves OUT
├── tests/                        unchanged
│
├── assets/
│   ├── README.md                 NEW — classifies every subtree and its consumer
│   ├── source/  reference/       bake inputs — keep in git
│   ├── brand/  marketing/        masters — keep, now with a recorded reason
│
├── public/
│   ├── video/                    posters only; the four .mp4 move to Blob
│   └── …                         icons, particles, emblems, manifest icons
│
├── content-packages/             unchanged — 536 files, build-time read
│
├── docs/
│   ├── README.md                 indexes ALL of docs/, not half of it
│   ├── api.md  architecture.md  data-model.md  environment.md
│   ├── operations.md  vercel-infrastructure.md  admin-workspace.md
│   ├── briefing-operations.md  briefing-packages.md  performance-budgets.md
│   ├── briefing-automation.md   ← renamed from GEOPOLITICAL_BRIEF_AUTOMATION.md
│   ├── plans/                    NEW — live, incomplete work
│   │   ├── README.md             one status line per plan: owner, live?, closes-when
│   │   ├── ui-ux-rebuild.md      ← UI-UX-REBUILD-TODOS.md      (69 open)
│   │   ├── briefing-rebuild.md   ← GEOPOLITICAL_BRIEF_REBUILD_TODOS.md (20 open)
│   │   └── cinematic-intro.md    ← fixhomeTODO.md               (33 open)
│   └── audits/
│       └── 2026-09-05-repository-modernization-blueprint.md   ← this document
│
├── project-history/              NEW — finished / superseded; never authoritative
│   ├── 2026-09-homepage-admin-console.md
│   └── 2026-09-graphics-audit/
│       ├── browser-audit.md  mobile-summary.md  systems-plan.md
│       └── prompt-library.md  phase-0-report.md
│
├── .ai/
│   ├── DECISIONS.md              live log, every entry Status-marked
│   ├── DECISIONS-archive-2026-08.md   NEW — entries older than ~30 days
│   ├── STATE.md                  a snapshot again, rewritten not appended
│   ├── WORKFLOW.md  ROLLBACK.md
│
├── logos/                        ← DELETED (every byte exists elsewhere)
├── lionsofzion-essential-logo-pack/  ← DELETED (same)
├── backups/                      ← UNTRACKED; script writes outside the repo now
│
└── (root configs unchanged: package.json, tsconfig.json, next.config.ts,
    eslint.config.mjs, vitest.config.ts, drizzle.config.ts, vercel.json,
    postcss.config.mjs, components.json, proxy.ts, .gitignore, .vercelignore,
    .nvmrc, .node-version, .mcp.json)
```

**Root goes from 13 markdown files (604 KB) to 4 (≈28 KB).** Every remaining
root document is one a tool resolves by literal name: GitHub renders
`README.md`; `next dev` writes and re-creates `AGENTS.md`; Claude Code loads
`CLAUDE.md` by exact path; `DESIGN.md` is small enough to read and is edited
every session.

**The authority hierarchy the structure encodes** — currently four documents
claim authority with no ordering between them:

```
1. The owner's current instruction     overrides everything; stated once, in AGENTS.md
2. Executable gates                    eslint.config.mjs · SQL migrations ·
                                       vitest.config.ts · ci.yml
                                       — these ARE the rules; docs describe them
3. AGENTS.md                           entry point; pointers, not restatements
4. CLAUDE.md                           every invariant in full, once; no dated narrative
5. docs/**                             reference detail; docs/README.md indexes all of it
6. DESIGN.md                           live design authority (visual only)
7. docs/plans/**                       live, incomplete work; status header each
8. .ai/STATE.md                        volatile snapshot; rewritten, never appended
9. .ai/DECISIONS.md                    WHY, dated, append-only, Status-marked.
                                       Never consulted for "what is true now"
10. project-history/**                 provenance. Never authoritative
```

Two rules make the hierarchy hold, and both are drawn from failures found in
this audit rather than from general principle:

- **A number in prose must cite the file that owns it, or be generated.** Nine
  of seventeen hard-coded counts are currently wrong (§F).
- **A correction is applied where the error is, never annotated elsewhere.**
  The "X is stale" annotation pattern produced A1-11 directly, where the note
  outlived the staleness it described and now discredits a correct document.

---
## J. File Action Matrix

Every significant anomaly, with its action and the reason the action is safe.
Actions are `KEEP` / `MOVE` / `RENAME` / `MERGE` / `ARCHIVE` / `DELETE` /
`GENERATE` / `DOCUMENT`. **Nothing in this table has been done.**

### J.1 DELETE

| Path | Bytes / lines | Why safe | Must land with | Finding |
| --- | ---: | --- | --- | --- |
| `logos/` (4 files) | 2.34 MB | Every byte exists elsewhere; the one import was deleted `eeb08e5` | Remove `logos/` from `scripts/perf-report.mjs:294`; fix `docs/performance-budgets.md:259` | A3-04/05 |
| `lionsofzion-essential-logo-pack/` (5) | 2.37 MB | 4 of 5 byte-identical to `logos/`, the 5th to `app/apple-icon.png` | same commit | A3-05 |
| `app/brand-logo.ts` | 71 KB | Zero references of any kind, ever, including strings and docs | — | A2-05 |
| `components/graphics/` (1 file) | 6.5 KB | Dead; `introLayout.ts:17-20` explicitly declines it | Delete `docs/environment.md:244` row | A2-04, A5-05 |
| `components/typographic-field/` (4) | 66 KB | Replaced by the video hero `dcf4355` | **Same commit:** `tests/motion-runtime.test.ts:91,175-199,201-…`, `tests/particle-bank.test.ts`, `lib/content/particle-bank.ts`, `fixhomeTODO.md:58`, `docs/performance-budgets.md:112,145` | A2-01, A5-05 |
| `lib/content/{home,war-update}.ts` + `components/briefs/{adapters,geopolitical-reference}.ts` | 532 ln | Only consumer is one test | **Same commit:** `tests/home-content.test.ts`. **Check first:** `lib/content/october-7.ts` is also imported by `app/october-7/page.tsx` and must stay | A2-02 |
| `components/briefs/InformationWarBeams.tsx` | — | Import removed by `00240da` | Fix `docs/performance-budgets.md:118`, `UI-UX-REBUILD-TODOS.md:470` | A2-02 |
| `app/admin/_command/CommandBackground.tsx` | — | Orphaned by HEAD itself | Also removes `command.module.css` `.field`'s only consumer | A2-06 |
| `app/admin/lexicon.ts:72` `LANE_LABEL` | 1 export | Orphaned by HEAD itself | — | A2-06 |
| 41 CSS classes (17 `admin`, 15 `content`, 5 `command`, 3 `ask`, 1 `live-brief`) | — | Strictest test: the name appears in **no** TypeScript, computed or otherwise | Re-run the extractor after; check `composes:` chains | A2-06/07, A5-07 |
| `components/shadcn/message-scroller.tsx` | 4.0 KB | Zero consumers; its two mentions are prose comments that read better once it is gone | Drop `@shadcn/react` from `package.json` — sequence with Auditor 7 | A2-03 |
| `backups/briefing/*.dump` (9) | 0 KB | Nine zero-byte stubs; `git rm --cached` only | Harden `scripts/backup-briefing-database.sh` in the same commit | A3-03 |
| `docs/api.md:137-140` Gap callout | — | Describes a vulnerability that does not exist | **Confirm first** that `dataClass` filtering is genuinely handled by RLS | A1-06 |
| `AGENTS.md:71-73` | 3 ln | A "README is stale" note that outlived the staleness and now discredits a correct file | — | A1-11 |

### J.2 MOVE

| From | To | Why | Risk | Finding |
| --- | --- | --- | --- | --- |
| `public/video/*.mp4` (4) | Vercel Blob behind `NEXT_PUBLIC_MEDIA_CDN` | 49.4 MB = 46% of the repo, against the project's own archive-media policy; CSP already permits it | **Medium** — homepage LCP path; keep the two posters local; test on Preview | A3-13 |
| `UI-UX-REBUILD-TODOS.md` | `docs/plans/ui-ux-rebuild.md` | 69 open items — live, but not a root document | Strike the "single source of truth" claim; do not read the move as closing them | A1-16 |
| `GEOPOLITICAL_BRIEF_REBUILD_TODOS.md` | `docs/plans/briefing-rebuild.md` | 20 open of 502 | Add the retired-stage banner `docs/GEOPOLITICAL_BRIEF_AUTOMATION.md:2-7` already carries | A1-16 |
| `fixhomeTODO.md` | `docs/plans/cinematic-intro.md` | 33 open; all 10 files it names exist | **Strip the two `/Users/danielsmac` absolute paths** — public repo | A1-16, A1-19 |
| `SITE_URL` | `server/contracts/` or `server/core/config.ts` | The one `server/** → frontend` violation | Add `@/lib/**` to the lint rule in the same commit | A2-13 |
| `Source`/`TimelineEntry`/`Correction`/`Figure` | `lib/content/types.ts` | Reverses the `lib → components` inversion, breaks the cycle | Type-only; caught by `typecheck` | A2-14, A5-08 |
| `ai/service.ts:400`'s `informationItem` update | `items` module | The only cross-module versioned-table write | Threading `changeSource` may alter the recorded `changeSummary` | A4-10 |
| Seven inline sections in `SystemPanel.tsx` | Sibling files | The pattern already exists four times in the same directory | `IncidentsSection`'s six parent closures must move with it | A5-02 |
| The two console fonts | a new `app/admin/layout.tsx` | Declared in the *root* layout because the console has no layout of its own | Verify `tests/english-chrome.test.ts` still passes | A5-16, A5-03 |
| `kicker` / `marginNote` | `app/globals.css` beside `srOnly`/`dataLabel` | Twelve `composes:` reach up to four levels into a component stylesheet; the correct pattern already exists | Mechanical | A5-10 |
| `/api/internal/briefing/` | the `app_service` branch of `accessFor()` | The one write path running outside RLS | **Medium** — may surface a policy gap owner privilege was hiding; Preview first | A4-05 |
| `public/matrix/matrix-fragments.en.json` | `content-packages/narrative-matrix/` | A 134 KB narrative corpus in `public/` is served verbatim, so its `editorialNote`, `sources` and the per-fragment `status`/`sourceIds` — including 30 `public_actor` entries the note says appear "only with documented context" — are publicly fetchable stripped of the rendering that carries the labels. `ScanBackdrop` reads only `text` and `tone`. | Low — the reader already uses an absolute `process.cwd()` path, so it is a one-line change plus the move | A8-19 |

### J.3 ARCHIVE

| Path | To | Why | Finding |
| --- | --- | --- | --- |
| `HOMEPAGE-ADMIN-CONSOLE-TODOS.md` | `project-history/2026-09-homepage-admin-console.md` | 30 of 32 done; both open items are recording tasks already recorded elsewhere | A1-16 |
| `GRAPHICS-BROWSER-AUDIT.md` | `project-history/2026-09-graphics-audit/browser-audit.md` | Historical; self-declares it cannot serve as mobile sign-off; evidence directory is gitignored and absent | A1-13, A1-16 |
| `GRAPHICS-PRODUCTION-PROMPT-LIBRARY.md` | same directory | "Prompt and brief authoring complete. No graphics were created"; no G-ID appears anywhere in the code | A1-16 |
| `GRAPHICS-SYSTEMS-PLAN.md` | same directory | "Status: Planning only" | A1-16 |
| `GRAPHICS-PHASE-0-FUNCTIONAL-REPORT.md` | same directory | Completed; consider promoting its four state machines into `docs/` as real UX reference | A1-16 |
| `MOBILE-GRAPHICS-AUDIT-SUMMARY.md` | same directory | Historical; "complementary audit only" | A1-13, A1-16 |
| `gdeltConnector` (the object, not `parseGdeltResults`) | in place, with a marker | Deliberately unregistered; keep the tested helper | A4-08 |

⚠️ **All six document moves carry the same caution:** archiving must not read as
closing the open items inside them, and every rename breaks inbound links —
`GRAPHICS-PRODUCTION-PROMPT-LIBRARY.md:9-13` and
`HOMEPAGE-ADMIN-CONSOLE-TODOS.md:15` cross-reference siblings by exact name.
The owner should confirm which plans are live before anything moves.

### J.4 MERGE

| What | Into | Sites | Finding |
| --- | --- | ---: | --- |
| The Israel-local edition-date key | `server/contracts/edition-date.ts` (new) | 6 | **A2-08 — the one with a production failure mode** |
| Mulberry32 PRNG | `components/particle-nav/tsl/seededRandom.ts` (the existing orphan) | 5 | A2-10 |
| The narrative-watch recogniser | `stripNarrativeWatchPrefix()` in `contracts/publication.ts` | 2 | A2-09, A4-13 |
| `PIPELINE_STAGES` | `contracts/admin-console.ts`, minus the retired `quality` | 3 | A4-04 |
| `ARTICLE_SECTIONS` | `server/contracts/` — then delete the test that regexes a `.ts` file | 3 | A4-11 |
| The nine duplicated invariants | `CLAUDE.md` in full; `AGENTS.md` becomes pointers | 2 files | A1-15 |
| `requireInternalSecret`'s `!==` comparison | the hash + `timingSafeEqual` helper its two siblings use | 1 | A4-14 |

### J.5 GENERATE

| What | Replaces | Why it is the right answer | Finding |
| --- | --- | --- | --- |
| Route inventory from `app/api/**/route.ts`, diffed against `docs/api.md` in CI | Hand-maintained route list, 56 of 104 covered | The gap is invisible because the file is long and well written | A1-07 |
| Env inventory from `server/core/config.ts` diffed against `.env.example` | Hand-maintained `docs/environment.md`, ~21 of ~50 | Secrets management on a public repo with a Production auto-deploy | A1-04 |
| `public/emblems/*.svg` written by `bake-icons.ts` | Hand-copied SVGs kept in step by nobody | One loop, same inputs; first run is a no-op | A3-10 |
| `_journal.json` ↔ filename-set assertion | Nothing | One line of test closes an entire class of schema/code split | A4-09 |
| zod schemas for the five uncontracted admin responses | `app/admin/briefing-shapes.ts` (105 hand-written lines) | The rest of the console gets its safety from contract parsing; these five get none | A4-15 |
| `assets` budget in `scripts/perf-budgets.json` | Nothing — the file has `bundle` and `runtime` only | 49.4 MB entered `public/` and moved no number anywhere | A3-08 |
| `loading.tsx` for the four DB/content-backed routes | Nothing — zero exist | `SkeletonDesk` already exists and three pages already stream | A5-12 |
| **`knip` in `devDependencies` + `verify:full`** | Nothing detects unreferenced modules | **The single highest-leverage item in this table** — it closes the repository's dominant failure mode | A2-06 |

### J.6 DOCUMENT

| What | Where | Finding |
| --- | --- | --- |
| The publish gate as it now is; the internal pipeline's lack of one | `CLAUDE.md`, `AGENTS.md`, `docs/architecture.md`, `docs/data-model.md`, `tests/briefing-quality.test.ts:274-302` | **A1-01/A4-01** |
| `Status:` on every `.ai/DECISIONS.md` entry; archive >30 days | `.ai/DECISIONS.md` | A1-14 |
| `.env.example` **is** tracked and holds names only | `AGENTS.md:143`, `docs/environment.md:14-15,131,190,262-267` | A1-03, A3-07 |
| Module count 16; `admin-console` as a cross-domain read model; `ops-agent`'s shape | `CLAUDE.md:95`, `docs/architecture.md` | A1-08, A2-16, A4-06 |
| The real deploy constraint, replacing the 07:00 rule | `AGENTS.md:62-65`, `CLAUDE.md`, `docs/vercel-infrastructure.md:128-131` | A1-02 |
| Seven destinations, not eight | `README.md:26-33` | A1-12 |
| `db:migrate` follows the journal; the harness follows filenames | `AGENTS.md`, `docs/data-model.md` | A4-09 |
| Generated artifacts are gitignored; only the generator is committed | `AGENTS.md` + `.gitignore` tripwire | A3-02 |
| Media over ~1 MB is served from Blob, never committed | `AGENTS.md` | A3-13 |
| `assets/` subtree classification and consumers | `assets/README.md` (new) | A3-06 |
| `docs/plans/` status line per plan; `DESIGN.md` named the live design authority | `docs/plans/README.md`, `README.md` | A1-16 |
| The five unlisted `docs/` files; the two unlisted in AGENTS.md | `docs/README.md`, `AGENTS.md` References | A1-18 |
| Intra-`server` module coupling is **not** lint-enforced; the `sources ← briefing` back-edge | `docs/architecture.md` | A4-11 |
| The flat-config shadowing of rules 7 and 8 | `eslint.config.mjs`, at the fix site | A4 §3.1 |
| The five queue `route.ts` files are per-topic bindings, not copies | `app/api/internal/queue/briefing/handler.ts` | A2-11 |
| The drizzle mutual-FK cycle is load-bearing | `server/db/schema/items.ts:58` | A2-15 |
| The `?area=` URL contract | `docs/admin-workspace.md` | A5-03 |

### J.7 KEEP — recorded so a later audit does not re-open them

| What | Why it looks wrong but is not |
| --- | --- |
| Five identical `queue/briefing/*/route.ts` files | `vercel.json` binds one topic per file path; shared logic is already in `handler.ts`. The minimum the platform allows. |
| `server/db/schema/{items,assessments}.ts` mutual import | Drizzle's documented lazy-`references` pattern with the required `AnyPgColumn` annotation. "Simplifying" it creates a module-init-order bug. |
| `components/ui` **and** `components/shadcn` | Not accidental duplication — a deliberate seam with a written cascade-mechanics argument and a `no-restricted-imports` rule enforcing it. **Zero violations.** |
| `components/shadcn/**` lowercase filenames | Upstream's names; `npx shadcn add` regenerates them. 21 of the 23 non-PascalCase components are inside this boundary. |
| `components/particle-nav/**` camelCase modules | An internally consistent sub-convention across the most delicate code in the repository. Renaming 21 files buys nothing. |
| `app/particle-demo/**` | `next.config.ts` redirects it outside development; `robots.ts` disallows it; the decision is recorded. (But see A5-04 — `leva` must be resolved.) |
| `server/modules/sources/connectors/gdelt.ts`'s `parseGdeltResults` | Tested, cheap, and the `gdelt` kind stays legal for legacy rows. |
| `EditorialShell` as a component rather than a nested `layout.tsx` | Documented in `.ai/DECISIONS.md` — the root layout also wraps `/`, `/admin`, `/particle-demo` and `/pipeline`, which must not get the footer. A defensible trade. |
| `app/admin/lexicon.ts` at 606 lines | Being the single home for the Hebrew term dictionary is the file's entire purpose. |
| `components/ai-elements/prompt-input.tsx` at 1,463 lines | Vendored. Splitting it forfeits the next `npx shadcn add`. |

---
## K. Prioritized Remediation Plan

Grouped by what a delay costs, not by effort. Each task names its dependencies
and the order constraint that binds it. **The two hard constraints that shape
the whole plan:**

- **A push to `main` deploys to Production within about two minutes.** Nothing
  here is staged behind a manual deploy step.
- **A schema change must be applied before the code that needs it is pushed** —
  `npm run db:migrate` against Preview, then Production, *then* push.

**Two sequencing rules that come out of the findings themselves:**

- **Do the documentation P0 first, before any code change.** Every subsequent
  task is performed by someone reading `CLAUDE.md` and `AGENTS.md`. Fixing the
  code first means the next contributor is still being told a deleted safety
  mechanism is protecting them.
- **Install the dead-code detector before the deletions, not after.** It is what
  proves each deletion complete and catches the next one; running it afterwards
  only confirms what was already done by hand.

---

### P0 — correctness and production risk

| # | Task | Depends on | Order constraint |
| --- | --- | --- | --- |
| **P0-0** | **Get `main` green, then make the gate binding.** Fix the failing assertions in `tests/state-causes.test.ts` and the page-content tests; then enable branch protection on `main` with `gate` as a required status check. | — | **Before everything, including the rest of P0.** `main` has been red for five consecutive commits and all five deployed to Production; the run for the sixth (`8623e6c`) was still in progress at the time of writing. Until the gate is green *and* binding, no other task in this plan can be verified — a change landed on a red gate cannot be told apart from the red it landed on. |
| **P0-1** | **Rewrite the publish-gate paragraphs** in `CLAUDE.md:163-169`, `AGENTS.md:112-114`, `docs/architecture.md`, `docs/data-model.md` (6 places) and the stale comment at `tests/briefing-quality.test.ts:274-302`. State what is true: the trigger enforces provenance only (post-`0049`); the quality suite runs on the external-publish path only; **the internal pipeline has no quality gate**. Replace every hard-coded count with a pointer to `server/modules/briefing/quality.ts`. | — | **First. Everything else is done by someone reading these files.** Documentation-only, zero deploy risk. |
| **P0-2** | **Answer the owner question P0-1 exposes:** should the internal briefing pipeline call `evaluateCandidate` before `publish`, or should the internal pipeline and its six `vercel.json` queue triggers be retired? | P0-1 | Owner decision. Do **not** bundle the answer into P0-1's commit. If a gate is added, land it when no edition is in flight. |
| **P0-3** | **Fix the `midjrny`/`midjourny` typo** in `.gitignore:81`, `.vercelignore:33` and `tsconfig.json:33` — spelling-tolerant pairs plus root-anchored `/*.mp4`, `/*.mov` and UUID-PNG catch-alls. | — | **Do it today.** ~350 MB is one `git add -A` from a public repository, and the gesture that would do it has already happened once. Additive only; near-zero risk. |
| **P0-4** | **Harden `scripts/backup-briefing-database.sh`**: default the output directory *outside* the repository, and fail loudly on an empty dump (`[[ -s "$dump" ]] \|\| { rm -f "$dump"; exit 1; }`). Then `git rm --cached backups/briefing/*.dump`. | — | Independent. The nine stubs are empty — there is no leak — but the mechanism that would commit a full production dump to a public repo is intact and unchanged. |
| **P0-5** | **Add `/api/internal/briefing/` to the `app_service` branch of `accessFor()`** with identity `service:external-briefing`, matching `/api/internal/codex/`. | — | **Preview first, alone.** Running the publish transaction under `app_service` subjects it to RLS and to the `app_service` publish-gate branch; it may surface a policy gap that owner privilege has been hiding. **Do not batch this with any other change** — if the Preview run fails, the cause must be unambiguous. |
| **P0-6** | **Narrow `getCase()`'s bare `catch` to `ENOENT`** (`lib/content/fake-resistance-cases.ts:309-316`), copying the sibling loader in `archive.ts:202` exactly; and change `allCases()` in `tests/fake-resistance-research.test.ts:36-40` to assert non-null instead of filtering nulls out. | — | Two edits, both trivial, both make a silent path loud. Included in P0 for risk-to-effort, not because anything is broken today: a corrupted `cases/*.json` currently becomes a **404 at build time with `npm run verify:full` green** — and three of the seven published cases have no test naming them, so they can be truncated to zero bytes undetected. On a public site about evidentiary rigour, a research page silently disappearing is the wrong failure mode. |

| **P0-7** | **Turn on the free platform controls:** secret scanning, **secret-scanning push protection**, Dependabot alerts, Dependabot security updates. | — | Settings toggles, minutes of work, free on a public repository. Push protection blocks a pushed credential rather than reporting it afterwards — the difference that matters given P0-3's ~350 MB of unignored scratch and `.gitignore`'s own `*.rtf` "loose credential drops" rule. |
| **P0-8** | **Stop `npm run briefing:compose` from being able to publish.** Either archive `scripts/external-briefing-compose.ts` and its five modules (1,065 lines with no caller, superseded hours after being written), or at minimum remove the `https://lionsofzion.io` default so it cannot publish without an explicit target. | Owner confirms it is not a held-in-reserve fallback | Running it "to see what it does" publishes a machine-composed edition to the production site under the organisation's byline — crossing the exact editorial boundary the surviving workflow's own header says must not be crossed. **Ask the owner before archiving**; git history says superseded, but only the owner knows if it is reserve. |

**Why `A1-14` is P0-adjacent but listed under P1:** `.ai/DECISIONS.md:685` tells
a reader that a push to `main` cannot reach Production. That is false and
dangerous, but four other documents state the truth correctly, so a reader who
checks anything else is safe. It is a one-line `Status:` annotation, and it
belongs with the rest of the documentation pass rather than blocking it.

---

### P1 — architecture and repository integrity

| # | Task | Depends on | Order constraint |
| --- | --- | --- | --- |
| **P1-1** | **Add `knip` to `devDependencies` and to `verify:full`.** | — | **Before every deletion in P1-3.** This is the single highest-leverage item in the audit: `verify:full` is `typecheck && lint && test && build` and none of the four sees an unreferenced module, which is why five of the last dozen commits each left their predecessor in the tree and HEAD ships 23 pieces of residue. |
| **P1-2** | **Merge the Israel-local edition-date key** into `server/contracts/edition-date.ts` and delete all six copies. | — | One commit across four layers. Run `npm run lint` (the boundary rules are lint errors) plus the briefing tests. Land when no edition is in flight. |
| **P1-3** | **Delete the dead clusters**, each with its tests in the same commit: `components/typographic-field/**` + `lib/content/particle-bank.ts` + 3 assertions in `tests/motion-runtime.test.ts` + `tests/particle-bank.test.ts`; `lib/content/{home,war-update}.ts` + 2 adapters + `tests/home-content.test.ts`; `components/graphics/`; `app/brand-logo.ts`; `InformationWarBeams.tsx`; `CommandBackground.tsx` + `LANE_LABEL`; `message-scroller.tsx`; the 41 dead CSS classes. | P1-1 | **The test edits must land in the same commit or the suite goes red.** Check `lib/content/october-7.ts` stays — `app/october-7/page.tsx` imports it too. **Keep** `seededRandom.ts` and make it the one PRNG (A2-10). |
| **P1-4** | **Delete `logos/` and `lionsofzion-essential-logo-pack/`** (4.60 MiB), removing `logos/` from `scripts/perf-report.mjs:294` and correcting `docs/performance-budgets.md:255-262` in the same commit. | — | Independent. `perf-report` will `walk()` a missing directory otherwise. |
| **P1-5** | **Close the `briefing-quality` queue topic.** Check the Vercel queue dashboard for undrained messages; when there are none, delete `vercel.json:49-53` and retire the topic. | Console check | **This is the resolution of the A4-02 ↔ A1-17/A2-12 disagreement (§C.0.2):** the ADR's "don't add and don't delete right now" is a hold pending information, not a judgement that the config is correct. Answer the question, then act. Then tick `HOMEPAGE-ADMIN-CONSOLE-TODOS.md:46`. |
| **P1-6** | **Fix the `server/** → lib/` boundary**: move `SITE_URL` down and add `@/lib/*`, `@/lib/**` to the `server/**` lint rule's group. | — | One import line. The rule addition proves it catches nothing else. |
| **P1-7** | **Un-shadow ESLint rules 7 and 8.** Confirm with `npx eslint --print-config server/contracts/enums.ts`, then merge the denials into the later-winning object. Comment the flat-config semantics at the fix site. | — | The fix should be a **no-op against the tree** — both properties currently hold by discipline — and that is how to verify it. Second time this class has bitten; the config's own comment records the first. |
| **P1-8** | **Add the `_journal.json` ↔ filename-set assertion** as a test, and correct `AGENTS.md`/`docs/data-model.md` on which mechanism each path uses. | — | One line of test closes an entire class of "green tests, absent Production schema". |
| **P1-9** | **Defer the Ask desk**: `dynamic(() => import("./AskDesk"), { ssr: false })` inside `AskDock.tsx`, rendered on first open. Then `npm run build && npm run perf:report -- --update-budgets`. | — | ~4 modules on every route instead of ~35. **Measure before and after** — the byte figure is the one number this audit could not produce. |
| **P1-10** | **Merge the narrative-watch recogniser** into `stripNarrativeWatchPrefix()` in `contracts/publication.ts`; amend `CLAUDE.md:170` to say the *pair* is single-owner, not just the prefixer. | — | Two call sites, one new export. |
| **P1-11** | **Merge `PIPELINE_STAGES`** into `contracts/admin-console.ts` minus the retired `quality`; remove `"quality"` from `briefing/repo.ts:179`. | P0-2 | If P0-2 retires the internal pipeline, this changes shape — sequence after the decision. |
| **P1-12** | **Resolve `leva`**: either move it to `dependencies` or gate `/particle-demo` out of the Production build. | — | Currently the build works only because Vercel installs devDependencies. An `--omit=dev` install becomes a hard build failure on an auto-deploying `main`. |
| **P1-13** | **Move the hero video to Blob** behind `NEXT_PUBLIC_MEDIA_CDN`, keeping the two posters local; add `public/video/` to `.gitignore` once it lands. | — | **Preview first** — homepage LCP path. Stops the bleeding; the 49.4 MB already in history is not recoverable without a rewrite this audit argues against. |
| **P1-14** | **Fix the content importer's latent locale bug**: `scripts/import-archive-package.mjs:243` falls back to `languages.map(l => l.locale)`, and october7's language rows use `code`. Normalise to `l.locale ?? l.code`. | — | It has never fired only because october7's *source* manifest happened to carry a `languages` object. A re-import from a source that omits it writes `[undefined, undefined, …]` into the manifest that renders the archive's language list — in the one script that writes 37% of the repository. |
| **P1-16** | **Bump `@types/node` to `^24`, alone.** | P0-0 | The runtime is Node 24 in five places; the types are Node 20, and `^20` cannot float across a major. `tsc --noEmit` — the gate — has been checking Node-24 code against a Node-20 stdlib. Expect first-run errors; they are bugs the pin was hiding. |
| **P1-17** | **Bring the 11 `.mjs` scripts under a gate**: add `**/*.mjs` to `tsconfig.json`'s `include` (with `checkJs` off, so it costs only syntax and resolution checking), and narrow the ESLint `scripts/**` ignore to enable at least `no-undef`, `no-unused-vars`, `no-empty`. | P0-0 | 3,793 lines in neither gate, of which **340 run in CI** (`ci-smoke.mjs`, `verify-archive-assets.mjs`) and **363 touch Production** — one of them by deploying it (`startup-sync.mjs`). Replace the "same call already made" comment with a real reason: the justification it borrows (vendored code, nested `node_modules`) is false for this directory. |
| **P1-18** | **Pin every GitHub Action to a commit SHA**, starting with `publish-briefing-package.yml` because that is the workflow holding secrets; set the Actions policy off `allowed_actions: "all"`. | P0-7 (Dependabot makes pinning sustainable) | A compromised or re-pointed `actions/checkout@v4` runs in a workflow with access to the credential that can POST a published edition to `lionsofzion.io`. Credit where due: `default_workflow_permissions` is already `read` and PR-approval is off — the hardened settings, which limits the blast radius inside `ci.yml`. |
| **P1-19** | **Test the two boundaries that matter most**: a table-driven `tests/route-guards.test.ts` asserting every route's classification and that non-`PUBLIC_V1` `GET`s refuse anonymously; and cases driving `authenticateAdmin()` through its **production** branch with `neonAuth` stubbed. | P0-0 | Today 13.9% of routes are exercised as handlers and **none of the nine public ones**; and every test that reaches `authenticateAdmin()` takes the development branch — so the assertion "no check can refuse the owner" is proven only about the branch that grants unconditionally. A new route with no table entry then fails the test, which is the property missing today. |
| **P1-20** | **Test `withDatabaseRole`'s reset path.** Give it an injectable pool and assert that after the call resolves **and after it rejects**, a fresh statement on the same connection sees `current_user` back to the owner and `app.identity` empty. | P0-5 | The documented known gap, confirmed worse than documented: two admin tests replace the function with a pass-through. Production uses session-scoped `SET ROLE` on a pooled connection whose isolation depends on `RESET ALL` in a `finally`; the test path uses transaction-scoped `SET LOCAL` + `ROLLBACK`, which gets isolation for free and therefore cannot see a leak. The throwing path is the whole finding. |
| **P1-21** | **Change the five `pnpm` calls in `briefing-predeploy.sh` and `briefing-migrate-preflight.sh` to `npm`.** | — | Re-graded to Medium (§C.0.5) — `pnpm` is installed on this machine so the guards are not currently inert — but the scripts standing in front of a Production migration depend on a tool the repository never declares, installs or locks. On a fresh clone or a CI runner they would fail exactly as filed. |
| **P1-15** | **Make the content import verifiable**: move `importedAt` out of `manifest.json` into a sidecar (or add a `--check` mode that re-imports to a temp dir and diffs everything except it). | P1-14 | `importedAt: new Date().toISOString()` is the *only* non-deterministic value the importer writes — everything else is a pure function of the source. Removing it makes "is this package still the one we imported?" answerable by re-running and diffing, which subsumes the digest problem entirely. |

---

### P2 — documentation and maintainability

| # | Task | Depends on |
| --- | --- | --- |
| **P2-1** | Correct `docs/api.md`: count to nine, add `published-publications` and the undocumented `POST /volunteer-interest`, flip the twelve `anon` rows to `actor` and the two chat POSTs to `anon`, delete the obsolete Gap callout (**confirm `dataClass`/RLS first**) and the redundant preamble, and state the real 56-of-104 coverage honestly. | — |
| **P2-2** | Add `Status: Active \| Superseded by …` to every `.ai/DECISIONS.md` entry, starting with `:475`, `:629`, `:685` and the `:512-576` delegation block. Archive entries older than ~30 days to `.ai/DECISIONS-archive-2026-08.md`. **Annotate; never rewrite an entry's body.** | — |
| **P2-3** | Fix the `.env.example` claims in `AGENTS.md:143-145` and `docs/environment.md:14-15,131,190,262-267`; merge the 22 missing variable names in; delete the `viewport.ts` row at `:244`. | P1-3 (the file is deleted there) |
| **P2-4** | Correct the module count to sixteen in `CLAUDE.md:95` and `docs/architecture.md`; document `admin-console` as a cross-domain read model and `ops-agent`'s shape exception. | — |
| **P2-5** | Replace the obsolete 07:00 deploy rule with the real constraint in `AGENTS.md:62-65`, `CLAUDE.md` and `docs/vercel-infrastructure.md:128-131`. Keep the note that the route's hour-gate survives, so nobody "fixes" the route. | — |
| **P2-6** | Regenerate the ten wrong counts in `docs/architecture.md` and `docs/data-model.md`; extend the migration table past `0047`; re-date the "Verified against the code on…" line. | — |
| **P2-7** | Split `CLAUDE.md` / `AGENTS.md` per the A1-15 ownership rule — AGENTS.md becomes pointers plus the 3-4 highest-consequence rules inline; CLAUDE.md gains the two rules currently orphaned in AGENTS.md (source-catalog slug, `maxWorkers: 2`). | P2-3, P2-4, P2-5 — do the content corrections first, then restructure |
| **P2-8** | Create `docs/plans/` and `project-history/`; move the ten root documents per §I; add `docs/plans/README.md` with a status line each; name `DESIGN.md` the live design authority in `README.md`; strike the "single source of truth" claims from `UI-UX-REBUILD-TODOS.md:11,25`; **strip the two `/Users/danielsmac` absolute paths** from `fixhomeTODO.md`. | Owner confirms which plans are live |
| **P2-9** | Add the five missing rows to `docs/README.md` and two to AGENTS.md's References table. | — |
| **P2-10** | Generate the route inventory and the env inventory, diffed in CI. Rewrite `docs/performance-budgets.md` against measured values and add an `assets` budget to `scripts/perf-budgets.json`. | P1-9, P1-13 (measure after those land) |
| **P2-11** | Write `assets/README.md` classifying every subtree and its consumer; extend `scripts/perf-report.mjs:294` to scan `assets/`. | — |
| **P2-12** | Extract the seven inline sections from `SystemPanel.tsx`; add `app/admin/layout.tsx` and move the two console fonts into it. | — |
| **P2-13** | Reverse the `lib → components` type inversion: `lib/content/types.ts` holds `Source`, `TimelineEntry`, `Correction`, `Figure`. | — |
| **P2-14** | Add `loading.tsx` to the four DB/content-backed routes using the existing `SkeletonDesk`. | — |
| **P2-15** | Document what is deliberate so a later audit does not re-open it: the five queue route files, the drizzle mutual-FK cycle, the two primitive systems, the `?area=` URL contract, intra-`server` coupling not being lint-enforced, and that `content-packages/` is deliberately outside the search index. | — |
| **P2-16** | **Decide the LICENSE question** (§G) and record it in `.ai/DECISIONS.md`. Add a five-line `SECURITY.md` with one contact address, and enable private vulnerability reporting. | Owner decision | A permissive license is irreversible; a proprietary notice and "no license" are not. Decide deliberately rather than by default. |
| **P2-17** | **Give the UI measurement tooling an entry point**: add `audit:ui`, `audit:interaction` and `capture:design` npm scripts, and a paragraph in `docs/operations.md`. | — | 1,283 lines that measure real geometry, real computed colour, real focus rings and real touch targets — the things the vitest suite structurally cannot (A6-01) — currently invoked by typing a path remembered from a TODO document. Their exit codes were already written to gate CI; only the wiring is missing. |
| **P2-18** | **Add the second test lane the suite lacks**: a vitest project with `environment: "jsdom"` scoped to `tests/dom/**`, seeded with the interactions that would have caught the three recorded CSS incidents. Do **not** convert the 27 source-text tests — they are cheap and they work. | P0-0 | There is no DOM anywhere in the suite; a `useEffect` that never cleans up, an `aria-pressed` that never flips, or a dialog that traps focus wrongly passes every test in this repository. |
| **P2-19** | **Fix the tautological skip**: either teach `freshDatabase()` to use `TEST_DATABASE_URL`, or state plainly in all four documents that the semantic search arm is untested. Delete the dead `testDatabaseUrl()` export either way. | — | Today the one skipped block contains a single assertion, and it asserts its own skip condition — so four documents describe a remedy that cannot work as written. |
| **P2-20** | **Add the five content-data assertions** (manifest counts beyond `.records`, digest recomputation, `media_relations` resolution, cases↔index set equality) and widen `recordsDigest` to hash record **bytes**. | P0-6 | All five pass against current data; each is roughly one assertion. Together they are the only thing that would stand between a corrupted package and a Production deploy. |
| **P2-21** | **Rename `briefing:sources:verify`** to `refresh`, or give it an `--apply` flag defaulting to report-only. Add the ten undeclared script environment variables to `.env.example`. | — | Every other `verify:*` in the repository is read-only; an operator reaching for a "verify" command reasonably expects it is safe to run against anything. |

---

### P3 — cleanup and polish

| # | Task |
| --- | --- |
| **P3-1** | Merge the five Mulberry32 copies into `seededRandom.ts` (verify identical output for a fixed seed first — one copy has commuted operands). |
| **P3-2** | Move `kicker`/`marginNote` to `app/globals.css`; switch the twelve `composes:` sites to `from global`. |
| **P3-3** | Promote `"loz:editor-open"` and `"loz:discard-editor"` to exported constants beside the two that already are. |
| **P3-4** | Resolve the barrel conventions: either delete the `ui`/`live` barrels or correct their docblocks. Change `AskDesk.tsx:41` to a deep motion import regardless. |
| **P3-5** | Merge `requireInternalSecret`'s `!==` into the `timingSafeEqual` helper its two siblings use. |
| **P3-6** | Add zod contracts for the five uncontracted admin responses; delete `app/admin/briefing-shapes.ts`. |
| **P3-7** | `git rm --cached` the `logos/` entry in `perf-report.mjs` if not done in P1-4; prune the six dead `.vercelignore` entries; add `assets/` and `backups/`. |
| **P3-8** | Generate `public/emblems/*.svg` from `bake-icons.ts` instead of hand-copying. |
| **P3-9** | Move `ai/service.ts:400`'s versioned write into the `items` module. |
| **P3-10** | Archive the `gdeltConnector` object, keeping `parseGdeltResults`; add the marker comment. |
| **P3-11** | Document or comment `publication.quality_approved_at` as retired; drop the column in a later migration. |
| **P3-12** | Rename `app/admin/console-primitives.tsx` to PascalCase (14 imports) — or accept it and record the decision. Do **not** touch `components/shadcn/**`. |
| **P3-13** | Point `components.json`'s `hooks` alias at a directory that exists. |
| **P3-14** | Decide on a formatter. **Not inside another change** — it rewrites ~450 lines and buries the real diff. |
| **P3-15** | Owner's call: delete the 34 Codex tree refs (~348 MB local, remote unaffected) after confirming Codex does not need those checkpoints. |

---

### The order in one line

**P0-0 (green + binding gate) → P0-1 (docs) → P0-3 (typo) + P0-4 (backup script)
+ P0-6 (getCase catch) → P0-5 (RLS, alone, Preview first) → P1-1 (knip) →
P1-3 (deletions) → everything else.**

P0-0 comes first because nothing after it is measurable until it lands. P0-1
comes second because every subsequent task is performed by someone reading
`CLAUDE.md` and `AGENTS.md` — and this audit contains its own proof that a stale
line there propagates: one of the eight auditors repeated `AGENTS.md`'s false
`.env.example` claim rather than checking it (§C.0.2). P0-3, P0-4 and P0-6 are
same-day and carry no deploy risk between them. P0-5 is the one behaviour change
that must travel alone. P1-1 before P1-3 is the difference between cleaning up
once and building the thing that keeps it clean.

---
## L. What this audit could not verify

Recorded so that no reader mistakes an absence of evidence for evidence of
absence. Grouped by *why* it could not be checked, because the reason determines
who can close it.

### L.1 Blocked by the read-only rule (a build, a test run, or a server)

| Question | Why | Who closes it |
| --- | --- | --- |
| Actual bundle bytes for A5-01, A5-09, A5-16 | `npm run build` and `perf:report` were forbidden; `perf:report` reads `.next` | Whoever acts on A5-01 — **measure before and after** |
| Whether the import graph matches what Next.js actually bundles | Route-level bundle contents are inferred from imports, not measured | Same |
| The exact page count under `/october-7` (README's "~1,177") | Needs a build; base records verified at 179 + 335 = 514, locale expansion not computable statically | A build |
| LCP impact of moving hero video to Blob (A3-13) | Needs `npm run build` + a running server | A Preview deploy |
| Whether `/particle-demo`'s Production build actually includes `leva` | Inferred from the import and the devDependency declaration | A build artifact |
| Whether the 24/41 dead CSS classes are unreachable at runtime | Both extractors are static; a `styles[variable]` lookup would defeat both. No template-literal class construction was found in `app/admin` | A runtime check, or accept the static evidence |
| Whether `npm ci` currently succeeds | Running it mutates `node_modules`, which is a **symlink into the main checkout** — forbidden and actively destructive here | Auditor 7 / a clean clone |

### L.2 Blocked by external access

| Question | Why | Who closes it |
| --- | --- | --- |
| Whether `vercel.json`'s unmatched `functions` pattern fails a Vercel build | No project/team id available read-only. 171 commits have landed on an auto-deploying `main` since the route was deleted — circumstantial evidence that builds still pass | The Vercel dashboard |
| Whether a `briefing-quality` queue topic exists in Production with undrained messages | No console access. **This is the gate on A1-17/A4-02** — the deletion is correct once the answer is "none" | The Vercel queue dashboard |
| Queue / AI-Gateway OIDC / Google WIF bindings | Marked PENDING in `.ai/STATE.md` since 2026-09-04; this audit confirms the *documentation* status only | The Vercel console |
| Production database credentials claim | Would require Vercel/Neon API calls | — |
| Whether the internal briefing pipeline is still used in Production | `runStage`, six queue triggers and `POST /api/v1/admin/briefing/run` are all still wired, but there is no run history here. **This changes how urgent A4-01's unguarded path is** | Production logs |
| GitHub branch protection, required checks, secret scanning, Actions permissions | See Auditor 7's report — a manual UI checklist is provided there for whatever `gh api` could not read | The owner, in the GitHub UI |

### L.3 Genuinely undecidable from the repository — owner questions

These are not gaps in the audit. They are decisions the repository does not
record, and no amount of reading will produce them.

| Question | Why it cannot be inferred |
| --- | --- |
| **Should the internal briefing pipeline have a quality gate, or be retired?** | Migration `0049` says "Quality-review stage retired by owner instruction". Whether that intended *no gate on any path* or *no gate on the external path only* is not written anywhere. **The most consequential open question in this audit.** |
| Are Ask-desk citations planned? | `components/ai-elements/sources.tsx` and `shadcn/collapsible.tsx` were installed and never wired; `components/ask/CitationList.tsx` does a similar job by another route |
| Should `assets/brand/` and `assets/marketing/` (24.5 MB) be kept? | Proven code-unreferenced; two documents say "never redraw with an image model", and both are archival candidates |
| Which of the five plan documents are live? | `DESIGN.md` is edited every session and behaves as the live one; `UI-UX-REBUILD-TODOS.md` claims exclusivity and has 69 open items |
| Is offering the retired `war_update` section to a human editor intended? | `app/admin/EditorialDesk.tsx:329` still offers it in a `<select>`; plausibly deliberate for archive edits, recorded nowhere |
| Are the 34 Codex tree refs (~348 MB local) safe to delete? | They are Codex's own checkpoint store; its retention contract is not documented in this repository |
| Should the repository carry a LICENSE? | See Auditor 7 — it is public with no license, which means default exclusive copyright. The choice is the owner's |

### L.4 Deliberately not attempted

- **`recordVersion()` as the *only* write path to versioned tables** was verified
  by inspection of all six versioned tables and every `.update(` site in
  `server/**` — one violation found (A4-10) — but not by exhaustive proof.
- **Column-level drizzle drift**: `npm run db:generate` writes a file, so it was
  skipped. The two checkable proxies are clean — table names and enum values in
  `meta/0052_snapshot.json` match `server/db/schema/**` exactly.
- **That ESLint rules 7/8 are shadowed** follows from flat-config semantics and
  the config's own recorded history, but was not proven by constructing a
  violating import, which would mean writing into the repository.
  `npx eslint --print-config server/contracts/enums.ts` closes it in seconds.
- **Symbol-level dead exports beyond the frontend**: the export scan reports 174
  files with an unused export, but it is token-based and over-reports (`*Props`
  types, drizzle `New*` insert types, `*Repo` interfaces are legitimate typing
  surface). Only hand-confirmed cases were escalated. A real sweep needs `knip`
  or `ts-prune` — which is J.5's highest-leverage recommendation anyway.
- **Visual equivalence of the two primitive systems** — explicitly out of scope.
  This audit takes `eslint.config.mjs`'s cascade argument at its word.

---
