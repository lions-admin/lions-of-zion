# Daily Brief operations

This runbook covers the automated geopolitical brief only. It never applies to
the October 7 archive.

## Safety controls

Four independent controls exist:

- `BRIEFING_COLLECTION_ENABLED`
- `BRIEFING_PROCESSING_ENABLED`
- `BRIEFING_AUTO_PUBLISH_ENABLED`
- the database-backed automatic-publication pause in `briefing_control`

For a gradual rollout, set `BRIEFING_COLLECTION_SOURCE_IDS` to a comma-separated
list of source IDs or slugs. Set `BRIEFING_ENABLED_STAGES` to a comma-separated
list of editorial stages. An unset list means all sources or stages; collection
and processing remain independently controllable, and publication remains
production-only.

Preview forces collection and processing off in code and cannot auto-publish.
Production and Preview must each declare matching resource labels for the
database, Blob, Queue, and Search resources. The briefing Blob resource ID must
not equal the October 7 Blob resource ID. Keep automatic publication disabled
until the complete acceptance sequence has passed.

To stop publication without losing collection, leave collection and processing
enabled, set the database pause in the admin console, and leave
`BRIEFING_AUTO_PUBLISH_ENABLED` unchanged. The database pause is evaluated at
the publish stage.

## Pipeline and schedule

Collection creates one durable job per source and half-hour Israel-local
window. There is no scheduled briefing scheduler any more: commit `c1e579b`
(2026-09-03) removed its schedule from `vercel.json`, so an edition is queued
by the admin run button (`POST /api/v1/admin/briefing/run`) or arrives as an
external package (`POST /api/internal/briefing/external-publish`). The briefing
cron route still exists for a scheduled return; re-enabling it requires the
briefing deploy rule documented in CLAUDE.md. Stage delivery still queues:

```text
enrich -> cluster -> triage -> draft -> quality -> publish
```

Messages carry only a version and job ID. The job ledger supplies idempotency,
leases, heartbeats, attempts, checkpoints, permanent quarantine, and recovery
after a deployment interruption. A stage is never started while collection
jobs for that day remain open.

## What one edition contains

The edition serves three jobs in priority order: refute anti-Israel narratives,
publish one regional geopolitical Daily Brief, publish one interesting Israel
story. Refutation is the declared primary objective of triage, not a filter
applied afterwards.

A complete edition is one `daily_brief`, up to five `narrative_watch` records,
and up to three `israel_update` articles. A minimum of one refutation and one
Israel story is a target, not a quota — a day whose material supports neither
ships without them, and a short edition is not by itself an incident.

The Daily Brief is different: it is structurally required, and a refutation is
an addition to a normal edition rather than a substitute for one. If triage
selects no citable story, the draft stage stops with
`no_citable_supported_stories` and no edition is produced at all. That surfaces
as the "missing edition after 10:00 Israel time" alert, and it is worth
investigating — it usually means collection, not editorial judgement.

**`war_update` was removed completely** (owner decision 2026-09-05, see
`.ai/DECISIONS.md`): it was an unused model path, and its surviving rows were
machine-published pipeline residual — no human ever approved or created one.
The rows were deleted and the value left the section contract, the labels and
the docs; the pipeline cannot produce it, and no write or read surface accepts
it. The `/war-update` route survives as a permanent redirect so the public
URLs keep resolving.

### Unsourced analysis records

One Narrative Watch record per edition may publish citing no source at all,
labelled as this organisation's own analysis. In admin it shows as
`analysis · no source cited` on the publication row; on the public article it
carries a second kicker badge, a disclosure paragraph, an `Evidence basis` row,
an `Analysis: ` title prefix instead of `Reported claim: `, a marker on the
OpenGraph card, and a "Why this record cites no source" block in place of the
sources list. The brief hub carries a basis marker on the same record. If any
one of those is missing after a deploy, treat it as an incident and pause
automatic publication: the marking is the whole basis on which the record is
allowed to exist.

