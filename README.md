# `briefing-packages` — daily editions, not code

This is an **orphan branch**. It shares no history with `main` and contains
no application code: only Daily Brief packages, the workflow that publishes
them, and a `vercel.json`.

**Do not merge this branch into `main`, and do not merge `main` into it.**

## Why it exists

`main` is connected to Vercel's Git integration, so a push there builds and
deploys the site. If a daily package were committed to `main`, publishing a
news edition would redeploy the whole application — minutes of build time
and a new production deployment, to write a row that the already-running
deployment reads anyway.

So packages land here instead, and `vercel.json` on this branch sets:

```json
"git": { "deploymentEnabled": { "briefing-packages": false } }
```

Vercel reads that from the commit being pushed, so a push to this branch
creates no deployment at all.

## How to publish an edition

Commit the JSON as `briefing-packages/<name>.json` and push to this branch.
That triggers `.github/workflows/publish-briefing-package.yml`, which:

1. checks out `main` for the validation code and this commit for the package,
2. validates the package against `server/contracts/external-briefing.ts`,
3. POSTs it to `/api/internal/briefing/external-publish`,
4. verifies the edition is publicly visible.

The workflow does no editorial work and needs no AI credential. Collecting
sources, analysing claims and composing the edition all happen outside this
repository (ChatGPT); this branch only receives the finished result.

To re-run one file, or to validate a committed file without publishing it,
use the Actions tab: **Run workflow** → set `package_path`, optionally check
`dry_run`.

## The contract

`server/contracts/external-briefing.ts` **on `main`** is the authority, and
`docs/briefing-packages.md` there explains the rules that most often reject
a generated package. A worked example lives at
`examples/external-briefing-package.json` on `main`.

To check a package before committing it, from a `main` checkout — no secret
needed:

```bash
npm run briefing:publish -- path/to/package.json --dry-run
```

## Republishing

Resubmitting a package that already published is safe: the ingest API is
idempotent on `runId` and returns the original publication ids rather than
creating a second edition. A *different* `runId` for a date that already has
an edition is refused — same-day editions do not silently supersede one
another.
