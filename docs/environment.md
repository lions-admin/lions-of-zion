# Environment variables

**Names only. No values, ever.**

`server/core/config.ts` is the only application-runtime file that reads
`process.env`; everything else asks that module. That is what makes "no secret
in source" and "preview never touches production" auditable by grep rather
than by hope — one file to read, one list of names.

Nothing throws at import time. A missing `DATABASE_URL` must not stop the test
suite, which runs entirely against in-process PGlite, so the accessors throw at
the point of use, naming the variable and what wanted it.

> **The repository also contains `.env.example`, but it is not in git.**
> `.gitignore`'s `.env*` pattern captures it (`git check-ignore -v .env.example`
> confirms), so a fresh clone does not get it. This file is the tracked
> reference. See [the recommendation](#recommendation) below.

**Nothing here is required to run the test suite.** `npm test` needs no
configuration at all.

---

## Database

### `DATABASE_URL`
Neon Postgres, via the Vercel integration. Production and Preview each use a
different branch/connection string.

Must be the **pooled** (`-pooler`) connection string. The app uses the
WebSocket driver, which needs interactive transactions for identity-scoped
queries; `neon-http` cannot hold one, which makes `SET LOCAL ROLE` and
`set_config(…, true)` silent no-ops.

Wanted by: `server/db/client.ts`, and `drizzle-kit` for `db:migrate` /
`db:push` / `db:studio`. Generating migrations from the schema needs no
database at all.

### `TEST_DATABASE_URL`
A real Postgres **with pgvector**, for the integration tests PGlite cannot run.
Leave unset to skip those tests — `hasVectorDatabase()` gates them.

---

## Storage

### `BLOB_READ_WRITE_TOKEN`
Vercel Blob. Production and Preview use separate stores for raw fetched RSS
bytes.

Blob URLs are unguessable but public — evidence classified `restricted` or
`secret` is refused a `blob_url` by a database `CHECK`, not by convention.

Wanted by: `server/core/blob.ts`, reached through ingestion.

### `NEXT_PUBLIC_ARCHIVE_CDN`
Base URL for the October 7 archive's media. **Provisioned** — Vercel Blob
store `lions-of-zion-archive` (`store_M70Ph8nWOJVAnaRn`), served from
`https://m70ph8nwojvanarn.public.blob.vercel-storage.com`.

Preview and Production are set to the **same** store, not to separate
per-environment prefixes — verified 2026-08-26 by pulling both. Its companion
`ARCHIVE_BLOB_STORE_ID` is what `scripts/upload-archive-assets.mjs` uploads
through, and it is deliberately a different store from the one
`BLOB_READ_WRITE_TOKEN` points at.

Roughly 1.8 GB of images and video sits behind the ~1,177 archive pages and
deliberately never enters git. Only the URL prefix differs between
environments: unset, it falls back to `/archive`, which
`import-archive-package.mjs --link-assets` symlinks to the integration
packages for local development. Set it in production to the bucket's public
base — the assets are laid out beneath it as `<package>/originals/…` and
`<package>/web/…`, exactly as they sit in the package minus its `assets/`
prefix.

Being `NEXT_PUBLIC_`, it is substituted at build time rather than read at
runtime, which is why `lib/content/archive.ts` may read it without breaking
the rule that `server/core/config.ts` is the only runtime reader of
`process.env`.

**A wrong or empty value fails quietly**: pages still build, still pass the
tests and still render their text — only the media 404s. Prove the bucket is
right with:

```bash
node scripts/verify-archive-assets.mjs https://your-cdn/base --all
```

Wanted by: `lib/content/archive.ts` `assetUrl()`.

---

## AI

### `AI_GATEWAY_API_KEY`
Legacy local-development fallback for Vercel AI Gateway. Production uses the
short-lived Vercel OIDC token injected by the linked deployment; no permanent
provider key is stored there.

Application code asks for a model **profile** — `fast`, `reasoning`,
`translation`, `embedding` — never a provider slug. The mapping lives in
`MODEL_PROFILES` in `server/core/config.ts`, which is the only place a
provider model id appears.

Verify those slugs against `gateway.getAvailableModels()` when provisioning:
gateway slugs move, versioned ones use dots rather than hyphens, and a stale
slug fails at call time with a 400 rather than at deploy time.
`GET /api/internal/ai/models` lists what the gateway actually offers, for
exactly this check.

**`embedding` is load-bearing.** Its 1536 dimensions are baked into
`search_document.embedding` as `vector(1536)`.

### `NEON_AUTH_BASE_URL`, `NEON_AUTH_COOKIE_SECRET`, `ADMIN_EMAIL`
Neon Auth session configuration and the single allowed administrator address.
Production has one admin account; other addresses are refused with `403`.

### `AI_DAILY_BUDGET_USD`, `AI_MONTHLY_BUDGET_USD`
Ceilings in USD, checked before every call by `assertWithinBudget()` against
recorded spend in `ai_run`.

**Crossing one refuses the call** with `RATE_LIMITED` (429) — it does not
degrade to a cheaper profile. (The untracked `.env.example` says "degrades";
the code refuses. This file describes the code.)

The windows are rolling, not calendar: the last 24 hours and the last 30 days.
Unset means unbounded, which is only acceptable locally. A non-numeric or
non-positive value is treated as unset.

---

## Ingestion

**Vercel Queues authenticates via OIDC** (`vercel link`, `vercel env pull`),
not through an environment variable set here.

Its absence is not fatal. The outbox drain cron dispatches straight to it and
retries on the next tick if it is unreachable, so ingestion works with only
`DATABASE_URL` and `BLOB_READ_WRITE_TOKEN` configured.

---

## Runtime

### `INTERNAL_API_SECRET`
Guards internal queue and workflow routes via the `x-internal-secret` header.

### `CRON_SECRET`
Vercel sends `Authorization: Bearer $CRON_SECRET` on every cron invocation
automatically once this is set — there is nothing else to wire up.

Deliberately a **different secret** from `INTERNAL_API_SECRET`: reusing one
would mean rotating either one silently breaks the other. `cronSecret()`
returns `undefined` when unset, and `requireCron` treats unset as *refuse*,
never as *allow*.

### `APP_ENV`
`development` | `preview` | `production`. The local override; `VERCEL_ENV` is
authoritative where it exists, and `NODE_ENV` is the last fallback.

Anything unrecognised is treated as `development`, never as `production` —
guessing "production" wrong is the expensive direction.

Preview must never publish, never run production crons, and never mutate
production storage. `mayActOnTheWorld()` is a positive test for production
rather than a negative test for preview, so a new environment name nobody
anticipated lands on "not allowed" instead of "allowed by omission".

---

## Read by tooling, not by the app

| Variable | Read by | Note |
| --- | --- | --- |
| `DATABASE_URL` | `drizzle.config.ts` | Falls back to `postgres://unset`; only needed to push |
| `TEST_DATABASE_URL` | `server/db/testing.ts` | Test harness, not runtime |
| `NODE_ENV` | `components/graphics/viewport.ts` | Substituted at build time to strip a dev-only check |
| `VERCEL_ENV` | `server/core/config.ts` | Set by Vercel |

---

## Checking what is configured

```bash
curl -s http://localhost:3000/api/internal/health | jq
```

`integrations` reports booleans, never values — a health endpoint that leaks
the shape of a connection string is a health endpoint that leaks.

---

## Recommendation

`.env.example` should be tracked. A one-line negation in `.gitignore` after
the `.env*` rule would do it:

```
.env*
!.env.example
```

This has **not** been applied — it is a repository change rather than a
documentation one. Until it is, this file is the reference a fresh clone gets.
