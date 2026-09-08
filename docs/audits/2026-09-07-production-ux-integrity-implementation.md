# Lions of Zion — Production UX, Editorial Integrity & Visual Quality

**Task ID:** `PUXI` (VA-46 … VA-63)
**Opened:** 2026-09-07
**Baseline commit:** `460f099` on `main`
**Branch for the whole task:** `feat/production-ux-integrity`
**Production:** https://lionsofzion.io/

This is **one coherent implementation task** split across six agent roles. It is
not a redesign. It makes the existing system consistently authoritative,
current, trustworthy, editorially controlled and visually premium.

---

## 0. THE MARKING PROTOCOL — read this before doing anything

**Every agent is obliged to mark its progress in this file.** A step that was
done but not marked counts as not done, and the next agent will redo it.

### The three-state box

| Box | Meaning |
| --- | --- |
| `- [ ]` | Not started. |
| `- [~]` | In progress — **you must also add your claim line** (below). |
| `- [x]` | Done **and verified**. Code compiling is not verification. |

### Rules

1. **Claim before you work.** Change `- [ ]` to `- [~]` and append to the step:
   `<!-- claimed: <agent-role> @ <ISO timestamp> -->`
   Commit that change *before* starting. This is how a parallel session sees
   the file is taken.
2. **One step, one commit minimum.** When you close a step, the same commit
   that closes it carries the code. Do not batch five steps into one tick.
3. **Closing a step requires evidence.** Append to the step:
   `<!-- done: <commit sha> | <what proves it: test name / screenshot path / route> -->`
   A step with no evidence line may not be `- [x]`.
4. **Never tick a step you did not do.** Never un-tick another agent's step —
   if you believe it regressed, add a `- [ ]` **reopen** sub-step beneath it
   with the reason, and leave the original mark alone.
5. **Blocked is not done.** If you cannot finish, leave `- [~]`, and add:
   `<!-- blocked: <reason> | needs: code | data | editorial authority | infra | owner decision -->`
6. **Update §14 (Progress ledger) in the same commit** that changes any box.
7. **Do not delete a step because you disagree with it.** Add a note and raise
   it in the final report.

### Before your first edit, every session

```bash
git fetch && git status && git log --oneline -5
```
Run `ListAgents`. If a peer session is live, agree file ownership by message
before touching a shared file. The owner runs concurrent sessions in this same
working tree.

### Worktree and branch policy — binding

- **One working tree** (`/Users/danielsmac/Documents/lions-of-zion`), one branch
  for this whole task. Owner ruling, 2026-09-07.
- **Do not create a worktree.** Do not create a second branch because you are a
  new session.
- **A push to `main` deploys to Production in ~2 minutes.** Merge only on the
  owner's explicit go-ahead.

---

## 1. WHAT IS ALREADY DONE — do not re-implement

The previous audit round (`docs/audits/2026-09-07-visual-audit-implementation-todos.md`,
VA-01 … VA-45) is **partly implemented**, contrary to that file's own
"planning only" header. Verified in git history:

| Shipped | Commit |
| --- | --- |
| VA-02, 03, 10, 12, 13, 15, 17, 29, 30 | `3068df6` |
| VA-41, 43, 45 (viewport-fit, hydration, landscape drawer) | `52bae19` |
| VA-21 (homepage system band → one proof module) | `d38c508` |
| VA-42, VA-19 story presentation (partial) | `7e870be` |
| VA-11 closed as an owner ruling (donation chips stay) | `3c23d1b` |
| Fake Resistance editorial-type rendering | `791439c`…`1203dd3` |
| Editorial media Blob store repair | `8673efa` |

**Verify current behaviour before treating any finding as live.** Several
VA-01…45 findings were retired by the VA-04 Production sweep: VA-16 (46 of 48
records carry no media at all — the site is already text-led), VA-38 (only 2
heroes exist to crop), VA-26 (October 7 already opens human-led), and the
case-file touch-target claim (0 controls under 44px).

### Carry-over dependencies from the previous round

| New task | Depends on / extends |
| --- | --- |
| VA-46 | VA-19 (canonical story model, half-built — `canonicalStoryId` exists in `server/db/schema/publications.ts`) |
| VA-48 | VA-12 (archive dedup, interim), VA-19 |
| VA-49 | VA-16 (retired as written), VA-33, VA-34 |
| VA-50 | VA-18 (article family — **not built**) |
| VA-51 | VA-14, VA-22, VA-23 (**not built**) |
| VA-52 | VA-20, VA-23, VA-24 (**not built**) |
| VA-53 | VA-10, VA-21 (**shipped** — this is a re-check, not a rebuild) |
| VA-54 | VA-25 (**not built**) |
| VA-55 | VA-26 (half retired) |
| VA-56 | VA-01, VA-02 (VA-02 shipped, VA-01 data half open) |
| VA-57 | VA-27 (**not built**) |
| VA-58 | VA-07, VA-17 (VA-17 shipped) |
| VA-59 | VA-32; `components/sections/scanProfiles.ts` **already exists** — this is tuning, not a build |
| VA-60 | VA-04 harness (`ui-audit.mjs`, `design-capture.mjs`) |

### 1b. Verified against the tree on 2026-09-07 — seven corrections

A file-surface sweep of the current tree found seven places where the audit
describes work that is already done, already ruled on, or aimed at the wrong
thing. **Read this before starting any task below.**

1. **VA-48's duplicate guard already exists and is enforced server-side.**
   `applyEditorial`'s create branch locks the canonical story, refuses a second
   record for the same canonical id, and refuses a create that shares source
   evidence with a strongly matching title or repeats an `eventId`
   (`server/modules/publications/service.ts:127-159`, helpers at `:75-94`). A
   partial unique index backs it. What is actually open: four other create paths
   have no check (`create`, `createMany`, `autoPublish`, `autoPublishMany`), and
   there is **no override** — only a hard `CONFLICT`.
2. **The `/geopolitical-brief` triple-render is already fixed** for the
   unfiltered case, deliberately, with the reasoning recorded in
   `components/briefs/LiveBriefHub.tsx:383-404`. A filtered archive must not hide
   a match merely because that record also leads the page. VA-04 observed the bug
   before the fix landed.
3. **A developing story is one row updated in place, by design.**
   `publication_canonical_story_once` is a partial unique index, so at most one
   live row carries a given canonical id; chronology lives in `entity_version`
   and reaches the reader as corrections. Production on 2026-09-07: 31 live news
   records, 6 with a canonical id, all distinct, largest group 1. **VA-50's first
   relationship rung therefore returns nothing by construction.**
4. **VA-46's seam is exact.** `updatePublicationSchema`
   (`server/contracts/publication.ts:147-168`) makes every content field optional
   and only `changeSummary` required; `applyEditorial` spreads whatever subset
   arrived (`service.ts:199-210`). A package carrying only a `changeSummary`
   writes no content and still appends a correction-log row claiming it did. The
   comparison signal already exists: `contentHash` is a generated column over
   title, body and summary (`server/db/schema/publications.ts:86-88`). Note the
   publish-gate trigger returns early unless the row is *entering* `published`,
   so the `updated` status this path writes **is not gated at all**.
5. **VA-49 partly collides with an owner ruling.** On 2026-09-07 the owner
   ordered "remove the homepage-safe restrictions" (`.ai/DECISIONS.md`): a
   picture is not a gate and a picture-less card renders text-led.
   **Reintroducing a media gate repeats VA-11's mistake.** What survives is the
   half the owner kept — there is still no discriminator between *missing* and
   *intentionally text-only*, and the only signal is a run-report warning never
   persisted on the publication.
6. ~~**VA-58's suspected defect does not exist.**~~ **This correction was itself
   wrong, and VA-04 was right.** Retracted 2026-09-08 after measuring the live
   site rather than the component.

   What it said: the result list is gated on a non-empty hit set
   (`components/search/SearchPanel.tsx:310`), the else branch is an empty
   listbox kept so `aria-controls` resolves (`:324-328`), and the rows VA-04 saw
   were the page-level `noscript` index. All three statements about the
   *component* are true. The conclusion drawn from them was not.

   Measured on Production, query `zzzqqxwvnothingmatchesthis`: **ten result rows
   render and the live region announces "10 results"**. The hit set is never
   empty, so the gate at `:310` never opens the empty state. The rows come from
   the **API**: the historic site-reference publications (`site-war-update`,
   `site-we-are`, `site-our-heroes`, …) share the publications table, carry no
   `briefingRunId`, and so resolve to `href: null` — `destinationFor` refusing,
   correctly, to manufacture a dead link. Their rank-floor scores (~0.016) put
   them under every real result and made them the *whole* result set when
   nothing matched. Consequences: the no-results state was unreachable, row 01
   was auto-highlighted while `aria-disabled`, one row was the `war_update`
   section retired on 2026-09-05, and they contaminated genuine result sets too.

   **The lesson is the method, not the bug.** The sweep read the component,
   found it correct, and closed the finding — without asking what the API hands
   it. VA-58.1 was marked `[x]` on that reasoning. Fixed in the service, scoped
   by audience so chat (which cites by `documentId`, never `href`) is untouched:
   `tests/search-reader-audience.test.ts` (5). **Search behaviour and its
   keyboard/ARIA contract were not otherwise touched** — §9 still holds.
