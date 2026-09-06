# Decisions

Append-only. Newest first. One entry per decision that a later reader would
otherwise re-litigate or accidentally undo.

Record the **why**, not the what — `git log` and `git diff` already hold the
what, and duplicating them here just creates something to fall out of date.
A decision that was reversed keeps its entry, with the reversal appended: the
record of a bad idea is what stops it being had twice.

---

## 2026-09-06 — The site is a whole-site daily editorial system, not a Daily Brief: five destinations, section as the single routing choice, minimum enforcement until launch

The owner issued a binding definition of what this site and this system **are**,
and it is now `docs/editorial-dna.md`. It is recorded here because its
rulings are the kind a later reader would otherwise re-litigate from the code,
and because the previous framing survived in `CLAUDE.md` for months after the
implementation had moved past it.

- **The product is a live content system, not a publication.** It exists to
  demonstrate how AI, OSINT, research and Israeli creativity are used as
  technological activism in the information war against terror, propaganda,
  disinformation and manipulation aimed at Israel and the West — and
  explicitly **not** as revenge. Action, exposure, education, documentation,
  and tools a reader can use. October 7 is part of the definition rather than a
  section of it: part of the terror was filmed and distributed in real time, so
  the networks were an arena of the war and not a commentary on it.
- **A run is a whole-site editorial update, not a Daily Brief.** `CLAUDE.md`
  said "the briefing serves exactly three jobs" until today; the code had
  already grown fourteen sections, three homepage bands, a durable run and a
  package contract that describes the whole site. The run acts as
  editor-in-chief, OSINT researcher, investigative researcher, information-war
  analyst, news editor, developing-story editor, visual producer, homepage
  editor, content manager and site-quality observer. Its mandatory job is the
  information-war one: find a consequential current anti-Israel narrative and
  investigate it, and when none is strong enough, produce original sourced
  research on influence networks rather than leave the area empty.
- **Five destinations.** News & Analysis, Fake Resistance, The People of
  Israel, October 7, and Behind the Desk / How It Works. The People of Israel
  unifies and extends Our Heroes and Israel's Story — **extends, not
  replaces**: both keep their URLs and their reading shells as
  `LEGACY_SECTION_PAGES`, because the alternative is breaking every inbound
  link to a citation page in order to tidy a navigation bar. October 7 is an
  archive a run reads and never writes: new documented material a run finds is
  a *recommendation*, which is what stops a machine composing memorial
  material.
- **`publication.section` is the only editorial choice, and one file derives
  the rest.** This was already the design of `lib/publication-routing.ts`; the
  ruling makes it non-negotiable. No `homepageCategory`, no `destination`, no
  `frontendSection` — a second model-picked field plus scattered ternaries is
  how a record ends up filed as news on the homepage and as a claim assessment
  on its own page. The corollary bit today: `LiveBriefHub` had hand-written
  `["daily_brief", "israel_update"]` and rendered `news` records nowhere, which
  is exactly the drift a derived list prevents.
- **Launch-period posture: minimum enforcement.** Deliberately *not* enforced
  during the run-in period — `external-briefing-v1` as the central constraint,
  heavy quality contracts, editorial gates, quotas, candidate caps, balance
  quotas, redundant validation loops. Deliberately kept — auth, database
  integrity, persistence, media safety, security, idempotency and transactions
  where they are needed, and enough parsing that nothing crashes. This is a
  ruling about **timing**, not a repeal: ordered contracts and quality gates
  return after launch, and the rule that governed them still holds — no check
  is ever skipped, and an exemption lives inside its own pass condition. The
  reason to write it down is that the reverse mistake is the tempting one: an
  agent that finds the whole-site path ungated will want to helpfully add a
  gate, and doing so mid-launch is a change to the owner's operating decision.
- **The veto and the auto-fix boundary.** The editor may refuse to publish
  anything weak, poorly sourced, boring, redundant, misleading or damaging to
  the desk's credibility, and must report what it vetoed, why, what it did
  instead, and whether the owner needs to decide. Inside a run it **may** fix
  content, images, metadata, homepage composition, routing and classification,
  and developing-story updates; it **may not** change CSS, components, database
  schema, navigation architecture, core application code or security — those it
  reports through `siteRecommendations` and they become a separate development
  task. That boundary is deliberately structural rather than instructed:
  `server/contracts/whole-site-update.ts` is `.strict()` and has no
  representable field for SQL, a command, a migration, an environment value or
  application code, and the delivery branch is excluded from Vercel. Keep it
  that way — an instruction not to touch the schema is a request; an unwritable
  field is a guarantee.

One rule that follows and is easy to get backwards: **never fabricate an
internal UUID.** `evidenceIds`, `itemIds`, `narrativeIds`, `eventId` and
`primaryTopicId` point at real rows. If an item's source traceability cannot be
represented without inventing one, veto the item and record a
`siteRecommendation` naming the missing source-ingestion capability. A
plausible-looking UUID that resolves to nothing is worse than a missing
article, because it is indistinguishable from a real citation until someone
follows it.

---

## 2026-09-06 — After the owner's live-phone review: previews end on sentences, the October 7 archive keeps the page's ground, type has floors, and a dossier has no box on a phone

The refinement below went to Production the same morning, and the owner read
it on an iPhone: headlines too small, type too small in several places, a
preview cut at "threw…" with its source line beneath, and "the colour change
in the middle" — the October 7 paper page-turn — "unrelated" to the page
around it. Four rulings follow, each of which a later reader might otherwise
undo in the name of density or rhythm.

- **A preview ends on a full stop.** `-webkit-line-clamp` truncates by
  character, so a three-line clamp produced "threw…" and "anti-Israe…" on a
  real phone. `previewSentences()` in `lib/preview-sentences.ts` divides a
  summary at sentence boundaries — the first sentence always, then whole
  sentences within a character budget — and the phone hides the rest in a
  span; the clamp remains only as the backstop for one sentence longer than
  the budget. Nothing is rewritten: the words are the record's, and a wide
  viewport shows the paragraph as written. The abbreviation guard fails
  towards a longer preview, never towards "Maj.-Gen." — the safe direction,
  because the clamp bounds the long case and nothing bounds the broken one.
- **The archive shares the page's ground.** The paper page-turn was a
  deliberate change of material for the preserved record; on a phone,
  scrolled to mid-page, it read as another site. Its identity is its head
  rule, its record kinds and its content warnings. The paper tokens stay
  defined for the record.
- **Historical phone type floors** from the earlier implementation: 16px body, 15px
  "Why it matters" and findings, 13px metadata and captions, 11px kickers.
  Density comes from how much is shown, never from making what is shown
  smaller.
- **A record is an open column on a phone, not a box.** The Fake Resistance
  dossier's panel cost 34px of a 350px measure and read as a card inside the
  page; the brief had already asked for less nested chrome. The panel remains
  on wide viewports.

One mechanical finding rode along: the retracted launcher travelled its
diameter plus one spacing step, and on iOS Safari with its toolbar collapsed
the top of the icon stayed visible above the bottom edge — the edge the
browser positions against and the edge it paints to are not the same there.
The travel is now generous rather than exact.

---

## 2026-09-06 — The homepage Ask launcher retracts while a phone reader scrolls down; it does not get a reserved column, a header slot, or a bottom bar

The owner's mobile brief made this mandatory: a persistent control may not
obscure the reading column, and screenshots at reading positions must show
nothing meaningful under it. Four placements were weighed before the one
that shipped, and the reasons matter more than the CSS.

- **A reserved right column** was ruled out by the brief itself, and it would
  have narrowed every line on the phone for a control used occasionally.
- **A slot in the fixed header** cannot exist at 320px: the brand plus three
  44px controls already fill the bar, and a fourth would either shrink a
  touch target below 44px or drop search or account at a breakpoint — a
  primary path silently lost, which UI-UPGRADE-TASK #17 already warns about.
- **A bottom bar** is chrome the reader understands, but it spends a
  permanent band of a phone's height on an editorial page and reads as
  application UI, which §9 of the brief rejects.
- **A corner icon that is always visible** covers whatever the reader
  scrolled to; the baseline probe found text or an image under it at nearly
  every sampled position.

So below 1100px on the homepage — the widths where the edition reserves no
gutter — the launcher is the full seal over the cover's empty corner, then a
48px icon that slides below the viewport after 24px of downward travel and
returns after 8px of upward travel, at the end of the page, or on keyboard
focus. The gesture is the one Safari's own toolbar taught; the transform is
on a fixed element so no layout moves; reduced motion makes it a cut. What
this trades away is stated plainly: a reader who scrolls up sees the icon
over the column until their next downward scroll. The evidence probe in
`scripts/homepage/verify-mobile.mjs` measures exactly that. Desktop, and
every other route, keep the fixed seal.

Two smaller decisions rode along. With scripting off the launcher is not
rendered at all — the button could open nothing and was a dead control fixed
over prose; the menu's `/ask` link remains. And publication-backed homepage
records now have a development-only transcription in
`content-packages/homepage/local-records.json`, consulted by `lib/homepage.ts`
only under the local preview and only after the database resolution fails,
so the composition can be reviewed on a checkout with no `DATABASE_URL`. It
is never a production fallback; the page already flags the local preview.

---

## 2026-09-05 — The uppercase rule is not one line to reverse, and two hero numbers will go stale silently

Three findings from a frontend design pass, recorded because each one is
either a claim in the code that is wrong, or a value that will rot without
anything failing.

**`body { text-transform: uppercase }` cannot be scoped in one line.** The
comment above that rule in `app/globals.css` says the declaration is single and
inherited so that "reversing it, or scoping it to chrome only, is one line
rather than an audit". Measured across ten routes, that is not true. Roughly
twenty chrome classes render uppercase purely by inheritance and would lose it
the moment prose is exempted: `site-footer` file indexes, `sections` ToC
numerals, `live-feed` clock and facet, `pagination` gap, `content` source
number and kind, `page` stage/era/pipeline numerals, `fact-check`
`entryStrength`, `archive` `witnessLocale` and `witnessFact`, and the
`information-war` kicker, index and status pair. A prose exemption is one line;
making the chrome survive it is an audit of those twenty. Both halves are the
work, and the comment promises only the first.

The rule itself stands — the owner was told uppercase slows reading of
continuous text and chose it deliberately, and that has not been reversed. What
is recorded here is the size of reversing it, so the next person does not start
from the comment's estimate. Note also that the exemption cascades:
`text-transform` inherits, so exempting `<li>` reaches every `<span>` inside it,
which is how chrome nested in prose ends up in the blast radius.

**Prose runs past its own measure on three routes.** `--measure-reading` is
68ch, but `/fact-check`, `/methodology` and `/we-are` render their body copy at
`max-width: none`: measured at 900px, 193, 100 and 86 characters per line
respectively. This is independent of the uppercase question and survives either
answer to it.

**Two dock offsets are measurements with no test behind them.** The Ask
trigger clears the home signal rail by a fixed offset — `6.25rem` from
`min-width: 48rem` and `13.5rem` below it, both in `components/ask/ask.module.css`
— derived from the rail measuring ~76px on desktop and ~176px on a phone once
its metadata wraps and its headline takes two lines. If the rail grows another
row, the trigger returns to sitting on the headline and nothing fails: not
typecheck, not lint, not the suite. A fixed element cannot measure a flow
element in CSS and anchor positioning is not yet safe to rely on, so the
derivation is written beside each number instead. `app/home.module.css` is
where that would break.

---

## 2026-09-04 — Agent Search "actual" cost is a fetch-time per-query estimate, and GDELT sources are blocked at creation, not registered

Two spend/discovery decisions from the same console wave, recorded because
each one will be mistaken for something more than it is.

