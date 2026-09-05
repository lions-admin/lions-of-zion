# CLAUDE.md

This file provides non-visual implementation guidance to Claude Code when
working with code in this repository.

@AGENTS.md

## Owner authority

The current user is the sole developer and project owner. Their direct task
instruction overrides repository notes and historical decisions.

## Repository and publication

Lions of Zion is a Next.js public site with an information-model backend under
`app/api/` and `server/`. The repository is public: a push publishes source.

**A push to `main` deploys to Production.** This paragraph claimed the
opposite until 2026-09-04 — "a separate manual Vercel operation" — and it was
wrong twice in one session: both pushes were live on `lionsofzion.io` inside
two minutes. The mechanism is the GitHub integration on the Vercel project,
whose `productionBranch` is `main`; `vercel.json` disables git deployment for
exactly one branch (`briefing-packages`) and for nothing else. There are no
deploy hooks. Verify with
`vercel api "/v9/projects/<id>?teamId=<team>"` and read `link.productionBranch`.

Two consequences worth holding before pushing:

- **A schema change must be applied before the code that needs it is pushed**,
  not after. Migration `0051` added an `entity_type` value the operations
  console writes on every tool call; the push reached Production first and the
  audit write would have failed on first use. `npm run db:migrate` against
  Preview, then Production, then push.
- **Production database credentials are not readable from this machine.** Every
  one of them is a Vercel *sensitive* env var, which is write-only by design:
  `vercel env pull` and `/v9/projects/:id/env?decrypt=true` both return an
  empty value, and the var's `contentHint` says the secret lives in the Neon
  integration rather than in Vercel. `.env.local` holds a real connection
  string, but it is a **Preview** branch (`DATABASE_RESOURCE_ENV=preview`,
  endpoint `ep-old-feather-…`); Production is the Neon `main` branch on a
  different endpoint. Get it from the Neon Console, or authenticate `neonctl`.

## Reference documentation

Operational reference lives in `docs/architecture.md`, `docs/api.md`,
`docs/data-model.md`, `docs/environment.md`, `docs/operations.md`, and
`docs/vercel-infrastructure.md`.

## Commands

```bash
npm run dev
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:changed
npm run verify:full
```

## Backend architecture

An information-model API: sources are ingested, evidence is attached to items,
assessments are reviewed by a second human, and published items are searchable.
Neon, Blob and AI Gateway **are provisioned and live in Production** — see
"Wired infrastructure" below, and `docs/vercel-infrastructure.md` for the
topology. This paragraph claimed the opposite until 2026-08-27 while the
section 50 lines down described the live stack, so treat the wired list as
authoritative if anything here drifts again. Frontend work must still not
silently provision or mutate those services.

### Layering, enforced by ESLint

`eslint.config.mjs` states the architecture as lint errors, so a violation
fails `npm run lint` rather than a review. Read it before moving code between
layers.

- `app/**` and `components/**` may import `@/server/contracts/*` and nothing
  else under `server/`. This is what keeps a Postgres driver out of the client
  bundle.
- `app/api/**` may not import `@/server/db` or a module's `service`/`repo`/
  `rules` directly. A route parses, calls one module through its `index.ts`,
  and serializes.
- `server/contracts/**` may import zod and nothing else — no drizzle, no
  `next/*`, no `server-only` — so it stays loadable from an RSC and from a
  test with no database.
- `server/db/**` never imports modules; `server/**` never imports the
  frontend; `server/jobs/**` never touches the database directly.

### Module shape

Each `server/modules/<name>/` exposes `index.ts` (binds `db()` lazily and
returns the service), `service.ts` (the transactional workflow), `repo.ts`
(queries), and sometimes `rules.ts` — pure, DB-free policy that is unit-tested
directly, as in `assessments/rules.ts`. **`server/modules/` holds fourteen**:
`ai`, `assessments`, `briefing`, `chat`, `evidence`, `items`, `narratives`,
`outbox`, `public-auth`, `public-x-auth`, `publications`, `reports`, `search`,
`sources`. Most follow the shape above — `publications` and `reports` kept
their repository inline until 2026-08-27. `public-x-auth` is a deliberate
exception: a pure re-export facade over `core/auth/public-x.ts`, with no
service, no repo and no database, existing so `app/auth/**/route.ts` can reach
it under the carve-out in `eslint.config.mjs`. `outbox` and `public-auth`
depart from it too; read them before assuming the four-file shape.

