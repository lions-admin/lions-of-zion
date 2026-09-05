# Automated Geopolitical Brief, News Articles, and Narrative Monitoring

> **Current operating mode (2026-09-03):** the owner disabled the editorial
> quality-review stage. The active chain is collect → enrich → cluster →
> triage → draft → publish. Structured-schema validation, authentication,
> source attribution, idempotency, audit records, and atomic publication remain.
> The quality-gate section below documents the retired implementation only.

## What the edition is for

The daily edition serves exactly three jobs, in this order of priority:

1. **Refute anti-Israel narratives.** This is the declared primary objective of
   the triage stage: identify anti-Israel claims and framings present in the
   evidence — false or misleading accusations, decontextualised atrocity
   framing, denial or inversion of documented events, delegitimisation of
   Israel's existence or self-defence — route each to Narrative Watch, and
   state the precise claim. It is an objective, not a filter applied after the
   news selection has been made. The previous ordering showed up everywhere
   downstream: triage allowed five general stories against three narrative
   watches, and five of the ten discovery queries pointed at war coverage
   against one at narratives — the exact inverse of the stated priority.
2. **One regional geopolitical Daily Brief**, assembled from the whole packet
   rather than selected as a story.
3. **One interesting Israel story** — innovation, history, civic achievement,
   resilience, recovery, community — which reads the sources and then composes
   something new from that reading rather than re-reporting a wire item.

Volume is one Daily Brief, up to five Narrative Watch records, and up to three
Israel Updates, enforced in `limitEditionArticles`. A minimum of one refutation
and one Israel story is a **target, not a quota**: both system prompts keep the
rule that a story is never invented to fill one, and a day whose material does
not support an item ships without it. A quota that must be met is a quota that
gets met with something.

## Sections the pipeline produces

`ARTICLE_SECTIONS` in `server/modules/briefing/service.ts` is what the model
may select, and it holds two values: `israel_update` and `narrative_watch`.
Every edition also carries exactly one `daily_brief`, which is assembled rather
than selected and so is not in that list.

**The war section was removed completely** (owner decision 2026-09-05, see
`.ai/DECISIONS.md`). It left `ARTICLE_SECTIONS` on 2026-09-01 — security, war
and operational material now feeds the Daily Brief — and on 2026-09-05 the
residual rows were deleted and the value was removed from
`PUBLICATION_SECTIONS`, the Postgres `publication_section` enum (migration
`0053`), the labels and the docs. The pipeline cannot produce it and no write
or read surface accepts it. `/war-update` survives as a permanent redirect so
the public URLs keep resolving.

## Unsourced refutations — analysis mode

A Narrative Watch article may publish **citing nothing at all**, marked in
public as this organisation's own analysis rather than as documented fact. A
source is a bonus on a refutation, not a requirement; what the organisation may
not do is present its own reasoning as a report.

`evidenceBasis: "sourced" | "analysis"` lives on `narrativeWatchDetails`. That
column is `jsonb`, so the field needed no migration.

**Derived, never chosen.** The flag is exactly `article.evidenceIds.length === 0`,
computed in `normalizeEditionForQuality`. It is never read off model output, and
the reason is specific: the draft retry loop feeds every quality-failure string
back into the next attempt, so the model sees precisely which checks it tripped.
A model-set flag switches off seven evidence checks in one token, and the loop
is a gradient pointed straight at whatever stops the failures. Anyone tempted to
let the model declare its own basis should assume it will be declared on the
second attempt of the first difficult edition.

That derivation covers the pipeline only. `updatePublicationSchema` accepts a
whole `narrativeWatchDetails` object, `evidenceBasis` included, and carries none
of the all-or-nothing refinements below, so `PATCH /api/v1/publications/:id`
*can* set the field by hand. The admin editor shows it read-only and preserves
it verbatim, but the API contract does not enforce what the create path does.
That is an open gap, not a design.

**All-or-nothing.** An analysis record must cite nothing *anywhere*: claims'
`evidenceLinks`, passages' `evidenceIds`, and `narrativeWatchDetails`'
supporting and contradicting id arrays must all be empty. A half-sourced
article — one cheap citation buying the relaxed checks for everything else — is
rejected outright, at the draft schema, at `createPublicationSchema`'s refine,
and inside the quality checks. Three gates agree on purpose, so none can drift
into permitting it alone.

**The substitute obligations are deliberately costlier than sourcing**, so
analysis mode is never the easy path:

- every claim carries `layer: "editorial_conclusion"`;
- `attributedTo` is exactly `ANALYSIS_AUTHOR` — "Lions of Zion editorial
  analysis";
