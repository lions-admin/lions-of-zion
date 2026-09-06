# HTTP API

Everything under `app/api/`. Two surfaces: `/api/v1/**` is the information
model, `/api/internal/**` is infrastructure that nothing outside Vercel should
be able to call.

**This API is live in Production.** These two paragraphs said the opposite
until 2026-08-27. `DATABASE_URL` is provisioned, and `server/http/handler.ts`
engages RLS per request via `withDatabaseRole`.

**The guard column below understates the lockdown.** `PUBLIC_V1` in
`handler.ts` is exactly seven entries — `GET /search`, `GET /published-items`,
`POST /reports` and the four chat paths. Every other `/api/v1/` route runs
through `authenticateAdmin()` and fails closed, so roughly a dozen routes
marked `anon` below are in fact staff-only; `GET /api/v1/evidence` among them.
Four routes are undocumented here entirely: `internal/cron/maintenance`,
`v1/admin/status`, `public-auth/session`, and `auth/[...path]`.

The superseded text: the actor guard also refuses in
production (see [Authentication](#authentication)). This document describes
what the code does, so that the day it is provisioned nobody has to re-derive
it.

---

## Conventions

Every route declares `runtime = "nodejs"` and `dynamic = "force-dynamic"`.
Nothing here is cached.

Every route is wrapped by `handler()` from `server/http/handler.ts`, which:

- derives a request id from `x-vercel-id`, then `x-request-id`, then a fresh
  UUID, and returns it as `x-request-id` on every response;
- validates bodies with `parseBody(request, schema)` and query strings with
  `parseQuery(request, schema)` — both zod, both turning a failure into a 422
  with per-field issues;
- translates a thrown `ApiError` into RFC 9457 `application/problem+json`, and
  anything else into a 500 whose body carries the request id and nothing else.
  The stack goes to the log as one JSON line.

### Error shape

```json
{
  "error": {
    "code": "VALIDATION_ERROR",
    "message": "Request body failed validation",
    "requestId": "iad1::abc123",
    "errors": [ { "path": ["body"], "message": "…" } ]
  }
}
```

`code` is stable and safe to branch on. `message` is written for a human and
never carries a stack, a query, a provider message or an environment value.

| `code` | Status |
| --- | --- |
| `VALIDATION_ERROR` | 422 |
| `UNAUTHENTICATED` | 401 |
| `FORBIDDEN` | 403 |
| `NOT_FOUND` | 404 |
| `CONFLICT` | 409 |
| `PRECONDITION_FAILED` | 412 |
| `RATE_LIMITED` | 429 |
| `INTERNAL_ERROR` | 500 |
| `NOT_IMPLEMENTED` | 501 |

### Pagination

List endpoints are keyset-paginated on `createdAt`. A full page carries
`nextCursor` (the last row's ISO timestamp); a short page omits it. Keyset
rather than offset, so the cursor stays stable while rows are inserted ahead
of it.

---

## Authentication

`/api/auth/[...path]` proxies Neon Auth. Account creation is restricted to the
configured `ADMIN_EMAIL`; `authenticateAdmin()` rejects every other address,
then ensures the corresponding `app_user` and capability grants exist.

In development, `x-actor-label: <name>` may identify a test caller. It is never
accepted in Preview or Production. `requireCapability()` reads the grants for
the authenticated actor and fails closed.

**Guard vocabulary used below:**

| Guard | Means |
| --- | --- |
| `actor` | Neon Auth session plus the database actor; `x-actor-label` only in development |
| `anon` | no guard at all |
| `cron` | `Authorization: Bearer $CRON_SECRET`, which Vercel signs automatically |
| `internal` | `x-internal-secret: $INTERNAL_API_SECRET` |
| `queue` | invoked by a Vercel Queue trigger; no public URL, so no guard to write |

---

## `/api/v1` — the information model

Guards are **per method**, not per route.

### Items

| Method | Path | Guard |
| --- | --- | --- |
| GET | `/api/v1/items` | `anon` |
| POST | `/api/v1/items` | `actor` |
| GET | `/api/v1/items/{id}` | `anon` |
| PATCH | `/api/v1/items/{id}` | `actor` |
| POST | `/api/v1/items/{id}/transition` | `actor` |
| GET | `/api/v1/items/{id}/eligibility` | `anon` |
| GET | `/api/v1/items/{id}/evidence` | `anon` |
| POST | `/api/v1/items/{id}/evidence` | `actor` |
| POST | `/api/v1/items/{id}/evidence/{evidenceId}/confirm` | `actor` |
| GET | `/api/v1/items/{id}/assessments` | `anon` |
| POST | `/api/v1/items/{id}/assessments` | `actor` |
| POST | `/api/v1/items/{id}/assessments/{assessmentId}/approve` | `actor` |

`status` and `assessment` are separate axes — see
[`data-model.md`](data-model.md#the-two-axes). `/eligibility` reports whether
an item currently satisfies the publish gate and what is missing.

### Evidence

| Method | Path | Guard |
| --- | --- | --- |
| GET | `/api/v1/evidence` | `anon` |
| POST | `/api/v1/evidence` | `actor` |
| GET | `/api/v1/evidence/{id}` | `actor` |

`POST` is for evidence a human enters directly rather than a connector
finding; the `manual` source kind exists for exactly that.

> **Gap.** `GET /api/v1/evidence` is anonymous and applies no `dataClass`
> filter — `listEvidenceSchema` accepts only `sourceId`, `kind`, `cursor` and
> `limit`. The intended protection is RLS, which the runtime does not
> currently engage. See [architecture.md](architecture.md#known-architectural-gaps).

### Sources and ingestion

| Method | Path | Guard |
| --- | --- | --- |
| GET | `/api/v1/sources` | `anon` |
| POST | `/api/v1/sources` | `actor` |
| GET | `/api/v1/sources/{id}` | `anon` |
| PATCH | `/api/v1/sources/{id}` | `actor` |
| POST | `/api/v1/sources/{id}/fetch` | `actor` |
| GET | `/api/v1/source-families` | `actor` |
| POST | `/api/v1/source-families` | `actor` |

Independence is counted in **source families**, not accounts — five outlets
owned by one group are one family.

### Assessments and review

| Method | Path | Guard |
| --- | --- | --- |
| GET | `/api/v1/review-queue` | `actor` |
| POST | `/api/v1/review-queue` | `actor` |
| POST | `/api/v1/review-queue/{id}/claim` | `actor` |
| POST | `/api/v1/review-queue/{id}/complete` | `actor` |

An assessment must be approved by a **different** human than the one who wrote
it; `assessments/rules.ts` owns that policy as pure, DB-free, directly
unit-tested code, and the database enforces it again in SQL.

### Publications

| Method | Path | Guard |
| --- | --- | --- |
| GET | `/api/v1/publications` | `anon` |
| POST | `/api/v1/publications` | `actor` |
| GET | `/api/v1/publications/{id}` | `anon` |
| PATCH | `/api/v1/publications/{id}` | `actor` |
| POST | `/api/v1/publications/{id}/transition` | `actor` |
| GET | `/api/v1/published-items` | `anon` |

The four publication surfaces — `news_update`, `brief`,
`geopolitical_analysis`, `scenario` — are one table with a `kind`
discriminator. `published-items` reads a SQL view that already filters to the
public statuses, which is why it needs no guard.

A `section` of `narrative_watch` requires `narrativeWatchDetails`, and no other
section may carry it — a biconditional held in the request schema, in the
service, and by the `narrative_watch_details_match_section` CHECK. Those details
now carry `evidenceBasis`. It is `"sourced"` for every record that cites its
sources, and `"analysis"` for a refutation published on this organisation's own
reasoning with no source at all.

`evidenceBasis` is derived from whether the record cites anything, not chosen,
and the request schema enforces the consequence: an `analysis` record's passages
must cite **no** evidence, and every other publication's passages must each cite
**at least one**. There is no half-sourced middle, which is what stops a single
cheap citation from buying the relaxed treatment. Anything the API accepts as
`analysis` renders to the public with an explicit disclosure and an
`Analysis: ` title prefix, so it is never mistaken for a documented report.

### Narratives and actors

| Method | Path | Guard |
| --- | --- | --- |
| GET | `/api/v1/narratives` | `actor` |
| POST | `/api/v1/narratives` | `actor` |
| GET | `/api/v1/narratives/{id}` | `actor` |
| PATCH | `/api/v1/narratives/{id}` | `actor` |
| POST | `/api/v1/narratives/{id}/items` | `actor` |
| POST | `/api/v1/narratives/{id}/observations` | `actor` |
| GET | `/api/v1/actors` | `actor` |
| POST | `/api/v1/actors` | `actor` |
| GET | `/api/v1/monitoring/now` | `actor` |

A narrative has no verdict and an observation has no anonymity — that
asymmetry is deliberate and recorded in `.ai/DECISIONS.md`.

### Search

| Method | Path | Guard |
| --- | --- | --- |
| GET | `/api/v1/search` | `anon` |

```
GET /api/v1/search?q=…&entityType=information_item&limit=25
```

`q` is 1–500 characters; `limit` is 1–50, default 25.

```json
{
  "query": "…",
  "hits": [
    {
      "documentId": "…",
      "entityType": "brief",
      "entityId": "…",
      "publicId": "what-we-know-…-x9y8z",
      "href": "/articles/what-we-know-…-x9y8z",
      "title": "…",
      "score": 0.031
    }
  ],
  "semantic": false
}
```

Anonymous by design: the projection contains only indexable material —
restricted and secret evidence is refused a row at all by `isIndexable()`.

**Rate limited**, contrary to what this said until 2026-09-02: the route calls
`rateLimit(bucketFor(request, "search"), SEARCH_QUERIES)` — 120 per 60s — on
top of the ambient `PUBLIC_API_READS` (600 per 60s) that `handler.ts` applies
to every anonymous GET.

`publicId` and `href` were added on 2026-09-02 (migration
`0048_search_destination`) and are the reason a hit is now usable. Before them
a result carried `entityType` + `entityId` and nothing public could resolve
either: `published-publications` filters on `public_id`, not on a uuid, and no
route mapped one to the other. **`href` is nullable and the null is
load-bearing** — an `information_item` has a public id and no page anywhere,
and a publication is addressable only when it carries a `briefing_run_id`,
because `/articles/[publicId]` is briefing-only. A client that builds a URL out
of `publicId` will manufacture 404s; render an unreachable hit as unreachable.

`score` is a Reciprocal Rank Fusion score, comparable *within* one result set
and meaningless outside it. It is not a percentage and not a confidence, and
must never be shown to a reader as either.

`semantic: false` means this deployment has no pgvector, so the results are
lexical only — surfaced rather than hidden, because "no semantic results" and
"semantic search is off" look identical from the outside and are very
different problems.

### Public reports

| Method | Path | Guard |
| --- | --- | --- |
| POST | `/api/v1/reports` | `anon` + rate limit |
| GET | `/api/v1/reports` | `actor` |
| POST | `/api/v1/reports/{id}/triage` | `actor` |

**The only write path in the system open to an unauthenticated stranger**, and
the one the site's own Support Us form uses.

```json
POST /api/v1/reports
{ "url": "https://…", "body": "…", "reporterEmail": "…", "reporterNote": "…" }
```

Every field is optional, but a report needs a `url` **or** some `body` — an
empty report is not a report. Reporter identity is optional on purpose:
requiring it chills exactly the reports most worth having.

```json
201 Created
{ "publicId": "…", "status": "received", "receivedAt": "2026-08-26T…Z" }
```

A receipt, not the row. Nothing submitted is echoed back — that keeps the
endpoint from being a trivially abusable reflector and keeps unreviewed public
text out of responses.

Rate limit: **10 submissions per hour** per bucket. The bucket is a SHA-256 of
`x-forwarded-for` (or `x-real-ip`, or a shared `unknown`), truncated to 32
characters — storing raw IPs would turn the table into a visitor log. Counting
happens *before* the decision, so a rejected request still contributes to the
window. Over the ceiling returns `RATE_LIMITED` (429).

### Chat — "Ask the Lion"

| Method | Path | Guard |
| --- | --- | --- |
| GET | `/api/v1/chat/threads` | `anon` |
| POST | `/api/v1/chat/threads` | `actor` |
| GET | `/api/v1/chat/threads/{id}/messages` | `anon` |
| POST | `/api/v1/chat/threads/{id}/messages` | `actor` (`maxDuration = 120`) |

Chat **does not stream tokens**, and that is the point: a citation must have
been retrieved before the sentence containing it is shown, and the database
enforces that with a CHECK. Citations come from a structured tail, not from
inline markers.

A citation carries `{ documentId, quote, title, href }`. `title` and `href` were
added on 2026-09-02 and are resolved from the search projection at read time,
not copied into `chat_citation`: the citation must keep naming the document it
named, while the document's title and location belong to the projection. Both
are nullable — a document that has since left the index, or one an anonymous
reader's RLS policy hides, resolves to neither, and the transcript renders the
citation without a link rather than inventing one.

> **Privacy defect, unfixed: `GET /api/v1/chat/threads` must not be built on.**
> It applies no creator filter of its own. What keeps one anonymous caller out
> of another's transcript is the `chat_thread_public_own` RLS policy, which
> matches `created_by_label` against `app.identity` — and `app.identity` is
> `anonymous:<HMAC of the caller's IP>`. Everyone behind one household router,
> one office NAT or one carrier's CGNAT is therefore one identity, and this
> endpoint will list them each other's conversations. `/ask` holds its thread
> id in the browser and never calls it. The same mechanism has a second,
> visible consequence: a thread is only reachable from the network that created
> it, so changing network 404s the transcript.

> **Correction, 2026-09-02:** the note below said no public page mounts a chat
> client. `/ask` does, through `components/ask/`.

> **Gap — half closed 2026-08-27.** This said every public chat message would
> fail in production because `requireActor` throws regardless of the client's
> header. That is no longer true: the four chat paths are in `PUBLIC_V1`, and
> `server/http/handler.ts` calls `registerActor` with an HMAC'd anonymous label
> and `userId: null` under `app_public`. Public chat works.
>
> **Current public surface:** the global chat launcher was removed from the
> editorial shell. These endpoints remain versioned backend entry points, but
> no public page currently mounts a chat client for them.

### AI suggestions

| Method | Path | Guard |
| --- | --- | --- |
| GET | `/api/v1/ai/suggestions` | `anon` |
| POST | `/api/v1/ai/suggestions` | `actor` |
| GET | `/api/v1/ai/suggestions/{id}` | `anon` |
| POST | `/api/v1/ai/suggestions/{id}` | `actor` |

**A model never writes to an entity.** It produces a suggestion; a human
accepts it, and the acceptance is what writes — with `changeSource =
ai_suggestion_accepted` and a mandatory `aiRunId`, which the database enforces
so that forgetting is a constraint violation rather than an untraceable AI
edit.

---

## `/api/internal` — infrastructure

Never call these from a browser.

| Method | Path | Guard | Purpose |
| --- | --- | --- | --- |
| GET | `/api/internal/health` | `anon` | Liveness |
| GET | `/api/internal/ai/models` | `internal` | What the AI Gateway actually offers |
| GET | `/api/internal/cron/ingest` | `cron` | Walk every active source (`maxDuration` 300) |
| GET | `/api/internal/cron/embed` | `cron` | Work the embedding backlog (`maxDuration` 300) |
| GET | `/api/internal/cron/outbox-drain` | `cron` | Dispatch pending outbox rows (`maxDuration` 60) |
| GET | `/api/internal/cron/editorial` | `cron` | Start the daily editorial-update run once past 07:00 Asia/Jerusalem (`maxDuration` 60) |
| POST | `/api/internal/queue/outbox-dispatch` | `queue` | Deliver one outbox message (`maxDuration` 300 — see note below) |
| GET, POST | `/api/v1/admin/editorial-update` | `admin` | List recent editorial runs; start a new one (`operations` mode takes an explicit operation list, `daily` takes none) |
| GET, POST | `/api/v1/admin/editorial-update/{id}` | `admin` | Read one run's state; `{"action":"resume"}` requeues a failed or partial run |

### Health

```json
{
  "status": "ok",
  "env": "development",
  "mayActOnTheWorld": false,
  "integrations": { "database": false, "blob": false, "aiGateway": false, "internalSecret": false },
  "requestId": "…"
}
```

Deliberately shallow — it answers "is this deployment running", not "is
everything downstream healthy", so it stays useful as a rollout gate when a
dependency is degraded. `integrations` reports booleans only; a health
endpoint that leaks the shape of a connection string is a health endpoint that
leaks.

`mayActOnTheWorld` is a positive test for production, never a negative test
for preview — a new environment name nobody anticipated lands on "not
allowed" instead of "allowed by omission".

> There is no `/api/internal/health/deep`, though `server/core/config.ts`
> refers to one.

### Cron behaviour

- **ingest** — walks every active source of every registered connector kind.
  One route rather than one per source: adding a source is an `INSERT`, never
  a new cron entry. A failure on one source is caught and reported per-source.
- **embed** — the backlog is `indexed_content_hash IS DISTINCT FROM
  content_hash`, a comparison rather than a queue, so this is safe to run at
  any cadence, safe to run concurrently with itself, and self-healing after a
  crash. With no AI Gateway it reports `skipped` with the backlog size rather
  than failing; a scheduled job that alarms on a deliberate, known state is one
  people learn to ignore.
- **outbox-drain** — the half that cannot lose a job. It has no dependency on
  Vercel Queues; a row that fails to dispatch stays pending with a
  30s → 2m → 10m → 30m → 1h backoff.
- **editorial** — evaluates Jerusalem local time itself rather than trusting
  the schedule string, so the first tick at or after 07:00 starts the day's
  run and a missed tick (a deploy, a cold start) is recovered by the next one
  fifteen minutes later. Deduplicated per local date: a second call the same
  day returns the existing run rather than starting another.
  `/api/internal/queue/outbox-dispatch`'s `maxDuration` was raised from 60 to
  300 on 2026-09-06 because this cron's run dispatches straight into that
  route and its research stages are the same AI-heavy work the briefing
  pipeline budgets 300s for elsewhere — every other outbox topic finishes in
  well under a second either way.

Production runs these handlers from the five schedules in `vercel.json`; each
is authenticated by `CRON_SECRET` and safe to retry. Preview remains isolated,
and its editorial run always reports `skipped` at the research stage — the
same `preview_dry_run` guard that stops the briefing pipeline from spending on
a non-production environment.

## The console expansion — 4–5 September 2026

Dated record of the routes added by the operations-console upgrade. All are
under `/api/v1/admin/` (wrapper role `app_staff`, `requireActor`, staff
non-GET additionally Preview-refused, origin-asserted and rate-limited like
every console mutation). Request/response shapes are stated by the referenced
schemas in `server/contracts/admin-console.ts`; this list records route,
method, guard and purpose only — `docs/api.md`'s per-route tables for the
original console reads predate this section and are unchanged.

| Route | M | Purpose | Contract |
| --- | --- | --- | --- |
| `admin/console/quality-checks` | GET | Per-candidate quality-check matrix (17 `REQUIRED_QUALITY_CHECKS`) for a `runId` or Israel-local `localDate` — exactly one | `listQualityChecksSchema` |
| `admin/console/editions/[localDate]` | GET | One edition's drill-down: stage runs, per-stage `ai_run` figures, latest artifacts, claims, stage jobs | `listEditionDrilldownSchema` |
| `admin/console/sources/[id]/fetches` | GET | Latest N `source_fetch` rows for one source + Israel-local "today" aggregate | `sourceFetchesQuerySchema` |
| `admin/console/outbox/drain` | POST | Manual outbox drain (reversible; audit `ops.outbox.drained` in a separate tx) | `drainOutboxSchema` |
| `admin/console/maintenance/tick` | POST | On-demand prune → job recovery → alert evaluation (audit `ops.maintenance.tick`) | — |
| `admin/console/quarantine/[id]/resolve` | POST | Close an open `briefing_quarantine` row (refuses already-closed; audit) | `quarantineDecisionSchema` |
| `admin/console/quarantine/[id]/discard` | POST | Discard an open quarantine row — requires a note, danger-confirmed in UI | `quarantineDecisionSchema` |
| `admin/console/sources/collect-sweep` | POST | Enqueue due collection jobs only (honours pause + `shouldCollectSource`; audit `ops.collection.sweep`) | — |
| `admin/console/reports` | GET | Public-report desk: keyset page + latest status-trail entry | `consoleReportsSchema` |
| `admin/console/chat/threads` | GET | Public-chat moderation list (message count, last activity) | `consoleChatThreadsSchema` |
| `admin/console/chat/threads/[id]/transcript` | GET | Ordered messages + tool runs + `ai_run` linkage | — |
| `admin/console/chat/threads/[id]/archive` | POST | Set `archived_at` (refuses already-archived; audit `ops.chat.thread_archived`) | — |
| `admin/console/system-internals` | GET | Embedding backlog depth, semantic-arm presence, embed-run figures, public-read-cache stats | `consoleSystemInternalsSchema` |
| `admin/console/ai/prompts` | GET / POST | Prompt registry list / append-only version insert (audit `ops.prompt.inserted`) | `insertPromptVersionSchema` |
| `admin/console/ai/prompts/activate` | POST | Activate a prompt version via the sanctioned `activate_prompt()` — changes what every future model call reads; danger-confirmed in UI (audit `ops.prompt.activated`) | `activatePromptVersionSchema` |
| `admin/console/entities/[entityType]/[entityId]/versions` | GET | Generic `entity_version` history, newest-first | `listEntityVersionsSchema` |
| `admin/console/evidence/[id]/provenance` | GET | Append-only provenance trail for one evidence row | — |

Telemetry added in the same round (not routes): `auth.refused` audit rows for
403 admin-email mismatches (`authenticateAdmin`, never the 401 no-session case
nor the dev bypass), and `email.sent`/`email.failed` audit rows written by the
`sendWorkspaceEmail` wrap in production only. `source_fetch` gained
`actual_cost_usd` (migration `0052` — apply to Preview, then Production,
before code that reads it is pushed); the Agent Search connector records the
per-query billed estimate there when the unit-cost env is set, and
`admin/console/costs` rolls it up beside the estimate.

## Public reader authentication — 5 September 2026

Two providers, deliberately not merged, on a surface that is separate from
admin authentication in every respect: different cookies, different secrets,
no `app_user` row, no capability grant, no route under `/api/v1/`. A public
reader session confers **no** access to anything the anonymous reader cannot
already see. Nothing here changes admin permissions.

`public-auth/session` was listed above as undocumented. It is documented here.

| Route | M | Guard | Purpose |
| --- | --- | --- | --- |
| `api/public-auth/session` | GET | none | Both provider identities plus per-provider availability. `no-store`. |
| `api/public-auth/google` | POST | none | Redeem a Google Identity Services credential into a `__Secure-lz-google-session` cookie |
| `api/public-auth/sign-out` | POST | none | Clear the Google session cookie |
| `auth/x` | GET | none | Begin X OAuth (PKCE + signed state). Refuses when X is not `ready`, redirecting to `/account?x_error=unavailable` without minting state |
| `auth/x/callback` | GET | signed state cookie | Complete X OAuth; on success sets `__Host-x-public-session` and 303s to `/account` |
| `auth/x/signout` | POST | none | Clear the X session cookie |

### The session response

Shape: `publicSessionResponseSchema` in `server/contracts/public-session.ts`.

```json
{
  "user": { "id": "google:…", "email": "…", "name": "…" },
  "x":    { "id": "…", "username": "…", "name": "…" },
  "availability": { "google": "ready", "x": "production-only" }
}
```

Three things about this shape are load-bearing:

- **`user` is Google, under the key it has always had.** The endpoint answered
  `{ user }` before X existed. X arrives *beside* it, never inside it, so no
  existing caller had to change.
- **`x` omits `profile_image_url`**, which the server does hold. The site's
  `img-src` does not include `pbs.twimg.com`, so the image would be blocked by
  the CSP — and allowing it would mean every page load by a signed-in reader
  issues a request telling X where that reader is. The UI draws initials.
- **`x` is gated on availability, not on the cookie.** A deployment that is
  not `ready` answers `null` however good the cookie looks. This is also what
  stops `readPublicSession` reaching for an absent `X_AUTH_SESSION_SECRET` and
  throwing.

### Availability, and why X is production-only

`ProviderAvailability` is `ready | unconfigured | production-only`.

`unconfigured` is not an error; it is a deployment without that provider's
credentials, and the account page renders it as a sentence rather than a button
that leads to a 500.

X is `ready` **only on the origin X was told to return to**. Its callback is
registered as `https://lionsofzion.io/auth/x/callback`, and its cookies are
`__Host-` prefixed with `secure: true`, which a browser will not write over
plain http. A sign-in begun anywhere else lands on Production carrying no state
cookie and fails on arrival. Preview is included: real https origin, wrong
callback.

`publicXAvailability(headers)` therefore compares the request's own origin
(`x-forwarded-host`/`x-forwarded-proto`, falling back to `host`) to that
callback origin. It does **not** ask `isProduction()`, and the difference is
not academic: both local `.env.local` files declare `VERCEL_ENV="production"`,
so the earlier `isProduction()` gate was true on localhost and
`GET http://localhost:3100/auth/x` really did answer `302` to x.com with a
`__Host-` cookie the browser refused. An environment variable is a claim about
where code runs; the request origin is the fact. No origin, or a mismatched
one, means `production-only` — the guard fails to the strict side.

Google has no `production-only` case — Google accepts `http://localhost` as an
authorised origin, and its cookie is `__Secure-`, not `__Host-`.

Note that `availability.google` answers "can a *new* sign-in start here", which
is not the same question as "is the current session valid". A deployment
holding `GOOGLE_AUTH_SESSION_SECRET` but no
`NEXT_PUBLIC_GOOGLE_IDENTITY_CLIENT_ID` reports `unconfigured` while still
returning a valid `user` for an existing cookie.

### What a failed X sign-in is allowed to say

The reader returns from x.com, so the outcome has to travel in a URL — and a
URL reaches the history, the referrer, and any analytics on the page it lands
on. So `?x_error=` is drawn from a **closed set of three of our own words**:
`cancelled`, `unavailable`, `failed`. The provider's `error` value is matched
against a known cancellation set and never reflected; no code, state,
verifier, token, status or client identifier appears in a redirect. The
account page maps the marker to copy and offers a retry; an unrecognised
marker is treated as `failed`.

`tests/public-session.test.ts` asserts that every redirect `Location` contains
none of those secrets, and that any marker present is one of the three words.
