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
6. **VA-58's suspected defect does not exist.** The result list is gated on a
   non-empty hit set (`components/search/SearchPanel.tsx:310`); the else branch
   renders an empty listbox kept solely so `aria-controls` resolves (`:324-328`).
   The rows VA-04 saw are the page-level `noscript` index, invisible whenever
   JavaScript is on. **VA-58 reduces to naming and copy. Do not rewrite Search.**
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

- [ ] **P-1** Git preflight: report current branch, commit, working-tree status,
      uncommitted/untracked files, whether `main` is up to date, and whether
      `feat/production-ux-integrity` already exists. Do not create a second branch.
- [ ] **P-2** Create `feat/production-ux-integrity` off `main` **only if it does
      not exist**. If it exists, continue on it.
- [ ] **P-3** Start the dev server and confirm HTTP 200 on `/`.
- [ ] **P-4** Read `docs/editorial-dna.md` (binding — outranks CLAUDE.md),
      `AGENTS.md`, `CLAUDE.md`, and §13 of the previous audit file (VA-04 results).
- [ ] **P-5** Capture a *before* evidence set with the existing harness so §11
      has something to compare against.

---

## 4. WAVE 1 — P0 PUBLICATION & TRUST INTEGRITY (A1, A2)

**Blocking. No cosmetic work begins until §4 is green.**

### VA-46 — Atomic canonical-story updates `A1` `severity A`

A developing story must never reach Production with a headline describing one
version, a summary describing another, a body describing a third, and an update
log claiming a change that was not applied. The Lebanon record demonstrated it.
**The fix is architectural — patching that one article is not the task.**

- [ ] **46.1** Trace the full update path end to end and write the trace into
      this file as a short list of the writes involved:
      `server/modules/editorial-update/service.ts`,
      `server/modules/publications/service.ts`, `server/modules/publications/repo.ts`,
      `server/core/versioning.ts` `recordVersion()`,
      `server/contracts/whole-site-update.ts`, `server/contracts/editorial-update.ts`.
      Identify **exactly where a partial update can commit**.
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
- [~] **46.4** Guarantee a re-promoted story references **the same canonical
      version the article page renders**. Homepage projection and article detail
      must read one version, not two.
      <!-- claimed: A1 @ 2026-09-07 -->
      <!-- partial: fba1612 | the record half is pinned — a legitimate update
           keeps its publicId and canonicalStoryId
           (tests/publication-update-coherence.test.ts). The projection half is
           NOT verified: nothing yet asserts that the homepage band and the
           article detail read the same version. Left open deliberately. -->
- [ ] **46.5** Consider whether a SQL trigger is the right home for any part of
      this (business rules live in triggers here as often as in TypeScript). If
      yes, it is a **new numbered migration**, migrated Preview → Production
      **before** the code is pushed.
- [ ] **46.6** Repair the existing Lebanon record into a coherent state — through
      the authorized editorial path, **not** a direct Production database edit.
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

- [ ] **47.1** Inspect the **real** architecture before touching copy. Enumerate
      the publication pathways that actually exist, reading
      `server/modules/publications/service.ts` (four `automatically published`
      change summaries), `server/modules/editorial-update/service.ts`, migration
      `0060`'s machine-provenance gate (`briefing_run_id` + `briefing_candidate_key`
      **or** `editorial_run_id` + `editorial_operation_key`, plus `machine_author`).
- [ ] **47.2** Write the pathway list into this file. Candidate classes, to be
      confirmed against code, **not invented**: manually authored / editor
      reviewed; AI-assisted with human approval; authorized automated editorial
      run; imported archival record; continuously updated investigation.
- [ ] **47.3** Give each class one canonical label and one definition. Use them
      consistently across article provenance, publication metadata, We Are,
      Methodology and explanatory copy.
- [ ] **47.4** Replace the bare "Automatically published daily edition" string
      with a label carrying enough context to be understood correctly. **Do not
      hide automation. Do not overstate human review.**
- [ ] **47.5** Align `/we-are` and `/methodology` so they describe the *same*
      real operating model. Note: `docs/editorial-dna.md` §11 records the
      launch-period posture — **the whole-site editorial path has no quality
      gate, by owner ruling**. Public copy must not claim one.
- [ ] **47.6** Re-read every public trust page and confirm no sentence
      contradicts live publication metadata.
- [ ] **47.7** Test: a record with `autoPublishedAt` set renders the automated
      class; a record without it does not; trust-page copy strings are pinned so
      a future edit cannot silently reintroduce the contradiction.

