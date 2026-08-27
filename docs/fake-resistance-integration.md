# Fake Resistance research integration

**Status: cleared for publication; the deploy is the last step.** Phases 1–4
shipped on 2026-08-26 —
the import pipeline, the content seam, `/fake-resistance/playbook`,
`/fake-resistance/network`, seven case files, and the editorial pass over all
of them (framing, technique tags, naming policy, program-shorthand rewrite).
The owner reported legal review complete the same day, so every case now
reads `lifecycle: "ready"`. **What remains is the deploy itself** — a manual
Vercel operation. Merging to `main` publishes nothing; that deploy is the
publication act, and it is when cases should advance to `published` with each
packet's `publication` block filled in.
Written 2026-08-26 against the research delivery at
`~/Documents/fakeresitenstod` (outside this repository, not in git — the same
arrangement as the October 7 archive packages). This document is the brief for
merging that research into the site's Fake Resistance section; the checkbox
form of the same work belongs in `TODOS.md` once a wave is opened.

The October 7 archive integration (`docs/archive-integration.md`) is the
template for the mechanics here — external source folder, import script,
committed JSON, a hub route under an existing node. The part that is *not*
parallel is editorial: the archives were testimony this site chose to host;
this delivery is **adversarial research that names living people in
connection with allegations**. The plan therefore splits cleanly into
mechanical work that can start now and editorial gates that block
publication, and it never confuses the two.

---

## 1. What arrived

Nine research packets built by an X/Twitter open-source research program run
on 2026-08-26, plus the program's own tooling:

| Packet | Subject | Report | Key data |
| --- | --- | --- | --- |
| `01-hinkle-machine` | Jackson Hinkle / @WelcomeTheGulag / ACP production cell | 201 lines | 48 sources, 25 entities, 13 claims |
| `02-manosphere-far-right` | Far-right / manosphere anti-Zionist pivot cluster | 169 lines | 21 sources, 32 entities, 14 claims |
| `03-muslim-palestinian-influencers` | Muslim/Palestinian personal-brand influencer lane | 146 lines | 11 sources, 25 entities, 12 claims |
| `04-aggregators-feeders` | Palestinian aggregator / feeder accounts | 61 lines | typology + supply-chain audit |
| `05-grayzone-anti-empire` | Anti-empire journalism corridor | 56 lines | intersection audit |
| `06-giant-amplifiers` | Mega-accounts and talk shows | 54 lines | zero-relay audit |
| `07-state-media-irgc-press` | State media and covert press personas | 44 lines | cohort split, card factory |
| `08-cross-cluster-network` | Cross-cluster graph | 99 lines | 7 communities, 5 bridges, ~60 edges |
| `09-synthesis` | Program synthesis | 64 lines | 7 findings, confidence table, publication gate |

Each packet is one folder with:

- `case.yaml` — id, slug, research question, scope windows, public-interest
  basis, and a `status` field currently set to `right_of_reply`.
- `report.md` — the written case report, already structured (question →
  bottom line → roster → chronology → narratives → exhibits → limitations).
- `data/*.csv` — eleven relational tables per case: `sources`, `entities`,
  `relationships`, `claims`, `claim_evidence`, `relationship_evidence`,
  `content_items`, `content_narratives`, `narratives`, `events`,
  `event_links`. Aggregate across cases: ~120 sources, ~200 entities, ~60
  graded claims, ~105 evidenced relationship edges.
- `evidence/` — raw harvest artifacts (mirror snapshots, twitterapi.io JSON
  pulls with sha256 names). **Never published; see §8.**
- `figures/` — empty in every packet. There is no media to host: this is a
  text-and-data integration, no CDN step, no `media_id` machinery.

Alongside the packets: `x-deep-research-agent-tasks/` (the task briefs, the
operator protocol, and a byte-identical second copy of each report — ignore
the copies) and `research-disinformation-networks/` (the methodology skill
the program ran on). The skill folder is program tooling, not site content,
but three parts of it matter to this plan:

- `references/data-model.md` — the **formal contract** the packets are built
  to: eleven tables, ID prefix rules, enum vocabularies, and a case
  lifecycle (`intake → research → fact_check → right_of_reply →
  editorial_review → legal_review → ready → published → archived`). Every
  packet sits at `right_of_reply` today; "publish" in this plan means
  walking a case to `published` with its `publication` block filled in
  (the reply stage itself is skipped by owner decision — §2).
