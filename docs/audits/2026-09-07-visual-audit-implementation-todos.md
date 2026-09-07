# Visual Audit — implementation backlog

**Source of record:** *Lions of Zion Visual Audit Report* — "Editorial hierarchy,
evidence UX, responsive risk and a path to premium publication quality", Lions of
Zion General Manager, 7 September 2026.

**Repository baseline for every file reference below:** `main` at
`61875f346e036a1db7bd27d8707712aad95ff3c9` — the same commit the audit read.
Every path in this document was checked to exist at that commit on 7 September
2026. Where the audit's own file reference has moved, the correction is noted on
the task.

**Scope of this document:** planning only. Nothing here has been implemented. No
application code, Production state, editorial content or database row was
modified in producing it.

---

## 0. How to read this

**Classification** — `FIX` (something is wrong and must be made right),
`IMPROVE` (it works, it is not yet good enough), `REDESIGN` (the structure is the
problem, not the styling), `REMOVE-CONSOLIDATE` (there is too much of it, or it
exists in more than one place).

**Severity** — `A` critical: credibility, correctness or a release gate.
`B` major: materially holds the product below premium. `C` minor.

**Status marker** — one of:

| Marker | Meaning |
| --- | --- |
| `READY` | Fully specified. An agent can start now. |
| `BLOCKED` | Waiting on a named predecessor task. |
| `NEEDS VISUAL VERIFICATION` | The audit could not certify current pixels; VA-04 must confirm the finding still holds before work begins. |
| `NEEDS PRODUCT DECISION` | The audit's recommendation conflicts with a recorded owner ruling, or asks for an editorial judgement no engineer should make alone. |

**Execution path** — every task is one of two kinds, and they are not
interchangeable:

- **MCP / editorial path.** Content, sources, media, homepage placement, archive
  and unpublish. Reachable through the ChatGPT connector's tools
  (`update_publication`, `set_homepage_placement`, `archive_publication`,
  `rollback_publication`) or through a `whole-site-update-v2` package delivered
  on the `chatgpt-editorial-updates` branch. **No deploy, no PR, no CI.**
- **Development path.** Branch off `main` → commit → PR → `npm run verify:full`
  green in CI → owner's explicit go-ahead → merge → Production deploys itself
  within ~2 minutes. Everything that touches CSS, components, contracts, schema,
  navigation architecture or security is this path. The `whole-site-update`
  contract is `.strict()` and content/placement only, so this boundary is
  structural, not a matter of discipline.

One caveat the audit states about itself, which governs the whole plan:

> "The environment could read current production pages and the current
> repository, but it could not launch a network-enabled browser against
> lionsofzion.io. The only screenshots available were a repository evidence set
> captured on 6 September. Fifty-nine commits separate that baseline from the
> audited main commit."

Findings carrying `V` evidence only, or `C` evidence only, are therefore marked
`NEEDS VISUAL VERIFICATION` and are gated behind **VA-04**.

---

## 1. Recommended execution order

```
VA-04 ──┬─→ VA-05 ──→ VA-09, VA-38
        ├─→ VA-06, VA-08              (verification gates, parallel)
        └─→ unblocks every NEEDS VISUAL VERIFICATION task below

VA-01 ──→ VA-02                       (data first, then the guard)
VA-03 ──→ VA-18                       (gate now, family later)
VA-12 ──→ VA-19                       (suppress now, canonical model later)
VA-14 ──→ VA-23 ──→ VA-24
VA-10 ──→ VA-21 ──→ VA-22 ──→ VA-28
VA-13 ──→ VA-16 ──→ VA-33 ──→ VA-34 ──→ VA-38
VA-29, VA-30 ──→ VA-31, VA-32         (tokens before the surfaces that use them)
VA-40 last: it measures the result of VA-10 and VA-21
```

### The first five tasks that should actually be implemented

The audit's own "if it must look more premium tomorrow" list is five items. Four
of them survive contact with the current repository. The second — *remove
donation chips from the hero* — collides head-on with an owner ruling recorded
the same day (`.ai/DECISIONS.md`, 2026-09-07, "the ask is on the cover too"), so
it is a product decision, not a task. It is replaced here by the verification
gate the audit itself says must come first.

| # | Task | Why it is first |
| --- | --- | --- |
| 1 | **VA-04** — run the current production visual matrix | The audit is explicit that its visual claims rest on a 59-commit-old baseline. Every other visual task is guesswork until this runs. It is pure observation: no code, no content, no risk. |
| 2 | **VA-01 + VA-02** — repair source-state contradictions, then guard against them | A page that prints a source and denies having sources is the single worst thing on this site. Severity A. VA-01 is editorial and needs no deploy. |
| 3 | **VA-03** — gate the investigation explorer by editorial type | A three-line condition at `app/articles/[publicId]/page.tsx:263` currently gives a Ministry of Defense announcement a seven-stage investigation apparatus. Small change, large credibility return. |
| 4 | **VA-10** — recompose the homepage first viewport | The highest-value visual change in the report, and the one the reader meets first. |
| 5 | **VA-12** — suppress exact duplicates in the archive projection | Cheap, reversible, and it stops the news desk looking machine-filled while VA-19 is built. |

---

## 2. Phase 0 — Critical fixes and release gates

### VA-01 — Repair every published source-state contradiction

- **Problem.** A published article reports "Source stack 0 sources" and "No
  public sources" while its body prints an Israel Innovation Authority URL. The
  reader sees a citation and a denial of citations on the same page.
- **Swept against live Production, 2026-09-07.** Read-only over the two
  `PUBLIC_V1` routes; artefacts in the session scratchpad
  (`va-01/FINDINGS.json`, `va-01/package.json`). **48 published records; 9 cite
  an absolute URL in their body; 7 of those 9 are defective:**

  | Verdict | Count | Meaning |
  | --- | --- | --- |
  | `CONTRADICTION` | **3** | Body cites, source stack is **empty** |
  | `PARTIAL` | **4** | Stack carries some cited addresses and omits others |
  | clean | 2 | Body citations all present in the stack |

  **All three outright contradictions are `influence_investigation` records** —
  the worst possible section for it, since an influence investigation that
  displays no sources is precisely the thing the desk exists to refute.

- **Correction — the audit's named exemplar is not reproducible.** The audit
  cites `/articles/israel-launches-nis-22-million-tech-human-capita-794jg` as
  "Source stack 0 sources" and "No public sources", calls it "a direct
  credibility failure", and makes it item 3 of its five most urgent changes.
  Fetched live on 2026-09-07, that record carries **one** stored source — the
  Israel Innovation Authority URL — exactly matching its single body citation,
  and the rendered page says "1 source" with the address listed under "Public
  sources". The strings "No public sources" and "0 sources" appear nowhere in
  the page. Either it was repaired inside the 59-commit window the audit itself
  flags, or it was misread. **The finding is nonetheless valid** — the sweep
  found seven other records in exactly the described state, three of them worse
  (empty stack, not partial). Cite one of those as the exemplar instead.
- **Overlap with VA-19 worth noting:** two of the seven —
  `iran-says-it-struck-an-unmanned-u-s-vessel-centc-8m6cq` and
  `iran-says-it-struck-a-u-s-unmanned-vessel-washin-anmgp` — are near-duplicate
  records of one story, *and both are broken*. Repairing sources on two records
  that should be one is wasted work; sequence them with the canonical-story
  consolidation.
- **Source finding.** Top-10 #02 (FIX, severity A); Quick Win 4; page audit
  "Standard News, Innovation and Daily-Brief Articles" — *"Empty source states
  can contradict body URLs"*; page audit "The People of Israel" — *"Some current
  People articles lack canonical source records/media."*
- **Classification.** FIX · **Severity.** A · **Work type.** Editorial / Data
- **Files / services.** No repository change. `whole-site-update-v2` update
  operations carrying `sources` (`server/contracts/whole-site-update.ts:71`,
  `editorialSourcesSchema` from `server/contracts/editorial-update.ts`),
  delivered to `POST /api/internal/editorial-updates/ingest`. Read the estate
  with the connector's `list_publications` / `find_publication`.
- **Implementation.** (1) Enumerate every published record whose body contains an
  `http(s)://` address. (2) Cross-check each against its stored `sources`.
  (3) For every record where a body URL is absent from the source list, deliver an
  update operation attaching the real sources. (4) Start with
  `/articles/israel-launches-nis-22-million-tech-human-capita-794jg`, the record
  the audit names. (5) Produce a list of records that cannot be repaired from the
  body alone — those need re-reporting, not a data edit.
- **Dependencies.** None. Start immediately.
- **Risk.** Low. `recordVersion()` makes every edit a new version with an audit
  trail, and `rollback_publication` reverses one. The real risk is *stopping
  early*: a partial sweep leaves the same failure on records nobody looked at.
- **Acceptance criteria.** Zero published records where a body-cited URL is
  missing from the public source list, or a written list of the ones that need
  re-reporting instead. The named Tkuma record shows its Innovation Authority
  citation in "Public sources".
- **Tests.** None in the repository — this is content. The proof is the sweep's
  own before/after enumeration, retained in the run report.
- **Visual verification.** Load the repaired article on Production; the facts row
  source count and the "Public sources" section must agree with the body.
- **Desktop / mobile.** Both, on the repaired article. 375 and 1440 minimum.
- **Production verification.** **Required.**
- **Execution path.** **MCP / editorial.**
- **Status.** `READY`

### VA-02 — A body citation may never coexist with an empty public source stack

- **Problem.** VA-01 repairs the records that are wrong today. Nothing stops the
  next one. The contradiction is representable, so it will recur.
- **Source finding.** Top-10 #02, second half of the *Direction*: *"Repair
  ingestion/rendering so a body citation cannot coexist with an empty public
  source stack. Until repaired, suppress the '0 sources' summary when an
  attributable URL is present and flag the record for editorial correction."*
- **Classification.** FIX · **Severity.** A · **Work type.** Backend / Frontend
- **Files.** `app/articles/[publicId]/page.tsx` (the facts row at `:164`, the
  "Public sources" section at `:308–330`); `server/contracts/publication.ts`;
  the create/update path in `server/modules/publications/`.
- **Implementation.** Two layers, and both are wanted. **Render:** when
  `article.sources.length === 0` but the body contains an absolute URL, suppress
  the "No public sources are listed for this article." line and the zero count,
  and render a neutral "sources pending verification" state instead. **Ingest:**
  reject or flag a create/update whose body carries an absolute URL with an empty
  `sources` array. Note the one legitimate exception already in the code: an
  analysis record (`isAnalysisBasis`, `:96`) cites nothing by design and already
  renders its own "Why this record cites no record" section at `:298` — that path
  must be left exactly as it is. Do **not** add an editorial gate that blocks
  publication; the launch-period posture (`docs/editorial-dna.md` §11) rules
  those out. Flag and suppress, do not refuse.
- **Dependencies.** None to start; ship after VA-01 so the flag does not fire on
  a hundred known-bad records at once.
- **Risk.** Medium. The URL-in-body detection must not false-positive on a plain
  domain mention in prose. Keep the matcher to absolute `http(s)://` addresses.
- **Acceptance criteria.** An article with a body URL and no stored sources
  renders the pending state, never the denial. An analysis record still renders
  its own disclosure unchanged. A create carrying a body URL and empty `sources`
  is flagged in the run report.
- **Tests.** New unit tests in `tests/` covering: body URL + empty sources →
  pending state; analysis record + empty sources → existing disclosure preserved;
  body URL + populated sources → normal render. Extend the existing publication
  suite rather than adding a file if one already covers the projection.
- **Visual verification.** The three states above, captured.
- **Desktop / mobile.** 375 and 1440.
- **Production verification.** Required, on one real record of each kind.
- **Execution path.** **Development.**
- **Status.** `READY`

### VA-03 — Gate the investigation explorer by editorial type

- **Problem.** `app/articles/[publicId]/page.tsx:263` renders
  `<InvestigationExplorer>` whenever `details || article.sources.length ||
  article.passages.length` is truthy — which is nearly every article. A routine
  Ministry of Defense announcement is therefore given a seven-stage
  "Claim → Origin → Observed spread → Evidence → Finding → Limitations →
  Recognition lesson" path, with "Observed spread" filled by *"does not name
  observed propagators."* The interface asserts investigative work that was never
  done.
- **Source finding.** Top-10 #03 (REDESIGN, severity A); Quick Win 3; page audit
  "Standard News, Innovation and Daily-Brief Articles"; Redesign candidate 2.
- **Classification.** FIX · **Severity.** A · **Work type.** Frontend
- **Files.** `app/articles/[publicId]/page.tsx:263`;
  `components/evidence/InvestigationExplorer.tsx`;
  `lib/publication-routing.ts`; `server/contracts/enums.ts`
  (`PUBLICATION_SECTIONS`).
- **Implementation.** Derive the gate from `publication.section`, which is the
  only editorial choice a composer makes and from which
  `lib/publication-routing.ts` already derives every other surface. Build the
  allowed-section list there — **do not** hand-write a section array in the page
  component; that is exactly how `LiveBriefHub` left `news` records rendered by
  nothing until 2026-09-06. Permit the explorer for `narrative_watch`,
  `influence_investigation` and `antisemitism`; deny it for `daily_brief`,
  `israel_update`, `news`, and every People section (`people`,
  `courage_service`, `innovation`, `technology_ai`, `science_medicine`,
  `achievement`, `international_cooperation`, `history_context`). A denied record
  still renders its facts row, source list, body, corrections and related
  coverage — nothing is lost, only the ceremonial staging.