### VA-61 — Transparency: funding and editorial independence `A2` `needs owner input`

- [ ] **61.1** Read the existing funding / editorial-independence copy and list
      precisely what is claimed today.
- [ ] **61.2** Identify what the trust layer should state: funding model,
      disclosable sponsorship/donor relationships, editorial independence,
      conflict-of-interest handling, responsibility for automated editorial systems.
- [ ] **61.3** For anything not establishable from authorized sources,
      **document the gap in this file rather than inventing public copy.**
      Hand the open questions to the owner as a numbered list.
- [ ] **61.4** Publish only what is accurate and supportable.

---

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
- [ ] **48.4** `A3` Sweep live records for duplicates. Do not assume the known
      examples (Iran / U.S. unmanned vessel, BGU aerogel, West Bank outposts) are
      the only ones. Publish the sweep result into this file as a table.
- [ ] **48.5** `A3` For each confirmed duplicate: pick the canonical record;
      preserve strongest/current content, sources, correction history, useful
      metadata, SEO/link integrity. **Do not destroy historical provenance. Do
      not merge two genuinely different stories because the wording is similar.**
- [ ] **48.6** `A1` Redirect or otherwise safely resolve duplicate URLs;
      suppress the duplicate from search results.
- [~] **48.7** `A1` Tests: duplicate-canonical prevention; the override path;
      the redirect; single-render-per-page on `/geopolitical-brief`.
      <!-- claimed: A1 @ 2026-09-07 -->
      <!-- partial: fba1612 | covered: duplicate-canonical prevention by event
           id and by story id, a non-duplicate pair still publishing, and the
           override (a human may draft a separate story for an event that
           already has one) — tests/publication-duplicate-guard.test.ts.
           NOT covered: the redirect (step 48.6, not built) and
           single-render-per-page, which belongs with 48.3's verification. -->

### VA-56 — Remove raw source dumps from article prose `A1`

Where the structured Public Sources module exists, the body must not also print
a pipeline-like `Sources:\n- https://…` block.

- [ ] **56.1** Find every published body carrying a raw URL block. VA-01's sweep
      found 9 of 48 records citing an absolute URL in the body; reuse that method.
- [ ] **56.2** Normalize or remove the dumps **without losing source
      information** — a removed URL must already exist in the structured stack,
      or be added to it first.
- [ ] **56.3** Keep a safe fallback if structured-source parsing fails: the
      reader must never end up with zero visible sources.
- [ ] **56.4** Do not remove legitimate inline citations or contextual source
      references inside prose.
- [ ] **56.5** Test: source-normalization regression covering a body dump, an
      inline citation that must survive, and the parse-failure fallback.

### VA-49 — Media completeness `A3` data + `A1` state model

Media is editorial content, not decoration. **Current reality: 46 of 48
published records carry no media at all** (VA-04). The task is the *rule and the
state model*, not a replacement campaign.

- [ ] **49.1** Re-inspect the live inventory. List which publications still lack
      appropriate hero media, and which are legitimately text-only.
- [ ] **49.2** `A3` Create a real distinction in the system between **missing
      media** and **intentional text-only**, and **persist it on the
      publication**. Today `media = null` is produced by at least four different
      causes with no discriminator, and the only signal — the run report's
      `publicationProceededWithoutNewMedia` warning — lives in report JSON and is
      never stored. **Do not reintroduce a media gate**: the owner ruled on
      2026-09-07 that a picture is not a gate and a picture-less card renders
      text-led. This step models the *state*, it does not restore the *gate*.
- [ ] **49.3** `A3` For each eligible story choose media in this priority:
      direct documentary evidence → editorial/documentary photography → relevant
      portrait/location/object photography → documents, charts or data → clearly
      labelled editorial illustration → intentional text-only.
- [ ] **49.4** **Never** use an unrelated generic image to fill a slot. **Never**
      present generated imagery as documentary evidence. Generated/editorial
      illustrations stay clearly disclosed.
- [ ] **49.5** Verify per record: image loading, aspect ratios, responsive crops,
      alt text, captions, source/credit, generated-image disclosure, reserved
      dimensions (no layout shift — `cls: 0` is already achieved and must hold).
- [ ] **49.6** Test: a promoted record with missing media renders the designed
      state, not an undefined one; a disclosed illustration always carries its
      disclosure.

### VA-52 — Separate claim assessment from incident monitoring `A4`