### Cross-cutting rules worth knowing before editing

- `server/core/config.ts` is the only **server-runtime** file that reads
  `process.env`. Four others do, none of them a server request path:
  `drizzle.config.ts`, `next.config.ts`, `server/db/testing.ts`, and two files
  reading `NEXT_PUBLIC_*` values that are inlined at build time —
  `components/auth/google-identity.ts` and `lib/content/archive.ts`. (This
  previously named a `NODE_ENV` check in `components/graphics/viewport.ts`,
  which no longer exists.)
- `server/core/versioning.ts` `recordVersion()` is the only write path for a
  versioned entity: row update, version row, head pointer, audit trail and
  reindex emit happen in one transaction. Nothing else may `UPDATE` a versioned
  table.
- `server/core/outbox.ts` `emit()` writes job intent inside the causing
  transaction; `drainOutbox` and the queue/cron routes under
  `app/api/internal/` deliver it. Publishing to a queue after commit is not
  atomic and is not done here. `emit()` accepts only a `Topic`, so a retired
  topic in `RETIRED_TOPICS` cannot be produced again without a type error —
  which is why `item.detected` lives there rather than carrying a comment.
  Its consumer is kept as a **tombstone**: undrained rows may still exist in
  Production and `dispatchOutboxMessage` throws on an unregistered topic, so
  removing the consumer is a second deploy, gated on
  `SELECT count(*) FROM outbox WHERE topic='item.detected' AND published_at IS NULL`
  reading zero.
- `server/db/client.ts` exports only the WebSocket `neon-serverless` driver.
  `neon-http` cannot hold an interactive transaction, which makes `SET LOCAL
  ROLE` a silent no-op and every authorization test pass for the wrong reason.
  Do not add it back.
- `server/http/handler.ts` wraps every route with request-id propagation and
  error translation; errors are RFC 9457 problem+json with a stable `code`
  from `responses.ts`. Internal routes go through `internal-guard.ts`.
- Business rules live in SQL triggers as often as in TypeScript — status
  transitions, append-only tables, derived columns and the publish gate are all
  enforced in `server/db/migrations/`. Changing a rule usually means a new
  numbered migration, not just a service edit.

### The daily briefing, and the one article that may cite nothing

The briefing serves exactly three jobs, in priority order: **refute anti-Israel
narratives**, publish **one regional geopolitical Daily Brief**, and publish
**one interesting Israel story** that reads the sources and then composes
something new rather than re-reporting them. Refutations are `narrative_watch`,
because an anti-Israel news item *is* a narrative — that owner ruling
(`.ai/DECISIONS.md`, 2026-09-01) is what avoided a new section, an enum
migration, and a frontend routing change. The `war_update` section was removed
completely on 2026-09-05: the section contract has three values, the
`/war-update` route is a permanent redirect, and security material feeds the
Daily Brief.

Three invariants an editor must not break:

- **A Narrative Watch record may publish citing nothing**, marked in public as
  this organisation's own analysis. `evidenceBasis` is **derived, never chosen
  by the model** — it is exactly `evidenceIds.length === 0`. The draft retry
  loop feeds every quality-failure string back into the next attempt, so a
  model-set flag would be found and used to switch off seven evidence checks in
  one token. It is also **all-or-nothing**: an analysis article cites nothing
  anywhere, and a half-sourced one is rejected outright.
