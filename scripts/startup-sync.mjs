#!/usr/bin/env node
/**
 * Verify and safely refresh the repository before a manager starts a task.
 *
 * This intentionally is not `git pull`: only a clean branch that is behind
 * its configured upstream may be fast-forwarded. Local work is never stashed,
 * reset, merged, rebased, or discarded automatically.
 *
 *   node scripts/startup-sync.mjs       # strict manager gate
 *   node scripts/startup-sync.mjs --hook # SessionStart adapter
 */
import { execFileSync } from "node:child_process";
import { resolve } from "node:path";

const ROOT = process.env.CLAUDE_PROJECT_DIR ?? resolve(new URL("..", import.meta.url).pathname);
const DEFAULT_REMOTE = "origin";

export function parseAheadBehind(value) {
  const [ahead, behind] = String(value).trim().split(/\s+/).map(Number);
  if (!Number.isInteger(ahead) || !Number.isInteger(behind)) {
    throw new Error(`Could not parse ahead/behind counts: ${value}`);
  }
  return { ahead, behind };
}

/**
 * Decide from facts already read from git. Kept pure so the safety matrix is
 * testable without a network or a real repository.
 */
export function decideSync({ fetchOk = true, detached = false, upstream = true, dirty, ahead, behind }) {
  if (!fetchOk) return { status: "blocked", reason: "remote freshness could not be verified" };
  if (detached) return { status: "blocked", reason: "HEAD is detached; choose a branch before editing" };
  if (!upstream) return { status: "blocked", reason: "the current branch has no upstream" };
  if (behind > 0 && ahead === 0) {
    if (dirty) return { status: "blocked", reason: "local changes exist while the upstream is ahead" };
    return { status: "update", reason: "clean branch is behind upstream and can fast-forward" };
  }
  if (ahead > 0 && behind > 0) {
    return { status: "blocked", reason: "local and upstream branches have diverged" };
  }
  return {
    status: "ready",
    reason: dirty ? "upstream is not behind; preserve local changes" : "branch is current or ahead",
  };
}

function git(args, { allowFailure = false } = {}) {
  try {
    return execFileSync("git", args, { cwd: ROOT, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
  } catch (error) {
    if (allowFailure) return null;
    const detail = error?.stderr?.toString().trim() || error?.message || "git command failed";
    throw new Error(detail);
  }
}

function snapshot() {
  const branch = git(["symbolic-ref", "--quiet", "--short", "HEAD"], { allowFailure: true });
  const upstream = branch
    ? git(["rev-parse", "--abbrev-ref", "--symbolic-full-name", "@{upstream}"], { allowFailure: true })
    : null;
  const dirty = Boolean(git(["status", "--porcelain", "--untracked-files=all"]));
  const counts = upstream ? parseAheadBehind(git(["rev-list", "--left-right", "--count", "HEAD...@{upstream}"])) : { ahead: 0, behind: 0 };
  const remote = branch
    ? git(["config", "--get", `branch.${branch}.remote`], { allowFailure: true })
    : null;
  const base = git(["rev-parse", "--verify", `${DEFAULT_REMOTE}/main`], { allowFailure: true });
  const baseCounts = base
    ? parseAheadBehind(git(["rev-list", "--left-right", "--count", `HEAD...${DEFAULT_REMOTE}/main`]))
    : null;
  return { branch, upstream, remote, dirty, baseCounts, ...counts };
}

function describe(snapshotValue, decision) {
  const lines = [
    `Branch: ${snapshotValue.branch ?? "detached"}`,
    `Upstream: ${snapshotValue.upstream ?? "none"}`,
    `Remote: ${snapshotValue.remote ?? "none"}`,
    `Working tree: ${snapshotValue.dirty ? "dirty (preserved)" : "clean"}`,
    `Relation: ${snapshotValue.ahead} ahead, ${snapshotValue.behind} behind`,
    `Decision: ${decision.status} — ${decision.reason}`,
  ];
  if (snapshotValue.baseCounts) {
    lines.push(`Against ${DEFAULT_REMOTE}/main: ${snapshotValue.baseCounts.ahead} ahead, ${snapshotValue.baseCounts.behind} behind (reported only; never merged automatically)`);
  }
  return lines;
}

export function runSync({ hook = false } = {}) {
  let fetchError = null;
  try {
    const branch = git(["symbolic-ref", "--quiet", "--short", "HEAD"], { allowFailure: true });
    const remote = branch
      ? git(["config", "--get", `branch.${branch}.remote`], { allowFailure: true }) || DEFAULT_REMOTE
      : DEFAULT_REMOTE;
    git(["fetch", "--prune", remote]);
  } catch (error) {
    fetchError = error;
  }

  let current;
  try {
    current = snapshot();
  } catch (error) {
    fetchError ??= error;
  }

  const decision = decideSync({
    fetchOk: !fetchError,
    detached: !current?.branch,
    upstream: Boolean(current?.upstream),
    dirty: current?.dirty ?? true,
    ahead: current?.ahead ?? 0,
    behind: current?.behind ?? 0,
  });

  if (decision.status === "update" && !fetchError) {
    if (git(["status", "--porcelain", "--untracked-files=all"])) {
      decision.status = "blocked";
      decision.reason = "local changes appeared while checking freshness";
    } else {
      git(["merge", "--ff-only", "@{upstream}"]);
      current = snapshot();
      decision.status = "updated";
    }
  }

  const lines = describe(current ?? { branch: null, upstream: null, dirty: true, ahead: 0, behind: 0 }, decision);
  if (fetchError) lines.push(`Fetch error: ${fetchError.message}`);
  const message = lines.join("\n");

  if (hook) {
    process.stdout.write(JSON.stringify({
      hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: `## Repository freshness\n\n${message}` },
      suppressOutput: true,
    }));
    if (decision.status === "blocked") process.exitCode = 2;
    return { ...decision, message };
  }

  console.log(message);
  if (decision.status === "blocked") process.exitCode = 2;
  return { ...decision, message };
}

if (process.argv[1]?.endsWith("scripts/startup-sync.mjs")) {
  runSync({ hook: process.argv.includes("--hook") });
}