Two things an operator should know about it:

- **The basis is derived, not declared.** On the pipeline's own path it is
  exactly an empty `evidenceIds` array on the drafted article, computed after
  the model has returned. There is nothing the model can set to obtain it, and
  that is deliberate: the draft retry loop hands the model every quality
  failure string from the previous attempt, so a model-set flag would be found
  and used to switch off seven evidence checks within one regeneration. A
  record the pipeline marked as analysis genuinely cites nothing anywhere.
- **It is all-or-nothing.** A record that cites some things and not others is
  rejected outright rather than downgraded — at the draft schema, at the create
  contract, and again in the quality checks. So no edition can produce a
  half-sourced analysis record, and a quarantined draft complaining about one
  is the gate working, not a malfunction.

The admin editor shows the basis as a read-only row and preserves it verbatim
on save, so ordinary editing cannot relabel a record. **`PATCH
/api/v1/publications/:id` can.** `updatePublicationSchema` accepts a whole
`narrativeWatchDetails` object, `evidenceBasis` included, and carries none of
the all-or-nothing refinements that guard the create path — so a hand-written
API call can strip the disclosure off an unsourced record or attach it to a
sourced one, and nothing downstream will contradict it, because the whole
public marking reads from that stored field. Do not send `evidenceBasis` by
hand. Correct a wrong record forward with a new version instead. This is a real
gap, not a procedure: the update path is not held to the same contract as the
create path.

## Providers

- RSS and Atom are direct-source connectors.
- Google Agent Search is discovery for the configured domain allowlist. It
  authenticates with Vercel OIDC, Google STS, and service-account
  impersonation. Static Google API keys and service-account JSON files are not
  accepted by the runtime.
- OpenAI model profiles are fixed to `openai/gpt-5-nano` for triage and
  `openai/gpt-5-mini` for drafting. There is no silent fallback.
- X and the Grok chat configuration are outside this pipeline.

Before enabling Google, verify the monthly query and monetary ceilings, the
allowlist, index retention, least-privilege IAM role, and budget alerts in the
authenticated provider consoles.

## Changing an Agent Search query

`syncBriefingSourceCatalog` **only ever creates an `agent_search` source. There
is no update path.** It skips any catalog entry whose slug, or whose derived
logical key, already exists. For a search source that key is
`agent_search:query:<normalized query>` — the query text trimmed, lowercased
and whitespace-collapsed, not a hash — so a cosmetic reformat of a query is
correctly recognised as the same query, and any real change to the wording
produces a new key. Editing a query string in place therefore changes nothing
in the database: the live source keeps running the old text while
`server/modules/sources/catalog.ts` claims the new one, and nothing reports the
divergence.

The rule that follows is **change the query, change the slug**. A rewritten
query then arrives as a *new* source, always `active: false`, and the source it
replaces has to be deactivated by hand. Nothing starts scanning by itself, and
nothing stops scanning by itself either.

Note also that the entry's `group` field is written into the created source's
`config` and read by nothing. It records which article a query was collected
for and is useful in the admin audit; retagging one changes a label, not
behaviour. Only `query` has an effect.

### The 2026-09-01 rewrite — an operator action, not a deploy artefact

The discovery mix was rebalanced from five `war_update` queries, three
`israel_update`, one `daily_brief` and one `narrative_watch` to four
`narrative_watch`, three `daily_brief` and three `israel_update`, matching the
edition's stated priorities. Two entries kept their slug and their query
verbatim because their collection must not be interrupted:
`agent-search-anti-israel-narratives` and `agent-search-israel-resilience`.

The other eight are rewrites. **After the deploy, run the catalog sync, then
verify and activate these eight new sources:**

