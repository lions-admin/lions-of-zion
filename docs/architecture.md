# Architecture

What this system is, how its parts are separated, and which of those
separations are enforced rather than agreed.

Companion documents: [`api.md`](api.md) for the HTTP surface,
[`data-model.md`](data-model.md) for the database, [`environment.md`](environment.md)
for configuration, [`operations.md`](operations.md) for build, CI and deploy.
The **why** behind individual decisions lives in
[`../.ai/DECISIONS.md`](../.ai/DECISIONS.md); this document describes the
shape those decisions produced.

---

## Two halves, one repository

Lions of Zion is two systems that share a repository, a build and a deploy, and
that meet at exactly two seams: the shared vocabulary in `server/contracts/**`,
and one server-only reader, `lib/publications.ts`, through which the site
renders published articles.

**The public application** lives under `app/`, `components/`, and `lib/`.

**The information model** is a backend for ingesting sources, attaching
evidence to claims, having a second human review an assessment, and publishing
what survives that.

They are kept apart by lint rules, not by convention. `eslint.config.mjs`
states the boundaries as `no-restricted-imports` errors, so a violation fails
`npm run lint` instead of waiting for a reviewer to notice it.

```mermaid
flowchart TB
    subgraph FE["Frontend — app/**, components/**, lib/**"]
        Home["Public routes"]
        Docs["8 file routes + /methodology + /corrections"]
        Admin["/admin — client dashboard"]
    end

    subgraph Contracts["server/contracts/** — zod only"]
        Vocab["Shared vocabulary<br/>AssessmentValue, ItemStatus, …"]
    end

    subgraph BE["Backend — app/api/**, server/**"]
        Routes["Route handlers<br/>parse → one service → serialize"]
        Modules["Modules<br/>service / repo / rules"]
        Core["Core<br/>versioning, outbox, config, auth"]
        DB[("Postgres<br/>65 tables, 63 migrations")]
    end

    Home --> Vocab
    Docs --> Vocab
    Modules --> Vocab
    Admin -.->|"fetch /api/v1"| Routes
    Routes --> Modules --> Core --> DB
```

`app/**` and `components/**` and `lib/**` may import `@/server/contracts/*` and
nothing else under `server/` — which is what keeps a Postgres driver out of the
client bundle.

The one carve-out is written as an inline `eslint-disable` rather than a rule in
`eslint.config.mjs`, so it is easy to miss: `lib/publications.ts` imports
`@/server/modules/publications` and `withDatabaseRole` directly. It is
`server-only`, and the alternative is worse — a server component fetching the
project's own public API self-fetches over the network at render time and has to
guess its own origin. Nothing else in `lib/**` may follow it.

### The boundaries, as they are actually written

| Layer | May import | May **not** import |
| --- | --- | --- |
| `app/**` (not api), `components/**`, `lib/**` | `@/server/contracts/*` | anything else under `@/server/` |
| `app/api/**` | a module's `index.ts` | `@/server/db*`, a module's `service`/`repo`/`rules`, any component |
| `server/contracts/**` | `zod` | drizzle, `next/*`, `server-only`, anything else in `server/` |
| `server/db/**` | its own schema | `@/server/modules*`, `@/server/http*`, the frontend |
| `server/**` | each other, per above | `@/app/*`, `@/components/*` |
| `server/jobs/**` | module services | `@/server/db*` |

`scripts/**`, `server/db/migrations/**` and `.claude/**` are globally ignored
by ESLint — the last of those because it contains git worktrees, each a full
checkout with its own `node_modules`.

---


## The backend

### Request lifecycle

```mermaid
sequenceDiagram
    participant C as Client
    participant R as Route handler
    participant H as server/http/handler
    participant M as Module index
    participant S as service
    participant D as Postgres

    C->>R: HTTP
    R->>H: handler(fn)
    H->>H: requestId ← x-vercel-id / x-request-id / uuid
    H->>H: accessFor() → role + identity
    H->>D: withDatabaseRole: SET ROLE, app.identity
    H->>D: rate limit, and origin check on an admin mutation
    H->>R: parseBody / parseQuery (zod)
    R->>R: requireActor / requireCron / requireInternalSecret
    R->>M: one call
    M->>S: bound service (db() lazily)
    S->>D: transaction
    D-->>S: rows
    S-->>R: domain result
    R-->>H: ok() / created()
    H-->>C: + x-request-id

    Note over H,C: A throw becomes RFC 9457 problem+json.<br/>The detail goes to the log, never the body.
```

