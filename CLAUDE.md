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

**`docs/editorial-dna.md` is the binding definition of what this site and this
system are** — an owner ruling recorded 2026-09-06. It outranks this file and
every other document here; where one of them contradicts it, the other one is
wrong. Read it before any editorial, routing, homepage or media work.

Operational reference lives in `docs/architecture.md`, `docs/api.md`,
`docs/data-model.md`, `docs/environment.md`, `docs/operations.md`,
`docs/whole-site-updates.md`, `docs/briefing-packages.md`, and
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
directly, as in `assessments/rules.ts`. **Get the module list from `ls
server/modules`, never from here** — this line said "fourteen" against a
directory of nineteen until 2026-09-06, having missed `admin-console`,
`editorial-update`, `homepage`, `media` and `ops-agent`, which are precisely
the modules the whole-site editorial path runs through. Most follow the shape
above — `publications` and `reports` kept
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

### The whole-site editorial update, and the one article that may cite nothing

**Read [`docs/editorial-dna.md`](docs/editorial-dna.md) first.** It is the
owner's binding definition of what this site and this system are, recorded
2026-09-06, and it outranks this file. What follows is only the part an
implementer is most likely to break.

The system is not a Daily Brief. A run is a **whole-site editorial update**
composed outside this repository and delivered in: it researches, creates,
updates, publishes, attaches images, routes, recomposes the homepage, and
reports. It owns **five destinations** —

| Destination | Route | Sections |
| --- | --- | --- |
| News & Analysis | `/geopolitical-brief` | `daily_brief`, `israel_update`, `news` |
| Fake Resistance | `/fake-resistance` | `narrative_watch`, `influence_investigation`, `antisemitism` |
| The People of Israel | `/people-of-israel` | `people`, `courage_service`, `innovation`, `technology_ai`, `science_medicine`, `achievement`, `international_cooperation`, `history_context` |
| October 7 | `/october-7` | none — a static archive a run never writes into |
| Behind the Desk / How It Works | `/information-war` | none — `SYSTEM_LINK` in `components/site/navigation-model.ts` |

Refutations are `narrative_watch`, because an anti-Israel news item *is* a
narrative — that owner ruling (`.ai/DECISIONS.md`, 2026-09-01) is what avoided
a new section, an enum migration, and a frontend routing change. The
`war_update` section was removed completely on 2026-09-05: `/war-update` is a
permanent redirect and security material feeds the Daily Brief. (This
paragraph said "the section contract has three values" until 2026-09-06;
`PUBLICATION_SECTIONS` in `server/contracts/enums.ts` has fourteen. Count it at
the source or do not state it.)

Our Heroes and Israel's Story were **not deleted** when The People of Israel
absorbed them: `/our-heroes` and `/israels-story` keep their addresses and
their shells, recorded as `LEGACY_SECTION_PAGES` in `lib/site-navigation.ts`.

Four invariants an editor must not break:

- **`publication.section` is the only editorial choice, and every surface is
  derived from it** in `lib/publication-routing.ts` — hub, route, homepage
  band, homepage kind, breadcrumb, card label. There is deliberately no
  `homepageCategory`, `destination` or `frontendSection` for a model to pick.
  A second model-set field plus scattered
  `section === "narrative_watch" ? … : …` ternaries is exactly how a record
  ends up filed as news on the homepage and as a claim assessment on its own
  page. Derive lists from `SECTIONS_BY_HOMEPAGE_SECTION` rather than writing
  them by hand — `LiveBriefHub` hardcoded `["daily_brief", "israel_update"]`
  and rendered `news` records nowhere until 2026-09-06.
- **A Narrative Watch record may publish citing nothing**, marked in public as
  this organisation's own analysis. `evidenceBasis` is **derived, never chosen
  by the model** — it is exactly `evidenceIds.length === 0`, set by
  `applyEditorial` on create and merged back from the stored row on update
  (`updatePublicationSchema` omits the field on purpose). It is also
  **all-or-nothing**: an analysis article cites nothing anywhere, and a
  half-sourced one is rejected by the `createPublicationSchema` refine.