A disputed claim, a verified antisemitic incident and an influence-network
investigation are three different objects. The visual language must never make a
documented real-world incident look like a "fake claim".

- [ ] **52.1** Formalize the content grammar. **Claim / Fact Check:** claim,
      evidence, assessment, confidence, status. **Incident / Watch:** documented
      event, source/provenance, verification status, context.
      **Network / Investigation:** actor/entity, relationships, evidence,
      findings, uncertainty/limits, revisions.
- [ ] **52.2** Map the grammar onto the existing `PUBLICATION_SECTIONS` values
      that Fake Resistance owns (`narrative_watch`, `influence_investigation`,
      `antisemitism`). **`publication.section` remains the only editorial choice**
      and `lib/publication-routing.ts` derives every surface from it — do not add
      a second model-set field.
- [ ] **52.3** Give each type its labels, filters and visual treatment. **Reuse
      existing components and tokens. Do not build three design systems.**
- [ ] **52.4** Extend the work already shipped in `791439c`…`1203dd3`
      (Fake Resistance editorial-type rendering) rather than replacing it.
- [ ] **52.5** Test: content-type presentation logic — each type renders its own
      anatomy, and an incident never renders claim-assessment chrome.

### VA-50 — Continue the Record `A4`

Articles currently end at sources and corrections and stop. Build an
**evidence-aware** continuation. **Not a "You may also like" carousel.**

- [ ] **50.1** Define the relationship ladder, in priority: same canonical
      developing story → related investigation → evidence collection →
      actor/entity → topic/narrative → archive record → relevant section hub.
      **The first rung returns nothing by construction** — the canonical id is
      unique per row, so a story is one record updated in place. Either drop that
      rung or redefine it as "records sharing an `eventId`".
- [ ] **50.2** **A module already exists — upgrade it, do not add a second.**
      "Related coverage" renders at `app/articles/[publicId]/page.tsx:415-444`,
      above corrections, and is the terminal content. Its data comes from
      `publication_related`, written only by `linkRelated` as auto-linked batch
      siblings, not editorial relationships; narratives render as unlinked text
      with no route to reach. Normally **2–4** destinations.
- [ ] **50.3** Exclude self-links, duplicate stories, weak keyword matches and
      filler. If nothing genuinely relevant exists, return the reader to the most
      relevant section/topic.
- [ ] **50.4** Depends on VA-46's canonical version and VA-48's dedup — do not
      ship before those land, or it will recommend duplicates.
- [ ] **50.5** Test: related-content selection — ladder order, self-link
      exclusion, duplicate exclusion, and the empty-case fallback to a hub.

### VA-54 — Investigation reading experience `A4`

Preserve the **full** evidentiary depth of investigations such as Hinkle
Machine. VA-04 measured that document at **60,814px** with the finding 2.4
viewports down and two horizontal scrollers clipped (a 1319px section nav inside
a 343px box). **Do not remove evidence to shorten the page.**

- [ ] **54.1** Build progressive disclosure. First layer: thesis, current
      assessment, strongest evidence, key caveats, what changed.
- [ ] **54.2** Deeper layer retains everything: full source stack, entity graph,
      findings, connections, methodology, revision history, evidence.
- [ ] **54.3** Add a local table of contents, stable deep links, collapsible /
      `<details>` structures, mobile-aware hierarchy.
- [ ] **54.4** Fix the clipped horizontal scrollers on mobile.
- [ ] **54.5** Serve both the reader who wants the conclusion and the researcher
      who wants the dossier. Verify both journeys.

### VA-55 — October 7 reduced-motion wording `A4`

- [ ] **55.1** Replace system-oriented visible text such as **"Manual"** with
      user-facing language ("Rotation off" / "Reduced motion"), or remove the
      redundant visible state if the controls already communicate it.
- [ ] **55.2** **Do not re-enable automatic motion for users requesting reduced
      motion.** Current behaviour is correct — preserve it.
- [ ] **55.3** Previous/next controls remain fully usable.
- [ ] **55.4** Preserve October 7 sensitive-content and graphic-content warning
      behaviour exactly. `tests/*october-7*` asserts the mechanism, not the prose.
- [ ] **55.5** Test: reduced-motion behaviour regression.

---

## 6. WAVE 3 — INFORMATION ARCHITECTURE & PRESENTATION (A5)

### VA-51 — Clarify navigation terminology `A5`