```text
agent-search-idf-conduct-accusations
agent-search-israel-legal-delegitimization
agent-search-coordinated-anti-israel-campaigns
agent-search-israel-security-operations
agent-search-iran-axis-regional-threats
agent-search-regional-diplomacy-statecraft
agent-search-israel-innovation-research
agent-search-israel-heritage-society
```

**Then deactivate the eight they supersede, manually:**

```text
agent-search-israel-official-updates
agent-search-idf-security-brief
agent-search-israel-current-affairs
agent-search-israel-security
agent-search-iran-regional-security
agent-search-hezbollah-lebanon
agent-search-hamas-gaza
agent-search-international-israel-coverage
```

Activation uses the same authenticated verify-and-enable action as any other
source; a failed verification leaves the source disabled and out of the
collection round. Until both halves are done the system is in a defined but
undesirable state: doing only the first half runs both generations of query
against one monthly search ceiling and collects the same material twice, and
doing only the second half leaves the edition with two discovery queries. Do
them in the order given, in one sitting, and then confirm in the admin console
that no superseded slug is still active. Ten is the ceiling, not the
expectation: a query that fails verification stays disabled, which is correct.

## Backup before schema or cleanup work

```bash
npm run briefing:backup -- /secure/off-device/directory
```

The command creates a PostgreSQL custom-format dump and a checksum manifest.
Store both outside the repository. For Neon, also create a provider branch or
point-in-time snapshot before the Production migration.

Before promoting a briefing deployment, run the unified gate. It executes the
contract and simulation checks first and only then invokes the environment-
labelled migration preflight:

```bash
pnpm briefing:predeploy preview
pnpm briefing:predeploy production
```

The production form still requires a real pre-migration backup manifest. A
failed check stops before any migration is applied.

To inspect RSS connectivity without changing the source catalog or database:

```bash
pnpm briefing:sources:connectivity
```

This is a network diagnostic only. It does not enable a source; enabling still
requires the authenticated verifier and a valid feed item in the target
environment.

On 1 September 2026 the diagnostic found 16 valid feeds out of 23 candidates.
The seven remaining candidates are deliberately not enabled: the government
channel, Haaretz, Arab News and UNRWA returned a non-feed response or access
block; Al Jazeera and Press TV failed to connect; and the Washington Institute
endpoint returned not found. Re-run the diagnostic before changing any of
these endpoints, and do not bypass a provider access challenge.

Migration preflight is explicit about the target and refuses a redacted or
cross-environment database URL:

```bash
DATABASE_URL='postgresql://...' DATABASE_RESOURCE_ENV=preview \
  npm run briefing:migrate:preflight -- preview
```

Production additionally requires `BRIEFING_MIGRATION_SNAPSHOT` to point to the
backup manifest created before the migration. The script runs the migration
integrity suite before `db:migrate` and uses only the journaled migration files.

Archive the six known defective publications only after the backup exists:

```bash
npm run briefing:archive:defective -- \
  --ids=id1,id2,id3,id4,id5,id6 \
  --snapshot=/secure/path/backup.dump.manifest
```

This is a soft public deletion: it archives exactly six resolved records and
removes their homepage slots. It preserves evidence, model runs, versions, and
audit history. It does not query or mutate October 7 storage.

## Restore drill

Never point the restore command at Production. Provision an empty isolated
database and run:

```bash
RESTORE_DATABASE_URL='postgresql://isolated-target' \
RESTORE_DATABASE_RESOURCE_ENV='restore' \
RESTORE_DATABASE_RESOURCE_ID='isolated-resource-id' \
PRODUCTION_DATABASE_RESOURCE_ID='production-resource-id' \
  npm run briefing:restore:verify -- /secure/path/backup.dump --isolated
```

The resource identifiers must be the provider resource IDs, never URLs or
secrets. The script refuses a restore without the explicit `restore` label or
when the isolated and production resource IDs match. It verifies the checksum,
restores with `pg_restore`, and queries the migration, publication, evidence,
and briefing-run tables. After restoration,
deploy the same code revision, warm `/sitemap.xml`, and run the public smoke
test. Record the target, start/end time, row counts, and result in the incident
log. Database rollback is always a fix-forward migration or isolated restore;
never remove an applied migration from Production.

