# Lions of Zion

A Next.js public site and an information-model backend that share a repository.

The backend under `app/api/` and `server/` ingests sources, attaches evidence
to claims, has a second human review an assessment, and publishes what
survives. Neon, Blob and the AI Gateway are provisioned and live in Production
— see [`docs/vercel-infrastructure.md`](docs/vercel-infrastructure.md). Nothing
in the frontend requires them, which is why the app runs with no configuration
at all.

## Run locally

```bash
npm ci
npm run sync:start
npm run dev
```

Open <http://localhost:3000>. No configuration is needed: the frontend reads
no environment variables and the test suite runs against an in-process
database. Node 24.

## Routes

The eight primary destinations:

`/geopolitical-brief` · `/support-us` · `/war-update` · `/october-7` ·
`/our-heroes` · `/israels-story` · `/fake-resistance` · `/we-are`

Plus `/methodology` and `/corrections`.

`lib/site-navigation.ts` `SITE_NAVIGATION` is the source of truth for all eight.

### The October 7 archive

`/october-7` is also a hub. Roughly 1,177 further pages sit beneath it, holding
two crawled archives in full:

`/october-7/testimonies` — 179 records, up to seven languages
`/october-7/documentation` — 335 records, English and Spanish, six categories

The records' JSON is committed under `content-packages/`, while their ~1.8 GB
of media is not. It is served from `NEXT_PUBLIC_ARCHIVE_CDN`, or from a
gitignored local symlink in development.


## Commands

```bash
npm run typecheck
npm run lint
npm test
npm run build
npm run verify:changed  # adaptive checks for the current diff
npm run verify:full     # complete handoff and CI gate
npm run main:update     # merge a completed serious round into main and push it
```

`npm run lint` is where the architecture boundaries are enforced —
`eslint.config.mjs` states them as errors, so a violation fails the build
rather than waiting for review.



## Deployment

Git auto-deploy is connected: a push to `main` reaches Production on its own,
live on `lionsofzion.io` within about two minutes. CI runs the full gate plus a
route smoke test and does not deploy. (This paragraph said the opposite until
2026-09-04 — see `docs/operations.md` for the mechanism.)

## The Daily Brief

`/geopolitical-brief` publishes one edition per Israel-local day, fulfilled
from an externally composed package delivered to
`POST /api/internal/briefing/external-publish` (idempotent by run ID) or from
the administrator's run button (`POST /api/v1/admin/briefing/run`). There is no
scheduled cron — the old 07:00 briefing schedule was removed on 2026-09-03.
See [`docs/operations.md`](docs/operations.md).

## Documentation

Start at [`docs/`](docs/README.md).

| | |
| --- | --- |
| [`docs/architecture.md`](docs/architecture.md) | The system map, the enforced boundaries, the flows, the known gaps |
| [`docs/api.md`](docs/api.md) | Every HTTP route, its guard, its shape |
| [`docs/data-model.md`](docs/data-model.md) | Tables, triggers, versioning, RLS |
| [`docs/environment.md`](docs/environment.md) | Environment variables, by name |
| [`docs/operations.md`](docs/operations.md) | Install, verify, CI, deploy, troubleshoot |
| [`CLAUDE.md`](CLAUDE.md) | The working brief and the invariants |
| [`.ai/DECISIONS.md`](.ai/DECISIONS.md) | The ADR log — why things are the way they are |
