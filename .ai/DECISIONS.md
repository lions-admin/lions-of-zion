# Decisions

Append-only. Newest first. One entry per decision that a later reader would
otherwise re-litigate or accidentally undo.

Record the **why**, not the what — `git log` and `git diff` already hold the
what, and duplicating them here just creates something to fall out of date.
A decision that was reversed keeps its entry, with the reversal appended: the
record of a bad idea is what stops it being had twice.

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

**The public marking is the promise the rest of this rests on**, and it is
redundant by design: a second kicker badge, a disclosure paragraph above the
claim record, an `Evidence basis` row, an affirmative block saying why this
record cites no source where a sourced record would list its sources, an
`Analysis: ` title prefix, a marker on the OpenGraph card, and a basis marker in
the brief hub. Deleting one of those to tidy a layout produces precisely the
artefact this decision exists to prevent — an unsourced record reading as
documented fact. Two holes are known and recorded rather than fixed: JSON-LD
`author` is still `Organization`, and the OpenGraph `alt` text is static because
it is a module-level export, so machines get a weaker marking than humans do.

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

## 2026-08-27 — Archive attribution splits by package, and the reversal is deliberate

**Implemented 2026-08-27.** `CLAUDE.md` is updated to match. What shipped
follows this entry exactly: `hamas-massacre` lost the footer and the dateline
`Archive` pair; `october7` kept one reduced footer line carrying the link and
the address, and lost the dateline pair. The JSON-LD and the six in-body media
credits were left alone, so provenance still reaches machines. The filename
mitigation named at the end of this entry is **only partly delivered**: the
Blob serves its own content-hash filename cross-origin and ignores a requested
one, so a downloaded file still arrives without the record's name.

This **reverses the 2026-08-26 entry** "The archive presents clean but keeps
its provenance", which settled that provenance is kept and recorded that
rewording records to shed attribution was considered and rejected. That entry
stands as written; this is the reversal appended to it.

The owner's position: the material in these packages is public, and the party
named in the credit is not its author, so a per-record provenance footer
asserts an ownership relationship that is not there.

**The reversal is asymmetric, and the asymmetry is the decision:**

- **`hamas-massacre` (335 records, 670 language versions, `/october-7/documentation`)**
  — the provenance footer is removed.
- **`october7` (179 records, 505 language versions, `/october-7/testimonies`)**
  — a small credit stays, carrying a clickable link and the site address.

So the larger half of the archive loses its attribution and the smaller half
keeps it in a reduced, *linked* form. That second part cuts against the same
2026-08-26 decision from the other side: it makes the credit a hyperlink,
where the rule had been that nothing in a record body is one. The rule was
about record bodies and this is a footer, so it is a narrowing rather than a
contradiction — but a reader who knows the rule will need this sentence to see
why the link is not a mistake.

`sourceLabel` renders in **two** places — the dateline's `Archive` pair
(`ArchiveRecord.tsx:80`) and the footer (`:155`). The decision is **one credit,
not two**: whichever survives must be the one carrying the link and the
address, since that is what the instruction describes.

What replaces the removed footer is the opposite of a quiet deletion: share
controls and per-file download, meant to push this material outward rather
than hold it. The consequence, stated so it is not discovered later: a
documentation file downloaded from this site arrives with no caption, no
record, and no origin, and whoever receives it next has no way to tell it did
not originate here. Attaching the record name to the downloaded filename is
the cheapest mitigation and is recorded as part of that work.

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

## 2026-08-27 — The closed design audit is archived, and its refusals are kept here

`TODOS-design-audit.md` reached 83 of 83 closed with zero open items, and
`docs/design-audit-2026-08-26.md` — the 219 KB evidence report it was generated
from — has no task left to drive. Both move to `docs/archive/`, along with
`docs/graphics-task-02.md` (already self-banner-marked HISTORICAL) and the
2026-08-24 Codex review, which is superseded on both its axes and whose twelve
evidence images were never committed beside it.

Archiving a task list is cheap. Archiving the reasoning that *closed* items
without fixing them is not: those are the findings a future audit will file
again, and each costs a session to re-refute. That reasoning is lifted here
before the file moves.

**Refuted in verification — the finding was wrong, not deferred:**

- `aside` being a zero-caller prop is not a defect. `CLAUDE.md` states
  verbatim that `surface="quiet"` is not a deviation and that `aside` "exists
  and is unused". The proposed fix was also hazardous: `--accent` defaults to
  `var(--data-blue)`, so `color: var(--accent)` on `h2` would have turned six
  dossier headings blue.
- The masthead status is not a constant standing in for a live value.
  "Reference edition" deliberately replaced a `Monitoring · active` label, and
  the 2026-08-25 entry below ends "Do not reintroduce a live-sounding label".
  The slot is filled, not empty.
- Colour-only links on the front page: the 1.29:1 figure recomputes, but the
  mechanism does not exist. The closing row is two links with no surrounding
  prose, and `home.module.css` already carries the `:focus-visible` rule the
  finding said was missing.

**Withdrawn by the browser sweep — an automated pass will flag these again,
and they should die the same way:**

- `.identitySep` at 2.04:1 is a `·` rendered `aria-hidden="true"`. Decorative
  text carries no contrast obligation.
- The `ScanBackdrop` rows at 2.49:1 and 4.03:1 sit inside a field marked
  `aria-hidden="true"` in its entirety.
- The Brief's wordmark measuring 1×1 at 320px is the visually-hidden pattern,
  not a collapsed grid column.

**Seven ids were filed twice by two agents.** Searching for a retired id should
land here: `cross-cutting-orbit-labels-nine-px` →
`home-scene-orbit-labels-below-legibility-floor`;
`archive-brief-998-non-english-pages-are-served-as-lang-en` and
`cross-cutting-archive-lang-declared-english` → `archive-lang-declared-english`;
`cross-cutting-error-page-cinzel` →
`reading-system-error-page-is-a-preserved-v1-fossil`;
`reading-system-two-tables-of-contents-at-once` →
`section-pages-israels-story-two-contents-lists`;
`cross-cutting-archive-image-cls` →
`archive-brief-october7-videos-reserve-no-layout-height`;
`home-scene-file-index-numbers-fail-contrast` →
`cross-cutting-four-sub-aa-text-pairs`.

One live pointer survives the archiving: **Phase 5, the home-scene orbit
labels, is `.ai/DESIGN-V2.md`'s open question and always was** — an owner
decision rather than an audit finding. The audit's in-place fix did not
pre-empt it.

---

## 2026-08-27 — The reading routes scroll the document, not themselves

Every reading route declared `height: 100dvh; overflow-y: auto` and scrolled
inside itself. That cost two reader-facing things on ~1,190 routes: a phone's
URL bar only auto-collapses for a *document* scroll, so each page permanently
spent the ~60–90px every other site reclaims after the first swipe; and browser
scroll restoration on back-navigation never applied, which is why the archive
index had to remember its position in `sessionStorage` by hand.

**Why it converted whole rather than route by route.** A document has exactly
one scroller. Unlocking `html` while any route still declared `100dvh` would
give that route a dead outer scrollbar around a live inner one — so five
stylesheets moved in one change, plus the three consumers that read the
container directly, plus every sticky element whose scrollport changed
underneath it. This is the reason it sat deferred through three separate
rounds: each of them correctly judged that a partial conversion is worse than
none.