## Retention

| Record | Initial retention | Deletion rule |
| --- | --- | --- |
| Raw direct-source capture | 30 days | Private `briefing/raw/` objects only; delete only when every database reference is older than the window |
| Permitted source excerpt and metadata | 365 days minimum | Keep while cited by a publication, claim, narrative, correction, or audit record |
| Model artifacts and token/cost ledger | 365 days minimum | Never delete while linked to a retained edition or publication |
| Job deliveries and source fetches | 90 days minimum | Keep permanent quarantine and incident-linked rows |
| Audit records, versions, corrections, claims, and published evidence | Indefinite | No automated physical deletion |
| October 7 archive | Indefinite and excluded | Never touched by briefing cleanup |

Preview raw cleanup first:

```bash
npm run briefing:retention:dry-run -- --days=30
```

Apply only after reviewing the dry-run and confirming the isolated Blob IDs:

```bash
BRIEFING_RETENTION_CONFIRM=briefing-only \
  npm run briefing:retention:apply -- --days=30 --orphan-grace-days=7
```

The script lists only the isolated `briefing/raw/` prefix. It separately finds
objects that have no remaining `source_fetch` reference, requires a seven-day
minimum orphan grace period, and deletes an orphan only with its current ETag
so a concurrently changed object is retained. URLs are hashed in its output;
the October 7 archive store is never scanned.

## Monitoring and incidents

The public health route returns only a general status. The authenticated deep
health route performs a database query, a private Blob write/delete probe,
model-availability validation, short-lived Google identity validation, and a
Queue configuration check without publishing content.

Daily maintenance creates durable, deduplicated alerts for failed runs,
permanent quarantine, repeatedly failing sources, a Queue age over 30 minutes,
80 percent budget usage, and a missing edition after 10:00 Israel time when
automatic publication is expected. Alerts are visible in admin and delivered
to the configured administrator through the transactional outbox.

### Outbox drain and how long a story takes to become searchable

A published story is on its public page immediately; it becomes *searchable*
only once its `search.reindex` outbox row has been drained and consumed. The
drain cron runs every fifteen minutes and hands the queue at most
`DEFAULT_DRAIN_LIMIT` rows per tick.

That limit is **250**, raised from 25 on 2026-09-01. The load that sets it is a
briefing edition: it materialises roughly one claim per paragraph, so it
emitted about 380 rows at once — roughly 190 `search.reindex` and roughly 190
`item.detected`, a topic whose consumer had been a deliberate no-op since the
day it was written.

Two changes landed together. Removing the `item.detected` producers halves the
backlog to about 190 rows, and 250 drains that on the first tick with room for
a double-length edition plus the ordinary traffic that accumulated in the same
window.

At the old default the arithmetic was the visible symptom. The reindex rows
alone are eight ticks at 25 a tick — two hours, so a story published at 05:00
was not searchable until nearly 07:00 — and rows drain in `availableAt` order,
so the no-op topic interleaved with them and the full 380-row backlog took
about 3.8 hours to clear. If that lag reappears, check the drain result counts
before suspecting the queue: a backlog draining steadily at exactly the limit
is a throughput problem, not a stall.

The ceiling on raising it further is `maxDuration = 60` on
`/api/internal/cron/outbox-drain`. Each row costs one queue send plus one
single-row update, so 250 finishes well inside that budget even pessimistically.
Overshooting is not destructive in any case: `published_at` is committed per
row, so a timeout mid-drain leaves the remainder pending and the next tick
resumes from there.