- `validate_research_case.py` — **in the external research delivery, not in
  this repository** — the validator that already passed all nine packets (enums, ID prefixes, referential integrity). Run it as
  the import's first step rather than re-deriving its rules.
- `merge_research_cases.py` (external delivery) — merges packets into one CSV bundle
  plus a `cases.csv` catalog. Useful as a pre-step; the site importer still
  produces JSON shaped for the renderer (§5).

The operator protocol's hard rules travel with the content: public handles
only, no doxxing; "anti-Israel" is never treated as proof of inauthenticity;
named person / anonymous clip farm / coordinated persona / state outlet stay
separate categories; observed posts, inference, and unknowns stay separate;
engagement counts and timestamps are never invented.

Total size ~1.5 MB. Committing the curated JSON is a rounding error next to
the 14 MB of archive JSON already in git.

Two properties of the data worth calling out because the whole plan leans on
them:

1. **Every claim row carries both an internal `analysis` field and a
   `publication_wording` field** — the researchers pre-wrote the cautious,
   cleared-for-publication phrasing separately from their working notes. The
   importer takes `publication_wording` and leaves `analysis` behind.
2. **Every entity carries `identity_status` (confirmed / probable /
   unresolved) and every relationship carries `evidence_class`
   (documented_relationship / observed_interaction / inferred_coordination)
   with a confidence grade.** The site must render these distinctions, never
   flatten them.

## 2. The publication gates — right of reply is dropped, two gates remain

The packets ship with their own gate. `09-synthesis/report.md`:

> This packet set is NOT cleared for publication. Editorial review required
> for all cases; legal review required before naming any living person in
> connection with allegations they have not had opportunity to respond to.

and every `case.yaml` sits at `status: right_of_reply` in the contract's
lifecycle, with eight principals listed for contact.

**Owner decision, 2026-08-26 (recorded in `.ai/DECISIONS.md`): the site
does not run a right-of-reply process for this material.** The reply stage
is recorded as skipped by decision, not as completed, and no page claims
subjects were approached. What still blocks the production deploy:

- **Editorial review per case** (Phase 4): `publication_wording` only,
  packet caveats rendered, category discipline applied, naming policy
  applied. The naming policy carries the defamation weight the reply
  process would have carried: a person is tied to an allegation only where
  the packet grades the claim `verified` at high confidence **and** the
  same conduct is already covered by mainstream reporting in that case's
  own `sources.csv` — the site aggregates what is already public rather
  than accusing first.
- **Legal review** of the case texts that name living people, retained as
  a one-time pass before the first deploy.
- The site's own standing rules. `lib/content/fake-resistance.ts`'s
  module comment: a case touching a live dispute about a real person "does
  not belong here without much heavier sourcing than a single pass affords."
  `.ai/DECISIONS.md` (2026-08-25): Our Heroes publishes only extensively
  public, already-covered people — the adversarial mirror of that rule
  applies here. `TODOS.md`'s standing principle: no publication without
  sources.

If a subject responds after publication, the response files through
`CorrectionHistory` like any correction, and the contract's
`right_of_reply` source role in `sources.csv` is where it lands as a
source — the infrastructure exists regardless of solicitation.

One structural fact makes this tractable: **git auto-deploy is not
connected.** Merging code and data to `main` publishes nothing; production
deployment is a separate manual Vercel operation. **The repo is PUBLIC** —
this sentence read "The repo is private" until 2026-08-27, and it was the
premise of the argument below. `gh repo view` reports `visibility: PUBLIC`,
and `CLAUDE.md` states the consequence directly: *a push to origin is itself an
act of publication*. The mechanical work is still safely separable from the
deploy, but committing this research is not a private act. So
the mechanical work (import, seam, routes, tests) can be built and merged in
full, and *the deploy itself is the publication act that waits for the
gates*. The plan uses that split deliberately.

## 3. Presentational frame — manipulation and psychology, held to the evidence

**Owner direction, 2026-08-26: the section presents these actors through
how they manipulate — the psychological techniques — not merely as a
network diagram.** The packets support this frame in depth; it becomes a
first-class layer of the section rather than a tone applied in prose.

### The technique taxonomy (all documented, nothing invented)

