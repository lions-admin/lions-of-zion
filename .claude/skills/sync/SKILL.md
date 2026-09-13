---
name: sync
description: Update the project journal (.ai/STATE.md and .ai/DECISIONS.md) so the next session starts where this one left off. Use before finishing a session that moved the work, or when the Stop hook says the journal is behind.
disable-model-invocation: true
---

# Sync the journal

The journal is what a new session reads to find where the work stands. No
hook injects it any more — the machine `SessionStart` hook reports git state
only — so it is read by choice, and that only helps if it is true. This is
the other half.

Budget a minute. A journal that costs ten minutes to update gets skipped, and a
skipped journal is worse than none because it still gets read.

## 1. Look at what actually happened

```bash
git status --short && git log --oneline -5 && git diff --stat
```

## 2. Rewrite `.ai/STATE.md` in place

It is a **snapshot, not a log** — rewrite the sections that moved rather than
appending. Keep it under roughly 60 lines; the session hook truncates past
~6000 characters, and a file long enough to be truncated is long enough to be
ignored.

Check each section against reality:

- **Where the work is** — one honest paragraph. If nothing shipped, say so.
- **In flight** — every uncommitted change and whether it is verified. Delete
  entries that got committed; git covers those now.
- **Next** — concrete enough to start from cold. "Cool the intro palette,
  currently gold-dominant" beats "continue the design work".
- **Blocked** — what is stuck, and precisely what would unstick it.

Never write what git already knows. No changelogs, no lists of files touched,
no "renamed X to Y". The hook injects `git log` and `git status` alongside this
file, so duplicating them wastes the budget that real context needs.

## 3. Append to `.ai/DECISIONS.md` only when a decision was made

Not every session produces one. Add an entry when a later reader could
**undo the thing by accident** or would otherwise **re-argue it**:

- a path chosen over a reasonable alternative, with the reason
- something tried and reverted — record it, or it gets tried again
- a constraint discovered the hard way
- a deliberate deferral, and what triggers revisiting it

Newest first, under a `## YYYY-MM-DD — short title` heading. Write the **why**;
the what is in the diff. Entries are never edited away — a reversed decision
keeps its entry with the reversal appended.

If nothing qualifies, add nothing. Padding this file is how it stops being read.

## 4. Consider whether CLAUDE.md should change instead

The split matters:

| | |
|---|---|
| `CLAUDE.md` | stable — architecture, invariants, silent couplings, gotchas |
| `.ai/STATE.md` | volatile — position, in-flight work, blockers |
| `.ai/DECISIONS.md` | append-only — why things are as they are |

A newly discovered trap that will still be true in six months belongs in
`CLAUDE.md`, not in the journal. If you found one, move it there.

## 5. Report the round to the operations board

The journal is for the next session; the board is for the owner, now. If the
round moved the work, close it there too (`docs/ops/task-reporting.md`):

```bash
npm run ops:report -- finish --summary "…" --changes "…" --remaining "…"
```

There is no journal-nudge script any more — `.claude/hooks/journal-nudge.mjs`
was removed with the machine-level hooks, and nothing checks the journal's
freshness automatically. Reading `git diff --stat` against `.ai/STATE.md` by
hand is the check.