**The cost column is honest about what it is.** `source_fetch.actual_cost_usd`
(migration `0052_agent_search_actual_cost.sql`, same `numeric(16,9)` as
`ai_run.cost_usd` per 0020) is written by the Agent Search connector when
`GOOGLE_SEARCH_ESTIMATED_COST_PER_QUERY_USD` is set: one query executed and
answered (success or partial — Google bills the call either way) times the
configured per-query rate, recorded **at fetch time**. It is **not a Google
billing feed** — there is no invoice reconciliation, and a failed transport
records nothing. RSS and official APIs stay null, never zero, so an
unconfigured rate cannot masquerade as free confirmed spend. The console
costs read surfaces the 30-day sum of this column beside the month-to-date
estimate (`search.actualSpendUsd`), and the difference between the two is
exactly the honesty boundary above.

**GDELT is blocked, not registered.** `gdelt.ts` exists on disk but no
connector is registered (`sources/connectors/index.ts`), so a `gdelt`-kind
source could be created and then only ever collected into `NOT_IMPLEMENTED` —
a dead row. Rather than register a collector (a bigger change with its own
provider decisions, and GDELT produced repeated timeouts when last tried), the
create contract now rejects `kind: "gdelt"` outright
(`createSourceSchema` in `server/contracts/source.ts`). Legacy `gdelt` rows,
if any exist, keep working everywhere else: the enum value stays legal, the
collection attempt keeps throwing the same error, and `updateSourceSchema`
still omits `kind`. The block is one zod refine; registering a real collector
remains the separate decision it always was.

## 2026-09-04 — Prompt activation is a console action through `activate_prompt()`, and ops-chat transcript persistence stays deferred

**Prompt activation changes model behaviour, so it is an explicit action with
an audit row.** Until this wave the only way to move a slug to a new version
was direct database access — the sanctioned `activate_prompt()` SQL function
(migration 0011) existed, but no application route reached it. That is the
worst of both: the dangerous operation was possible, but only outside the
audit trail the console writes for every other action. The console now reads
the registry (`GET /api/v1/admin/console/ai/prompts` — every version, its
active flag, the full template text, because an operator must see what the
next model call will read before activating), appends versions
(`POST` — insert-only, starts inactive, the append-only trigger still forbids
rewrites), and activates through the SQL function itself
(`POST …/prompts/activate`), refusing unknown and already-active versions and
writing `ops.prompt.activated` in the same transaction. **Activating a prompt
version changes what every future model call sees from the next call on** —
the UI wave wires an explicit confirmation in front of the route; the audit
row records whoever passed it. No ops-chat tool was added for this
deliberately: activation is not something a conversational agent should do
accidentally.

**Ops-chat transcript persistence is designed, not built.** The console's
ops chat is stateless server-side: the client holds the transcript and sends
it back each turn, which is adequate and keeps the hot path simple. Persisting
transcripts server-side would need: a table in the chat schema family
(`ops_chat_message` or a `chat_thread` surface discriminator), a retention
policy (ops transcripts contain tool arguments the audit log already
records), and drill-down linkage from a turn to its `ai_run` row — which the
wire contract already carries (`toolCalls[].aiRunId`). It is deferred because
the client-held transcript loses nothing today, and the schema addition
deserves its own migration round rather than riding this one. The open
question: whether ops transcripts are audit-relevant enough to persist at all
— every tool execution already writes an `audit_log` row, so a persisted
transcript may only ever duplicate what the audit log proves.

## 2026-09-04 — `briefing-quality` is a declared queue topic with no route: retired in place, not dead weight

`vercel.json` still carries a `queue/v2beta` trigger for topic
`briefing-quality` (`vercel.json:49-53`), but
`app/api/internal/queue/briefing/quality/route.ts` does not exist — the stage
directory holds only `cluster`, `draft`, `enrich`, `publish` and `triage`. The
quality-review stage was folded into publish by migration
`0049_remove_briefing_quality_gate.sql`, which redefines
`enforce_publication_publish_gate` to require machine provenance instead of
quality provenance (`0049…:1-9, 26-38`) and completes any in-flight quality
jobs with `last_error = 'Quality-review stage retired by owner instruction'`
(`0049…:57-60`). `BRIEFING_JOB_STAGES` (`server/modules/briefing/jobs.ts:24`)
no longer names `quality`: it is `collect, enrich, cluster, triage, draft,
publish`. One remnant survives in code — `server/modules/briefing/repo.ts:179`
still carries `quality` in a stage type union — harmless until edited; recorded
here rather than "fixed" now.

**What is verified and what is not.** Everything above is verifiable on disk
today. Whether the Production Vercel project actually holds and would activate
this trigger entry as `vercel.json` states is a console question:
**verification PENDING — the production console has not been checked from this
pass.** Until it is, do not add a `quality` stage consumer "to make
`vercel.json` consistent", and do not delete the trigger entry either: the
standing instruction for this pass is *don't add and don't delete right now*.
The declared-but-unrouted topic is retired in place, and cleaning it up belongs
to whatever decision eventually removes it — by the same two-deploy rule that
governs retiring any topic.

## 2026-09-04 — The briefing edition has no scheduled trigger; external-publish and the admin run are the fulfilled path

Commit `c1e579b` (2026-09-03) removed the `0,15,30,45 4,5 * * *` cron that
covered 07:00 Israel time from `vercel.json` — deliberately, and only after
the external-publish trial succeeded end to end against Production: a real
edition published, appeared on `/geopolitical-brief`, and an identical resend
returned status `duplicate` with no new row, all verified via the public API
(per the commit message). The route `/api/internal/cron/briefing` was **not**
deleted; only its scheduled invocation was. An unscheduled invocation still
returns, without force, `queued`, `outside_schedule` (any call outside the
07:00 Israel local hour — `server/modules/briefing/jobs.ts:543`),
`waiting_for_collection`, or `already_completed`.

**This is not an accident, and a later reader must not "fix" it by re-adding
the cron.** An edition is now fulfilled when a package arrives at
`POST /api/internal/briefing/external-publish` (idempotent on
`external_briefing_submission.run_id`,
`0050_external_briefing_submission.sql:13`) or when the administrator triggers
`POST /api/v1/admin/briefing/run`. The doc corrections of 2026-09-04
(`docs/vercel-infrastructure.md`, `docs/operations.md`, `README.md`) describe
this state; they are corrections of description, not a change of behaviour.
Re-enabling the schedule is a one-line `crons` addition — the route's
`vercel.json` functions block (`maxDuration: 300`, `iad1`) was never removed —
but it must land between editions, per `CLAUDE.md`'s deploy rule: *"A deploy
that adds or removes a briefing quality check must land between editions
(07:00 Asia/Jerusalem), in either direction — a rollback strands an in-flight
edition just as the deploy did."*

---

## 2026-09-01 — A refutation is a narrative, so it publishes into `narrative_watch`

The owner ruled that an anti-Israel news item **is** a narrative — the thing the
briefing exists to answer, not a separate genre standing alongside it. That
ruling settled a design question which had a considerably more expensive answer
available.

The expensive answer was a `refutation` section of its own: a new value in the
Postgres `publication_section` enum and therefore a migration, a public route to
serve it, a filter in the brief hub, and another branch in homepage-feature
eligibility. Mapping refutations onto the existing section costs none of that,
and it fits rather than merely avoids. `narrative_watch` is already the one
section whose detail record names the **claim** (`exactClaim`) and the verdict
on it (`verificationState`) instead of the event; the two routing checks
`hostile_only_routing` and `adversarial_only_routing` already funnel into it any
packet that documents what someone said as opposed to what happened. A
refutation is that record with the sources removed, not a different record.

So the stated primary editorial objective got a larger share of the collection
budget and no new plumbing at all. Anyone proposing to promote refutations to
their own section later should read this first: the cost is a migration plus
four surfaces, and nothing about the shape of the record asks for it.

## 2026-09-01 — A Narrative Watch record may cite nothing, and every surface says so

Owner decision: **a source is a bonus on a refutation, not a requirement.** The
organisation may answer a hostile claim from its own reasoning and public
context. What it may not do is publish that piece as an ordinary report.
`evidenceBasis: "sourced" | "analysis"` on `narrativeWatchDetails` records which
one a row is; that column is jsonb, so the field needed no migration.

**All-or-nothing, and two gates say so independently.** An analysis record must
cite nothing *anywhere* — no `evidenceLinks` on a claim, no `evidenceIds` on a
passage, empty supporting and contradicting arrays on the detail record. The
half-sourced shape is the laundering one, and it exists because `evidenceBasis`
derives from the article's *top-level* `evidenceIds` alone: a piece that leaves
that one array empty while its claims and paragraphs still point at evidence
would be graded on the lenient branch of seven checks and be carrying sourced
material anyway. `articleSchema`'s `superRefine` in `briefing/service.ts` and
the `claim_evidence_matrix` check both reject it, duplicated on purpose so that
neither can drift into permitting it alone; `createPublicationSchema` carries
the same rule for passages at the publication API boundary.

**The substitute obligations are heavier than sourcing, deliberately.** Every
claim carries `layer: "editorial_conclusion"`, `attributedTo` exactly
`ANALYSIS_AUTHOR`, a written `uncertainty` note, and an assessment in
{`refuted`, `misleading`, `unsupported`}; the record's `verificationState` is
held to the same three, because a piece that cites nothing cannot conclude that
something is `verified`, `disputed` or `unresolved` — those are findings about
source material it does not have. `exact_fact_fidelity` is not relaxed at all;
see the next entry. At most **one** analysis article per edition, capped
separately from the section caps so that a day which produced no source-backed
refutation cannot become a day of five unsourced ones.

The title prefix is shared (`narrativeWatchTitle`, `server/contracts/publication.ts`)
for a concrete reason. It existed in two modules with divergent recogniser
regexes, and a sourced record reads "Reported claim: " while an analysis record
reads "Analysis: ". Left unmerged, a refutation renders as
**"Reported claim: Analysis: X"**.

## 2026-09-01 — `evidenceBasis` is derived from the citation list, never chosen by a model

It is exactly `article.evidenceIds.length === 0`, computed after the draft is
parsed. The draft stage is never asked for it and cannot set it.

The reason is the retry loop. A failed draft is retried with **every quality
failure string fed back into the next attempt**, which makes that loop a
gradient pointed straight at whatever stops the failures. A model-set flag would
have been found within an edition or two, and setting it moves seven evidence
checks onto their unsourced branch in a single token. Derivation is not a style
preference here — it is the only version of this feature that is not
self-defeating.

The reading rule that goes with it: test `=== "analysis"`, **never**
`!== "analysis"`. Rows written before the field existed carry no key at all, so
an absent value must fall to the strict side; `isAnalysisBasis()` exists so no
call site has to remember. `toPublicPublication` normalises the field on read
because that path casts the jsonb rather than parsing it, so
`evidenceBasisSchema`'s default never ran there and callers were handed
`undefined`.

## 2026-09-01 — No quality check is skipped; the exemption lives inside the pass condition

`analysis_disclosure` takes `REQUIRED_QUALITY_CHECKS` to eighteen, and seven
existing checks grew a second pass condition for an unsourced candidate. Not one
of them is skipped, and that is what made the whole change migration-free.

Two layers enforce the publish gate and they count differently.
`publications/repo.ts` recomputes from `REQUIRED_QUALITY_CHECKS.length`, so it
follows the constant automatically. The SQL trigger
`enforce_publication_publish_gate` (migration `0031`) hardcodes **twelve literal
check names** and raises unless exactly twelve of them pass; it was frozen at
that migration and cannot see anything added since. A skipped check writes no
row — so an unsourced refutation that merely skipped `known_evidence` would
yield eleven passes among the frozen twelve, and auto-publish would raise in
Production. Writing every check with its exemption inside its own pass
condition, and a detail string naming which branch it took, keeps the recorded
audit row honest *and* keeps the trigger satisfied. The pattern was not invented
here: `daily_brief_official_context` and `hostile_only_routing` already worked
this way.

`exact_fact_fidelity` is deliberately **not** exempted. An unsourced piece is
the one place a fabricated figure has nothing to contradict it, so the corpus is
widened instead of the check dropped: an analysis candidate's numbers and
quotations are matched against the *whole collected packet* plus the claim being
refuted. That stays non-circular — the article's own prose is never part of the
corpus — and it degrades in the right direction, because an empty packet permits
no figures at all.

