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
2. **The backend** — Phases 1 and 2 of 8 complete. The information model
   exists and is enforced; no sources, evidence or assessments yet.

The full eight-phase plan is at `~/.claude/plans/splendid-discovering-dawn.md`.
Read it before starting Phase 3; the sequencing has reasons.

## Backend — Phases 1 and 2 complete and green

`npm test` 48/48, `tsc --noEmit` clean, `npm run lint` clean (3 pre-existing
warnings in `LionExperience.tsx`, 1 elsewhere), `npm run build` succeeds with
four dynamic routes.

Phase 1 shipped the foundation: dual database client (WebSocket Neon for
production, PGlite for tests), 16 enum types generated from the contract arrays,
the infrastructure tables, append-only and anti-automation triggers, the RFC 9457
HTTP layer, and ESLint boundary rules.

Phase 2 shipped the information model: `information_item` with its two axes kept
apart, `topic`, `event`, table-driven status transitions enforced by a trigger
that also writes the trail, the derived-column guard, `recordVersion()` as the
single versioned write path, and items CRUD at `/api/v1/items`.

**Both suites have been mutation-tested.** Removing the `audit_log` append-only
trigger turns exactly two tests red.

Both Phase 2 questions from the plan are settled — see `DECISIONS.md`. `edited`
was unreachable and was given inbound edges rather than deleted; the derived
columns are guarded now, and the trigger that *maintains* them arrives in Phase 4
with `item_assessment`, which is the table they derive from.

## Next — Phase 3, sources and ingestion

`source_family`, `source`, `source_fetch`, `evidence`, `evidence_provenance`, the
`SourceConnector` interface with a static registry and an RSS connector, raw
bytes to Blob, the outbox drain, and the first Cron and Queue.

`source_family` is the addition to the brief that matters most: without it, five
outlets republishing one wire report count as five independent corroborations.

## In flight (uncommitted)

Nothing. Phases 1 and 2 are committed and pushed.

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