- every claim carries a written `uncertainty` note saying what the reasoning
  does not establish;
- every claim's assessment, and the record's `verificationState`, is one of
  `refuted`, `misleading`, `unsupported`. A piece that cites nothing cannot
  conclude that something is `verified`, `disputed` or `unresolved` — those are
  findings about source material it does not have;
- every exact figure and direct quotation must still appear in the collected
  packet or in `exactClaim`. Reasoning does not license a number.

**At most one analysis article per edition**, capped on the same derivation as
everything else. The cap is separate from the section caps because a day that
produced no source-backed refutation must not become a day of five unsourced
ones.

**How it is marked to the reader.** This is the promise the whole feature rests
on, so the marking is redundant by design and spread across every surface the
record reaches:

- a second badge in the article kicker;
- a disclosure paragraph above the claim record — deliberately a paragraph
  rather than a tenth metadata row, because rows are skimmed;
- an `Evidence basis` row naming the byline;
- an affirmative "Why this record cites no source" block in place of the
  sources list, rather than the old "No public sources are listed", which reads
  as a malfunction;
- an `Analysis: ` title prefix instead of `Reported claim: `;
- a marker on the OpenGraph card, which outlives the page it came from and is
  reposted with none of the article's disclosure attached;
- a basis marker in the brief hub listing.

`server/contracts/publication.ts` holds the shared pieces —
`evidenceBasisSchema`, `ANALYSIS_AUTHOR`, `isAnalysisBasis()` and
`narrativeWatchTitle()`. The title prefixer is shared because it was duplicated
across two modules with divergent recogniser regexes; left unmerged, a
refutation renders as "Reported claim: Analysis: X".

**Read `evidenceBasis` as `=== "analysis"`, never as `!== "analysis"`.** Rows
written before the field existed carry no key at all, and an absent value must
fall to the strict side — the reading that keeps citations required.
`toPublicPublication` normalises this on read, because that path casts rather
than parses and the zod default never ran there.

## Retired quality gate (historical reference only)

`REQUIRED_QUALITY_CHECKS` names **eighteen** deterministic checks, run after
drafting and before any row can receive an automatic-publish marker. Model
output cannot waive them. The eighteenth, `analysis_disclosure`, was added with
analysis mode: it is vacuously true for a sourced record and is the disclosure
itself for an unsourced one, holding it to Narrative Watch, an empty citation
list, and a labelled verification state.

**No check is ever skipped.** An exemption lives *inside* its own check's pass
condition, with a detail string saying so — the pattern
`daily_brief_official_context` and `hostile_only_routing` already used. Seven
checks gained an unsourced branch: `known_evidence`, `source_independence`,
`title_source_alignment`, `claim_evidence_matrix`,
`claim_source_independence`, `paragraph_traceability` and
`exact_fact_fidelity`.

That is not a style preference. The publish gate is enforced in two places that
count differently:

- `publications/repo.ts` recomputes from `REQUIRED_QUALITY_CHECKS.length`, so
  it follows the TypeScript constant automatically;
- the SQL trigger `enforce_publication_publish_gate` (migration `0031`)
  hardcodes **twelve** literal check names and raises unless exactly twelve
  pass. It was frozen at that migration and cannot see anything added since.

An unsourced refutation still yields exactly twelve passes among those twelve
names, which is why analysis mode needed no migration. That is not luck:
**all seven checks that gained an unsourced branch are inside the frozen
twelve**, so skipping any one of them rather than exempting it would drop the
count to eleven and raise an exception in Production — in SQL, on a path PGlite
never exercises, in a trigger no TypeScript test can see fire.
`tests/briefing-quality.test.ts` therefore pins the arithmetic directly, for a
sourced candidate and an unsourced one, because nothing else would catch it.

`exact_fact_fidelity` is the check that does *not* exempt figures. It widens
the corpus instead: an analysis candidate's numbers and quotations are matched
against the whole collected packet plus `exactClaim`, never against the
article's own prose. That degrades in the right direction — an empty packet
permits no figures at all.

The pre-existing divergence between the eighteen TypeScript checks and the
trigger's frozen twelve is unchanged and is tracked separately. It is a gap:
six checks are enforced only in TypeScript.

## Current implementation state

The application contains the production pipeline and all public/admin
surfaces. Automatic publication is enabled only in Production and only after
the data-contract and quality gates pass. The database pause remains the
immediate stop control; Preview cannot publish. This protects the site from
repeating the defective first run while preserving the owner's chosen
automatic-publication workflow.

## Implemented in the repository