**Three things are worth not re-deriving.**

The `≤719px` rules that *shortened* the scroller to clear the chat dock became
`padding-bottom`. You cannot shorten a document; you reserve space in it. The
home route had already solved it that way and was the model.

`SectionToc`'s IntersectionObserver root had to become the viewport. Passing a
root that is not an ancestor scrollport does not error — it reports every entry
as never intersecting, so the rail would mark nothing and look merely idle.
`ReadingProgress` fails the same silent way, returning a flat 0 forever. Both
now detect whether the marked element is really a scroller, so a route that
declares its own again keeps working.

`ArchiveIndexFilter`'s `sessionStorage` restoration was **deleted, not kept**.
It existed only because inner scrollers cannot be restored across a
back-navigation. Left in place it would race the browser's own restoration —
two writers for one position, later write wins, reader lands somewhere neither
meant. Verified: Back now returns to 3000 from 3000 unaided.

**No route-scoped body class was needed**, which the earlier plan expected. The
home scene keeps its lock through the existing `:has([data-intro-active])`
rules — they are more specific than the bare `html, body` default, so they
still win. The attribute-not-id rule in `globals.css` remains load-bearing for
exactly the reason recorded there.

Verification is its own script, `scripts/verify-doc-scroll.mjs`, in real Chrome:
the payoff is rAF- and history-driven and the in-app browser suspends `rAF` by
reporting `visibilityState: "hidden"` — the trap `CLAUDE.md` already documents.

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

## 2026-08-26 — `app/loading.tsx` is removed: it hid every page from readers without JavaScript

A root-level `loading.tsx` wraps **every** route in a Suspense boundary. With
streaming SSR the fallback is what renders in place, and the real markup is
emitted later inside `<div hidden id="S:0">`, revealed by an inline `$RC`
script. When that script never runs, the loading shell stays visible and the
whole page stays hidden. This is not a theory — it was measured in the
prerendered HTML of `/october-7`:

| | with `loading.tsx` | without |
| --- | --- | --- |
| `loz-loading` fallback | at 4001 | absent |
| `<div hidden id="S:0">` | at 5853 | absent |
| real markup (skip link) | 6124 — **inside** the hidden wrapper | 4200, plain in `<body>` |
| `$RC` reveal script | 24139 | absent |

It also silently violated a stated invariant. `CLAUDE.md` promises "without
JavaScript the static navigation remains usable immediately"; it was not.
After removal the home route's prerendered HTML carries all eight orbit
destinations plus `/methodology` and `/corrections`, the poster `<img>`, and
zero Suspense boundaries.

**What was traded, and why it costs nothing here.** The component's own
docstring said its job was to "hold the ground color so navigation never
flashes unstyled content." That job is already done by `app/globals.css`,
which paints `background-color: var(--ground)` on `html, body` from the
stylesheet in `<head>` — independent of any component. Every route is
prerendered static, so there is little transition to cover in the first place.

**Do not reintroduce a root-level `app/loading.tsx`.** If a future route
genuinely needs a loading state, scope it to that route's own segment and
verify the no-JavaScript render of a sibling content route before keeping it.
The cost was about to grow by three orders of magnitude: the October 7 archive
adds ~1,178 static pages whose entire value is text and images that need no
JavaScript at all.

Verified: typecheck 0 errors, 331 tests passing, lint unchanged (14
pre-existing warnings), build prerenders every route.

## 2026-08-26 — The archive presents clean but keeps its provenance; it is an evidentiary asset, not an SEO one

Four decisions about how the hosted archives present, taken together because
they came from one question: how "clean" can these pages be?

**No outbound links in a record body, and credits render as plain text.**
The visitor is never sent away mid-record and never sees a hyperlink in the
prose. `source_url` stays in metadata and JSON-LD — machine-readable and
verifiable without being visible. A single site-level sources-and-method page
(`/methodology` already exists) replaces per-record link lists. Credits sit at
`--t-data`, the smallest step in the type system: present, recessive.

**Provenance itself is not negotiable, and rewording to escape it was
considered and rejected.** Minor edits to someone else's work produce a
derivative work, so the obligation survives the edit — but three project-
specific reasons mattered more. These are first-person accounts: altering the
words changes what the witness said, which turns testimony into a story based
on testimony. `/october-7`'s own copy says denial is answered by the record,
and denial feeds on claims that cannot be checked — an unsourced archive hands
a denier his argument. And `TODOS.md`'s standing principle is "Evidence first:
no publication without sources." Note the scale of what was actually at stake:
only **3 of 528** media items in one package and **3 of 499** in the other
carry a named credit, so there was no clutter to remove in the first place.

**Canonical points at this site, not at the source.** Canonical to the source
guarantees zero organic traffic from 1,178 pages; there is no reason to
concede that in advance.

**But do not plan on traffic from the record pages.** When two sites host the
same text a search engine shows one, and the source published first with the
domain history to match. Expect these pages to earn little search traffic
whatever the canonical says. (Rewording to dodge duplicate-content detection
is the usual tactic here and works poorly on top of everything above.) The
traffic comes from what is genuinely this site's own: the editorial layer
around the archive, the fact that nobody else holds both archives in one
searchable place, and Hebrew — absent from both packages and from this site,
which is `lang="en"` today. Translating the archives is itself a derivative
work and a conversation with the source projects; the editorial layer is not,
and can be written in Hebrew freely.

**Documentation records take no rails.** Measured, not guessed: every one of
the 670 hamas versions is exactly 3 blocks with exactly 1 heading, so an "In
this file" rail would carry a single entry. 179 of the 505 october7 versions
have no headings at all. `DocPage`'s rail-free shell is therefore correct as
it stands. A right-margin-only variant for the long testimonies (median 26
blocks, up to 170) is worth revisiting later — as a prop on the existing
shell, never a fork, and it must also fix the `--content-w` maths, which
assumes both rails or neither.

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
- `components/content/README.md` described a Cinzel-and-hard-coded-hex palette
  that the V2 type pass retired — `content.module.css` is 217 `var()` references
  and one literal.

`docs/graphics-task-02.md` was kept and banner-marked historical rather than
deleted: its reasoning about composition and registration is still worth
reading, and the record of what was specified is worth having. A superseded
document that says so is useful; one that does not is a trap.

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

## 2026-08-26 — Orbit labels anchor their first line, not their centre

Reported by the user with screenshots: the node buttons were untidy — some
labels colliding with their icon ("SUPPORT US" ran across the shield,
"WAR UPDATE" touched the X), some sitting visibly lower than their
neighbours, some reading weaker than others.

One geometric cause behind all three. The label was flex-centred as a block
and then translated down, so the first line's position was a function of the
line count: one-line labels sat low with a gap under the icon, two-line labels
started at the node's centre — inside the icon's ink, which is lifted +0.095
node-units but spans ±0.13 (`ICON_WORLD_SIZE`), so its bottom reaches
~0.076·radius *below* centre. `.label` now anchors its **top** at a fixed
offset below the node centre (`clamp(0.55rem, 1.3vmin, 0.8rem)`) and extra
lines grow downward. Measured after: every node's first line sits at the
identical offset per viewport (11.7px at 1440×900, 10px at 1024×768, 8.8px at
390×844), every label bottom stays inside the ring, and the wider anchored box
lets "SUPPORT US" fit on one line at desktop.