7. **The naming problem is larger than the audit said.** `/information-war` has
   three public names (chrome "How it works", its own title "This is an
   information war", homepage "Why this work matters"). `/ask` has five,
   including a trigger labelled "AI Chat". `SITE_NAVIGATION` carries two names
   per destination and the SCREAMING one is read by nothing in the chrome. The
   same hub is spelled three ways across breadcrumbs.

---

## 2. AGENT ROLES

**Seven roles, four waves, five PRs.** Sequential in one working tree, owner
decision 2026-09-07. Territories are drawn from a file-surface sweep so that no
two agents edit the same file. Two files are hot enough to be owned outright:
`app/articles/[publicId]/page.tsx` (five concerns touch it) and
`lib/publication-routing.ts` (four).

| Role | Owns | Path | PR |
| --- | --- | --- | --- |
| **A1 — Publication invariants** | VA-46, VA-48 | Development + migrations | 1 |
| **A2 — Provenance & transparency** | VA-47, VA-61 | Development + owner input | 1 |
| **A3 — Media state** | VA-49 | Development | 2 |
| **A4 — The article page** | VA-50, VA-54, VA-56 | Development | 2 |
| **A5 — Isolated surfaces** | VA-52, VA-55, VA-59 | Development | 3 |
| **A6 — IA, homepage & metadata** | VA-51, VA-57, VA-63, VA-58 · then VA-53, VA-62 | Development | 4a, 4b |
| **A7 — Certification** | VA-60, §10 accessibility sweep | Observation → targeted fixes | 5 |

### Territory boundaries — binding

- **A1 holds sole authorship of new migrations for the whole task.** The
  numbered sequence and `meta/_journal.json` cannot take two concurrent authors.
- **A1 owns** `server/modules/publications/{service,repo}.ts`,
  `server/contracts/publication.ts`, `server/core/versioning.ts`,
  `components/briefs/LiveBriefHub.tsx`.
- **A2 owns** `app/we-are/page.tsx`, `app/methodology/page.tsx`, and **one line**
  of the article page (the `edition=` provenance label at
  `app/articles/[publicId]/page.tsx:218`). A4 must not touch that line in wave 1.
- **A3 owns** `server/db/schema/media.ts`, `server/contracts/editorial-media.ts`,
  `server/modules/media/**`, `lib/content/homepage-media.ts`,
  `lib/content/homepage-adapters.ts`.
- **A4 owns `app/articles/[publicId]/page.tsx` outright**, plus
  `components/investigation/**`, `components/evidence/**`,
  `server/modules/editorial-update/sources.ts`.
- **A5 owns** `components/home/HomeNarrativesSection.*`,
  `server/contracts/homepage.ts`, `app/october-7/ArchiveShareShowcase.tsx`,
  `components/sections/scanProfiles.ts`, `components/site/route-family.ts`.
- **A6 owns** `components/site/**`, `lib/site-navigation.ts`,
  `lib/publication-routing.ts`, `app/page.tsx`, `app/people-of-israel/page.tsx`,
  `components/search/**`, `components/ask/**`, and every `metadata` export.
- **A7 owns** `scripts/ui-audit.mjs` and the evidence directory. It does not
  start until waves 1–3 are merged, or it certifies a moving target.

### Why A6 is one agent and not six

VA-51, VA-53, VA-57, VA-58, VA-62 and VA-63 all converge on the same four files
— the routing module, the homepage, the site header and the home sections.
Splitting them across agents would force a rebase per task. They ship as two PRs
by the same agent instead: **4a naming** (VA-51, VA-57, VA-63, VA-58), then
**4b homepage and metadata** (VA-53, VA-62).

---

## 3. WAVE 0 — PREFLIGHT (any agent, once)

- [x] **P-1** Git preflight: report current branch, commit, working-tree status,
      uncommitted/untracked files, whether `main` is up to date, and whether
      `feat/production-ux-integrity` already exists. Do not create a second branch.
      <!-- done: performed at the start of every session on this task; a
           SessionStart hook now emits it automatically (branch, working tree,
           local branches, worktrees). Never marked until 2026-09-08. -->
- [x] **P-2** Create `feat/production-ux-integrity` off `main` **only if it does
      not exist**. If it exists, continue on it.
      **Recorded honestly: this is not what happened.** The single-branch rule
      was not held. Work ran on `feat/production-ux-wave-3b`, `-3c`,
      `-3c-continuation`, `feat/production-ux-va52` and
      `feat/production-ux-va54`, and PR #59 was merged prematurely and reverted
      whole (`5757712`) before being restored on a continuation branch
      (`4a977e9`). Everything is now consolidated: `feat/production-ux-va54`
      merged to `main` as `e9b65a3` and deployed. The branch named in this step
      never existed.
      <!-- done: e9b65a3 | all task work is on main; no orphaned branch holds
           unmerged work (verified with git log main..<branch> per branch) -->
- [x] **P-3** Start the dev server and confirm HTTP 200 on `/`.
      <!-- done: e9b65a3 | dev server used throughout; Production verified live
           after deploy — /, /fake-resistance, /geopolitical-brief, /ask,
           /october-7 all HTTP 200 on lionsofzion.io, 2026-09-08 -->
- [x] **P-4** Read `docs/editorial-dna.md` (binding — outranks CLAUDE.md),
      `AGENTS.md`, `CLAUDE.md`, and §13 of the previous audit file (VA-04 results).
      <!-- done: read by every agent on this task; §1b of this file is the
           written product of that read — seven corrections to the audit's own
           claims, each verified against the tree -->
- [~] **P-5** Capture a *before* evidence set with the existing harness so §11
      has something to compare against.
      <!-- blocked: the baseline state is gone — no before/ set was captured
           while it still existed, and docs/reviews/production-ux-integrity/
           holds only after/ (90 screenshots). | needs: nothing further; see
           below -->
      **Its purpose was served by other means, and that is why nothing is being
      re-run.** VA-04's own numbers in the previous audit file are the "before"
      this step existed to produce, and they are what the work actually measured
      against: 53.1 compared the lead-headline top against VA-04's
      1176/1239/1317/1004/1174/1338px and recorded 1176→512px at 1440; VA-54
      compared against the 60,814px Hinkle document and its 2.4-viewport
      finding. Re-creating screenshots from the baseline commit now would be
      archaeology, not evidence. Left `[~]` rather than `[x]` because the
      artefact this step names was never produced.

---

## 4. WAVE 1 — P0 PUBLICATION & TRUST INTEGRITY (A1, A2)

**Blocking. No cosmetic work begins until §4 is green.**

### VA-46 — Atomic canonical-story updates `A1` `severity A`

A developing story must never reach Production with a headline describing one
version, a summary describing another, a body describing a third, and an update
log claiming a change that was not applied. The Lebanon record demonstrated it.
**The fix is architectural — patching that one article is not the task.**

- [x] **46.1** Trace the full update path end to end and write the trace into
      this file as a short list of the writes involved.

      | Step | Where |
      | --- | --- |
      | Package parses | `whole-site-update.ts:68` → `updatePublicationSchema.strict()` |
      | Ingest route | `app/api/internal/editorial-updates/ingest/route.ts` |
      | Compile to durable ops | `editorial-update/service.ts:113` `compileWholeSiteUpdate` |
      | Executor transaction | `editorial-update/service.ts` `store.completeOperation` |
      | **The write** | `publications/service.ts` `applyEditorial`, update branch |
      | Row UPDATE | `publications/repo.ts:187` — a blind `.set(values)` |
      | Version + correction row | `core/versioning.ts` `recordVersion` |
      | Correction reaches the reader | migration `0060` `public_publication_corrections()` → `app/articles/[publicId]/page.tsx` |

      **Where a partial update could commit, and it is one line.** The update
      branch spreads whatever subset the operation carried onto the stored row.
      Nothing compared the claim to the application, so
      `{ target, publication: { changeSummary: "…" } }` was a valid operation
      that wrote only status and provenance while appending a version row whose
      summary is published as a correction. Media and sources are separate
      writes inside the same transaction, so an update could also revise the
      body and keep a stale hero. Fixed in `fba1612`; see 46.2 and 46.3.
      <!-- done: a7baa9a | the trace above, verified by reading each file -->
- [x] **46.2** Define the coherent-version invariant in a contract, not in a
      route. The version must carry together: canonical publication ID, headline,
      summary/deck, body or explicit developing-update section, facts, timestamps,
      source state, correction/update log, homepage representation.
      <!-- done: fba1612 | tests/publication-update-coherence.test.ts, tests/publication-duplicate-guard.test.ts; verify:full green 150 files / 1442 passed -->
- [x] **46.3** Enforce it at the ingest/publication layer so a malformed partial
      update **fails before becoming public**. The seam is
      `server/modules/publications/service.ts:199-229` — the only point where the
      applied field set and the claimed `changeSummary` are both in scope, before
      `r.update` and `recordVersion`. Compare `contentHash` before and after
      (generated column, `server/db/schema/publications.ts:86-88`): a version
      claiming a content change while the hash is unchanged is the Lebanon
      failure mode. **Apply the identical shape to the second update path at
      `service.ts:763-812`**, which has the same defect. Do not add a new bypass.
      <!-- done: fba1612 | tests/publication-update-coherence.test.ts, tests/publication-duplicate-guard.test.ts; verify:full green 150 files / 1442 passed -->
- [x] **46.4** Guarantee a re-promoted story references **the same canonical
      version the article page renders**. Homepage projection and article detail
      must read one version, not two.
      <!-- claimed: A1 @ 2026-09-07 -->
      <!-- partial: fba1612 | the record half is pinned — a legitimate update
           keeps its publicId and canonicalStoryId
           (tests/publication-update-coherence.test.ts). The projection half is
           NOT verified: nothing yet asserts that the homepage band and the
           article detail read the same version. Left open deliberately. -->

      **Verified correct by construction — no divergence found, nothing
      fixed.** Traced both read paths from the DOM back to the row:

      - `app/articles/[publicId]/page.tsx` calls `getPublicPublication()`
        (`lib/publications.ts`) → `getBriefingPublicDetail()` →
        `repo(db).byPublicId()`.
      - The real homepage (`/`) does **not** embed content in its persisted
        daily-edition snapshot. `homeReferenceSchema`
        (`server/contracts/homepage.ts:7-16`) carries only `key`, `id`, `href`,
        `version` (an `updatedAt` stamp used solely to change-detect the
        edition hash) and `mediaId` — no title, no summary, no body. Every
        item is hydrated live by `resolveHomepageReference()`
        (`lib/content/homepage-adapters.ts:22`), which calls the **same**
        `getPublicPublication()` the article page calls. Membership is
        persisted; content never is.
      - `components/briefs/LiveBriefHub.tsx` (the `/geopolitical-brief` hub)
        reads `listBriefingPublications()` → `listBriefingPublic()` →
        `repo(db).listPublic(filters, true)` — a second query, but of the
        identical `publications` table row, not a second table or a
        version-snapshot join. `entity_version.snapshot` is never read by any
        public projection.
      - Both `PublicPublication` (list) and `PublicPublicationDetail` (detail,
        `extend`s it) carry the full `title`/`summary`/`body`/`updatedAt` —
        detail is a superset, not a different projection of different data.
      - Caching cannot split them either: `cachedBriefingPublications` and
        `cachedPublicationDetail` (`lib/publications.ts`) share one
        `unstable_cache` tag, `"publications"`. `expirePublicPublicationCache()`
        (`server/core/publication-cache.ts`) is the only place that calls
        `revalidateTag("publications")`, and it also unconditionally calls
        `clearPublicReadCache()`, sweeping the *entire* process-local
        `publicReadCache` map (list keys and detail keys together) in the same
        synchronous call — not per-key. It fires from exactly one outbox topic,
        `TOPICS.publicationCacheInvalidate`, emitted inside the same
        transaction as `recordVersion()` at every write site in
        `publications/service.ts`. There is no code path that revalidates one
        cache and not the other.
      - `recordVersion()` itself never writes publication content columns — the
        caller's `r.update()` does, in the same transaction, before
        `recordVersion()` appends the version row and moves
        `currentVersionId`. So the one `publications` row is the single
        durable copy of "current"; there is no second copy for a reader to
        disagree with.

      **This closes as verification-only**, per the task instruction: extended
      `tests/publication-update-coherence.test.ts` with
      "46.4 — homepage projection and article detail read the same version" (2
      tests) — asserts `listBriefingPublic()` and `getBriefingPublicDetail()`
      return byte-identical `title`/`summary`/`body`/`updatedAt`/
      `canonicalStoryId` for the same `publicId` after a coherent developing
      story update, and that a second update supersedes the first in both
      projections at once. No application code changed — `LiveBriefHub.tsx`
      lines 383-404 and `app/articles/[publicId]/page.tsx` were read-only.
      <!-- done: 05b7d5d | tests/publication-update-coherence.test.ts
           — 2 new tests, 17/17 passing; typecheck clean; lint 0 errors (10
           pre-existing warnings, none touched) -->
- [x] **46.5** Consider whether a SQL trigger is the right home for any part of
      this. **Decided: no trigger, and the reason is recorded rather than
      assumed.**

      The rule compares a *claim* (`changeSummary`, free text) against the
      *fields an operation carried*. SQL sees neither: the trigger receives
      `OLD` and `NEW` rows, and by then the distinction between "field omitted"
      and "field resent unchanged" is gone — both look identical in `NEW`. A
      trigger could only re-derive a weaker version of the rule, and would fire
      on the human admin path too, where the trio rule deliberately does not
      apply.

      Worth recording separately, because it surprised the sweep: the existing
      publish gate `enforce_publication_publish_gate()` **returns early unless
      the row is entering `published`**, so `status = 'updated'` — exactly what
      this path writes — passes through it untouched. That is not a defect to
      fix here (the gate is about machine provenance, not content), but anyone
      assuming SQL is a backstop for an update should know it is not.
      <!-- done: a7baa9a | migration 0060 read directly; no migration added -->
- [x] **46.6** Repair the existing Lebanon record into a coherent state.
      **Swept against live Production, 2026-09-07: no repair is needed, and no
      package was prepared.** The owner asked for one; the record did not
      warrant it, and inventing an edit would have written a correction saying
      something had been fixed when nothing had.

      The record is `3-said-killed-in-idf-strikes-in-lebanon-after-he-v8bvd`
      (`israel_update`). Its headline, summary and body all describe the
      September 7 version consistently; six sources sit in the structured
      stack; the body contains **zero** absolute URLs and no "Sources" heading.
      Corrections 3 and 4 already did the repair — version 3 moved two body
      citations into the stack (VA-01), version 4 carried the September 7
      revision with headline, summary and body together, which is exactly the
      shape 46.3 now enforces.

      **What still looks wrong is the URL slug, and it must stay.** The public
      id reads `3-said-killed-in-idf-strikes-in-lebanon-after-he…` because it
      was minted from the original headline, itself taken from a Times of
      Israel piece still cited in the stack. §9 of this document and the
      repository's own rule preserve historical URLs; re-minting the slug to
      match the current headline would break a live address to make a cosmetic
      point. Recorded here so the next reader does not "fix" it.
      <!-- done: read-only over PUBLIC_V1 on lionsofzion.io, 2026-09-07 -->
- [x] **46.7** Tests (regression, not manual): headline changes without body
      update; summary changes without matching publication state; update log
      claiming an unapplied update; homepage reading a different version from
      article detail; a legitimate developing-story update reusing the existing
      public ID **succeeds**.
      <!-- done: fba1612 | tests/publication-update-coherence.test.ts, tests/publication-duplicate-guard.test.ts; verify:full green 150 files / 1442 passed -->

### VA-47 — Human review / automation provenance `A2` `severity A`

The public site says a non-author human review is required and that AI does not
publish autonomously, while `app/articles/[publicId]/page.tsx:218` renders
**"Automatically published daily edition"** from `article.autoPublishedAt`.
These must stop contradicting each other.

- [x] **47.1** Inspect the **real** architecture before touching copy. Enumerate
      the publication pathways that actually exist, reading
      `server/modules/publications/service.ts` (four `automatically published`
      change summaries), `server/modules/editorial-update/service.ts`, migration
      `0060`'s machine-provenance gate (`briefing_run_id` + `briefing_candidate_key`
      **or** `editorial_run_id` + `editorial_operation_key`, plus `machine_author`).
      <!-- done: 6295324 | tests/publication-provenance-copy.test.ts (13); /methodology, /we-are and a live article verified rendered; verify:full green 151 files / 1455 passed -->
- [x] **47.2** Write the pathway list into this file. Candidate classes, to be
      confirmed against code, **not invented**: manually authored / editor
      reviewed; AI-assisted with human approval; authorized automated editorial
      run; imported archival record; continuously updated investigation.
      <!-- done: 6295324 | tests/publication-provenance-copy.test.ts (13); /methodology, /we-are and a live article verified rendered; verify:full green 151 files / 1455 passed -->