`tests/briefing-quality.test.ts` now asserts the arithmetic directly: twelve
passes among the frozen twelve, for a sourced candidate and an unsourced one.
Nothing else pins the two layers together, and PGlite never fires this trigger
on a candidate assembled in a unit test, so without that assertion the failure
surfaces only as a raised exception in Production. The eighteen-versus-twelve
divergence itself is older than this change and tracked separately; what is
settled here is that no future check may be bought by skipping an old one.

## 2026-09-01 — `war_update` stops being produced and stays a legal value

Removed from `ARTICLE_SECTIONS` in `server/modules/briefing/service.ts`, so the
triage stage can no longer select it. Security, war and operational material now
feeds the Daily Brief, which is assembled from the whole packet in any case;
one regional brief reads better than a brief plus a parallel war feed drawn from
the same evidence, and the discovery budget those five queries held moved to the
narratives the site exists to refute.

It remains a legal value in `PUBLICATION_SECTIONS` and in the Postgres
`publication_section` enum, and that is not an oversight. Historic rows carry
it, `/war-update` still serves them, and homepage-feature eligibility still
includes them. **Retiring a producer is not the same as retiring a value**:
dropping the enum member means a migration that rewrites or deletes published
rows, which is a far larger act than removing a menu option, and buys nothing.
The route keeps serving its archive and stops growing.

`STORED_ARTICLE_SECTIONS` still accepts `war_update` when *reading* a stage
artifact, so an edition whose stages straddle the deploy does not quarantine on
a value its own earlier stage wrote.

**The admin section menu keeps offering it, by owner decision (2026-09-01).**
`app/admin/PublicationManager.tsx` is now the only place a new `war_update` row
can be created, and that is deliberate: an editor filing into the archive by
hand is a different act from the pipeline producing a daily feed, and the
section has to stay reachable for the archive to remain editable. Recorded here
rather than left as an apparent oversight, because the obvious next reading of
"the pipeline no longer produces it" is that the menu option was forgotten.

## 2026-09-05 — `war_update` was never a feature; it is being removed completely

This supersedes the 2026-09-01 entry above in full. Inspection of the branch
database showed every surviving `war_update` row was machine-published by the
pre-2026-09-01 pipeline (no `created_by`, no `approved_by`, batch timestamps,
all `archived`) — residual output of a path no human ever used. Owner decision:
the section is retired **completely**, not preserved as a legacy read-only
value. No compatibility shelf is kept for it.

Applied in two stages:

1. **Write closure (2026-09-05).** `WRITABLE_PUBLICATION_SECTIONS` (daily_brief,
   israel_update, narrative_watch) is now the write-side contract:
   `createPublicationSchema` and `updatePublicationSchema` reject `war_update`,
   the codex import boundary rejects it, the pipeline publish stage (and
   `resumePausedEdition`, which rebuilt inputs from stored artifacts without
   ever crossing an HTTP boundary) raises and quarantines on it, console
   version-rollback omits a non-writable `section` from its update fields, and
   the admin editor offers the option only for a row that already carries it —
   sending `section` only when changed, so a legacy row cannot be silently
   relabeled by a form submit. Read shapes (`publicPublicationSchema`, both
   list filters, `STORED_ARTICLE_SECTIONS`, labels, breadcrumb, homepage
   eligibility) still accept the value so existing rows keep serving until
   stage 2.
2. **Data + enum retirement (2026-09-05).** The residual rows were verified on
   Production: five, machine-published, no human creator or approver. They were
   deleted with their dependent join records — the underlying evidence
   entities are shared and stay — and `war_update` was then removed from
   `PUBLICATION_SECTIONS`, the `publication_section` enum (the 0053 migration
   rewrote the type), the read-tolerance sets, the labels and the docs. The
   2026-09-01 claim that "retiring a producer is not the same as retiring a
   value" was correct as written then and is reversed by this decision, not by
   discovering it was wrong.

`PublicationManager.tsx` named in the 2026-09-01 entry no longer exists;
`app/admin/EditorialDesk.tsx` was the last writer.

## 2026-09-01 — `item.detected` is retired to a tombstone; `embedding.refresh` is deleted

Two dead outbox topics, treated differently, and the difference is the point.

`item.detected` had two producers in `items/service.ts` — one per created item,
which for the briefing publish stage means one per claim — feeding a consumer
that was a deliberate no-op from the day it was written. About half of every
post-edition outbox backlog was this topic queueing to do nothing. The producers
are gone and the topic moved out of `TOPICS` into a new `RETIRED_TOPICS` in
`server/core/outbox.ts`, so naming it again is a **type error** rather than a
convention someone has to remember.

Its consumer stays registered, as a tombstone rather than a placeholder.
`dispatchOutboxMessage` throws on an unregistered topic and undrained rows may
exist in a real database, so deleting the handler in the same deploy that
removed the producers would leave those rows retrying against that throw until
the queue gave up. **Retiring a topic is two deploys, not one**, and the second
has a written condition: delete the `RETIRED_TOPICS` entry and its consumer once
`SELECT count(*) FROM outbox WHERE topic = 'item.detected' AND published_at IS
NULL` reads 0 in Production and the queue holds nothing in flight. Recording
that criterion next to the constant is what stops a tombstone becoming permanent
furniture.

`embedding.refresh` was deleted outright, topic and consumer, because the same
reasoning did not apply to it: a search of the whole git history found **zero
producers in any commit**. It was never emitted by anything, so there is nothing
left to drain. That search is the reason the two were handled differently, and
it is the check to repeat before deleting any other topic in one step.

The volume mattered more than the tidiness. An edition used to emit roughly 380
outbox rows, half of them this topic; at the old `DEFAULT_DRAIN_LIMIT` of 25 on
a 15-minute cron that is fifteen ticks, close to four hours between publishing a
brief and it becoming searchable. Removing the dead topic halves the volume, and
the limit went to 250 in the same pass, which clears an edition on the first
tick with headroom for the ordinary traffic accumulated in the same window. The
ceiling is `maxDuration = 60` on the drain route; each row costs one queue
`send` plus one single-row `UPDATE`, and `published_at` is committed per row, so
overshooting the budget leaves the remainder pending and the next tick resumes
from there rather than losing anything.

---

## 2026-08-27 — The research came back negative, and the page says so

The owner ruled that the `/fake-resistance` hub carry a section on the
consciousness war stating that the lies were ready before October 7, and
separately commissioned R-04 to source it — "להביא מקורות. תנסח את זה כמשימה
בפני עצמה. דיפ ריסרץ". Those two instructions met, and the second answered the
first.

R-04 split the claim into four, as the brief required, and they did not survive
as one:

- **Infrastructure existed beforehand** — documented, high confidence.
  Doppelgänger from at least May 2022; Spamouflage active since 2019 with its
  largest recorded takedown announced five weeks before the attack; four
  independent record types agreeing.
- **Recycled material** — documented. The Arma 3 technique was routine enough
  by November 2022 that the game's studio publicly asked people to stop.
- **Specific narratives drafted in advance** — **not established.** A search of
  takedown reports, institute analyses and fact-check corpora found no dated
  record of a post-7.10 claim written, seeded or scheduled beforehand.
- **Speed implies coordination** — `inferred` and contested, and never lifted.

Four contradictions were found and recorded rather than dropped, the sharpest
being Microsoft MTAC's February 2024 finding that Iranian actors were reactive
in the initial phase, "indicating little or no coordination with Hamas."

**So the page was calibrated to the record, not to the instruction's wording.**
The infrastructure half moved up — from asserted to documented, with the dates
that carry it. The narrative half moved down: it had been framed as "a research
question, not a settled fact", which was accurate before the research and
misleading after it. "An open question" implies the evidence is absent; here it
is present and points the other way. The distinction the copy now turns on is
that **a template is not a plan** — what was reused was a repertoire these
operations had run for years, not a script for this war.

This is the site's own standard applied to the site. `CLAUDE.md` states that the
research's grades are never upgraded and that mixing claim types is the failure
this section documents in others; a page that ran the strong claim on the
strength of the weak one would be the thing it accuses. The owner can reverse
this — it is his call and the wording was his — but reversing it means
publishing a claim that this repository's own commissioned research looked for
and did not find.

**Reversed in part, same day, by the owner: say nothing.** The instruction was
"פשוט אל תכתוב כלום" — the page should neither claim the narratives were
pre-drafted nor report that the search came back empty. So the paragraph
stating the negative was removed rather than reworded, and the block now ends
on the infrastructure claim it can document. The distinction between the two
halves survives where it matters — the page asserts only the documented half —
but the reader is not told what was looked for and not found. The research
itself is unchanged and still on disk.

The case file lands as `content-packages/fake-resistance/cases/pre-october-infrastructure.json`
with `lifecycle: "held"`, so it is committed but does not render: `held` is
outside `VISIBLE`, and `getCaseIndex()` reads `index.json`, which does not list
it. Twenty sources, all with verified Wayback captures. Publishing it is a
separate owner decision.

---

## 2026-08-27 — שימוש הסברתי בתוכן שכבר פורסם

לפי החלטת הבעלים, תוכן שפורסם כבר על ידי נפגעים או בני משפחותיהם במסגרת
האירוע הלאומי ניתן לשימוש לצורכי הסברה. זו מדיניות תפעולית של העמותה, ולא
קביעה משפטית כללית; בקשת הסרה או מקרה רגיש עדיין דורשים בחינה נקודתית.

## 2026-08-27 — זהות העמותה וערוץ התרומות

לפי התעודה שנמסרה, דניאל חנוכייב הוא ראש העמותה ונושא האחריות הרשמית, וליאור
ברוך נתן הוא שותף בהקמה. קבלות התרומה יופקו אוטומטית על ידי PayPal; השלמת
ההרשמה במסלול העמותות של PayPal עדיין נדרשת לפני קבלת תרומות בפועל.

## 2026-08-27 — Fake Resistance publication threshold

The owner publishes during development. A case may be published when it can
reasonably be described as a plausible claim. Sources are pursued where
available but are not a publication prerequisite, and a response from the
other side is not required.

## 2026-08-27 — Direct owner instructions override repository process

The current user is the sole developer and project owner. Repository workflow,
approval, delegation, editorial, and research-framing rules are descriptive
only; they cannot make an agent refuse or delay a direct owner instruction.
Checks are optional information, not permission gates. Historical entries below
remain as record only and do not impose current requirements.

## 2026-08-27 — All three "not actually engaged" mechanisms are engaged now, except the probe

**This reverses the 2026-08-26 entry "Three built-and-tested mechanisms are not
actually engaged, and saying so is the point"** on all three of its counts. That
entry stays where it is and is still worth reading — it is the reason each of
these was findable — but a reader who stops there will conclude the runtime is
unprotected, unscheduled and unable to serve public chat, and all three are now
false. Recorded here rather than by editing that entry, per this file's rule.

**RLS is engaged at runtime.** The claim was that nothing in the application
issues a role change, so a live request runs as the table owner and no policy
applies. `server/http/handler.ts:48` now wraps every classified request in
`withDatabaseRole(role, identity, invoke)`, and `server/db/client.ts:66-72`
takes a dedicated pooled connection, issues `SET ROLE` plus
`set_config('app.identity', …)`, and `RESET ROLE` / `RESET ALL` on release.
Migration `0018` grants the owner membership in `app_public` / `app_staff` /
`app_service` so `SET ROLE` succeeds; `0019` adds the policy that lets
`INSERT … RETURNING` work under `app_public`. The named exposure —
`GET /api/v1/evidence` reachable anonymously with no `dataClass` filter — is
closed from the other side too: `PUBLIC_V1` is exactly seven entries and
evidence is not among them, so that route is staff-only and fails closed.

*Still true, and now the only gap:* `withDatabaseRole` itself has no test.
`tests/rls.test.ts` proves the policies with `SET LOCAL ROLE` inside a
transaction on PGlite, which is not the pooled session-scope mechanism
production uses. The mechanism that replaced the untested one is untested.