A route handler does three things and no more: parse, call one service,
serialize. Anything resembling a policy decision inside a route file is a bug,
and the lint rules make it a mechanical one.

Every response carries a request id — the same id in the log line, the audit
row and the error body.

### Module shape

Each `server/modules/<name>/` exposes:

- `index.ts` — binds `db()` lazily, memoises, returns the service.
- `service.ts` — the transactional workflow. Owns policy; owns no SQL.
- `repo.ts` — queries.
- `rules.ts` — sometimes. Pure, DB-free policy, unit-tested directly
  (`assessments/rules.ts` is the reference example).

Dependencies that touch the outside world are **constructor parameters, not
imports**: the search service takes an `Embedder`, the chat service takes an
`Answerer` and a `Retriever`, the outbox drain takes a `Dispatcher`, and the
briefing service takes a `Generator`. That is what lets the whole machinery
ship and be tested before the AI Gateway or the queue exists.

`ls server/modules/` is the source of truth for how many there are; this
paragraph claimed fourteen against a directory of nineteen until 2026-09-06,
so **do not quote a count here** — read it at the source. What is worth
writing down is which modules depart from the shape above, so nobody goes
looking for a `repo.ts` that was never meant to exist:

- `outbox` is one function, `dispatchOutboxMessage`. It owns the service
  identity a queued message executes under, so the queue route authenticates
  the callback and does nothing else.
- `public-auth` has a service and no repo.
- `public-x-auth` is a pure re-export facade over `core/auth/public-x.ts` —
  no service, no repo, no database. It exists so `app/auth/**/route.ts` can
  reach that code under a carve-out in `eslint.config.mjs`.
- `assessments` is the reference for `rules.ts`: pure, DB-free policy, unit
  tested with no database at all.
- `briefing` carries eight files. `quality.ts` is `rules.ts` under another
  name; `jobs.ts` and `alerts.ts` are the retained stage runner and operator
  alert path; `external-publish.ts` and `codex-import.ts` are the two legacy
  ingests.
- `editorial-update`, `admin-console`, `homepage`, `media`, `publications`,
  `reports` and several others carry `index.ts` / `service.ts` / `repo.ts` with
  no `rules.ts` — the standard shape minus the policy file.
- `ops-agent` has `service.ts` with `tools.ts`, `context.ts` and
  `confirmations.ts` and no repo; `homepage` adds `catalog.ts` and
  `selection.ts`; `sources` adds the connector layer.

