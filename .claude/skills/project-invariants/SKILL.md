---
name: project-invariants
description: The backend invariants, layering rules and enforcement mechanics of this repository. Load before editing anything under server/, app/api/, or lib/publication-routing.ts.
user-invocable: false
---

# Backend invariants

Load this when the task touches `server/`, `app/api/`, or publication routing.
Frontend-only work does not need it.

## Layering — lint errors, not convention

`eslint.config.mjs` states the architecture. A violation fails `npm run lint`,
so it is caught by tooling rather than review. **These are invisible to
`tsc`** — a route importing the database typechecks perfectly.

- `app/**` (not api), `components/**`, `lib/**` may import
  `@/server/contracts/*` and nothing else under `server/`. This is what keeps a
  Postgres driver out of the client bundle. One carve-out exists,
  `lib/publications.ts`, as an inline disable; nothing else in `lib/**` may
  follow it.
- `app/api/**` may not import `@/server/db*`, nor a module's
  `service`/`repo`/`rules` directly, nor components. A route parses, calls one
  module through its `index.ts`, and serializes. No policy in a route file.
- `server/contracts/**` imports zod and nothing else — no drizzle, no `next/*`,
  no `server-only` — so it loads from an RSC and from a database-less test.
- `server/db/**` never imports modules. `server/**` never imports the frontend.
  `server/jobs/**` never touches the database directly; jobs call services.
- `app/auth/**/route.ts` has a deliberate carve-out for `public-x-auth`.

## Module shape

`server/modules/<name>/` exposes `index.ts` (binds `db()` lazily, returns the
service), `service.ts` (transactional workflow), `repo.ts` (queries), sometimes
`rules.ts` — pure, DB-free policy, unit-tested directly, as in
`assessments/rules.ts`.

**Get the module list from `ls server/modules`, never from prose.** That count
has been wrong in documentation more than once. Known departures from the shape:
`public-x-auth` — a pure re-export facade over `core/auth/public-x.ts`, with no
service, no repo and no database, existing so `app/auth/**/route.ts` can reach
it under the carve-out in `eslint.config.mjs` — plus `outbox` and `public-auth`.
`publications` and `reports` kept their repository inline until 2026-08-27.

## The six cross-cutting invariants

1. **`recordVersion()` in `server/core/versioning.ts` is the only write path for
   a versioned entity.** Row update, version row, head pointer, audit trail and
   reindex emit happen in one transaction. Nothing else may `UPDATE` a versioned
   table.

2. **`emit()` in `server/core/outbox.ts` writes job intent inside the causing
   transaction.** Publishing to a queue after commit is not atomic and is not
   done here. `emit()` accepts only a `Topic`; a topic in `RETIRED_TOPICS`
   cannot be produced again without a type error. Retiring a topic is two
   deploys — the consumer stays as a tombstone until no undrained row remains,
   because `dispatchOutboxMessage` throws on an unregistered topic. `item.detected`
   is the live example; its removal is gated on
   `SELECT count(*) FROM outbox WHERE topic='item.detected' AND published_at IS NULL`
   reading zero. Delivery is `drainOutbox` plus the queue/cron routes under
   `app/api/internal/`.

3. **`server/db/client.ts` exports only the WebSocket `neon-serverless`
   driver.** `neon-http` cannot hold an interactive transaction, which makes
   `SET LOCAL ROLE` a silent no-op and every authorization test pass for the
   wrong reason. Do not add it back.

4. **`evidenceBasis` is derived, never chosen by a model.** It is exactly
   `evidenceIds.length === 0`, set by `applyEditorial` on create and merged back
   from the stored row on update — `updatePublicationSchema` omits it on
   purpose. It is all-or-nothing: an analysis article cites nothing anywhere,
   and a half-sourced one is rejected by the `createPublicationSchema` refine.
   **Read it as `=== "analysis"`, never `!== "analysis"`** — rows predating the
   field carry no key, and an absent value must fall to the strict side.
   `narrativeWatchTitle()` in `server/contracts/publication.ts` is the **only**
   headline prefixer; duplicating it once produced "Reported claim: Analysis: X".

