# State

What is true right now. Rewritten in place — this file is never a history, it
is a snapshot. History lives in `DECISIONS.md` and in `git log`.

Anything derivable from git (what changed, who changed it, when) does not
belong here. Only what git cannot tell you: intent, position, and what is
half-finished.

_Last updated: 2026-08-24_

## Where the work is

The repo now holds two unrelated things, deliberately kept apart:

1. **The WebGL experience** — merged, deployed, live at
   <https://lions-of-zion.vercel.app>. Untouched since.
2. **The backend** — Phases 1–4 of 8 complete. An item can go from evidence
   to a reviewed, published verdict end to end; no search, AI or chat yet.

The full eight-phase plan is at `~/.claude/plans/splendid-discovering-dawn.md`.
Read it before starting Phase 5; the sequencing has reasons. This session is
running all remaining phases back to back, one commit per phase.

## Backend — Phases 1–4 complete and green

`npm test` 104/104, `tsc --noEmit` clean, `npm run lint` clean (3 pre-existing
warnings in `LionExperience.tsx`, 1 elsewhere), `npm run build` succeeds with
twenty-two dynamic routes.

Phase 1 shipped the foundation: dual database client (WebSocket Neon for
production, PGlite for tests), enum types generated from the contract arrays,
the infrastructure tables, append-only and anti-automation triggers, the RFC 9457
HTTP layer, and ESLint boundary rules.

Phase 2 shipped the information model: `information_item` with its two axes kept
apart, `topic`, `event`, table-driven status transitions enforced by a trigger
that also writes the trail, the derived-column guard, `recordVersion()` as the
single versioned write path, and items CRUD at `/api/v1/items`.

Phase 3 shipped sources and ingestion: `source_family`/`source` (versioned like
an item), insert-only `source_fetch`, `evidence` (versioned, with the
restricted/secret CHECK on `url`/`blob_url`), append-only `evidence_provenance`,
the static `SourceConnector` registry with a working RSS/Atom connector, raw
fetch bodies to Blob, the outbox drain (`drainOutbox`, queue-agnostic and
injectable for tests), and the first Cron (`/api/internal/cron/ingest`,
`/api/internal/cron/outbox-drain`) and Queue trigger
(`/api/internal/queue/outbox-dispatch`, `queue/v2beta` on topic
`outbox.dispatch`, declared in `vercel.json`). Routes: `/api/v1/sources`,
`/api/v1/sources/[id]`, `/api/v1/sources/[id]/fetch`, `/api/v1/source-families`,
`/api/v1/evidence`, `/api/v1/evidence/[id]`.

**Both suites have been mutation-tested.** Removing the `audit_log` append-only
trigger turns exactly two tests red.

Both Phase 2 questions from the plan are settled — see `DECISIONS.md`. `edited`
was unreachable and was given inbound edges rather than deleted; the derived
columns are guarded now, and the trigger that maintains them landed in Phase 4,
below.

Phase 4 shipped evidence and assessments: `item_evidence` (composite PK,
`ai_relation` on the same row rather than a second edge, `confirmed_by` gating
what counts), `item_assessment` (its own typed table, immutable except
`superseded_by_assessment_id` and a one-time `approved_by`, ten confidence
dimensions, frozen `eligibility` jsonb), `canAssignVerdict()` /
`requiredReviewLevel()` / `summarizeConfidence()` / `assertHumanReviewer()` in
`server/modules/assessments/rules.ts` (pure, DB-free, unit-tested directly),
the trigger that maintains `information_item`'s derived columns from the live
assessment, the publish-gate trigger (human, non-author reviewer — for both
the item's own approval and the assessment it publishes on), `review_queue`,
and the `published_item` SQL view. `itemService.transition()` now sets
`approved_by` on entering `approved` (asserting a human, non-author reviewer)
and `published_at` on first entering `published`, both previously unset gaps
left open since Phase 2. Routes:
`/api/v1/items/[id]/{evidence,eligibility,assessments}`,
`/api/v1/items/[id]/assessments/[assessmentId]/approve`, `/api/v1/review-queue`
(+ `claim`/`complete`), `/api/v1/published-items`.

The Phase 4 acceptance scenario from the plan (evidence → confirmed edges →
refused self-approval → assessment → second-human review → publish, with the
first assessment preserved as superseded) is `tests/assessment-service.test.ts`.

## Next — Phase 5, search

`vector`/`pg_trgm`, `search_document`, projections, the reindex consumer
(`TOPICS.searchReindex` already has rows queued since Phase 2 — Phase 5 is
where its consumer stops being a no-op), embedding cron, `search_hybrid`
(Reciprocal Rank Fusion, not score normalization), `/api/v1/search`. Confirm
in a spike that PGlite still lacks pgvector (last checked Phase 1) before
assuming `TEST_DATABASE_URL`-gated tests are the only path.

## In flight (uncommitted)

Nothing between phases — each phase is committed once its own suite, typecheck,
lint and build are green.

## Blocked

**Nothing is provisioned, by choice.** Neon, Blob, AI Gateway and Vercel Queues
are all unconfigured; `/api/internal/health` reports every integration as
`false`. The code runs and the whole suite passes without them. Provision when
ready and the same code connects — `DATABASE_URL` must be the **pooled**
(`-pooler`) string, because the WebSocket driver needs interactive transactions
and the HTTP driver silently voids row-level security. Vercel Queues
authenticates via OIDC (`vercel link && vercel env pull`), not an env var — its
absence is non-fatal, since `drainOutbox`'s dispatch call simply fails and
retries with backoff on the next cron tick until it is configured.

**Vercel git auto-deploy** is still disconnected: the Vercel account cannot see
private repos under `lions-admin`. Deploys are manual `vercel --prod`. Pushing
to GitHub deploys nothing.