`editorial-update` is the module that executes a whole-site editorial package
— see [the whole-site editorial model](#the-whole-site-editorial-model) and
[`whole-site-updates.md`](whole-site-updates.md).

### Cross-cutting rules worth knowing before editing

- **`server/core/config.ts` is the only server-runtime file that reads
  `process.env`.** Nothing throws at import time — accessors throw at the point
  of use, naming the variable and what wanted it. Five other files read it and
  none is server runtime: `drizzle.config.ts`, `server/db/testing.ts`,
  `next.config.ts`, and two frontend modules reading a `NEXT_PUBLIC_*` name
  that Next substitutes at build time rather than reads at runtime —
  `lib/content/archive.ts` (`NEXT_PUBLIC_ARCHIVE_CDN`) and
  `components/auth/google-identity.ts`
  (`NEXT_PUBLIC_GOOGLE_IDENTITY_CLIENT_ID`).
- **`recordVersion()` in `server/core/versioning.ts` is the only write path
  for a versioned entity.** Row update, version row, head pointer, audit trail
  and reindex emit happen in one transaction. Nothing else may `UPDATE` a
  versioned table.
- **`emit()` in `server/core/outbox.ts` writes job intent inside the causing
  transaction.** Publishing to a queue after commit is not atomic; a crash in
  the gap loses the job with no error and no trace.
- **`server/db/client.ts` exports only the WebSocket `neon-serverless`
  driver.** `neon-http` cannot hold an interactive transaction, which makes
  `SET LOCAL ROLE` and `set_config(…, true)` silent no-ops. Do not add it back.
- **Rate limiting counts in Postgres**, not in module scope — Vercel Functions
  are per-region and recycled, so an in-process counter is a limit per
  instance, which under load is no limit at all.
- **Business rules live in SQL triggers as often as in TypeScript.** Status
  transitions, append-only tables, derived columns and the publish gate are
  enforced in `server/db/migrations/`. Changing a rule usually means a new
  numbered migration, not just a service edit.

### Background work

```mermaid
flowchart TB
    W["A versioned write<br/>recordVersion()"] -->|"same transaction"| OB[("outbox table")]

    OB --> Drain["GET /api/internal/cron/outbox-drain<br/>requireCron, every 15 min, 250 rows"]
    Drain -->|"dispatchToQueue"| Q{{"Vercel Queue<br/>topic: outbox-dispatch"}}
    Q --> Disp["POST /api/internal/queue/outbox-dispatch<br/>queue trigger, no public URL"]
    Disp --> Cons["server/jobs/consumers<br/>consumerFor(topic)"]
    Cons --> Reindex["search.reindex → search().reindex()"]
    Cons --> Email["email.notification → sendWorkspaceEmail()"]
    Cons --> Invalidate["publication.cache-invalidate → expirePublicPublicationCache()"]
    Cons --> Alert["briefing.alert → deliverBriefingAlert()"]
    Cons --> Run["editorial.run-process → processEditorialRun()"]
    Cons --> Report["editorial.run-report → deliverEditorialRunReport()"]
    Cons -.->|"tombstone, no producer"| Detect["item.detected"]

    Drain -.->|"queue unreachable"| Backoff["stay pending<br/>30s → 1h backoff"]
    Backoff -.-> Drain
```

One queue topic for the outbox, fanned out by the row's own `topic` column —
opening a new kind of background work is "add a case to a registry", not "add a
route, a `vercel.json` trigger, and a redeploy". A whole-site editorial run
follows exactly that pattern: the ingest route writes `editorial.run-process`
inside the transaction that records the run, and the drain executes it.

The retained legacy briefing pipeline is the deliberate exception: its stages
*are* separate routes with separate triggers, because each one needed its own
`maxDuration` and its own retry interval. Nothing triggers them now.

The drain is the path that cannot lose a job: it runs with no dependency on
Vercel Queues at all, and a row that fails to dispatch simply stays pending
with a backoff.

**`TOPICS` in `server/core/outbox.ts` is the whole list, and `item.detected` is
not in it.** A reader who finds a consumer with no producer should know that is
deliberate. Retiring a topic is two deploys, not one: the producers go and the
topic moves into `RETIRED_TOPICS`, which `emit()` does not accept — so naming it
again is a type error rather than a convention someone has to remember — while
its consumer stays registered as a tombstone. It has to. Rows written before the
change may still be undrained in a real database, and `dispatchOutboxMessage`
throws on an unregistered topic, so a queue message for one would retry against
that throw until the queue gave up. The consumer and the `RETIRED_TOPICS` entry
are deleted together, once

```sql
SELECT count(*) FROM outbox WHERE topic = 'item.detected' AND published_at IS NULL
```

reads 0 in Production and the queue has no message left in flight.

`embedding.refresh` was removed outright rather than retired, because the git
history shows no commit ever emitted it: it was a Phase-6 placeholder, so there
can be no undrained row to acknowledge.

**The drain limit is a throughput, and it was sized by an edition's reindex
burst.**
`DEFAULT_DRAIN_LIMIT` is 250; the cron runs every 15 minutes, so that is 1,000
rows an hour. One edition materializes roughly a claim per paragraph and emits
a `search.reindex` for each — about 190 rows arriving at once. At the previous
limit of 25 that took eight ticks, so a story published at 05:00 was not
searchable until nearly 07:00. At 250 it drains on the first tick with room for
a double-length edition and whatever ordinary traffic accumulated alongside it.
The ceiling is the route's `maxDuration = 60`: each row costs one queue `send`
and one single-row `UPDATE`, so 250 finishes well inside the budget even at a
pessimistic 150ms a row. Overshooting is not destructive either, since
`published_at` commits per row and the next tick resumes from where a timeout
stopped.

### Ingestion → publication

```mermaid
flowchart LR
    Feed["RSS source"] -->|"connector.fetch()"| Ing["ingestSource()"]
    Ing -->|"before any transaction"| Blob[("Vercel Blob<br/>raw bytes")]
    Ing -->|"one transaction"| Ev[("evidence + source_fetch")]
    Ev --> Item[("information_item")]
    Item --> Assess["item_assessment<br/>+ second human reviewer"]
    Assess -->|"publish gate<br/>SQL trigger"| Pub[("publication / published_item")]
    Pub --> Proj["search_document"]
    Proj --> API["GET /api/v1/search<br/>GET /api/v1/published-items"]
```

**One connector is registered today: RSS.** `CONNECTORS` in
`server/modules/sources/connectors/index.ts` is a static const array on
purpose — a filesystem scan or a dynamic `import(kind)` would let the bundler
miss a connector entirely, and the failure would only surface in production as
"connector not found" for a source that looked perfectly configured.

The network fetch and the Blob upload happen **before** any transaction opens —
holding a database transaction across either would turn a slow feed into a held
lock. Everything after commits as one unit: a `source_fetch` row whose
`items_new` count does not match what is queryable is worse than no record.

`status` (workflow position) and `assessment` (what we concluded) are
deliberately never collapsed into one axis. An item can be `published` with any
assessment and `under_review` with any; a schema that fuses them makes "we are
still checking" unrepresentable.

### The whole-site editorial model

The path above is the human one: a reviewer approves an assessment and the
publish gate checks that the approver is a person other than the author. There
is a second path to the same `publication` table, and it publishes without a
human at all.

That path is now a **whole-site daily editorial update**, not a briefing. A
composer working outside this repository produces one package describing new
articles, updates to live stories, and homepage placement; the application
validates, executes and reports on it. Nothing inside the deployment composes:
there is no cron, queue trigger, admin action or agent tool that starts
research, drafting or an edition.

```mermaid
flowchart LR
    Pkg["editorial-updates branch<br/>whole-site-update-v1 JSON"] --> GA["GitHub Action<br/>tooling checked out from main"]
    GA -->|"x-editorial-update-secret"| In["POST /api/internal/<br/>editorial-updates/ingest"]
    In --> Run[("editorial_run + editorial_operation<br/>emit editorial.run-process")]
    Run --> M["media stage<br/>fetch once → Blob"]
    M --> P["publication stage<br/>applyEditorial, one txn per operation"]
    P --> H["homepage stage<br/>placements → ensureEdition"]
    H --> R["report<br/>+ editorial.run-report email"]
    GA -.->|"poll /runs/{runId}"| R
```

Full operational reference: [`whole-site-updates.md`](whole-site-updates.md).

**Five destinations, one routing decision.** `publication.section` is the only
editorial choice the package makes about placement; `routePublication()` in
`lib/publication-routing.ts` derives the hub, the homepage band, the
breadcrumb and the card label from it, in one map, exhaustive over the section
enum by construction. This file exists to prevent the alternative — a second
model-chosen field plus scattered `section === "narrative_watch" ? … : …`
ternaries — which is how a record ends up filed as news on the homepage and as
a claim assessment on its own page.

- **News & Analysis** (`/geopolitical-brief`) — `daily_brief`,
  `israel_update`, `news`.
- **Fake Resistance** (`/fake-resistance`) — `narrative_watch`,
  `influence_investigation`, `antisemitism`.
- **The People of Israel** (`/people-of-israel`) — `innovation`,
  `science_medicine`, `technology_ai`, `achievement`,
  `international_cooperation`, `people`, `courage_service`, `history_context`.
  `/our-heroes` and `/israels-story` remain live pages at their own addresses.
- **October 7** (`/october-7`) — a curated archive. There is no section that
  routes there and no homepage area for it, so a run structurally cannot
  create, update or place October 7 material.
- **Behind the desk** (`/information-war`, labelled "How it works" in
  `components/site/navigation-model.ts`) — a static explainer of the method.

`history_context` is the one section that can be read into two hubs:
`routePublication(section, { historyContext })` lets a caller place an
explainer under News or Fake Resistance. Every other section has one home.

**The `editorial-update` module owns the durable run.** `index.ts`,
`service.ts`, `repo.ts` — the standard shape minus `rules.ts` — over the
`editorial_run` / `editorial_operation` ledger (migration `0059`). The run is
claimed with a five-minute lease and a fencing token, so an expired worker
cannot complete a run another worker reclaimed, and it proceeds in stages:

- **media** — `materializeExternalMedia` fetches each image once, reads its
  dimensions from the file header, and stores a content-addressed copy in this
  project's own Blob store. The draft is written to the operation row *before*
  the publication transaction, so a resume reuses it rather than refetching.
  Holding a transaction open across N downloads is how a 300-second function
  times out with locks held.
- **publication** — one short transaction per operation:
  `publicationService.applyEditorial()` inserts or updates the row, attaches
  the media, records the version through `recordVersion()`, and marks the
  operation completed. A failure marks **that operation** failed and the loop
  continues; the package does not stop.
- **homepage** — each named placement through `setHomepagePlacement()`, then
  `homepageService.ensureEdition()` cuts a new edition revision. A slot the
  package did not name keeps whatever it had.
- **report** — `completed` when nothing errored, `partial` otherwise. Both
  `finish` and `fail` emit `editorial.run-report`, so a crashed run reports the
  stage it died at.

`publication.editorial_run_id` / `editorial_operation_key` are this path's
machine provenance, parallel to `briefing_run_id` /
`briefing_candidate_key`. Since migration `0060`,
`enforce_publication_publish_gate()` accepts either pair and never neither —
see [`data-model.md`](data-model.md#the-publish-gate).

**The legacy briefing record format is retained and unreachable.** The
`briefing` module, its thirteen tables and its stage artifacts remain readable
for historical packages and audit evidence. Its internal stages have no cron,
queue trigger, admin action or operations-agent action, and cannot start new
editorial work.

```mermaid
flowchart LR
    Ev[("evidence")] --> E["enrich<br/>36h window, ≤120 rows"]
    E --> C["cluster"] --> T["triage"] --> D["draft"] --> Q["quality"] --> P["publish"]
    P --> Pub[("publication<br/>auto_published_at")]

    E -->|"artifact: evidenceIds"| Packet[("briefing_stage_artifact<br/>the closed packet")]
    Packet -.->|"recentEvidenceByIds()"| C
    Packet -.-> T
    Packet -.-> D
    Packet -.-> Q
```

Two properties of that record format are still worth knowing, because they
explain the shape of the stored rows:

- **The packet is closed at `enrich` and read by id afterwards.** The enrich
  stage wrote an artifact naming its `evidenceIds`; `evidenceForArtifact()`
  re-reads exactly that set through `recentEvidenceByIds()`. Re-opening the
  time window instead is not merely more expensive, it is wrong: it drops rows
  whenever an edition was processed outside the window, silently, right up
  until `validateDraftEvidence` threw on an id the model was legitimately
  given.
- **What the model saw was a truncation of what the checks read.**
  `sourcePacket()` cut each excerpt to 1,200 characters against a stored 6,000,
  so the check corpus stayed a superset of the model's view — the direction
  that cannot launder a fabrication.

`war_update` is gone in both directions: removed from `ARTICLE_SECTIONS` on
2026-09-01 and from the section contract entirely by the 2026-09-05 decision
(migration `0053`). `/war-update` is a permanent redirect to News & Analysis.
Security, war and operational material feeds the Daily Brief rather than
becoming a standalone destination.

**The deterministic quality suite runs on exactly one path.** Rows arriving
through the legacy external composer ingest
(`POST /api/internal/briefing/external-publish`) must pass every check in
`briefing/quality.ts`; `evaluateCandidate()` in `external-publish.ts` is the
one call site. Count the checks at the source — this paragraph said "eighteen"
against an array of seventeen until 2026-09-05, and no number belongs in prose.

⚠️ **Nothing else counts them.** This section described "two places that count
differently" until 2026-09-05, and both had been removed on 2026-09-03:
migration `0049` replaced the trigger's count with the machine-provenance check
above, and `595ca9d` deleted the counter from `publications/repo.ts`. The
whole-site path has **no quality gate** — a deliberate launch-period posture.
What is enforced on it is authentication, database integrity, media rights,
idempotency and transactional persistence. Ordered contracts return after
launch. See [`data-model.md`](data-model.md#the-publish-gate).

A Narrative Watch record may publish **citing nothing at all**, marked in
public as this organisation's own analysis rather than as documented fact.
Structurally that is a flag inside a jsonb column and a second branch inside
several checks — never a skipped check. `evidenceBasis` is derived
(`evidenceIds.length === 0`), never chosen by the model, and an absent value
must read as "sourced"; the reasoning is in
[`data-model.md`](data-model.md#the-narrative_watch_details-jsonb).

Current delivery path: [`whole-site-updates.md`](whole-site-updates.md).
Legacy compatibility path: [`briefing-packages.md`](briefing-packages.md).
The editorial standard a package is written to is
[`editorial-dna.md`](editorial-dna.md).

---

## Authentication, authorization, caching, state

### Authentication — Neon Auth with a single-admin boundary

`/api/auth/[...path]` proxies Neon Auth and restricts account creation to the
configured `ADMIN_EMAIL`. `authenticateAdmin()` reads the Neon Auth session,
rejects every other email with `FORBIDDEN`, then upserts the matching
`app_user` and its five capability grants. The `/admin` page and admin status
route require that session.

What is open is the `PUBLIC_V1` list in `server/http/handler.ts` — **nine
entries**: `GET /search`, `GET /published-items`,
`GET /published-publications` and its `/{publicId}`, `POST /reports`,
`POST /volunteer-interest`, and the four chat paths. Anything else under
`/api/v1/` goes through `authenticateAdmin()` and fails closed. `accessFor()`
classifies only `/api/v1/` and the internal cron and queue prefixes, so
`/api/internal/health` and the `/api/public-auth/*` and `/api/auth/*` routes
are outside the role machinery entirely and carry their own guards.

Development tests may still register an explicit `x-actor-label` shim. It is
never accepted in Preview or Production. `requireCapability()` checks the
capability set loaded from `capability_grant` and fails closed — but nothing
calls it, deliberately: see the known gaps below and `.ai/DECISIONS.md`.

### Authorization

Two mechanisms exist, at different levels of readiness:

- **Route-level guards.** `requireCron` (Vercel signs every cron invocation
  with `Authorization: Bearer $CRON_SECRET` once the env var exists) and
  `requireInternalSecret` (`x-internal-secret`, for routes Vercel does not
  sign). Deliberately different secrets — reusing one would mean rotating
  either silently breaks the other.
- **Row-level security.** Migration `0015_rls_and_hardening.sql` creates
  `app_public`, `app_staff` and `app_service`, enables RLS on the sensitive
  tables and writes the policies. The test harness exercises them for real
  through `as()`, which opens a transaction, sets the role, and refuses to
  continue unless `current_user` actually changed.

  **The runtime does assume a role, as of 2026-08-27.** This paragraph said the
  opposite — that `setIdentity()` set `app.identity` for audit attribution only
  and the connection ran as the owner, so no policy applied. `server/http/handler.ts`
  now wraps every classified request in `withDatabaseRole(role, identity, invoke)`,
  and `server/db/client.ts` takes a dedicated pooled connection, issues `SET ROLE`
  plus `set_config('app.identity', …)`, and `RESET ROLE` / `RESET ALL` on
  release. Migration `0018` grants the owner membership in the three roles so
  `SET ROLE` succeeds; `0019` adds the policy that lets `INSERT … RETURNING`
  work under `app_public`. The reversal is recorded in
  [`../.ai/DECISIONS.md`](../.ai/DECISIONS.md).

  **The surviving gap is that `withDatabaseRole` has no test.** `tests/rls.test.ts`
  proves the policies with `SET LOCAL ROLE` inside a transaction on PGlite,
  which is not the pooled session-scope mechanism production uses — so the
  mechanism that replaced the untested one is itself untested.

### Caching

- `next.config.ts` sets `Cache-Control: public, max-age=31536000, immutable`
  on `/particles/*` and `/icons/*` — content-addressed bake output.
- Every one of the 66 `/api/**` routes declares `runtime = "nodejs"`, and every
  one that answers a `GET` also declares `dynamic = "force-dynamic"`. Nothing in
  the API is cached by Next. The eight without it are the queue-trigger routes,
  which are `POST`-only.
- `ScanBackdrop` wraps its corpus read in React `cache()`, deduplicating the
  ~134KB file read per render pass.
- Section and doc pages prerender as static; the `/api` routes are dynamic.
  `npm run build` prints the split.

On the page side, **published articles are the one cached read, and they are
cached three deep.**
`lib/publications.ts` wraps each public projection in `unstable_cache` with the
`publications` tag and a 300-second `revalidate`, then wraps *that* in
`publicReadCache` (a module-scope map with a 5-minute TTL) and in
`withLastGoodRead` (a 24-hour recovery cache that returns the last complete read
if the database is unreachable, and rethrows otherwise). Each layer answers a
different failure: Next's cache spans instances, the module map survives a
`revalidate` miss inside one instance, and the last-good read is what stops a
Neon blip from turning the front page into an error. The whole stack is expired
by `expirePublicPublicationCache()`, which the `publication.cache-invalidate`
outbox consumer calls — and which route handlers also call directly after an
admin edit commits, because a reader should not wait for a queue tick to stop
seeing a story that was just archived.

### State

- **Server:** Postgres is the only durable store. No Redis, no KV. Two
  in-process caches outlive a request, both described above and both derivable
  from Postgres: `public-read-cache.ts` and `last-good-read.ts`. Losing either
  costs a re-read, never a fact. (The module `index.ts` memoisation holds a
  connection pool, not data.)
- **Client:** the particle nav's `interactionMachine` plus the intro gate's
  blocking state. The renderer's per-frame state is a mutable object
  outside React entirely, by design.
- **Chat has no client persistence** — and no client surface either: the four
  chat routes under `/api/v1/chat` are live and public, but nothing in
  `app/**` or `components/**` calls them.

---

## External services

These services are provisioned for the linked Vercel project. Frontend work
must not silently create additional resources; Preview and Production use
separate data boundaries.

| Service | Used by | Configured via | State |
| --- | --- | --- | --- |
| Neon Postgres | everything under `server/` | `DATABASE_URL` (pooled) | Launch, main + isolated Preview branch |
| Neon Auth | `/api/auth/[...path]`, admin session | `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET` | one allowlisted admin |
| Vercel Blob | RSS bytes and archive media | `BLOB_READ_WRITE_TOKEN`, archive-prefixed variables | RSS stores + dedicated archive store |
| Vercel AI Gateway | chat, embeddings, briefing triage and draft | Vercel OIDC in linked Functions | provisioned, $5 Gateway cap |
| Vercel Queues | outbox dispatch and package execution | OIDC (`vercel link`, `vercel env pull`) | `outbox-dispatch` only — hyphen, never a dot: the queue API refuses any other character at `send()` |
| Vercel Cron | ingest, embed, drain, maintenance | `CRON_SECRET` | four schedules in `vercel.json` |

The queue's absence is not fatal for the outbox: the drain cron dispatches
straight to it and retries on the next tick if unreachable. Production has the
topics configured; Preview is isolated and cannot write its messages to
Production — and `runStage` refuses outright when `appEnv()` is `preview`, so a
Preview deploy cannot spend Gateway budget or publish an edition.

Model **profiles** (`fast`, `reasoning`, `translation`, `briefingTriage`,
`briefingDraft`, `embedding`) are the only names application code uses; the
provider slugs live in one map in `server/core/config.ts`. The briefing stages
have their own two profiles rather than borrowing `fast` and `reasoning`,
because those two are also what chat runs on — a model swap made for the chat
answer should not silently change what an edition drafts.
`embedding` is load-bearing — its 1536 dimensions are
baked into `search_document.embedding` as `vector(1536)`, and changing it is a
full table rewrite, so a different embedding model must be added as a second
column rather than swapped into this one.

---

## Known architectural gaps

Verified against the code on 2026-09-01. These are stated here so they are not
rediscovered; none of them is fixed by this document.

1. ~~**RLS is written and tested but not engaged at runtime.**~~ **Closed, and
   this entry was wrong from 2026-08-26 onward.** `server/http/handler.ts`
   calls `withDatabaseRole(access.role, access.identity, invoke)` for every
   request `accessFor()` classifies; it takes a dedicated pooled connection,
   issues `SET ROLE` plus `set_config('app.identity', …)`, and `RESET ALL` on
   release. Migration `0018` grants the owner membership in the three roles so
   `SET ROLE` succeeds. **`PUBLIC_V1` is exactly nine entries** — `GET /search`,
   `GET /published-items`, `GET /published-publications` and its `/{publicId}`,
   `POST /reports`, `POST /volunteer-interest`, and the four chat paths.
   Everything else under `/api/v1/` goes through `authenticateAdmin()` and fails
   closed, so the guard table in [`api.md`](api.md) understates how locked down
   the surface is. **`requireCapability()` is called from nowhere by decision**, not
   by oversight (`.ai/DECISIONS.md`, 2026-08-27): there is one account and
   `authenticateAdmin()` grants it every capability on each sign-in, so a check
   could only ever pass — while adding a way to be locked out. The SQL triggers
   and the `evidence_staff_reads_unrestricted` policy, which reads
   `capability_grant` directly, are what protect those operations.
   `tests/admin-capabilities.test.ts` pins that the owner holds all five; wire
   the check up when a second account exists.
   **One real gap survives inside this one:** `withDatabaseRole` has no
   test: `tests/rls.test.ts` proves the policies through `SET LOCAL ROLE` inside
   a transaction on PGlite, which is not the pooled session-scope mechanism
   production uses.
2. ~~**`.env.example` is not in git.**~~ **Closed** — `.gitignore` carries
   `!.env.example` after the `.env*` rule and the file is tracked
   (`git ls-files .env.example`). It is the template;
   [`environment.md`](environment.md) remains the reasoning, and describes the
   code where the two disagree.
3. ~~**`/api/internal/health` has no deep variant.**~~ **Closed** —
   `deepHealth()` in `server/core/deep-health.ts` is served by
   `GET /api/v1/admin/health/deep` behind `requireActor`, which is where a
   dependency probe belongs: `/api/internal/health` stays deliberately shallow
   so a degraded dependency does not make the deployment look dead to the
   platform's rollout gate. What survives is a stale comment — the
   configuration summary in `server/core/config.ts` still points readers at
   `/api/internal/health/deep`, a path that does not exist.
4. **The whole-site editorial path has no deterministic quality gate.** This is
   a deliberate launch-period posture rather than an oversight, and it is
   recorded here so it is not mistaken for one.
   `publicationService.applyEditorial()` does not call `evaluateCandidate()`,
   and nothing under `server/modules/editorial-update/` reads
   `REQUIRED_QUALITY_CHECKS`. A package that validates against
   `whole-site-update-v1` publishes. What still holds on that path:
   authentication, the provenance constraint and publish-gate trigger, media
   rights (`isArticleSafeMedia()` fails the operation rather than dropping the
   image), `recordVersion()` as the only write path for a versioned entity,
   idempotency on `run_key` plus the canonical request hash, and one
   transaction per operation. Ordered contracts return after launch.
5. **`withDatabaseRole` is not exercised for the editorial service identity.**
   The gap in entry 1 applies here too: the whole-site routes run as
   `app_service` / `service:editorial-updates`, and
   `tests/editorial-update-routes.test.ts` mocks `withDatabaseRole` out
   entirely rather than proving the session-scoped `SET ROLE` the production
   path uses.
6. **A deploy can strand a delivery run's contract.** A GitHub Action validates
   a package against the tooling on `main` at checkout time and posts it to
   whatever is deployed. A contract change landing between those two moments
   rejects a package that validated seconds earlier. Nothing detects this — the
   mitigation is procedural, in
   [`operations.md`](operations.md#deploying-across-a-delivery-run).
