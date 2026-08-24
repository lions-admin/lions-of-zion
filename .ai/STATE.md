# State

What is true right now. Rewritten in place — this file is never a history, it
is a snapshot. History lives in `DECISIONS.md` and in `git log`.

Anything derivable from git (what changed, who changed it, when) does not
belong here. Only what git cannot tell you: intent, position, and what is
half-finished.

_Last updated: 2026-08-24_

## Where the work is

The repo holds two unrelated things, deliberately kept apart:

1. **The WebGL experience** — deployed at <https://lions-of-zion.vercel.app>,
   and now a layer deeper than what is live. Graphics Task 02 is complete: the
   background's dimensions are fixed and the navigation layer is built.
2. **The backend** — Phases 1 and 2 of 8 complete. The information model
   exists and is enforced; no sources, evidence or assessments yet.

**What is deployed is behind what is committed.** Vercel deploys are manual and
none has been run for this work.

The full eight-phase plan is at `~/.claude/plans/splendid-discovering-dawn.md`.
Read it before starting Phase 3; the sequencing has reasons.

## Graphics Task 02 — complete

The specification is `docs/graphics-task-02.md`; it is the contract, and where
the implementation deviates from it the reasoning is in `DECISIONS.md`.

**Stage 0, the dimensional correction.** `components/graphics/viewport.ts`
solves one continuous cover fit. The old two-branch heuristic covered neither a
wide desktop window nor a phone and jumped 44% in scale between them; it also
failed vertically at 16:9, which the task document said it did not.

**Stage 1, the coordinate contract.** One `Viewport` owns element size, aspect,
one DPR policy, the world half-extents, the cover fit and the focal point. Both
existing scenes read it — no scene code measures the window any more.
`LionExperience` gained `setRecession(t)`, the only thing the layer above may
ask of it.

**The navigation layer**, `components/nav/`: the radial core, eight nodes, the
hover attraction field, the connection curves, the central mark, an eleven-icon
family, the section transfer, the reveal sweep and the convergence burst.
GRAPHIC 07, the verification shield, is deliberately out of scope — it is
Task 03. Six draw calls: one `LineSegments` for every line in the system, one
`Points` for every particle.

The eight sections have no destinations. `activeSection` is set locally and no
graphic reads a URL; attaching routes later replaces one adapter.

### How it is verified

- `tests/composition-fit.test.ts` and `tests/nav-layout.test.ts` — 26
  invariants covering cover at every aspect, continuity, the single shared
  breakpoint, and the gold budget as an area bound.
- `scripts/verify-composition.mjs` — a real browser at the six aspects in the
  document's matrix, driving the nav through rest, hover, active and transfer,
  plus the intro handoff and a run with WebGL disabled.

**The container runs SwiftShader, so frame rate is not verified here.** Geometry,
framing, layout, interaction and accessibility are. The performance budget in
the document still needs a pass on real hardware, per `CLAUDE.md`.

## Backend — Phases 1 and 2 complete and green

`npm test` 74/74, `tsc --noEmit` clean, `npm run lint` clean (3 pre-existing
warnings in `LionExperience.tsx`, 1 elsewhere), `npm run build` succeeds with
four dynamic routes. There is a `npm run typecheck` script, despite what
`CLAUDE.md` says.

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

## Next, if the graphics thread continues

Task 03 is the verification shield (GRAPHIC 07) — the only section with a data
model behind it, and the one that would prove the target-morphing model end to
end. Before that, the performance pass on real hardware.

## In flight (uncommitted)

Nothing.

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
