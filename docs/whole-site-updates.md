# Whole-site editorial updates (`whole-site-update-v1`)

The current delivery path for editorial work. A composer working **outside this
repository** produces one JSON package describing new articles, updates to
existing ones, and homepage placement; the package is committed to the
`editorial-updates` branch; a GitHub Action validates it, posts it to an
authenticated receiver, and polls the durable run it starts.

The legacy `external-briefing-v1` path is documented separately in
[`briefing-packages.md`](briefing-packages.md) and is a compatibility route
only. The editorial standard a package is written to — voice, sourcing,
destinations, what each hub is for — lives in
[`editorial-dna.md`](editorial-dna.md); this document is the mechanism.

The application never composes. There is no cron, queue trigger, admin action
or agent tool that starts research, drafting or a daily edition. An explicit
package is the only initiator.

---

## Destinations

`publication.section` is the only editorial routing choice a package makes.
Every hub, homepage band, breadcrumb and card label is derived from it in
exactly one place — `routePublication()` in `lib/publication-routing.ts`.

| Destination | Route | Sections that file here |
| --- | --- | --- |
| News & Analysis | `/geopolitical-brief` | `daily_brief`, `israel_update`, `news` |
| Fake Resistance | `/fake-resistance` | `narrative_watch`, `influence_investigation`, `antisemitism` |
| The People of Israel | `/people-of-israel` | `innovation`, `science_medicine`, `technology_ai`, `achievement`, `international_cooperation`, `people`, `courage_service`, `history_context` |

`/our-heroes` and `/israels-story` remain live pages in their own right and
keep their addresses; The People of Israel presents them alongside the
dynamically published sections above.

Two site destinations take **no** package input:

- **October 7** (`/october-7`) is a curated archive. The contract has no
  section that routes there and no homepage area for it, so a run cannot
  create, update or place October 7 material.