- **`narrativeWatchTitle()` in `server/contracts/publication.ts` is the only
  headline prefixer.** It was duplicated across two modules with divergent
  recogniser regexes; left unmerged, a refutation rendered as
  "Reported claim: Analysis: X". Read `evidenceBasis` as `=== "analysis"` and
  never as `!== "analysis"` — rows predating the field carry no key, and an
  absent value must fall to the strict side.
- **No quality check is ever skipped, and exemptions live *inside* a pass
  condition**, following `daily_brief_official_context`. **Read the rest of
  this bullet before relying on it** — this paragraph described two enforcement
  layers until 2026-09-05, and both had already been removed on 2026-09-03.

  What is true now:

  - `REQUIRED_QUALITY_CHECKS` lives in `server/modules/briefing/quality.ts`.
    **Do not quote its length here or anywhere else** — this file said "now 18"
    against an array of 17, and `docs/architecture.md`/`docs/data-model.md`
    said "eighteen" in six more places. Count it at the source or do not state
    it.
  - The **SQL trigger no longer counts anything.** Migration `0049` replaced
    `enforce_publication_publish_gate()` with a body that has no
    `briefing_quality_check` query, no twelve-name subset and no
    `quality_passes <> 12` raise. Migration `0060` is the current body: it
    enforces machine **provenance** — a `briefing_run_id` with a
    `briefing_candidate_key`, *or* an `editorial_run_id` with an
    `editorial_operation_key`, plus a non-empty `machine_author`.
  - **`publications/repo.ts` does not count them either** — `595ca9d` deleted
    `qualityCandidatePassed()` and the import. `grep -c REQUIRED_QUALITY_CHECKS
    server/modules/publications/repo.ts` returns 0.
  - So the deterministic suite runs on **exactly one path**:
    `evaluateCandidate()` in `external-publish.ts`, i.e. the legacy
    `external-briefing-v1` ingest at
    `POST /api/internal/briefing/external-publish`. **The whole-site path has
    no quality gate**, by owner ruling — see the launch posture below.
  - The internal briefing initiator is retired: no Vercel cron, queue trigger,
    admin action, or operations-agent tool may start research, drafting, or a
    daily edition. The legacy implementation and its records remain only for
    compatibility and historical inspection.

  The rule at the top of this bullet still holds for the path that has checks.
  What is gone is the belief that SQL will catch you if you break it.

**Launch-period posture, by owner ruling (2026-09-06).** During the run-in
period the system carries the minimum enforcement that protects it and no more:
no `external-briefing-v1` as the central constraint, no heavy quality
contracts, no editorial gates, no quotas, no candidate caps, no balance quotas,
no redundant validation loops. What stays is auth, database integrity,
persistence, media safety, security, idempotency and transactions where they
are needed, and enough parsing that nothing crashes. Do not add an editorial
gate back without an owner instruction; ordered contracts return after launch.
`docs/editorial-dna.md` §11 lists both halves precisely.

**Delivery, in one line.** Baseline `main`; delivery branch `editorial-updates`
(excluded from Vercel in `vercel.json`); package
`editorial-updates/<Israel-local-date>-<runId>.json`; contract
`whole-site-update-v1` (`server/contracts/whole-site-update.ts`); ingest
`POST /api/internal/editorial-updates/ingest`; status
`GET /api/internal/editorial-updates/runs/{runId}`. The mechanism is
`docs/whole-site-updates.md`. The contract is `.strict()` and describes content
and placement only — there is no representable field for SQL, a command, a
migration, an environment value, or application code, which is what makes the
run's auto-fix boundary structural rather than a matter of trust. Homepage
placements are three areas (`news`, `fakeResistance`, `people`) × two positions
(`lead`, `secondary`); October 7 is not placeable.

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