5. **`publication.section` is the only editorial choice, and every surface
   derives from it** in `lib/publication-routing.ts` — hub, route, homepage
   band, homepage kind, breadcrumb, card label. There is deliberately no
   `homepageCategory`, `destination` or `frontendSection`. Derive section lists
   from `SECTIONS_BY_HOMEPAGE_SECTION`; a hand-written pair in `LiveBriefHub`
   left `news` records rendered by nothing.

6. **`server/contracts/whole-site-update.ts` stays `.strict()` and
   content-only.** It has no representable field for SQL, a command, a
   migration, an environment value, or application code — which is what makes
   the daily run's auto-fix boundary structural rather than a matter of trust.

## Other mechanics worth knowing

- `server/core/config.ts` is the only **server-runtime** file that reads
  `process.env`. Four others do, none in a request path: `drizzle.config.ts`,
  `next.config.ts`, `server/db/testing.ts`, and two reading build-time-inlined
  `NEXT_PUBLIC_*` values — `components/auth/google-identity.ts` and
  `lib/content/archive.ts`.
- `server/http/handler.ts` wraps every route with request-id propagation and
  error translation. Errors are RFC 9457 problem+json with a stable `code` from
  `responses.ts`. Internal routes go through `internal-guard.ts`.
- **Neon Auth is the Production identity boundary.** `/api/auth/[...path]`
  restricts signup to `ADMIN_EMAIL`; `authenticateAdmin()` verifies the session,
  upserts `app_user` and loads the five capability grants. The `x-actor-label`
  shim is development-only.
- **RLS is engaged at runtime.** `withDatabaseRole(role, identity, invoke)`
  takes a dedicated pooled connection, issues `SET ROLE` plus
  `set_config('app.identity', …)`, and `RESET ALL` on release. It has **no
  test** — `tests/rls.test.ts` proves policies via `SET LOCAL ROLE` in a
  transaction on PGlite, which is not the pooled session-scope mechanism
  production uses. This is the one real known gap. Migration `0018` grants the
  owner membership in `app_public`/`app_staff`/`app_service` so `SET ROLE`
  succeeds; `0019` adds the policy that lets `INSERT … RETURNING` work under
  `app_public`.
- `PUBLIC_V1` is a small allowlist: `GET /search`, `GET /published-items`,
  `GET /published-publications` (one pattern covers it with and without a
  `publicId`), `POST /reports`, `POST /volunteer-interest`, and the chat paths.
  Everything else under `/api/v1/` goes through `authenticateAdmin()` and fails
  closed — so `GET /api/v1/evidence` is staff-only, not anonymous. Count the
  entries at the source rather than trusting a number in prose; `docs/api.md`'s
  guard table still calls many of these `anon` and understates the lockdown.
- `requireCapability()` is called from nowhere, by recorded decision — there is
  one account and it holds every capability, so a check could only ever pass
  while adding a way to be locked out. What protects those operations is the SQL
  triggers, which hold on every path, and the `evidence_staff_reads_unrestricted`
  RLS policy, which reads `capability_grant` directly.
  `tests/admin-capabilities.test.ts` pins that the owner holds all five. Wire it
  up when a second account exists.
- **Business rules live in SQL triggers as often as in TypeScript.** Changing a
  rule usually means a new numbered migration, not a service edit. When reading
  what a trigger enforces, read the **highest-numbered** migration that defines
  it — documentation here has described enforcement that later migrations had
  already removed.

## Tests

Vitest, node environment, `server/db/testing.ts` `freshDatabase()` — PGlite, a
real Postgres 18 in WASM, migrated per test, so triggers and constraints
behave as they will in Neon.

- `maxWorkers: 2` in `vitest.config.ts` is deliberate; default parallelism
  OOMs the suite. Do not override it.
- PGlite has no pgvector: semantic-search tests skip unless `TEST_DATABASE_URL`
  points at a Postgres that has it. Lexical search (`tsvector`, `pg_trgm`) is
  fully covered locally.
- `vitest.config.ts` aliases `server-only` to its empty module rather than
  letting tests drop the import.
- Hand-written SQL rules go in a new numbered file in `server/db/migrations/`
  alongside the generated ones — applied in filename order by both `db:migrate`
  and the test harness, so a trigger cannot exist in one place and not the other.
