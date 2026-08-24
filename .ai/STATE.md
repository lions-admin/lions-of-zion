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
- a skip control rendered as DOM type rather than particles — the one
  documented exception to the all-particles rule (see `DECISIONS.md`);
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

## Backend — 8 phases complete, plus Phase 9 (narrative monitoring)

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

Phase 5 shipped search: `search_document` (one denormalised projection row per
entity, two generated `tsvector` columns, trigram index on the title only),
pure `projectItem`/`projectEvidence`/`isIndexable` projections,
`search_hybrid()` fusing its arms with Reciprocal Rank Fusion in one SQL
round trip, the reindex consumer (`TOPICS.searchReindex` is no longer a no-op
— it has been queuing rows since Phase 2 and now does the work), the
embedding-backlog cron, and `/api/v1/search`.

**The pgvector split is the thing to understand before touching search.**
PGlite still has no pgvector (re-spiked this session; it has `pg_trgm`,
`tsvector`, GIN and `ts_rank_cd`, and tokenises Hebrew and Arabic under
`simple`). So migration `0009` creates the `embedding` column, its HNSW index
and `search_hybrid` inside a conditional `DO` block, with **two function
bodies of identical signature** — four arms where pgvector exists, three
where it does not. Callers never branch: they pass an embedding or `NULL`.
`search_document.embedding` is therefore deliberately **absent from the
Drizzle schema**, because declaring it would break every `select()` locally.
`search_has_semantic_arm()` reports which body is live, and `/api/v1/search`
returns it as `semantic`, so lexical-only results are never mistaken for the
whole answer.

Phase 6 shipped AI: `prompt_registry` and `ai_run` (both append-only),
`ai_suggestion`, `translation`, the AI Gateway client in
`server/core/ai/gateway.ts` (the only file that calls a model), the
classification and budget guards, and `/api/v1/ai/suggestions`.

**A model never writes to an entity.** Every generation produces an `ai_run`
and an `ai_suggestion`; the entity changes only when a named human accepts
one, through `recordVersion` with `change_source = 'ai_suggestion_accepted'`
and that run's id — which the Phase 1 CHECK `ai_change_names_its_run` already
demanded and nothing could satisfy until now. `entity_version.ai_run_id`
finally got its foreign key in this phase.

Two guards run before any request leaves the process: restricted/secret
material is refused a send (mirrored by the `restricted_data_never_reaches_a_model`
CHECK, which can only refuse the *record* — by then the send has happened,
which is why the TypeScript check is first), and an exhausted budget refuses
the call from recorded spend via `ai_spend_since()`.

Model slugs live only in `MODEL_PROFILES` in `server/core/config.ts`; callers
ask for `fast`/`reasoning`/`translation`/`embedding`. **Verify those slugs
against `/api/internal/ai/models` when provisioning** — a stale gateway slug
fails at call time with a 400, not at deploy time. The `embedding` profile is
the load-bearing one: 1536 dimensions, matching `vector(1536)`, and a
different model must be added as a second column rather than swapped in.

Phase 5's embedder seam is filled: `server/modules/search/index.ts` now passes
one, so the semantic arm switches on wherever pgvector and the gateway both
exist.

Phase 7 shipped chat: `chat_thread`, `chat_message`, append-only
`chat_tool_run`, `chat_citation`, a retrieval-constrained answerer, and
`/api/v1/chat/threads`.

**A citation must name a document retrieval actually returned.** The foreign
key only forces a citation to name a *real* `search_document` — any real one
would do. `chat_citation_must_be_retrieved` adds the part that matters: the
document must appear in the `result_document_ids` of an `ok` tool run **in
the same thread**. Retrieval therefore runs *before* the model is asked and is
recorded first, so the trigger has something to check by the time the answer
is filed. A fabricated citation is stripped in the service (so the answer
still reaches the reader) and refused outright by the database (so no other
path can insert one).

`POST /messages` deliberately **does not stream tokens**. The citation
guarantee is enforced when the answer is persisted; streaming first and
validating after means the reader has already seen the fabricated citation by
the time the database rejects it. Streaming can be layered on top of this
later — it could not be added underneath it.

Phase 8 shipped the surfaces and the hardening: `publication` (one table for
all four surfaces, discriminated by `kind`), `publication_item`, the
user-submitted `report`/`report_file`/`report_status_history`, `rate_limit`,
**row-level security with negative tests**, and rate limiting.

The four publication surfaces are **one table, not four**. They share a
lifecycle, a versioning path and a publish gate, and four tables would have
meant four copies of that gate and four chances for one to drift. Scenarios
carry a `likelihood_band` and there is **no numeric probability column
anywhere** — a test asserts the `publication` table has no column matching
`probability|percent|score`.

