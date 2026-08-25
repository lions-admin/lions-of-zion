# State

Snapshot of intent and current position. Git is the history; durable reasoning
lives in `DECISIONS.md`. The long backend phase narrative that used to live
here is in this file's git history and in
`~/.claude/plans/splendid-discovering-dawn.md`.

_Last updated: 2026-08-25 (development marathon in progress)_

## Where the work is

A full-project review (four parallel agents: visual screenshots, content
depth, frontend shell, data layer) produced the W1–W6 continuation plan in
`TODOS.md` (commit `8204fc2`). A development-only marathon is executing it.
Wave-1 checkpoint `ca86df5` landed: `not-found`/`error`/`loading` screens in
the site language, intro session memory (`loz-intro-seen`, reusing the skip
path), the brief's closing band + corrections fixes, and partial work on the
section shell, `components/content/` library, chat UX and metadata pass.

## In flight (uncommitted / running)

- Four wave-1 agents finishing: SectionPage shell (prev/next footer, SVG
  emblems, rail scrim, quiet register), content component library + README,
  chat UX rewrite (degraded mode, citations, suggested questions),
  metadata/identity (OG image, sitemap, robots, icons).
- Wave 2 next: authored, sourced content per page (timelines, case files,
  profiles, chapters) + `/methodology` and `/corrections` destination pages.
  Editorial rule for all of it is recorded in `DECISIONS.md` (2026-08-25).
- Gate before final push: typecheck, lint, `npm test`, build. tsc was clean at
  the checkpoint; the rest not yet run over the marathon diff.

## Verification

- **The real-Chrome matrix has not been recaptured** since the P0 composition
  changes, and now also predates the marathon's visual work (scrims, footer,
  emblems, intro session memory). Capture scripts hardcode macOS Chrome — the
  pass happens on the workstation, not in this container.
- Mac-gated tasks parked in TODOS W2: no-JS poster rebalance, intro line
  overlap tuning, SDF icon re-bake with alpha.
- Last full green (typecheck/lint/318 tests/build) was the 25 Aug P0 pass.

## Backend

Nine phases complete and mutation-tested; RLS live; chat citations are
retrieval-constrained at the database. Nothing is provisioned (Neon, Blob,
AI Gateway, Queues) — `/api/internal/health` reports all integrations false,
and the suite passes without them. `requireActor()` throws in production.
New this marathon: `publishedItemSchema`/`PublishedItemView` added to
`server/contracts/item.ts` so the frontend can finally name the public read
shape; `server/modules/items/repo.ts` now imports it.

## Next

1. Finish wave 1, launch wave-2 content agents, run the full gate, push.
2. Check off completed W1–W6 items in `TODOS.md`.
3. Workstation: real-Chrome matrix + the three Mac-gated visual tasks.
4. Unchanged backend picks: provisioning (pooled `-pooler` `DATABASE_URL`;
   Queues via OIDC), real authentication, brief-generation workflow.

## Blocked

Backend provisioning remains deferred by choice; the code needs no changes
when it happens. Nothing else blocked.
