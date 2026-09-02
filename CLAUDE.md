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
Production deployment is a separate manual Vercel operation.

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
migration, and a frontend routing change. `war_update` is retired from
production: it left `ARTICLE_SECTIONS` but remains a legal enum value, so the
archive and `/war-update` keep working while security material now feeds the
Daily Brief.

Three invariants an editor must not break:

- **A Narrative Watch record may publish citing nothing**, marked in public as
  this organisation's own analysis. `evidenceBasis` is **derived, never chosen
  by the model** — it is exactly `evidenceIds.length === 0`. The draft retry
  loop feeds every quality-failure string back into the next attempt, so a
  model-set flag would be found and used to switch off seven evidence checks in
  one token. It is also **all-or-nothing**: an analysis article cites nothing
  anywhere, and a half-sourced one is rejected outright.
- **No quality check is ever skipped.** Exemptions live *inside* a pass
  condition, following `daily_brief_official_context`. This is not style: the
  trigger `enforce_publication_publish_gate` counts a frozen twelve-name subset
  and raises unless exactly twelve pass, while `publications/repo.ts` counts
  `REQUIRED_QUALITY_CHECKS.length` (now 18). Skipping a check breaks both.
  `tests/briefing-quality.test.ts` pins the twelve, because that failure would
  otherwise appear only as a raised exception in Production.
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
