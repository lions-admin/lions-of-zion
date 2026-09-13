#!/usr/bin/env node
/**
 * Git post-commit reporter — the one signal every agent and every human emits.
 *
 * Installed through `~/.config/ai-dev/git-hooks/post-commit` (core.hooksPath),
 * which runs it only when this file exists in the committed repository and
 * swallows every failure, so a commit can never be blocked by reporting.
 * OpenCode and Gemini AGY have no hook surface of their own; this is how
 * their work reaches the board at all.
 *
 * The commit lands on the task `OPS_TASK_KEY` names, or else on `git:<sha>` —
 * the same key the CI job reports on, so a commit and its pipeline result
 * share one record. When a hook-recorded session is known for this
 * directory, that session becomes the parent, which links the commit to the
 * conversation that produced it.
 */
import { currentSession, git, reportEvent, resolveIdentity } from "./report.mjs";

const cwd = process.cwd();
const remote = git(["remote", "get-url", "origin"], cwd) ?? "";
if (!remote.includes("lions-of-zion")) process.exit(0);

const sha = git(["rev-parse", "HEAD"], cwd);
if (!sha) process.exit(0);

const identity = resolveIdentity({ cwd });
const subject = git(["log", "-1", "--format=%s"], cwd) ?? "";
const stat = (git(["show", "--stat", "--format=", "HEAD"], cwd) ?? "").split("\n").filter(Boolean).at(-1)?.trim() ?? "";
const session = currentSession(cwd);
const explicit = process.env.OPS_TASK_KEY?.trim();
const taskKey = explicit || `git:${sha}`;

const fields = {
  message: subject,
  meta: { sha, branch: identity.branch, files: stat, remote },
};
if (!explicit) {
  fields.title = `commit ${sha.slice(0, 7)}: ${subject}`.slice(0, 120);
  fields.kind = "code";
  if (session?.taskKey) fields.parentKey = session.taskKey;
}

reportEvent("commit", fields, { identity, taskKey, timeoutMs: 5000 })
  .catch((error) => process.stderr.write(`[ops-post-commit] ${error?.message ?? error}\n`))
  .finally(() => process.exit(0));
