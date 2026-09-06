# Legacy `external-briefing-v1` package delivery

This is the existing compatibility path for historical Daily Brief packages.
The package is authored **outside this repository** (ChatGPT) and published by
a GitHub Action that does no editorial work of its own. It is not the contract
for the future whole-site editorial model: that work will move to an
`editorial-packages` branch and a dedicated package schema in a later phase.

## Why the packages live on their own branch

Packages are committed to the dedicated **`briefing-packages`** branch and
are **never merged into `main`**.

That is not organisational tidiness — it is the whole point. This project is
connected to Vercel's Git integration, so a push to `main` builds and
deploys the site. If a daily package landed on `main`, publishing a news
edition would redeploy the entire application: minutes of build time, a new
production deployment in the history, and a rollback surface, all for a row
in the database that the running deployment reads anyway.

The branch is excluded from Vercel by
[`git.deploymentEnabled`](https://vercel.com/docs/project-configuration/git-configuration)
in `vercel.json`:

```json
"git": { "deploymentEnabled": { "briefing-packages": false, "editorial-packages": false } }
```

That key is declared both here on `main` and in the small `vercel.json`
carried by the `briefing-packages` branch itself, because Vercel reads the
config from the commit being pushed — the copy on the branch is the one that
actually suppresses the deployment, and the copy here documents the rule
where anyone configuring the project will look for it.

## The flow

1. ChatGPT collects sources, analyses claims, and produces the package JSON.
2. The file is committed to `briefing-packages/` **on the `briefing-packages`
   branch**.
3. That push triggers `.github/workflows/publish-briefing-package.yml`,
   which lives on that branch. It checks out `main` for the validation code
   and the pushed commit for the package, then:
   - validates the package against `server/contracts/external-briefing.ts`,
   - POSTs it to `/api/internal/briefing/external-publish`,
   - verifies the edition is publicly visible.
4. No Vercel deployment happens at any point.

The branch is an orphan — it shares no history with `main` and carries only
packages, the workflow, and its `vercel.json`. That keeps it small and means
the validation code can never drift from `main`, because the workflow always
checks `main` out to get it.

## What lives where

| | `main` | `briefing-packages` branch |
| --- | --- | --- |
| Contract (`server/contracts/external-briefing.ts`) | ✅ | — |
| Publish/verify scripts, `npm run briefing:publish` | ✅ | — |
| Worked example (`examples/external-briefing-package.json`) | ✅ | — |
| The publishing workflow | — | ✅ |
| The package `.json` files | — | ✅ |

## Checking a package before committing it

From a `main` checkout, with no secret required:

```bash
npm run briefing:publish -- path/to/package.json --dry-run
```

You can also run the branch's workflow manually from the Actions tab with
`dry_run` checked to validate a file already committed there.

## The picture each record publishes with

Every record — the Daily Brief and each article — may carry a `media` object,
and **none of the packages submitted so far has carried one**. The field is
optional, so a package without it validates cleanly, publishes, and renders
with an empty frame. Nothing failed; the picture was simply never sent.

That is a composer-side gap, not a pipeline one: the ingest fetches, validates,
stores and renders images already. What it cannot do is invent one.

```json
"media": {
  "inputUrl": "https://www.example.com/media/photo.jpg",
  "sourceUrl": "https://www.example.com/the-article-it-appeared-on",
  "alt": "What a reader who cannot see it needs to know.",
  "caption": "What the picture shows.",
  "credit": "Photo: The Example Post",
  "disclosure": null,
  "role": "documentation",
  "focalPoint": { "x": 50, "y": 40 },
  "sensitivity": "safe",
  "rights": {
    "status": "cleared",
    "basis": "Publisher permission for editorial reuse with credit",
    "reference": "https://www.example.com/terms",
    "clearedAt": "2026-01-01",
    "surfaces": ["article"]
  },
  "generated": false
}
```

`inputUrl` is fetched **once**, validated, and stored in this project's own
public Blob store; the site then serves that copy. It never becomes a permanent
hotlink, and it is the only field that reaches the network.

**Rights are never invented on this side.** A composer that cannot establish a
basis leaves `"status": "unknown"` — that stores the asset with its provenance
while keeping it off every public surface. That is the honest outcome, not a
failure. `"cleared"` additionally requires `clearedAt` and a non-empty
`surfaces`.

### A generated image says so

For a picture made for the article rather than found, set `"generated": true`.
The contract then requires `"role": "editorial-illustration"` and a
`disclosure` line, and rejects the package without them:

```json
"disclosure": "Editorial illustration — not incident documentation",
"role": "editorial-illustration",
"generated": true
```

A generated image may never claim a documentary role, and the caption should
describe a **drawing**, not an event.

### Seeing what a package will publish with

`npm run briefing:publish -- <file> --dry-run` prints one line per record with
its image and credit, or `[no image]`:

```
Daily Brief: Israel and the region … [no image]
[israel_update] Israel says Hezbollah tunnel complex … [no image]
```

That is the fastest way to check whether a composer has started sending
pictures. The publish run also logs a warning naming every record that
declared none.

`examples/external-briefing-package.json` is a worked package carrying all
three cases: a sourced photograph on the Daily Brief, one on an article, and a
generated illustration on a Narrative Watch analysis.

## Contract rules that most often reject a generated package

`server/contracts/external-briefing.ts` is the authority; these are the ones
that trip up a generated package in practice:

- **Citation keys are package-local.** Everything refers to sources by the
  `key` assigned in `citations[]`, never a database id. Every referenced key
  must exist, and every citation must be referenced by something.
- **The Daily Brief must cite at least one official Israeli source.**
- **`narrative_watch` is all-or-nothing on sourcing** — it cites nothing
  anywhere and publishes as this organisation's own analysis, or it is fully
  sourced. Half-sourced is rejected. It is the only section allowed to cite
  nothing.
- **Titles must be anchored in their own cited sources** — word overlap
  against cited titles and excerpts is checked mechanically.
- **Excerpts need at least 200 characters** of real source text.

The server then runs the full quality gate. A rejection is a `422` naming
each failed check, and nothing partial is ever written.

## Republishing

Resubmitting a package that already published is safe: the ingest API is
idempotent on `runId` and returns the original publication ids. A *different*
`runId` for a date that already has an edition is refused — same-day editions
do not silently supersede each other.
