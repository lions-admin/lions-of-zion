# State

## Latest — 2026-08-26, Vercel production stack and archive integration are live

The repository is being synchronized with `origin/main` on the
`docs/architecture-audit-and-design-sync` branch. The local Vercel/Auth/Neon
work has a checkpoint commit; the current merge keeps the latest October 7
archive implementation from `origin/main`.

**Read [`docs/vercel-infrastructure.md`](../docs/vercel-infrastructure.md)**
for the deployed topology, environment names, cost guardrails and runbook.
The canonical production site is `https://lionsofzion.io`; `www` redirects to
it. Git pushes do not deploy automatically, so production deploys remain a
deliberate Vercel CLI action.

Production is configured with Vercel Pro, Functions in `iad1`, Neon Launch
Postgres, Neon Auth, Vercel Blob, Queues, Cron and AI Gateway through Vercel
OIDC. The single admin is `admin@lionsofzion.io`; the production account and
five capability grants are present. Preview uses an isolated Neon branch and
separate Blob stores.

The archive Blob store `lions-of-zion-archive` (`store_M70Ph8nWOJVAnaRn`) is
separate from the RSS stores and contains the imported October 7 media —
1.94 GB across 2,018 objects. **Verified end to end on 2026-08-26**:
`verify-archive-assets.mjs --all` reports 2,018 checked and 0 unreachable
against the live bucket, and a live record page emits blob URLs with no
`/archive` fallback left in its HTML. Preview and Production point at the
**same** store, not at per-environment prefixes.

`NEXT_PUBLIC_ARCHIVE_CDN` is substituted at **build time**, so changing it
later takes a redeploy — an env edit alone leaves the old value baked into
the prerendered HTML. Locally the media resolves through gitignored symlinks
under `public/archive/`, which a fresh worktree does not have; the command
that creates them is in `docs/archive-integration.md`. No Google Cloud or Vertex service
is part of this architecture. AI is capped at $4.50 in the application and
$5 at the Gateway; Vercel Spend Management allows $10 of additional usage.

The production database contains the 21 applied migrations and the ten
idempotently imported public site pages. Public search returns only published
content; internal status requires the admin session.

## In flight

- Finish the merge reconciliation for `.ai/DECISIONS.md` and `.vercelignore`.
  `TODOS.md`, `docs/archive-integration.md`, `docs/environment.md`,
  `docs/operations.md` and this file were reconciled on 2026-08-26 — the four
  documents that still called the archive CDN unprovisioned now record it as
  live, and the R2/rclone upload path was replaced by the repository's own
  uploader, which is what actually ran.
- Update the tracked infrastructure documentation and append only durable
  Vercel decisions to the ADR log.
- Run the full local gate, read-only Neon checks and Vercel smoke checks, then
  push this branch to its matching `origin` branch.

## Deferred

The unapproved public X OAuth implementation is preserved outside the
repository in a recoverable local quarantine. Its credentials are untouched;
the feature is not part of this infrastructure checkpoint.

## Next

After the branch is pushed, monitor Neon CU-hours, AI spend, Function errors,
Queue age and Blob growth for seven days. Do not promote a new Production
deployment unless its Preview smoke test is green and the commit is known.