- **Dependencies.** None. This is the interim gate; **VA-18** replaces it with
  real per-type templates.
- **Risk.** Low, and reversible in one line. The one thing to check: a genuine
  investigation must not lose its explorer. Confirm against a live
  `narrative_watch` record before merging.
- **Acceptance criteria.** `/articles/israel-ministry-of-defense-recent-announcements--m781m`
  renders with no seven-stage explorer. A live narrative-watch record still
  renders it in full. No section list is written anywhere but
  `lib/publication-routing.ts`.
- **Tests.** Unit test asserting the derived allow-list matches
  `SECTIONS_BY_HOMEPAGE_SECTION`-style derivation, plus one render assertion per
  branch. Note `vitest.config.ts` runs `environment: "node"` with no jsdom — test
  the routing predicate directly rather than rendering the component.
- **Visual verification.** The named MoD article and one narrative-watch article,
  before and after.
- **Desktop / mobile.** 375 and 1440 on both articles.
- **Production verification.** Required.
- **Execution path.** **Development.**
- **Status.** `READY`

### VA-04 — Run the current production visual matrix

- **Problem.** The audit could not screenshot Production. Its visual claims rest
  on a 6 September repository baseline that is 59 commits stale, covering an
  older homepage only. Current articles, hubs, investigation modules, Search,
  Support, 404/error states and the 7 September navigation have never been
  captured at the required widths.
- **Source finding.** Top-10 #10 (FIX, severity A); section D "Responsive and
  Interaction States" — *"FIX verification coverage"*; Appendix B; Phase 0 item 3.
- **Classification.** FIX · **Severity.** A · **Work type.** QA
- **Files.** `scripts/ui-audit.mjs`, `scripts/ui-interaction-audit.mjs`,
  `scripts/design-capture.mjs`, `scripts/ci-smoke.mjs`.
- **Correction to the audit.** The audit implies this tooling must be built. It
  exists. `scripts/ui-audit.mjs` already runs the exact matrix — 320, 375, 390,
  430, 768, 1024, 1440, 1920 (`REQUIRED_VIEWPORTS`) — plus a no-JS pass over six
  routes, a coarse-pointer 44px floor check, focus visibility, and heading /
  landmark structure, and it takes a base URL as its first argument
  (`node scripts/ui-audit.mjs https://lionsofzion.io`). `ui-interaction-audit.mjs`
  covers keyboard journeys, dialog focus trap/restore, Escape and
  `prefers-reduced-motion` at 390 and 1440. `design-capture.mjs` produces the
  human-readable screenshots, at 1440 and 390 only. What is genuinely missing is
  200% zoom, missing-media, long-headline and induced error states — that is
  **VA-05**, and this task runs what exists first.
- **Implementation.** Run all three against Production over the full route set
  below (§7). Capture, don't fix: this task produces evidence, and every finding
  it raises becomes an amendment to a task in this document rather than a
  drive-by edit.
- **Dependencies.** None. **This is task one.**
- **Risk.** None to the system — read-only. The risk is running it against a
  Preview deployment instead: Vercel deployment protection currently blocks
  Preview verification, so run against `https://lionsofzion.io`.
- **Acceptance criteria.** A capture set at all six required widths (375, 430,
  768, 1024, 1440, 1920 — the scripts also give 320 and 390 free) for every route
  in §7, plus the interaction and no-JS passes, plus a written findings list that
  either confirms or retires each `NEEDS VISUAL VERIFICATION` marker in this
  document.
- **Tests.** `ui-audit.mjs` exits non-zero on any CRITICAL finding. Record the
  exit code.
- **Visual verification.** This *is* the visual verification.
- **Desktop / mobile.** Both, all widths, portrait and landscape where meaningful.
- **Production verification.** **Required — Production is the target.**
- **Execution path.** Neither — it is observation. No branch, no content change.
  Store output outside the repository or under a git-ignored path.
- **Status.** `READY`

### VA-05 — Extend the audit harness: 200% zoom, missing media, long headline, induced states

- **Problem.** Four of the audit's required stress cases have no automated
  coverage: 200% zoom appears nowhere in `ui-audit.mjs` or
  `ui-interaction-audit.mjs`; there is no absent-media case; no 80–110 character
  headline case; and error/empty/loading states are never induced, only described.
- **Source finding.** Top-10 #10 *Direction*; Appendix B "Stress" and "States";
  page audit "404, Error and Loading States" — *"Rendered states were not
  induced."*
- **Classification.** FIX · **Severity.** A · **Work type.** QA / Frontend
- **Files.** `scripts/ui-audit.mjs`, `scripts/ui-interaction-audit.mjs`.
- **Implementation.** Add four passes. **Zoom:** a `deviceScaleFactor` /
  `page.setViewportSize` pair reproducing 200% browser zoom at 375 and 1440,
  asserting no horizontal overflow and no control pushed off-viewport.
  **Missing media:** route-abort the image host and assert the text-led fallback
  renders rather than an empty frame. **Long headline:** an 80–110 character
  title, asserted not to overflow its measure or collide with the facts row.
  **Induced states:** abort the API route to produce the unavailable state, request
  a nonexistent `publicId` for 404, and force a render throw for `app/error.tsx`.
- **Dependencies.** **VA-04** — run what exists before extending it.
- **Risk.** Low. Confine every abort to the test browser context; never point a
  fault-injection pass at a Production write route.
- **Acceptance criteria.** All four passes run and report. Every state named in
  §8 has a capture.
- **Tests.** The harness is the test. It must stay CI-runnable (non-zero exit on
  CRITICAL) without requiring a database.
- **Visual verification.** One capture per new pass.
- **Desktop / mobile.** 375 and 1440 for each pass.
- **Production verification.** Not required for the harness change; required for
  the run it enables.
- **Execution path.** **Development** (`scripts/**` is ESLint-ignored, so lint
  will not cover it — typecheck and a real run are the gate).
- **Status.** `BLOCKED` on VA-04

### VA-06 — Verify mobile navigation after the 7 September IA change

- **Problem.** The navigation changed on 7 September — "Fake Resistance" and
  "Narratives & Fact Checks" became two named destinations
  (`components/site/navigation-model.ts`, `lib/site-navigation.ts`). No 375 or
  430 screenshot, and no keyboard walkthrough, exists for the panel after that
  change. Long descriptions under large menu titles may make the panel very tall.
- **Source finding.** Page audit "Mobile Navigation" — *"Action: FIX — Severity A
  verification gate. Evidence C only."*
- **Classification.** FIX · **Severity.** A · **Work type.** QA
- **Files.** `components/site/SiteHeader.tsx`,
  `components/site/site-header.module.css`,
  `components/site/navigation-model.ts`, `lib/site-navigation.ts`.
- **Implementation.** Verify, at 375 and 430, portrait and landscape: panel
  height against the viewport, safe-area inset behaviour, focus trap and focus
  restoration on close, Escape, 200% zoom, and the no-JS index. Shorten
  descriptions **only** at the narrowest width, **only** if the panel is
  demonstrably cumbersome — the audit is explicit that the descriptions should be
  kept.
- **Dependencies.** **VA-04**, **VA-05** (zoom pass).
- **Risk.** Low.
- **Acceptance criteria.** A capture set and a keyboard trace. Either "no change
  needed" in writing, or a specific, minimal CSS amendment raised as its own task.
- **Tests.** `ui-interaction-audit.mjs` dialog focus-trap and Escape assertions
  must pass on the mobile panel.
- **Visual verification.** Panel open and closed, 375 and 430, portrait and
  landscape, plus 200% zoom.
- **Desktop / mobile.** Mobile is the point; confirm desktop menu unaffected.
- **Production verification.** **Required.**
- **Execution path.** Observation; any resulting fix is **Development**.
- **Status.** `BLOCKED` on VA-04

### VA-07 — Audit Ask / AI Chat trust behaviour before elevating it visually

- **Problem.** Ask promises to be grounded in published material and to say when
  evidence is absent. None of that was exercised: answer quality, citation
  traceability, streaming, failure, long responses, mobile keyboard behaviour and
  authenticated continuity are all unverified. These surfaces carry the
  "AI-powered newsroom" claim.
- **Source finding.** Page audit "Ask / AI Chat / Account" — *"Action: FIX —
  Severity A verification gate."*; Phase 0 item 4.
- **Classification.** FIX · **Severity.** A · **Work type.** QA / Editorial
- **Files.** `app/ask/`, `app/account/`, the four public chat routes in
  `PUBLIC_V1` (`server/http/handler.ts`).
- **Implementation.** Run the audit's own protocol: five answerable and five
  unanswerable questions. For each, inspect whether the cited source is real,
  reachable, and actually supports the sentence it is attached to; whether an
  unanswerable question produces an honest refusal rather than a confident
  invention; abort and retry behaviour; focus handling; screen-reader
  announcement of streamed content; and continuity across an authenticated
  session. **Do not** raise the AI surface's visual prominence until this passes.
- **Dependencies.** None.
- **Risk.** Low — read-only questioning. Do not submit content that would be
  stored as a report.
- **Acceptance criteria.** A written pass/fail per question with the citation
  chain for each answer. A clear verdict on whether Ask may be elevated visually.
- **Tests.** None automated. This is a human protocol.
- **Visual verification.** Mobile keyboard behaviour at 375 with the soft
  keyboard open; long-response scroll at 1440.
- **Desktop / mobile.** Both.
- **Production verification.** **Required.**
- **Execution path.** Observation only.
- **Status.** `READY`

### VA-08 — Verify Support form behaviour end to end

- **Problem.** Submission, validation, error, success, network retry, keyboard
  order and state preservation across mode switches were never exercised, because
  the audit did not submit data.
- **Source finding.** Page audit "Support and Forms" — *"Submission, validation,
  error and success were not exercised."*
- **Classification.** FIX · **Severity.** B · **Work type.** QA
- **Files.** `app/support-us/page.tsx`, `components/ui/Field.tsx`,
  `components/ui/FieldGroup.tsx`, `components/ui/CheckboxField.tsx`,
  `POST /api/v1/volunteer-interest` and `POST /api/v1/reports` (both in
  `PUBLIC_V1`).
- **Implementation.** Exercise each of the four actions: field-level validation
  messages, success state, an induced network failure and its retry, keyboard tab
  order, 44px targets under a coarse pointer, and whether entered state survives
  switching between modes. **Do not touch the external donation providers** and
  do not attempt a payment — the audit records "no on-site payment collection" as
  a KEEP, and payment is out of bounds regardless.
- **Dependencies.** **VA-04** for the capture harness.
- **Risk.** Submitted test data lands in Production tables. Use clearly-marked
  test values and record what was written so it can be removed.
- **Acceptance criteria.** Every state above captured and passing, or a defect
  list.
- **Tests.** Existing route tests must stay green; add a validation-path test if
  a real defect is found.
- **Visual verification.** Error, success and retry states at 375 and 1440.
- **Desktop / mobile.** Both; mobile with the soft keyboard open.
- **Production verification.** **Required.**
- **Execution path.** Observation; any fix is **Development**.
- **Status.** `BLOCKED` on VA-04

### VA-09 — Induce and capture every 404, error and loading state

- **Problem.** The states exist in code and are semantically distinct — loading,
  empty and unavailable are separate facts, error boundaries offer retry and home
  — but no rendered proof exists at any width.
- **Source finding.** Page audit "404, Error and Loading States" — *"Action: FIX —
  Severity B. Evidence C only."*; Appendix B "States".
- **Classification.** FIX · **Severity.** B · **Work type.** QA
- **Files.** `app/not-found.tsx`, `app/not-found.module.css`, `app/error.tsx`,
  per-route `error.tsx` / `loading.tsx`, `components/ui/StatusState.tsx`,
  `components/ui/status-state.module.css`, `components/ui/Skeleton.tsx`.
- **Implementation.** Using the VA-05 induction passes, capture: 404, root error
  boundary with retry, per-route error boundary, loading skeleton, "no data",
  "no matches", service-failure/unavailable, image failure, disabled control and
  success. Verify focus lands somewhere sensible after pressing retry. The
  **styling** defect the audit names — the root error's glass/gradient card
  against a token system that calls glass a leftover HUD ramp — is **VA-30**, not
  this task.
- **Dependencies.** **VA-05**.
- **Risk.** None; nothing is written.
- **Acceptance criteria.** A capture for each of the ten states at 375 and 1440,
  and a focus trace after retry.
- **Tests.** The induction passes from VA-05.
- **Visual verification.** As above.
- **Desktop / mobile.** Both.
- **Production verification.** Required for 404 and the unavailable state;
  induced boundaries may be captured locally.
- **Execution path.** Observation.
- **Status.** `BLOCKED` on VA-05

---

## 3. Phase 1 — Highest-value improvements

### VA-10 — Recompose the homepage first viewport

- **Problem.** The cover is `clamp(560px, 88svh, 980px)` on landscape
  (`app/home.module.css:87`) and the masthead's tall composition starts at
  `clamp(440px, 49svh, 660px)` (`:98`, and `clamp(310px, 44svh, 520px)` at `:40`).
  A reader can learn the brand but cannot see what happened today without
  committing to a scroll. Section padding of 44–88px plus several complete
  institutional modules then makes a very long edition.
- **Source finding.** Top-10 #01 (REDESIGN, severity B); Redesign candidate 1;
  Quick Wins 1 and 2; page audit "Homepage"; section D "Spacing and Density" —
  *"REDESIGN homepage vertical economy… Target a 30–40% shorter mobile homepage
  without hiding records."*