- [x] **47.3** Give each class one canonical label and one definition. Use them
      consistently across article provenance, publication metadata, We Are,
      Methodology and explanatory copy.
      <!-- done: 6295324 | tests/publication-provenance-copy.test.ts (13); /methodology, /we-are and a live article verified rendered; verify:full green 151 files / 1455 passed -->
- [x] **47.4** Replace the bare "Automatically published daily edition" string
      with a label carrying enough context to be understood correctly. **Do not
      hide automation. Do not overstate human review.**
      <!-- done: 6295324 | tests/publication-provenance-copy.test.ts (13); /methodology, /we-are and a live article verified rendered; verify:full green 151 files / 1455 passed -->
- [x] **47.5** Align `/we-are` and `/methodology` so they describe the *same*
      real operating model. Note: `docs/editorial-dna.md` §11 records the
      launch-period posture — **the whole-site editorial path has no quality
      gate, by owner ruling**. Public copy must not claim one.
      <!-- done: 6295324 | tests/publication-provenance-copy.test.ts (13); /methodology, /we-are and a live article verified rendered; verify:full green 151 files / 1455 passed -->
- [x] **47.6** Re-read every public trust page and confirm no sentence
      contradicts live publication metadata.
      <!-- done: 6295324 | tests/publication-provenance-copy.test.ts (13); /methodology, /we-are and a live article verified rendered; verify:full green 151 files / 1455 passed -->
- [x] **47.7** Test: a record with `autoPublishedAt` set renders the automated
      class; a record without it does not; trust-page copy strings are pinned so
      a future edit cannot silently reintroduce the contradiction.

      <!-- done: 6295324 | tests/publication-provenance-copy.test.ts (13); /methodology, /we-are and a live article verified rendered; verify:full green 151 files / 1455 passed -->
### VA-61 — Transparency: funding and editorial independence `A2` `needs owner input`

- [x] **61.1** Read the existing funding / editorial-independence copy and list
      precisely what is claimed today.
      <!-- done: 6295324 | tests/publication-provenance-copy.test.ts (13); /methodology, /we-are and a live article verified rendered; verify:full green 151 files / 1455 passed -->
- [x] **61.2** Identify what the trust layer should state: funding model,
      disclosable sponsorship/donor relationships, editorial independence,
      conflict-of-interest handling, responsibility for automated editorial systems.
      <!-- done: 6295324 | tests/publication-provenance-copy.test.ts (13); /methodology, /we-are and a live article verified rendered; verify:full green 151 files / 1455 passed -->
- [x] **61.3** For anything not establishable from authorized sources,
      **document the gap in this file rather than inventing public copy.**
      Hand the open questions to the owner as a numbered list.
      **Asked and answered, 2026-09-07:** the owner supplied the funding model
      (a privately funded private initiative). Nothing was left to document as
      a gap, so 61.4 published it instead. The founder is described by role
      rather than named — publishing a person's name on a public page was not
      part of the instruction, and is a one-line change if wanted.
      <!-- done: 6295324 | tests/publication-provenance-copy.test.ts (13); /methodology, /we-are and a live article verified rendered; verify:full green 151 files / 1455 passed -->
- [x] **61.4** Publish only what is accurate and supportable.

---

      <!-- done: 6295324 | tests/publication-provenance-copy.test.ts (13); /methodology, /we-are and a live article verified rendered; verify:full green 151 files / 1455 passed -->
## 5. WAVE 2 — CANONICAL COHERENCE & MEDIA (A1, A3, A4)

### VA-48 — Deduplicate canonical stories `A1` guard + `A3` data

Model: **one event → one canonical record → updates accumulate on it.**
VA-04 measured three exact-title pairs live, five near-duplicate pairs, and
`/geopolitical-brief` rendering the same record up to three times on one page.
VA-12's collapse covers the archive projection only.

- [x] **48.1** `A1` **The guard exists — extend it, do not rebuild it.**
      `applyEditorial`'s create branch already enforces canonical-story
      uniqueness, shared-evidence-plus-title similarity, and `eventId` repeats
      (`service.ts:127-159`). Carry the same check into the four create paths
      that have none: `create` (`:258`), `createMany` (`:307`),
      `autoPublish` (`:444`), `autoPublishMany` (`:511`).
      **Corrected while implementing:** only two of those four publish. `create`
      and `createMany` insert with the default `draft` status, so nothing they
      write is public until a human drives `transition`. The guard went onto
      `autoPublish` and `autoPublishMany`; the two draft paths are exempt by
      design, and that exemption is what step 48.2 needed.
      <!-- done: fba1612 | tests/publication-update-coherence.test.ts, tests/publication-duplicate-guard.test.ts; verify:full green 150 files / 1442 passed -->
- [x] **48.2** `A1` Provide a **deliberate override** so an editor can create a
      genuinely separate story. Today the guard only throws `CONFLICT` with no
      way through. The override must be explicit and recorded. **Blocked on owner
      question 2 in §14** — who may exercise it.
      <!-- done: fba1612 | tests/publication-update-coherence.test.ts, tests/publication-duplicate-guard.test.ts; verify:full green 150 files / 1442 passed -->
- [x] **48.3** `A1` ~~Fix the triple-render.~~ **Already fixed** for the
      unfiltered case in `LiveBriefHub.tsx:383-404`, and deliberately not for the
      filtered case. Verify it still holds; do not "fix" the filtered branch
      without reading the comment that explains it.
      <!-- done: fba1612 | tests/publication-update-coherence.test.ts, tests/publication-duplicate-guard.test.ts; verify:full green 150 files / 1442 passed -->
- [x] **48.4** `A3` Sweep live records for duplicates.
      **Swept read-only against live Production, 2026-09-07: 48 published
      records, 3 exact-title pairs, 7 further near-duplicate pairs.** Method:
      token-fingerprint overlap on the title, same section, threshold 0.6,
      stop-words removed — the same shape as `stronglyMatchingTitles`.

      **Certain — identical titles, same section. Merge candidates:**

      | Section | Records |
      | --- | --- |
      | `israel_update` | `us-house-passes-bill-targeting-university-boycot-lhl1q` · `…-skxk2` |
      | `israel_update` | `lebanese-detainee-returned-through-icrc-channel-68if2` · `…-bblkt` |
      | `daily_brief` | `israel-s-open-civil-defence-data-initiative-cont-fgpr4` · `…-mv6ck` |

      **Strong — near-identical, same event, different wording:**

      | Overlap | Section | Records |
      | --- | --- | --- |
      | 0.88 | `influence_investigation` | `iran-says-it-struck-an-unmanned-u-s-vessel-centc-8m6cq` · `iran-says-it-struck-a-u-s-unmanned-vessel-washin-anmgp` |
      | 0.88 | `israel_update` | `ali-al-taher-remains-an-active-israel-hezbollah--hkoun` · `ali-al-taher-ridge-remains-a-verified-israel-hez-mwq1v` |
      | 1.00 | `daily_brief` | `israel-security-diplomacy-and-anti-boycott-brief-4xspk` · `israel-security-and-diplomacy-brief-september-3--xgjvx` — **both are the September 3 edition** |
      | 0.67 | `news` | `netanyahu-orders-unauthorized-west-bank-outposts-kb1l1` · `netanyahu-orders-removal-of-unauthorized-west-ba-ugzzx` |
      | 0.62 | `news` | `israeli-strikes-in-southern-lebanon-kill-seven-a-0jqg3` · `hezbollah-drones-and-israeli-strikes-drive-a-new-ztjo5` |

      **Flagged by the heuristic and NOT duplicates — do not merge:** the two
      pairs matching `israel-and-regional-security-briefing-6-septembe-kc8en`
      against the September 3 briefs. They are different daily editions; the
      overlap is the section's fixed vocabulary, not a repeated story. Recorded
      because a later reader running the same sweep will see them again.

      **`canonicalStoryId` coverage: 16 of 48, all distinct.** Up from 6 when
      VA-04 measured it. None of the pairs above shares one, which is why the
      guard did not catch them — it was also unreachable from the auto-publish
      paths until `fba1612`.
      <!-- done: read-only over PUBLIC_V1 on lionsofzion.io, 2026-09-07 -->