VA-04 found `/fact-check`'s breadcrumb reads `Home / Fake Resistance / …` over
the same three records the hub lists under "On the watch", with
`/geopolitical-brief` a third door under a fourth name.

- [ ] **51.1** **Define the job of each destination first.** Do not rename
      anything before the jobs are written down in this file.
- [ ] **51.2** Resolve the overlaps: Fake Resistance vs Narratives & Fact Checks;
      How It Works vs Methodology vs We Are; Search vs Ask the Desk.
- [ ] **51.3** The reader must be able to predict what happens before clicking.
- [ ] **51.4** Align terminology across desktop nav, mobile/menu nav, footer,
      **breadcrumbs**, page titles and CTAs. The breadcrumb is part of the fix.
- [ ] **51.5** Preserve `LEGACY_SECTION_PAGES` in `lib/site-navigation.ts` —
      `/our-heroes` and `/israels-story` keep their addresses.
- [ ] **51.6** Test: navigation model and breadcrumb regression.

### VA-53 — Homepage hierarchy `A5`

**VA-10 and VA-21 already shipped.** This is a re-check against the current
build, not a rebuild. **Do not redesign the homepage from scratch.**

- [ ] **53.1** Re-measure the first viewport at 1440/1024/768/390/360 against
      VA-04's numbers (lead headline top was 1176/1239/1317/1004/1174/1338px).
- [ ] **53.2** Confirm the reader understands within seconds: what matters now,
      why, what to inspect next.
- [ ] **53.3** Reduce competition between lead story, mission messaging, support
      prompts, Search, Ask/AI Chat, shortcuts and utility navigation. **One
      visually dominant editorial action.**
