# Daily Brief packages

Finished Daily Brief editions, authored **outside this repository** and
committed here to be published.

## What publishes, and when

Committing a `.json` file to this directory on `main` triggers
`.github/workflows/geopolitical-brief.yml`, which validates the file,
POSTs it to `/api/internal/briefing/external-publish`, and then verifies
the edition is visible on the public site.

> **Any `.json` file added here is published.** Do not put drafts,
> examples, or scratch files in this directory. The worked example lives at
> [`examples/external-briefing-package.json`](../examples/external-briefing-package.json),
> deliberately outside this directory so it cannot trigger a publish.

Markdown files (like this one) are ignored by the trigger.

## The division of labour

Everything editorial happens before the file lands here:

| Step | Who |
| --- | --- |
| Collect sources, analyse claims, compose the edition | ChatGPT, outside this repo |
| Validate the JSON against the contract | this repo's workflow |
| Publish it | this repo's workflow |
| Confirm it is publicly visible | this repo's workflow |

The workflow needs no AI credential. If it ever starts deciding what an
edition *says*, that split has been broken.

## The contract

[`server/contracts/external-briefing.ts`](../server/contracts/external-briefing.ts)
is the authority — read its header comment before writing a prompt that
produces these packages. The rules that most often trip up a generated
package:

- **Citation keys are package-local.** Everything in the edition refers to
  sources by the `key` you assign in `citations[]`; never a database id.
  Every key referenced anywhere must exist in `citations[]`, and every
  citation must be referenced by something.
- **The Daily Brief must cite at least one official Israeli source** (a
  publisher on a `gov.il` / `idf.il` / `mfa.gov.il`-style domain, or one
  flagged `official: true` with `country: "IL"`). An edition that cites none
  is rejected outright.
- **A `narrative_watch` article is all-or-nothing on sourcing.** It either
  cites nothing *anywhere* — top-level, every claim, every passage, and both
  monitoring key lists — and publishes as this organisation's own analysis,
  or it is fully sourced like any other article. Half-sourced is rejected.
  It is the only section allowed to cite nothing; the Daily Brief and
  `israel_update` must always be sourced.
- **Titles must be anchored in their own cited sources.** Word overlap
  against the cited titles and excerpts is checked mechanically, so an
  abstract or purely editorial headline fails even when the story is sound.
- **Excerpts need at least 200 characters** of real source text — enough for
  the fact-fidelity checks to verify the edition against them.

Beyond the contract, the server runs the full quality gate before anything
publishes. A rejection comes back as a `422` naming each failed check, and
nothing partial is ever written.

## Checking a package before you commit it

```bash
npm run briefing:publish -- path/to/package.json --dry-run
```

Validates and summarises without publishing. No secret needed.

You can also validate a candidate file by running the workflow manually from
the Actions tab with `dry_run` checked.

## Republishing

Resubmitting a package that already published is safe: the ingest API is
idempotent on `runId` and returns the original publication ids rather than
creating a second edition. Note that a *different* `runId` for a date that
already has an edition is refused — same-day editions do not silently
supersede each other.
