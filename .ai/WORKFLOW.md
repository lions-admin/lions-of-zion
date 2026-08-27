# Agent workflow

The shared, tool-agnostic development loop for Lions of Zion. `AGENTS.md`
routes every agent here; tool-specific hooks and skills may accelerate this
loop but never replace or weaken it.

The agent receiving the user's request is always the manager. Every task must
include at least one delegated, bounded worker assignment. The manager keeps
ownership of scope, integration, verification, approvals, and the final answer.

## 1. Orient

- As manager, run `npm run sync:start` before delegation. It always fetches
  the configured upstream, updates only a clean behind-only branch by
  fast-forward, and fails closed on dirty-behind, divergence, no upstream,
  detached `HEAD`, or an unavailable remote. It reports `origin/main` only;
  it never merges it into a feature branch. Never use an unconditional
  `git pull`; workers do not sync.
- Read `AGENTS.md`, inspect the branch and dirty working tree, and read
  `.ai/STATE.md` plus the newest relevant entries in `.ai/DECISIONS.md`.
- Read only the references the task needs:
  - application or architecture: `CLAUDE.md` and `docs/architecture.md`;
  - file placement or a new area: `docs/PROJECT_MAP.md`;
  - API, data, environment, operations, or design: the matching document
    linked from `docs/README.md`;
  - Next.js code: the relevant version-matched guide under
    `node_modules/next/dist/docs/` before writing code.
- Treat existing edits as user-owned. Do not overwrite or clean them up unless
  they are in scope.

## 2. Frame

Before editing, state a compact contract: goal, expected files, acceptance
checks, risks, approvals, and a delegation map. Split the task into
non-overlapping workstreams and assign at least one concrete subtask to a
worker. Give each worker the necessary context, boundaries, expected output,
and acceptance criteria. For a tiny task, delegate a read-only review or an
independent verification pass rather than manufacturing overlapping edits.

Only the manager coordinates workers. Workers may not create more agents unless
the manager explicitly grants that authority. If subagents are unavailable,
stop before implementation, disclose the limitation, and continue only if the
user explicitly waives the requirement for that task.

Ask only when a missing decision would materially change the result. Never
infer permission to commit, push, deploy, publish, apply a live migration, or
mutate an external service.

## 3. Change a small slice

- Make the smallest coherent change that can be verified.
- Give each implementation worker exclusive ownership of its assigned files or
  keep its assignment read-only. Avoid concurrent edits to the same path.
- Treat worker summaries as leads, not proof. The manager must inspect the
  actual diff, rerun relevant checks, and resolve conflicts before integration.
- Preserve the architecture boundaries enforced by `eslint.config.mjs` and the
  invariants in `CLAUDE.md`.
- Do not mix unrelated cleanup into the task.
- After each meaningful slice, run the cheapest relevant focused test. Do not
  run a production build after every edit.

## 4. Verify by risk

Run `npm run verify:changed` before handoff. It selects automated checks from
the working-tree diff and reports any required manual browser evidence.

- Application code: typecheck, lint, and tests.
- Tests or content packages: tests.
- New, deleted, or moved paths and architecture-sensitive files: project-map
  drift check.
- Database migrations: migration-aware tests through the test suite; never
  apply a live migration as verification.
- Visual files: inspect the affected route in real Chrome, then rerun with
  `--visual-verified`.
- Intro files: capture both desktop and mobile, inspect every frame, then rerun
  with both `--visual-verified` and `--intro-verified`.

Use `npm run verify:full` before handing off a finished implementation. It is
the same repository gate used by CI: typecheck, lint, tests, production build,
and project-map drift. Focused checks during implementation do not replace it.

The real-Chrome scripts, their platform limits, and their coverage are listed
in `docs/operations.md`. Never substitute a hidden preview or headless GPU for
a check that the project explicitly requires in real Chrome.

## 5. Close

- Review the final diff for accidental files, debug output, secrets, and scope
  creep.
- Update `.ai/STATE.md` only when the position of the work changed. Add a
  newest-first entry to append-only `.ai/DECISIONS.md` only for a durable choice
  a later agent might otherwise undo or re-litigate.
- Report: what changed, checks that passed, checks not run and why, and whether
  state or decisions moved. Include which workers were assigned, what each
  returned, and what the manager independently verified.
- Stop for approval before commit, push, deploy, publication, or any other
  external irreversible action.
