# Vercel infrastructure

This is the operational architecture for Lions of Zion. It records boundaries
and verification steps, never credentials or assumed provider state. Confirm
all identifiers and live settings in the relevant provider consoles before a
Production change.

## Editorial package topology

```mermaid
flowchart LR
  C[ChatGPT editorial task] --> G[Dedicated GitHub package branch]
  G --> A[GitHub Action]
  A --> R[Authenticated receiver]
  R --> J[Durable editorial-run ledger]
  J --> Q[Vercel outbox queue]
  Q --> W[Package executor]
  W --> D[(Neon Postgres)]
  W --> B[Vercel Blob media]
  W --> P[Published article projections]
  P --> CDN[Vercel CDN]
```

- ChatGPT performs research, selection, composition and editorial judgement
  outside the application. The dedicated branch never merges into `main` and
  is excluded from Vercel deployment.
- The receiver validates a package, resolves source/evidence references and
  records a durable execution run. The executor owns media, canonical updates,
  homepage selection and cache invalidation; it never chooses what to publish.
- `external-briefing-v1` and `briefing-packages` remain legacy compatibility.
  The next whole-site schema will use `editorial-packages`; neither branch may
  deploy the application.

## Environment isolation

Production and Preview must use distinct resources and declare matching labels:

```text
DATABASE_RESOURCE_ENV
BLOB_RESOURCE_ENV
QUEUE_RESOURCE_ENV
SEARCH_RESOURCE_ENV
```

Each must equal the runtime environment. `BRIEFING_BLOB_RESOURCE_ID` must not
match `OCTOBER7_BLOB_RESOURCE_ID`. Preview is forced to dry-run for briefing
collection and processing and cannot publish; the October 7 archive is outside
this pipeline and retention process.

The administrator status view also shows one-way fingerprints for the database,
briefing Blob store, October 7 archive store, Google search engine binding, and
the queue resource when `BRIEFING_QUEUE_RESOURCE_ID` is supplied.
These fingerprints are comparison aids only; they do not replace provider-side
verification of queue and search resource ownership.

Provider-side completion record:

1. Create a separate Preview database branch and record its provider resource ID.
2. Create a separate Preview Blob store and record its store ID.
3. Create separate Preview queue and search bindings; do not reuse Production
   identifiers or credentials.
4. Repeat the check for Development, or explicitly document that Development
   is local-only and has no production-connected briefing workers.
5. Compare the resulting bindings in the administrator status view, then run
   the isolated migration and restore checks before promoting code.

Current Development record: the Vercel Development environment has no
`DATABASE_URL`, briefing Blob resource, Agent Search binding, or queue binding.
It is therefore local-only and cannot start a Production-connected briefing
worker. The current Vercel environment listing also shows distinct briefing
Blob store IDs for Preview and Production, both separate from the October 7
archive store. This still does not prove Preview/Production separation for the
database, queue, or search binding; those provider-side identifiers require
verification.

## Required production configuration

Names only; see `.env.example` for the complete non-secret template.

- Neon: `DATABASE_URL`, administrator-auth settings, and the resource label.
- Vercel Blob: `BLOB_READ_WRITE_TOKEN`, briefing resource ID, and label.
- Vercel Queues: Vercel OIDC capability, region, and resource label.
- AI Gateway: Vercel OIDC or the approved local-development credential.
- Google Agent Search: project, serving configuration, Workload Identity
  Provider, service-account email, search label, hard query limit, and budget.
- Internal routes: `CRON_SECRET`, `INTERNAL_API_SECRET`, and rate-limit key.

The package receiver and outbox dispatcher are explicitly bounded in
`vercel.json`. Memory remains controlled by the active Vercel compute plan and
must be verified in the provider settings rather than declared through this
file.

Google authentication is Vercel OIDC to Google STS to service-account
impersonation. Do not create, upload, or store a long-lived JSON key.

## Schedules and triggers

`vercel.json` owns the authoritative schedules. Four technical crons remain:

```json
{
  "crons": [
    { "path": "/api/internal/cron/ingest", "schedule": "0,30 * * * *" },
    { "path": "/api/internal/cron/embed", "schedule": "10,40 * * * *" },
    { "path": "/api/internal/cron/outbox-drain", "schedule": "*/15 * * * *" },
    { "path": "/api/internal/cron/maintenance", "schedule": "20 3 * * *" }
  ]
}
```

No cron or Vercel Queue trigger starts editorial research, drafting, selection,
or a daily publication. The legacy receiver accepts an externally composed
package at `POST /api/internal/briefing/external-publish`, idempotent on
`external_briefing_submission.run_id`. The future whole-site receiver follows
the same authenticated delivery model with explicit package operations.

## Deploy and recovery

1. Snapshot the database and Blob state before a migration or broad cleanup.
2. Apply migrations in an isolated Preview environment and run tests.
3. Verify Preview labels, no-publication behavior, and source collection.
4. Validate an externally composed package against the receiver in an isolated
   Preview environment.
5. Promote only after its documented evidence exists. A promotion that changes
   the briefing pipeline's contract — the quality-check list, a stage artifact
   shape — belongs between editions rather than during one; there is no fixed
   run window anymore, so "between editions" means between a published edition
   and the next package receipt or admin run. A rollback strands an in-flight
   edition exactly as the deploy did, and `CLAUDE.md` states the rule for
   deploys that add or remove a briefing quality check.
6. When the release changed `server/modules/sources/catalog.ts`, run the
   catalog sync and then activate the new sources by hand. The sync only
   creates, and everything it creates is inactive, so a rewritten discovery
   query collects nothing until an operator verifies it and deactivates the
   entry it supersedes.

For a faulty code deployment, use Vercel Instant Rollback. Database migrations
are fix-forward or restored only to an isolated database; do not remove or
reverse an applied Production migration in place.

A migration is not the only way the stored shape moves. A publication's
`narrative_watch_details` is a jsonb column, so a release can add a field to it
and read the field back with no migration at all — meaning "this deploy had no
migration" is not evidence that a rollback is clean, and the rolled-back code
may have no branch for what the newer code wrote there. `.ai/ROLLBACK.md` lists
the shapes that currently behave this way and the queries that find them. Full
backup, restore, retention, and incident procedures are in
`docs/briefing-packages.md` and `.ai/ROLLBACK.md`.