- [ ] **53.4** Keep the hero donation chips — removing them contradicts the owner
      ruling recorded in `.ai/DECISIONS.md`, 2026-09-07 ("the ask is on the cover
      too"), and VA-11 is closed on that basis.
- [ ] **53.5** No generic SaaS cards, no oversized marketing hero.
- [ ] **53.6** Re-run the LCP/perf budget afterwards (`npm run build` then
      `perf:report`). `cls: 0` must hold.

### VA-58 — Search vs Ask `A5`

**Preserve the current search architecture and accessibility behaviour. Do not
rewrite Search unless a real defect is found.** VA-17 shipped a no-match state;
VA-04 noted the fallback-index rows beneath it are untested.

- [ ] **58.1** ~~Verify the fallback-index rows beneath the no-match state.~~
      **Verified 2026-09-07: they do not render.** The list is gated on a
      non-empty hit set (`SearchPanel.tsx:310`) and the else branch is an empty
      listbox kept so `aria-controls` resolves (`:324-328`). What VA-04 saw is
      the page-level `noscript` index, invisible with JavaScript on. **There is
      no Search defect. This task is naming and copy only.**
- [ ] **58.2** State the distinction in product terms: **Search** finds a
      published record; **Ask the Desk** asks a question across what Lions has
      published and researched.
- [ ] **58.3** Align launcher copy, menu labels, empty states, explanatory text.
- [ ] **58.4** Ask must not look like a second search box. Search stays
      deterministic retrieval, not conversational synthesis.
- [ ] **58.5** **Do not weaken existing Search keyboard/ARIA behaviour.**

### VA-63 — CTA vocabulary `A5`

- [ ] **63.1** Adopt a systematic semantic model: News → *Read story*;
      Investigation → *Open investigation*; Evidence/archive → *Open record* /
      *View evidence*; Testimony → *Read testimony*; Search → *Search the record*;
      AI synthesis → *Ask the desk*. Final wording follows the current Lions
      voice, but it must be systematic.
- [ ] **63.2** Stop alternating between Open / View / Read / Explore without a
      reason. Sweep every surface.
- [ ] **63.3** Sensitive archive actions keep communicating their warnings.
- [ ] **63.4** Derive the CTA from `publication.section` via
      `lib/publication-routing.ts` — **not** from a new model-set field.

### VA-62 — Social metadata `A5`

Confirmed live: ~20 pages export `openGraph`, but `twitter` metadata exists in
**only two files** — `app/layout.tsx` and `app/articles/[publicId]/page.tsx`.
So October 7 has page-specific Open Graph while X falls back to generic site copy.

- [ ] **62.1** Audit page-specific metadata across every major section and the
      article route.
- [ ] **62.2** Give each its own title, description, Open Graph and
      X/Twitter metadata, and social preview imagery. Generic Lions metadata is
      **fallback only**.
- [ ] **62.3** Reuse `app/articles/[publicId]/opengraph-image.tsx` as the pattern
      where a generated preview is appropriate.
- [ ] **62.4** Test: metadata regression per route family.

### VA-57 — People of Israel canonical cleanup `A3` data + `A5` code

- [ ] **57.1** `A3` Resolve the BGU duplication and sweep the hub for equivalents.
- [ ] **57.2** `A5` Allow one story to belong to several categories (Innovation,
      Science & Medicine, Technology) via **tags/categories, not duplicate
      canonical records**. Derive lanes from `SECTIONS_BY_HOMEPAGE_SECTION`,
      never a hand-written list — a hand-written pair in `LiveBriefHub` left
      `news` records rendered by nothing until 2026-09-06.
- [ ] **57.3** **Do not add filler content to increase visible item count.**
- [ ] **57.4** Test: the hub renders distinct records; a multi-category record
      appears once per lane at most.

### VA-59 — ScanBackdrop rationalization `A5`

`components/sections/scanProfiles.ts` **already implements per-family register,
intensity, density and speed**, and `tests/intro-accessibility.test.ts`
recomputes and asserts the contrast budget per family. **This is tuning inside
an existing mechanism — do not rebuild it, and do not remove the Lions signal
aesthetic globally.**

- [ ] **59.1** Keep full strength on Fake Resistance, Information War and
      selected investigations.
- [ ] **59.2** Reduce or silence it on calmer editorial/trust surfaces: ordinary
      news articles, People of Israel, Methodology, Corrections, We Are.
- [ ] **59.3** Content must always visually dominate the effect.
- [ ] **59.4** Hostile claims shown decoratively must never look like article copy.
- [ ] **59.5** Respect reduced-motion preferences.
- [ ] **59.6** Any intensity change must keep `tests/intro-accessibility.test.ts`
      green — raising a value fails that suite by design.

---

## 7. WAVE 4 — CERTIFICATION (A6)

### VA-60 — Final production visual certification `A6`

**Do not rely on code inspection.** Run against the rendered application.

- [ ] **60.1** Fix `ui-audit.mjs`'s `COMPLEX` route list first — 9 of its 24
      CRITICALs were `HTTP 404` on `/pipeline`, a dev-only route. Do not quote
      that exit code as a quality signal until the list is corrected.
- [ ] **60.2** Viewports: **1440**, **1024**, **768**, **390**, **360**,
      **812×375 landscape**.
- [ ] **60.3** Surfaces: Homepage; News/Analysis; standard article; developing
      story; Fake Resistance; major investigation (Hinkle); October 7 landing;
      testimony detail; video record; image record; People of Israel; Search;
      How It Works; Methodology; We Are; Corrections.
- [ ] **60.4** Inspect: first-viewport composition, headline wrapping, image
      crops, missing/broken media, sticky navigation, overlays, horizontal
      overflow, spacing rhythm, card/content density, reading measure, mobile
      ordering, captions/credits, empty states, focus states, reduced motion,
      warning states, long content, footer transitions.
- [ ] **60.5** Assert zero of each: unintended horizontal scrolling; clipped
      headlines; overlapping UI; broken image state; clearly bad hero crop;
      accidental giant cards from missing content; inaccessible critical
      controls; mobile ordering that destroys editorial hierarchy.
- [ ] **60.6** Capture screenshots as QA evidence under
      `docs/reviews/production-ux-integrity/after/`.
- [ ] **60.7** Fix an issue found here **only if it is clearly inside this
      task's scope**, then re-verify it.

---

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

- [ ] **A11Y-1** Re-verify every item above after Waves 1–3.
- [ ] **A11Y-2** Confirm `viewport-fit=cover` (shipped in `52bae19`) still holds
      and that the safe-area rules it revived behave on a physical device.

---

## 11. TESTING

Run relevant tests for **every** changed subsystem. `npm run verify:full` is the
gate: typecheck, lint, test, build. `npm run lint` is where architecture
boundaries are enforced.

`vitest.config.ts` sets `maxWorkers: 2` on purpose — **do not override it**;
default parallelism OOMs the suite.

- [ ] **T-1** Type checking green.
- [ ] **T-2** Lint green (architecture boundaries).
- [ ] **T-3** Unit/integration tests green.
- [ ] **T-4** Production build green.
- [ ] **T-5** Routing and redirects verified.
- [ ] **T-6** Canonical IDs verified.
- [ ] **T-7** Article rendering verified.
- [ ] **T-8** Homepage rendering verified.
- [ ] **T-9** Search behaviour verified.
- [ ] **T-10** Mobile navigation verified.
- [ ] **T-11** Media states verified.
- [ ] **T-12** Metadata verified.
- [ ] **T-13** Reduced-motion behaviour verified.

**New regression coverage is required, not optional**, for: partial
developing-story updates; duplicate-canonical prevention; source normalization;
related-content selection; content-type presentation logic.

**Do not declare success while relevant tests are failing.**

---

## 12. DEFINITION OF DONE

- [ ] **D-1** Developing stories cannot publish internally inconsistent versions.
- [ ] **D-2** Public review/automation language matches the actual system.
- [ ] **D-3** Known duplicate canonical stories are resolved safely.
- [ ] **D-4** Duplicate-publication prevention exists for future updates.
- [ ] **D-5** Claim, incident and investigation states are semantically clear.
- [ ] **D-6** Featured/homepage stories no longer fall into undefined missing-media states.
- [ ] **D-7** Generated illustrations stay explicitly differentiated from documentary imagery.
- [ ] **D-8** Raw source dumps are not duplicated where structured sources exist.
- [ ] **D-9** Articles provide a meaningful continuation path when relevant material exists.
- [ ] **D-10** Navigation terminology is understandable and consistent.
- [ ] **D-11** Homepage hierarchy has one clear editorial priority.
- [ ] **D-12** Search and Ask serve clearly different jobs.
- [ ] **D-13** People of Israel does not use duplicate stories to fill lanes.
- [ ] **D-14** Long investigations offer an accessible first-read layer without removing evidence.
- [ ] **D-15** October 7 safety and reduced-motion behaviour remain correct.
- [ ] **D-16** Decorative signal effects are used intentionally, not universally.
- [ ] **D-17** Social metadata is page-specific where appropriate.
- [ ] **D-18** CTA vocabulary is consistent by content type.
- [ ] **D-19** Transparency language is accurate and supportable.
- [ ] **D-20** Desktop, tablet and mobile visual QA passes on the representative surfaces.
- [ ] **D-21** Existing working behaviour has no material regressions.

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
| VA-46 | A1 | ◐ in progress | 1 | `fba1612` — rules + both update paths + 15 tests. Open: 46.1 trace, 46.5 trigger question, 46.6 Lebanon record, 46.4 projection half |
| VA-48 | A1 | ◐ in progress | 1 | `fba1612` — guard extracted, both auto-publish paths, override documented, 4 tests. Open: 48.4/48.5 data sweep (A3), 48.6 redirects |
| VA-47 | A2 | ☐ not started | 1 | — |
| VA-61 | A2 | ☐ not started | 1 | — |
| VA-49 | A3 | ☐ not started | 2 | — |
| VA-50 | A4 | ☐ not started | 2 | — |
| VA-54 | A4 | ☐ not started | 2 | — |
| VA-56 | A4 | ☐ not started | 2 | — |
| VA-52 | A5 | ☐ not started | 3 | — |
| VA-55 | A5 | ☐ not started | 3 | — |
| VA-59 | A5 | ☐ not started | 3 | — |
| VA-51 | A6 | ☐ not started | 4a | — |
| VA-57 | A6 | ☐ not started | 4a | — |
| VA-63 | A6 | ☐ not started | 4a | — |
| VA-58 | A6 | ☐ not started | 4a | — |
| VA-53 | A6 | ☐ not started | 4b | — |
| VA-62 | A6 | ☐ not started | 4b | — |
| VA-60 | A7 | ☐ not started | 5 | — |
| A11Y-1, A11Y-2 | A7 | ☐ not started | 5 | — |
| T-1 … T-13 | all | ☐ not started | all | — |

Note: VA-56 moved from A1 to A4, because A4 owns the article page where the
structured source stack renders. VA-52 moved from A4 to A5, because the Fake
Resistance previews touch nothing the article page touches.

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
3. *(VA-51)* `/information-war` answers to three names — "How it works" in the
   chrome, "This is an information war" as its own title, "Why this work
   matters" on the homepage. `/ask` answers to five, including "AI Chat". Which
   name wins in each case? **Blocks step 51.2.** Default if unanswered: keep the
   chrome label as the canonical name and align the others to it.

---

*Opened 2026-09-07 against `main` @ `460f099`. This document is the task's
source of truth; the previous round is
`docs/audits/2026-09-07-visual-audit-implementation-todos.md` (VA-01 … VA-45).*