- **No quality check is ever skipped, and exemptions live *inside* a pass
  condition**, following `daily_brief_official_context`. **Read the rest of this
  bullet before relying on it** — this paragraph described two enforcement
  layers until 2026-09-05, and both had already been removed on 2026-09-03.

  What is true now:

  - `REQUIRED_QUALITY_CHECKS` lives in `server/modules/briefing/quality.ts`.
    **Do not quote its length here or anywhere else** — this file said "now 18"
    against an array of 17, and `docs/architecture.md`/`docs/data-model.md` said
    "eighteen" in six more places. Count it at the source or do not state it.
  - The **SQL trigger no longer counts anything.** Migration `0049` replaced
    `enforce_publication_publish_gate()` with a body that has no
    `briefing_quality_check` query, no twelve-name subset and no
    `quality_passes <> 12` raise. It enforces machine **provenance** now
    (`briefing_run_id`, `briefing_candidate_key`, `machine_author`).
  - **`publications/repo.ts` does not count them either** — `595ca9d` deleted
    `qualityCandidatePassed()` and the import. `grep -c REQUIRED_QUALITY_CHECKS
    server/modules/publications/repo.ts` returns 0.
  - So the deterministic suite runs on **exactly one path**:
    `evaluateCandidate()` from `external-publish.ts:265`, i.e. the external
    composer ingest at `POST /api/internal/briefing/external-publish`.
  - ⚠️ **The internal pipeline has no quality gate.** `enrich → cluster →
    triage → draft → publish` is still wired in `vercel.json` and still
    reachable through `POST /api/v1/admin/briefing/run`, and its `publish` stage
    never calls `evaluateCandidate`. Whether it should is an open owner
    decision, not an oversight to fix in passing — `0049` retired the stage by
    owner instruction.

  The rule at the top of this bullet still holds for the path that has checks.
  What is gone is the belief that SQL will catch you if you break it.
- **`narrativeWatchTitle()` in `server/contracts/publication.ts` is the only
  headline prefixer.** It was duplicated across two modules with divergent
  recogniser regexes; left unmerged, a refutation rendered as
  "Reported claim: Analysis: X". Read `evidenceBasis` as `=== "analysis"` and
  never as `!== "analysis"` — rows predating the field carry no key, and an
  absent value must fall to the strict side.

### Wired infrastructure and load-bearing gaps

Verified against the code on 2026-08-26. `docs/architecture.md` carries the
full list; these three change what an editor should assume.

- **Neon Auth is the Production identity boundary.**
  `/api/auth/[...path]` restricts signup to `ADMIN_EMAIL`; `authenticateAdmin()`
  verifies the session, upserts `app_user` and loads the five capability grants.
  The `x-actor-label` shim is development-only.
- **RLS is engaged at runtime.** This bullet said the opposite until
  2026-08-27; it was wrong. `server/http/handler.ts` wraps every classified
  request in `withDatabaseRole(role, identity, invoke)`, which takes a dedicated
  pooled connection, issues `SET ROLE` plus `set_config('app.identity', …)`, and
  `RESET ALL` on release. Migration `0018` grants the owner membership in
  `app_public`/`app_staff`/`app_service` so `SET ROLE` succeeds; `0019` adds the
  policy that lets `INSERT … RETURNING` work under `app_public`.
  **`PUBLIC_V1` is exactly nine entries** — `GET /search`,
  `GET /published-items`, `GET /published-publications` (which one pattern
  covers both with and without a `publicId`), `POST /reports`,
  `POST /volunteer-interest`, and the four chat paths. Everything
  else under `/api/v1/` goes through `authenticateAdmin()` and fails closed, so
  `GET /api/v1/evidence` is staff-only, not anonymous. `docs/api.md`'s guard
  table still describes ~12 of those routes as `anon` and understates the
  lockdown.
  **`requireCapability()` is called from nowhere, and that is now a recorded
  decision rather than a gap** (`.ai/DECISIONS.md`, 2026-08-27). There is one
  account, `authenticateAdmin()` grants it every capability on each sign-in, so
  a check could only ever pass — while adding a way to be locked out. What
  protects those operations is the SQL triggers, which hold on every path, and
  the `evidence_staff_reads_unrestricted` RLS policy, which reads
  `capability_grant` directly. `tests/admin-capabilities.test.ts` pins that the
  owner holds all five. **Wire it up when a second account exists.**
  **One real gap survives:** `withDatabaseRole` has no test:
  `tests/rls.test.ts` proves the policies via `SET LOCAL ROLE` in a transaction
  on PGlite, which is not the pooled session-scope mechanism production uses.

### Tests

`tests/` runs on vitest in a node environment against `server/db/testing.ts`
`freshDatabase()` — PGlite, a real Postgres 18 in WASM, migrated per test, so
triggers and constraints behave as they will in Neon. PGlite has no pgvector:
semantic-search tests skip unless `TEST_DATABASE_URL` points at a Postgres that
has it, while lexical search (`tsvector`, `pg_trgm`) is fully covered locally.
`vitest.config.ts` aliases `server-only` to its empty module rather than
letting tests drop the import.
