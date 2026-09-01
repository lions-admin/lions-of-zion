# Daily Brief operations

This runbook covers the automated geopolitical brief only. It never applies to
the October 7 archive.

## Safety controls

Four independent controls exist:

- `BRIEFING_COLLECTION_ENABLED`
- `BRIEFING_PROCESSING_ENABLED`
- `BRIEFING_AUTO_PUBLISH_ENABLED`

For a gradual rollout, set `BRIEFING_COLLECTION_SOURCE_IDS` to a comma-separated
list of source IDs or slugs. Set `BRIEFING_ENABLED_STAGES` to a comma-separated
list of editorial stages. An unset list means all sources or stages; collection
and processing remain independently controllable, and publication remains
production-only.
- the database-backed automatic-publication pause in `briefing_control`

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
window. The 07:00 Israel-local scheduler retries every fifteen minutes across
the two possible UTC hours used by Israeli daylight saving time. It queues:

```text
enrich -> cluster -> triage -> draft -> quality -> publish
```

Messages carry only a version and job ID. The job ledger supplies idempotency,
leases, heartbeats, attempts, checkpoints, permanent quarantine, and recovery
after a deployment interruption. A stage is never started while collection
jobs for that day remain open.

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

## Deployment acceptance

1. Use Node 24 locally, in CI, and in Vercel.
2. Create the database and Blob snapshot.
3. Apply migrations to isolated Preview and run RLS/migration tests.
4. Confirm Preview resource labels and dry-run behavior.
5. Run source verification and live collection with publication paused.
6. Sample direct URLs, publisher attribution, dates, excerpts, canonical URLs,
   source families, and deduplication decisions.
7. Run full processing with publication paused three times on separate daily
   packets. Review every consequential claim and source matrix.
8. Verify admin edit/archive/feature controls, public APIs, article pages,
   homepage, sitemap, social cards, security headers, rate limits, cache
   invalidation, desktop Chrome, and physical phones.
9. Inject one controlled provider failure and prove retry, alert, quarantine,
   and recovery without publication.
10. Complete and record an isolated database restore drill.
11. Enable the environment flag and database pause only after all prior checks
    pass. Closely monitor the first Production edition and keep the archive
    action ready.

Read-only Production smoke:

```bash
npm run briefing:smoke:production -- https://lionsofzion.io
```
