#!/usr/bin/env node
/**
 * Keep every task on the current main branch, then publish a completed round.
 *
 *   npm run sync:start  -> update main, remove merged branches, stop on open branches
 *   npm run main:update -> merge the current completed branch into main, verify, push, clean it up
 */
import { execFileSync, spawnSync } from "node:child_process";
import { resolve } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR ?? resolve(new URL("..", import.meta.url).pathname);

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function cleanTree() {
  if (git(["status", "--porcelain", "--untracked-files=all"])) {
    throw new Error("Working tree has changes. Commit or stash them before synchronizing main.");
  }
}

function gitStatus(args) {
  return spawnSync("git", args, { cwd: root, stdio: "ignore" }).status === 0;
}

function branchNames(ref) {
  const output = git(["for-each-ref", "--format=%(refname:short)", ref]);
  return output ? output.split("\n").filter(Boolean) : [];
}

function isMerged(branch) {
  return gitStatus(["merge-base", "--is-ancestor", branch, "origin/main"]);
}

function cleanupMergedBranches() {
  const remoteBranches = branchNames("refs/remotes/origin")
    .filter((branch) => branch !== "origin/HEAD" && branch !== "origin/main");
  const localBranches = branchNames("refs/heads").filter((branch) => branch !== "main");
  const removed = [];
  const retained = [];

  for (const remoteBranch of remoteBranches) {
    const branch = remoteBranch.slice("origin/".length);
    if (!isMerged(remoteBranch)) continue;
    git(["push", "origin", "--delete", branch]);
    removed.push(branch);
  }

  for (const branch of localBranches) {
    if (!isMerged(branch)) continue;
    if (gitStatus(["branch", "-d", branch])) removed.push(branch);
    else retained.push(branch);
  }

  return { removed, retained };
}

function unmergedRemoteBranches() {
  return branchNames("refs/remotes/origin")
    .filter((branch) => branch !== "origin/HEAD" && branch !== "origin/main")
    .filter((branch) => !isMerged(branch))
    .map((branch) => branch.slice("origin/".length));
}

export function syncStart() {
  cleanTree();
  git(["fetch", "--prune", "origin"]);
  git(["switch", "main"]);
  git(["merge", "--ff-only", "origin/main"]);
  const { removed, retained } = cleanupMergedBranches();
  const unmerged = unmergedRemoteBranches();
  const head = git(["rev-parse", "--short", "HEAD"]);
  if (unmerged.length) {
    throw new Error(`main is current at ${head}. Open branches need a merge or deletion decision: ${unmerged.join(", ")}.`);
  }
  console.log(`main is current at ${head}`);
  if (removed.length) console.log(`Removed merged branches: ${removed.join(", ")}`);
  if (retained.length) console.log(`Merged branches retained because another worktree uses them: ${retained.join(", ")}`);
}

export function updateMain(sourceBranch) {
  if (!sourceBranch || sourceBranch === "main") {
    throw new Error("main:update must start from a completed non-main branch.");
  }
  cleanTree();
  git(["fetch", "--prune", "origin"]);
  git(["switch", "main"]);
  git(["merge", "--ff-only", "origin/main"]);
  git(["merge", "--no-ff", sourceBranch, "-m", `merge: complete ${sourceBranch}`]);

  const verification = spawnSync("npm", ["run", "verify:full"], { cwd: root, stdio: "inherit" });
  if (verification.status !== 0) {
    throw new Error("Merged main did not pass the full verification gate; main was not pushed.");
  }

  git(["push", "origin", "main"]);
  const { retained } = cleanupMergedBranches();
  console.log(`Merged ${sourceBranch} and pushed main.`);
  if (retained.length) console.log(`Merged branches retained because another worktree uses them: ${retained.join(", ")}`);
}

function run() {
  const publish = process.argv.includes("--publish");
  const hook = process.argv.includes("--hook");
  const sourceBranch = git(["branch", "--show-current"]);

  try {
    if (publish) updateMain(sourceBranch);
    else syncStart();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (hook) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: `## Main synchronization\n\n${message}` },
        suppressOutput: true,
      }));
    } else {
      console.error(message);
    }
    process.exitCode = 2;
  }
}

if (process.argv[1]?.endsWith("scripts/startup-sync.mjs")) run();