- Publication sections, public projections, source/evidence/narrative links,
  editorial filters, versions, audit records, corrections, related articles,
  three ordered homepage slots, canonical pages, sitemap, and social cards.
- Direct-source RSS/Atom connector and Google Agent Search connector with
  post-retrieval domain allowlist enforcement, publisher-family
  attribution, canonical URL normalization, deduplication, fetch audit rows,
  private raw Blob storage, and repeated-failure source disabling.
- Israel-local durable collection and editorial jobs with queue delivery,
  lease recovery, checkpoints, quarantine, pause/resume, idempotent stage
  records, and idempotent automatic-publication candidate keys.
- Structured OpenAI triage and drafting contracts using
  `openai/gpt-5-nano` and `openai/gpt-5-mini`; no change to Grok chat.
- Claim/evidence matrices, eighteen quality checks, budget ceilings, no partial-
  edition publishing, transparent machine provenance, and a Daily Brief/Narrative
  Watch contract that preserves uncertainty and marks unsourced analysis as
  such.
- Administrator health, usage, spending, queue, failed-run, draft/publication,
  traceability, edit, archive, and homepage-feature controls.
- Public Daily Brief hub, Israel updates, Narrative Watch, dated
  archive/filtering, homepage fallback headlines, and honest empty states. The
  `/war-update` route continues to serve its existing archive; the pipeline no
  longer adds to it.
- Production safety controls: resource isolation, Preview dry-run, safe fetch
  protection, origin/rate-limit checks, security headers, deep health checks,
  durable alerts, backup/restore/retention scripts, and runbooks.

## Discovery queries

`BRIEFING_DISCOVERY_QUERIES` in `server/modules/sources/catalog.ts` is the
editorial brief in machine-readable form, so it is weighted the way the site
is: four queries on the narratives the site exists to refute, three on the
regional geopolitical brief, three on the daily Israel article. The mix
originally weighted the now-removed war section instead — the exact inverse of
the stated priority.

Every query has to earn its results inside `BRIEFING_PRIORITY_DOMAINS`, which
is the whole corpus Discovery Engine may see. That is why the rewritten queries
are wordy and specific: a vague query inside a bounded corpus does not return
less, it returns the same front pages every day, which is worse than nothing
because it looks like collection. It is also why the Israel-story queries are
worded away from conflict vocabulary — inside this corpus a query carrying
"security" or "Gaza" collapses back into the brief's results, which is how the
old `israel-current-affairs` query behaved.

Two facts govern any edit to that list, and both are operational rather than
editorial:

- **`group` is write-only.** It is stored into the created source's `config`
  and read by nothing. Retagging an entry changes the admin audit label, not
  behaviour. Only the `query` string has an effect.
- **The catalog sync only ever creates.** `syncBriefingSourceCatalog` skips an
  entry whose slug or derived logical key already exists —
  `agent_search:query:<normalized query>`, the query text trimmed, lowercased
  and whitespace-collapsed — and there is no update path for `agent_search`.
  Editing a query in place leaves the live source running the old text while
  the file claims the new one, so the rule is **change the query, change the
  slug**. Rewritten queries arrive as new sources, always `active: false`, and
  the ones they replace are deactivated by hand. `docs/briefing-operations.md`
  carries that procedure.

## Ongoing production acceptance

1. Google Agent Search is provisioned with Workload Identity Federation and a
   least-privilege service account. Keep using the authenticated browser
   session for provider changes; do not create a static key.
2. Configure distinct Preview/Production environment variables and resource
   labels. Keep the briefing Blob store separate from the October 7 archive.
3. Create a backup and isolated restore target, then prove the restore drill.
4. Seed sources, verify feeds in the target environment, and enable only feeds
   with direct, usable publisher results.
5. Run a live collection with publication paused. Sample direct URLs, dates,
   excerpts, source families, and duplicate decisions.
6. Run three controlled full editorial packets with publication paused; review
   claim matrices and Narrative Watch output.
7. Verify the public and administrator experience in Chrome and physical
   mobile devices, then run the read-only production smoke command.
8. Test a controlled provider failure, alert, retry, quarantine, and recovery.
9. Production automatic publication is enabled by the owner decision. Keep
   the database pause as the immediate stop control; pause publication if an
   acceptance check fails, remediate it, and rerun the affected checks before
   resuming it.

Detailed commands and acceptance evidence are in
`docs/briefing-operations.md`. The task-level rebuild checklist remains in
`GEOPOLITICAL_BRIEF_REBUILD_TODOS.md` and must not be marked complete before
those provider and live acceptance actions are recorded.
