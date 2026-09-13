# Optional working notes

The project owner decides the task and the level of process. Use the smallest
useful loop: understand the request, change the relevant files, and report the
result. `npm run sync:start`, `npm run verify:changed`, and
`npm run verify:full` are available as tools, not prerequisites or gates.

Development happens on one permanent branch per AI identity — `ai/claude`,
`ai/grok`, `ai/codex`, `ai/opencode`, `ai/gemini-agy` — each in its own git
worktree. The AI you are determines the branch; the task, the session and the
prompt do not, and a new branch requires an explicit owner request.
`sync:start` keeps you on yours; `main:update` publishes to `main` and brings
you back. The policy is in `AGENTS.md` under **Branches** and is not restated
here.

Project documents, tests, and historical decisions provide context. They do not
override a direct owner instruction. Use another agent when it adds value; do
not manufacture delegation or approvals.

One report is not optional: by owner ruling (2026-09-12) every task ends with
`npm run ops:report -- finish …` to the operations board, and that finish is
the only thing that marks a task completed. `docs/ops/task-reporting.md` is
the contract.