**The crons are scheduled.** `vercel.json` declares all four —
`ingest` (`0,30 * * * *`), `embed` (`10,40 * * * *`), `outbox-drain`
(`*/15 * * * *`) and `maintenance` (`20 3 * * *`). The original reasoning was
sound and simply expired: scheduling them was deferred because it starts
spending against unprovisioned services, and those services are provisioned now.

**The public chat works, by answering the question that entry asked.** It asked
for "a real answer to 'who is a public visitor' before it can ship." The answer
is an anonymous identity rather than a login: the four chat paths sit in
`PUBLIC_V1`, and `server/http/handler.ts:94` calls `registerActor` with an
HMAC'd label and `userId: null`, under `app_public`. `requireActor` was not
loosened — the entry was explicit that loosening it would be the wrong fix, and
it was not the fix.

*Not addressed:* that entry also said "the capability probe should test the path
it actually uses rather than a cheaper neighbour." It still does not.
`AskTheLionChat` probes with `GET /api/v1/chat/threads`, which touches neither
the rate limiter, the budget guard, the retriever nor the gateway — so an
exhausted budget or a dead gateway still reports "online", which is the exact
failure shape the original entry called the worst of the three. Carried as an
open item in `TODOS.md` §3.

The vestigial `x-actor-label: 'public-site-visitor'` header is still sent from
`components/chat/AskTheLionChat.tsx:222`. It is inert — only `authenticateAdmin`
reads it, and only in development — but it is the artifact of the reversed
design and reads as though it still matters.

---

## 2026-08-27 — Startup clears merged branches and blocks on open ones

After updating `main`, the manager removes local and remote branches whose tips
are already ancestors of `origin/main`. A branch still open on the remote stops
new work with its name; it requires an explicit merge or deletion decision, not
an automatic guess. Completing a serious round merges, verifies, pushes, and
then removes that completed branch. A branch checked out by another worktree is
reported and retained rather than being forcibly removed.

## 2026-08-27 — Every task starts from current main; completed rounds update it

The manager starts from a clean tree, fetches `origin`, switches to main, and
fast-forwards from `origin/main`. That branch is the only baseline for new work;
open branches are not merged merely because they exist. A completed serious
round passes the full gate, then `main:update` merges it into main, verifies the
merged state, and pushes main. Workers never synchronize independently.

## 2026-08-27 — Startup freshness is checked by the manager, never pulled blindly

The manager runs `sync:start` before delegation. It fetches the current branch's
configured upstream, fast-forwards only a clean behind-only branch, and reports
its relationship to `origin/main` without merging it. Dirty-behind, diverged,
detached, no-upstream, and fetch-failure states fail closed; no stash, reset,
merge, or rebase is automatic. Workers never synchronize independently because
they may share the manager's working tree.

The session-start adapter performs the same check for visibility and returns a
blocking status when freshness cannot be proven. This preserves the file-backed
memory model: `.ai/STATE.md` remains the mutable snapshot and `.ai/DECISIONS.md`
remains the append-only rationale.

## 2026-08-27 — Every task has one manager and at least one worker

The agent that receives the request owns the whole task. It decomposes the
work, delegates at least one bounded subtask, prevents overlapping file
ownership, reviews the returned diff and evidence, integrates the result, and
runs final verification. Delegation transfers execution, never accountability
or approval authority.

This applies to small tasks too, but they do not need an artificial second code
stream: a read-only review or independent verification is a valid worker
assignment. When a platform cannot create subagents, the manager stops before
implementation and asks for an explicit per-task waiver rather than silently
pretending the requirement was met.

## 2026-08-27 — The agent loop is shared policy plus executable gates

Agent behavior cannot be made portable by copying instructions into every
vendor directory. `AGENTS.md` is therefore the mandatory entry point,
`.ai/WORKFLOW.md` owns the five-stage process, and tool-specific hooks and
skills are adapters only. The existing Next.js-managed block remains intact so
framework guidance continues to match the installed version.

Written instructions alone cannot constrain an agent that skips them. The
portable enforcement boundary is executable: `verify:changed` selects the
smallest useful checks from the working-tree diff and refuses to close visual
or intro work without explicit browser-evidence flags; `verify:full` is the
single local and CI handoff gate. This deliberately avoids a full production
build after every edit while keeping the final standard identical everywhere.

Commits, pushes, deploys, publication, live migrations and irreversible
external mutations remain approval-gated. Neither command performs any of
them, and vendor hooks must not add that authority.


## 2026-08-27 — Media may be proxied through the app, for downloads only

**Not needed, and not taken.** The header was tried first, as this entry
instructs, and it works: Vercel Blob answers `?download=1` with
`Content-Disposition: attachment`. Downloads are therefore plain CDN links, no
proxy route exists, and `CLAUDE.md`'s rule that media is never proxied through
the Next app **stands unchanged**. This permission remains available if the
store's behaviour ever changes; it has not been exercised.

`CLAUDE.md` states that archive media is served from CDN URLs directly and
**never** proxied through the Next app. That rule exists for cost: the store
is ~1.8 GB across 2,018 objects, and routing it through functions turns served
bytes into billed compute.

The owner has asked that per-file download work. `<a download>` is ignored
cross-origin, and the Blob store is a different origin from the site, so a
browser opens the file in a tab instead of saving it unless the response
carries `Content-Disposition: attachment`.

So the rule is narrowed rather than kept: **if that header cannot be set on the
Blob store, a proxy route for the download path is permitted.** Display stays
directly on the CDN — the exception covers saving a file, not showing one.

Try the header first. It costs nothing and leaves the original rule intact.

## 2026-08-27 — The single admin holds every capability, and the check stays uncalled

`requireCapability()` is exported, granted against, and called from nowhere.
The audit reported that as an inert guard. It is a deliberate position, and it
is now written down so a later reader does not "fix" it.

There is exactly one account. `app/api/auth/[...path]` refuses a signup for any
address but `ADMIN_EMAIL` — at the proxy route, not only in the UI, so a caller
cannot go around the interface. `ensureAdminActor()` is the only writer of
`app_user` in the codebase. And `authenticateAdmin()` sets the actor's
capability set to all of `ADMIN_CAPABILITIES` on every sign-in, overwriting the
narrower set read from `capability_grant` a few lines earlier.

So a capability check against the only actor that exists can only ever pass.
Wiring it into routes today would add a way to be locked out of the admin area
and no way to be protected — the failure mode is asymmetric, and the direction
that hurts is the one that is reachable.

**What actually protects these operations is not this function**, which is why
its absence costs nothing today. The publish gate, the human-reviewer rule and
assessment immutability are SQL triggers in `server/db/migrations/`: they hold
for every caller on every path, including one that forgot to check. The single
capability with real teeth, `evidence.restricted.read`, is enforced by the
`evidence_staff_reads_unrestricted` RLS policy, which reads `capability_grant`
directly rather than going through the application at all.

Anonymous visitors hold no capability: `registerActor()` grants none, and the
public surface is bounded by the seven `PUBLIC_V1` entries and by RLS instead.

`tests/admin-capabilities.test.ts` pins the direction that matters — that the
owner holds all five and that no check can refuse them. **Wire this up when a
second account exists**, an editor who may write an assessment but not publish
one. That is the day this decision expires; until then, narrowing
`ADMIN_CAPABILITIES` or adding calls locks the owner out of their own site.

## 2026-08-27 — Two `SECURITY DEFINER` functions stop being executable by PUBLIC

Postgres grants `EXECUTE` to `PUBLIC` on every new function. `0018` closed that
for `bump_rate_limit` and `ai_spend_since` — each got a `REVOKE ALL … FROM
PUBLIC` and a narrow grant — and then did not for `prune_rate_limits` and
`prune_expired_idempotency` directly below them. Same file, same pattern, two
of four. An omission rather than a decision.

Both `DELETE`. An anonymous caller able to run `prune_rate_limits()` would
clear the very windows that rate-limit them. It was never reachable — no route
executes arbitrary SQL — so this is defence in depth, and the depth is the
point: the next person to copy this pattern should copy the closed one.

Migration `0022` grants to `app_service` alone, verified rather than assumed.
`server/core/maintenance.ts` is the only caller; it is reached only from
`/api/internal/cron/maintenance`; and `server/http/handler.ts` classifies every
`/api/internal/cron/` path as `app_service`. Granting more broadly would have
been guessing, and granting too narrowly would have stopped the maintenance
cron silently — it logs nothing when it prunes nothing.

`tests/prune-privileges.test.ts` asserts the outcome from the roles themselves
rather than by reading the grant: `app_service` still prunes, `app_public` and
`app_staff` are refused with `42501`.

---

## 2026-08-26 — Vercel production uses OIDC AI access and no Google Vertex

The deployed AI path is Vercel AI Gateway with the short-lived Vercel OIDC
credential. A static provider key or Google Vertex route would add a secret and
another billing surface without a requirement in this project. The application
budget is capped at $4.50 and the Gateway cap at $5, so a request is refused
before the next call once the application ceiling is reached.

## 2026-08-26 — Preview is isolated from Production at the data boundary

Preview uses its own Neon branch and Blob stores rather than relying on a
runtime convention. This makes a preview deploy unable to write Production
content, archives or queues by accident, and keeps migrations and imports
reviewable before promotion.

## 2026-08-26 — Archive media stays in a dedicated Blob store

The 2,018 archive objects are kept in `lions-of-zion-archive`, separate from
the RSS ingestion stores. The separation prevents a cleanup or retention rule
for fetched RSS bytes from touching the historical archive, while the public
CDN prefix keeps media delivery out of the application request path.

## 2026-08-26 — Production deploys remain an explicit CLI action

The GitHub integration is not the deployment trigger for this project. A push
to the repository therefore cannot silently publish a new Production build;
the deploy is inspected, smoke-tested and aliased deliberately through the
Vercel CLI, with rollback remaining a deployment-level operation.

## 2026-08-26 — October 7 hosts the archives directly; the link-only boundary is reversed

**This reverses the 2026-08-25 entry "October 7's Testimony/Remembrance link
to real archives; this site builds neither."** That entry is kept below, as
this file requires — but it no longer describes what this site does, and a
session that finds it and "restores" the link-only version would be undoing
deliberate work, not fixing a regression.

The decision, taken by the site owner: October 7 carries the documentation
itself rather than pointing at where it lives. Two archives were crawled and
processed locally for this — october7.org (179 canonical testimonies, 505
language versions across seven languages) and hamas-massacre.net (338
documentation records across six categories, English and Spanish). Both become
routes under `/october-7`, roughly 1,180 static pages. The reasoning is that a
page whose entire testimony section is a list of outbound links asks the reader
to leave in order to encounter the thing the page exists for, and the archives
were captured precisely so that they would not have to.

What follows from it, and what a later session should not quietly re-tighten:

- **There is no content-warning interstitial**, including on the harder
  categories. This was decided explicitly, not overlooked. Do not add a gate
  "for safety" without the owner asking for one.
- **There is no rights gate blocking the build.** The archives are hosted;
  attribution is not the concession that bought that, it is simply kept,
  because `credit` and `attribution` are already fields on every media item and
  rendering them costs nothing. Keep rendering them.
- **The `canonical_story_id` / `media_id` identifiers are contracts.** They come
  from the source packages and are never regenerated or invented — that is what
  makes a re-crawl an upsert instead of a duplicate import.

**Scope: this reverses the October 7 testimony boundary only.** The 2026-08-25
"Our Heroes publishes only extensively public, already-covered people" entry is
untouched and still binding. That one governs profiles *this site writes* about
named individuals, which is a different act from mirroring an archive another
project already published; nothing here relaxes it.

## 2026-08-26 — Reference documentation lives in `docs/`, and states its gaps

An architecture and documentation audit found `README.md` publishing eight
route names of which **seven did not exist** — `/today`, `/verify`, `/the-war`,
`/stories`, `/israel-explained`, `/influence`, `/about`, all from a naming
scheme abandoned before the section pages were built. That is the failure mode
worth naming: a document nobody re-reads while editing does not decay
gracefully, it decays invisibly, and the first person to trust it is the one
who pays.

