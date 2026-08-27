<!-- BEGIN:nextjs-agent-rules -->

# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` (resolved from this file's directory; in monorepos the `next` package may not be visible from the repo root) before writing any code. Heed deprecation notices.

This block is written and re-added by `next dev` — verify at `node_modules/next/dist/server/lib/generate-agent-files.js`. Removing it from a diff only re-creates the uncommitted change; committing it with your work keeps the tree clean.

<!-- END:nextjs-agent-rules -->

# Lions of Zion agent contract

This file is the mandatory entry point for every coding agent working in this
repository. The managed Next.js block above must remain byte-for-byte intact.

## Mandatory manager-worker model

Every task, including a small one, must be split across agents. The agent that
receives the user's request is the manager and remains accountable for the task
from discovery through handoff. Before implementation, the manager must assign
at least one concrete, bounded subtask to another agent. For a tiny change, that
subtask may be read-only review or independent verification rather than a
second implementation stream.

The manager owns decomposition, context, acceptance criteria, non-overlapping
file ownership, coordination, review of actual diffs and evidence, integration,
and final verification. Workers report to the manager and must not commit,
push, deploy, publish, or expand scope. A worker must not create further agents
unless the manager explicitly delegates that authority.

If the current environment cannot create subagents, stop before implementation
and tell the user. Continue only after the user explicitly waives this rule for
that task; never claim multi-agent execution when none occurred.

Before changing anything:

1. As the manager, run `npm run sync:start` before delegating work. It fetches
   the current branch's upstream and fast-forwards only a clean branch. A
   blocked result stops implementation until the user reconciles the tree or
   explicitly waives the check. Workers never run this command independently.
2. Read [`.ai/WORKFLOW.md`](.ai/WORKFLOW.md) in full and follow its five-stage
   loop.
3. Inspect the current branch and working tree. Existing changes belong to the
   user unless the task explicitly says otherwise.
4. Read [`.ai/STATE.md`](.ai/STATE.md), then the newest relevant entries in
   [`.ai/DECISIONS.md`](.ai/DECISIONS.md).
5. Read only the project references routed by the workflow. For application
   code, `CLAUDE.md` is the product and architecture brief despite its
   tool-specific filename.
6. State the goal, expected files, acceptance checks, risks, delegation map,
   and any required approval before implementation.

Before handing work back, run `npm run verify:changed`. Run
`npm run verify:full` for a finished implementation or whenever the workflow
requires the full gate. A visual change is incomplete until it has been checked
in real Chrome; intro changes require desktop and mobile captures.

Never commit, push, deploy, publish, migrate a live database, or perform another
irreversible external action without explicit user approval. Do not weaken a
check to make it pass, and do not claim a check ran when it did not.