- **Classification.** REDESIGN · **Severity.** B · **Work type.** Design System /
  Frontend
- **Files.** `app/page.tsx`, `app/home.module.css` (`:40`, `:87`, `:98`),
  `components/home/HomepageJourney.tsx`,
  `components/home/homepage-journey.module.css`,
  `components/home/CinematicHomeMedia.tsx`,
  `components/home/EditorialIntro.tsx`, `lib/homepage.ts`.
- **Implementation.** Keep the lion and the wordmark — both are explicit KEEPs.
  Constrain the cover to roughly **68–74svh on phones and 72–80svh on desktop**.
  Add an **edition rail** occupying the bottom 25–30% of the cover carrying the
  edition date, the lead story's status, its headline, and "Read the story", so
  the next section begins entering viewport one. Reduce section padding to reach a
  shorter mobile homepage **without removing any record**. **Note on the 30–40%
  figure:** it is not reachable inside this task alone, and measurement on
  2026-09-07 proved it. The `#home-system` band is 3,435px of a 12,809px mobile
  page — **28.7% of the entire homepage** — and it lives in
  `HomeSystemSection.tsx`, `HomeEvidencePipeline.tsx`, `AmplificationFigure.tsx`
  and `narrative-simulation.module.css`, which belong to **VA-21**. Trimming the
  vertical rhythm here yields about −6.5%; relocating the system band yields the
  rest. VA-10 and VA-21 together reach roughly −33%. Do not shrink type or clamp
  preview text to close the gap on this task alone. The lead
  headline must come from the same homepage snapshot the bands read
  (`lib/homepage.ts`, `readHomepageSnapshot`) — do not add a second source of
  truth for "today's lead".
- **Dependencies.** Confirm the current measurements against VA-04's capture
  before editing. Independent of VA-11.
- **Risk.** **High-visibility.** This is the first thing every reader sees, and
  LCP lives here. The cover's motion and its `prefers-reduced-motion` poster must
  survive unchanged. Reserve the rail's space at first paint so it shifts nothing
  below it — CLS is the specific trap.
- **Acceptance criteria.** The lead headline and its status are readable without
  scrolling at 375×812 and at 1440×900. The next section is visibly begun at both.
  Mobile homepage total scroll height is measurably shorter with no type shrunk
  and no preview text clamped — expect roughly −6.5% from this task, with the
  30–40% figure met jointly with VA-21 (see the note above). No record
  is hidden. Reduced-motion still gets the poster.
- **Tests.** `ci-smoke.mjs` must stay green (it asserts the homepage's destination
  links and a 390px visibility check). Add an assertion that the homepage's lead
  headline text appears in the prerendered HTML.
- **Visual verification.** Before/after at all six widths; the first viewport
  specifically at 375, 430 and 1440.
- **Desktop / mobile.** Both, portrait and landscape phone.
- **Production verification.** **Required** — plus an LCP measurement (see VA-40).
- **Execution path.** **Development.**
- **Status.** `NEEDS VISUAL VERIFICATION` (confirm current cover geometry via
  VA-04 before editing) → then `READY`

### VA-11 — Hero donation chips: keep, move, or remove

- **Problem.** The audit says the two hero donation chips arrive before the
  edition and compete with "Read the latest" before reporting has earned the ask,
  and recommends removing them. `.ai/DECISIONS.md` records, **on the same day**,
  an owner ruling that put them there deliberately: *"the ask is on the cover
  too… the owner ruled that both channels also belong at the top of the homepage,
  'elegantly, popping for a moment'"* — and notes that on a phone the header
  hides its Support control, so the strip is the cover's only support affordance.
  Two authorities, same date, opposite conclusions.
- **Source finding.** Top-10 #01 and #07; Quick Win 1; page audit "Homepage";
  section D "Navigation and CTA Patterns" — *"CONSOLIDATE… five separate support
  appearances."* Against: `.ai/DECISIONS.md`, 2026-09-07.
- **Classification.** REMOVE-CONSOLIDATE · **Severity.** B · **Work type.** UX /
  Frontend
- **Files.** `components/home/HeroSupportStrip.tsx`,
  `app/home.module.css:66` (`.supportChip`), `lib/donation-channels.ts`,
  `app/page.tsx`, `tests/support-surface.test.ts`.
- **Options to put to the owner.** (a) **Keep as ruled** — the audit's concern is
  answered instead by VA-10 putting the lead headline above the chips, so the
  edition is seen first. (b) **Move** the strip below the edition rail, still on
  the cover, so reporting precedes the ask by position. (c) **Remove** from the
  cover, keeping the header action and `HomeSupportSection`, per the audit.
  Recommendation: **(b)** — it satisfies the audit's actual objection (order)
  without discarding the ruling (presence).
- **Dependencies.** VA-10 defines what the cover contains.
- **Risk.** Reversing a recorded owner ruling without asking. Whatever is decided,
  amend `.ai/DECISIONS.md` in the same commit so the record does not contradict
  the code again.
- **Acceptance criteria.** Whatever the owner chooses, implemented, with the
  decision log updated and `tests/support-surface.test.ts` still green.
- **Tests.** `tests/support-surface.test.ts` (no Buy Me a Coffee scripts, CSP
  unwidened) must not regress.
- **Visual verification.** Cover at 375, 430, 1440 in the chosen arrangement.
- **Desktop / mobile.** Both — note the phone header hides its Support control.
- **Production verification.** Required.
- **Execution path.** **Development.**
- **Status.** `RESOLVED — owner ruling, 2026-09-07 (second): the chips stay.`
  Put to the owner after VA-10 landed, with the cover recomposed so the edition
  rail — date, lead status, lead headline, "Read the story" — sits **above**
  `HeroSupportStrip`. The owner ruled to keep the chips as they are. The audit's
  substantive objection was *order*, not presence: "the hero placement competes
  with 'Read the latest' before reporting has earned the ask." VA-10 answers
  that by making the reporting arrive first, so no further code change is
  required and the 2026-09-07 ruling stands unaltered. Do not reopen this
  without a new owner instruction.

### VA-12 — Suppress exact duplicates in the news archive projection

- **Problem.** The live archive carries near-duplicate records for the West Bank
  outpost story, repeated Lebanon developments, and two identical civil-defence
  briefing records. Equal-weight repetition makes the desk look automatically
  populated and makes "what matters most?" harder to answer.
- **Source finding.** Top-10 #04 (REMOVE/CONSOLIDATE, severity B); Quick Win 5;
  page audit "News & Analysis Hub".
- **Classification.** REMOVE-CONSOLIDATE · **Severity.** B · **Work type.**
  Frontend / Editorial
- **Files.** `components/briefs/LiveBriefHub.tsx` (`:111` `newsOnly`, `:235`
  archive block), `lib/publications.ts`.
- **Implementation.** Two halves, and both are wanted. **Editorial (do first,
  needs no deploy):** archive the exact-duplicate records through
  `archive_publication`, leaving one canonical record per story. **Code
  (interim):** in the archive projection only, collapse records with an identical
  normalised title *and* summary to the newest, and note the collapse in the
  archive's record count. Derive nothing from a hand-written section list — use
  `SECTIONS_BY_HOMEPAGE_SECTION` as `LiveBriefHub` now does. This is deliberately
  the cheap version; **VA-19** is the real model.
- **Dependencies.** None. Blocks nothing, unblocks VA-19's design.
- **Risk.** Medium. Two genuinely distinct stories can share a headline. Match on
  title **and** summary, never title alone, and keep the collapse to the archive
  projection so nothing is hidden from Search or from the record's own page.
- **Acceptance criteria.** No two archive cards show identical title and summary.
  Every collapsed record is still reachable by URL and by Search. The archive's
  record count reflects what is shown.
- **Tests.** Unit test on the collapse predicate: identical pair collapses;
  same-title different-summary pair does not.
- **Visual verification.** `/geopolitical-brief` archive open, before and after.
- **Desktop / mobile.** 375 and 1440.
- **Production verification.** **Required.**
- **Execution path.** Editorial half **MCP**; code half **Development**.
- **Status.** `READY`

### VA-13 — Put status and claim before illustration; compact the caption

- **Problem.** A generated editorial illustration arrives before the headline and
  status and can form the reader's first interpretation, even though the
  disclosure itself is explicit and excellent. Full provenance metadata sits in
  the headline's way.
- **Correction, measured 2026-09-07 — the defect was larger than the audit
  states.** The audit's premise is that "disclosure is explicit, which is
  excellent" and only its *position* is wrong. On the **article page** that
  premise was false: the hero `<figure>` in `app/articles/[publicId]/page.tsx`
  rendered `caption` + `credit` and **no disclosure at all**. An
  `editorial-illustration` was therefore presented indistinguishably from
  documentation on every article page on the site. The ordering fix is real, but
  the missing disclosure was the more serious failure, and it is the one this
  task actually repairs first. The audit's praise applies to the homepage
  (`HomeJourneyPrimitives.tsx` `HomeMedia`), which did carry the line.
- **Remaining scope after the 2026-09-07 pass** (the homepage half, deferred
  because another agent held `components/home/` at the time): (1) in
  `components/home/HomeNarrativesSection.tsx` lines ~60–80, status already
  precedes the image but the **headline does not** — move `.dossierCover` after
  the `<h3>`, gated on `isManufacturedMedia()`, likely via `grid-template-areas`
  rather than a raw DOM move. Only the narratives band is a claim surface; news,
  people and archive need no reorder. (2) `homepage-journey.module.css:64`
  `.disclosure` is 12px and `.figure figcaption` is 12px — both under the
  `UX-CONTRACT.md` 13px floor; use `var(--t-caption)`. (3)
  `.provenance summary` computes to ~27px, under the 44px floor; copy the
  `.provenanceDetails > summary` rule from `media-block.module.css`.
  (4) `ROLE_DISCLOSURE` at `HomeJourneyPrimitives.tsx:103` is now a **second
  copy** of the constant in `components/content/MediaBlock.tsx` — import the
  canonical one and delete the local copy, or the two wordings drift exactly as
  the duplicated `narrativeWatchTitle()` recognisers did. Note the local copy
  special-cases `safe-cover` to the bare string "Safe cover" and ignores the
  record's own `disclosure`; `mediaDisclosure()` prefers the record's wording,
  which is what the contract implies.
- **Source finding.** Top-10 #08 (IMPROVE, severity B); Quick Win 7; section E
  "Media component" — *"Place status/title before non-documentary illustration on
  claim pages. Keep a one-line disclosure visible; let full caption/credit/source
  expand without preceding the headline."*
- **Classification.** IMPROVE · **Severity.** B · **Work type.** Media / Frontend
- **Files.** `components/content/MediaBlock.tsx`,
  `components/content/media-block.module.css`,
  `components/home/HomeJourneyPrimitives.tsx`,
  `server/contracts/editorial-media.ts`, `app/articles/[publicId]/page.tsx`.
- **Correction to the audit.** Appendix A lists `MediaBlock.tsx` and
  `media-block.module.css` without a directory; they are at
  `components/content/`, not `components/media/`.
- **Implementation.** On claim pages (`narrative_watch`,
  `influence_investigation`, `antisemitism`), render status and headline above any
  non-documentary image. Keep exactly one line of disclosure adjacent to the
  image and always visible — this is the KEEP, and it must not be collapsed. Move
  credit, source URL, rights state and focal-point detail into an expandable
  `<details>`. The `role` field on `editorialMediaSchema` already distinguishes
  documentation, portrait, archival-context, editorial-illustration and
  safe-cover — branch on it rather than adding a new flag.
- **Dependencies.** None; pairs with VA-16.
- **Risk.** **The disclosure must never end up behind the disclosure control.**
  An editorial illustration presented as documentation is the failure this whole
  system is built to prevent. Verify the visible line survives at 375 with a long
  credit string.
- **Acceptance criteria.** On a claim page, status and headline precede the
  illustration. The one-line disclosure is visible without interaction at every
  width. Full provenance is reachable in one press.
- **Tests.** Assert that a record with `role: "editorial-illustration"` renders
  its disclosure string outside any collapsed container.
- **Visual verification.** One claim page with an illustration, one with a
  documentary image, at 375 and 1440.
- **Desktop / mobile.** Both.
- **Production verification.** Required.
- **Execution path.** **Development.**
- **Status.** `READY`

### VA-14 — Make the Fake Resistance / Fact Checks division task-based

- **Problem.** Both destinations are now in the menu, but `/fake-resistance` also
  carries an "On the watch" section and a `/fake-resistance/watch` archive, while
  `/fact-check` is a desk of circulating claims. A reader has to read the
  descriptions carefully to work out why both exist.
- **Source finding.** Top-10 #09 (IMPROVE, severity B); Quick Win 6; page audits
  "Fake Resistance Hub" and "Narratives & Fact Checks / Watch"; section D
  "Navigation and CTA Patterns" — *"CONSOLIDATE adjacent narrative routes."*
