# State

## Latest — 2026-08-27, structure audit; the design-audit wave is closed

`main` is at `f8f84ce` (merged PR #16). The branch
`docs/architecture-audit-and-design-sync` that the previous entry described as
in flight was pushed, merged and deleted; every item it listed is done.

Two waves landed since: the design audit closed **83 of 83** with zero open
items (`69fd027`), and the reading routes were converted to scroll the document
rather than themselves (`423b9f5`) — which is why a phone's URL bar now
collapses and back-navigation restores position without `sessionStorage`.

The work in progress is a full structure audit on
`codex/project-structure-audit`: every project-owned file classified with
evidence, the closed audit archived, the documentation reconciled against the
code, and an interactive project map. `PROJECT_STRUCTURE_AUDIT.md` carries the
per-path table; `docs/PROJECT_MAP.md` carries the shape.

**Read [`docs/vercel-infrastructure.md`](../docs/vercel-infrastructure.md)**
for the deployed topology, environment names, cost guardrails and runbook. The
canonical production site is `https://lionsofzion.io`. Git pushes do not deploy;
production remains a deliberate Vercel CLI action. **The repository is public,
so a push is itself an act of publication.**

## What the audit found that is not yet decided

These are real and deliberately untouched — each changes product or security
behaviour, which a structure audit does not get to do alone:

- **The Fake Resistance publication gate does not work the way both documents
  said.** `EDITORIAL_STAGE` is `'published'`; the committed JSON says
  `editorial_review`. `getCase()` honours the constant, `getCaseIndex()`
  honours the JSON — so the flag that looks like the publication switch does
  not withdraw a case. Documentation now describes this accurately; the
  behaviour is an owner decision.
- **`requireCapability()` is exported, granted against and never called.**
  Application-layer capability enforcement is inert; capabilities only feed the
  `evidence_staff_restricted` RLS policy.
- **`prune_rate_limits` and `prune_expired_idempotency` are `SECURITY DEFINER`
  with no `REVOKE … FROM PUBLIC`**, unlike the two functions directly above
  them in migration `0018`. Defence-in-depth, not a live hole — no route
  reaches arbitrary SQL — but an unexplained asymmetry inside one migration.
- **CI cannot see the no-JavaScript invariant.** `final-verify.mjs` is its only
  guard and needs real Chrome on macOS.
- **`/admin` and `/auth` are crawlable**, and the public X sign-in shipped with
  no `.ai/DECISIONS.md` entry.

## Next

Land the audit branch, then decide the five items above. Continue watching Neon
CU-hours, AI spend, Function errors, Queue age and Blob growth. Do not promote a
Production deployment unless its Preview smoke test is green.
