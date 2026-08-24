# State

Snapshot of intent and current position. Git is the history; durable reasoning
lives in `DECISIONS.md`.

_Last updated: 2026-08-24_

## Frontend

The original particle story intro is preserved. Its old photographic
post-intro landing page and legacy navigation have been removed and replaced by
the Fabele particle navigation:

- a crowned lion assembled from tiered 45k/90k/180k particle buffers;
- eight radial routes whose nodes, connectors and DOM labels share one
  responsive `OrbitLayout`;
- a blue particle network scan with readable misinformation-context labels and
  social-platform symbols; no stars and no photographic background;
- WebGPU/TSL first, WebGL2 fallback, and an SSR poster/no-JavaScript path;
- Cinzel labels, accessible 44px targets and visible keyboard focus;
- the isolated `/particle-demo` tuning and fallback route.

`Experience.tsx` starts the new GPU engine only at the intro's outro. The new
lion assembles during the same 2.8 seconds in which the intro veil clears. The
DOM links and fallback poster are present in the initial HTML, but become inert
after hydration while the intro runs. Without JavaScript the intro enhancement
is hidden and the links remain usable.

All eight routes exist as real Next.js pages. They are intentionally placeholder
destinations pending section content.

## Verification

- `npm run typecheck`, `npm test`, `npm run lint`, and `npm run build` pass.
- The real-Chrome matrix passes at 320×568, 390×844, 768×1024, 1024×768,
  1254×1254, 1440×900, and 2560×1080: 8/8 links remain inside each viewport,
  WebGPU is live, and there are no console errors or overlays.
- The end-to-end pass confirms intro → skip/outro → WebGPU navigation, a live
  forced-WebGL2 scene, keyboard focus, and a usable no-JavaScript poster with
  eight links.
- The in-app browser may render a black intro because it throttles hidden-tab
  animation. Use the real-Chrome scripts for visual evidence.

## Backend — Phases 1–4 of 8 complete

The frontend integration and the backend are developed independently and share
no source files; they met only in `package.json` and this journal. No backend
service was changed by the frontend integration, and no frontend file was
changed by the backend phases.

The full eight-phase plan is at `~/.claude/plans/splendid-discovering-dawn.md`.
Read it before starting Phase 5; the sequencing has reasons.

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

**Both suites have been mutation-tested.** Removing the `audit_log` append-only
trigger turns exactly two tests red.

Both Phase 2 questions from the plan are settled — see `DECISIONS.md`. `edited`
was unreachable and was given inbound edges rather than deleted; the derived
columns are guarded, and the trigger that maintains them landed in Phase 4.

## Deployment

This particle-navigation integration is the current main implementation. Git
auto-deploy is disconnected from the private GitHub organization, so production
releases use an explicit Vercel CLI deployment after the commit and local gates
have passed.

## Next

- Migrate the preserved intro into the same WebGPU/TSL renderer so the complete
  experience uses one Canvas and one particle system.
- Replace the eight placeholder section pages as their content is designed.
- **Backend Phase 5 is search**: `vector`/`pg_trgm`, `search_document`,
  projections, the reindex consumer (`TOPICS.searchReindex` has queued rows
  since Phase 2 — Phase 5 is where its consumer stops being a no-op), embedding
  cron, `search_hybrid` (Reciprocal Rank Fusion, not score normalization), and
  `/api/v1/search`. Confirm in a spike that PGlite still lacks pgvector (last
  checked Phase 1) before assuming `TEST_DATABASE_URL`-gated tests are the only
  path.

## Blocked

Nothing in the frontend implementation.

**Backend provisioning remains deferred by choice.** Neon, Blob, AI Gateway and
Vercel Queues are all unconfigured; `/api/internal/health` reports every
integration as `false`. The code runs and the whole suite passes without them.
Provision when ready and the same code connects — `DATABASE_URL` must be the
**pooled** (`-pooler`) string, because the WebSocket driver needs interactive
transactions and the HTTP driver silently voids row-level security. Vercel
Queues authenticates via OIDC (`vercel link && vercel env pull`), not an env
var — its absence is non-fatal, since `drainOutbox`'s dispatch call simply
fails and retries with backoff on the next cron tick until it is configured.