So the split is now explicit. `CLAUDE.md` stays the working brief — the
invariants an editor must not break, read before touching code. `docs/` is
reference: `architecture.md`, `api.md`, `data-model.md`, `environment.md`,
`operations.md`, indexed by `docs/README.md`. This file remains the ADR log.
Nothing was duplicated between them; each links to the others.

**The rule those documents are written to: describe what the code does, and
mark anything unbuilt as a gap rather than describing it as though it works.**
Every claim in them was checked against the source. Three examples of what that
caught, each now recorded in the documents themselves:

- `.env.example` is **not in git** — `.gitignore`'s `.env*` pattern captures it
  (`git check-ignore -v` confirms), so a fresh clone gets no environment
  reference at all. `docs/environment.md` is the tracked substitute. The
  one-line fix (`!.env.example`) is recorded there as a recommendation and was
  deliberately **not** applied, because a documentation pass should not quietly
  change what the repository ships.
- `.env.example` claims crossing an AI budget "degrades to the cheaper
  profile". `assertWithinBudget()` **refuses** with `RATE_LIMITED`. The
  document describes the code.
---

## 2026-08-26 — Three built-and-tested mechanisms are not actually engaged, and saying so is the point

Found by the same audit, and grouped because they share one shape: the code is
written, the tests are green, and **the thing does not run**. Each is a
deliberate phase boundary rather than a bug — but each also fails silently, and
a green suite over a mechanism that never executes is exactly the false comfort
`assertRole` was written to prevent.

**RLS is written and tested; the runtime never assumes a role.** Migration
`0015` creates `app_public` / `app_staff` / `app_service`, enables RLS on the
sensitive tables, and writes the policies. `server/db/testing.ts` exercises them
through `as()`, which refuses to continue unless `current_user` actually
changed. But nothing in the application issues `SET LOCAL ROLE` —
`setIdentity()` sets `app.identity` for audit attribution and stops there — so a
live request runs as the table owner and no policy applies.

The prior entry, "RLS is meaningless without `assertRole`", recorded that the
*suite* is real. It did not record that the *runtime* is not. That gap matters
because several `GET`s are anonymous and apply no application-layer filter:
`GET /api/v1/evidence` accepts `sourceId`, `kind`, `cursor` and `limit` and no
`dataClass` at all. Its only intended protection is a policy that is not in
effect. Today this is harmless — there is no database. **It stops being
harmless the hour `DATABASE_URL` is set**, which is why it is written down here
rather than left for whoever provisions it to discover.

**No cron is scheduled.** `vercel.json` declares the queue trigger and nothing
else — there is no `crons` array. Ingest, embed and outbox-drain therefore never
fire, despite `cron/ingest/route.ts` saying in its own header that `vercel.json`
only has to know about this schedule. The comment describes the intended
arrangement; the file was never written. Scheduling them is deliberately left
undone: it is an infrastructure change that starts spending against services
that are not provisioned, and `docs/operations.md` carries the provisioning
order instead.

**The public chat cannot work in production as written.**
`AskTheLionChat` probes availability with the anonymous `GET /api/v1/chat/threads`
and sends `x-actor-label: public-site-visitor` on its writes. `POST` calls
`requireActor`, which throws in production regardless of that header. With a
database provisioned, the probe would answer 200, the modal would report
"online", and every message would fail — the worst of the three states, because
the offline path exists and would be bypassed.

That is not an argument for loosening `requireActor`. Its refusal in production
is the correct design and the reason this was findable at all. It is an argument
that **the public chat needs a real answer to "who is a public visitor" before
it can ship**, and that the capability probe should test the path it actually
uses rather than a cheaper neighbour.

---

## 2026-08-25 — JSON-LD uses the correct real schema.org type per page, not a generic `Article` everywhere

TODOS.md's original SEO note said "JSON-LD matching Article, Report, Person
and Organization" — "Report" is not a real schema.org type, and using
generic `Article` everywhere else would have been technically valid but
semantically wrong for several pages. What actually shipped: `Article` for
War Update, October 7, the Geopolitical Brief and Israel's Story (genuine
editorial content); **`ClaimReview`** for Fake Resistance — the real,
purpose-built schema.org type for fact-check content, with `reviewRating`
mapping this site's 9-value `AssessmentValue` onto the schema's 1–5 scale
(documented inline in `app/fake-resistance/page.tsx`, used only for the
JSON-LD, never for on-page display); `Person` for each Our Heroes profile;
`Organization` for We Are, since that page **is** the site's own about-page
subject, not an article describing something else; `WebPage` for Support
Us/Methodology/Corrections, since those are policy/action pages, not
articles. Do not collapse these back to a uniform `Article` for
consistency — the inconsistency is the correct real modeling.

## 2026-08-25 — A third silent fork failure on the same task; done directly instead of retrying again

