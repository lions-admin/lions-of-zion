# State

What is true right now. Rewritten in place — this file is never a history, it
is a snapshot. History lives in `DECISIONS.md` and in `git log`.

Anything derivable from git (what changed, who changed it, when) does not
belong here. Only what git cannot tell you: intent, position, and what is
half-finished.

_Last updated: 2026-08-23_

## Where the work is

The repo now holds two unrelated things, deliberately kept apart:

1. **The WebGL experience** — merged, deployed, live at
   <https://lions-of-zion.vercel.app>. Untouched since.
2. **The backend** — Phase 1 of 8 complete. Foundation only: no domain
   entities yet.

The full eight-phase plan is at `~/.claude/plans/splendid-discovering-dawn.md`.
Read it before starting Phase 2; the sequencing has reasons.

## Backend — Phase 1 complete and green

`npm test` 13/13, `tsc --noEmit` clean, `npm run lint` clean (3 pre-existing
warnings in `LionExperience.tsx`), `npm run build` succeeds with
`ƒ /api/internal/health` rendering on demand.

Shipped: dual database client (WebSocket Neon for production, PGlite for tests),
16 enum types generated from the contract arrays, six infrastructure tables
(`app_user`, `capability_grant`, `audit_log`, `entity_version`, `outbox`,
`idempotency_key`), append-only and anti-automation triggers, the RFC 9457 HTTP
layer, and ESLint boundary rules that make the architecture mechanical.

**The suite has been mutation-tested.** Removing the `audit_log` append-only
trigger turns exactly two tests red. A constraint suite that has never been
seen to fail is not evidence of anything.

## Next — Phase 2, the information model

`information_item`, `topic`, `event`, the join tables, table-driven status
transitions with a legality trigger, `withVersion()` as the single versioned
write path, and items CRUD.

Two things to settle **during** Phase 2, not after:

- **The four derived columns** (`assessment`, `confidence_summary`,
  `current_assessment_id`, `current_version_id`). Trigger-maintained, app-writes
  blocked, plus a drift query in CI. An item reading `verified` while its live
  assessment says `contested` is not a stale cache, it is a false publication.
  Decide before Phase 4 builds the publish gate on top of it.
- **Whether `edited` and `updated` are really statuses.** Populate the
  `status_transition` table and look at whether they have outgoing edges that
  differ from `reviewed`/`published`. If they do not, delete them before seven
  phases of code branch on them.

## In flight (uncommitted)

Everything below is uncommitted. Nothing has been committed since `43c4e61`.

- `server/`, `app/api/`, `tests/`, `drizzle.config.ts`, `vitest.config.ts` —
  the Phase 1 backend.
- `eslint.config.mjs` — boundary rules, verified to block in both directions.
- `.claude/`, `.mcp.json`, `.ai/` — automation and this journal.
- `CLAUDE.md` — architecture notes.
- `components/intro/story-timeline.ts` — intro copy condensed 24 → 14 desktop
  lines (~44.5s → ~39s), verified in Chrome. Predates the backend work.

## Blocked

**Nothing is provisioned, by choice.** Neon, Blob and AI Gateway are all
unconfigured; `/api/internal/health` reports every integration as `false`. The
code runs and the whole suite passes without them. Provision when ready and the
same code connects — `DATABASE_URL` must be the **pooled** (`-pooler`) string,
because the WebSocket driver needs interactive transactions and the HTTP driver
silently voids row-level security.

**Vercel git auto-deploy** is still disconnected: the Vercel account cannot see
private repos under `lions-admin`. Deploys are manual `vercel --prod`. Pushing
to GitHub deploys nothing.