| Technique | The mechanism | Documented in |
| --- | --- | --- |
| Verdict captioning | The clip supplies the evidence-feel; the caption supplies the verdict ("War crime!", "Denuclearize Israel!") — the viewer feels they saw proof of a conclusion the video never shows | 01 |
| Authority laundering | Clipping credentialed voices (professors, ex-officials, journalists) without context so their credibility transfers to the captioner's claim | 01, 05 |
| Circular sourcing | A state claim "corroborated" by state imagery republished by the same account — the loop looks like independent confirmation | 01, 07 |
| Manufactured urgency | 🚨BREAKING card factories on a 1–2 minute cadence across unrelated topics; red-dot branding — urgency suppresses the pause where checking happens | 04, 07 |
| Arousal-first monetization | High-arousal, claim-heavy style tied to gambling sponsorships, paid unblocking, engagement-bait loops — outrage as a revenue format | 03, 06 |
| Recycled media | Footage from other conflicts, years, or video games recaptioned into the current war — source amnesia does the rest | root-page exhibits, 01, 02 |
| Synchronized amplification | Sub-hour quote-tweet lags, round-second scheduled posts, batch-created personas — manufactured consensus reads as organic agreement | 01, 07 |
| Verdict-before-evidence framing | The packets' own narrative analysis states it verbatim: "Moral verdict precedes evidence; specific incidents generalize into categorical condemnation" | 01 narratives |
| Identity games | Backup accounts, renamed handles, lookalike-risk profiles — continuity of audience without continuity of accountability | 01, 02 |

### How the frame is implemented

- **`/fake-resistance/playbook` treats every technique in full** — one
  chapter per technique, each with the same four-part anatomy:
  1. *The move* — what the technique is, in two or three sentences.
  2. *Why it works on you* — the psychology: which cognitive shortcut it
     exploits (borrowed authority, urgency suppressing verification,
     source amnesia, arousal-driven sharing, manufactured consensus…).
  3. *Documented in the wild* — the exhibits from the case files that show
     it running, with their verdicts and sources.
  4. *How to catch it* — two or three concrete recognition cues a reader
     can apply to their own feed.
  Chapters are `h2`s, so the `SectionToc` "In this file" rail becomes the
  playbook's index for free.
- **The root page keeps "The tells" as the compact summary**, now linking
  into the playbook's chapters — primer above, full treatment one click in.
- **Case-page exhibits carry technique chips** linking to the playbook
  anchors. The chip → exhibit mapping is set in the Phase 4 editorial pass,
  each tag anchored to the claim rows that document it, from a controlled
  vocabulary pinned by a test.
- **The playbook is gate-free content.** Written generically, its chapters
  accuse no living person — parts 1, 2 and 4 name techniques, not people,
  and part 3 can launch pointing at the root page's three already-published
  exhibits. It can therefore ship ahead of the case files, and each
  chapter's "documented in the wild" list grows as cases clear the Phase 4
  gates.
- The section's argument thereby runs in both directions: the playbook
  explains the trick, the case files show it running.

### The boundary of the frame — category discipline

The frame is applied exactly as far as the evidence goes, which is what
makes the manipulation charge stick:

1. **Case files present as research files, not an accusation list.** Each
   entity renders with its packet-assigned class (NAMED_PERSON /
   ANON_CLIP_FARM / OUTLET / STATE_ALIGNED / protected categories) and its
   identity status. The site never upgrades a classification or a
   confidence grade the packet assigned.
2. **Case 05 presents as the authority mine.** The corridor's role in the
   frame is the *supply side of authority laundering*: credentialed,
   named, one-sided journalism whose credibility the machines harvest as
   clips. Its documented editorial line renders (no sampled criticism of
   Russia/Iran/Hamas — that is in the packet), and so does the packet's
   finding that the corridor is not coordinated with the machines
   (Finkelstein → seeds: zero mentions). The page can show how their
   output *functions* psychologically in the machine without asserting
   the coordination the research disconfirmed. Case 04 likewise: the
   two-pipelines finding is the story, `@xIsraelExposedx` stays classified
   as an evidence-preservation project, and on-scene journalists and
   document-analysts remain **protected categories** — never framed as
   "fake" anything.
3. **Disconfirming findings render as findings.** The zero-relay audit and
   the "no single command structure" synthesis conclusion are what make the
   rest credible; they get the same visual weight as the positive findings.