**The `data-intent='participate'` dimming is gone, and should not return.**
`opacity: 0.78` on the labels quietly broke the lock at the top of
`styles.module.css` — #C9A24B clears 4.5:1 at full alpha, not at 78% of it.
The intent grouping is carried by the front-page index's headings now; no
label pays contrast for it. All labels also gained a ground-coloured backing
halo (not a glow) so gold glyphs stay separated from scan rows drifting
behind them — which is what "some labels look weak" actually was.

---

## 2026-08-25 — The scan's ground is one global background, not a per-page one

Reported by the user, and correct: "the matrix background is the general
background of the whole site, and it is not present in most of the site."

It was painted by `ScanBackdrop`, which only reading pages mounted. Anything
that did not mount one — the home route's new front page above all, but also
the 404 and the brief — painted a flat `var(--ground)` panel instead, and
`body` underneath sat on `#020409`, a second and darker black that only ever
showed where a page forgot to paint. So the site had two grounds, one texture
that reached about half of it, and a home page whose background stopped
existing at the fold.

**The ground and its texture are now one token, `--scan-ground`, carried by
`body`.** Every surface inherits it, including ones nobody has built yet.
`.page`, the brief and the 404 stopped painting their own; `.backdrop` stopped
painting any, and is now only the rows' host. `#020409` is retired — the
comment in `sections.module.css` that called it "the body's darker one" and
worked around it can go.

**One surface still paints its own, and has to**: the home front-page band
scrolls over the live particle scene, so a transparent band would show the lion
and the orbit through the text. It takes `--scan-ground` explicitly, so being
opaque does not mean dropping out of the site's background.

**The levels were the real problem, and they were set by feel.** Globalising
the plumbing changed nothing visible, because the values themselves were below
perception. Composited against `--ground` (rgb 7,11,20):

- the rule field at `0.028` alpha landed on rgb(9,15,26) — a delta of (2,4,6),
  which is not visible on most displays. It is now `0.075` → rgb(13,23,35),
  a real weave that still leaves body ink above 12:1;
- the drifting rows at `0.15` opacity landed at a delta of (6,12,16) — present
  in a screenshot, invisible on a screen. Now `0.34`. The per-page calms
  (`surfaceQuiet` 0.7, `registerMuted` 0.45) scale from it untouched;
- the mask's soft edge was `5rem`. At 1440px each margin is only ~129px wide,
  so the fade consumed most of it and the rows never reached full strength
  anywhere. Now `2.75rem`.

**And the mask dims the reading column instead of cutting it out.** This is the
change that actually answers "the matrix is the background of the whole site".
Cutting the rows to zero alpha across the protected band meant that at 1440px
they existed only in two thin edge strips, and on a phone — where the band is
the entire viewport — they did not exist at all. A ground with a hole in the
middle is a decoration, not a ground. The middle now keeps a quarter of the
row's alpha: 0.34 × 0.25 ≈ 0.085, a delta of about (5,10,13), which reads as
drift behind the page rather than text competing with text. Phones have the
scan for the first time. Raising that quarter brings back the audit's original
complaint — half-legible fragments colliding with sentences — so it is the
number to lower, never to raise.

**The drifting rows stay per-page**, because their mask has to know where that
page's text column is (`--content-w`). The home band mounts one through a new
`surface="band"` variant: `position: fixed` would have painted it over the
scene above, so it sticks to the top of an absolutely-positioned dock inside
the band instead — which also keeps the rows at viewport density rather than
thinning 16 of them over a band several screens tall.

Two things bit while wiring that up, both measured rather than reasoned:

- **`overflow: clip` on the dock silently disabled the stickiness.** The
  backdrop stayed pinned to the top of the band, every row sat at y = -872, and
  the band rendered flat. There is nothing to clip anyway — sticky is already
  constrained by its containing block.
- **`overflow-x: hidden` on `body` did the same thing, for a different reason.**
  It makes `body` a scroll container, one that never scrolls because the
  document does, and sticky then resolves against that dead scrollport. The
  sideways clip belongs to `html` alone. This is worth remembering before
  adding `overflow` to `body` for any reason.

---

## 2026-08-25 — The home route grows a front page; the scene keeps its exact box

The home page surfaced no documented content, hid all eight section
descriptions behind hover (invisible on touch, where a tap navigates in
320ms), and still spoke the pre-V2 type language the rest of the site
retired. A design review offered three directions and the user chose the
editorial one: keep the particle scene as the hero, put real content below it.

**This reverses `CLAUDE.md`'s "the home route has no content below the fold."**
Recorded as a reversal, not a refactor, because a later reader would otherwise
restore the invariant and delete the band.

**The scene stays `position: fixed; inset: 0`, verbatim.** The constraint the
user set was that the matrix is not touched, and that turned out to decide the
whole architecture rather than merely limit it. A shorter hero was measured,
not assumed, and it fails: the camera's world height is a constant mapped onto
container pixels, so a 65vh band renders the entire composition at 65% linear
scale rather than reflowing it; at 320x568 the orbit lands on its documented
emergency radius floor and adjacent nodes overlap; and the `vmin` ↔ container
contract between `config.ts` and `styles.module.css` silently breaks, because
CSS reads the viewport while the solver reads the container. Keeping the box
fixed avoids all of it, and pays twice more: a fixed element's rect does not
change as the page scrolls, so r3f never fires `setSize`, so neither
`IntroText`'s glyph resample nor `NetworkScan`'s point-cloud rebuild is
triggered by scrolling. `verify-composition.mjs` passes with every number
unchanged at all seven viewports, which is the gate that proves it.

**Document scroll is route-scoped through `:has()`, and the marker is an
attribute for a specific reason.** `:has()` takes the specificity of its
argument, so `html:has(#id)` scores (1,0,1) and outranks
`html:has([data-intro-active])` at (0,1,1) — the intro's scroll lock would
never have won. Attribute for attribute puts both on the same specificity and
lets source order decide. Locking `html` alone was also not enough: `body`
stayed scrollable and simply became the scroll container instead. Measured —
the page still scrolled 3075px through a "locked" html.

**The lock keys on `data-intro-active`, not `data-intro-pending`**, which is
the opposite of what the chat launcher does. `data-intro-pending` is the
server's claim and ships in the first HTML; nothing removes it when JavaScript
never runs, so locking on it left no-JS visitors on a page that could not
scroll to the only navigation it had. The launcher can afford that attribute
because it sits above the fold and would otherwise flash; the band is below the
fold and cannot flash.

**The home route hides its scrollbar, alone.** Not taste: a classic scrollbar
is 8px of layout, and `position: fixed; inset: 0` resolves against the viewport
*minus* it, so the scene would have solved its composition against 1432px
instead of 1440px — and at 320px wide that is enough to push the orbit onto its
radius floor. `verify-home-band.mjs` asserts the scene's box equals the
viewport exactly and failed on all six viewports before the rule existed.