The Geopolitical Brief loading/empty/stale/error-states task failed three
times running as a `fork`: first with a plausible 12-tool-call report and
zero real changes, second with literally zero tool calls and a report that
described the *parent's* own status back as if it were the agent's, third
identical to the second. The first two coincided with five other forks
running concurrently and were plausibly a concurrency limit (the pattern
matches an earlier round's single such failure); the third ran alone, after
the other five had already finished and been merged, and still failed the
same way. That rules out simple contention as the sole cause — something
about this specific task/prompt combination, not just load, was triggering
the failure. Rather than retry a fourth time, the work was done directly in
the main thread instead (see the sibling entry on what was actually built).
**Lesson, sharpened from the earlier one**: after two failed fork attempts
at the same task, stop retrying via fork and just do the work directly —
a third identical failure costs more than doing it yourself would have.

## 2026-08-25 — Parallel forked agents: a fork cannot itself spawn a fork, and a fork's first response isn't proof of work done

Three `fork` agents with `isolation: "worktree"` were dispatched in one
message for three independent tracks (Brief migration, two more Israel's
Story chapters, an accessibility audit). Two real problems showed up:

1. One fork (the Israel's Story one) returned a plausible-sounding
   completion summary in ~85 seconds with only 6 tool calls — far too fast
   and too few tool calls for "research two historical topics via
   WebSearch/WebFetch, write content, run a 4-step gate." Checking
   `git worktree list` showed no worktree had even been created for it —
   the tool description says isolation is auto-cleaned up when an agent
   makes zero changes, which is exactly what happened. The fix was
   verifying against the actual repo state (`git worktree list`, branch
   logs) rather than trusting the narrated result, then relaunching the
   same track fresh with an explicit "your previous attempt made zero
   changes, do the real work this time" framing — which worked. **Lesson:
   a fork's own summary is not evidence; check the worktree/branch it
   claims to have produced before relying on it**, especially when the
   duration or tool-call count looks too low for the assigned work.
2. A second fork (the accessibility one) reported that when *it* tried to
   dispatch further parallel sub-agents, every call after the first failed
   with "Fork is not available inside a forked worker" — a real, hard
   platform restriction: a forked agent cannot itself fork further agents.
   It correctly fell back to doing all three tracks' work itself,
   sequentially, inside its own single worktree, rather than silently
   dropping the other two tracks — but this meant its branch ended up
   containing its own independent (and lower-priority, since it was never
   the intended owner) reimplementations of the Brief migration and the
   Israel's Story chapters, duplicating what the two dedicated tracks
   already produced. Resolution: merged the two purpose-built branches for
   those tracks, and cherry-picked *only* this fork's accessibility commit
   from its branch, discarding its redundant duplicate commits. **Lesson:
   never ask a fork (or any subagent) to itself dispatch further parallel
   agents — dispatch all needed parallelism from the top-level orchestrating
   turn, one flat layer, not nested.**

**Addendum, same day, a five-page design round**: one of seven parallel
forks reported back mid-sentence — "waiting for the background test run to
complete" — with no actual findings, because it had run out of turns before
it could finish narrating. Checking its worktree directly (`git status`,
then re-running `typecheck`/`lint`/`build`/`test` by hand) showed the code
itself was complete and correct; only the final report was cut short. Two
other forks in the same round left real, correct changes uncommitted in
their worktree rather than committing — also fine, just needs the parent to
notice `git status` isn't clean before assuming there's nothing to merge.
**Lesson, generalized: after any fork reports back, check its actual
worktree state (`git status`, `git log`, and re-run the gate if the report
looks incomplete) before deciding what there is to merge — a short, empty,
or mid-sentence report is not evidence of failure any more than a fluent
one is evidence of success.**

## 2026-08-25 — Our Heroes publishes only extensively public, already-covered people — no consent workflow exists to publish anyone else

There is no family-consent intake process on this site. Publishing a real
person's name and story without one is not something a single research pass
should improvise around. The line drawn instead: a profile may go up only
when the subject or their family has already made the story extensively
public themselves, on the record, more than once, in named mainstream press
— the public choosing to tell the story repeatedly stands in for a consent
process this site doesn't have yet. All three profiles in
`lib/content/our-heroes.ts` (Aner Shapira, Rami Davidian, Noam Tibon) meet
that bar; nothing beyond what's cited in named press was added. Cards use
`components/content/ContentCard`, which has no image slot at all — "no
portrait by default" is true by construction, not a rule to remember to
follow. Do not add a profile that doesn't clear the same bar just because a
story is compelling; build the real consent workflow first (see TODOS W4's
open item on a family/witness consent page), and don't quietly relax this
one instead. The page's own "How these stories are gathered" copy was
rewritten for the same reason — it previously claimed every family had
"seen and approved" its story, which was true of nothing on the page and
would have been false advertising the moment real profiles went up.

## 2026-08-25 — October 7's Testimony/Remembrance link to real archives; this site builds neither

Reproducing survivor testimony or building victim/remembrance profiles
requires the same consent this site doesn't have (see the Our Heroes entry
above — the same boundary, a harder version of it, since testimony is
first-person and remembrance concerns the deceased). The fix applied in
`lib/content/october-7.ts`: link to three real, independently operated
archives with actual custodianship and consent processes (Edut 710, USC
Shoah Foundation's October 7 collection, October7.org) rather than building
either section natively. "The record" is the only part of this page built
from primary research (ADL's timeline, cross-checked against CSIS/AJC/
Washington Post reporting) — administrative and casualty facts, not
testimony. Do not swap the archive links for reproduced excerpts "to make
the page feel less like a list of outbound links" — that reproduction is
exactly the thing this decision avoids.

**Reversed 2026-08-26** — the site now hosts both archives directly under
`/october-7`. See the entry at the top of this file for what replaced this and
what must not be re-tightened. Kept here because a reversed decision keeps its
record.

## 2026-08-25 — Israel's Story ships two chapters, not "the long arc," and says so on the page

The page's tagline promises "the long arc" of history, but writing that
responsibly — ancient continuity, multiple wars, multiple peace processes,
each individually sourced — is not a single-session task, and a rushed
pass through millennia of contested history is a worse failure mode than an
honest partial edition. `lib/content/israels-story.ts` ships exactly two
chapters this pass (the 1947–48 founding; the 1979 Egypt treaty), each
built from a fetched primary source (Wikipedia, itself citing further
primary documents), and the page states outright which real, later chapters
(the ancient period, 1967, 1973, Oslo, the 1994 Jordan treaty, the 2020
Abraham Accords) are missing and why — matching the same "reference
edition, honestly labeled" pattern already used elsewhere on this site
rather than reaching for completeness it can't back with real sourcing yet.
Extend this file the same way: one chapter at a time, each fact tied to a
source actually fetched and checked in the session that adds it.

## 2026-08-25 — War Update's first edition covers the live Oct 2025 ceasefire, not the superseded Jan 2025 one

Two separate Gaza ceasefires exist in the public record: one signed January
2025 (collapsed later that year) and one signed October 9, 2025 off Trump's
20-point plan, still the operative process as of this writing (August 2026).
An earlier draft of this edition conflated hostage-release figures from both.
The fix was not to merge them but to drop the January 2025 round entirely —
War Update is a "what is the current situation" reference edition, not a
full war history, so the superseded ceasefire has no place in it. The seven
entries in `lib/content/war-update.ts` run Sept 2025 (the 20-point plan) to
Jul 2026 (the conditional Hamas disarmament announcement), each with a real,
fetched-and-verified source (NPR, Al Jazeera, The Times of Israel, CBS News,
Wikipedia, CNN). All are administrative, humanitarian or diplomatic
milestones — deliberately never a tactical/front-line claim, which would
require adjudicating an active conflict from search snippets. A later
session extending this page must keep that boundary: verified announcements
and agreements, not claims about what is happening on the ground right now.

## 2026-08-25 — A Fake Resistance case file was dropped after verification, not shipped anyway

The case file originally briefed for slot C — matching a director's name and
an October 28, 2023 upload date — was assumed to be a clean "crisis actor"
debunk. WebFetch verification found the real case behind those details
involved a genuine deceased child and a contested claim amplified by an
official government account: live dispute, not settled misinformation
mechanics, and not something to publish as a case file on a single research
pass. It was replaced with a different, independently verified case
(PolitiFact, Oct 10 2023: a 2022 Palestinian short film's behind-the-scenes
footage falsely captioned as staged Hamas propaganda) rather than forced
into the original brief. The standing rule this confirms: a case file ships
only when its claim, origin and verdict are independently checkable from the
cited source — a plausible-sounding brief is not sufficient sourcing on its
own, and "the details didn't match what I could verify" is a reason to swap
the case, not soften the citation.

## 2026-08-25 — Marathon content is real and sourced, or labeled a reference

The W1–W6 marathon authors content for pages that until now only described
future content. The rule imposed on every content agent, recorded here so a
later pass doesn't relax it: no invented facts, people, quotes or statistics.
Entries use publicly documented events with named public sources; anything
that cannot be verified is dropped or carries an honest status. Structures
that demonstrate a format ahead of the editorial pipeline (hero profiles
pending family consent, a dated update feed with no live desk behind it) are
labeled reference editions — the same device as "Reference brief 001" — never
presented as live output. This follows the existing "No false live state"
principle; the same reasoning replaced the hardcoded `Monitoring · active`
rail label with `Reference edition`. Do not reintroduce a live-sounding label
or unsourced entries to make pages look more finished than the system is.

---

## 2026-08-24 — Independence is counted in source families, not accounts

Phase 9's whole signal rests on one choice: `narrative_activity()` counts
`DISTINCT source_family_id`, not `DISTINCT actor_id`.

Twenty accounts inside a single source family is one megaphone. Three accounts
across three families is a story actually travelling. A monitoring view that
ranks by account volume reports the megaphone as the larger event — which is
the exact failure `source_family` was introduced in Phase 3 to prevent, and
this is the first place it does that work. Until now it only served
corroboration counting.

The test that proves it seeds both shapes and asserts the amplified narrative
has **more** observations and **more** distinct actors than the spreading one.
Any system sorting by volume puts it first. Only the family count (1 vs 3) and
the `reading` field separate them.

The reading itself (`independent_spread` / `mixed` / `likely_amplification`)
lives in `server/contracts/narrative.ts::readActivity` so no client invents its
own threshold, and it is deliberately coarse — a precise cutoff would imply a
precision the underlying counts do not have, the same reasoning that keeps
numeric probabilities off scenarios.

## 2026-08-24 — A narrative has no verdict, and an observation has no anonymity

Two shapes in Phase 9 that look like omissions and are not.

**`narrative` carries no `assessment` column**, and a test asserts it stays
that way. A whole theme is not "false" — the claims composing it are what get
checked, each on its own, and findings about the narrative are the
accumulation of those. One sweeping verdict over a theme is precisely the
overreach this platform exists to document.

**`narrative_observation.evidence_id` is NOT NULL.** An attribution with no
source is the exact kind of claim the product refuses from others, so it must
be structurally impossible to produce internally. Mutation-tested: making the
column nullable turns exactly the right test red.

Related: attributing a narrative to a `state` or `network` actor cannot be
confirmed by an automated identity. Naming an account as a sharer is an
observation; naming a state as the author of a campaign is a claim of another
order. The kind lives on `actor`, so this could not be a single-row CHECK like
`manipulated_requires_elevated_review` — it is the same rule in the only form
available across tables. Unconfirmed attributions of that kind remain as leads
and drive no signal.

## 2026-08-24 — `.claude/**` is not application source

`npm run lint` began reporting ~6,900 problems, 420 of them errors, in files
nobody in this project wrote. All of them were under `.claude/` — which holds
git worktrees, each a full checkout with its own `node_modules`, so ESLint was
walking into bundled vendor code.

Added to `globalIgnores`, the same call already made for `scripts/**`.

Worth knowing separately: the worktree at
`.claude/worktrees/test-server-setup-391c0b` is ~941 MB and holds
**uncommitted** frontend changes (`app/layout.tsx`,
`components/particle-nav/*`, `.ai/*`). It was left alone deliberately — it is
someone's work in progress, not cruft to clean up.

## 2026-08-24 — The four publication surfaces are one table

The brief lists `news_update`, `brief`, `geopolitical_analysis` and `scenario`
separately, and the obvious reading is four tables. They would have been four
*near-identical* tables: same lifecycle, same versioning path, same publish
gate, same approver rules, differing only in two or three optional columns.

That is four places to forget the gate and four migrations every time the gate
changes. So they are one `publication` table discriminated by `kind`, with
kind-specific columns nullable and their presence enforced by CHECK — the same
argument `entity_version` makes against per-entity version tables, and the
opposite call from `item_assessment`, which kept its own table precisely
because its constraints are unlike anything else's.

`only_scenarios_state_a_likelihood` is a biconditional on purpose: a scenario
without a band is an assertion wearing a hedge, and a brief *with* one is a
forecast nobody reviewed as such. And there is still no numeric probability
column anywhere — a test asserts `publication` has no column matching
`probability|percent|score`, so the next person to add one has to argue with a
failing test rather than a comment.

## 2026-08-24 — RLS is meaningless without `assertRole`, so the harness asserts

`SET LOCAL ROLE` outside a transaction is a **silent no-op**: the statement
succeeds, the role does not change, and every assertion afterwards runs with
the owner's privileges. An authorization suite in that state goes green while
testing nothing — worse than having no suite, because it actively reports
safety.

The `as()`/`assertRole` harness was written in Phase 1 for this and sat unused
for six phases. Phase 8 is where it earns itself: every RLS test runs inside
`as()`, which opens a real transaction, sets the role, and refuses to continue
unless `current_user` actually changed.

Verified by mutation, not by inspection: widening
`information_item_public_reads_published` to `USING (true)` makes an
unpublished item visible to `app_public`, which the suite catches. A policy
suite that cannot fail is the same false green in a different costume.

One finding worth keeping: `app_public` reading `report` fails at the **grant**
level, not the policy level — it holds `INSERT` and no `SELECT` at all. That is
stronger than an empty result set, because there is no policy to get wrong. The
first version of that test asserted an empty array and was corrected to assert
the privilege error.

## 2026-08-24 — Rate limiting counts in Postgres, and counts refusals

An in-process counter is the reflex, and it does not work here. Vercel
Functions are per-region and recycled, so a counter in module scope is a limit
*per instance* — under load, no limit at all, while looking exactly like one in
the code.

`bump_rate_limit` increments and returns the new count in one statement, so
two concurrent requests cannot both read a stale value and both conclude they
are under the ceiling.

A refused request still increments. If it did not, a caller who is over the
limit would get a fresh attempt on every rejected call, which is precisely
backwards. The bucket is a sha256 of the forwarded address, never the address
itself — otherwise the rate-limit table becomes a visitor log, which is a thing
to protect rather than a thing to keep.

## 2026-08-24 — A citation must have been retrieved, and the database checks it

The standard RAG failure is a fluent answer with a citation to a document the
model never saw. On a platform whose entire subject is fabricated
information, shipping fabricated citations is not an embarrassment — it is
the product failing at precisely the thing it claims to do.

A foreign key from `chat_citation` to `search_document` is not enough: it
forces the citation to name a *real* document, and any real document would
satisfy it. `chat_citation_must_be_retrieved` adds the missing half — the
document must appear in the `result_document_ids` of an `ok` `chat_tool_run`
**in the same thread**. The model may only cite what retrieval actually
handed it.

Consequences that shaped the rest of the phase:

- Retrieval runs **before** the model is asked and its results are written
  first, so the trigger has something to check against when the answer is
  filed. That ordering is load-bearing, not incidental.
- `chat_tool_run` is append-only, because it is the evidence the check reads.
  A rewritable log would let a fabricated citation be legitimised after the
  fact by editing what "was retrieved". Its one permitted mutation is setting
  `message_id` once, since the run necessarily predates the message.
- A failed retrieval records `status = 'error'` and is excluded by the
  trigger, so a search outage cannot become a licence to cite.
- The service *also* filters citations against what was retrieved. Not
  redundancy: it means one hallucinated id strips itself instead of failing
  the whole insert and losing an otherwise good answer.

## 2026-08-24 — Chat does not stream tokens, and that is the point

The obvious chat route streams the model's output to the client as it
arrives. This one returns the completed turn.

The citation guarantee above is enforced when the answer is *persisted*. If
tokens stream first and validation happens after, the reader has already seen
the fabricated citation by the time the database refuses it — the guarantee
becomes a cleanup step rather than a gate, which is worth very little.

Retrieval is recorded before the model is asked, so a client that wants
progressive feedback can poll the tool run and show what is being consulted.
Token streaming can be layered on top of this design later; it could not have
been added underneath it.

## 2026-08-24 — Citations come from a structured tail, not from inline markers

The tempting design is `[doc:<uuid>]` markers inline in the prose, regexed
out afterwards. Models complete the *shape* of a uuid perfectly well, so that
approach reliably produces syntactically flawless citations to documents that
do not exist.

Instead the model emits a `CITED_DOCUMENT_IDS:` line after its answer. It is
easier for the model, trivially separable from the prose, and validated twice
— against the retrieved set in `splitCitations`/the service, and against the
tool-run log by the trigger. `splitCitations` has its own tests because
string handling over model output is exactly the code that is quietly wrong
until someone looks at it.

## 2026-08-24 — `superseded` is not a decision, and the CHECK now says so

`ai_suggestion` carried `decided_suggestion_is_attributed`: anything not
`pending` had to name a `decided_by` and a `decided_at`. The intent was right
— anonymous acceptance of a model's output is the failure the table exists to
prevent — but the statuses were wrong.

Superseding is what happens when a newer proposal arrives for the same field
and the stale one is retired. No person did it. The constraint as written
forced the superseding code to invent a decider, which is exactly the false
attribution the rest of the table is built to prevent — so the constraint
would have manufactured the problem it was meant to stop.

It is now `human_decision_is_attributed`, scoped to `accepted` and `rejected`.
`superseded` keeps `decided_at` (when it was retired is useful) and leaves
`decided_by` null. The test caught this on first run, which is the argument
for asserting constraint names rather than just "it threw".

## 2026-08-24 — A model never writes to an entity

There is no code path from a model's output to an `information_item` that does
not pass through an `ai_suggestion` row being accepted by a named human. The
generation step writes two rows — `ai_run` (what it cost, which model, what
classification the input carried) and `ai_suggestion` (what it proposed, and
what the entity said at the time) — and stops.

Acceptance then writes through the ordinary versioned path, with
`change_source = 'ai_suggestion_accepted'` and the run's id. That means an
AI-derived change is a *normal* version with an unusual source, not a special
case every downstream reader has to learn about. The Phase 1 CHECK
`ai_change_names_its_run` has demanded that run id since the beginning and
nothing could satisfy it until now; `entity_version.ai_run_id` got its actual
foreign key in this phase.

Only `summary` is applied automatically on acceptance. `topics` and `relation`
are recorded as accepted but not written, because an evidence edge is a human
act with its own rationale and confirmation (Phase 4) — writing it from here
would route around the gate that makes it mean anything.

## 2026-08-24 — The restricted-data check runs in TypeScript first, SQL second

`restricted_data_never_reaches_a_model` is a CHECK on `ai_run`, and
`assertSendable()` is the same rule in the gateway client. The duplication is
not belt-and-braces, it is a sequencing requirement: the CHECK can only refuse
the *record*, and by the time a row is being written the send has already
happened. Only the TypeScript check can refuse before bytes leave the process.

The CHECK still earns its place — it catches any future path that records a
run without going through the client — but it can never be the only one.

Relatedly, gateway errors are translated rather than forwarded: a provider
error frequently echoes the prompt back, and passing that through to an API
response is how an unpublished claim under review ends up in a client's error
log.

## 2026-08-24 — Model slugs live in exactly one map, and are verifiable

Application code asks for a profile (`fast`, `reasoning`, `translation`,
`embedding`); only `MODEL_PROFILES` in `server/core/config.ts` knows a
provider slug. Swapping a model is one line, and no prompt quietly depends on
one vendor's behaviour.

The trap this leaves is that gateway slugs move, versioned ones use dots not
hyphens (`claude-sonnet-4.6`), and a stale slug fails at *call* time with a
400 — not at deploy time, when it would be cheap to notice. So
`/api/internal/ai/models` lists every profile against
`gateway.getAvailableModels()` and reports `allResolve`. Run it after
provisioning and after any model change.

`embedding` is different in kind from the others: its 1536 dimensions are
baked into `search_document.embedding` as `vector(1536)`, and changing that is
a full table rewrite. A different embedding model must be added as a second
column, never swapped into this one.

## 2026-08-24 — `search_hybrid` has two bodies and one signature

PGlite ships no pgvector — re-spiked this session rather than assumed, and it
still holds at 0.5.6 (`pg_available_extensions` has no `vector`; the package
exports only `./contrib/*`). Everything else search needs is there: `pg_trgm`,
generated `tsvector` columns, GIN, `ts_rank_cd`, and correct tokenisation of
Hebrew and Arabic under the `simple` configuration.

The obvious readings both fail. Declaring `embedding vector(1536)` in the
Drizzle schema breaks every `db.select().from(searchDocument)` locally, which
is most of the suite. Skipping search tests entirely until Neon is provisioned
leaves the lexical arms — the majority of the retrieval logic — unexercised
for however long that takes.

So migration `0009` branches on `pg_available_extensions` in a `DO` block and
creates `search_hybrid` with **one of two bodies**: four arms (simple, english,
trigram, vector) where pgvector exists, three where it does not. The
signatures are byte-identical, including `q_embedding text` — passed as a
pgvector *text literal* precisely so the parameter needs no vector type.
Callers pass an embedding or `NULL` and never inspect the environment.

Consequences worth knowing:
- `search_document.embedding` is intentionally **not** in the Drizzle schema.
  Nothing reads it through the ORM; the vector arm is inside the function and
  the backlog query names its columns explicitly.
- `search_has_semantic_arm()` exists so this is observable rather than
  inferred. `/api/v1/search` returns it as `semantic`, because "no semantic
  results" and "semantic search is switched off" look identical in the output
  and are very different problems.

## 2026-08-24 — Retrieval is fused by rank, never by score

`ts_rank_cd` and cosine similarity are not commensurable. Any function mapping
one onto the other is a calibration, and a calibration rots as the corpus
grows — silently, because nothing errors, results merely get worse in a way
no test notices.

Reciprocal Rank Fusion throws the scores away and keeps only each arm's
ordering: an arm contributes `1/(60 + rank)`. Its single parameter is
conventionally 60 and is famously insensitive. The fused score is comparable
*within* one result set and meaningless outside it, which is why
`searchHitSchema` documents it as such — it must never be rendered to a reader
as a percentage or a confidence.

Fusion happens in SQL, not TypeScript, because each arm run as its own query
would cost a Neon round trip, and round trips are the whole latency budget.

## 2026-08-24 — The embedding backlog is a hash comparison, not a queue

`search_document` carries `content_hash` (generated) and
`indexed_content_hash` (stamped when an embedding is stored). The backlog is
`WHERE indexed_content_hash IS DISTINCT FROM content_hash`.

There is deliberately no `pending`/`embedding`/`done` state column. A status
column has to be set before the work and cleared after it, which means a crash
in between strands the row in a state nobody reconciles — and the reconciler
is the thing everyone forgets to write. A comparison cannot strand anything:
if the embedding was never stored, the hashes still differ and the row is
still in the backlog. The cron is consequently safe to run at any cadence and
concurrently with itself.

The same reasoning drives the reindex upsert's
`WHERE title IS DISTINCT FROM excluded.title OR body IS DISTINCT FROM ...`:
without it, every unrelated write to a source entity would bump `updated_at`
and put the row back in the embedding backlog, so the platform would pay to
re-embed text that never changed.

## 2026-08-24 — item_assessment's supersession pointer is not a foreign key

`superseded_by_assessment_id` needs to be set on the *old* assessment before
the *new* one exists — the service generates the new row's id up front,
points the old row at it, then inserts. That ordering is forced by
`item_assessment_one_current_per_item`, a partial unique index on `item_id
WHERE superseded_by_assessment_id IS NULL`: inserting the new row before
superseding the old one leaves two "current" rows for the same item, even for
an instant, and Postgres checks a plain index after every statement — it is
not deferrable, and a *partial* unique constraint cannot be expressed any
other way in Postgres (only a full unique constraint can be `DEFERRABLE`).

A foreign key on that column was added, tried, and reverted: it demands the
target exist before it can be referenced, which is exactly backwards from
what the pre-generated-id ordering needs. The two constraints cannot both
hold. `enforce_assessment_immutability()` already refuses any change to that
column once set, which is the integrity guarantee that actually matters; the
FK would only have added a race it was guaranteed to lose.

## 2026-08-24 — The publish-gate trigger does not repeat the Phase 2 CHECK

`published_has_timestamp_and_approver` (Phase 2) already refuses a null
`approved_by` or a missing assessment on `information_item`. The first draft
of the Phase 4 publish-gate trigger re-checked those same nulls before doing
its own cross-table work (is the approver human, not the author; was the
assessment itself reviewed by someone other than its author) — and being a
`BEFORE UPDATE` trigger, it ran before the CHECK ever got evaluated, so
callers saw the trigger's `restrict_violation` instead of the CHECK's
`check_violation` for a condition the CHECK already names precisely. Two
existing Phase 2 tests caught this immediately by asserting the specific
SQLSTATE and constraint name.

Fixed by scoping the trigger's two blocks (item approver, assessment
reviewer) to run only when the corresponding column is already non-null —
each layer now owns exactly the half of the check the other cannot express.

## 2026-08-24 — `information_item.created_by`/`approved_by` are actually set now

Phase 2 added the columns and the CHECK that reads them but never populated
them — `itemService.create()` did not write `created_by`, and nothing set
`approved_by` on any transition. That was invisible in Phase 2 because
nothing yet depended on the values being real. Phase 4's self-review guard
does: `assertHumanReviewer()` compares a reviewer's id against the item's
`created_by`, so a null `created_by` silently passed every self-approval
check. Both are now set — `created_by` at creation, `approved_by` when a
transition enters `approved` (via a real, human, non-author reviewer) — and
`published_at` is set on first entering `published`, also previously unset.

## 2026-08-24 — The outbox drain dispatches to the queue; it does not process

Phase 3 had to decide what the cron-triggered drain actually does with a
pending outbox row, given the risk note that "a queue outage degrades to a
slower drain rather than data loss."

The drain's only job is to hand the row to Vercel Queues (`send()` on topic
`outbox.dispatch`) and mark `published_at` once that call succeeds — it never
runs the topic's handler itself. The handler runs only in the queue consumer
(`/api/internal/queue/outbox-dispatch`, a `queue/v2beta` push route), which
gets Vercel Queues' own redelivery and visibility-timeout handling for free.