## 4. Information architecture

`/fake-resistance` follows the `/october-7` precedent exactly: **the node
becomes a hub, and the research beneath it is not a ninth node.**
`defaultNodes` stays at eight and is not touched.

```
/fake-resistance                    existing dossier page (SectionPage, accent="ember")
                                    + new "The files" index section linking below
/fake-resistance/playbook           the methods, in full: one chapter per
                                    technique (§3) — mechanism, psychology,
                                    documented examples, recognition guide
/fake-resistance/network            the map: synthesis findings + cross-cluster
                                    graph (packets 08 + 09 merged into one page)
/fake-resistance/cases/[slug]       one page per case, packets 01–07
```

- Slugs drop the ordinal prefix: `hinkle-machine`, `manosphere-far-right`,
  `muslim-palestinian-influencers`, `aggregators-feeders`,
  `grayzone-anti-empire`, `giant-amplifiers`, `state-media-irgc-press`.
  The packet `case_id` is preserved inside the data for traceability.
- English only, single locale. No `[locale]` split — that machinery exists
  for the archives' translations and has no work to do here.
- All routes SSG via `generateStaticParams`, prerendered like everything
  else. ~10 new pages.
- The existing root page keeps its three reference exhibits (Arma 3, Haifa,
  Empty Place) — they are the pattern primer — and gains the index. Its "The
  machine" / "The tells" copy already describes exactly what the case files
  document, so the hub reads as one continuous argument.
- The case template is `SectionPage` with `accent="ember"`,
  `surface="quiet"`; sources file into the right margin via the `marginNote`
  grid (record and sources as **sibling** elements, the `caseFileMain`
  pattern already on the root page — never absolute positioning). The
  `SectionToc` rail builds itself from the rendered `h2`s.

## 5. Data contract and importer

Model: the archive importer (`scripts/import-archive-package.mjs`).

- Define a `fake-resistance-research@1` contract: one JSON file per case
  assembled from `case.yaml` + the CSVs, plus a program-level `index.json`
  and the cross-case graph. Shape follows the report structure the renderer
  needs: bottom line (with confidence), roster, chronology, narratives,
  exhibits (claims joined to their sources via `claim_evidence`),
  relationships (joined via `relationship_evidence`), limitations,
  right-of-reply record.
- `scripts/import-research-cases.mjs` reads the external folder, runs the
  delivery's own `validate_research_case.py` per packet first, then
  transforms and writes `content-packages/fake-resistance/`. Re-runnable
  when the research updates; the external folder stays the source of truth.
- **Taken:** case.yaml fields, CSV rows with `publication_wording` as the
  claim text, source rows (url, archive_url, publisher, retrieved_at,
  reliability, sha256 where present), entity/relationship/narrative/event
  tables, report section prose *after* the editorial pass (§8). Exhibits
  carry an optional `techniques[]` array — the §3 taxonomy's controlled
  vocabulary, empty at import, filled in the Phase 4 editorial pass.
- **Left behind:** `evidence/**` raw pulls (third-party data — follower
  lists, timelines; the sha256 travels, the payload does not), internal
  `analysis` fields, `report_backup.md`, the `.grok`/`.codex`/`.agents`
  tool folders, the agent-task briefs.
- Validator asserts: referential integrity (every claim's evidence rows
  point at real sources, every edge at real entities), slug rules, enum
  vocabulary (below), and that no imported text field came from `analysis`.

### Vocabulary mapping

The site renders verdicts through `AssessmentValue`
(`server/contracts/enums.ts`) and the existing `VerificationBadge`. The
research vocabulary maps once, in the importer, and a test pins it:

| Research (`claims.csv` `status`) | Site `AssessmentValue` |
| --- | --- |
| `verified` (58 rows) | `verified` |
| `refuted` (2) | `false` |
| `disputed` (2) | `contested` |
| `unsupported` (2) | `unsupported` |
| `unresolved` (3) | `unverified` |
| `misleading` (0 today; in the contract's enum) | `misleading` |

`confidence` (high/medium/low), `identity_status`
(confirmed/probable/unresolved), `evidence_class`
(documented_relationship / observed_interaction / inferred_coordination)
and source `reliability` pass through **unmapped** — they are the research's
own honesty layer and render as labels, not as verdicts. `claim_type` (54
distinct ad-hoc values) is not rendered; it stays in the JSON for filtering
later.

## 6. Rendering — existing components do almost all of it

| Report section | Component |
| --- | --- |
| Bottom line + confidence | `SectionBlock` prose + confidence label (small addition) |
| Graded exhibits (claim vs record) | `ClaimRecordPair` + `VerificationBadge` |
| Chronology | `Timeline` |
| Sources | `SourceList` in the margin track |
| Limitations / "what would change conclusions" | `KnownUnknownPanel` |
| Corrections and any subject responses received | `CorrectionHistory` |
| Edition/provenance line | `PublicationMeta` |

Genuinely new work:

1. **Roster table** — entity class + identity status + follower snapshot +
   role. A small styled table component; data labels in the existing
   uppercase-tracking convention (two words max), everything else sentence
   case, nothing below `--t-data`. Read `.ai/DESIGN-V2.md` first.
2. **Network graph for `/network`** — build-time SVG generated from the
   packet-08 communities/bridges/edges data (deterministic script, same
   spirit as the particle bakes: artifact checked in, source data canonical).
   Not a client-side graph library; the page must carry its content without
   JavaScript like every other reading page.
3. **Confidence / identity-status / technique chips** — tiny; reuse badge
   styling. Technique chips link to the playbook anchors on the root page.
4. **The playbook page** — `/fake-resistance/playbook` per §3: a full
   chapter per technique (move / psychology / documented exhibits /
   recognition cues), `SectionPage` shell like its siblings. Every
   technique chip site-wide resolves to its chapter anchor here, so the
   explanation has exactly one canonical home.

House rules that carry over from the archive decisions: engagement figures
always render with their snapshot date (they decay); provenance travels with
every claim; JSON-LD per case page. On JSON-LD: the root page's convention
already handles this — `ClaimReview` only where an external fact-check
corroborates (e.g. the Kirk-assassination claim, refuted by court evidence
and named fact-checkers), **no `author` identity asserted for anonymous
accounts**, and case pages themselves are `AnalysisNewsArticle`, not
`ClaimReview` wrappers around allegations.

## 7. Methodology page

`/methodology` gains a section describing this program honestly, sourced
from the skill and the reports' own method notes: public mirrors plus
limited API pulls, convenience samples not firehose scrapes, no video
playback (caption-vs-footage fidelity untested), relative timestamps on the
mirror layer, engagement figures as retrieval-time snapshots. The research
wrote these caveats down; publishing them is what separates this section
from the accounts it documents.

## 8. Never published, regardless of gates

- `evidence/**` raw JSON (third-party follower lists, timelines, API pulls).
- Internal `analysis` fields where they exceed `publication_wording`.
- Any upgrade of the packets' own uncertainty: `probable` stays probable,
  `unresolved` identities (e.g. the `@jacksonhinklle` lookalike question,
  the `@WelcomeTheGulag` operator) stay unresolved on the page.
- Protected-category subjects (Gaza journalists, document-analysts, named
  corridor journalists) framed as "fake" anything.
- The Truthteller fee claim and other low-confidence single-source items,
  unless re-sourced.

## 9. Task plan

### Phase 0 — Owner decisions (blocks publication, not build)

- [x] Right of reply: **dropped by owner decision, 2026-08-26** — see §2
      and the `.ai/DECISIONS.md` entry. Not part of any remaining gate.
- [x] Naming policy **confirmed as proposed** (2026-08-26) and recorded in
      `.ai/DECISIONS.md`. Applied in the Phase 4 pass, not by the importer:
      a living person is named in connection with an allegation only when a living person is named in connection with an
      allegation only when (a) the packet grades the supporting claim
      `verified` at high confidence, **and** (b) the same conduct is already
      covered by the mainstream reporting in that case's `sources.csv`
      (NYT, Bloomberg, WaPo, NCRI, etc.). Otherwise the page carries
      role labels and handles, not person-to-allegation ties.
- [x] Cases 04/05: **publish, framed as the perception-engineering layer**
      (owner decision 2026-08-26 — supersedes this plan's "context files"
      recommendation; see `.ai/DECISIONS.md`). The evidence discipline that
      keeps the frame defensible is in that entry.
- [x] Legal review of the case texts that name living people — **reported
      complete by the site owner, 2026-08-26.** Cases advance to `ready`.

### Phase 1 — Contract and import (can start immediately)

- [x] Write the `fake-resistance-research@1` contract note (in this file or
      beside it) and `scripts/import-research-cases.mjs` with its validator.
- [x] Run the import; commit `content-packages/fake-resistance/` (~1 MB).
- [x] Tests: vocabulary mapping pinned; referential integrity across all
      seven case files + graph; no `analysis` text in any imported field;
      slug and enum validation. Follow the archive tests' pattern.

### Phase 2 — Content seam

- [x] `lib/content/fake-resistance-cases.ts` — async loaders (safe: not in
      the home route's render path) for case list, single case, and graph.
      Types shared with the importer's output. `getFakeResistanceEdition`
      and the existing root page are untouched.

### Phase 3 — Routes and components

- [x] Case template under `app/fake-resistance/cases/[slug]/page.tsx`:
      SectionPage shell, component mapping per §6, marginNote sources,
      `generateStaticParams` from the package index.
- [x] `/fake-resistance/network`: synthesis findings + build-time SVG graph
      from packet-08 data (generator script checked in beside the bakes).
- [x] Roster table + confidence/identity chips in `components/content/`
      (README there documents every prop — extend it).
- [x] `/fake-resistance/playbook`: write the nine chapters (§3 anatomy —
      move, psychology, documented exhibits, recognition cues). Launchable
      before the case gates: chapters name techniques, not people, and
      point at the root page's three exhibits until cases publish.
- [x] Root page: add "The files" index `SectionBlock`; keep "The tells" as
      the compact summary, each tell linking to its playbook chapter; keep
      the three reference exhibits.
- [x] Sitemap entries for the new routes; add them to `ci-smoke`'s route
      list. JSON-LD per §6. Methodology section per §7.

### Phase 4 — Editorial pass (needs Phase 0 decisions)

- [x] Rewrite each case's prose for publication: `publication_wording`
      claims, packet caveats rendered, category guards on 04/05, naming
      policy applied. This is a human-judgment pass over each of the seven
      case pages, not a mechanical import.
- [x] Tag exhibits with `techniques[]` from the §3 controlled vocabulary —
      each tag anchored to the claim/evidence rows that document it; a tag
      without a documenting row does not ship.
- [x] Advance each case's lifecycle status in its JSON: `right_of_reply`
      recorded as skipped by owner decision, then `editorial_review →
      legal_review → ready` as the passes complete — the same field is the
      publish flag below, so one status drives both. The contract's
      `right_of_reply` source role stays available for filing any response
      that arrives after publication; such responses render through
      `CorrectionHistory`.
- [x] Per-case publish verdict: publish / publish-redacted / hold. A held
      case builds locally but is excluded from `generateStaticParams` and
      the index by a `status` field in its JSON — one flag, no code fork.

### Phase 5 — Verification and release

- [x] `typecheck`, `lint`, full test suite, `build` (prerender count grows
      by the published-case count + 1), `ci-smoke` green with new routes.
- [x] No-JavaScript check of one case page and `/network` (prerendered HTML
      carries full content, zero Suspense boundaries — the archive bar).
- [x] The particle scene is untouched, so `verify:graphics`/`final-verify`
      need no re-run *unless* the root page's band or shell changed; if the
      root page gained sections, run `final-verify` on the workstation.
- [x] Journal: `DECISIONS.md` entry (naming policy, gated publication,
      category discipline), `STATE.md`, `TODOS.md` wave checkboxes.
- [ ] **Production deploy only after Phase 0 + Phase 4 gates are met.**
      Merging to `main` is safe throughout; the manual Vercel deploy is the
      publication act.

## 10. Open questions for the owner

1. **Does the synthesis publish as its own voice?** Plan assumes yes, as
   the spine of `/network`; alternative is folding its seven findings into
   the root page.
2. **Cases 04/05** — publish through the technique lens per §3 (05 as the
   authority mine feeding authority laundering, 04 as the two-pipelines
   finding; recommended — the supply side completes the manipulation story
   and the contrast gives the section its credibility), or hold them back?
3. **Update cadence** — the research is a 2026-08-26 snapshot; engagement
   figures and account statuses decay. Is this a one-time edition
   ("Research edition 001", matching the root page's edition convention) or
   does the program re-run? The importer is re-runnable either way.
4. **Hebrew** — the site is English today; the packets are English. Assume
   no translation this wave?
