# HTTP API

Everything under `app/api/`. Two surfaces: `/api/v1/**` is the information
model, `/api/internal/**` is infrastructure that nothing outside Vercel should
be able to call.

**None of this is reachable in production today.** The API needs a database,
and `DATABASE_URL` is unprovisioned; the actor guard also refuses in
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
  "hits": [ { "documentId": "…", "entityType": "…", "entityId": "…", "title": "…", "score": 0.031 } ],
  "semantic": false
}
```

Anonymous by design: the projection contains only indexable material —
restricted and secret evidence is refused a row at all by `isIndexable()`.

**Not rate limited.** A `SEARCH_QUERIES` policy (120 per 60s) is declared in
`server/core/rate-limit.ts` and is not referenced by any route.

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

> **Gap.** `components/chat/AskTheLionChat.tsx` probes availability with the
> anonymous `GET /api/v1/chat/threads` and sends
> `x-actor-label: public-site-visitor` on its writes. In production
> `requireActor` throws regardless of that header, so with a database
> provisioned the probe would report "online" and every message would fail.

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
| POST | `/api/internal/queue/outbox-dispatch` | `queue` | Deliver one outbox message |

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

Production runs these handlers from the four schedules in `vercel.json`; each
is authenticated by `CRON_SECRET` and safe to retry. Preview remains isolated.