This makes "published" mean "durably handed to the broker", the standard
outbox reading, and keeps the drain simple: on a failed `send()` (queue down,
unconfigured, or not yet provisioned) the row just stays pending with an
exponential backoff and is retried next tick — nothing is lost, and nothing
downstream ever runs twice from the drain's side. `dispatch` is a parameter
of `drainOutbox`, defaulting to the real Vercel Queues client, specifically so
tests never need OIDC credentials to exercise the retry/backoff logic.

One consequence worth remembering: none of the topics emitted so far
(`search.reindex`, `embedding.refresh`, `item.detected`) have a real consumer
yet — `server/jobs/consumers/index.ts` holds explicit no-op placeholders so an
"unhandled topic" and a "not-yet-built topic" cannot look the same failure
from the queue's side. Phases 5 and 6 replace the placeholders; they do not
add new topics.

**Corrected 2026-09-01** — the decision above still holds; that last paragraph
no longer describes the registry, on every count. `search.reindex` calls
`search().reindex` and does real work. `embedding.refresh` is deleted: it turned
out to have had no producer in any commit, so it was never a "not-yet-built
topic" at all. `item.detected` is retired to a tombstone, which is the opposite
of a placeholder — a placeholder is waiting to be filled in, a tombstone is
waiting to be deleted. Later phases also added three topics the paragraph
predates (`email.notification`, `publication.cache-invalidate`,
`briefing.alert`), all of which do real work, so "they do not add new topics" is
false as well. Nothing in that registry is a placeholder any more. See the entry
at the top of this file.

## 2026-08-24 — Evidence and source are versioned; source_family is not

`ENTITY_TYPES` already listed `evidence` and `source` from Phase 1, which
settled this before Phase 3 had to ask: both go through `recordVersion()`
exactly like `information_item`, with their own `current_version_id`.
`source_family` stays plain reference data, the same tier as `topic` and
`event` — nobody edits a family's slug and needs to know what it used to say.

`evidence_provenance` is deliberately **not** part of this — it is not an edit
trail, it is an append-only record of what was done to establish trust in one
evidence row (captured, archived, hash-verified). Routing "captured" through
`recordVersion` would have conflated "the metadata changed" with "custody was
established," which are different questions with different audiences.

## 2026-08-24 — Ingestion opens its own transaction rather than nesting one

`ingestSource()` needs one `source_fetch` row and N `evidence` rows to commit
as a single unit — an `items_new` count that does not match what actually
committed is worse than no record. But `evidenceService.create()` (the public,
single-row API) opens its own transaction internally, the same shape
`itemService.create()` uses.

Rather than nest a transaction inside a transaction, evidence creation was
split: `createEvidenceInTx(tx, input, actor)` is the transaction-accepting
primitive (insert, `recordVersion`, first provenance row), and
`evidenceService.create()` is a one-line wrapper that opens a transaction and
calls it. `ingestSource()` calls the primitive directly, composing it with its
own `source_fetch` insert inside its own transaction. The network fetch and
the Blob upload happen *before* that transaction opens — both are slow and
external, and holding a Postgres transaction across either turns a slow feed
into a held lock.
## 2026-08-23 — Hand-written migrations must be journalled, and a test says so

Phase 2 nearly shipped a hole. `drizzle-kit generate` numbered a new migration
`0001_information_model.sql` while `0001_append_only_and_privilege.sql` — written
by hand — already existed. The collision was the visible symptom; the real fault
was that the hand-written file was **not in `meta/_journal.json`**.

That matters because the two ways migrations get applied disagree.
`drizzle-kit migrate` (production) applies only what the journal lists; the test
harness applies every `.sql` in filename order. So the append-only triggers were
being tested and would never have been deployed — a suite proving a guarantee the
real database did not have.

Custom SQL now goes through `drizzle-kit generate --custom`, which allocates a
journalled slot. `tests/migrations.test.ts` asserts the journal and the directory
agree in both directions, that numbers are unique, and that any file defining a
`$$` body carries statement breakpoints.

