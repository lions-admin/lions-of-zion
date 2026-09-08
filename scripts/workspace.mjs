#!/usr/bin/env node
/**
 * Where each AI works, and whether that workspace exists yet.
 *
 *   npm run workspace:status        -> the mapping, and where you are in it
 *   npm run workspace:add -- codex  -> create that AI's worktree
 *
 * Two subcommands and no framework. The point of this architecture is fewer
 * git mechanisms, not more: the branches are permanent, so the only recurring
 * question is "which tree am I in and is it current", and that is what this
 * answers.
 *
 * Worktrees live in a sibling directory of the repository — `<repo>-workspaces`
 * — rather than inside it. Inside would mean a nested full checkout with its
 * own `node_modules`, which is exactly what forced `.claude/worktrees` into
 * `eslint.config.mjs`, `tsconfig.json` and `.vercelignore`. A sibling needs
 * none of that, and the path is derived from the repository location so
 * nothing user-specific is baked into the repository.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { basename, dirname, join, resolve } from "node:path";
import { AI_BRANCHES, PRODUCTION_BRANCH } from "./startup-sync.mjs";

const root = process.env.CLAUDE_PROJECT_DIR ?? resolve(new URL("..", import.meta.url).pathname);

function git(args, cwd = root) {
  return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}
const ok = (args) => spawnSync("git", args, { cwd: root, stdio: "ignore" }).status === 0;

/** The repository's own toplevel, so a worktree does not nest inside another. */
function primaryCheckout() {
  const common = git(["rev-parse", "--path-format=absolute", "--git-common-dir"]);
  return dirname(common);
}

export function workspacesRoot() {
  const primary = primaryCheckout();
  return join(dirname(primary), `${basename(primary)}-workspaces`);
}

export const workspacePath = (ai) => join(workspacesRoot(), ai);

function worktrees() {
  const map = new Map();
  let path = null;
  for (const line of git(["worktree", "list", "--porcelain"]).split("\n")) {
    if (line.startsWith("worktree ")) path = line.slice("worktree ".length);
    else if (line.startsWith("branch ") && path) map.set(line.slice("branch refs/heads/".length), path);
  }
  return map;
}

function divergence(left, right) {
  try {
    const [behind, ahead] = git(["rev-list", "--left-right", "--count", `${right}...${left}`]).split(/\s+/).map(Number);
    return { ahead, behind };
  } catch {
    return null;
  }
}

export function status() {
  const trees = worktrees();
  const here = git(["branch", "--show-current"]);
  const dirty = git(["status", "--porcelain", "--untracked-files=all"]);
  const lines = ["AI workspaces", ""];

  for (const [ai, branch] of Object.entries(AI_BRANCHES)) {
    const tree = trees.get(branch);
    const exists = ok(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`]);
    const gap = exists ? divergence(branch, `origin/${PRODUCTION_BRANCH}`) : null;
    const state = !exists
      ? "branch not created yet"
      : gap
        ? `${gap.ahead} ahead / ${gap.behind} behind ${PRODUCTION_BRANCH}`
        : "no comparison available";
    const where = tree ?? (existsSync(workspacePath(ai)) ? `${workspacePath(ai)} (not a worktree)` : "no worktree — npm run workspace:add -- " + ai);
    lines.push(`  ${ai.padEnd(11)} ${branch.padEnd(16)} ${state}`);
    lines.push(`  ${" ".repeat(11)} ${where}`);
  }

  lines.push("", `Here: ${here || "detached HEAD"} in ${root}`, `Tree:  ${dirty ? `${dirty.split("\n").length} uncommitted change(s)` : "clean"}`);
  const gap = here ? divergence(here, `origin/${PRODUCTION_BRANCH}`) : null;
  if (gap) lines.push(`Main:  ${gap.ahead} to publish, ${gap.behind} to take in.`);
  console.log(lines.join("\n"));
  return { here, dirty: Boolean(dirty), trees };
}

export function add(ai) {
  if (!AI_BRANCHES[ai]) {
    throw new Error(`Unknown AI "${ai}". One of: ${Object.keys(AI_BRANCHES).join(", ")}`);
  }
  const branch = AI_BRANCHES[ai];
  const path = workspacePath(ai);
  const existing = worktrees().get(branch);
  if (existing) {
    console.log(`${ai} already has a workspace at ${existing}`);
    return existing;
  }
  if (existsSync(path)) throw new Error(`${path} already exists but is not a worktree for ${branch}. Move it aside first.`);
  if (!ok(["show-ref", "--verify", "--quiet", `refs/heads/${branch}`])) {
    throw new Error(`${branch} does not exist yet. Run: npm run sync:start (as ${ai}) or create it from ${PRODUCTION_BRANCH} first.`);
  }

  git(["worktree", "add", path, branch]);
  console.log([
    `${ai} -> ${branch}`,
    `  ${path}`,
    "",
    "It shares this repository's git history but has its own index and files.",
    "Install dependencies there before working:",
    `  cd ${path} && npm ci`,
  ].join("\n"));
  return path;
}

function run() {
  const [command, ...rest] = process.argv.slice(2).filter((arg) => arg !== "--");
  try {
    if (!command || command === "status") status();
    else if (command === "add") {
      const ai = rest[0];
      if (!ai) throw new Error(`Which AI? One of: ${Object.keys(AI_BRANCHES).join(", ")}`);
      add(ai.toLowerCase());
    } else {
      throw new Error(`Unknown command "${command}". Use: status | add <ai>`);
    }
  } catch (error) {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 2;
  }
}

if (process.argv[1]?.endsWith("scripts/workspace.mjs")) run();