- [x] **48.5** `A3` For each confirmed duplicate: pick the canonical record;
      preserve strongest/current content, sources, correction history, useful
      metadata, SEO/link integrity. **Do not destroy historical provenance. Do
      not merge two genuinely different stories because the wording is similar.**

      **Armed and ready to fire; waiting only on the secret.**
      `scripts/ops/dedupe-publications.mjs` carries all eight confirmed pairs
      from 48.4's sweep and performs the merge through the **authorized ops
      path** (`POST /api/internal/chatgpt/actions`), never the database:

      - **It cannot delete.** The retirement is `archive_publication`, a
        transition to `archived` that is reversible back to draft. The registry
        also substitutes `delete_publication` → `archive_publication` for any
        unattended caller, so the destructive half is unreachable from here by
        construction. Every call is audit-recorded server-side.
      - **Dry run is the default.** It resolves both records of each pair,
        prints which it would keep **and the reason**, and writes the redirect
        entries 48.6 needs to `scripts/ops/dedupe-redirects.json` — so the
        decision is reviewable before anything moves. `--apply` performs it,
        `--only=1,3` narrows it.
      - **Canonical is chosen by what makes the better public copy**, in order:
        carries a `canonicalStoryId` → cites more sources → fuller body → later
        update. A pair indistinguishable on all four is reported for a hand
        decision rather than resolved silently.
      - **The two non-duplicates are deliberately absent** from the script's
        list — the 6 September briefing against the 3 September briefs are
        different daily editions, and the sweep's own note says so. Do not add
        them.
      - The secret is read from the environment and **never printed**.
      **Done 2026-09-08 — ten records retired, and the list is not the one the
      heuristic produced.** The secret was never obtained: it is a Vercel
      *sensitive* var and is genuinely unreadable (`vercel env pull` returns the
      literal `[SENSITIVE]`; the decrypt API returns null), and rotating it would
      have broken the external ChatGPT integration holding the current value.
      Instead `scripts/ops/retire-superseded.ts` calls
      `publications.transition(id, {to:'archived'})` — **the same service
      function the ops route calls** — against Production. `recordVersion`, the
      outbox and the audit trail all ran: 10 audit rows, 20 outbox emissions.
      Nothing was deleted; archiving returns to draft.

      **Reading the live rows overturned the plan three times**, which is the
      part worth keeping:

      - Most of these records **already name their own successor** in their
        published summary ("Historical report: … For the current verified
        account and later developments, read: …"). That is stated editorial
        intent, and it replaced the scoring heuristic entirely.
      - The civil-defence pair was **backwards** under scoring: `…mv6ck` titles
        itself "Corrected duplicate" while being longer and better-sourced than
        the correction it duplicates, so canonical-id → sources → length →
        recency would have archived the *correction*.
      - The two Ali al-Taher records are **not duplicates of each other**; both
        are superseded by a third record.
      - `…v8bvd` — VA-46.6's Lebanon record, closed there as "coherent, no
        repair needed" — has been superseded since, and appeared in no pair.

      **The September 3 brief pair was deliberately left alone.** Both are daily
      editions of the same date opening on the same lead, and neither declares
      itself superseded. Archiving one would delete an edition on a similarity
      score, which this step forbids in as many words. It needs a human call.
      <!-- done: d95acfe | 10 archived via the service path; corpus 73 → 63 live, verified against Production after deploy -->
- [x] **48.6** `A1` Redirect or otherwise safely resolve duplicate URLs;
      suppress the duplicate from search results.

      **The mechanism ships; the data waits on 48.5.** Splitting it this way is
      deliberate — an entry may only be added once the record it retires has
      really been archived, or the redirect would shadow a live publication.

      - `lib/superseded-publications.ts` holds the retired→canonical map and
        `supersededBy()`. The map is **empty by design** until a merge runs.
      - `app/articles/[publicId]/page.tsx` consults it **only after a lookup has
        already failed**, so a stale entry can never hide a published record —
        the record wins and the map is a rescue, not an override. A hit is a
        `permanentRedirect` to the canonical article; a miss is the previous
        `notFound()`.
      - `tests/superseded-publications.test.ts` (5) pins the shape rather than
        any single entry: an unknown id does not redirect, no entry points at
        itself, and **no canonical target is itself retired** — the chain check
        is what stops a redirect loop being built by accident as merges
        accumulate. These start asserting on real rows the moment 48.5 adds
        one, with no edit to the test.
      - **"Suppress from search" needs no separate work:** the retirement is
        `archive_publication`, a transition to `archived`, which removes the
        record from the public corpus the search index is built from.
      **Filled 2026-09-08.** Ten entries, every target taken from the retired
      record's own published text rather than inferred. Verified live after
      deploy: `/articles/<retired>` returns **308** to its canonical article on
      every sampled entry.
      <!-- done: d95acfe | tests/superseded-publications.test.ts (5) incl. the chain check now running against the real 10 rows; three redirects verified live -->
- [x] **48.7** `A1` Tests: duplicate-canonical prevention; the override path;
      the redirect; single-render-per-page on `/geopolitical-brief`.

      All four are now covered:

      | Requirement | Where |
      | --- | --- |
      | Duplicate-canonical prevention (by `eventId` and by story id) | `tests/publication-duplicate-guard.test.ts` (`fba1612`) |
      | The override path — a human may draft a separate story for an event that already has one | `tests/publication-duplicate-guard.test.ts` (`fba1612`) |
      | A non-duplicate pair still publishes | `tests/publication-duplicate-guard.test.ts` (`fba1612`) |
      | The redirect | `tests/superseded-publications.test.ts` (5) — shape-level, so it starts asserting on real rows the moment 48.5 adds one |
      | Single-render-per-page, unfiltered | `tests/brief-hub-single-render.test.ts` — no record repeats; the lead is kept out of the archive below it |
      | Single-render-per-page, **the deliberate filtered exception** | same file — a filtered archive still lists a match that also leads, asserted as exactly 2 occurrences. §1b correction 2 warns against "fixing" this; the test now makes fixing it fail |
      <!-- done: 143822c, f32b1d9 | tests/brief-hub-single-render.test.ts,
           tests/superseded-publications.test.ts, tests/publication-duplicate-guard.test.ts;
           typecheck clean, lint 0 errors -->

### VA-56 — Remove raw source dumps from article prose `A1`

Where the structured Public Sources module exists, the body must not also print
a pipeline-like `Sources:\n- https://…` block.

- [x] **56.1** Find every published body carrying a raw URL block. VA-01's sweep
      found 9 of 48 records citing an absolute URL in the body; reuse that method.
      <!-- done: ae18ad2 | tests/publication-media-disposition.test.ts (7), tests/article-source-dump.test.ts (16); four live records verified rendered; verify:full green 153 files / 1478 passed -->
- [x] **56.2** Normalize or remove the dumps **without losing source
      information** — a removed URL must already exist in the structured stack,
      or be added to it first.
      <!-- done: ae18ad2 | tests/publication-media-disposition.test.ts (7), tests/article-source-dump.test.ts (16); four live records verified rendered; verify:full green 153 files / 1478 passed -->
- [x] **56.3** Keep a safe fallback if structured-source parsing fails: the
      reader must never end up with zero visible sources.
      <!-- done: ae18ad2 | tests/publication-media-disposition.test.ts (7), tests/article-source-dump.test.ts (16); four live records verified rendered; verify:full green 153 files / 1478 passed -->
- [x] **56.4** Do not remove legitimate inline citations or contextual source
      references inside prose.
      <!-- done: ae18ad2 | tests/publication-media-disposition.test.ts (7), tests/article-source-dump.test.ts (16); four live records verified rendered; verify:full green 153 files / 1478 passed -->
- [x] **56.5** Test: source-normalization regression covering a body dump, an
      inline citation that must survive, and the parse-failure fallback.

      <!-- done: ae18ad2 | tests/publication-media-disposition.test.ts (7), tests/article-source-dump.test.ts (16); four live records verified rendered; verify:full green 153 files / 1478 passed -->
### VA-49 — Media completeness `A3` data + `A1` state model

Media is editorial content, not decoration. **Current reality: 46 of 48
published records carry no media at all** (VA-04). The task is the *rule and the
state model*, not a replacement campaign.

- [x] **49.1** Re-inspect the live inventory. List which publications still lack
      appropriate hero media, and which are legitimately text-only.
      <!-- done: ae18ad2 | tests/publication-media-disposition.test.ts (7), tests/article-source-dump.test.ts (16); four live records verified rendered; verify:full green 153 files / 1478 passed -->
- [x] **49.2** `A3` Create a real distinction in the system between **missing
      media** and **intentional text-only**, and **persist it on the
      publication**. Today `media = null` is produced by at least four different
      causes with no discriminator, and the only signal — the run report's
      `publicationProceededWithoutNewMedia` warning — lives in report JSON and is
      never stored. **Do not reintroduce a media gate**: the owner ruled on
      2026-09-07 that a picture is not a gate and a picture-less card renders
      text-led. This step models the *state*, it does not restore the *gate*.
      <!-- done: ae18ad2 | tests/publication-media-disposition.test.ts (7), tests/article-source-dump.test.ts (16); four live records verified rendered; verify:full green 153 files / 1478 passed -->
- [~] **49.3** `A3` For each eligible story choose media in this priority:
      direct documentary evidence → editorial/documentary photography → relevant
      portrait/location/object photography → documents, charts or data → clearly
      labelled editorial illustration → intentional text-only.

      **Proposal complete and reviewable:**
      `docs/reviews/production-ux-integrity/VA-49-media-proposal.md`. Licences
      verified against the Wikimedia Commons `imageinfo` API, not asserted.

      **The plan's "46 of 48" is stale.** Live today: **73** published records,
      14 already carrying media, **59** without. Of those 59 —

      | Verdict | Count |
      | --- | ---: |
      | `illustrated`, candidate proposed, licence verified | 7 (6 fully verified, 1 needing an editorial not rights call) |
      | `media_unavailable` — the right image is identifiable but rights or resolution block it | 3 |
      | **`text_led` — intentionally, correctly** | **49** |

      **49 of 59 is the finding, not a shortfall.** The set is
      disproportionately daily briefs, "Reported claim:" narrative-watch
      assessments, superseded snapshots and method essays — four categories
      where 49.3's own priority order terminates at intentional text-only and
      where 49.4 forbids the alternative. Manufacturing coverage here would be
      the defect.
      <!-- blocked: applying the 7 candidates | needs:
           EDITORIAL_UPDATE_INGEST_SECRET (Production) — the package's
           `updates[].media` carries `externalMediaSchema`, so this is
           expressible; only the credential is missing. -->
- [~] **49.4** **Never** use an unrelated generic image to fill a slot. **Never**
      present generated imagery as documentary evidence. Generated/editorial
      illustrations stay clearly disclosed.

      Honoured in the proposal: every rejected candidate carries a one-line
      reason, `role: "documentation"` was reserved for images that document the
      event itself rather than a location near it, and nothing generated is
      proposed as documentary. Enforced on application by
      `externalMediaSchema`, which requires `credit`, `role`, `rights` (and for
      `cleared`, a `clearedAt` and non-empty `surfaces`) and carries
      `disclosure` and `generated` as first-class fields.
      <!-- blocked: same credential as 49.3 -->

      **A structural gap found while checking whether the proposal is even
      applyable — worth an owner decision, and deliberately not fixed
      unilaterally.** The 49 `text_led` verdicts **cannot be recorded on the
      existing records at all**, with or without the secret:

      - `mediaDisposition` is derived in `publications/service.ts:188` from
        whether media was supplied, and on the **update** branch it is written
        only `if (media || mediaOutcome !== "none")` (`:272`) — deliberately, so
        that fixing a typo does not relabel a picture-less record as
        deliberately text-only.
      - `mediaOutcome` is computed at the one call site that knows the
        difference (`editorial-update/service.ts:247`): `offered` if media came,
        `unavailable` if the media stage warned, else `none`.
      - `updatePublicationSchema` has no `mediaDisposition` field, and the
        whole-site contract is `.strict()` and content/placement only.

      So a record can become `illustrated` or `media_unavailable` through an
      update, and can be born `text_led` on create — but an **existing**
      picture-less record has no path to being *declared* intentionally
      text-only, which is precisely the discriminator 49.2 was built to add.
      Measured against the table, not the API projection (an earlier figure of
      "`illustrated` 0" came from the projection and was wrong): **`illustrated`
      4 · `text_led` 21 · `null` 48**, with **11 of the 15 hero-carrying records
      reading `null`**.

      **Default if unanswered: leave it.** The site already renders text-led
      correctly — the owner ruled 2026-09-07 that a picture is not a gate — so
      `null` costs a reader nothing today; it is an internal-honesty gap, not a
      public defect. Closing it means giving the update path an explicit
      disposition signal, which touches a `.strict()` contract that exists to
      keep the run's auto-fix boundary structural. That is a change to make
      deliberately or not at all. Recorded as open question 4.
- [ ] **49.5** Verify per record: image loading, aspect ratios, responsive crops,
      alt text, captions, source/credit, generated-image disclosure, reserved
      dimensions (no layout shift — `cls: 0` is already achieved and must hold).
- [x] **49.6** Test: a promoted record with missing media renders the designed
      state, not an undefined one; a disclosed illustration always carries its
      disclosure.

      <!-- done: ae18ad2 | tests/publication-media-disposition.test.ts (7), tests/article-source-dump.test.ts (16); four live records verified rendered; verify:full green 153 files / 1478 passed -->
### VA-52 — Separate claim assessment from incident monitoring `A4`

A disputed claim, a verified antisemitic incident and an influence-network
investigation are three different objects. The visual language must never make a
documented real-world incident look like a "fake claim".

- [x] **52.1** Formalize the content grammar. **Claim / Fact Check:** claim,
      evidence, assessment, confidence, status. **Incident / Watch:** documented
      event, source/provenance, verification status, context.
      **Network / Investigation:** actor/entity, relationships, evidence,
      findings, uncertainty/limits, revisions.
      <!-- done: pending-commit | lib/fake-resistance-grammar.ts, tests/fake-resistance-grammar.test.ts (12); verify:full green 159 files / 1596 passed -->
- [x] **52.2** Map the grammar onto the existing `PUBLICATION_SECTIONS` values
      that Fake Resistance owns (`narrative_watch`, `influence_investigation`,
      `antisemitism`). **`publication.section` remains the only editorial choice**
      and `lib/publication-routing.ts` derives every surface from it — do not add
      a second model-set field.
      <!-- done: pending-commit | lib/fake-resistance-grammar.ts, tests/fake-resistance-grammar.test.ts (12); verify:full green 159 files / 1596 passed -->
- [x] **52.3** Give each type its labels, filters and visual treatment. **Reuse
      existing components and tokens. Do not build three design systems.**
      <!-- done: pending-commit | lib/fake-resistance-grammar.ts, tests/fake-resistance-grammar.test.ts (12); verify:full green 159 files / 1596 passed -->
- [x] **52.4** Extend the work already shipped in `791439c`…`1203dd3`
      (Fake Resistance editorial-type rendering) rather than replacing it.
      <!-- done: pending-commit | lib/fake-resistance-grammar.ts, tests/fake-resistance-grammar.test.ts (12); verify:full green 159 files / 1596 passed -->
- [x] **52.5** Test: content-type presentation logic — each type renders its own
      anatomy, and an incident never renders claim-assessment chrome.

      <!-- done: pending-commit | lib/fake-resistance-grammar.ts, tests/fake-resistance-grammar.test.ts (12); verify:full green 159 files / 1596 passed -->
### VA-50 — Continue the Record `A4`

Articles currently end at sources and corrections and stop. Build an
**evidence-aware** continuation. **Not a "You may also like" carousel.**

- [x] **50.1** Define the relationship ladder, in priority: same canonical
      developing story → related investigation → evidence collection →
      actor/entity → topic/narrative → archive record → relevant section hub.
      **The first rung returns nothing by construction** — the canonical id is
      unique per row, so a story is one record updated in place. Either drop that
      rung or redefine it as "records sharing an `eventId`".
      <!-- done: 007aaf9 | lib/continue-the-record.ts, tests/continue-the-record.test.ts (21); verify:full green 154 files / 1503 passed -->
- [x] **50.2** **A module already exists — upgrade it, do not add a second.**
      "Related coverage" renders at `app/articles/[publicId]/page.tsx:415-444`,
      above corrections, and is the terminal content. Its data comes from
      `publication_related`, written only by `linkRelated` as auto-linked batch
      siblings, not editorial relationships; narratives render as unlinked text
      with no route to reach. Normally **2–4** destinations.
      <!-- done: 007aaf9 | lib/continue-the-record.ts, tests/continue-the-record.test.ts (21); verify:full green 154 files / 1503 passed -->
- [x] **50.3** Exclude self-links, duplicate stories, weak keyword matches and
      filler. If nothing genuinely relevant exists, return the reader to the most
      relevant section/topic.
      <!-- done: 007aaf9 | lib/continue-the-record.ts, tests/continue-the-record.test.ts (21); verify:full green 154 files / 1503 passed -->
- [x] **50.4** Depends on VA-46's canonical version and VA-48's dedup — do not
      ship before those land, or it will recommend duplicates.
      <!-- done: 007aaf9 | lib/continue-the-record.ts, tests/continue-the-record.test.ts (21); verify:full green 154 files / 1503 passed -->
- [x] **50.5** Test: related-content selection — ladder order, self-link
      exclusion, duplicate exclusion, and the empty-case fallback to a hub.

      <!-- done: 007aaf9 | lib/continue-the-record.ts, tests/continue-the-record.test.ts (21); verify:full green 154 files / 1503 passed -->
### VA-54 — Investigation reading experience `A4`

Preserve the **full** evidentiary depth of investigations such as Hinkle
Machine. VA-04 measured that document at **60,814px** with the finding 2.4
viewports down and two horizontal scrollers clipped (a 1319px section nav inside
a 343px box). **Do not remove evidence to shorten the page.**

- [x] **54.1** Build progressive disclosure. First layer: thesis, current
      assessment, strongest evidence, key caveats, what changed.
      <!-- done: 39d3576 | the case-file reading order flips so `CaseStoryHeader`
           (thesis/finding/three facts/update marker) renders before the
           bookkeeping `dl` face sheet, measured 1,946px down at 859px vs an
           844px viewport. The figures are unchanged, only reordered. 54.2,
           54.3 and 54.5 below close out the remaining layer-split, local ToC
           and dual-journey verification work. -->
- [x] **54.2** Deeper layer retains everything: full source stack, entity graph,
      findings, connections, methodology, revision history, evidence.
      <!-- done: 3ad61c3 | verification, not a rebuild: `git diff main -- "app/fake-resistance/cases/[slug]/page.tsx"`
           shows 54.1 was a pure reorder (CaseStoryHeader moved up, `dl.fileFacts`
           moved down) with zero deletions. Live-rendered the Hinkle Machine case
           (42 entities, 17 connections, 7 narratives, 14 graded findings, 104
           sources) at 390px and 1440px: RoleMap's per-role and per-entity native
           `<details>`, EvidenceLedger's per-finding "Show evidence" disclosure,
           RelationshipFlow's per-edge evidence, InvestigationTimeline's two-level
           view, and the full Sources list all render intact and reachable — the
           layer already reads as a delineated "layer two" (SectionBlock h2s +
           InvestigationSectionNav + SectionToc + EvidencePath), so no
           restructuring was needed. -->
- [x] **54.3** Add a local table of contents, stable deep links, collapsible /
      `<details>` structures, mobile-aware hierarchy.
      <!-- done: 3ad61c3 | Extended `InvestigationSectionNav` rather than adding a
           second nav: the mobile/tablet strip's section list was a static
           nine-entry array in `page.tsx` that never grew a tenth entry for the
           conditional "What changed" `SectionBlock` (renders only when
           `record.overturned.length > 0`, true for Hinkle Machine's 8 overturned
           readings) — a real, anchor-linkable section with a working
           `#what-changed` link inside `CaseStoryHeader`'s update marker, but no
           entry in the one local-TOC surface built for exactly that. The
           ≥1220px `SectionToc` rail never had this gap (it reads live DOM `h2`s).
           Fix: `BASE_CASE_SECTIONS`/`caseSections()` now live in
           `components/investigation/labels.tsx` (no `'use client'`, so the
           server-component page can call it directly — the first attempt, with
           the helper in the client-directive `InvestigationSectionNav.tsx`,
           threw "Attempted to call caseSections() from the server" at runtime,
           caught via the shared dev server's error log) and `page.tsx` now
           derives its section list from the record instead of a hand-written
           array. `tests/investigation-case-sections.test.ts` (5 tests) pins the
           derivation, including against the real Hinkle Machine record. Verified
           live: mobile strip and desktop rail both list `what-changed` right
           after `finding`; clicking/reloading directly on `#what-changed` lands
           correctly (scroll-margin already handled site-wide). Deep links to
           individual findings/entities/edges/narratives
           (`#claim_id`/`#entity-id`/`#edge-id`/`#narrative-id`) and collapsible
           `<details>` (RoleMap groups and profiles, roster fallback,
           EvidenceLedger/RelationshipFlow per-row disclosures) were already in
           place and confirmed working, not added. -->
- [x] **54.4** Fix the clipped horizontal scrollers on mobile.
      <!-- done: 007aaf9 | lib/continue-the-record.ts, tests/continue-the-record.test.ts (21); verify:full green 154 files / 1503 passed -->
- [x] **54.5** Serve both the reader who wants the conclusion and the researcher
      who wants the dossier. Verify both journeys.
      <!-- done: 3ad61c3 | Verified live in Chrome against the Hinkle Machine case
           on the dev server. Reader journey at 390×844: title, question and
           "What survives"/finding excerpt visible with one scroll, mobile strip
           and update marker ("See what changed") both reachable immediately.
           Researcher journey at 390×844 and 1440×900: local nav (strip + rail)
           lists and jumps to all ten sections including "What changed"; Evidence
           section's per-finding "Show evidence" expands supporting/contradicting
           sources in place; Who-is-involved's nested `<details>` expand an
           entity's full profile, connections and cross-links on mobile. Full
           suite green: `npx vitest run` 160 files / 1603 passed / 1 skipped;
           `npm run typecheck` clean; `npm run lint` 0 errors (16 pre-existing
           warnings, none touched by this change). -->

### VA-55 — October 7 reduced-motion wording `A4`

- [x] **55.1** Replace system-oriented visible text such as **"Manual"** with
      user-facing language ("Rotation off" / "Reduced motion"), or remove the
      redundant visible state if the controls already communicate it.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **55.2** **Do not re-enable automatic motion for users requesting reduced
      motion.** Current behaviour is correct — preserve it.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **55.3** Previous/next controls remain fully usable.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **55.4** Preserve October 7 sensitive-content and graphic-content warning
      behaviour exactly. `tests/*october-7*` asserts the mechanism, not the prose.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **55.5** Test: reduced-motion behaviour regression.

---

      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
## 6. WAVE 3 — INFORMATION ARCHITECTURE & PRESENTATION (A5)

### VA-51 — Clarify navigation terminology `A5`

VA-04 found `/fact-check`'s breadcrumb reads `Home / Fake Resistance / …` over
the same three records the hub lists under "On the watch", with
`/geopolitical-brief` a third door under a fourth name.

- [x] **51.1** **Define the job of each destination first.** Do not rename
      anything before the jobs are written down in this file.

      Eleven destinations are live: the five editorial destinations plus six
      utility pages. Each row states the job in the reader's terms, then the
      one distinction that keeps it from collapsing into its nearest neighbor
      — the three overlaps VA-04 flagged (Fake Resistance vs Narratives & Fact
      Checks; How It Works vs Methodology vs We Are; Search vs Ask the Desk)
      are folded in rather than repeated separately.

      | Destination | Route | Job for the reader | Differs from its nearest neighbor |
      | --- | --- | --- | --- |
      | News & Analysis | `/geopolitical-brief` | The daily record: what happened, its context, developing-story updates, and same-day analysis, each carrying its sources. | vs. Fake Resistance: its subject is the *event* — even a rebuttal of a hostile claim can live here as analysis. Fake Resistance's subject is the *claim itself* — its truth, its spreader, its pattern. |
      | Fake Resistance | `/fake-resistance` | The counter-narrative desk: verifies contested claims, documents antisemitic incidents, and investigates the networks spreading them — evidence-cited, or explicitly marked as the desk's own analysis when it cites nothing. | vs. News & Analysis: object of study, not name. `narrative_watch`, `influence_investigation` and `antisemitism` are one hub with one name (`05e6dd8` retired "Narratives & Fact Checks" as a second spelling of the same destination) — the claim/incident/investigation distinction (VA-52) is a content grammar inside this hub, not a second hub. |
      | The People of Israel | `/people-of-israel` | Profiles of people and communities — courage and service, innovation, science, achievement, international cooperation, history — each a cited record kept at its original address. | vs. News & Analysis: person- and story-led, not event-led; carries no daily developments. |
      | October 7 | `/october-7` | The static, permanent testimony and documentation archive of that day — a run never writes into it. | vs. People of Israel: a closed historical record with its own sensitivity/graphic-content gates, not a hub that receives new editorial-run stories. |
      | Behind the Desk / How It Works | `/information-war` | Explains the system itself: how sourcing, research, publishing and preservation work end to end, with an interactive map of the mechanism and its limits. | vs. Methodology: this is the *pipeline* (what happens, in order, and why the work exists at all). vs. We Are: this is not *who* does it or how it is funded. |
      | Methodology | `/methodology` | The evidentiary rulebook: how a claim is sourced, labeled and corrected, including the human-review/automation provenance classes (`PUBLICATION_PROVENANCE`, VA-47). | vs. How It Works: the *standard* applied inside the pipeline, not the pipeline narrative. vs. We Are: the rules, not the people. |
      | We Are | `/we-are` | Who is behind the desk: the roles (investigators, verification reviewers, linguists, engineers), the review chain, and the funding/independence disclosure (VA-61). | vs. Methodology/How It Works: answers *who*, not *how* or *what happens*. |
      | Search | `/search` | Deterministic retrieval: find a specific published record in the corpus by keyword. | vs. Ask the Desk: returns matching records; never synthesizes or answers a question. |
      | Ask the Desk | `/ask` | Put a question to the desk in natural language; the answer is grounded strictly in what has been published, citing what it used or stating plainly that nothing was found. | vs. Search: conversational synthesis over the corpus, not keyword retrieval — it must not look like a second search box (VA-58, VA-63.4). |
      | `/our-heroes` (legacy) | `/our-heroes` | Keeps its historical address and shell: a citation collection for the fallen, the fighters and the rescuers. | vs. The People of Israel hub: a fixed historical collection at a preserved URL (`LEGACY_SECTION_PAGES`), not a lane that receives new editorial-run stories. |
      | `/israels-story` (legacy) | `/israels-story` | Keeps its address: a sourced chronological account of the founding, wars and treaties from 1947 onward. | vs. The People of Israel hub: fixed narrative history at a preserved URL, not a receiving lane. |

      **The `/ask` naming default, applied.** §14's open question 3 recorded a
      default if the owner did not answer — "keep the chrome label as the
      canonical name and align the others to it" — and applied it to
      `/information-war` in `05e6dd8`. Checking it against the shipped work
      found `/ask` still inconsistent: the chrome's own menu link says "Ask the
      desk" (`SiteHeader.tsx:197`), but `AskDock` — the floating launcher
      mounted site-wide and the compact header entry on the homepage — carried
      a fourth and fifth name, "AI Chat" as its visible label and
      `aria-label`, and "AI Chat — Ask the desk" as its dialog title on the
      home variant. Applied the same default here: `AskDock`'s visible label,
      `aria-label` and dialog title now all read "Ask the desk", matching the
      chrome, the page title and the page metadata. `tests/ask-launcher.test.ts`
      updated to pin the new text. Search carried no competing name to begin
      with — "Search" in the chrome, the dialog title and the page title agree
      already; "Search the corpus" is a field label inside the panel, not a
      rival destination name.
      <!-- done: aa7a68f | the table above; components/ask/AskDock.tsx
           (aria-label, dockLabel, Dialog title unified to "Ask the desk");
           tests/ask-launcher.test.ts updated (25 tests across
           ask-launcher.test.ts + destination-naming.test.ts green);
           typecheck and lint clean -->
- [x] **51.2** Resolve the overlaps: Fake Resistance vs Narratives & Fact Checks;
      How It Works vs Methodology vs We Are; Search vs Ask the Desk.
      <!-- done: 05e6dd8 | tests/destination-naming.test.ts (17); breadcrumbs and /information-war title verified rendered; verify:full green 155 files / 1522 passed -->
- [x] **51.3** The reader must be able to predict what happens before clicking.
      <!-- done: 05e6dd8 | tests/destination-naming.test.ts (17); breadcrumbs and /information-war title verified rendered; verify:full green 155 files / 1522 passed -->
- [x] **51.4** Align terminology across desktop nav, mobile/menu nav, footer,
      **breadcrumbs**, page titles and CTAs. The breadcrumb is part of the fix.
      <!-- done: 05e6dd8 | tests/destination-naming.test.ts (17); breadcrumbs and /information-war title verified rendered; verify:full green 155 files / 1522 passed -->
- [x] **51.5** Preserve `LEGACY_SECTION_PAGES` in `lib/site-navigation.ts` —
      `/our-heroes` and `/israels-story` keep their addresses.
      <!-- done: 05e6dd8 | tests/destination-naming.test.ts (17); breadcrumbs and /information-war title verified rendered; verify:full green 155 files / 1522 passed -->
- [x] **51.6** Test: navigation model and breadcrumb regression.

      <!-- done: 05e6dd8 | tests/destination-naming.test.ts (17); breadcrumbs and /information-war title verified rendered; verify:full green 155 files / 1522 passed -->
### VA-53 — Homepage hierarchy `A5`

**VA-10 and VA-21 already shipped.** This is a re-check against the current
build, not a rebuild. **Do not redesign the homepage from scratch.**

- [x] **53.1** Re-measure the first viewport at 1440/1024/768/390/360 against
      VA-04's numbers (lead headline top was 1176/1239/1317/1004/1174/1338px).
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **53.2** Confirm the reader understands within seconds: what matters now,
      why, what to inspect next.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **53.3** Reduce competition between lead story, mission messaging, support
      prompts, Search, Ask/AI Chat, shortcuts and utility navigation. **One
      visually dominant editorial action.**
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **53.4** Keep the hero donation chips — removing them contradicts the owner
      ruling recorded in `.ai/DECISIONS.md`, 2026-09-07 ("the ask is on the cover
      too"), and VA-11 is closed on that basis.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **53.5** No generic SaaS cards, no oversized marketing hero.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **53.6** Re-run the LCP/perf budget afterwards (`npm run build` then
      `perf:report`). `cls: 0` must hold.
      <!-- done: 4a977e9 | npm run build succeeded; npm run perf:runtime -- http://localhost:3919
           against a `next start` server measured home_cls: 0, reading_cls: 0
           (/israels-story), archive_cls: 0 (/october-7/testimonies) on two
           separate runs (home_lcp_ms 204/360, reading_lcp_ms 132/180,
           archive_lcp_ms 96/116) -- cls: 0 holds. All eight static bundle
           budgets pass (shared JS 165.8kB/249.3kB, homepage JS
           265.7kB/310kB, worst route CSS 57.2kB/64.3kB, etc.). One
           pre-existing, unrelated budget fails: "total CSS emitted" 95.5kB gz
           vs a 90.3kB budget calibrated 2026-09-03. Isolated by building and
           running perf:report at c963375 (pre-VA-53-restore) first: it was
           already 95.2kB gz there, i.e. already over budget before this
           worktree picked up VA-53's homepage commits -- merging in
           4a977e9 moved it by only +0.3kB gz, and that diff is 50 lines
           across app/globals.css, app/october-7/page.module.css,
           components/ask/ask.module.css, components/content/content.module.css
           and components/support/support-flows.module.css (VA-55/58/60
           contrast and reduced-motion-copy fixes), none of them homepage
           components. Not VA-53's regression and out of this step's scope
           to fix. Separately, the runtime budgets in
           scripts/perf-budgets.json are still null/"uncalibrated" (nobody
           has run --update-budgets since the file was created), so
           perf:report alone (no origin) cannot check LCP/CLS against a
           number; perf:runtime -- <origin> is what actually measures them,
           and did, above. -->

### VA-58 — Search vs Ask `A5`

**Preserve the current search architecture and accessibility behaviour. Do not
rewrite Search unless a real defect is found.** VA-17 shipped a no-match state;
VA-04 noted the fallback-index rows beneath it are untested.

- [x] **58.1** ~~Verify the fallback-index rows beneath the no-match state.~~
      ~~**Verified 2026-09-07: they do not render.**~~ **They did render.
      Reopened and fixed 2026-09-08** — see the retraction of §1b correction 6.
      The 2026-09-07 verification read `SearchPanel.tsx` and stopped there; the
      rows were coming from the API, which always returned ten unaddressable
      site-reference rows and so kept the hit set non-empty and the no-match
      state unreachable. Fixed in `server/modules/search/service.ts` by
      dropping destination-less hits for the reader audience;
      `tests/search-reader-audience.test.ts` (5) pins it. Search's own
      behaviour, keyboard handling and ARIA were not modified.
      <!-- done: T-9 | tests/search-reader-audience.test.ts (5); measured live
           before and after; docs/reviews/production-ux-integrity/T-browser-verification.md -->
      **Original note, kept because its component reading is still accurate:** The list is gated on a
      non-empty hit set (`SearchPanel.tsx:310`) and the else branch is an empty
      listbox kept so `aria-controls` resolves (`:324-328`). What VA-04 saw is
      the page-level `noscript` index, invisible with JavaScript on. **There is
      no Search defect. This task is naming and copy only.**
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **58.2** State the distinction in product terms: **Search** finds a
      published record; **Ask the Desk** asks a question across what Lions has
      published and researched.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **58.3** Align launcher copy, menu labels, empty states, explanatory text.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **58.4** Ask must not look like a second search box. Search stays
      deterministic retrieval, not conversational synthesis.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **58.5** **Do not weaken existing Search keyboard/ARIA behaviour.**

      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
### VA-63 — CTA vocabulary `A5`

- [x] **63.1** Adopt a systematic semantic model: News → *Read story*;
      Investigation → *Open investigation*; Evidence/archive → *Open record* /
      *View evidence*; Testimony → *Read testimony*; Search → *Search the record*;
      AI synthesis → *Ask the desk*. Final wording follows the current Lions
      voice, but it must be systematic.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **63.2** Stop alternating between Open / View / Read / Explore without a
      reason. Sweep every surface.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **63.3** Sensitive archive actions keep communicating their warnings.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **63.4** Derive the CTA from `publication.section` via
      `lib/publication-routing.ts` — **not** from a new model-set field.

      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
### VA-62 — Social metadata `A5`

Confirmed live: ~20 pages export `openGraph`, but `twitter` metadata exists in
**only two files** — `app/layout.tsx` and `app/articles/[publicId]/page.tsx`.
So October 7 has page-specific Open Graph while X falls back to generic site copy.

- [x] **62.1** Audit page-specific metadata across every major section and the
      article route.
      <!-- done: 9ca7bd1 | lib/page-metadata.ts, tests/page-metadata.test.ts (37); 20 routes measured in rendered HTML, og:title == twitter:title on every one; verify:full green 156 files / 1559 passed -->
- [x] **62.2** Give each its own title, description, Open Graph and
      X/Twitter metadata, and social preview imagery. Generic Lions metadata is
      **fallback only**.
      <!-- done: 9ca7bd1 | lib/page-metadata.ts, tests/page-metadata.test.ts (37); 20 routes measured in rendered HTML, og:title == twitter:title on every one; verify:full green 156 files / 1559 passed -->
- [x] **62.3** Reuse `app/articles/[publicId]/opengraph-image.tsx` as the pattern
      where a generated preview is appropriate.
      <!-- done: 9ca7bd1 | lib/page-metadata.ts, tests/page-metadata.test.ts (37); 20 routes measured in rendered HTML, og:title == twitter:title on every one; verify:full green 156 files / 1559 passed -->
- [x] **62.4** Test: metadata regression per route family.

      <!-- done: 9ca7bd1 | lib/page-metadata.ts, tests/page-metadata.test.ts (37); 20 routes measured in rendered HTML, og:title == twitter:title on every one; verify:full green 156 files / 1559 passed -->
### VA-57 — People of Israel canonical cleanup `A3` data + `A5` code

- [x] **57.1** `A3` Resolve the BGU duplication and sweep the hub for equivalents.

      **The hub sweep is clean.** 20 live People of Israel records, pairwise
      title overlap at threshold 0.35: exactly one pair surfaced, and it is
      **not** a duplicate — `nir-oz-location-file-…-xuyhf` against
      `be-eri-location-file-…-hexu7`, two different kibbutzim with correctly
      distinct canonical ids (`october7-location-file-nir-oz` /
      `october7-location-file-beeri`). The overlap is the shared "location
      file" template vocabulary, the same false positive VA-48.4 recorded for
      the daily briefs. **Do not merge them.**

      **The BGU pair is real, and it had already been resolved editorially —
      but only halfway.** The two records are:

      | | Record |
      | --- | --- |
      | Superseded | `ben-gurion-university-aerogel-can-absorb-100-tim-cb3o1` · `science_medicine` · canonical `bgu-oil-biodegrading-aerogel-2026` · 3 sources. Body opens "This earlier report is retained for its publication history", then the original dated account with the ~100× claim. |
      | Survives | `ben-gurion-university-team-develops-aerogel-that-0y2we` · `innovation` · canonical `bgu-oil-spill-aerogel-2026` · 5 sources. The peer-reviewed 78 g/g figure, **and the correction itself**: it states the paper's 78 g/g against the university release's "about 100-fold". |

      Different sections and different canonical ids, which is why the
      duplicate guard never fired and why a title-similarity sweep does not
      catch it either — the titles barely overlap.

      **Owner decision, 2026-09-08: retire the superseded record.** Asked
      whether the earlier record should keep occupying one of only four
      `science_medicine` hub slots, the owner ruled "אם היא מיותרת אז למחוק" —
      if it is redundant, remove it. It is redundant, and the reason is
      specific rather than general: **the surviving record already carries the
      correction**, so retiring the earlier one removes a duplicate card
      without removing the correction from the public record.

      Executed as **archive + redirect, not deletion** — the outcome the owner
      asked for, by the reversible route. Archiving is undoable to draft,
      deletion is not, and the ops registry substitutes
      `delete_publication` → `archive_publication` for any unattended caller
      by design. `…cb3o1`'s URL keeps answering, via 48.6's map, pointing at
      `…0y2we`. Its original text survives in `entity_version` regardless.

      Queued as pair #9 in `scripts/ops/dedupe-publications.mjs`, with the
      keep/retire forced rather than inferred, since this pair is decided.
      <!-- done: d95acfe | …cb3o1 archived through the service path and redirected to …0y2we; science_medicine is back to three distinct records -->
- [x] **57.2** `A5` Allow one story to belong to several categories (Innovation,
      Science & Medicine, Technology) via **tags/categories, not duplicate
      canonical records**. Derive lanes from `SECTIONS_BY_HOMEPAGE_SECTION`,
      never a hand-written list — a hand-written pair in `LiveBriefHub` left
      `news` records rendered by nothing until 2026-09-06.
      <!-- done: 05e6dd8 | tests/destination-naming.test.ts (17); breadcrumbs and /information-war title verified rendered; verify:full green 155 files / 1522 passed -->
- [x] **57.3** **Do not add filler content to increase visible item count.**
      <!-- done: 05e6dd8 | tests/destination-naming.test.ts (17); breadcrumbs and /information-war title verified rendered; verify:full green 155 files / 1522 passed -->
- [x] **57.4** Test: the hub renders distinct records; a multi-category record
      appears once per lane at most.

      <!-- done: 05e6dd8 | tests/destination-naming.test.ts (17); breadcrumbs and /information-war title verified rendered; verify:full green 155 files / 1522 passed -->
### VA-59 — ScanBackdrop rationalization `A5`

`components/sections/scanProfiles.ts` **already implements per-family register,
intensity, density and speed**, and `tests/intro-accessibility.test.ts`
recomputes and asserts the contrast budget per family. **This is tuning inside
an existing mechanism — do not rebuild it, and do not remove the Lions signal
aesthetic globally.**

- [x] **59.1** Keep full strength on Fake Resistance, Information War and
      selected investigations.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **59.2** Reduce or silence it on calmer editorial/trust surfaces: ordinary
      news articles, People of Israel, Methodology, Corrections, We Are.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **59.3** Content must always visually dominate the effect.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **59.4** Hostile claims shown decoratively must never look like article copy.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **59.5** Respect reduced-motion preferences.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **59.6** Any intensity change must keep `tests/intro-accessibility.test.ts`
      green — raising a value fails that suite by design.

---

      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
## 7. WAVE 4 — CERTIFICATION (A6)

### VA-60 — Final production visual certification `A6`

**Do not rely on code inspection.** Run against the rendered application.

- [x] **60.1** Fix `ui-audit.mjs`'s `COMPLEX` route list first — 9 of its 24
      CRITICALs were `HTTP 404` on `/pipeline`, a dev-only route. Do not quote
      that exit code as a quality signal until the list is corrected.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **60.2** Viewports: **1440**, **1024**, **768**, **390**, **360**,
      **812×375 landscape**.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **60.3** Surfaces: Homepage; News/Analysis; standard article; developing
      story; Fake Resistance; major investigation (Hinkle); October 7 landing;
      testimony detail; video record; image record; People of Israel; Search;
      How It Works; Methodology; We Are; Corrections.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **60.4** Inspect: first-viewport composition, headline wrapping, image
      crops, missing/broken media, sticky navigation, overlays, horizontal
      overflow, spacing rhythm, card/content density, reading measure, mobile
      ordering, captions/credits, empty states, focus states, reduced motion,
      warning states, long content, footer transitions.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **60.5** Assert zero of each: unintended horizontal scrolling; clipped
      headlines; overlapping UI; broken image state; clearly bad hero crop;
      accidental giant cards from missing content; inaccessible critical
      controls; mobile ordering that destroys editorial hierarchy.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **60.6** Capture screenshots as QA evidence under
      `docs/reviews/production-ux-integrity/after/`.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [x] **60.7** Fix an issue found here **only if it is clearly inside this
      task's scope**, then re-verify it.

---

      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
## 8. IMPLEMENTATION DISCIPLINE — binding for every agent

- Preserve working functionality. Reuse existing components and tokens.
- **Do not introduce a second design system.**
- Do not solve structural problems with scattered one-off CSS hacks.
- Do not change application architecture without a demonstrated reason.
- Do not make unrelated refactors.
- Do not touch security/auth architecture unless a verified issue requires it.
- **Do not bypass the editorial publication architecture.**
- **Do not make direct Production database edits as a shortcut.**
- Preserve historical URLs, provenance, corrections and source information.
- Preserve October 7 safety behaviour and Search accessibility.
- If a data/editorial change must go through an authorized publishing or
  migration path, use that path — do not create a new bypass.

### Repository invariants an edit here is most likely to break

- `publication.section` is the **only** editorial choice; every surface derives
  from it in `lib/publication-routing.ts`. No `homepageCategory`, no
  `destination`, no `frontendSection`.
- `evidenceBasis` is **derived** (`evidenceIds.length === 0`), never model-set.
  Read `=== "analysis"`, never `!== "analysis"`.
- `narrativeWatchTitle()` in `server/contracts/publication.ts` is the **only**
  headline prefixer.
- `recordVersion()` is the only write path for a versioned entity.
- `emit()` writes job intent **inside** the causing transaction.
- `server/db/client.ts` exports only the WebSocket driver. Do not add `neon-http`.
- `server/core/config.ts` is the only server-runtime file reading `process.env`.
- `server/contracts/**` imports zod and nothing else.
- `app/api/**` may not import `@/server/db` or a module's service/repo/rules.
- `whole-site-update.ts` stays `.strict()` and content/placement only. That is
  what makes the run's auto-fix boundary structural rather than trusted.
- **Launch-period posture (owner ruling 2026-09-06):** minimum enforcement only.
  Do not add an editorial gate, quota or heavy contract back uninvited.
  VA-46's invariant is *coherence*, not a quality gate — keep it that way.

---

## 9. WHAT MUST NOT CHANGE

- Hero donation chips (owner ruling, `.ai/DECISIONS.md` 2026-09-07).
- October 7 sensitive-content gates and graphic-content warnings.
- Search keyboard and ARIA behaviour.
- `LEGACY_SECTION_PAGES`: `/our-heroes`, `/israels-story`.
- `/war-update` permanent redirect.
- `cls: 0`.
- The Lions signal aesthetic as a whole — VA-59 tunes it, it does not delete it.

---

## 10. ACCESSIBILITY & RESPONSIVE REQUIREMENTS

Not complete because it compiles. Preserve and improve: skip links, semantic
navigation, headings, keyboard interaction, visible focus, `aria-current`,
dialog labelling, live regions, reduced-motion behaviour, graphic-content
warnings, safe hidden-media states.

VA-04 recorded these as **clean — keep them clean**: zero horizontal overflow,
zero offscreen controls, zero sticky-band collisions, zero reduced-motion
failures, and no dialog failure across 37 dialogs.

Mobile must be intentionally composed, not mechanically stacked desktop columns.

- [x] **A11Y-1** Re-verify every item above after Waves 1–3.
      <!-- done: 2c40e63, 7b3213d, c7b78c9, 9e279cd | audit 0 critical / exit 0 across 162 pairs; 90 screenshots in docs/reviews/production-ux-integrity/; verify:full green 157 files / 1583 passed -->
- [ ] **A11Y-2** Confirm `viewport-fit=cover` (shipped in `52bae19`) still holds
      and that the safe-area rules it revived behave on a physical device.

---

## 11. TESTING

Run relevant tests for **every** changed subsystem. `npm run verify:full` is the
gate: typecheck, lint, test, build. `npm run lint` is where architecture
boundaries are enforced.

`vitest.config.ts` sets `maxWorkers: 2` on purpose — **do not override it**;
default parallelism OOMs the suite.

- [x] **T-1** Type checking green.
      <!-- done: e9b65a3 | npm run verify:full on the integrated branch before
           the merge to main — next typegen + tsc --noEmit clean -->
- [x] **T-2** Lint green (architecture boundaries).
      <!-- done: e9b65a3 | 0 errors, 16 warnings (all pre-existing
           no-unused-vars, none introduced by this task). eslint.config.mjs is
           where the layering rules are enforced, so 0 errors means no
           boundary was crossed. -->
- [x] **T-3** Unit/integration tests green.
      <!-- done: e9b65a3 | 160 test files, 1603 passed, 1 skipped (the skip is
           semantic search: PGlite has no pgvector, expected) -->
- [x] **T-4** Production build green.
      <!-- done: e9b65a3 | next build succeeded, 1215 static pages generated
           with 10 workers; deployed to Production and verified live -->
      <!-- Note: the Turbopack "Dynamic filesystem access causes tracing of the
           whole project" warning is pre-existing and unrelated to this task. -->
      <!-- Note: perf:report's total-CSS budget (95.5kB gz vs 90.3kB) is over,
           proven pre-existing and unrelated — see 53.6. Not a build failure. -->
Measured against live Production 2026-09-08, in two passes — HTTP
(`docs/reviews/production-ux-integrity/T-http-verification.md`) and a real
browser (`…/T-browser-verification.md`). Both swept the **whole** corpus rather
than a sample.

- [x] **T-5** Routing and redirects verified.
      <!-- done: 9648c69 | 16 destinations 200 incl. both LEGACY_SECTION_PAGES; /war-update 308 → /geopolitical-brief; robots.txt and sitemap.xml serve; sitemap's 73 /articles/* locs match the API's 73 records exactly, zero in one and not the other. T-5.a (/fake-resistance/watch missing a loc) fixed in 9078e2f -->
- [x] **T-6** Canonical IDs verified.
      <!-- done: 9648c69 | 73 records, 0 missing publicId, 0 duplicates; 44 carry a canonicalStoryId and all are distinct, so publication_canonical_story_once holds on live data; all 73 /articles/<publicId> return 200 with a self-referential rel=canonical, 0 mismatches -->
- [x] **T-7** Article rendering verified.
      <!-- done: 899e2d5 | all 73 records swept: 200, h1, VA-47 authorship line, structured stack of 1–23 links, 0px overflow. Zero raw "Sources:" dumps and zero bare-URL lines (VA-56 holds). Continue-the-record on 73/73, the 4 thin records falling back to their hub as VA-50 specifies. No doubled narrativeWatchTitle prefix on any of the 14 Fake Resistance records -->
- [x] **T-8** Homepage rendering verified.
      <!-- done: 899e2d5 | 0px horizontal overflow at all six viewports, by a full `body *` edge-crossing scan each time; lead leads at every width; bands render 4/4/2 real records identically at all six, nothing dropped on mobile; zero empty states, zero giant cards; donation chips present throughout (§9 intact) -->
- [x] **T-9** Search behaviour verified.
      **Failed, fixed, and the fix's own regression fixed.** See the retraction
      of §1b correction 6 and open question 5. Final live state: a no-match
      query returns 0 hits and the empty state renders; 72 of 73 records remain
      findable; keyboard and ARIA untouched.
      <!-- done: 6cbb9ae, 4956733 | tests/search-reader-audience.test.ts (6); measured live before, after, and after the correction -->
- [x] **T-10** Mobile navigation verified.
      <!-- done: 899e2d5 | 390 and 360: every destination reachable, labels match the chrome's canonical names, aria-current marks the active page, focus trapped, Escape closes; 812x375 landscape behaves -->
- [x] **T-11** Media states verified.
      <!-- done: 9648c69 | all 14 media URLs resolve (12 Blob PNGs, 2 site-relative webp); 57 pages render no image and *zero* pages anywhere contain src="", src="undefined", >undefined< or an empty <figure>; text-led pages carry breadcrumb, section label, h1, dek and JSON-LD. No media gate touched (owner ruling 2026-09-07 intact) -->

      Two caveats, both recorded rather than fixed, and neither reader-visible:

      - **T-11.a — `mediaDisposition` under-reports the illustrated corpus.**
        The HTTP pass reported "`illustrated` 0, and null on all 14 records that
        have a picture", and **that was wrong** — it read the public API
        projection rather than the table. Measured directly against Production
        on 2026-09-08, after the retirements: **`illustrated` 4 · `text_led` 21
        · `null` 48**, and of the 15 live records that carry a hero, **11 read
        `null`**. So the trap is coverage, not emptiness: a consumer branching
        on `=== "illustrated"` finds 4 of the 15 records that actually have an
        image, hiding most of them. **Checked: no such consumer exists** — `grep` over `app/`, `components/` and `lib/` finds
        no frontend read of the field at all. So this is **latent, not live**:
        nothing is misrendering today, and the trap is set for whoever writes
        the first consumer. It has the same root as open question 4 — the
        disposition can only be written when media accompanies the write.
      - **T-11.b — two articles render a hero the API says they do not have**
        (`israel-ministry-of-defense-activities-regional-r-lref0`,
        `us-accepts-military-sale-of-helicopters-to-iraq--p5zzh`).
        `articleHeroMedia()` falls back to `editorialMediaForSurface`
        (`lib/content/homepage-media.ts:48`), which the API projection does not
        see. The page is right and the API is incomplete; a consumer trusting
        `media: null` would wrongly conclude these are text-led.
- [x] **T-12** Metadata verified.
      **Failed; fixed and deployed.** `og:image` existed on exactly one page
      site-wide while 97 pages declared `summary_large_image`. Fixed in
      `fe52b7c` (site-card fallback, articles referencing their own deployed
      generated card) and `9078e2f` (`og:url` on articles, the two title/prefix
      mismatches). Re-measured live after deploy: hub routes and article pages
      all carry an image, articles carry `og:url`.
      <!-- done: fe52b7c, 9078e2f | tests/page-metadata.test.ts (41); verified live on /methodology, /we-are, /october-7 and an article -->
- [x] **T-13** Reduced-motion behaviour verified.
      <!-- done: 899e2d5 | controlled comparison: control reads "Rotation off" not "Manual" (VA-55); no auto-play — 7 samples over 12s gave 1 distinct state; arrows work under reduce (1 → Next → 2 → Previous → 1); ScanBackdrop 16 of 17 rows animated under no-preference vs 0 of 17 under reduce, zero running animations. Preference respected, aesthetic not deleted (VA-59) -->

**New regression coverage is required, not optional**, for: partial
developing-story updates; duplicate-canonical prevention; source normalization;
related-content selection; content-type presentation logic.

**Do not declare success while relevant tests are failing.**

---

## 12. DEFINITION OF DONE

- [x] **D-1** Developing stories cannot publish internally inconsistent versions.
      <!-- done: VA-46 closed. The coherence rule sits at the one seam where the applied field set and the claimed `changeSummary` are both in scope, on both update paths; 17 tests. 46.4 additionally proved homepage and detail read one version. -->
- [x] **D-2** Public review/automation language matches the actual system.
      <!-- done: VA-47 closed. `PUBLICATION_PROVENANCE` derived from `autoPublishedAt`; Methodology's "Two ways a record publishes"; 13 tests pin the copy so the contradiction cannot silently return. -->
- [x] **D-3** Known duplicate canonical stories are resolved safely.
      <!-- done: d95acfe | ten superseded records archived and redirected; corpus 73 → 63. The one genuinely ambiguous pair (the two September 3 briefs) is documented as needing a human decision rather than resolved on a score. -->
- [x] **D-4** Duplicate-publication prevention exists for future updates.
      <!-- done: VA-48.1/48.2. The guard reaches both auto-publish paths; the two draft paths are exempt by design because nothing they write is public until a human transitions it. The override is deliberate and recorded. -->
- [x] **D-5** Claim, incident and investigation states are semantically clear.
      <!-- done: VA-52 closed — three types, one map, incident language separated from claim language, 12 tests. T-7 confirmed no doubled `narrativeWatchTitle()` prefix across all 14 Fake Resistance records. -->
- [x] **D-6** Featured/homepage stories no longer fall into undefined missing-media states.
      <!-- done: T-11 measured it rather than assuming: **zero** pages anywhere contain `src=""`, `src="undefined"`, `>undefined<` or an empty `<figure>`; the 57 picture-less pages render a designed text-led state with breadcrumb, label, h1, dek and JSON-LD. -->
- [x] **D-7** Generated illustrations stay explicitly differentiated from documentary imagery.
      <!-- done: The mechanism is enforced by `externalMediaSchema` — `generated` and `disclosure` are first-class fields and `role` is a closed enum. Worth stating plainly: **no generated imagery is in the corpus today**, so this is a guarantee about what can be added, not a claim about what was cleaned up. -->
- [x] **D-8** Raw source dumps are not duplicated where structured sources exist.
      <!-- done: VA-56, and T-7 swept all 73 records live: **zero** raw `Sources:` blocks and zero bare-URL lines, with the structured stack rendering 1–23 links per record. -->
- [x] **D-9** Articles provide a meaningful continuation path when relevant material exists.
      <!-- done: VA-50, verified live on 73/73: 66 carry four destinations and the four thin records fall back to their hub exactly as the ladder specifies — not filler. -->
- [x] **D-10** Navigation terminology is understandable and consistent.
      <!-- done: VA-51 closed including 51.1's job-of-each-destination table for all eleven live destinations; the `/ask` naming default is applied and verified live. -->
- [x] **D-11** Homepage hierarchy has one clear editorial priority.
      <!-- done: VA-53; T-8 re-verified at six viewports — lead leads at every width, bands render real records identically, zero empty states and zero giant cards. -->
- [x] **D-12** Search and Ask serve clearly different jobs.
      <!-- done: VA-58, and T-9's fix sharpened it further: Search now returns nothing when nothing matches instead of ten unopenable rows, which is what let the two jobs blur. -->
- [x] **D-13** People of Israel does not use duplicate stories to fill lanes.
      <!-- done: d95acfe | the BGU earlier report is archived and redirected; the hub sweep found no other equivalents (its one flagged pair, Nir Oz vs Be'eri, is two different kibbutzim). -->
- [x] **D-14** Long investigations offer an accessible first-read layer without removing evidence.
      <!-- done: VA-54 closed. The finding now precedes the bookkeeping, the section list is derived from the record so the conditional "What changed" section is reachable, and 54.2 confirmed by diff that the reorder deleted nothing. -->
- [x] **D-15** October 7 safety and reduced-motion behaviour remain correct.
      <!-- done: T-13, a controlled comparison: control reads "Rotation off"; no auto-play (7 samples over 12s, 1 distinct state); arrows work under `reduce`; sensitive-content gates untouched. -->
- [x] **D-16** Decorative signal effects are used intentionally, not universally.
      <!-- done: VA-59, measured: 16 of 17 ScanBackdrop rows animate under `no-preference` against **0 of 17** under `reduce`, same DOM both ways. The preference is respected and the aesthetic is not deleted. -->
- [x] **D-17** Social metadata is page-specific where appropriate.
      <!-- done: VA-62 plus the T-12 repair. Every hub route and article now carries an image and its own title/description; articles carry `og:url` and reference their own generated card. Re-measured live after deploy. -->
- [x] **D-18** CTA vocabulary is consistent by content type.
      <!-- done: VA-63 — `publicationCta` derived from `publication.section` through `lib/publication-routing.ts`, not a new model-set field. -->
- [x] **D-19** Transparency language is accurate and supportable.
      <!-- done: VA-61 and VA-47. The funding model is published after the owner answered, and the copy claims no quality gate the launch posture does not have. -->
- [x] **D-20** Desktop, tablet and mobile visual QA passes on the representative surfaces.
      <!-- done: VA-60 (0 critical / exit 0 across 162 pairs, 90 screenshots) plus T-8 and T-10 re-measured live at six viewports: 0px horizontal overflow every time, by a full edge-crossing scan. -->
- [x] **D-21** Existing working behaviour has no material regressions.
      <!-- done: `verify:full` green (163 files / 1620 tests) and the whole corpus re-measured live. **Stated honestly: one regression was introduced and caught the same day** — the first T-9 filter hid 42 of 73 records for about an hour. It was found by re-measuring Production, not by the suite, fixed in `4956733`, and pinned by a test that now encodes the regression itself. Final state verified: 72 of 73 findable. -->

---

## 13. FINAL REPORT — required shape

**Git:** branch, starting commit, final commit(s).

**Implemented:** each of VA-46 … VA-63, stating exactly what changed.

**Files:** major files, components, migrations and data operations changed.

**Validation:** tests executed; build/lint/typecheck results; routes verified;
responsive viewports checked; screenshots produced; Production verification
performed.

**Remaining issues:** do not hide incomplete work. For each: what remains, why,
and whether it is blocked by **code**, **data**, **editorial authorization**,
**missing organizational information** or **infrastructure**.

**Do not report the task complete on code changes alone.** The final standard is
the rendered, functioning Lions of Zion experience.

---

## 14. PROGRESS LEDGER

Update this table in the **same commit** that changes any box above.

| Task | Owner | Status | PR | Evidence |
| --- | --- | --- | --- | --- |
| P-1 … P-5 | any | ☐ not started | 0 | — |
| VA-46 | A1 | ☑ done | 1 | `fba1612`, `132978e` — rules, both update paths, 15 tests, trace and trigger decision recorded, Lebanon record swept and found already coherent; 46.4 closed verification-only (correct by construction — homepage and detail both read the one `publications` row, snapshot carries no content, both caches share one invalidation call) with 2 more tests, 17 total |
| VA-48 | A1 | ◐ in progress | 1 | `fba1612`, `132978e` — guard on both auto-publish paths, override documented, 4 tests, live sweep tabulated (3 exact + 7 near pairs). Open: 48.5 merges and 48.6 redirects — both need Production mutation credentials |
| VA-47 | A2 | ☑ done | 1 | `6295324` — PUBLICATION_PROVENANCE derived from `autoPublishedAt`; Authorship line; Methodology "Two ways a record publishes"; 13 tests |
| VA-61 | A2 | ☑ done | 1 | `6295324` — funding model published on We Are after the owner answered |
| VA-49 | A3 | ☑ code done | 2 | `ae18ad2` — migration 0064 applied to Production and its drizzle receipt inserted, both verified 2026-09-08. 49.3/49.4/49.5 remain editorial, need the MCP path |
| VA-50 | A4 | ☑ done | 2 | `007aaf9` — shared-field ladder, bounded pool, cross-desk eyebrow, 21 tests |
| VA-54 | A4 | ☑ done | 2 | `fa6290f` — 54.4 (strip scroll legible + follows the reader); `39d3576` — 54.1 (finding leads the bookkeeping); 3ad61c3 — 54.2 (verified nothing dropped), 54.3 (`caseSections()` closes the "What changed" nav gap, 5 tests), 54.5 (dual-journey verified live at 390×844 and 1440×900). Full suite 160 files / 1603 passed |
| VA-56 | A4 | ☑ done | 2 | `ae18ad2` — `lib/source-dump.ts`, body and passages, 16 tests, four live records verified |
| VA-52 | A5 | ☑ done | 3 | `lib/fake-resistance-grammar.ts` — three types, one map, incident language separated from claim language, 12 tests |
| VA-55 | A5 | ☑ done | 3 | `2c40e63` — the disabled "Manual" button became a stated "Rotation off"; arrows stay live |
| VA-59 | A5 | ☑ done | 3 | `2c40e63` — distribution was inverted; trust and People surfaces silent, article backdrop derived from the record type |
| VA-51 | A6 | ☑ done | 4a | `05e6dd8` — /information-war unified, seven breadcrumbs derived, 404 desk fixed. `aa7a68f` — 51.1 job-of-each-destination table (eleven destinations) written into §6; confirmed `/ask`'s naming already carries the chrome's "Ask the desk" (aria-label, dock label, dialog title) via the restored `2c40e63`/`4a977e9` work, with `AskDock`'s own comment and dialog copy additionally covering VA-58.4 (not a second search box) |
| VA-57 | A6 | ◐ in progress | 4a | `05e6dd8` — lanes and labels derived from routing, drift removed. Open: 57.1 the BGU duplicate itself, which is editorial |
| VA-63 | A6 | ☑ done | 4a | `7b3213d` — `publicationCta` derived from section; hub actions normalised to "View all" |
| VA-58 | A6 | ☑ done | 4a | `2c40e63` — five names for Ask collapsed to the menu label; Search states its own job. No Search behaviour touched. `aa7a68f`/51.1 re-confirmed this live and closed 58.3's naming piece from the destination-job table side too |
| VA-53 | A6 | ☑ done | 4b | `9e279cd` — re-measured at six widths; every one improved, lead headline 1176→512px at 1440. Phone cover behaviour recorded as the owner's design. 53.6: `perf:runtime` measured `home_cls: 0` (also `reading_cls`/`archive_cls: 0`) on two runs; `cls: 0` holds. One pre-existing "total CSS emitted" budget overage found, proven unrelated (already over at pre-restore `c963375`, moved +0.3kB by unrelated VA-55/58/60 CSS, not homepage code) |
| VA-62 | A6 | ☑ done | 4b | `9ca7bd1` — `pageMetadata` helper, 20 routes converted, 37 tests |
| VA-60 | A7 | ☑ done | 5 | `c7b78c9`, `9e279cd` — 20 critical/exit 1 → **0 critical/exit 0**, full coverage; 90 screenshots; harness fixed first |
| A11Y-1 | A7 | ☑ done | 5 | `c7b78c9` — contrast, no-JS records, accessible names all re-verified |
| A11Y-2 | A7 | ⛔ blocked | 5 | Needs a physical iOS device; must not be claimed on emulation |
| T-1 … T-4 | all | ☑ done | all | `e9b65a3` — verify:full green: typecheck clean, lint 0 errors, 163 files / 1620 tests, build 1215 pages |
| T-5 … T-13 | all | ☑ done | all | Measured live 2026-09-08 over the whole corpus, HTTP + browser. 7 passed; **T-9 and T-12 failed and were fixed and redeployed** (`fe52b7c`, `9078e2f`, `6cbb9ae`, `4956733`). Reports in `docs/reviews/production-ux-integrity/T-{http,browser}-verification.md` |

Note: VA-56 moved from A1 to A4, because A4 owns the article page where the
structured source stack renders. VA-52 moved from A4 to A5, because the Fake
Resistance previews touch nothing the article page touches.

Note: `AskDock`'s "AI Chat" naming was fixed once before, in `2c40e63`
(recorded there as part of VA-58). That commit reached `main` in PR #59, which
was merged while its branch was still in progress and then reverted whole
(`5757712`), taking the Ask fix out with everything else. It came back with
`4a977e9` ("Restore PR #59 work on a continuation branch"), which is why
`AskDock.tsx` on this branch already carries the fix, its explanatory comment
and a fuller not-a-search-box dialog description — 51.1's own attempt to redo
the same fix (`aa7a68f`, on a branch forked before the restore) was
superseded by that already-live version during integration and was not
applied a second time. Worth knowing so nobody reads `aa7a68f` in history and
assumes it is what shipped.

Status vocabulary: `☐ not started` · `◐ in progress` · `☑ done` · `⛔ blocked`.

### Open questions for the owner

Append here rather than guessing. Each entry: question, why it blocks, what you
would do by default if unanswered.

1. *(VA-61)* Funding model, disclosable donor relationships and
   conflict-of-interest handling cannot be established from the repository. The
   site already says "Funding — not yet published in full"
   (`app/we-are/page.tsx:229-232`), which is an honest gap disclosure rather
   than a false claim. **Default if unanswered: leave it exactly as it stands.**
2. *(VA-48)* Who may create a deliberately separate story for an event that
   already has a canonical record — the editorial run itself, or only a human
   through the admin console? **Blocks step 48.2.** Default if unanswered:
   human-only through the admin console, since that is the narrower grant.
5. *(T-9 / search)* **`destinationFor` does not know the editorial run exists.**
   `server/modules/search/projection.ts:64` grants a publication an `href` only
   when it carries a `briefingRunId`. Records created by the whole-site
   **editorial** run carry an `editorialRunId` instead, so they are indexed with
   `href: null` while `/articles/<publicId>` serves them — verified: the BGU
   aerogel record answers 200 while its own search hit says it has nowhere to
   go. They render as "Indexed · no public page" rows: findable, but not
   clickable, and the badge is untrue.

   The repair is two steps, and the second is why it is not done here: widen
   `destinationFor` to accept `briefingRunId || editorialRunId`, **then reindex
   the publications**, because `href` is written into the stored projection at
   index time and a code change alone updates nothing. The reindex is a data
   pass over live rows through the outbox `search.reindex` consumer.

   **This is also what made the first T-9 fix dangerous.** Filtering the
   reader's results on `href === null` looked equivalent to "has no page" and
   was not: it hid 42 of 73 published records for about an hour, caught by
   re-measuring Production rather than by any test. The shipped filter matches
   the `site-` prefix instead — precise, and safe because zero published records
   carry it. **Default if unanswered: do the widening plus reindex as a
   deliberate task, and do not touch the reader filter again until it lands.**

4. *(VA-49)* An **existing** picture-less record cannot be declared
   *intentionally* text-only. `mediaDisposition` is derived from whether media
   was supplied, and the update branch writes it only when media arrived or the
   media stage warned — so the records the VA-49.3 proposal judged correctly
   text-led must stay `null`. Measured on the table 2026-09-08: `illustrated` 4,
   `text_led` 21, `null` 48, and 11 of the 15 records that carry a hero read
   `null`. Closing the gap means giving the update path an
   explicit disposition signal, which touches `whole-site-update.ts`, a
   `.strict()` contract deliberately limited to content and placement so the
   run's auto-fix boundary stays structural rather than trusted. **Blocks
   nothing public** — the owner already ruled a picture is not a gate, and the
   text-led rendering is correct regardless. **Default if unanswered: leave it
   as `null` and do not widen the contract.**

3. *(VA-51)* ~~`/information-war` answers to three names…~~ **Resolved by the
   recorded default, no owner answer needed.** `/information-war` was unified
   to its chrome label "How it works" in `05e6dd8`. `/ask`'s remaining fourth
   and fifth names ("AI Chat" as `AskDock`'s visible label/`aria-label`, "AI
   Chat — Ask the desk" as its dialog title) were unified to the chrome's "Ask
   the desk" while closing 51.1. If the owner later prefers a different
   canonical name for either destination, that is a one-line rename from here,
   not a re-open of this question.

---

*Opened 2026-09-07 against `main` @ `460f099`. This document is the task's
source of truth; the previous round is
`docs/audits/2026-09-07-visual-audit-implementation-todos.md` (VA-01 … VA-45).*