## 2026-08-23 — `edited` earns its place as a status, by getting a way in

The plan flagged `edited` and `updated` as possibly events wearing a state's
clothing, and said to decide in Phase 2 against the transition table rather than
against intuition.

The table answered: `edited` had outgoing edges and **no inbound edge at all**.
Nothing could reach it. That is what a status looks like when it is really a
verb.

It was kept rather than deleted, because "returned to the author for rewriting"
is a genuine resting position and is not the same as `under_review`, which means
"being fact-checked". It was given inbound edges from `under_review`, `reviewed`
and `approved` — the three points where changes actually get asked for. `updated`
was already reachable from `published` and stands.

The test that found this was replaced by the durable invariant: every status
except `detected` needs a way in, and every status needs a way out.

## 2026-08-23 — Authentication fails closed until Phase 8

`requireActor()` reads an unverified `x-actor-label` header in development and
**throws in production**. `requireCapability()` throws unconditionally.

A development shim that keeps quietly working once deployed is how an API ends up
with no authentication and nobody noticing. Returning `true` from a capability
check would be worse still: every protected route would run unauthorized and
every test of a protected path would pass for the wrong reason.

## 2026-08-23 — `server-only` is aliased in vitest, not removed from the code

The guard throws unless resolved through React's `react-server` condition, which
vitest does not apply. Setting `resolve.conditions` had no effect, so the alias
points at the package's own `empty.js`.

Dropping the import from the modules under test would have been easier and wrong:
in the build it is the thing stopping a Postgres driver reaching a client bundle.

## 2026-08-23 — Backend lives at `server/`, not `src/server/`

The brief specifies `src/app/api/**` and `src/server/**`. Next.js allows `app/`
**or** `src/app/`, never both, and this repo has `app/` at the root. Moving it to
`src/` would touch the frontend the brief forbids touching, so routes go to
`app/api/**` alongside the existing page and domain code to `server/**` at root.

`tsconfig.json` already maps `@/*` → `./*` and includes `**/*.ts`, so this needed
no config change at all.

## 2026-08-23 — PGlite has no pgvector; the test strategy is dual

Confirmed by spike, not assumed. PGlite 0.5.6 bundles `pg_trgm`, `citext`,
`pgcrypto`, `unaccent` and 30 others, but **not** pgvector, and no package
publishes it separately (`@electric-sql/pglite-vector` does not exist).

So: PGlite for Phases 1–4, which need constraints, triggers, roles and lexical
search — all of which it does faithfully, being real Postgres 18 in WASM.
Semantic-search tests from Phase 5 need a real Postgres via `TEST_DATABASE_URL`
and skip when it is absent (`hasVectorDatabase()`).

Finding this in Phase 1 rather than Phase 5 is the entire reason the spike was
scheduled first.

## 2026-08-23 — Generated hashes use md5; sha256 is application-written

The design called for `content_hash` as a generated stored column computed with
`encode(sha256(convert_to(text,'UTF8')),'hex')`. Postgres rejects it:

    ERROR 42P17: generation expression is not immutable

`convert_to(text, name)` is **STABLE**, not IMMUTABLE — encoding conversion
depends on server settings — and a generated column requires immutability.
`sha256(bytea)` itself is fine; there is simply no immutable text→bytea path.

So the split is by purpose:

- **Change detection** (does this text differ from what we indexed?) uses a
  generated `md5()` column. Immutable, free, and collision resistance is not
  what the column is for.
- **Integrity and provenance** (this blob is the bytes we fetched) stays sha256,
  written by the application, with a CHECK on the hex format.

Verified in the same spike: `to_tsvector('simple'|'english', col)` **is**
immutable and works in a generated column, and Hebrew tokenises and matches
under the `simple` configuration.

## 2026-08-23 — Constraint tests assert the constraint name, not the message

Drizzle wraps driver errors as `Failed query: …` and hangs the real Postgres
error off `cause`. The first version of the suite asserted on error text and
nine tests failed while the schema was entirely correct.

The tempting fix — a bare `.rejects.toThrow()` — is the trap: it passes when the
*wrong* constraint fires. That is the same class of false green as an
authorization suite that silently runs as the table owner.

So `violation()` in `server/db/testing.ts` walks to the deepest `cause` and
returns `{code, constraint, message}`. CHECK violations are asserted by
`constraint` name; trigger `RAISE EXCEPTION`s, which carry no constraint, by
SQLSTATE plus message. The suite was mutation-tested: removing the `audit_log`
append-only trigger turns exactly two tests red, and restoring it turns them
green.

## 2026-08-23 — Deviations from the backend brief, and why

Recorded so they are not re-litigated. Full reasoning in the plan file.

- **Added `source_family`.** The brief has no way to tell five outlets
  republishing one wire report from five independent corroborations. That is the
  most common way a verification process fools itself.
- **Added a transactional `outbox`.** Enqueueing to a Vercel Queue after commit
  is not atomic; the gap loses reindex and AI jobs silently.
- **Ten confidence dimensions, no single number**; the item carries a derived
  `high|medium|limited` summary so `0.94` cannot be stored.
- **No numeric probability on scenarios** — bands only. A fabricated `0.62` gets
  screenshotted, and the caveats do not travel with the screenshot.
- **Collapsed `undetermined` into `unverified`**; **added `unsupported` and
  `satire`**; **dropped `inconclusive`** from evidence relations.
- **`reports` means user-submitted reports** (§44), not generated deliverables.
  The design agent read it the other way; the brief is unambiguous.

## 2026-08-23 — Deploys run from the CLI, not from git

`vercel git connect` fails because the Vercel account cannot see private repos
under `lions-admin`. Rather than make the repo public to unblock it, deploys
stay manual (`vercel --prod`) until the Vercel GitHub App is authorised for
that account. The repo being private was a deliberate choice; convenience does
not override it.

Consequence worth remembering: **pushing to GitHub deploys nothing.**

## 2026-08-23 — `reactStrictMode` stays off

`lions3d`, where the intro came from, had it on and `lion-scene.tsx` was
written to survive the double mount. `LionExperience.tsx` was not — it still
carries a debug harness whose cleanup does not remove its window listeners.
Turning strict mode on would double-register them in dev.

`devIndicators: false` was kept from lions3d: the badge sits in the corner the
intro plays in.

## 2026-09-05 — Two deploy targets fire from one push; "succeeded" names one of them

This supersedes the 2026-08-23 entry "Deploys run from the CLI, not from git".
That entry's two premises are both false now: the repository is **public**, and
pushing to `main` **does** deploy. It was accurate when written; it is stale,
and an agent that trusts it will draw the wrong conclusion.

Observed during the Batch A LICENSE push (commit `538fa40`), from the GitHub
deployments API:

| deployment | environment | sha | created |
|---|---|---|---|
| `6284513589` | `zippy-joy / production` (Railway) | `538fa40` | 18:45:43Z |
| `6284531836` | `Production` (Vercel) | `538fa40` | 18:47:41Z |
| `6281783102` | `Production` (Vercel) | `e9455f0` | 13:58:47Z |

One push to `main` produced deployments on **two independent providers**. They
run on their own schedules: Railway reported `success` at 18:47:10Z while the
Vercel `Production` environment still pointed at the previous commit
`e9455f0`. The Vercel deployment for the same commit only appeared at
18:47:41Z. For roughly two minutes the two production targets served different
commits, and a check performed inside that window saw exactly that.

The rule this establishes:

- **`deployment succeeded` is never equivalent to "the intended production
  target is updated".** It says one provider finished one build.
- Before claiming production success, name four things: the **provider**, the
  **environment**, the **deployment id**, and the **commit SHA** actually
  verified. A claim missing any of these is not a verification.
- A single API snapshot is a point in time, not a steady state. When the
  targets disagree, the honest reading is "these have not converged yet",
  not "this provider is behind".

## 2026-09-05 — `worktree-workbench` carries a duplicate LICENSE

The branch `worktree-workbench` (head `f0a17c0`, "MIT License", authored
18:40:38Z) independently added a `LICENSE` file about five minutes before
`main` received its own in `538fa40`. The two files are **byte-identical** —
1070 bytes, same `Copyright (c) 2026 Lions of Zion` line — verified by direct
comparison of the branch blob against the file on `main`.

Consequences for whoever merges that branch:

- Expect a trivial **add/add conflict** on `LICENSE`. Resolve it by keeping
  the canonical file already on `main`. The contents are the same, so nothing
  is lost either way; keeping `main`'s copy avoids churn on a legal file.
- `f0a17c0` **also adds `"license": "MIT"` to `package.json`**, which `main`
  does not have. That line is the more complete half of that branch's change.
  If the project is still MIT-licensed at merge time, **preserve or adopt it**
  — do not let it disappear while resolving the LICENSE conflict, which is
  exactly how that kind of one-line metadata gets dropped.

The branch was NOT merged as part of Batch A. Nothing here authorises merging
it; this records what a future merge will encounter.

## 2026-09-06 — Our Heroes and Israel's Story keep their addresses after their nav entry folded into The People of Israel

The Premium Editorial pass replaced the "Our Heroes" and "Israel's Story"
header/footer entries with one destination, "The People of Israel"
(`/people-of-israel`), so the chrome does not carry three sibling links for
what is now one reading path. Both legacy pages stayed in the codebase
unchanged and are still linked from the new hub and from the homepage's
People chapter — but `SITE_NAVIGATION` no longer had an entry for either id,
and `SectionPage` throws for any route id absent from that list
(`components/sections/SectionPage.tsx`). Both routes 500'd until this fix.

Resolution: a second, smaller registry, `LEGACY_SECTION_PAGES` in
`lib/site-navigation.ts`, holding just `{ id, parent, href, description }` for
a page that kept its shell after its destination merged into a parent.
`SectionPage` resolves its `id` through `getSectionPageNode()`, which checks
`SITE_NAVIGATION` first and falls back to this list, so `our-heroes` and
`israels-story` render again with their original lede text.
`resolveSiteSectionId` maps both ids to `people-of-israel`, so the site
header still marks "The People of Israel" current when a reader is on either
legacy page. The sitemap lists both at priority 0.6 (level with the archive
indexes), not as one of the eight primary destinations.

Rejected: adding `our-heroes`/`israels-story` back into `SITE_NAVIGATION`
with a `hidden` flag. Every consumer of that array (header, footer, sitemap's
destination block, search vocabulary, the home page's own fallback list)
treats it as literally "the destinations" with no filter — a flag each of
them would have to remember to check is exactly the kind of thing that gets
missed once and silently relights a retired nav entry.

## 2026-09-06 — October 7 lost its "nothing on it moves" invariant on purpose

`app/october-7/page.tsx` was rebuilt around `ArchiveShareShowcase`, a
client component that auto-rotates a text-only preview of one survivor story
and one documented record every 12 seconds. The page's previous version
carried an explicit comment that a memorial page mounts no `Reveal` and
nothing on it moves; that comment and the two static "doors" it described
were removed in the same change, without a corresponding decision record.

What actually ships now, so this is not lost a second time:

- Rotation runs only while the section is in the viewport (`IntersectionObserver`),
  pauses immediately on hover, focus, or a manual arrow click, and never
  starts at all under `prefers-reduced-motion: reduce` — `useSyncExternalStore`
  reads the media query and a reduced-motion visitor sees only the arrows.
- The rotation is text and a link only. No image or video plays or reveals
  itself on the homepage or on this page's showcase; a documentation sample
  states its content warning and links out to the archive record, which is
  where the actual graphic material stays gated, exactly as before.
- `tests/site-navigation.test.ts` was pinned to the retired copy's exact
  strings ("Find archive material to share", "Keep content warnings and
  source credits") and was updated to the current page's wording rather than
  weakened — the invariant it checks (the page still names its two
  collections and still promises a content warning before sharing) still
  holds.

This is a deliberate design change, not a regression: a static memorial and
a page that invites sharing pull in different directions, and the owner's
brief for this pass was share-oriented. Recorded here so the original
"nothing moves" reasoning is not silently treated as still in force.