**The anchored strip rides in the orbit's own bottom margin, and the overlap is
a separate number from the strip's height.** Collapsing the two made the strip
cover the bottom node at three viewports. The free band under that node is
small and measured — 41.6px at 1440x900, 37.4px at 1024x768, 32.5px at
768x1024 — and the DOM link box reaches lower than the drawn ring, so the
analytic estimate was not enough. The overlap is 1.75rem; the strip is 2.75rem
and hangs the difference downward into the band, where nothing is in its way.
If this ever collides again, shrink `--strip-overlap`; never the orbit.

**The static mobile index is deleted, not demoted again.** It existed as the
no-JS/no-GPU tier's home. The band is server-rendered for every tier, so
keeping both would be two indexes of the same eight files drifting apart. The
intent grouping it carried moved into the band as real headings over the files
themselves, which is the first time that taxonomy has been legible — it was a
0.53rem colour-coded legend in the scene's corner before.

**The front-page render path is synchronous, deliberately.** An `await`
anywhere in it puts the route behind `app/loading.tsx`'s Suspense boundary. A
top-level `await` in `lib/content/home.ts` does not help either — it makes the
importing module async, which suspends the route just the same. So
`war-update.ts` and `october-7.ts` export their editions synchronously
alongside the async accessors, which stay as the seam a real query will land on.

_(Update 2026-08-26: `app/loading.tsx` is deleted, so the Suspense boundary this
paragraph reasons about no longer exists. The synchronous exports are kept, but
as a default rather than a requirement — see the entry at the top of this file.)_