**`item.detected` is retired, not deleted.** Nothing emits it, and re-emitting
it is now a type error rather than a convention — it lives in `RETIRED_TOPICS`
and `emit()` accepts only a live `Topic`. Its consumer is deliberately kept as
a tombstone, because rows written before the change may still be undrained in
Production and `dispatchOutboxMessage` throws on an unregistered topic; a queue
message for one would then retry against that throw until the queue gave up.
The consumer may be deleted only once

```sql
SELECT count(*) FROM outbox WHERE topic = 'item.detected' AND published_at IS NULL;
```

reads 0 in Production and the queue holds nothing in flight. Retiring a topic
is two deploys, not one. `embedding.refresh` needed no tombstone by contrast:
it had zero producers in the whole git history and was never emitted by any
commit, so both topic and consumer were removed outright.

Incident order:

1. Pause automatic publication in admin.
2. Leave collection running unless the source or credential itself is unsafe.
3. Inspect the alert, job, stage, source, edition, provider, model, and request
   IDs in admin logs.
4. Quarantine bad output; archive a bad public article without deleting its
   evidence or run record.
5. Rotate an exposed secret in the provider console, remove the old credential,
   redeploy, and verify that logs and admin responses contain no value.
6. Resume with one manual idempotent run before restoring the schedule.

### Runbooks by incident

**Provider unavailable.** Pause only the affected connector or model profile;
leave unrelated collection running. Confirm the provider status outside the
application, inspect the last structured failure by request, source or model
ID, then retry one idempotent job after the provider recovers. Do not replace
an unavailable official source with a weaker source family merely to produce
an edition.

**Queue stalled.** Pause automatic publication, inspect the oldest pending,
leased and quarantined job in admin, and compare its `jobId`, stage and edition
ID with the corresponding structured log events. Recover only expired leases
through the maintenance path; do not delete queue messages or create a second
edition. Resume one job, verify its idempotent completion and then resume the
normal schedule.

**Incorrect publication.** Archive the article or the full edition through
admin immediately. This removes it from public projections, homepage slots
and sitemap generation while retaining evidence, versions and audit records.
Correct forward in a new version or restore the archived draft only after a
human review; never rewrite published evidence in place.

**Exposed secret.** Follow the rotation procedure below before any retry. Keep
the affected provider disabled until authenticated deep health succeeds and
the old credential is revoked.

**Budget threshold or ceiling.** Collection may continue, but pause drafting
and automatic publication when the briefing-specific limit is reached. Review
the per-stage model-cost rows, adjust the explicit ceiling only with owner
approval, then restart from the durable pre-model stage rather than repeating
already charged requests.

Before treating a cost rise as a ceiling problem, know what sets the packet
size. Each evidence excerpt handed to the model is truncated to 1,200
characters, against a stored excerpt that can run to 6,000. The row count is
bounded above it: the enrich packet reads at most 120 rows, and the draft
packet is the subset those rows' triage selections cite — at most eight stories
of twelve evidence IDs each. The quality checks still match the drafted article
against the **full stored excerpt**, so the check corpus stays a superset of
what the model saw, and truncation can never fail a check over material the
model did have. If token cost jumps, look at how many evidence rows entered the
packet rather than at excerpt length.

### Secret rotation and exposed-credential procedure

Do not copy a secret, access token, OAuth code, or service-account key into an
issue, chat, commit, screenshot, or command output. The briefing production
path uses Vercel OIDC and Google Workload Identity Federation; there must be
no persistent Google JSON key to rotate.

For every other credential, rotate in this order:

1. Record the incident time, affected integration, environment, and the
   identifier of the old credential in the private incident record. Never
   record its value.
2. Pause automatic publication. Pause collection too if the credential could
   let an attacker impersonate a source, queue, or administrator.
3. Create the replacement in the provider console with the same minimum scope
   and environment boundary. Do not broaden permissions while rotating.
4. Add the replacement to the matching environment only, redeploy, and run
   authenticated deep health. For `CRON_SECRET` and `INTERNAL_API_SECRET`,
   rotate them independently; they are deliberately not interchangeable.
