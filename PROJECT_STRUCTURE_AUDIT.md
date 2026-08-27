# Project structure audit

**Baseline** `f8f84ce` (merged PR #16) · **audited** 2026-08-27 · **1,019 tracked
files, ~24 MB** · branch `codex/project-structure-audit`.

Five parallel read-only passes, one per surface, with no overlapping boundary:
frontend (`app/` minus `app/api/`, `components/`), backend (`server/`,
`app/api/`), content and data (`content-packages/`, `lib/`), documentation
(everywhere it lives), and infrastructure (`tests/`, `scripts/`, `.github/`,
`public/`, `assets/`, root config). Every "nothing references this" claim below
distinguishes **proved absent** (resolved import graph or exhaustive grep across
all seven source trees) from **not found** — the two are not the same and are
marked differently.

## Verification at the baseline

| Check | Result |
| --- | --- |
| `npm run typecheck` | pass |
| `npm run lint` | pass, zero problems |
| `npm test` | **397 passed, 1 skipped**, 27 files |
| `npm run build` | pass, ~1,190 routes prerendered |
| Relative markdown links | **77 checked, 0 broken** after the moves |
| `git ls-files -i -c --exclude-standard` | empty — nothing ignored is tracked |

The one skip is deliberate: `tests/search.test.ts` gates its semantic arm on
`hasVectorDatabase()`, and PGlite has no pgvector.

---

## Classification by area

Categories: **active-essential**, **source-of-truth**, **supplementary-doc**,
**archive-candidate**, **generated-or-cache**, **local-only**,
**active-misplaced**, **duplicate-or-stale**, **unclear-keep**.

### Application code

| Path | Files | Role | Proved usage | Classification | Decision | Done | Conf |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `app/` | 97 | Every route; folder name is the URL | 13 content routes + `app/api` 44 + `admin` 5 + `auth` 3; all file-convention entry points | active-essential | Do not reorganise — a move renames a live URL | none | high |
| `app/admin/**` | 5 | Hebrew ops dashboard behind Neon Auth | Sole consumer of `GET /api/v1/admin/status` | active-essential | Was absent from `CLAUDE.md`'s map | **documented** | high |
| `app/auth/x/**` | 3 | Public X OAuth begin/callback/signout | Reached from `XPublicAuthControl`, mounted on every route | active-essential | Absent from every doc; shipped with no ADR entry | **documented; ADR still owed** | high |
| `components/` | 97 | Ten feature directories | Import graph resolved; zero unresolved specifiers repo-wide | active-essential | Keep | none | high |
| `components/particle-nav/` | 36 | The single R3F scene, DOM links, LNP1 codec | Every file has ≥1 importer | source-of-truth | Keep | none | high |
| `components/graphics/viewport.ts` | 1 | 472-line contract for the **retired** photographic scene (34°/10u; live scene is 45°/8.2u) | Only importer is `tests/composition-fit.test.ts`, which uses 9 pure symbols. `Viewport` class never instantiated. `window.__lionFit` has **one writer, zero readers** | duplicate-or-stale | Splitting it is a judgement about whether a test for a retired scene is worth keeping | **deferred to owner** | high |
| `components/{AskAboutFileCta,BriefError,SensitiveContent}` | 3 | Component surface with zero render sites | Proved absent from the app graph — but all three are published members of the `.design-sync` bundle, and each carries a written retention rationale | unclear-keep | **Keep.** Deleting silently breaks the DS export map | none | high |
| `lib/` | 15 | The frontend's content seam | All 15 reachable; four dead exports inside live modules | active-essential | Keep | none | high |

### Backend

| Path | Files | Role | Proved usage | Classification | Decision | Done | Conf |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `server/contracts/` | 11 | zod-only, RSC-loadable | Frontend imports exactly one symbol (`AssessmentValue`) plus two chat types | source-of-truth | Keep | none | high |
| `server/core/` | 14 | config, versioning, outbox, audit, auth, AI gateway | `config.ts` is the only application-runtime `process.env` reader — verified | source-of-truth | Keep | none | high |
| `server/db/` | 60 | schema, 21 migrations, PGlite harness | `tests/migrations.test.ts` asserts journal↔file parity | source-of-truth | Keep | none | high |
| `server/db/migrations/meta/` | 19 | drizzle snapshot baselines | **Stop at `0017`** while the journal has 21. `0017_snapshot.json` records `ai_run.cost_usd` as `numeric(12,6)`; the schema and `0020` say `(16,9)` | generated-or-cache, stale | The next `db:generate` will re-emit that ALTER as `0021` | **flagged, not run** | high |
| `server/modules/` | 36 | **Eleven** modules (docs said ten) | All reachable from routes | active-essential | `public-x-auth` is a facade with no service/repo — a documented shape deviation | **documented** | high |
| `server/modules/{publications,reports}/` | — | Inline `repo()` in the service, no `repo.ts` | Breaks the shape the other nine follow | active-misplaced | Pure code motion, but it is code motion in the backend | **deferred** | high |
| `app/api/` | 44 | Route handlers | All 5 `vercel.json` cron/queue paths resolve to handlers | active-essential | Keep | none | high |

### Content and data

| Path | Files | Role | Proved usage | Classification | Decision | Done | Conf |
| --- | --- | --- | --- | --- | --- | --- | --- |
| `content-packages/october7/` | 185 | 179 records / 505 language versions | 506 prerendered pages; 0 dangling media refs, 0 orphan media | source-of-truth | **Never delete** — committed primary source | none | high |
| `content-packages/hamas-massacre/` | 341 | 335 records / 670 versions | 671 pages; all media `validation_status: ok` | source-of-truth | Never delete | none | high |
| `content-packages/fake-resistance/` | 9 | 7 cases + index + network | 10 pages; index counts match file counts exactly | source-of-truth | Never delete | none | high |
| `…/translation-links.json`, `languages.json` | 4 | 500 KB of hreflang provenance | **Proved absent**: no reader anywhere. hreflang is built from `available_languages` instead | source-of-truth | **Keep.** Irreplaceable crawl provenance from an external pipeline; 500 KB of 14 MB | none | high |
| `content-packages/october7/categories.json` | 1 | 3 real categories, all 179 filed | `getCategories()` is only ever called with the *other* package | source-of-truth | Keep — retained source data, an unrealised axis | none | high |

Zero id overlap and zero title overlap between the two archives. No raw
`evidence/**` pull, `analysis` field or harvest payload is committed — verified
by key enumeration across all seven case files.

### Documentation

| Path | Role | Status | Classification | Decision | Done |
| --- | --- | --- | --- | --- | --- |
| `CLAUDE.md` | The invariants an editor must not break | Self-contradicted on provisioning across 54 lines; wrong on RLS, script count, route count, publication gate; missing two `app/` subtrees | source-of-truth | Rewrite the wrong claims in place | **done** |
| `.ai/DECISIONS.md` | The ADR log, append-only | Clean, except two entries now false with no reversal appended | source-of-truth | Append, never edit | **entry added** |
| `.ai/STATE.md` | Where the work stands | Described an in-flight merge on a branch that no longer exists; 3 commits behind | source-of-truth | Rewrite in place | **done** |
| `docs/architecture.md` | System map and known gaps | Gap 1 false; gap 3's stated cause retired; migration count wrong | source-of-truth | Correct; lift the audit's structural conclusions in | **done** |
| `docs/api.md` | Route table | Said the API is unreachable; ~12 routes mislabelled `anon`; 4 routes undocumented | source-of-truth | Correct the premise and the guard note | **done** |
| `docs/operations.md` | Install, verify, CI, deploy | Three troubleshooting entries describe conditions that no longer hold; two counts wrong | source-of-truth | Correct | **done** |
| `docs/data-model.md` | Tables, triggers, RLS | "18 numbered migrations" — there are 21 | source-of-truth | Correct | **done** |
| `docs/environment.md`, `vercel-infrastructure.md` | Env names; deployed record | Verified accurate against the code | source-of-truth | Keep | none |
| `docs/fake-resistance-integration.md` | The research integration | **"The repo is private"** — the premise of its safe-to-merge argument. It is public | active-essential | Correct, and state the consequence | **done** |
| `.ai/ROLLBACK.md` | Undoing a bad deploy | Cited `STATE.md` for a claim `STATE.md` refuted | active-essential | Correct — the section is *more* relevant now | **done** |
| `TODOS-design-audit.md` | The audit task list | **83 of 83 closed, 0 open, orphaned** | archive-candidate | Archive, after lifting its refusals | **moved** |
| `docs/design-audit-2026-08-26.md` | 219 KB evidence report | Task list closed; 40% of the doc surface by bytes | archive-candidate | Archive, after lifting its 3 structural conclusions | **moved** |
| `docs/graphics-task-02.md` | 2026 nav-layer spec | Already self-banner-marked HISTORICAL | archive-candidate | Archive | **moved** |
| `.codex/…/REPORT.md` | External design review | Orphaned; superseded on both axes; 12 evidence images never committed | duplicate-or-stale | Archive; neutralise the image links | **moved** |
| `docs/engine-explainer.html` | Hebrew interactive backend explainer | Standalone, no stale numeric claims | supplementary-doc | Keep | none |

### Infrastructure

| Path | Files | Role | Status | Classification | Decision | Done |
| --- | --- | --- | --- | --- | --- | --- |
| `tests/` | 27 | vitest against PGlite | 397 pass / 1 skip; **43/43 imports resolve** | active-essential | Keep | none |
| `scripts/` | 15 | verify, import, bake | **Zero unreferenced.** Five hardcode macOS Chrome | active-essential | Correct the counts in every doc that states them | **done** |
| `.github/workflows/ci.yml` | 1 | gate + headless smoke | Matches reality | source-of-truth | Keep | none |
| `public/` | 15 | Baked particle/icon/poster output, typeface, scan corpus | **Every file resolves to a literal path in code.** Bake output verified current: `sha256(reference.png)[0:16] = d447447c6fff5b3a` matches the LNP1 header in all three `.bin` | generated-or-cache (committed by design) | Never rename — loaded by literal path | none |
| `assets/` | 9 | Bake sources — **and runtime imports** | The 2.4 MB reference PNG and the 8 icon SVGs are imported by React components; `assets/` ships | source-of-truth | Keep | none |
| `.claude/hooks/check-story-timeline.mjs` | 1 | 4 intro invariants | **Check 3 was dead**: `SCENE` pointed at a file deleted when the renderer was unified, and the regex required double quotes where the code uses single | active-misplaced | Repair both, make an unreadable SCENE loud | **done, proved by a blocking run** |
| `.claude/skills/verify-intro/capture.mjs` | 1 | Intro frame capture | End-detection waits for `canvas.length === 1`, which the single-canvas invariant makes a constant | active-misplaced | No pass/fail, so cosmetic — but it burns 50 s on every healthy desktop run | **deferred** |
| `.gitignore` | 1 | — | **Missed `.claude/worktrees/`**, excluded only via per-clone `.git/info/exclude`; root-anchored rules do not match inside a worktree | active-essential | Add it | **done** |
| `.vercelignore` | 1 | — | Missed `.claude/` and `.DS_Store`; `public/.DS_Store` was on disk and deployable at `/.DS_Store` | active-essential | Add both; delete the files | **done** |
| `tsconfig.json` | 1 | — | Excluded only `node_modules`, so local typecheck covered 21 files in gitignored `ds-bundle/` that CI never sees | active-essential | Widen `exclude` | **done** |
| `package.json` | 1 | 14 scripts | **No dead scripts.** Two dead devDeps: `puppeteer-core` (7.9 MB), `dotenv` | source-of-truth | Remove both | **done** |
| `.design-sync/` | 31 | DS export pipeline; 2 docs, 26 source, 3 config | Only consumer of two unmounted components | local-only tooling | Keep; correct its one stale claim | **partly** |
| `vercel-infrastructure-costs.html` | 1, untracked | Duplicates the cost table | **Not gitignored** — one `git add .` publishes it to a public repo | local-only | **Owner decision** — deliberately left untracked and un-ignored rather than choosing for you | **flagged** |

---

## Sources of truth, one per topic

| Topic | Owner | Notes |
| --- | --- | --- |
| Invariants | `CLAUDE.md` | Corrected |
| Why | `.ai/DECISIONS.md` | Append-only; never archived |
| Where the work stands | `.ai/STATE.md` | Rewritten |
| Architecture | `docs/architecture.md` | |
| API | `docs/api.md` | 4 routes still undocumented |
| Data model | `docs/data-model.md` | **Migration counts belong here only** — they were duplicated into 4 files, 2 of them wrong |
| Environment | `docs/environment.md` | `vercel-infrastructure.md` keeps a second, incomplete copy of the variable list |
| Operations | `docs/operations.md` | The verification table lives here; `README` and `CLAUDE` carry commands and point here |
| Deployment | `docs/vercel-infrastructure.md` | |
| Design system | `.ai/DESIGN-V2.md` | Healthy hub-and-spoke; no drift found |
| Delivery plan | `TODOS.md` | |
| Repository shape | `docs/PROJECT_MAP.md` | New |
| History | `docs/archive/README.md` | New |

---

## Decisions taken

**Conservative where proof was incomplete.** Nothing under `content-packages/`
was deleted or archived — it is primary source material whose external pipeline
lives outside git. `sampleLion()` was annotated rather than deleted: it is a
retained pipeline, and the defect was the comment claiming a `pnpm bake:lion`
script that does not exist. The three unmounted components were kept because
each is a published member of the design-system bundle. `.codex/` lost its one
orphaned file and its now-empty directory skeleton was left alone.

**Nothing was force-deleted to make a number look better.** Four files moved to
`docs/archive/`; four were removed (`.DS_Store` × 5, two npm packages); one
false comment line was deleted.

## How complete is this, honestly

**No file was read one by one.** 1,019 tracked files were audited as five
surfaces, each agent building an import graph and a classification table for
its area rather than opening every file. That is the right method for code —
a resolved graph proves more than 1,019 readings would — but it has a gap, and
the gap was found by being asked rather than by the audit.

Two whole-tree checks now run on every `npm run map`, so the question stops
being a matter of assertion:

| Check | Result |
| --- | --- |
| Byte-identical duplicates across all 1,019 files | **0** — every file has distinct content |
| Reachability from an entry point | **988 of 1,019**; 31 reached by nothing |

The 31 split into three groups, none of them junk:

1. **`.design-sync/` — 29 files. This is the gap the audit missed.** Both the
   documentation and the infrastructure agents explicitly deferred it: the
   first owns documents and found only two here, the second was scoped to
   `.claude/` and the root. So 26 source files went unexamined, and nobody
   noticed until the question was put directly.
   Examined now: the area is internally coherent and its 20 referenced source
   paths all exist. But **nothing in this repository invokes it** — no npm
   script, no CI step, and only two commits have ever touched it. Its driver is
   the external design-sync tool, so an absent in-repo reference does not prove
   it is dead. `config.json` and `tsconfig.sync.json` do reference the four
   shims. **The 21 files in `previews/` are referenced by nothing at all** — not
   by `ds-entry.ts`, not by `config.json`, not by any tracked file. Verified as
   *no reference exists*, not *none found*: zero files anywhere import from
   `previews/`. Classification: `unclear-keep`, because the tool that would use
   them lives outside the repository.
2. **`components/briefs/BriefError.tsx` and `components/sections/AskAboutFileCta.tsx`
   — 2 files.** Already known, already documented, deliberately retained: each
   carries a written rationale and each is a published member of the
   design-system bundle.
3. **`.claude/skills/verify-intro/capture.mjs`** — invoked from the command
   line and documented in two places. A limit of the graph, not an orphan.

What this does *not* prove: that no two documents overlap in substance, that no
archive record duplicates another's meaning, and that every one of 1,019 files
is individually justified. Byte-identical duplication is settled; semantic
duplication was checked where it was checkable — the two archives share zero
ids and zero normalised titles, and the documentation surface was read in full
— and asserted nowhere else.

## Decided 2026-08-27, and applied

| Item | Decision | Result |
| --- | --- | --- |
| The Fake Resistance publication gate | Make the flag real | `isPublishable()` checks both gates for both callers. `EDITORIAL_STAGE = 'held'` now withdraws every case — index, sitemap and `generateStaticParams` included. Two tests pin it; both verified to fail against the old code. |
| `/admin` and `/auth` crawlable | Close it | Added to `robots.ts` `disallow`. |
| CI blind to the no-JavaScript invariant | Add a Linux-safe guard | `ci-smoke.mjs` gained a `javaScriptEnabled: false` check on the home route (8 links, poster, no hidden Suspense shell); `tests/no-js-invariant.test.ts` is the fast tripwire. Both verified against a real server and a reintroduced `loading.tsx`. |
| `vercel-infrastructure-costs.html` | Ignore it | Added to `.gitignore`. |

## Declined 2026-08-27 — recorded so they are not rediscovered

Each was raised and deliberately left. Re-raising them costs a session.

1. **`requireCapability()` is never called.** Capability enforcement stays inert;
   capabilities feed only the `evidence_staff_restricted` RLS policy. Wiring it
   into routes could block operations that work today, and that judgement was
   not worth making from a structure audit.
2. **`prune_rate_limits` and `prune_expired_idempotency` are `SECURITY DEFINER`
   with no `REVOKE … FROM PUBLIC`.** No route reaches arbitrary SQL, so this is
   defence-in-depth rather than a live hole. Left as an unexplained asymmetry
   inside migration `0018`.
3. **The drizzle snapshot chain stops at `0017`** against 21 migrations. The
   next `db:generate` will re-emit a redundant `0021`. `npm run map` reports
   this on every run, so it cannot be forgotten.
4. **`leva` is in `dependencies`**, not `devDependencies`, while
   `ControlPanel.tsx` claims it never enters the shipped bundle.
5. **`components/graphics/viewport.ts`** — 472 lines for the retired
   photographic scene, kept alive by one test, with a docstring that falsely
   claims `verify-composition.mjs` reads `window.__lionFit`.
6. **`publications` and `reports` fold `repo()` into their service** instead of
   a sibling `repo.ts`, unlike the other nine modules.

## Found after the audit closed — not caused by it

**CI has been failing on `main` since at least 2026-08-26**, five consecutive
runs including `f8f84ce`. The failing step is `npm ci`, with
`EUSAGE … can only install packages when your package.json and
package-lock.json are in sync` and a long `Missing:` list — `fast-uri`,
`ajv`, and the platform-specific `@esbuild/*` entries.

It is an environment mismatch, not tree damage: `npm ci` succeeds on both
`main` and this branch locally under Node 25 / npm 11, and fails in CI under
Node 22 and the npm bundled with it. `fast-uri` is absent from `main`'s lock
too, so the drift predates this work. This branch's only lockfile change is
**352 deletions and zero additions** — the two removed devDependencies and
their transitive tree — so it neither caused nor worsened the failure. The fix
is to regenerate the lock under the Node version CI uses, or to pin npm in the
workflow; both change dependency resolution and are an owner decision.

**Separately, `ci-smoke.mjs` fails on archive routes when
`NEXT_PUBLIC_ARCHIVE_CDN` is unset**, because media falls back to `/archive/…`
and `public/archive/` is a gitignored dev symlink tree. The workflow does not
set that variable. CI has never reached the smoke job — the gate fails first —
so this has not yet been observed there, but it will surface the moment the
lockfile is fixed. The store is public, so setting the variable in the workflow
needs no secret.

## Original list — left for the owner (superseded by the two sections above)

These are real, and each changes product or security behaviour. A structure
audit does not get to make these calls:

1. **The Fake Resistance publication gate.** `EDITORIAL_STAGE` is `'published'`;
   `getCaseIndex()` filters on the JSON `lifecycle` while `getCase()` overrides
   it — so the flag that reads like the publication switch does not withdraw a
   case. The repo is public, so the text is already published regardless of the
   deploy.
2. **`requireCapability()` is never called.** Capability enforcement is inert.
3. **`prune_rate_limits` and `prune_expired_idempotency` are `SECURITY DEFINER`
   with no `REVOKE … FROM PUBLIC`**, unlike the two functions above them in the
   same migration.
4. **CI cannot guard the no-JavaScript invariant.** Two Linux-safe fixes exist.
5. **`/admin` and `/auth` are crawlable**; the public X sign-in shipped with no
   ADR entry.
6. **`leva` is a production dependency** for a route the comment claims never
   ships.
7. **The drizzle snapshot chain stops at `0017`** — the next `db:generate`
   re-emits a redundant `0021`.
8. **`vercel-infrastructure-costs.html`** — commit it, move it to `docs/`, or
   ignore it.