**Copy is bounded by what the content can support.** There is no newest
edition — every edition carries the same `publishedAt` — so the strip says
"latest documented milestone" and derives it from `max(entry.datetime)`, never
"latest update". The corrections card says "None recorded", because the log is
genuinely empty. Nothing renders a review date, because `reviewedBy` is a role
and no such date exists. One event is authored twice (War Update's
`hostages-released` and October 7's `final-hostages`, both 2025-10-13); the
duplicate is named explicitly rather than resolved by a same-day heuristic,
because two real events can share a date, and `assertKnownDuplicates` throws if
either id disappears.

---

## 2026-08-25 — `app/loading.tsx` breaks every async route without JavaScript

Found while verifying the front-page band, and **not caused by it** — the
pre-change code fails identically.

`app/loading.tsx` wraps every route in a Suspense boundary. Without JavaScript
nothing replaces the fallback, so the page renders as the loading shell with
the real markup parked in a `display: none` wrapper. Measured on the production
build: `/`, `/war-update` and `/we-are` all render zero visible links and zero
text; `/methodology`, whose page component is synchronous, renders fully.

Proven by removing that one file and rebuilding: the home route then renders
completely without JavaScript — 8 orbit links, 8 band links, poster visible,
document scrollable, 4120px tall. The file was restored, because deleting it
regresses the client-side navigation gap it was added for (TODOS W1) and that
trade is the user's to make.

This matters more than a normal bug because `CLAUDE.md` promises the opposite
("Without JavaScript the static navigation remains usable immediately"), and
because the existing check never caught it: `final-verify.mjs` counts
`a[data-node-index]` elements, which are present in the hidden wrapper, so it
reported 8 links on a blank page. Two candidate fixes, both unmade:
delete the root `loading.tsx` and accept the navigation gap, or move the
loading UI below `/` so the entry route never suspends.

**Resolved 2026-08-26** — the first option was taken: the file is deleted. The
"navigation gap" it was restored for turned out to cost nothing, because the
ground colour it existed to hold is painted by `globals.css` on `html, body`
independently of any component, and every route is prerendered static. See the
entry at the top of this file for the before/after measurements. The note above
about `final-verify.mjs` counting `a[data-node-index]` inside the hidden wrapper
still stands as a warning: **that check cannot distinguish a rendered page from
a blank one**, and should be tightened before it is trusted again.

---

## 2026-08-25 — The source travels beside the claim: reading pages grow two working margins

A frontend design review offered three directions and the user chose "the
intelligence desk", after seeing it built on real War Update content. It is
not a new look — it is the half of V2 that never shipped. `.ai/DESIGN-V2.md`
said the Brief's anatomy "becomes *the* shell for everything"; the dossiers
got the centred measure and not the rails, so `sections.module.css` declared
three grid tracks and left two empty on every page, `SectionPage`'s `aside`
prop sat styled and documented with **zero callers**, and `TODOS.md` still
carried "rail ימני בדסקטופ — חלקי… אין עדיין תוכן שממלא אותו".

Above 1220px the left margin now navigates the document and the right margin
carries each record's citation, level with the record. The thesis is the site's
own, already recorded for chat under *"the verdict travels beside the retrieved
text, never inside it"* — a desk that claims to check things before publishing
should show the checking next to the claim, not in a stack at the foot of the
page. **No source→claim mapping was invented to do this**: every editorial page
already carried per-item sources in `lib/content/`, which is what made the
direction buildable at all.

Four things worth not re-litigating:

- **The margin is a grid, not absolute positioning.** The first build placed
  notes at `left: 100%` and it was measured, not assumed: Fake Resistance's
  claim-propagation entries run 97–127px tall against citations of 136–150px,
  so notes overran the entries below them. Absolute positioning cannot reserve
  space and no amount of padding *guarantees* it won't recur. The host is now
  a two-track grid whose second track is zero-wide — the note paints into the
  margin but still sits in the row, so the row is at least as tall as the note.
  Overlap stopped being something to verify and became something the layout
  cannot express. This is why `Timeline`, `WireFeed` and the Fake Resistance
  case wrap their record in a `*Main` element: the record and its evidence have
  to be siblings.
- **Our Heroes deliberately opts out.** Its profiles are cards in a two-up
  grid, where `left: 100%` resolves against the *cell* — the left card's note
  landed on top of the right card. The rule that emerged is the right one
  anyway: a full-measure record puts its evidence in the margin because it has
  no boundary of its own; a card already holds its evidence inside one.
- **The Brief's "Evidence contract" moved to the left rail.** It describes the
  document — status, record count, corrections — not any one development, so it
  belongs with the identity, and moving it freed the right margin for what the
  direction actually wants there.
- **Israel's Story stopped printing its citations twice.** Each chapter's
  `sources` array is the union of its own entries' sources, so the page
  rendered every citation once per entry and again per chapter. Invisible while
  both sat in the column; obvious the moment the entries' sources moved out.
  The field stays in `lib/content/israels-story.ts`; only the second rendering
  is gone.

**The footer stayed deleted.** The mockup that sold the direction included
prev/next and a file index; `4b13229` had removed exactly that three commits
earlier, on the reasoning that the eight files are an orbit and not a sequence.
The user was asked and confirmed the deletion stands. A mockup is a proposal,
not a mandate.

**The chat launcher's label now appears only where it has somewhere to be.**
The pill ground added earlier made the overlap legible; it never made it small,
and uncapped `nowrap` the longest label measured ~345px. Between 720px and
1219px the reading measure runs to within ~36px of the right edge, so *any*
floating pill covers the record — there is no width to win there and the label
stands down. It shows over the outer margin at ≥1220px (capped at 9rem, wrapped,
decorative arrow dropped) and in the mobile dock's own reserved band at ≤719px.
The button, which is the actual affordance and carries the accessible name, is
present at every width.

**Document scroll was not restored and did not need to be.** `position: sticky`
resolves against the nearest scrollport, so the rails work inside
`.page { height: 100dvh; overflow-y: auto }`. That remains its own phase.

## 2026-08-25 — Cinzel is retired from every reading surface; Newsreader + IBM Plex Sans replace it

The user rejected the reading pages outright — "terrible fonts, hard to
read, bad page layout". A two-agent audit over real-Chrome captures of all
ten routes found the cause was systemic, not cosmetic: **51 distinct font
sizes, 77 declarations below 11.2px, 67 uppercase treatments, ~12 unrelated
body greys, ~9 type voices on a single screen.**

The root cause was Cinzel doing a job it was never drawn for. It is a
Trajan-style inscriptional face — all-caps forms for monuments — and it was
carrying every H1, every section heading at 0.95rem/+0.18em, every entry
title, and the names of real people on Our Heroes. Its lowercase renders as
faux small-caps, so sentence-length titles became strings of even-height
capitals with no word shapes to read.

The diagnosis is sharpened by where Cinzel *worked*: the Brief's 4.35rem
headline and the home wordmark — brand-mark scale. The Phase 3 agent tested
this directly in Chrome expecting to argue for keeping it there, and
reported the opposite: Newsreader's display optical size set the same
headline in three lines with real word shapes where Cinzel needed four of
spelled-out capitals — and, decisively, Cinzel forced *every other heading
on that page* into tracked capitals, so the page needed a second face for
anything readable. One family now runs from the 4.1rem hero to the section
headings.

**This amends the "Cinzel labels" convention in `CLAUDE.md` and the nav
brief.** Cinzel survives in exactly one place: the home particle scene's
identity. Do not reintroduce it to a reading surface. Full plan, tokens and
measured before/after in `.ai/DESIGN-V2.md`.

**An English-first correction worth keeping**: the first draft of this
direction chose Hebrew-native faces (Frank Ruhl Libre / Heebo) for a
future-RTL dividend. The user rejected it — the site is in English, Frank
Ruhl Libre's Latin is a companion script, and Heebo's Latin is literally
Roboto, so the swap would have traded one generic face for another. Faces
are chosen Latin-first. The Hebrew path is preserved as *designated
companions* for the RTL round (IBM Plex Sans has an official Hebrew
sibling), not as today's drivers.

## 2026-08-25 — The reading shell is a masthead, not a floating card

The same audit found the dossier shell — a 15rem emblem rail beside a 44rem
panel, the pair centred — was designed when the eight pages were
single-screen intent statements, and failed them as real documents
(Israel's Story is 9,271px of scroll). At 1440px it used ~49% of the
viewport for reading, pushed the column 148px right of centre, left the
rail floating in a void, spent ~320px on ceremony before the first
sentence, and closed with a five-part ~345px footer carrying **two
competing "Ask the Lion" affordances** — the boxed CTA and the floating
launcher, both visible at once.

It is now a masthead: one full-width identity band, a genuinely centred
68ch measure, a two-row footer. The boxed Ask CTA is gone — the floating
launcher is the single ask affordance. Side columns are real grid columns
that exist only when a page supplies rail content, rather than a permanent
identity totem.

Two things worth not re-litigating:
- **The panel lost its card chrome deliberately.** Once the backdrop is
  masked out of the reading band there is nothing left to shield text
  from, and the border read as a floating box rather than a page.
- **The backdrop mask and the grid share one `--reading-w` variable.** One
  number, two consumers, no drift. If you change the measure, both follow.

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

## 2026-08-25 — "What changed since last update" became a "Latest" marker, not a fake visit-diff

War Update's TODOS item asked for a "what changed since last update" state.
This site has no real per-visitor tracking, so a genuine "since you last
looked" diff isn't possible without inventing one — which would violate the
same "no false live state" principle already applied elsewhere (see the
`Reference edition` label decision). The honest substitute that ships: a
"Latest" badge on the single most recent entry by date, computed from real
data every render, no fabricated session state. If real visit-tracking is
ever added for a legitimate reason, this is the item to revisit — not
before.

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

## 2026-08-25 — Each dossier page's composition is now genuinely different, deliberately, not left to seven independent agents' taste

Every `SectionPage`-based route (War Update, Fake Resistance, October 7,
Our Heroes, Israel's Story, We Are, Support Us) rendered its `.body` through
the same generic prose-blocks-and-cards template, differing only in text.
Rather than dispatching seven agents with open creative latitude — which
would produce seven unrelated aesthetics, not one site's family of pages —
each was given a specific, subject-grounded compositional device decided in
advance: War Update reads as wire dispatches (real datelines extracted from
already-sourced text, never invented for an entry that doesn't name a
place); Fake Resistance as an evidence locker (exhibit lettering, a verdict
stamp); October 7 as a restrained monument (large inscribed figures, slower
rhythm — deliberately less decorated, not more, given the subject);
Our Heroes as formal citations (no photos, by hard rule — this page has no
consent workflow, see the "Our Heroes publishes only extensively public"
entry above, and a compositional pass must never quietly relax that);
Israel's Story as real book chapters (numerals, running chapter header,
drop caps); We Are as an actual pipeline diagram, its human-review stage
breaking shape (circle→diamond) because it is structurally different, not
just next in a sequence; Support Us as a toolkit (its two live tools get
real panel chrome, its two non-tools — Amplify, a standing practice; Sustain,
a channel that isn't open yet — deliberately don't, so the page doesn't
imply parity between "you can do this now" and "this isn't built yet").
Shared site chrome (rail, prev/next, file index, emblem) was explicitly
off-limits to all seven — the differentiation lives only in each page's own
`.body`, on the same sitewide type/color system, so the pages read as one
family with different jobs, not seven different sites. If a future session
wants to extend this to a page not yet covered, the constraint to hold is
the same: ground the device in what that page is actually for, and do not
touch `SectionPage`/`sections.module.css` to achieve it.

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

## 2026-08-25 — GeopoliticalBrief's migration onto `components/content/` accepted structural, not just cosmetic, change

The brief was the last page still using its own local Status/meta/figures/
unknowns/sources/corrections markup instead of the shared library built for
exactly this (`components/content/`, whose colors were already hand-matched
to the brief's own — see its header comment). Migrating it: `Status` →
`VerificationBadge` with a judgment-call mapping from the brief's private
5-value `BriefStatus` onto the real 9-value `AssessmentValue`
(`Confirmed`→`verified`, `Unverified`→`unverified`, `Disputed`→`contested`,
`Attributed`→`unverified` — the closest fit for "single-source, not
independently cross-checked," since no real value captures that precisely
— `Corrected`→`verified`, treating it as a workflow event that
`CorrectionHistory` already carries, not a verdict of its own); the
Developments section became a `Timeline` (`variant="feed"`) and the
corrections footer became `CorrectionHistory` — both structurally different
from the brief's original bespoke layout (Timeline adds a rail+dot marker;
CorrectionHistory drops the original two-column kicker/dark-band treatment
for a single-column block). This was accepted as within scope of
"migrate onto the shared library," not a violation of "should look the
same" — Status/Figures/Unknowns/Sources/PublicationMeta are visually
identical to before, and the two intentionally-different sections still
read as the same page. If a future session wants the brief's Developments/
Corrections sections back to their exact original layout, that's a new,
separate decision to make consciously — not a bug to silently "fix" by
reverting the migration.

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

## 2026-08-25 — No global footer in `app/layout.tsx`; Methodology/Corrections links live in each page's own footer instead

TODOS.md's W1 asked for a "lean global footer." Building one as a component
mounted in `app/layout.tsx` was rejected: `CLAUDE.md` states plainly that
the home route has no content below the fold, and layout.tsx wraps every
route including `/` — a global footer there would either violate that
invariant on the home route or need special-casing to hide itself there,
which is worse than not building it. Instead, a small "Methodology ·
Corrections" link row was added directly to `SectionPage`'s own footer
(`components/sections/SectionPage.tsx`, `.docLinks`) and to
`GeopoliticalBrief`'s closing nav (`geopolitical-brief.module.css`,
`.docLinks`) — the two places that actually needed to be more discoverable.
A sitewide footer with identity/contact/chat-entry is still a real,
open TODOS item; if it's ever built, it must be conditional on not being
the home route, not a blanket layout addition.

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

## 2026-08-25 — `:where(.body)` keeps SectionPage's prose rules from outranking components/content

`components/content/*` was built and documented across an earlier session
but never actually mounted inside a `SectionPage` body until War Update and
Fake Resistance did it this session. `sections.module.css`'s generic prose
rules (`.body p`, `.body a`, `.body li`, …) and the content library's own
element selectors (`.corrections p`, `.sourceBody a`, …) land on the same
specificity (one class + one element), so which one wins was decided by
Next.js's CSS chunk order — not something to depend on. Fixed by wrapping
`.body`'s selectors in `:where(.body) …`, which zeroes their specificity
contribution without changing what they match: hand-authored prose in a
`SectionBlock` looks identical, and any `components/content` component
mounted in the same body now reliably keeps its own styling. Do not remove
the `:where()` wrapper to "simplify" the CSS — that reopens exactly this bug
for the next page that mounts a shared content component.

## 2026-08-25 — Volunteer intake composes a `mailto:`, not a fake success screen

No backend endpoint exists for volunteer signups — only the public
`POST /api/v1/reports` endpoint is real. `VolunteerInterestForm.tsx`
composes a pre-filled `mailto:` link on submit instead of showing a
"Submitted!" state with nowhere for the data to go, consistent with the
"no false live state" principle already applied to the "Sustain" donation
prose. `VOLUNTEER_INBOX` in that file (`volunteers@lionsofzion.io`) is a
placeholder pending a confirmed real address — do not treat its presence in
the code as evidence that inbox exists or is monitored.

## 2026-08-25 — "Ask the Lion about this file" pre-fills the composer; it never sends automatically

The new CTA opens the shared chat with a page-relevant starter question
already typed into the composer (via `ChatOpenProvider`'s
`openChat(question)` and `AskTheLionChat`'s `useState` initializer reading
it once at mount), but the visitor still has to press send. Auto-sending was
considered and rejected: a question appearing to come from the visitor
without them choosing to ask it reads as the site putting words in their
mouth. If this behavior changes, it is a deliberate UX call to make again
consciously, not a refactor side effect.

---

## 2026-08-25 — The phone keeps the live orbit; the static index is a tier, not the home

Reported from a real iPhone as "instead of opening on the circular menu it
jumps straight to this strange page". The intro's outro assembles the orbit
navigation on the phone, and the instant the story completed,
`mobileStaticHome` unmounted the canvas and left the static editorial index.
That handoff was added for battery — don't leave a WebGPU loop rendering
behind a static page — but it made the product's centrepiece desktop-only and
made the end of the intro read as a bug: the menu the outro spends 2.8s
promising was replaced by a document.

Now every width keeps the orbit when a live backend exists. The static index
(`HomeSignalLayer`'s `.mobileHome`) is demoted to the no-JS/no-GPU tier,
gated in CSS on the same `data-canvas` attribute the poster already keys on —
so without JavaScript or when the GPU probe lands on `none`, a phone still
gets the full editorial home. The ordering decision below (menu before the
latest-brief card) still stands for that tier.

The launcher pill is the constraint this uncovers: on phones it is a
full-width dock ~84px above the safe-area inset, in exactly the band the
orbit's bottom node used to own — the two had never shared a screen before.
It is charged into `computeOrbitLayout` as our own bottom chrome
(`CHAT_DOCK_PX`), *stacking on* the home indicator rather than flooring
against it the way the URL-bar reserve does, so the bottom node clears the
pill with the shared edge gap as breathing room above it. Do not resolve a
future overlap by hiding the pill or shaving the halo; re-measure the dock
and charge the reserve.

---

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

## 2026-08-25 — DOM emblems render the SVG sources; SDF stays GPU-only

The section-page rail rendered the baked `*.sdf.png` icons, which have no
alpha channel and only ever looked acceptable through a blend-and-filter
chain that broke on anything but the darkest ground — visually a black box.
The DOM now uses the SVG icon sources (as the brief already did); the SDF
bakes remain solely for the GPU sampler in the particle scene. Re-baking the
SDFs with alpha is still worthwhile for the GPU path (Mac-gated task in
TODOS), but do not point DOM `<img>` tags back at SDF bakes.

---

## 2026-08-25 — The mobile home leads with the menu, not the latest brief

Reported from a real iPhone as "it jumps straight to the brief" — with the URL
still on `/`. Nothing navigated. The mobile home *opened* on the latest-brief
card: brand and lion consumed the first ~400px, the full-width card reading
"REFERENCE BRIEF · CONFIRMED / Open evidence desk" took the centre of the
screen, and all eight destinations sat below the fold. After a 47-second intro,
whatever this screen leads with is what a visitor believes they landed on.

So the order is now brand → lion (8.75rem, down from 12rem) → the three
navigation groups → the latest-brief card → footnote. The card is not removed —
the latest verified item is the home's strongest proof of life — it is demoted
to a card *on* the menu instead of standing where the menu should be. Do not
move it back above the groups to "surface content": that reading was the bug.

---

## 2026-08-25 — The chat launcher is absent during the intro, not hidden

The stylesheet already hid it under `body:has([data-intro-active])`, and hiding
was not enough. Three failures live entirely outside what CSS can reach:
`ChatParticleCanvas` kept a second `WebGPURenderer` and ~12,900 particles
rendering behind `visibility: hidden` for the whole intro, against the standing
rule that one renderer owns both acts; the attention cue's 7.2s loop free-ran
while invisible and could return mid-pulse; and the launcher stayed in the tab
order with nothing to do.

The signal travels as a DOM attribute rather than through the repo's first
context, because the launcher is mounted by the root layout and the canvas by
the page — siblings under `<body>`, with no provider between them — and the nav
already publishes this state for the stylesheet. A `MutationObserver` behind
`useSyncExternalStore` is the same shape as the four media-query stores already
here.

`introRunning` cannot be true before hydration, so a launcher keyed on it alone
paints once and is then told to disappear. `CanvasMount` therefore also emits
`data-intro-pending` — the same claim made early, present in the server HTML
whenever this mount is asked for an intro and dropped in the commit that rules
one out. The launcher's server snapshot is the route, so the two agree at
hydration. Without JavaScript the launcher is now absent on `/` rather than
present and dead, which is the better of the two.

The CSS rule stays as a paint-time belt for the 900ms handoff window, and the
three attribute names live in one module because there are three readers and a
rename that reaches two of them fails silently.

## 2026-08-25 — `nodeVisualRadius` is three contracts; the painted extent is a fourth field

The orbit was solved against `nodeVisualRadius`, which is named for the ring but
is also the DOM link's half-box — `.link` is sized to the same
`clamp(min(w,h) * 0.056, 44, 68)` — and the connector's occlusion boundary.
Widening it to cover what is drawn past the ring would have shortened every
connector and desynchronised the hit target from the mark. So the halo is
`nodeHaloRadius`, a separate field, and the old one keeps all three contracts.

Its px term is empirical and says so. Per-particle jitter is derivable (4.3% of
the radius); the sprite's half-size is bounded; but `bloomRadius` is a
screen-space mip spread with no world extent to read off, so the only honest
form for it is a number to re-measure when something clips.

The vertical solve stopped collapsing the safe area with `Math.max`. That
discarded direction and charged the larger reservation to both edges, which
shrank the orbit and still left the bottom node sitting on its own reservation.
Each edge is now charged its own, with `centerY` offsetting the ellipse by half
the difference — from which a useful property falls out: reserving at the bottom
raises the bottom node and leaves the top node exactly where it was.

The bottom reserve is a floor and applies to phone widths only. A phone's
reported viewport is not its visible one — a collapsing URL bar sits across the
bottom of it, and `env(safe-area-inset-bottom)` describes the home indicator
instead — while on desktop the reported viewport really is the visible one and
charging it there would shrink the orbit for chrome that does not exist.

`centerY` is folded into `nodePosition` rather than applied as a group offset in
`Scene`. The group form would leave `Connectors` computing in lion-local space,
where `normalize(node)` would aim at the ellipse's centre instead of the lion's.
Through `nodePosition` the vector is already in world space and the lion is at
the origin, so the connectors keep aiming at it and simply fan asymmetrically.

`NetworkScan`'s stranded `+0.22 / -0.14 / +0.32` were left alone. Folding them
onto the halo would shrink the scan-field exclusion by more than half — a
visible density change that wants its own commit and its own screenshot.

## 2026-08-25 — The intro's line cap is a fraction, and the travel is scaled only where it clips

`viewWidth - 0.48` is a fixed margin, so the fraction of the frame it left
depended on the frame: 70vw at 320x568, 85vw at 390x844, and **170vw at
768x1024**, where a portrait tablet takes the desktop line breaks against a
frame of 5.09 world units and the desktop cap is 8.65. The widest line has been
running off both edges of a portrait tablet, and no test, typecheck or
screenshot at a desktop aspect could see it. The floor beneath that cap could
also exceed the frame it was protecting.

The cap is now a fraction with the authored size as a ceiling, and the scale is
solved once across the measured lines instead of per line. Per line, each solved
`min(fontScale, cap / itsOwnWidth)`, so wherever the cap bound the type size
stepped between rows — invisible in code, obvious on a phone.

"No frame in which text leaves the safe area" is not implementable literally.
Alpha is `built * (1 - erased)`: a particle is invisible where it starts and
where it ends, and enforcing containment on every mote at every alpha flattens
the effect on desktop as well as mobile. The implemented reading is two-tier —
settled text is hard-bounded, and a particle in motion is bounded only while it
is still legible — with the legible window written down as a constant rather
than left implicit.

Depth is scaled alongside width because it is not free: pulling a particle
toward the camera magnifies its screen position and spends the same horizontal
margin. The solve only ever tightens across its passes, so the result is
conservative by construction rather than by convergence.

Desktop keeps the authored trajectory untouched. Its frame is three times wider
in world units, nothing clips there, and a bound derived for a phone is not a
reason to change a composition that works.

---

## 2026-08-24 — The verdict travels beside the retrieved text, never inside it

Chat is the most persuasive surface in the system and used to see the least.
`search_document` indexes title, body and language only — deliberately, so a
query for "verified" does not match every verified item ahead of an article
about verification. Right for search; wrong for chat. A model handed *"the
hospital was struck at dawn"* and nothing else will summarise the claim as
though it stood, because nothing told it otherwise. The citation guard proved
the citation was real; it never claimed the conclusion was.

So `documentsFor()` now LEFT JOINs `information_item` and its current
assessment at retrieval time, and the answerer renders an explicit
`OUR FINDING:` line beneath each excerpt. Two properties this buys, both
load-bearing:

- **The index stays clean.** A test asserts no verdict vocabulary appears in
  `search_document.title`/`body`, and that searching "false" returns nothing.
- **The finding is never stale.** The projection is refreshed by a queue drain
  and can lag minutes; `information_item.assessment` is trigger-maintained and
  correct instantly. Reading it live is what stops the two disagreeing.

Three states are distinguished rather than flattened, because collapsing any
pair produces a specific failure: an unpublished finding is marked *not
settled* (otherwise internal review leaks as fact), an unassessed claim says
*not yet assessed* (otherwise silence reads as a clean bill), and
`known_gaps` is carried through (an answer that drops the caveats is worse
than one that drops the finding). Evidence and narratives get no verdict —
evidence is material, and a narrative deliberately has no assessment at all.

## 2026-08-24 — The skip control is real type, not particle geometry

Every readable mark in the intro is particle geometry, and the skip button used
to be too: `SKIP INTRO` sampled from the Cinzel outlines and merged with a
capsule ring, drawn through the same TSL sprite material as the story lines.

At label size that treatment cannot win. Ten glyphs inside 132px leave about
10px per character, so the strokes are barely two pixels wide — too little room
for sampled dots to read as either letters or grain. Three things compounded on
top of that. `edgeDrift` in `introTextMaterial.ts` is authored in cloud units,
so the wobble that is a subtle shimmer on a full-width story line was roughly
1.5px of vertical smear on 42% of the label's particles. The capsule was the
brightest continuous shape on screen at `#FFE9B0`, well over the 0.46 bloom
threshold, so it bloomed and dragged the word into the glow with it. And the
density that made the word legible was exactly the density at which the dots
merged into solid strokes — legibility and visible grain pulled in opposite
directions with no setting that satisfied both.

So the skip control is now the one intro mark rendered as DOM type: a 26px rule,
`Skip intro` in Cinzel at 11px, and a double chevron, bottom-right, no
container. It is sharp at every DPR, it contributes nothing to the bloom, and it
matches the vocabulary the eight nav labels already use. `buildCapsuleCloud`,
`mergeClouds` and the `skipFocusRef` plumbing from `CanvasMount` through `Scene`
into `IntroText` all went with it.

Chosen from four directions drafted side by side; the three rejected ones kept
the particle label and traded away legibility, buttonness or both.

The invariant in CLAUDE.md that all readable marks are particle geometry now has
exactly one exception, and this is it. Do not "restore" the particle skip label:
it was tried at three densities and every one of them failed differently.

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
## 2026-08-24 — The intro hands off to one deferred particle navigation, with a real static path

The photographic post-intro page was not adapted; it was retired. The target
visual language is a single particle system — crowned lion, radial navigation
and network scan — and keeping the photograph underneath would preserve the
very composition this integration replaces.

The new GPU scene does not run beside the intro for the full story. It starts at
`onOutroStart`, so its 2.8-second lion assembly coincides with the intro's
2.8-second veil reveal. This preserves a continuous handoff without paying for
two full particle engines for roughly forty seconds.

The navigation DOM and poster still render in the first HTML response. They are
made inert only after hydration proves the intro can run. A `noscript` rule
hides the intro enhancement, leaving the poster and the same eight real links
usable when JavaScript or GPU startup is unavailable. This is why the static
path is not a second navigation implementation.

## 2026-08-24 — The cover fit is solved for, not chosen, and the document was wrong about it

`docs/graphics-task-02.md` identified two ways the lion plane failed to cover its
frame: above aspect ~1.76 horizontally, and on every phone in portrait. It also
asserted that vertical cover "always held" in landscape. It did not. The old
`s = 1.02` gave a half-height of 3.14 against a requirement of 3.44 once the
parallax amplitudes and the lion mesh's private `+0.14` lift are counted. The
composition has been off the top or bottom of a 16:9 frame, at the extremes of
its own drift, the entire time.

`fitComposition` now solves for the scale rather than picking one: it covers
with every parallax at its extreme *and* the breathing scale at its minimum, on
both axes, and the focal pan then takes only the vertical headroom left over.
The mesh's `+0.14` and its duplicate in the particle sampler are gone —
`planeOffsetY` owns vertical framing, and two constants deciding one thing is
how they came to disagree.

`tests/composition-fit.test.ts` states this as invariants rather than as a
screenshot, because none of it is visible in a typecheck, a lint or a build, and
it is only visible in a screenshot if somebody takes one at the right aspect.

## 2026-08-24 — The navigation layer composites over the background rather than merging into it

The task document says "do not build a second particle engine; extend the one
that exists". The nav layer has its own renderer and its own canvas, which is a
deliberate deviation.

`LionExperience` is a 1,200-line imperative effect, not a reusable engine.
Extending it in place would have meant adding the whole nav system to that file;
extracting an engine from it is a larger refactor than this task, and one that
would have put a rewrite of the deployed homepage in the same change as a new
feature. Two canvases composited is also the pattern the repo already uses — the
intro plays over the homepage exactly this way.

What actually prevents divergence is not one renderer, it is one contract:
`components/graphics/viewport.ts` owns measurement, the cover fit, the DPR
policy and the focal point, and every layer reads it. The target/force model is
shared by convention (`mix(targetA, targetB, t)` plus accumulated forces), and
the six-draw-call budget is met within the layer.

## 2026-08-24 — Recession is the only thing the navigation may ask of the lion

`LionExperienceHandle.setRecession(t)` is the entire coupling between the two
layers. The navigation says how present it needs the lion to be; the lion
decides what that means — a quarter luminance, a thinned particle cloud, an
ambient field on a slowed clock, and its hero wordmark retired, since the
navigation's header carries the name from then on.

At rest the navigation asks for 0.35, not 0. The lion is still the page. Opening
a section asks for 1, and only then does the central mark take the centre —
which is why the mark is gated on `recession > 0.5` rather than on a flag: there
is one channel, and both sides read it.

The handle writes the CSS variable as well as the render loop, because there may
not be a render loop. Without a WebGL context the scene is a static image and
the DOM half still has to step back.

## 2026-08-24 — One breakpoint, shared, or the two halves cover each other's nodes

The panel's footprint is declared in `ring-geometry.ts` and the ring is fitted
into what is left of the frame; the stylesheet is told which mode it is in via
`data-panel`.

This is not tidiness. The first version let CSS decide with a media query while
the geometry decided with its own aspect ramp, and at a square viewport the
stylesheet opened a bottom sheet while the geometry was still fitting a circle.
The sheet landed on three nodes and swallowed their clicks — caught by the
browser pass, not by any test, and not visible in any single screenshot.

`tests/nav-layout.test.ts` now asserts that the open layout has exactly one
discontinuity and that it sits at the aspect `panelModeFor` declares. A second
threshold appearing anywhere fails that test.

## 2026-08-24 — Gold is bounded by geometry, and the bound caught a real breach

The palette rule — gold never exceeds 6% of visible particles — is enforced by
where gold can occur rather than by discipline: within 1.5 node radii of a
hovered or active node, and nowhere else. That makes it checkable as an area
bound, which is what `tests/nav-layout.test.ts` does.

It failed on first run at 6.5%, at square aspects. The halo was gilding
particles out to 2.3 node radii. The shader was clamped to the document's 1.5,
not the test to the shader.

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

## 2026-08-23 — The photographic lion will be replaced by the Signal Field

The `/design` brief's §19 end state is a Live Signal Field behind a header. The
photographic blue lion (`components/LionExperience.tsx`) does not appear in it,
and §8 says the *particle* lion becomes the field.

Confirmed with the user rather than assumed, because it discards a component
merged and deployed the same day. **Not yet acted on** — `LionExperience` is
still the homepage. When it goes, the code stays in git history.

## 2026-08-23 — Intro shortened by cutting words only, not timing

Reverted first attempt, then redone narrowly.

The first attempt rewrote the sequencer to show one statement at a time and
reduced `lionRelocation` from 1.0 to 0.34, reasoning from brief §1 that the
lion should stay the centrepiece. It typechecked, linted and built clean — and
put "OCTOBER 7, 2023" across the lion's eyes and nose. The lion vacates a lane
precisely so the copy has somewhere to go; shrinking the relocation closed it.

Reverted whole. The redo changed only the words inside the existing 12 beats:
24 desktop lines → 14, ~44.5s → ~39s. The rolling four-line window, the beat
timings and the relocation are all untouched.

Two lessons, both now enforced:
- Composition changes must be screenshotted before moving on. Static gates
  cannot see them. Hence the `verify-intro` skill and `intro-frame-reviewer`.
- The beat **count** is load-bearing (`STORY_PARAGRAPHS` indexes `[0..11]` by
  hand, `STORY_BEAT_STARTS` is a parallel literal). Hence the
  `check-story-timeline` hook.

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

## 2026-08-23 — The intro plays over the homepage, not before it

The obvious merge is two screens that swap. This is not that.

The homepage renders from the first frame and the intro plays on top of it: the
intro's renderer is `alpha: true` with a zero clear colour, so the black is its
own veil, which fades over 2.8s at the outro. By the time it lifts, the
homepage lion has been waking underneath for the whole intro.

`LionScene` was already built for this — `mode="handoff"`, `onComplete`,
`onFailure` and the transparent clear colour all pre-existed.

The payoff is that every escape is free: Skip, a WebGL failure, or
`prefers-reduced-motion` just unmounts the intro onto a page that is already
finished. That is why `Experience.tsx` reads reduced-motion during render via
`useSyncExternalStore` and not in an effect — an effect would show such a
reader one frame of the thing they asked not to see.

Cost: `LionExperience`'s wrapper needed `isolation: isolate`. It is `fixed`
with `z-index: auto`, so its own z-indexed typography was escaping into the
root stacking context and painting through the intro.