5. Revoke or disable the old provider credential immediately after the
   replacement is confirmed. For a leaked OAuth authorization, revoke the
   provider grant or client secret, not merely the local session.
6. Confirm the old credential no longer works, the new one works only in its
   intended environment, and logs, the admin console, and deployment history
   contain no value. Record only pass/fail, timestamps, and credential IDs.
7. Run one manual idempotent collection-and-processing pass with publication
   paused. Resume the schedule only after that pass and deep health succeed.

If the affected secret is an admin password or recovery method, the account
owner must perform the final password change directly in the provider UI.

## Deploying between editions

There is no scheduled briefing window any more — commit `c1e579b` (2026-09-03)
removed the briefing cron schedule from `vercel.json`, and editions start on
demand from the admin run button or the external composer. The old caution
still applies: deploy the briefing pipeline when no edition is mid-flight, and
prefer a quiet time.

The reason is not general caution. One edition's stages are separate runs, so a
deploy can land between them, and a change to the quality contract then applies
to an edition that was drafted under the previous one. The 2026-09-01 change is
exactly that case: `REQUIRED_QUALITY_CHECKS` went from seventeen names to
eighteen, and `qualityCandidatePassed` recomputes the required count from that
constant. An edition whose quality stage ran before the deploy recorded
seventeen check rows and will therefore never satisfy the eighteen-check gate —
so resume and auto-publish fail for that edition, and only that edition.

The failure is loud and safe rather than silent: the publish stage raises
`Quality checks failed for <candidateKey>` inside the edition transaction, so
nothing partial reaches the public. That is a `VALIDATION_ERROR`, which marks
the edition **quarantined** and visible in admin. Recovery is then the ordinary
administrator "Run now", which restarts a quarantined or failed edition **from
triage** and regenerates it under the current contract — that is what records
the eighteenth check row, not a repair of the seventeen already stored. It does
not create a second edition.

Do not lower the required count to rescue one day's run. That constant is also
what the automatic-publish path counts, and the SQL trigger counting its own
frozen twelve will not forgive an actually-failed check in any case.

The reading path kept a deliberate tolerance while the retirement was staged:
stored artifacts were parsed against a wider section set so an in-flight
edition did not quarantine on its own earlier stage's output. That tolerance
covered stored sections only; it never covered the check count. With the value
fully retired the wider set is gone and the artifact schema is the section
contract.

## Deployment acceptance

1. Use Node 24 locally, in CI, and in Vercel.
2. Create the database and Blob snapshot.
3. Apply migrations to isolated Preview and run RLS/migration tests.
4. Confirm Preview resource labels and dry-run behavior.
5. Run the catalog sync, then reconcile the source catalog by hand: activate
   every new `agent-search-*` source the sync created, and deactivate the ones
   it supersedes. The sync creates and never updates, so this step is not
   optional and no deploy performs it. See "Changing an Agent Search query".
6. Run source verification and live collection with publication paused.
7. Sample direct URLs, publisher attribution, dates, excerpts, canonical URLs,
   source families, and deduplication decisions.
8. Run full processing with publication paused three times on separate daily
   packets. Review every consequential claim and source matrix. If any edition
   produced an unsourced analysis record, read that one end to end and confirm
   every public marking is present before it is allowed to publish unattended.
9. Verify admin edit/archive/feature controls, public APIs, article pages,
   homepage, sitemap, social cards, security headers, rate limits, cache
   invalidation, desktop Chrome, and physical phones.
10. Inject one controlled provider failure and prove retry, alert, quarantine,
    and recovery without publication.
11. Complete and record an isolated database restore drill.
12. Enable the environment flag and database pause only after all prior checks
    pass. Closely monitor the first Production edition and keep the archive
    action ready.

Read-only Production smoke:

```bash
npm run briefing:smoke:production -- https://lionsofzion.io
```