- **Behind the desk / How it works** (`/information-war`, labelled "How it
  works" in `components/site/navigation-model.ts`) is a static explainer.

`routePublication()` is exhaustive over the section enum by construction — a
fifteenth section fails `tests/editorial-taxonomy.test.ts` rather than silently
defaulting to news.

---

## Why the packages live on their own branch

Packages are committed to the orphan **`editorial-updates`** branch and are
**never merged into `main`**.

A push to `main` deploys to Production. If a daily package landed on `main`,
publishing an article would redeploy the whole application: minutes of build
time, a new production deployment in the history, and a rollback surface, all
for rows in a database the running deployment already reads.

The branch is excluded from Vercel by
[`git.deploymentEnabled`](https://vercel.com/docs/project-configuration/git-configuration)
in `vercel.json` on `main`:

```json
"git": { "deploymentEnabled": { "briefing-packages": false, "editorial-updates": false } }
```

and again by the branch's own `vercel.json`, which is the copy that actually
suppresses the deployment because Vercel reads the config from the commit being
pushed:

```json
{ "$schema": "https://openapi.vercel.sh/vercel.json",
  "git": { "deploymentEnabled": false } }
```

The branch carries three files and nothing else — the workflow, that
`vercel.json`, and a README stating the rule — plus the packages themselves.
Sharing no history with `main` is what keeps the validation code from drifting:
the workflow always checks `main` out to get it.

### What lives where

| | `main` | `editorial-updates` branch |
| --- | --- | --- |
| Contract (`server/contracts/whole-site-update.ts`) | ✅ | — |
| Receiver routes, the durable run, the module | ✅ | — |
| `npm run editorial:publish` (`scripts/publish-editorial-update.ts`) | ✅ | — |
| `.github/workflows/publish-editorial-update.yml` | — | ✅ |
| The package `.json` files | — | ✅ |

---

## The flow, end to end

1. The composer writes `editorial-updates/<Israel-local-date>-<runId>.json` and
   commits it to the `editorial-updates` branch.
2. The push triggers `.github/workflows/publish-editorial-update.yml` on that
   branch (`paths: editorial-updates/**/*.json`). Its concurrency group is
   `editorial-update-delivery` with `cancel-in-progress: false`, so two pushes
   queue rather than race.
3. The job checks out `main` into `app/` for tooling and the pushed commit into
   `packages/`, installs with `npm ci`, then for **each changed package, in
   order**: `npm run editorial:publish -- <file> --dry-run`, then the same
   command without `--dry-run`.
4. The script parses the file against `wholeSiteUpdatePackageSchema`. A failure
   prints one line per Zod issue and exits `1` — nothing is sent.
5. It POSTs the package to `/api/internal/editorial-updates/ingest` with the
   `x-editorial-update-secret` header. The route guard is
   `requireEditorialUpdateIngestSecret()` in `server/http/internal-guard.ts`,
   a constant-time comparison against `EDITORIAL_UPDATE_INGEST_SECRET`.
6. The receiver records a durable run and emits `editorial.run-process` to the
   transactional outbox **inside the same transaction**, then answers `202`
   with `{ id, runId, status, statusUrl }`. Nothing has published yet.
7. The outbox drain delivers that message; `processEditorialRun()` executes the
   run (below).
8. The script polls `statusUrl` every 5 seconds for up to 20 minutes and prints
   one line per **state transition** — never a line per poll, never silence.
   Each line carries `status`, the derived `phase`, and while the run is still
   queued, the outbox row's `attempts` and the queue's last refusal:

   ```
   accepted runId=chatgpt-test-2026-09-07-001507
   runId=… status=queued phase=queued:awaiting-drain outboxAttempts=0
   runId=… status=queued phase=queued:dispatched
   runId=… status=running phase=running:publication
   runId=… status=running phase=running:homepage
   runId=… status=completed phase=completed
   runId=… status=completed created=3 updated=1 failed=0
   url=/articles/…
   ```

   `phase` is derived on the server (`describeEditorialRunPhase` in
   `server/contracts/editorial-update.ts`) from the run and its
   `editorial.run-process` outbox row, which the status body also returns as
   `delivery`. The three values a `queued` run can show are the ones that
   matter operationally: `queued:awaiting-drain` (the 15-minute drain cron
   has not run yet), `queued:drain-failing` (the drain tried and Vercel
   Queues refused — `delivery.lastError` says why), and `queued:dispatched`
   (handed to the queue, no worker has claimed it yet). The timeout is a
   safety boundary, not a budget: a run still queued at 20 minutes is a
   delivery fault, and the error names the last phase seen.

Every request under `/api/internal/editorial-updates/` runs as the database
role `app_service` with identity `service:editorial-updates` — the prefix is in
`SERVICE_PREFIXES` in `server/http/handler.ts`, so RLS is engaged for the whole
path.

### Running it by hand

```bash
npm run editorial:publish -- path/to/package.json --dry-run   # no secret needed
EDITORIAL_UPDATE_INGEST_SECRET=… npm run editorial:publish -- path/to/package.json
```

`EDITORIAL_UPDATE_INGEST_BASE_URL` selects the target deployment and defaults
to `https://lionsofzion.io`. Point it at a Preview URL to rehearse.

---

## The durable run

`server/modules/editorial-update/` is the module: `index.ts`, `service.ts`,
`repo.ts`. The ledger is `editorial_run` + `editorial_operation` (migration
`0059`); see [`data-model.md`](data-model.md).

`processEditorialRun()` claims the run with a five-minute lease and a fencing
token, so an expired worker cannot complete a run another worker has reclaimed.
Then, per operation, in package order:

- **Media stage.** If the operation carries `media`, `materializeExternalMedia`
  fetches `inputUrl` **once**, reads the dimensions out of the file header,
  and stores a content-addressed copy in this project's own public Blob store.
  The draft is saved to the operation row *before* the publication transaction,
  so a retry reuses it instead of refetching.
- **Publication stage.** One transaction: `publicationService.applyEditorial()`
  inserts or updates the publication, attaches the media, records the version
  through `recordVersion()`, and marks the operation completed. A create
  publishes immediately with `auto_published_at` set and
  `editorial_run_id` / `editorial_operation_key` as its machine provenance —
  which is what `enforce_publication_publish_gate()` checks since migration
  `0060`. An update requires a live (`published` or `updated`) target and moves
  it to `updated`.

A failure in either stage marks **that operation** failed, records the stage
and a recovery line, and the loop continues to the next one. It does not stop
the package.

- **Homepage stage.** Each decision in `homepage` is applied through
  `publicationService.setHomepagePlacement()`, then
  `homepageService.ensureEdition()` cuts a new homepage edition revision. A
  placement the package does not name is left alone — whatever occupies it
  survives the run.
- **Report.** The run finishes `completed` when nothing errored and `partial`
  otherwise, writing the report described below. Reaching a terminal state —
  through `finish` **or** `fail` — emits `editorial.run-report`, whose consumer
  emails the report to `editorialReportEmail()`.

### Media rights are enforced at publication, not degraded

`applyEditorial()` rejects the whole operation with a `VALIDATION_ERROR` when
an attached image is not article-safe — `isArticleSafeMedia()` requires
`rights.status === "cleared"` **and** `"article"` in `rights.surfaces`
(`server/contracts/editorial-media.ts`). A package that sends
`"status": "unknown"` media does not publish the article without a picture; the
operation fails and the run reports `partial`. Send no `media` key at all
rather than uncleared media.

### Partial success, and how a run is resumed

The status endpoint and the report both distinguish `completed` from `partial`.
The report is assembled in `processEditorialRun()` and stored on the run row;
`GET /api/internal/editorial-updates/runs/{runId}` returns it verbatim. Read
the `store.finish(…)` call in `server/modules/editorial-update/service.ts` for
the current field list rather than trusting this shape:

```json
{
  "status": "partial",
  "publications": { "requested": 4, "created": 2, "updated": 1, "failed": 1 },
  "byCategory": { "daily_brief": { "created": 1, "updated": 0 } },
  "operations": [ { "publicationId": "…", "publicId": "…", "canonicalStoryId": "…",
                    "url": "/articles/…", "action": "create",
                    "section": "daily_brief", "title": "…", "hasMedia": true } ],
  "urls": ["/articles/…"],
  "homepage": { "editionDate": "2026-09-06", "revision": 3,
                "changes": [ { "area": "news", "position": "lead", "action": "set",
                               "publicId": "…", "url": "/articles/…" } ] },
  "media": { "prepared": 2, "reused": 0, "generated": 1 },
  "errors": [ { "operationKey": "…", "stage": "media", "message": "…", "recovery": "…" } ],
  "siteRecommendations": ["…"]
}
```

`byCategory` is keyed by `publication.section`, so it says which desk actually
received something — a run total does not. `homepage.changes` lists only the
slots this run moved. `stage` on an error is one of `media`, `publication`,
`homepage`, `report`.

To resume, take the run's **internal id** (the `id` field the ingest response
returned, or `GET /api/v1/admin/editorial-update`) and, signed in as the admin:

```http
POST /api/v1/admin/editorial-update/{id}
{"action":"resume"}
```

Only a `failed` or `partial` run may be resumed — anything else answers `409`.
Resume resets every `failed` or `running` operation to `pending`, clears the
run's failure, requeues `editorial.run-process`, and leaves completed
operations alone. Media artifacts already prepared are reused; already
published operations are not republished.

Re-POSTing the **same package** to the ingest route is also safe: `runId` is
unique and the request is hashed canonically, so a replay returns the original
run. The same `runId` with a *different* body is refused with `409` — one run
identifier never means two things.

---

## The package

`server/contracts/whole-site-update.ts` is the authority. Every object is
`.strict()`: an unrecognised key is a validation error, not an ignored field.

| Field | Rule |
| --- | --- |
| `contractVersion` | literal `"whole-site-update-v1"` |
| `runId` | trimmed, 1–200 characters; the idempotency key |
| `composer` | trimmed, 1–200 characters; recorded as `external:<composer>` |
| `createdAt` | ISO 8601 datetime |
| `creates` | array, max 100, defaults `[]` |
| `updates` | array, max 100, defaults `[]` |
| `homepage` | object, defaults `{}` |
| `siteRecommendations` | array of strings 1–4,000 chars, max 50, defaults `[]` |

Package-wide rules, all in the schema's `superRefine`:

- **Operation keys are unique across `creates` and `updates` together.**
- **A package needs at least one create, update, or homepage decision.** An
  empty package is refused.
- **A homepage `operationKey` must name an operation in this same package.**

### `creates[]`

`{ key, publication, media? }`. `publication` is `createPublicationSchema`:
`kind`, `title` (≤300), `body` (1–200,000) and `language` are required;
`section` is optional and defaults to `news` when the run applies it.
`kind` is one of `news_update`, `brief`, `geopolitical_analysis`, `scenario`.

Three refinements reject a package outright:

- a `scenario` must carry `scenarioLikelihood` (a band, never a number), and
  nothing else may carry one;
- `section: "narrative_watch"` requires `narrativeWatchDetails`, and no other
  section may carry them;
- every passage cites at least one evidence id — **except** a Narrative Watch
  record published as this organisation's own analysis, which cites nothing
  anywhere. `evidenceBasis` is derived (`evidenceIds.length === 0`), never sent.

### `updates[]`

`{ key, target, publication, media? }`. `target` is `{ publicId?,
canonicalStoryId? }` and needs at least one of them. `publication` is
`updatePublicationSchema`, whose only required field is `changeSummary`
(1–500) — it becomes the public correction line.

`canonicalStoryId` is a lowercase hyphenated slug, ≤160 characters, unique
across live publications. It is the stable identity of a developing story,
independent of its URL: set it on the create, then address later updates by it.

An update requires a live target. A `draft` or `archived` publication answers
`409` — a developing-story update is not a way to publish something new.

### `homepage`

Three areas — `news`, `fakeResistance`, `people` — each with an optional `lead`
and `secondary`. Six placements in total; there is no third position and no
fourth area (`homepage_placement_area_is_valid` and
`homepage_placement_position_is_valid` in migration `0062` enforce both in SQL).

Each decision is `{"action":"remove"}` or `{"action":"set","publication":…}`,
where the reference names **exactly one** of:

- `operationKey` — an operation in this package (the usual case for a new lead);
- `publicId` — an already-published article;
- `canonicalStoryId` — a developing story by its stable id.

Naming two, or none, is a validation error.

`setHomepagePlacement()` refuses a publication that is not live, that carries
no machine provenance, or **whose section does not file into that area** — a
`narrative_watch` record cannot occupy the `news` lead. A picture is not a
condition (owner ruling, 2026-09-07): a record without a hero takes the slot
and renders text-led, and the run report names it.

Each slot is applied under its own error boundary: a refused slot is recorded
in the run's `errors` as `homepage` with the message
`<area>/<position> was not placed: <reason>`, the remaining slots are still
applied, the edition is still recomposed, and the run reports `partial`. A
homepage reference to an operation that did not complete is reported the same
way.

### Internal UUIDs are never invented

`eventId`, `primaryTopicId`, `itemIds`, `narrativeIds`, `evidenceIds` and
`passages[].evidenceIds` are all real database UUIDs. A composer working
outside the repository does not know them, and a fabricated one is a foreign
key violation that fails the operation. **Omit them.** Address publications by
`publicId` or `canonicalStoryId` — the update target deliberately has no
`publicationId` field for exactly this reason.

### Cite web pages with `sources`, and the UUIDs are made for you

Every create and update accepts `sources` (`editorialSourceSchema`,
`server/contracts/editorial-update.ts`): an array of up to 40 cited pages,
each `{ url, title }` plus optional `publisher`, `publisherUrl`, `official`,
`canonicalUrl`, `publishedAt`, `excerpt` and `language` (default `en`). The
receiver turns each into a `source` row for the outlet — deduplicated on its
front page (`publisherUrl`, or the origin of `url`), registered `manual` and
inactive — and an `evidence` row for the page, deduplicated on `canonicalUrl`
(or `url`), and links it to the record inside the operation's transaction
(`server/modules/editorial-update/sources.ts`). The article page renders them
as "Public sources", and a `narrative_watch` create with at least one source
is `sourced` rather than `analysis`. Nothing is fetched: an `excerpt` marks
the page `fetched`, its absence `discovered`. The run report counts sources
attached per record. This is the field that replaces the missing
"source ingestion" capability the composer vetoed against on 2026-09-07.

---

## A minimal package that validates

Two articles and a homepage lead. Every field below is either required or
carries a constraint worth showing; nothing here is optional decoration.

```json
{
  "contractVersion": "whole-site-update-v1",
  "runId": "2026-09-06-0001",
  "composer": "ChatGPT",
  "createdAt": "2026-09-06T04:10:00.000Z",
  "creates": [
    {
      "key": "daily-brief",
      "publication": {
        "kind": "brief",
        "section": "daily_brief",
        "canonicalStoryId": "daily-brief-2026-09-06",
        "title": "The region this morning",
        "summary": "What moved overnight, and what it changes.",
        "body": "The full Daily Brief, in the site's own voice.",
        "language": "en",
        "editorialTopic": "Regional security",
        "topicTags": ["regional-security"]
      }
    },
    {
      "key": "people-feature",
      "publication": {
        "kind": "news_update",
        "section": "innovation",
        "title": "The lab turning brackish water into a crop yield",
        "body": "A finished feature about Israeli agricultural research.",
        "language": "en"
      },
      "sources": [
        { "url": "https://www.gov.il/en/departments/news/brackish-water-2026", "title": "Ministry announcement", "publisher": "Government of Israel", "official": true },
        { "url": "https://example-news.test/science/brackish-water-yield", "title": "Report on the trial results", "publisher": "Example News", "publishedAt": "2026-09-05T08:00:00+03:00" }
      ]
    }
  ],
  "updates": [],
  "homepage": {
    "news": { "lead": { "action": "set", "publication": { "operationKey": "daily-brief" } } },
    "people": { "lead": { "action": "set", "publication": { "operationKey": "people-feature" } } }
  },
  "siteRecommendations": []
}
```

**This example was executed** against the real validator on 2026-09-06 and
passed:

```
$ npm run editorial:publish -- example.json --dry-run
runId=2026-09-06-0001 composer=ChatGPT creates=2 updates=0
homepage=2 recommendations=0
```

That is the whole of what a dry run proves — the package satisfies
`whole-site-update-v1`. It does not check that an update target exists, that a
media URL resolves, or that a homepage reference will complete; those are run
concerns. Run the dry run before trusting any package, including this one after
a contract change.

A worked example of the *validating shape* that is executed on every test run
lives in `tests/whole-site-update-contract.test.ts`, and the route-level shape
in `tests/editorial-update-routes.test.ts`.

---

## Secrets

| Variable | Where | What it does |
| --- | --- | --- |
| `EDITORIAL_UPDATE_INGEST_SECRET` | Vercel (application) and GitHub Actions secrets on the delivery branch | The `x-editorial-update-secret` header on both `/api/internal/editorial-updates/*` routes |
| `EDITORIAL_UPDATE_INGEST_BASE_URL` | GitHub Actions secret; local shell | Which deployment the script posts to. Read directly by `scripts/publish-editorial-update.ts`; defaults to `https://lionsofzion.io` |
| `EDITORIAL_REPORT_EMAIL` | Vercel (application) | Where the run report is mailed. `editorialReportEmail()` falls back to `ADMIN_EMAIL` when unset |

The ingest secret is deliberately separate from `INTERNAL_API_SECRET`,
`CRON_SECRET` and `EXTERNAL_BRIEFING_INGEST_SECRET`: rotating the delivery
channel must not grant or revoke anything else. See
[`environment.md`](environment.md).

`EDITORIAL_UPDATE_INGEST_BASE_URL` is **not** read through
`server/core/config.ts` — it is a build/CI tool variable, read by the script
only, which is why it does not violate the single-`process.env`-reader rule.

---

## Operational reference

Runbook — dry-running, watching the Action, verifying the hubs, and recovering
a partial run — is in [`operations.md`](operations.md#whole-site-editorial-updates).
Routes and guards are in [`api.md`](api.md). Tables, provenance columns and the
publish gate are in [`data-model.md`](data-model.md).