**RLS is live and mutation-tested.** Three roles (`app_public`, `app_staff`,
`app_service`), 21 policies. The `as()`/`assertRole` harness written in Phase 1
is finally used and finally meaningful: `SET LOCAL ROLE` outside a transaction
is a silent no-op, so without `assertRole` every authorization test would run
as the table owner and pass while proving nothing. Weakening
`information_item_public_reads_published` was verified to turn the suite red.

Restricted evidence is guarded three ways over: the CHECK refuses it a `url`
or `blob_url`, `isIndexable()` refuses it a search row, and the RLS policy
requires `evidence.restricted.read` — a capability the Phase 1 trigger refuses
to grant to any automated identity, so `app_service` cannot reach it by
configuration error. Disabling a user revokes it immediately (the policy joins
on `disabled_at IS NULL`).

Rate limiting counts in Postgres, not in memory: Vercel instances are
per-region and recycled, so an in-process counter is a limit per lambda, which
is no limit at all. `bump_rate_limit` increments and returns in one statement,
and a refused request still counts — otherwise being over the limit grants a
free retry every time.

Phase 9 shipped narrative and actor monitoring — the layer the eight-phase
plan never scheduled. `actor` finally uses `actor_kind`, declared in Phase 1
and orphaned for eight phases. Also: `narrative` (with trigger-maintained
`first_seen_at`/`last_seen_at`/`observation_count`), `narrative_item`,
append-only `narrative_observation`, and the `narrative_activity()` function.

**The signal is counted in source families, not accounts.** This is the whole
point, and it is the first real use of `source_family` from Phase 3. Twenty
accounts inside one family is a megaphone; three across three families is a
story travelling. A test seeds exactly that pair and asserts the amplified one
has *more* observations and *more* actors — so a system ranking by volume
would put the megaphone first — while `distinctFamilies` (1 vs 3) and the
`reading` field tell them apart. `GET /api/v1/monitoring/now` is the endpoint
the phase is measured by.

Two rules worth knowing: an observation **cannot exist without evidence**
(`evidence_id NOT NULL`, mutation-tested), and attributing a narrative to a
`state` or `network` actor cannot be confirmed by an automated identity —
unconfirmed attributions of that kind stay in the table as leads but drive no
signal at all.

A narrative deliberately has **no `assessment` column**; a test asserts it.
The claims composing it get verdicts individually — one sweeping verdict over
a theme is the overreach this platform documents.

**Also fixed:** the three routes that had no auth check (`/v1/review-queue`,
`/v1/source-families`, `/v1/evidence/[id]`) now call `requireActor`. And
`.claude/**` is now in the ESLint ignore list — it holds git worktrees, each a
full checkout with its own `node_modules`, so linting walked into bundled
vendor code and reported thousands of errors in files nobody wrote.

**Both suites have been mutation-tested.** Removing the `audit_log` append-only
trigger turns exactly two tests red.

Both Phase 2 questions from the plan are settled — see `DECISIONS.md`. `edited`
was unreachable and was given inbound edges rather than deleted; the derived
columns are guarded, and the trigger that maintains them landed in Phase 4.

## The explainer page

`docs/engine-explainer.html` — a self-contained interactive page (Hebrew, RTL)
that explains what the system delivers and how it works: 35 components on a
pannable canvas, four end-to-end journeys, the invariants, and a glossary of
every English term.

It opens on **what the system gives**, not on the architecture, because the
first version led with the machinery and was unclear about the point. Each
component states its purpose before its engineering rationale.

Published at <https://claude.ai/code/artifact/8e3a2495-ce67-4393-83a5-a7994488aee2>.
Editing the file and republishing to that same URL keeps the link stable.

It is documentation only: not under `app/` or `public/`, so Next.js never
serves it and it costs nothing to host.

## Deployment

This particle-navigation integration is the current main implementation. Git
auto-deploy is disconnected from the private GitHub organization, so production
releases use an explicit Vercel CLI deployment after the commit and local gates
have passed.

## Next

- Migrate the preserved intro into the same WebGPU/TSL renderer so the complete
  experience uses one Canvas and one particle system.
- Replace the eight placeholder section pages as their content is designed.
- **The eight-phase backend plan is complete.** What it deliberately did not
  include, and what a next session would pick from:
  - **Provisioning.** Nothing is connected; see Blocked below. This is the
    single highest-value next step, and the code is written to need no changes
    when it happens.
  - **Real authentication.** `requireActor()` still reads an unverified
    `x-actor-label` in development and throws in production;
    `requireCapability()` throws unconditionally. The RLS policies are written
    against `app.identity` and are ready for a real session to set it.
  - **Workflows for brief generation** (plan §8) — the one item from Phase 8's
    brief not built. Everything it needs exists: publications are versioned,
    the AI module suggests behind a human gate, and search retrieves.
  - **A frontend for any of this.** No backend surface is consumed by the
    particle navigation yet; the two halves still share only `package.json`.

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