- **Classification.** IMPROVE · **Severity.** B · **Work type.** UX / Frontend
- **Files.** `app/fake-resistance/page.tsx` (`:46`, `:52`, `:73` — the "On the
  watch" count, jump link and section head), `app/fake-resistance/watch/page.tsx`,
  `app/fact-check/page.tsx`, `components/site/navigation-model.ts`
  (`FACT_CHECK_LINK`), `lib/site-navigation.ts`.
- **Implementation.** Rename Fake Resistance's "On the watch" to **"Claim
  assessments"** and point it at `/fact-check`, so there is one narrative-watch
  archive rather than two adjacent ones. Keep `/fake-resistance/watch` addressable
  — a live URL is not deleted here — but stop presenting it as a second front
  door. State the division in each destination's own description: **Fake
  Resistance = investigations and influence operations; Fact Checks =
  claim-by-claim assessments.**
- **Dependencies.** None. Precedes VA-23.
- **Risk.** Low, but every changed link must be checked: `ci-smoke.mjs` walks the
  homepage destination list and will fail on a broken one — which is exactly what
  it is for.
- **Acceptance criteria.** One narrative-watch archive is presented. Both menu
  entries carry a task-based description. `/fake-resistance/watch` still resolves.
  `ci-smoke.mjs` green.
- **Tests.** `ci-smoke.mjs` route walk; a navigation-model unit assertion that
  both destinations exist with distinct descriptions.
- **Visual verification.** `/fake-resistance`, `/fact-check` and the menu at 375
  and 1440.
- **Desktop / mobile.** Both, including the mobile panel.
- **Production verification.** Required.
- **Execution path.** **Development.**
- **Status.** `READY`

### VA-15 — Correct active-state ownership for "How it works"

- **Problem.** `/information-war` ("How it works" / Behind the Desk) resolves to
  the News section for active-state logic, so the header highlights the wrong
  primary destination when a reader is on it.
- **Source finding.** Page audit "Global Header and Desktop Navigation" —
  *"How it works is resolved to the News section for active-state logic."*
- **Classification.** FIX · **Severity.** C · **Work type.** Frontend
- **Files.** `lib/site-navigation.ts`, `components/site/navigation-model.ts`
  (`SYSTEM_LINK`), `components/site/SiteHeader.tsx`.
- **Implementation.** Give `/information-war` its own active-state identity
  rather than falling through to the News hub. `aria-current` must follow.
- **Dependencies.** None.
- **Risk.** Low. Confirm no other route relies on the same fall-through.
- **Acceptance criteria.** On `/information-war`, no primary nav item other than
  the system link carries the active state, and `aria-current="page"` is on the
  right element.
- **Tests.** Unit test on the active-state resolver for `/information-war`,
  `/geopolitical-brief` and one article route.
- **Visual verification.** Header on `/information-war` at 375 and 1440.
- **Desktop / mobile.** Both.
- **Production verification.** Required.
- **Execution path.** **Development.**
- **Status.** `READY`

### VA-16 — Default to a text-led composition when no documentary image exists

- **Problem.** Routine reporting receives cinematic generated dossiers, maps and
  military silhouettes as one-image-per-story fulfilment. Repeated dark still
  lifes risk a generic "AI intelligence" aesthetic, and an illustration on a
  routine news item earns nothing.
- **Source finding.** Top-10 #08 *Direction* — *"Default to text-led composition
  when no documentary image exists. Use generated illustration for explanatory
  features, not as routine one-image-per-story fulfillment."*; section E "Asset
  replacement".
- **Classification.** IMPROVE · **Severity.** B · **Work type.** Editorial / Media
- **Files.** Editorial policy in `docs/editorial-dna.md`; the media half of a
  `whole-site-update-v2` package (`server/contracts/whole-site-update.ts:53,69`);
  the text-led fallback in `components/content/MediaBlock.tsx` and
  `components/home/HomeJourneyPrimitives.tsx`.
- **Implementation.** Change what the daily run *chooses*, not what the code
  *permits*. Record the rule in `docs/editorial-dna.md`: prefer direct
  documentary material where rights allow; where none exists, publish text-led
  rather than commissioning an illustration; reserve generated illustration for
  explanatory features. Then replace the worst existing offenders on live records
  through update operations carrying `media`. The text-led fallback already exists
  and is a KEEP — this task exercises it rather than building it.
- **Dependencies.** VA-13 (disclosure ordering) should land first so a
  remaining illustration is at least correctly framed.
- **Risk.** A homepage slot cannot carry a picture for a record with no hero
  (`.ai/DECISIONS.md`, 2026-09-07). Going text-led on a record intended for a
  homepage lead changes what that slot looks like — decide the placement and the
  media together.
- **Acceptance criteria.** The editorial rule is written down. No routine news
  record on the homepage or the news hub carries a generated illustration purely
  to fill an image slot.
- **Tests.** None — this is policy plus content.
- **Visual verification.** Homepage and `/geopolitical-brief` before and after.
- **Desktop / mobile.** Both.
- **Production verification.** **Required.**
- **Execution path.** Doc change is **Development**; the record changes are
  **MCP / editorial**.
- **Status.** `NEEDS VISUAL VERIFICATION` (VA-04 must show which live records
  actually carry these images now)

### VA-17 — Search: put query, status and results first on mobile

- **Problem.** Visible shortcut grammar and the full fallback index read like
  developer chrome, and on a phone they compete with the results.
- **Correction, measured 2026-09-07.** Half of this finding was already
  satisfied and half was worse than described. The shortcut grammar
  (`.footKeys`) was **already** `display: none` below 45rem, and `.foot`
  already sat below the results — so "the first result is visible without
  scrolling past shortcut documentation" was already true at 375, incidentally
  rather than structurally (first result at y=510 in an 812px viewport). What
  was **not** satisfied is the *result status* half: there was no visible status
  at any width. The hit count existed only in an sr-only live region, and the
  one sentence naming which matcher answered — "Matching on words, names and
  meaning." / "Semantic matching is unavailable in this deployment." — sat in
  the footer at **y=2166 on a phone, below all eight results**. On a phone that
  is not a footer; it is a deletion. The honest disclosure that semantic search
  is unavailable was the thing no phone reader ever saw.
- **Source finding.** Page audit "Search" — *"On mobile prioritize query, result
  status and results; move shortcut education below the first results."*
- **Classification.** IMPROVE · **Severity.** B · **Work type.** UX / Frontend
- **Files.** `app/search/page.tsx`, `components/search/SearchPageView.tsx`,
  `components/search/SearchPanel.tsx`, `components/search/SearchResults.tsx`,
  `components/search/search.module.css`, `components/search/vocabulary.ts`.
- **Implementation.** On narrow widths, order the page: query field, result
  status, results, then shortcut education, then the no-JS fallback index. Keep
  the interaction itself — keyboard navigation and the accessible no-JS index are
  both KEEPs and must survive. Reorder with CSS ordering or a narrow-width
  branch; do not remove the fallback index from the DOM, or the no-JS pass in
  `ui-audit.mjs` will correctly fail.
- **Dependencies.** VA-04 for the current mobile result list, which was never
  captured.
- **Risk.** The no-JS index is load-bearing. Verify with scripting disabled at
  375 before merging.
- **Acceptance criteria.** At 375, the first result is visible without scrolling
  past shortcut documentation. Escape clears/closes as before. The no-JS index
  still renders and still links.
- **Tests.** `ui-audit.mjs` no-JS pass includes `/search`; it must stay green.
- **Visual verification.** `/search` with a query, no matches, and an induced API
  failure, at 375 and 1440, plus 200% zoom.
- **Desktop / mobile.** Both; mobile is the change.
- **Production verification.** Required.
- **Execution path.** **Development.**
- **Status.** `NEEDS VISUAL VERIFICATION` → `BLOCKED` on VA-04

---

## 4. Phase 2 — Structural redesigns

### VA-18 — Build the article family

- **Problem.** One article route serves routine news, analysis, narrative watch
  and evidence-heavy material. Hiding empty steps (VA-03) leaves the wrong
  information architecture in place.
- **Source finding.** Top-10 #03; Redesign candidate 2; page audit "Standard
  News, Innovation and Daily-Brief Articles" — *"Action: REDESIGN — Severity A."*
- **Classification.** REDESIGN · **Severity.** A · **Work type.** Frontend /
  Design System
- **Files.** `app/articles/[publicId]/page.tsx`, `app/articles/[publicId]/article.module.css`,
  `components/evidence/InvestigationExplorer.tsx`, `lib/publication-routing.ts`,
  `components/content/MediaBlock.tsx`, `components/ui/StatusState.tsx`.
- **Implementation.** Six templates — **News Story, Developing Story, Analysis,
  Explainer, Evidence Record, Investigation** — sharing one set of primitives:
  typography, the facts row, the source stack, corrections, related coverage and
  the media block. Only Narrative Watch and investigations get claim/spread/
  recognition stages. A standard story reads headline → deck → status → byline
  and date → concise source stack → body → updates and corrections → related
  coverage. **Derive the template from `publication.section` in
  `lib/publication-routing.ts`** — there is deliberately no `template`,
  `destination` or `frontendSection` field for a composer to pick, and adding one
  is how a record ends up filed two different ways on two surfaces.
- **Dependencies.** **VA-03** (the interim gate proves the section mapping is
  right before six templates depend on it). Informs VA-20.
- **Risk.** **The largest change in this backlog.** Every published record routes
  through this page. Build the templates behind the existing derivation so an
  unmapped section falls back to News Story rather than to nothing.
- **Acceptance criteria.** Each of the six types renders its own composition. No
  template shows an empty ceremonial section. Every section value in
  `PUBLICATION_SECTIONS` maps to exactly one template. The analysis
  no-sources disclosure and `narrativeWatchTitle()` prefixing both survive
  unchanged.
- **Tests.** A mapping test covering **every** value in `PUBLICATION_SECTIONS` —
  count it at the source, never from prose. Plus a test that an unknown section
  falls back rather than throwing.
- **Visual verification.** One live record per template, all six widths.
- **Desktop / mobile.** Both, with an 80–110 character headline on each.
- **Production verification.** **Required, per template.**
- **Execution path.** **Development.**
- **Status.** `BLOCKED` on VA-03

### VA-19 — Canonical story and developing-story model

- **Problem.** Duplicates and near-duplicates are separate records with equal
  weight. CSS cannot restore editorial meaning when the projection treats an
  update as a new story.
- **Source finding.** Top-10 #04; Redesign candidate 5; page audit "News &
  Analysis Hub" — *"De-duplicate canonical stories, cluster developing updates,
  add a compact 'what changed' treatment."*
- **Classification.** REDESIGN · **Severity.** B · **Work type.** Backend /
  Frontend
- **Files.** `server/contracts/publication.ts:37` (`canonicalStoryIdSchema`),
  `:193` (`canonicalStoryId` on `publicPublicationSchema`),
  `server/modules/publications/`, `components/briefs/LiveBriefHub.tsx`,
  `lib/publications.ts`, `lib/publication-routing.ts`.
- **Correction to the audit.** The audit implies the canonical layer must be
  built. The **identifier already exists** and is already on the public
  projection: `canonicalStoryId` is on `publicPublicationSchema` at
  `server/contracts/publication.ts:193`, and both `whole-site-update` update
  targets and the connector's `find_publication` resolve by it. What is missing
  is the **projection and the presentation** — grouping, a latest-headline, an
  update log and one archive identity. Do not add a second identifier.
- **Implementation.** Group published records by `canonicalStoryId` in the
  archive and hub projections. Present one card per story carrying the latest
  headline and deck, an update log, and change markers. Give the story one
  archive identity; individual updates stay addressable by their own `publicId`.
  Retire the VA-12 title/summary collapse once this lands.
- **Dependencies.** **VA-12** (its collapse is the stopgap this replaces).
- **Risk.** Records published before the field was populated carry a null
  `canonicalStoryId` and must fall back to standing alone, never to being
  grouped with each other.
- **Acceptance criteria.** A developing story renders as one card with an update
  timeline. Records with no canonical id still appear individually. Every update
  is still reachable at its own URL and by Search.
- **Tests.** Grouping tests including the null case; the null case is the one that
  will actually break.
- **Visual verification.** `/geopolitical-brief` with a real multi-update story.
- **Desktop / mobile.** 375 and 1440.
- **Production verification.** **Required.**
- **Execution path.** **Development**; the editorial half — assigning
  `canonicalStoryId` to existing related records — is **MCP / editorial**.
- **Status.** `BLOCKED` on VA-12

### VA-20 — Editorial states become layouts, not badges

- **Problem.** Breaking, Developing, Analysis, Investigation, Evidence,
  Explainer, Opinion, Update and Correction have explicit words and colours but
  collapse into the same badge, row and card grammar. The states differ in
  meaning far more than the compositions differ.
- **Source finding.** Top-10 #05 (REDESIGN, severity B); section D "Cards, Shapes
  and Labels" — *"REDESIGN editorial status from 'same badge, different
  word/color' to state-specific anatomy and update behavior."*; section H —
  *"Editorial states are layouts."*
- **Classification.** REDESIGN · **Severity.** B · **Work type.** Design System /
  Frontend
- **Files.** `components/ui/Badge.tsx`, `components/ui/badge.module.css`,
  `components/ui/StatusState.tsx`, `components/ui/Card.tsx`,
  `components/ui/card.module.css`, `lib/publication-routing.ts` (card label
  derivation).
- **Implementation.** Give each state an anatomy, per the audit: **Breaking** — a
  time rail and a terse update stack. **Developing** — "known / new /
  unresolved". **Analysis** — author thesis and an explicit evidence boundary.
  **Investigation** — methods and ledger. **Correction** — a persistent amendment
  bar with a version link. Status must never be carried by colour alone; every
  state keeps its word.
- **Dependencies.** **VA-18** (the templates are where these anatomies live).
- **Risk.** Scope creep into a component-library rewrite. Constrain it to the
  states the audit names.
- **Acceptance criteria.** Each named state renders a distinguishable composition
  in greyscale. A correction shows a persistent amendment bar linking to the
  version.
- **Tests.** A rendering assertion per state that its distinguishing element is
  present.
- **Visual verification.** One record per state, plus a greyscale pass proving
  colour is not the only signal.
- **Desktop / mobile.** Both.
- **Production verification.** Required.
- **Execution path.** **Development.**
- **Status.** `BLOCKED` on VA-18

### VA-21 — Reduce the homepage system section to one proof module

- **Problem.** After news, narratives, October 7 and People, the homepage adds a
  multi-stage investigation walkthrough, two branch explanations, a
  source-amplification lesson and a separate support band. Each submodule is
  coherent; together they make the homepage serve two complete products.
- **Source finding.** Top-10 #06 (REMOVE/CONSOLIDATE, severity B); Redesign
  candidate 4; page audit "Homepage".
- **Classification.** REMOVE-CONSOLIDATE · **Severity.** B · **Work type.**
  Frontend / Editorial
- **Files.** `components/home/HomeSystemSection.tsx`,
  `components/home/HomeEvidencePipeline.tsx`,
  `components/home/AmplificationFigure.tsx`,
  `components/home/SignalRotator.tsx`,
  `components/home/narrative-simulation.module.css`,
  `components/home/homepage-journey.module.css`,
  `components/home/HomepageJourney.tsx`, `app/information-war/page.tsx`.
- **Implementation.** One compact evidence-chain proof with **one** interaction
  and **two** links — one to How it works, one to Methodology. The full
  architecture, the branch explanations and the amplification lesson move to
  `/information-war`, where they are the page's actual job. Nothing is deleted;
  it relocates.
- **Dependencies.** **VA-10** (cover recomposition sets the homepage's budget).
  Pairs with **VA-22**.
- **Risk.** These modules are among the site's most distinctive work. Relocation,
  not deletion — and `/information-war` must be checked for the content arriving
  twice.
- **Acceptance criteria.** The homepage system band is one module with one
  interaction. `/information-war` carries everything removed, without duplication.
- **Tests.** `ci-smoke.mjs` homepage destination walk stays green.
- **Visual verification.** Homepage full-height and `/information-war`, before
  and after, at 375 and 1440.
- **Desktop / mobile.** Both.
- **Production verification.** Required.
- **Execution path.** **Development.**
- **Status.** `BLOCKED` on VA-10

### VA-22 — One job each: How it works, Methodology, We Are

- **Problem.** Method content repeats across the homepage, How it works and We
  Are. How it works includes a deep interactive journey; We Are restates pipeline
  mechanics. Product architecture, editorial standard and organisation blur
  together.
- **Source finding.** Page audit "How It Works / We Are / Methodology /
  Corrections" — *"Action: REMOVE / CONSOLIDATE — Severity B."*; Top-10 #06.
- **Classification.** REMOVE-CONSOLIDATE · **Severity.** B · **Work type.**
  Editorial / Frontend
- **Files.** `app/information-war/page.tsx`, `app/we-are/page.tsx`,
  `app/methodology/page.tsx`, `app/corrections/page.tsx`.
- **Implementation.** Assign one job each, per the audit: **How it works =
  system architecture. Methodology = evidentiary rules. We Are = people,
  governance and values. Homepage = one proof point.** Remove the pipeline
  restatement from We Are. **Preserve `/corrections` almost exactly** — its empty
  state, which says both that the ledger is empty and that emptiness is not proof
  the standard has been tested, is a KEEP and its wording must not be
  paraphrased.
- **Dependencies.** **VA-21** (which relocates content into How it works).
- **Risk.** Losing a good sentence in a reshuffle. Move text, do not rewrite it,
  unless the rewrite is the point.
- **Acceptance criteria.** No method explanation appears on more than one of the
  four pages. Corrections is byte-identical except where a task explicitly
  changes it.
- **Tests.** `ci-smoke.mjs` route walk.
- **Visual verification.** All four pages at 375 and 1440.
- **Desktop / mobile.** Both.
- **Production verification.** Required.
- **Execution path.** **Development.**
- **Status.** `BLOCKED` on VA-21

### VA-23 — Fake Resistance hub: three doors

- **Problem.** The hub currently offers four counters, six in-page jump links and
  three bottom links: Latest investigation, On the watch, Antisemitism, Influence
  operations, The influence network, The playbook, Further investigations,
  Documented narrative investigations, Antisemitism records, and a news
  cross-link. Without stronger role language a reader has to infer which path
  answers which question.
- **Source finding.** Page audit "Fake Resistance Hub" — *"Preserve the hub as
  the investigation front door with three doors only: Current investigations,
  Influence network, Methods/playbook. Route claim-by-claim assessment to Fact
  Checks."*; Redesign candidate 3.
- **Classification.** IMPROVE · **Severity.** B · **Work type.** UX / Frontend
- **Files.** `app/fake-resistance/page.tsx` (`:45–56` counters and jump links,
  `:105–108` bottom links), `app/fake-resistance/page.module.css`.
- **Implementation.** Three doors: **Current investigations**, **Influence
  network**, **Methods / playbook**. Claim-by-claim assessment routes to
  `/fact-check` (VA-14). Antisemitism records and the official-narrative
  investigations become collections reached from Current investigations, not
  peer front doors. Every existing route stays addressable.
- **Dependencies.** **VA-14**.
- **Risk.** Burying a live section. Each demoted route needs a clear path in from
  its new parent, and `ci-smoke.mjs` must still reach it.
- **Acceptance criteria.** The hub presents three primary paths. Every current
  sub-route is reachable in at most two presses from the hub.
- **Tests.** `ci-smoke.mjs`; a link-reachability assertion for the demoted routes.
- **Visual verification.** `/fake-resistance` at 375 and 1440.
- **Desktop / mobile.** Both.
- **Production verification.** Required.
- **Execution path.** **Development.**
- **Status.** `BLOCKED` on VA-14

### VA-24 — Narrative and fact-check row anatomy

- **Problem.** Repeated badge and row treatment makes disputed, unresolved and
  false claims look more alike than their meanings warrant.
- **Source finding.** Page audit "Narratives & Fact Checks / Watch" — *"Make
  anatomy explicit inside each row: status sentence first, exact claim second,
  one-line basis third, date/update fourth. Use different structures for
  unresolved and adjudicated records, not only color."*
- **Classification.** REDESIGN · **Severity.** B · **Work type.** Frontend
- **Files.** `app/fact-check/page.tsx`, `app/fake-resistance/watch/page.tsx`,
  `components/ui/Badge.tsx`, `lib/publication-routing.ts`.
- **Implementation.** Fixed row order: status sentence, exact claim, one-line
  basis, date and last update. Adjudicated and unresolved records get
  structurally different rows, not the same row in a different colour. Read
  `evidenceBasis` as `=== "analysis"`, never as `!== "analysis"` — rows predating
  the field carry no key and must fall to the strict, sourced side. Headline
  prefixing stays in `narrativeWatchTitle()`; do not add a second prefixer.
- **Dependencies.** **VA-20** (state anatomy), **VA-14** (one archive).
- **Risk.** The "Reported claim: Analysis: X" double-prefix bug is exactly what
  happens when a second prefixer appears. Use the contract's function.
- **Acceptance criteria.** Row order is fixed and identical across both surfaces.
  Adjudicated and unresolved rows are distinguishable in greyscale. No headline is
  double-prefixed.
- **Tests.** A `narrativeWatchTitle()` assertion including a record with no
  `evidenceBasis` key; a row-order assertion.
- **Visual verification.** `/fact-check` at 375 and 1440, greyscale pass.
- **Desktop / mobile.** Both.
- **Production verification.** Required.
- **Execution path.** **Development.**
- **Status.** `BLOCKED` on VA-20

### VA-25 — Investigation case: an orientation block in the first viewport

- **Problem.** A roughly 1,900-line case file opens with many metrics and caveats
  before the core evidence. The evidence model itself — withdrawn findings, null
  models, confidence, contradictions, unresolved identities, source groups, a
  nine-part index and an evidence ledger — is the product's most differentiated
  surface and is explicitly not to be redesigned.
- **Source finding.** Page audit "Investigation / OSINT Case Files" — *"Do not
  redesign the evidence model. Improve the first viewport with 'finding /
  strength / limit / changed since publication.' Preserve the full ledger."*
- **Classification.** IMPROVE · **Severity.** B · **Work type.** Frontend
- **Files.** `app/fake-resistance/cases/[slug]/page.tsx`,
  `components/investigation/CaseStoryHeader.tsx`,
  `components/investigation/InvestigationSectionNav.tsx`,
  `components/investigation/EvidenceLedger.tsx`,
  `components/investigation/EntityInspector.tsx`,
  `components/investigation/investigation.module.css`.
- **Implementation.** Add a four-part orientation block at the top: **finding /
  strength / limit / changed since publication**. Everything below it stays
  exactly as it is. Dense entity and relationship controls
  (`EntityInspector.tsx`, `NetworkExplorer.tsx`, `RelationshipFlow.tsx`) are
  high-risk on a phone and must be verified there — that verification is part of
  this task, not a follow-up. Reader/analyst modes are explicitly optional and
  only if both remain views of the same evidence record; treat as out of scope
  unless the owner asks.
- **Dependencies.** **VA-04** (the audit could not capture this surface at all).
- **Risk.** The evidence model is a KEEP. Add above it; change nothing inside it.
- **Acceptance criteria.** The first viewport of the Hinkle case answers what was
  found, how strongly, with what limit, and what changed. The ledger, withdrawn
  findings and unknowns panel are untouched.
- **Tests.** Existing investigation tests stay green.
- **Visual verification.** The case at all six widths; the entity and
  relationship controls specifically at 375 and 430 with touch emulation.
- **Desktop / mobile.** Both; mobile is the risk.
- **Production verification.** Required.
- **Execution path.** **Development.**
- **Status.** `NEEDS VISUAL VERIFICATION` → `BLOCKED` on VA-04

### VA-26 — October 7: a human-led first viewport and labelled showcase controls

- **Problem.** Two manual 1-of-6 showcase modules use similar interaction
  patterns and depend on arrows for discovery. Category counts can feel
  catalogue-like before the human record is understood.
- **Source finding.** Page audit "October 7 Hub and Archive Records" — *"Keep the
  safety model unchanged. Make the first viewport human-led: one testimony, one
  documentary record, then archive tools. Add visible previous/next labels and
  position, test keyboard/swipe, and keep categories below the editorial
  introduction."*
- **Classification.** IMPROVE · **Severity.** B · **Work type.** UX / Frontend
- **Files.** `app/october-7/page.tsx` (`:134–137`, the two
  `ArchiveShareShowcase` instances), `app/october-7/ArchiveShareShowcase.tsx`,
  `app/october-7/page.module.css`, `components/archive/*`,
  `components/archive/archive.module.css`.
- **Implementation.** Open with one testimony and one documentary record; move
  category counts below the editorial introduction; give both showcases visible
  previous/next labels and a position indicator ("2 of 6"), not bare arrows; test
  keyboard and swipe on both. **The safety model does not change:** content
  warning, reader-controlled reveal of graphic media, no autoplay, explicit
  source, sharing with context, language coverage and the testimony/documentation
  separation are all KEEPs.
- **Dependencies.** **VA-04** (no current capture of this hub exists).
- **Risk.** The most sensitive surface on the site. Any change that could expose
  graphic media before a reader asks for it is a defect, full stop. Verify the
  reveal gate explicitly after every edit.
- **Acceptance criteria.** First viewport is human-led. Both showcases announce
  position and direction in words. Keyboard and swipe both work. The content
  warning and reveal gate behave identically to before.
- **Tests.** A test asserting graphic media is not rendered before the reveal.
  `ui-interaction-audit.mjs` keyboard pass on `/october-7`.
- **Visual verification.** `/october-7`, `/october-7/testimonies`,
  `/october-7/documentation` at all six widths.
- **Desktop / mobile.** Both, with touch emulation for swipe.
- **Production verification.** **Required.**
- **Execution path.** **Development.**
- **Status.** `NEEDS VISUAL VERIFICATION` → `BLOCKED` on VA-04

### VA-27 — The People hub as a curated front; legacy pages as collections

- **Problem.** `/our-heroes` and `/israels-story` remain separate full pages while
  also feeding the People hub, and the homepage can become a third complete index
  of all three. Some People records lack canonical source records and media.
- **Source finding.** Page audit "The People of Israel / Our Heroes / Israel's
  Story" — *"Use the hub as a curated front with no more than one lead per
  domain; treat legacy pages as collections reached from it. Fix source/media
  completeness before expanding volume."*
- **Classification.** IMPROVE · **Severity.** B · **Work type.** Frontend /
  Editorial
- **Files.** `app/people-of-israel/`, `app/our-heroes/`, `app/israels-story/`,
  `lib/site-navigation.ts` (`LEGACY_SECTION_PAGES`),
  `components/home/HomePeopleSection.tsx`, `lib/publication-routing.ts`.
- **Implementation.** The hub carries **at most one lead per domain** across the
  eight People sections (`people`, `courage_service`, `innovation`,
  `technology_ai`, `science_medicine`, `achievement`,
  `international_cooperation`, `history_context`) — derive that list from
  `SECTIONS_BY_HOMEPAGE_SECTION`, never by hand. `/our-heroes` and
  `/israels-story` keep their addresses and shells (they are recorded in
  `LEGACY_SECTION_PAGES` and were deliberately **not** deleted) and are presented
  as collections reached from the hub. Source and media completeness (VA-01) comes
  before any volume increase.
- **Dependencies.** **VA-01** (source completeness on People records).
- **Risk.** Deleting a legacy address. Both stay live.
- **Acceptance criteria.** The hub shows one lead per domain. Both legacy URLs
  resolve and are linked from the hub. The homepage People band is not a third
  full index.
- **Tests.** `ci-smoke.mjs` route walk includes both legacy pages; a derivation
  test that the hub's domain list comes from the routing module.
- **Visual verification.** All three pages at 375 and 1440.
- **Desktop / mobile.** Both.
- **Production verification.** Required.
- **Execution path.** **Development**; the media/source completion is
  **MCP / editorial**.
- **Status.** `BLOCKED` on VA-01

### VA-28 — Support distribution and a quiet footer close

- **Problem.** Support appears as a permanent header action, hero chips, a full
  closing donation section, footer navigation and a dedicated page — five
  appearances. The footer's display-size brand and multi-column index add another
  large chapter after an already long homepage, repeating actions offered above.
- **Source finding.** Top-10 #07 (REMOVE/CONSOLIDATE, severity B); page audit
  "Footer" — *"Keep trust links and compact the homepage footer variant. Remove
  conversion repetition; close with methodology, corrections, index and
  colophon."*; section D "Navigation and CTA Patterns".
- **Classification.** REMOVE-CONSOLIDATE · **Severity.** B/C · **Work type.**
  UX / Frontend
- **Files.** `components/site/SiteFooter.tsx`,
  `components/site/site-footer.module.css`,
  `components/home/HomeSupportSection.tsx`, `app/support-us/page.tsx`.
- **Implementation.** Keep the header Support action, the editorially integrated
  closing band (`HomeSupportSection`) and the dedicated page — all three are
  explicit KEEPs. Remove the footer's conversion repetition; close with
  methodology, corrections, the index and a colophon. Compact the homepage footer
  variant specifically. The hero chips are **VA-11** and are not decided here.
- **Dependencies.** **VA-11** decided; **VA-21** (homepage length).
- **Risk.** Low. Do not remove the methodology and corrections links — their
  prominence is a stated strength.
- **Acceptance criteria.** Support appears in the header, the closing band and
  its own page — plus the cover only if VA-11 rules that way. The footer carries
  no donation call.
- **Tests.** `tests/support-surface.test.ts` stays green.
- **Visual verification.** Footer on the homepage and on an article, 375 and 1440.
- **Desktop / mobile.** Both.
- **Production verification.** Required.
- **Execution path.** **Development.**
- **Status.** `BLOCKED` on VA-11

---

## 5. Phase 3 — Design-system consolidation

### VA-29 — Radius and shape vocabulary

- **Problem.** `--radius-3` is `10px` (`app/globals.css:252`) while the same file
  states at `:241` that *"Cards may use 2 / 4 / 8px only."* The token contradicts
  the rule written beside it.
- **Source finding.** Section D "Cards, Shapes and Labels" — *"radius-3 is 10px
  while the premium system otherwise limits cards to 8px or less. Standardize
  plates at 8px, controls at 4–6px and pills only for true filters/toggles."*;
  Quick Win 8.
- **Classification.** IMPROVE · **Severity.** C · **Work type.** Design System
- **Files.** `app/globals.css:250–253`, and every module consuming
  `--radius-3`.
- **Implementation.** Set `--radius-3: 8px`. Audit `--radius-pill` usage and
  restrict it to true filters and toggles — the token's own comment records that
  it once carried buttons as well. `app/globals.css` is the only place a radius
  may be defined; do not literalise a value in a module.
- **Dependencies.** None, but land it before VA-31/VA-32 touch the same surfaces.
- **Risk.** Low, wide. Every card and control shifts 2px. Capture before and
  after at 1440.
- **Acceptance criteria.** No radius outside 4 / 6 / 8 / pill. No literal
  `border-radius` value in a CSS module that a token could carry.
- **Tests.** A grep-style assertion in the existing style tests, if one exists;
  otherwise visual.
- **Visual verification.** Cards, buttons, chips and pills on the homepage, an
  article and a hub.
- **Desktop / mobile.** Both.
- **Production verification.** Not required in isolation.
- **Execution path.** **Development.**
- **Status.** `READY`

### VA-30 — Retire the residual glass and gradient chrome

- **Problem.** `app/error.tsx` draws its card with
  `linear-gradient(180deg, var(--glass-top), var(--glass-middle),
  var(--glass-bottom))`, an inset highlight and `--shadow-3` (`:75–78`, `:129`,
  `:139`), while `app/globals.css:229` says of the same tokens: *"Kept so
  existing modules do not re-literalise. **Do not add new glass.**"* The error
  boundary is the one place a reader meets a visual language the system has
  retired.
- **Source finding.** Section D "Color and Surfaces" — *"CONSOLIDATE residual
  glass/gradient chrome in root error and older overlays."*; page audit "404,
  Error and Loading States"; Quick Win 8.
- **Classification.** REMOVE-CONSOLIDATE · **Severity.** C · **Work type.**
  Design System
- **Files.** `app/error.tsx:75–78, 116, 129, 139`, `app/globals.css:229–237`,
  any other module still reading a `--glass-*` token.
- **Implementation.** Redraw the root error card in the open editorial system:
  token line, token ground, no gradient, no inset highlight. Then find every
  remaining `--glass-*` consumer and convert it. Remove the tokens once nothing
  reads them — not before.
- **Dependencies.** **VA-09** must capture the current state first, so the change
  has a before.
- **Risk.** Low. `app/error.tsx` is a client component that must keep working
  when the rest of the tree has thrown — keep its styling self-contained.
- **Acceptance criteria.** No `--glass-*` token is read anywhere under `app/`,
  `components/` or `lib/`. The error boundary still offers retry and home, and
  focus lands sensibly after retry.
- **Tests.** An assertion that no file under `app/`/`components/` references
  `--glass-`, in the style of `tests/support-surface.test.ts`.
- **Visual verification.** Induced root error and per-route error at 375 and 1440.
- **Desktop / mobile.** Both.
- **Production verification.** Not required.
- **Execution path.** **Development.**
- **Status.** `BLOCKED` on VA-09

### VA-31 — Display restraint and metadata economy

- **Problem.** Large serif titles appear often enough that section identity
  overpowers story priority. Repeated all-caps mono lines create noise even though
  the 12px data role and 13px caption role both meet the contrast floor.
- **Source finding.** Section D "Typography" — *"IMPROVE display restraint…
  Reserve the largest scale for one page title or lead story per viewport."* and
  *"IMPROVE metadata economy… Combine date, desk, status and source count into one
  compact row."*
- **Classification.** IMPROVE · **Severity.** C · **Work type.** Design System
- **Files.** `app/globals.css` (`--t-*` scale), `app/articles/[publicId]/article.module.css`,
  `components/home/homepage-journey.module.css`,
  `components/briefs/live-brief.module.css`, and the `dataLabel` composition
  point in `app/globals.css`.
- **Implementation.** One largest-scale element per viewport — a page title *or* a
  lead story headline, never both. Build one **facts row** primitive combining
  date, desk, status and source count, and use it everywhere those four appear
  together. Respect the `UX-CONTRACT.md` phone floors: body and summaries ≥16px,
  metadata and captions ≥13px, kickers ≥11px. **Do not lower a size to buy
  economy** — combine lines instead.
- **Dependencies.** **VA-18** (the facts row is a template primitive), **VA-29**.
- **Risk.** The phone floors are a contract. Any reduction below them is a
  regression, not a refinement.
- **Acceptance criteria.** No viewport shows two largest-scale elements. The
  facts row exists once and is reused. Every phone floor in `UX-CONTRACT.md`
  still holds.
- **Tests.** `ui-audit.mjs` computed-size assertions at 375 against the contract
  floors.
- **Visual verification.** Homepage, hub and article at 375 and 1440.
- **Desktop / mobile.** Both.
- **Production verification.** Not required.
- **Execution path.** **Development.**
- **Status.** `BLOCKED` on VA-18

### VA-32 — Differentiate tasks by surface value and density, not new hues

- **Problem.** News, evidence, remembrance and alerts share one visual density,
  so the reading mode is not signalled by the page itself.
- **Source finding.** Section D "Color and Surfaces" — *"IMPROVE task
  differentiation through surface value and density, not new hues. News should
  feel open; evidence ledgers denser; remembrance quiet; alerts alone may use
  ember/state colors."*; section H — *"One institution, distinct reading modes."*
- **Classification.** IMPROVE · **Severity.** C · **Work type.** Design System
- **Files.** `app/globals.css` (`--sp-1..9`, `--measure-*`, surface tokens), the
  per-family modules: `app/articles/[publicId]/article.module.css`,
  `components/briefs/live-brief.module.css`,
  `investigation.module.css`, `archive.module.css`.
- **Implementation.** Express the four modes as **density and surface value
  only**. No new hue. Charcoal / ivory / amber is a KEEP; ember and the state
  colours stay reserved for alerts. News open, evidence denser, remembrance
  quiet.
- **Dependencies.** **VA-18**, **VA-20**.
- **Risk.** Hue creep. If a change needs a new colour, it is the wrong change.
- **Acceptance criteria.** Four reading modes are distinguishable by spacing and
  surface alone, verified in greyscale. No new colour token.
- **Tests.** A token-count assertion that the palette has not grown.
- **Visual verification.** One page per mode, greyscale, at 1440.
- **Desktop / mobile.** Both.
- **Production verification.** Not required.
- **Execution path.** **Development.**
- **Status.** `BLOCKED` on VA-20

### VA-33 — Media roles beyond 16:10

- **Problem.** 16:10 is applied as the general aspect rule. Portraits, document
  screenshots and data figures have no role of their own, and an evidence
  screenshot that is cropped to fill loses the content that made it evidence.
- **Source finding.** Section E "Aspect rules" — *"Retain 16:10 for editorial
  landscape only. Add explicit roles for portrait, document/screenshot and data
  figure. Evidence screenshots should preserve full content and offer zoom, never
  crop-to-fill."*
- **Classification.** IMPROVE · **Severity.** B · **Work type.** Media / Design
  System
- **Files.** `server/contracts/editorial-media.ts` (the `role` union),
  `components/content/MediaBlock.tsx`,
  `components/content/media-block.module.css`,
  `components/archive/ArchiveImage.tsx`.
- **Implementation.** Extend the media `role` union with `portrait`,
  `document`/`screenshot` and `data-figure`, and give each its own aspect and fit
  rule. A document or screenshot renders complete — `object-fit: contain`, never
  `cover` — and offers zoom. 16:10 stays for editorial landscape. **Focal points
  stay** (`object-position` from the stored focal point is a KEEP). Adding a role
  is a contract change: existing rows carry the old values, so every new role must
  be optional in effect and the renderer must fall back rather than throw.
- **Dependencies.** **VA-13**.
- **Risk.** A contract change reaching the projection. `editorialMediaSchema` is
  read by cached projections that survive a deploy — parse defensively, exactly as
  `media` on `publicPublicationSchema` already defaults rather than requiring.
- **Acceptance criteria.** A document screenshot renders complete and zoomable. A
  portrait is not letterboxed into 16:10. Records with the old roles render
  unchanged.
- **Tests.** Schema tests for each role including an unknown-role fallback; a
  render assertion that a document role never uses `cover`.
- **Visual verification.** One record per role at 375 and 1440.
- **Desktop / mobile.** Both.
- **Production verification.** Required.
- **Execution path.** **Development**; assigning the new roles to existing assets
  is **MCP / editorial**.
- **Status.** `BLOCKED` on VA-13

### VA-34 — Retire the static homepage media registry bridge

- **Problem.** Two media paths coexist: a publication's own `media` on the public
  projection, and a hand-mapped static registry at
  `lib/content/homepage-media.ts` reading `content-packages/homepage/media.json`,
  kept as the fallback for records mapped before the field existed. Two paths mean
  two behaviours for the same picture.
- **Source finding.** Section E "System work" — *"Finish canonical
  publication-media persistence. The repository still records this as pending;
  registry bridges and incomplete older coverage prevent consistent
  article/homepage behavior."*
- **Correction to the audit.** The persistence itself is **done**: migration
  `0057_publication_editorial_media.sql` exists, `server/db/schema/media.ts` and
  `server/modules/media/` exist, and `media` is on `publicPublicationSchema`
  (`server/contracts/publication.ts:221`) with a documented default so a
  projection serialized before the field still parses. What remains is exactly the
  **registry bridge** the audit names — `lib/content/homepage-media.ts`, consumed
  by `lib/homepage.ts`, `lib/content/homepage-adapters.ts`,
  `app/articles/[publicId]/page.tsx` and
  `app/articles/[publicId]/opengraph-image.tsx`.
- **Classification.** REMOVE-CONSOLIDATE · **Severity.** B · **Work type.**
  Backend / Media
- **Files.** `lib/content/homepage-media.ts`, `lib/homepage.ts`,
  `lib/content/homepage-adapters.ts`, `app/articles/[publicId]/page.tsx`,
  `app/articles/[publicId]/opengraph-image.tsx`,
  `content-packages/homepage/media.json`.
- **Implementation.** Enumerate every record still served by the registry.
  Migrate each one's asset onto the record's own `media` field through an update
  operation. When the registry serves nothing, delete
  `lib/content/homepage-media.ts` and its consumers' fallback branches. The
  rights, focal-point, sensitivity and surface-clearance checks it performs
  (`editorialMediaForSurface`) must be preserved on the surviving path — they are
  KEEPs.
- **Dependencies.** **VA-33** (roles settled first, so records are migrated once).
- **Risk.** Deleting the fallback while a record still depends on it leaves a
  picture missing. Migrate first, verify the registry serves zero records, delete
  second — the same two-step discipline the outbox tombstone rule uses.
- **Acceptance criteria.** `homepageMedia()` and `articleHeroMedia()` serve no
  record from the static registry. Every previously-registry-served picture still
  renders. The rights and sensitivity gate still refuses an uncleared asset.
- **Tests.** An assertion that the registry mapping table is empty; existing
  media rights tests stay green.
- **Visual verification.** Homepage and every previously-affected article.
- **Desktop / mobile.** Both.
- **Production verification.** **Required.**
- **Execution path.** Migration is **MCP / editorial**; the deletion is
  **Development**.
- **Status.** `BLOCKED` on VA-33

### VA-35 — Document responsive compositions per page family

- **Problem.** The repository documents shared breakpoints, not what each page
  family is supposed to do at each width. Nothing states the intended composition,
  so nothing can fail against it.
- **Source finding.** Phase 3 item 3 — *"Document responsive compositions for each
  page family, not only shared breakpoints."*
- **Classification.** IMPROVE · **Severity.** C · **Work type.** Design System /
  Operations
- **Files.** `UX-CONTRACT.md`, `docs/audits/` (this directory).
- **Implementation.** Extend `UX-CONTRACT.md` with one section per family —
  homepage, hub, article family, investigation case, archive, utility — stating
  the intended composition at 375, 768, 1024 and 1440. Written as assertions a
  script could check, in the style of the existing phone-floor section, not as
  prose.
- **Dependencies.** **VA-18**, **VA-20**, **VA-32** — document what was built.
- **Risk.** Documenting an intention nobody implements. Write it after the
  templates, not before.
- **Acceptance criteria.** Every page family has a stated composition at four
  widths, and each statement is checkable.
- **Tests.** None; it is the specification the other tests point at.
- **Visual verification.** N/A.
- **Desktop / mobile.** N/A.
- **Production verification.** Not required.
- **Execution path.** **Development** (documentation commit).
- **Status.** `BLOCKED` on VA-32

---

## 6. Phase 4 — Premium polish

### VA-36 — Optical typesetting

- **Problem.** Headline wrapping, widows and orphans, baseline alignment, icon
  sizing and hover timing are the difference between competent and premium, and
  none has been passed over.
- **Source finding.** Phase 4 item 1.
- **Classification.** IMPROVE · **Severity.** C · **Work type.** Design System
- **Files.** `app/globals.css`, `app/articles/[publicId]/article.module.css`,
  `components/home/homepage-journey.module.css`,
  `components/briefs/live-brief.module.css`.
- **Implementation.** `text-wrap: balance` on headlines and `pretty` on decks;
  eliminate single-word last lines on headlines at every width; align baselines
  across a card row; standardise icon optical size against adjacent type; give
  hover a consistent delay and duration from the `--dur-*` / `--ease-*` tokens.
- **Dependencies.** Everything structural. This is last for a reason.
- **Risk.** Low, but it is the pass most likely to be done "by feel" and then
  contradicted at the next width. Check all six.
- **Acceptance criteria.** No headline orphan at any of the six widths. Icons are
  optically matched. Hover timing is one value, from a token.
- **Tests.** None automated.
- **Visual verification.** A long headline on each template at all six widths.
- **Desktop / mobile.** Both.
- **Production verification.** Not required.
- **Execution path.** **Development.**
- **Status.** `BLOCKED` on VA-18, VA-31

### VA-37 — Compress the homepage footer variant

- **Problem.** After a long homepage, the footer's display-size brand and
  multi-column index form another large chapter.
- **Source finding.** Page audit "Footer" — *"Action: IMPROVE — Severity C."*;
  Phase 4 item 1 (footer compression).
- **Classification.** IMPROVE · **Severity.** C · **Work type.** Frontend
- **Files.** `components/site/SiteFooter.tsx`,
  `components/site/site-footer.module.css`.
- **Implementation.** A compact homepage variant. Keep methodology, corrections,
  the index and the colophon; reduce the brand's display size and the column
  count on the homepage only.
- **Dependencies.** **VA-28**.
- **Risk.** Low. Trust links stay.
- **Acceptance criteria.** The homepage footer is measurably shorter; the article
  footer is unchanged; methodology and corrections remain prominent.
- **Tests.** `ci-smoke.mjs` link walk.
- **Visual verification.** Footer on the homepage and on an article, 375 and 1440.
- **Desktop / mobile.** Both.
- **Production verification.** Not required.
- **Execution path.** **Development.**
- **Status.** `BLOCKED` on VA-28

### VA-38 — Image crop recapture and correction

- **Problem.** Crops have not been inspected at the required widths, so no crop
  failure can be certified — and none can be ruled out either. Faces, insignia,
  document text and evidence-bearing detail are what a bad crop destroys.
- **Source finding.** Section E "Crop correction" — *"Recapture at 375/430/768/
  1024/1440 and inspect faces, insignia, document text and evidence-bearing
  details. No current crop failure can be certified from the available
  evidence."*
- **Classification.** IMPROVE · **Severity.** B · **Work type.** Media / QA
- **Files.** Media assets and their stored focal points
  (`server/contracts/editorial-media.ts`); `components/content/MediaBlock.tsx`.
- **Implementation.** Capture every hero image at 375, 430, 768, 1024 and 1440 and
  inspect the crop. Where a focal point is wrong, correct the stored value — the
  focal-point mechanism itself is a KEEP and works; this fixes data, not code.
- **Dependencies.** **VA-04**, **VA-33** (roles change some aspects).
- **Risk.** None to the system.
- **Acceptance criteria.** Every hero crop inspected at five widths; corrected
  focal points recorded; a list of assets that need replacing rather than
  recropping.
- **Tests.** None.
- **Visual verification.** This is the visual verification.
- **Desktop / mobile.** Both.
- **Production verification.** **Required.**
- **Execution path.** **MCP / editorial** (focal-point corrections are content).
- **Status.** `BLOCKED` on VA-04

### VA-39 — Physical device and screen-reader pass

- **Problem.** No physical iOS/Safari or Android review has been done, and no
  screen-reader pass. Emulation is not the same as a device.
- **Source finding.** Phase 4 item 2; the audit's "Not executed" list — *"physical
  iOS/Safari."*
- **Classification.** FIX · **Severity.** B · **Work type.** QA
- **Files.** N/A — the whole public product.
- **Implementation.** Physical iPhone (Safari) and Android (Chrome) walkthrough of
  the routes in §7, plus a VoiceOver pass covering: the mobile navigation panel,
  the October 7 reveal gate, the evidence ledger, Search results, the Ask stream
  and the Support form. Dynamic Type and Reduce Motion enabled at the OS level.
- **Dependencies.** All Phase 1 and 2 work — measure the finished thing.
- **Risk.** None.
- **Acceptance criteria.** A defect list, or a written pass. Anything found
  becomes its own task.
- **Tests.** None automated.
- **Visual verification.** Device screenshots.
- **Desktop / mobile.** Physical mobile is the point.
- **Production verification.** **Required.**
- **Execution path.** Observation.
- **Status.** `BLOCKED` on Phase 2

### VA-40 — Performance and LCP retest after homepage recomposition

- **Problem.** The homepage cover is where LCP lives, and VA-10 rebuilds it.
- **Source finding.** Phase 4 item 2 — *"performance/LCP retest after homepage
  recomposition."*
- **Classification.** FIX · **Severity.** B · **Work type.** QA / Frontend
- **Files.** `scripts/perf-report.mjs`, `scripts/perf-budgets.json`.
- **Implementation.** `npm run build` then `npm run perf:report` — it reads
  `.next` and exits non-zero on a budget breach. Then measure real LCP on
  Production at 375 and 1440. Compare against the pre-VA-10 baseline; capture that
  baseline **before** VA-10 merges or the comparison is worthless.
- **Dependencies.** **VA-10**, **VA-21**.
- **Risk.** None to the system; the risk is having no baseline.
- **Acceptance criteria.** No budget in `scripts/perf-budgets.json` breached. LCP
  no worse than baseline at either width.
- **Tests.** `perf:report` is the gate.
- **Visual verification.** N/A.
- **Desktop / mobile.** Both.
- **Production verification.** **Required.**
- **Execution path.** Observation; any regression fix is **Development**.
- **Status.** `BLOCKED` on VA-10

---

## 7. Visual QA matrix

Required widths, per the audit: **375, 430, 768, 1024, 1440, 1920.**
`scripts/ui-audit.mjs` also runs 320 and 390 — keep them; 320 catches height
failures the others miss.

| Route | 375 | 430 | 768 | 1024 | 1440 | 1920 |
| --- | --- | --- | --- | --- | --- | --- |
| `/` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/geopolitical-brief` (+ archive open, filters active) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/articles/[publicId]` — one per template (VA-18) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/fake-resistance` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/fake-resistance/cases/[slug]` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/fake-resistance/watch` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/fake-resistance/network` · `/playbook` · `/antisemitism` · `/social-media` · `/official-narrative` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/fact-check` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/people-of-israel` · `/our-heroes` · `/israels-story` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/october-7` · `/october-7/testimonies` · `/october-7/documentation` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/information-war` · `/we-are` · `/methodology` · `/corrections` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/search` (query, no matches, API failure) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/support-us` (each mode, error, success) | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/ask` · `/account` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| `/updates` | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| 404 · root error · route error · loading | ✅ | ✅ | ✅ | ✅ | ✅ | ✅ |
| Mobile navigation panel, open | ✅ | ✅ | — | — | — | — |

Portrait **and** landscape at 375 and 430. `/war-update` is a permanent redirect;
assert the redirect, do not capture the page.

---

## 8. Required state and condition verification

Every item below must be captured at **375 and 1440** minimum. Items marked ⚠️
have no harness coverage today and depend on **VA-05**.

| Condition | How | Task |
| --- | --- | --- |
| Keyboard order, focus visibility, focus restoration | `ui-interaction-audit.mjs` | VA-04 |
| Dialog focus trap and Escape | `ui-interaction-audit.mjs` | VA-04 |
| `prefers-reduced-motion: reduce` — nothing loops | `ui-audit.mjs`, `ui-interaction-audit.mjs` | VA-04 |
| No JavaScript — every destination still reachable | `ui-audit.mjs` no-JS pass | VA-04 |
| 44px coarse-pointer targets | `ui-audit.mjs` | VA-04 |
| **200% zoom** ⚠️ | new pass | VA-05 |
| **Missing media → text-led fallback** ⚠️ | route-abort the image host | VA-05 |
| **80–110 character headline** ⚠️ | fixture | VA-05 |
| **Long source name / long credit string** ⚠️ | fixture | VA-05 |
| **Loading** ⚠️ | induced | VA-09 |
| **Empty / no data** ⚠️ | induced | VA-09 |
| **No matches** (Search) ⚠️ | induced | VA-09 |
| **Service failure / unavailable** ⚠️ | API abort | VA-09 |
| **404** ⚠️ | nonexistent `publicId` | VA-09 |
| **Root and route error boundary + retry focus** ⚠️ | forced throw | VA-09 |
| **Image failure** ⚠️ | asset abort | VA-09 |
| **Disabled and success** ⚠️ | Support form | VA-08 |
| Sticky header / section-nav collisions | manual at each width | VA-04 |
| Archive showcase arrows, keyboard and swipe | manual + touch emulation | VA-26 |
| Safe-area insets, landscape phone | physical device | VA-39 |
| Screen-reader announcement of streamed content | VoiceOver | VA-07, VA-39 |
| Greyscale — status never carried by colour alone | manual | VA-20, VA-24 |

---

## 9. Work batches

### 9.1 Quick Wins

Small, mostly independent, high ratio of visible improvement to risk. Two of the
audit's eight quick wins are not actually quick, and are marked as such.

| # | Task | Note |
| --- | --- | --- |
| 1 | **VA-03** — gate the investigation explorer | One derived condition. The best return in the backlog. |
| 2 | **VA-12** (code half) — suppress exact duplicates | Interim, reversible. |
| 3 | **VA-15** — How it works active state | Small, contained. |
| 4 | **VA-29** — `--radius-3` → 8px | One token. |
| 5 | **VA-30** — remove the glass gradient from the root error | Contained to `app/error.tsx`. |
| 6 | **VA-14** — rename "On the watch" → "Claim assessments" | Copy plus one route change. |
| 7 | **VA-13** — compact captions, status before illustration | Quick Win 7 in the audit; genuinely medium — it touches the shared media block. |
| 8 | *Audit Quick Win 1* — remove hero donation chips | **Not a quick win.** It contradicts an owner ruling — see **VA-11**. |
| 9 | *Audit Quick Win 2* — cover height and lead headline | **Not a quick win.** It is **VA-10**, a redesign of the first thing anyone sees. |

### 9.2 Editorial and data cleanup — MCP path, no deploy

Executed through the ChatGPT connector's tools (`list_publications`,
`find_publication`, `update_publication`, `set_homepage_placement`,
`archive_publication`, `rollback_publication`) or through a
`whole-site-update-v2` package on `chatgpt-editorial-updates`. Note the split:
`update_publication` edits title, summary, body, section and monitoring details;
**sources and media travel in a package operation**, not in an ops tool call.

| Task | What moves |
| --- | --- |
| **VA-01** | Attach real sources to every record whose body cites a URL. Package operations carrying `sources`. |
| **VA-12** (editorial half) | Archive exact-duplicate records, leaving one canonical record per story. |
| **VA-16** | Replace generated illustrations on routine news with documentary material or text-led records. Package operations carrying `media`. |
| **VA-19** (editorial half) | Assign `canonicalStoryId` to related published records so the developing-story model has something to group. |
| **VA-27** (editorial half) | Complete source and media coverage on People records. |
| **VA-34** (migration half) | Move registry-served assets onto each record's own `media`. |
| **VA-38** | Correct stored focal points where a crop is wrong. |

Every one of these is versioned by `recordVersion()`, audited, and reversible
with `rollback_publication`. None requires a branch, a PR, CI or a deploy.

### 9.3 Development — branch → PR → CI → merge → Production

Everything else. All of it touches CSS, components, contracts, schema,
navigation architecture or scripts, none of which the whole-site contract can
represent — which is what makes the boundary structural rather than a matter of
trust.

`VA-02, VA-03, VA-05, VA-10, VA-11, VA-12 (code), VA-13, VA-14, VA-15, VA-17,
VA-18, VA-19 (code), VA-20, VA-21, VA-22, VA-23, VA-24, VA-25, VA-26, VA-27
(code), VA-28, VA-29, VA-30, VA-31, VA-32, VA-33, VA-34 (deletion), VA-35,
VA-36, VA-37`

Rules for every one of them:

- Branch off `main`; never commit to `main` directly.
- `npm run verify:full` — typecheck, lint, test, build — green before the PR is
  marked ready. `npm run lint` is where the architecture boundaries are enforced;
  a layering violation fails the gate, not the review.
- **A push to `main` deploys to Production within about two minutes.** Merge only
  on the owner's explicit go-ahead.
- A schema change (only VA-33 plausibly needs one) is migrated against Preview,
  then Production, **before** the code that needs it is pushed.
- `vercel rollback` is the fast undo.

### 9.4 Observation only — no branch, no content change

`VA-04, VA-06, VA-07, VA-08, VA-09, VA-39, VA-40`. These produce evidence. A
finding becomes an amendment to a task in this document; it does not become a
drive-by edit.

---

## 10. Do not change — preserve exactly

Taken from the audit's own KEEP list and its "deliberately leave these alone"
section. A change to anything here needs an owner instruction, not an engineer's
judgement.

**Identity and type**
- Charcoal / ivory / amber. It is distinctive and avoids the generic
  blue-purple AI palette. No new hue.
- Newsreader (editorial display), IBM Plex Sans (reading and UI), Roboto Mono
  (evidence metadata) — the three-role system stays.
- The lion, provided VA-10 makes it a threshold into the edition rather than the
  whole first-screen job.
- Article reading measure: 17px body, 1.65 leading, constrained width.

**Evidence and provenance**
- The editorial-media contract: role, focal point, sensitivity, rights status and
  surfaces, source URL, credit, caption and disclosure.
- Mobile `object-position` from stored focal points; the text-led fallback when
  media is absent.
- The evidence ledger's support-versus-contradiction model, the withdrawn-finding
  record and the explicit unknowns panel.
- `evidenceBasis` derived, never chosen — `evidenceIds.length === 0`, all or
  nothing. A Narrative Watch analysis may publish citing nothing, disclosed.
- `narrativeWatchTitle()` as the only headline prefixer.

**October 7**
- Content warnings, reader-controlled reveal of graphic media, no autoplay,
  explicit source, sharing with context, language coverage, and the separation
  between testimony and documentation. The audit calls these KEEP-level
  decisions; treat them as untouchable.

**Trust surfaces**
- The Corrections empty-state language — that the ledger is empty *and* that
  emptiness is not proof the standard has been tested. Preserve `/corrections`
  almost exactly.
- Methodology's explicitness about scope and limitations.
- No on-site payment collection.

**Foundations**
- The four-link header skeleton and the grouped, task-based menu.
- Visible focus outline; 44px targets; `prefers-reduced-motion` rules; no-JS
  fallbacks; explicit loading / empty / error / unavailable as separate facts.
- `/our-heroes` and `/israels-story` keep their addresses (`LEGACY_SECTION_PAGES`).

**Architecture — from the repository, not the audit, and equally binding**
- `publication.section` is the only editorial choice; every surface derives from
  it in `lib/publication-routing.ts`. Do not add `template`, `homepageCategory`,
  `destination` or `frontendSection`.
- Derive section lists from `SECTIONS_BY_HOMEPAGE_SECTION`; never hand-write one.
- `recordVersion()` is the only write path for a versioned entity.
- `emit()` writes job intent inside the causing transaction.
- `server/contracts/**` imports zod and nothing else.
- Launch-period posture: minimum enforcement. **Do not add an editorial gate,
  quota, candidate cap or validation loop back** while implementing any of this.
- `server/contracts/whole-site-update.ts` stays `.strict()` and content/placement
  only.

---

## 11. Release checklist

Before the site may be described as a premium newsroom release:

**Correctness**
- [ ] VA-01 complete: zero published records where a body-cited URL is absent
      from the public source list — or a written list of the ones needing
      re-reporting.
- [ ] VA-02 shipped: the contradiction is no longer representable.
- [ ] VA-03 shipped: no routine record renders the seven-stage explorer.
- [ ] VA-12 complete: no two archive cards show identical title and summary.

**Verification**
- [ ] VA-04 run against Production; `ui-audit.mjs` exits zero.
- [ ] VA-05 passes added; VA-09 states all captured.
- [ ] VA-06 mobile navigation verified at 375 and 430, portrait and landscape.
- [ ] VA-07 Ask trust protocol passed, with the citation chain recorded.
- [ ] VA-08 Support form verified end to end; test rows removed.
- [ ] Every `NEEDS VISUAL VERIFICATION` marker in this document retired or
      confirmed in writing.

**Quality**
- [ ] `npm run verify:full` green.
- [ ] `npm run perf:report` — no budget in `scripts/perf-budgets.json` breached.
- [ ] LCP at 375 and 1440 no worse than the pre-VA-10 baseline.
- [ ] `ci-smoke.mjs` green: route walk, zero console errors, no-JS destinations,
      390px visibility.
- [ ] Greyscale pass: no editorial status carried by colour alone.
- [ ] `UX-CONTRACT.md` phone floors hold at 375 — body/summaries ≥16px,
      metadata/captions ≥13px, kickers ≥11px.

**Preservation**
- [ ] Every item in §10 verified unchanged.
- [ ] `/corrections` diffed and confirmed intact.
- [ ] October 7 reveal gate re-verified after every change to that hub.
- [ ] `/our-heroes`, `/israels-story`, `/fake-resistance/watch` all still resolve.

**Governance**
- [ ] VA-11 decided by the owner and `.ai/DECISIONS.md` amended to match the code.
- [ ] Every merge to `main` carried an explicit owner go-ahead.
- [ ] Any schema change migrated to Preview and Production before its code shipped.

---

## 12. Where the audit and the repository disagree

Recorded so the next reader does not have to rediscover them. Each is a
correction to the audit's stated evidence, not a dismissal of its finding.

| Audit statement | Current `main` |
| --- | --- |
| Implies the multi-viewport harness must be built. | It exists. `scripts/ui-audit.mjs` runs 320/375/390/430/768/1024/1440/1920, a no-JS pass, 44px floors, focus and landmark checks, and accepts a base URL. `ui-interaction-audit.mjs` covers keyboard, dialogs, Escape and reduced motion at 390/1440. **Genuinely missing:** 200% zoom, missing-media, long-headline, induced states (VA-05). |
| "Finish canonical publication-media persistence. The repository still records this as pending." | Persistence is done — migration `0057`, `server/db/schema/media.ts`, `server/modules/media/`, and `media` on `publicPublicationSchema` (`server/contracts/publication.ts:221`) with a documented default. What remains is the **registry bridge** at `lib/content/homepage-media.ts` (VA-34). |
| Redesign candidate 5 implies the canonical-story layer must be built. | `canonicalStoryId` exists on the contract (`:37`) and on the public projection (`:193`), and both the update contract and `find_publication` resolve by it. Missing is the **projection and presentation** (VA-19). Do not add a second identifier. |
| Appendix A lists `MediaBlock.tsx` / `media-block.module.css` with no directory. | They are at `components/content/`, not `components/media/`. |
| "Remove donation-provider chips from the hero." | `.ai/DECISIONS.md`, 2026-09-07 records an owner ruling placing them there deliberately, noting the phone header hides its Support control so the strip is the cover's only support affordance. **VA-11 — product decision.** |
| Top-10 #05 lists nine editorial states. | `PUBLICATION_SECTIONS` in `server/contracts/enums.ts` has fourteen section values, which are not the same axis as the nine display states. VA-18 and VA-20 must map both — count both at the source, never from prose. |

---

## 13. VA-04 results — the first real Production evidence set, 7 September 2026

`ui-audit.mjs` (183 route/viewport pairs, then 96 more closing a coverage gap),
`ui-interaction-audit.mjs`, `design-capture.mjs` over 16 slugs, and 226 PNGs
from a Playwright pass. Full report and captures in the session scratchpad
(`va-04/FINDINGS.md`).

**Read the exit codes correctly.** `ui-audit.mjs` exited 1, but **9 of its 24
CRITICALs are `HTTP 404` on `/pipeline`** — a dev-only route sitting in the
script's own `COMPLEX` list, i.e. a harness/environment mismatch, not a site
defect. The other 15 are contrast. Fix the route list before quoting that exit
code as a quality signal.

### Confirmed, and now fixed on `feat/visual-audit-phase-0-1`

| Finding | Production measurement | Fixed by |
| --- | --- | --- |
| Cover delays the first story | Lead headline top at 1176/1239/1317/1004/1174/1338px across the six widths; mobile page 12,769px = **15.7 viewports** | VA-10 |
| Explorer on routine articles | **45 of 48 published records**, including a Weizmann mouse study and a jobs-programme announcement, with stages rendering "This record does not name observed propagators" | VA-03 |
| Zero sources beside a body URL | 3 live offenders — `adidas-boycott-…-5wxlh` (5 URLs), `iran-…-centc-8m6cq` (3), `iran-…-washin-anmgp` (1) | VA-02 guards the render; VA-01 repairs the data |

The three offender IDs are **the same three** the independent VA-01 sweep found
as `CONTRADICTION`. Two methods, same answer.

### Retired or re-scoped — the audit overstated these

- **VA-16 — RETIRED as written.** The audit says routine news receives
  generated illustration as one-image-per-story fulfilment. In fact **46 of 48
  published records carry no media at all**; only one named offender
  (`…-f2cks`). The site is already text-led. The remaining task is the editorial
  *rule*, not a replacement campaign.
- **VA-38 — largely moot.** Crop inspection across five widths presumes heroes
  to inspect. There are **2**.
- **VA-26 — half retired.** `/october-7` **already opens human-led**. Only the
  showcase arrow labels and position indicator remain unverified.
- **Case-file touch targets — retired.** **0 controls under 44px** at 375 and
  430. The real problem there is scale: a **60,814px** document with the finding
  2.4 viewports down, and two horizontal scrollers clipped (section nav 1319px
  inside a 343px box). VA-25 stands; its touch-target clause does not.
- **VA-17 — confirmed, but the defect is not the stated one.** Results *are* in
  viewport one at 375 (as the implementing agent independently found). The real
  bug: a **no-match query renders ten fallback-index rows with no no-match
  state** — "We Are — Indexed · no public page" presented where results belong.
  Re-verify after the branch merges; the VA-17 work added a no-match state, and
  whether the fallback rows still render beneath it is untested.

### Worse than described

- **Duplicates.** Three exact-title pairs live, five near-duplicate pairs, and
  `/geopolitical-brief` renders **the same record up to three times on one
  page**. VA-12's collapse covers the archive projection only — a record
  appearing as lead *and* in the timeline *and* in the archive is a different
  bug and is **not** fixed. The two "Iran says it struck…" records render **side
  by side** on `/fake-resistance`.
- **Fake Resistance / Fact Checks.** `/fact-check`'s breadcrumb reads
  `Home / Fake Resistance / …` and its records are the same three the hub lists
  under "On the watch". `/geopolitical-brief` is a third door under a fourth
  name. VA-14 and VA-23 should treat the breadcrumb as part of the fix.

### New defects, not in the audit at all

1. **`viewport-fit=cover` is absent** from the `viewport` export in
   `app/layout.tsx:123`, so **every `env(safe-area-inset-*)` rule in the build
   is inert on iOS** — 16 rules across 8 CSS modules, all dead. One-line fix
   (`viewportFit: "cover"`), but it makes the page extend under the notch and
   home indicator, so it needs the physical-device pass (**VA-39**) rather than
   a blind merge. This absorbs VA-06's safe-area clause.
2. **`/geopolitical-brief` serves 858 characters with 40 streaming holes when
   JavaScript is off** — it passes the harness floor while showing a reader no
   records at all. Exactly the failure the no-JS pass exists to catch, slipping
   through on a technicality.
3. **`/articles/…-86i2j` throws React #418 (hydration mismatch)** at both
   widths.
4. **Stale breadcrumbs:** the 404 page still says "Daily Brief" — a section
   retired on 2026-09-05.
5. **Landscape phone renders the wide-layout mega-panel** instead of the
   drawer, and is unverified.

### Clean, and worth recording as such

Zero horizontal overflow. Zero offscreen controls. Zero sticky-band collisions.
Zero reduced-motion failures. **No dialog failure across 37 dialogs** — focus
entry, `:modal`, body lock, Escape and focus return all hold. The mobile
navigation is a native `<dialog>` at 100% height and behaves correctly; its only
defect is the dead safe-area inset above.

---

*Prepared 7 September 2026 against `main` @ `61875f3`. Planning only — no
application code, Production state, editorial content or database row was
modified.*
