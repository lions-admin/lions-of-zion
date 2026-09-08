#!/usr/bin/env node
/**
 * One permanent branch and one permanent working tree per AI, and the round
 * trip that publishes one of them.
 *
 *   npm run sync:start  -> continue on this AI's branch, up to date
 *   npm run main:update -> publish this AI's branch into main, then return
 *
 * ## Why identity, not task
 *
 * Two days of agent sessions once left roughly twenty remote branches. Not one
 * of them existed because two changes genuinely could not share a working
 * tree; they existed because a different tool, a restarted agent or a new
 * prompt had begun. So the branch is a property of *who is working*, not of
 * what they are working on: ten Codex sessions are still `ai/codex`.
 *
 * Isolation comes from the working tree instead. Each AI has its own worktree
 * (see `scripts/workspace.mjs`), so five agents can hold five different sets
 * of uncommitted files without ever seeing each other's index.
 *
 * ## The rule every function here obeys
 *
 * **Nothing destructive, ever, automatically.** No `reset --hard`, no force
 * push, no stash, no rebase, no discarding a modified file, no guess at a
 * conflict. A dirty tree is preserved and reported. A merge that conflicts is
 * aborted and reported. Divergence is never "solved" by inventing
 * `ai/codex-v2`.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { rmSync } from "node:fs";
import { join, resolve } from "node:path";
import { tmpdir } from "node:os";

const root = process.env.CLAUDE_PROJECT_DIR ?? resolve(new URL("..", import.meta.url).pathname);

/** AI identity to permanent branch. The only mapping in the system. */
export const AI_BRANCHES = {
  claude: "ai/claude",
  grok: "ai/grok",
  codex: "ai/codex",
  opencode: "ai/opencode",
  "gemini-agy": "ai/gemini-agy",
};

export const PRODUCTION_BRANCH = "main";

/**
 * Branches automatic cleanup must never touch.
 *
 * The five AI branches and `main` are the development model. The two editorial
 * branches are **operational delivery branches, not stale development work**:
 * orphans that share no history with `main`, never merged into anything, and
 * not to be tidied. Before this exemption existed, `cleanupMergedBranches()`
 * spared only `origin/main` — it would have deleted a permanent branch the
 * first time one merged.
 */
export const PERMANENT_BRANCHES = new Set([
  PRODUCTION_BRANCH,
  ...Object.values(AI_BRANCHES),
  "chatgpt-editorial-updates",
  "editorial-updates",
]);

function git(args) {
  return execFileSync("git", args, { cwd: root, encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] }).trim();
}

function gitStatus(args) {
  return spawnSync("git", args, { cwd: root, stdio: "ignore" }).status === 0;
}

export const currentBranch = () => git(["branch", "--show-current"]);
const workingTreeChanges = () => git(["status", "--porcelain", "--untracked-files=all"]);
const localBranchExists = (b) => gitStatus(["show-ref", "--verify", "--quiet", `refs/heads/${b}`]);
const remoteBranchExists = (b) => gitStatus(["show-ref", "--verify", "--quiet", `refs/remotes/origin/${b}`]);
const isMerged = (b) => gitStatus(["merge-base", "--is-ancestor", b, `origin/${PRODUCTION_BRANCH}`]);

function branchNames(ref) {
  const out = git(["for-each-ref", "--format=%(refname:short)", ref]);
  return out ? out.split("\n").filter(Boolean) : [];
}

function divergence(left, right) {
  const [behind, ahead] = git(["rev-list", "--left-right", "--count", `${right}...${left}`]).split(/\s+/).map(Number);
  return { ahead, behind };
}

/**
 * Which AI is this, and therefore which branch?
 *
 * Four sources, in order of how much they actually know, and **it never
 * guesses**: being on an `ai/*` branch already answers the question; an
 * explicit `LIONS_AI` answers it; a CLI that identifies itself in the
 * environment answers it; and if none of them do, the caller is told the
 * mapping and nothing moves. Switching an agent onto another agent's branch
 * would mix two sets of work, which is worse than doing nothing.
 */
export function resolveIdentity(env = process.env, branch = currentBranch()) {
  /* An explicit declaration outranks everything, including the branch already
     checked out. The opposite order looks tidier and is wrong: once a tree sat
     on any `ai/*` branch, `LIONS_AI` could never move it, so a shared checkout
     could not change hands and the variable would silently do nothing. */
  const declared = env.LIONS_AI?.trim().toLowerCase();
  if (declared) {
    if (!AI_BRANCHES[declared]) {
      throw new Error(
        `LIONS_AI is "${declared}", which is not one of: ${Object.keys(AI_BRANCHES).join(", ")}.`,
      );
    }
    return { ai: declared, branch: AI_BRANCHES[declared], source: "LIONS_AI" };
  }

  /* Nothing declared, so the tree speaks for itself — which is the ordinary
     case inside a worktree, where no variable needs setting at all. */
  const byBranch = Object.entries(AI_BRANCHES).find(([, b]) => b === branch);
  if (byBranch) return { ai: byBranch[0], branch, source: "current branch" };

  /* Only markers a CLI sets for itself. Nothing is inferred from a model name
     or an account, because neither identifies the environment. */
  if (env.CLAUDECODE || env.CLAUDE_CODE) return { ai: "claude", branch: AI_BRANCHES.claude, source: "CLAUDECODE" };

  return null;
}

function identityHelp() {
  const rows = Object.entries(AI_BRANCHES).map(([ai, branch]) => `  ${ai.padEnd(12)} ${branch}`).join("\n");
  return [
    "Could not tell which AI environment this is, so nothing was changed.",
    "Set LIONS_AI to one of these, or switch to the branch yourself:",
    rows,
    "",
    'Example:  LIONS_AI=codex npm run sync:start',
  ].join("\n");
}

/** Create the AI branch if it does not exist yet, locally or on origin. This
 *  is the only branch this script ever creates, and only the one the resolved
 *  identity owns. */
export function ensureBranch(branch) {
  const local = localBranchExists(branch);
  const remote = remoteBranchExists(branch);
  if (!local && remote) {
    git(["branch", "--track", branch, `origin/${branch}`]);
    return "tracked";
  }
  if (!local && !remote) {
    git(["branch", branch, `origin/${PRODUCTION_BRANCH}`]);
    git(["push", "--set-upstream", "origin", branch]);
    return "created";
  }
  if (local && !remote) {
    git(["push", "--set-upstream", "origin", branch]);
    return "published";
  }
  return "present";
}

/** Delete merged branches — never a permanent one. */
export function cleanupMergedBranches() {
  const removed = [];
  const retained = [];

  for (const remoteBranch of branchNames("refs/remotes/origin")) {
    if (!remoteBranch.startsWith("origin/") || remoteBranch === "origin/HEAD") continue;
    const branch = remoteBranch.slice("origin/".length);
    if (PERMANENT_BRANCHES.has(branch)) continue;
    if (!isMerged(remoteBranch)) continue;
    git(["push", "origin", "--delete", branch]);
    removed.push(branch);
  }
  for (const branch of branchNames("refs/heads")) {
    if (PERMANENT_BRANCHES.has(branch)) continue;
    if (!isMerged(branch)) continue;
    if (gitStatus(["branch", "-d", branch])) removed.push(branch);
    else retained.push(branch);
  }
  return { removed, retained };
}

/**
 * Bring `main` into an AI branch without losing anything.
 *
 * A branch with no unpublished commits simply fast-forwards. A branch that has
 * real work gets an ordinary merge commit — not a rebase, because these
 * branches are long-lived and shared with a worktree, and rewriting their
 * history would be the one thing that could lose an agent's work.
 */
function reconcileWithMain(branch, lines) {
  const { ahead, behind } = divergence(branch, `origin/${PRODUCTION_BRANCH}`);
  if (behind === 0) {
    lines.push(`${branch} already carries everything in ${PRODUCTION_BRANCH}${ahead ? `; ${ahead} to publish.` : "."}`);
    return true;
  }
  if (ahead === 0) {
    if (gitStatus(["merge", "--ff-only", `origin/${PRODUCTION_BRANCH}`])) {
      lines.push(`${branch} had no unpublished work and fast-forwarded ${behind} commit${behind === 1 ? "" : "s"} onto ${PRODUCTION_BRANCH}.`);
      return true;
    }
  }
  if (gitStatus(["merge", "--no-edit", `origin/${PRODUCTION_BRANCH}`])) {
    lines.push(`Merged ${behind} new ${PRODUCTION_BRANCH} commit${behind === 1 ? "" : "s"} into ${branch}; your ${ahead} unpublished commit${ahead === 1 ? " is" : "s are"} intact.`);
    return true;
  }
  git(["merge", "--abort"]);
  lines.push(
    `${PRODUCTION_BRANCH} has ${behind} commit${behind === 1 ? "" : "s"} that conflict with ${branch}.`,
    "The merge was aborted and nothing was changed. Resolve it as part of your task:",
    `  git merge origin/${PRODUCTION_BRANCH}`,
    `Do not make another branch for this — ${branch} is where the work belongs.`,
  );
  return false;
}

export function syncStart(env = process.env) {
  git(["fetch", "--prune", "origin"]);
  const identity = resolveIdentity(env);
  if (!identity) return report([identityHelp()], currentBranch());

  const lines = [`Identity: ${identity.ai} (from ${identity.source}) -> ${identity.branch}`];
  const existence = ensureBranch(identity.branch);
  if (existence === "created") lines.push(`Created ${identity.branch} from origin/${PRODUCTION_BRANCH} and published it.`);
  if (existence === "tracked") lines.push(`Started tracking origin/${identity.branch}.`);
  if (existence === "published") lines.push(`Published the existing local ${identity.branch} to origin.`);

  const started = currentBranch();
  const dirty = workingTreeChanges();
  if (dirty) {
    const count = dirty.split("\n").length;
    lines.push(`Working tree has ${count} uncommitted change${count === 1 ? "" : "s"}; they were left exactly as they are.`);
    if (started !== identity.branch) lines.push(`You are on ${started}, not ${identity.branch}. Commit or set the changes aside yourself, then run sync:start again.`);
    else lines.push(`Staying on ${identity.branch}; it was not updated while the tree is dirty.`);
    return report(lines, started);
  }

  if (started !== identity.branch) {
    git(["switch", identity.branch]);
    lines.push(`Switched from ${started} to ${identity.branch}.`);
  }

  if (remoteBranchExists(identity.branch) && !gitStatus(["merge", "--ff-only", `origin/${identity.branch}`])) {
    const { ahead, behind } = divergence(identity.branch, `origin/${identity.branch}`);
    lines.push(`${identity.branch} and its remote have diverged (${ahead} local, ${behind} remote). Nothing was rebased or reset.`);
  }

  reconcileWithMain(identity.branch, lines);

  const { removed, retained } = cleanupMergedBranches();
  if (removed.length) lines.push(`Removed merged branches: ${removed.join(", ")}`);
  if (retained.length) lines.push(`Merged branches retained because another worktree uses them: ${retained.join(", ")}`);
  const stale = localDataAge();
  if (stale) lines.push(stale);
  return report(lines, currentBranch());
}

/**
 * Git is only half of "am I up to date"; the other half is the database the
 * local site reads, which drifts silently. Out of process and time-boxed, so a
 * slow or absent database can never delay or fail a session start.
 */
function localDataAge() {
  const check = spawnSync(process.execPath, [join(root, "scripts/check-local-data-age.mjs")], {
    cwd: root, encoding: "utf8", timeout: 8000, stdio: ["ignore", "pipe", "ignore"],
  });
  return check.stdout?.trim() || null;
}

/** Which worktree, if any, currently has this branch checked out. */
function worktreeHolding(branch) {
  let path = null;
  for (const line of git(["worktree", "list", "--porcelain"]).split("\n")) {
    if (line.startsWith("worktree ")) path = line.slice("worktree ".length);
    else if (line === `branch refs/heads/${branch}`) return path;
  }
  return null;
}

/**
 * Somewhere to build the merge commit that is not this worktree.
 *
 * The old shape — `git switch main`, merge, push, switch back — cannot work
 * once every AI has its own worktree: `main` is checked out in the primary
 * checkout, and git refuses to check out one branch in two trees at once.
 * That refusal is the same guarantee that keeps two agents out of each
 * other's files, so the answer is not to weaken it but to stop needing it.
 *
 * A short-lived detached worktree does the merge instead. It never touches
 * the caller's tree, so an agent publishes without leaving its own workspace
 * or disturbing whatever the primary checkout is doing, and a failure part-way
 * leaves nothing behind but a directory that `release()` removes.
 *
 * Detached on purpose: it checks out `origin/main` by commit, so it never
 * needs the local `main` ref that another tree already holds.
 */
function publishStaging() {
  const path = join(tmpdir(), `lions-publish-${process.pid}-${Date.now()}`);
  git(["worktree", "add", "--detach", path, `origin/${PRODUCTION_BRANCH}`]);
  const run = (args) => spawnSync("git", args, { cwd: path, stdio: "ignore" }).status === 0;
  return {
    path,
    merge: (branch) => run(["merge", "--no-ff", branch, "-m", `merge: publish ${branch}`]),
    /* HEAD is detached, so name the destination explicitly. */
    push: () => run(["push", "origin", `HEAD:refs/heads/${PRODUCTION_BRANCH}`]),
    /* Delete the directory outright rather than asking git to remove the
       worktree forcibly. The staging tree can hold a half-finished merge,
       which a plain `git worktree remove` refuses; reaching for git's forcing
       flag to get past that would put one in a file whose whole contract is
       that it has none, and the test that greps for it is right to fail that.
       This deletes a temp directory created seconds ago by this function, and
       nothing else. */
    release: () => {
      rmSync(path, { recursive: true, force: true });
      spawnSync("git", ["worktree", "prune"], { cwd: root, stdio: "ignore" });
    },
  };
}

/**
 * Publish this AI's branch, and come back ready for the next round.
 *
 * The return trip is the half that makes the branch permanent: after `main` is
 * pushed, the AI branch is levelled with it and published, so the next session
 * on that same branch starts from Production.
 */
export function updateMain(env = process.env) {
  const branch = currentBranch();
  if (branch === PRODUCTION_BRANCH) {
    throw new Error(
      `main:update publishes an AI branch into ${PRODUCTION_BRANCH}; it cannot publish ${PRODUCTION_BRANCH} into itself.\n${identityHelp()}`,
    );
  }
  if (workingTreeChanges()) {
    throw new Error(
      `Working tree has uncommitted changes. Commit them on ${branch} before publishing.\nNothing was stashed, reset or discarded.`,
    );
  }

  git(["fetch", "--prune", "origin"]);
  const lines = [];
  const staging = publishStaging();
  try {
    if (!staging.merge(branch)) {
      throw new Error(
        `Merging ${branch} into ${PRODUCTION_BRANCH} conflicts. Nothing was pushed and you are still on ${branch}.\n`
        + `Bring ${PRODUCTION_BRANCH} in first and resolve it there:\n  git merge origin/${PRODUCTION_BRANCH}`,
      );
    }
    if (!staging.push()) {
      throw new Error(
        `${branch} merged cleanly but pushing ${PRODUCTION_BRANCH} failed — the pre-push guard may have declined it,\n`
        + `or someone pushed ${PRODUCTION_BRANCH} in between. Nothing was lost and you are still on ${branch}.\n`
        + "Run main:update again.",
      );
    }
  } finally {
    staging.release();
  }
  lines.push(`Merged ${branch} into ${PRODUCTION_BRANCH} and pushed it. Production deploys from here.`);

  git(["fetch", "--prune", "origin"]);
  /* Nothing checked `main` out during the publish, so the local ref still
     points where it did before. Fast-forward it when no worktree holds it —
     `fetch` can update a ref it is not standing on — and say so plainly when
     one does, because a stale local `main` in the primary checkout is
     confusing precisely when someone goes looking for what was published. */
  const mainHost = worktreeHolding(PRODUCTION_BRANCH);
  if (!mainHost) {
    gitStatus(["fetch", "origin", `${PRODUCTION_BRANCH}:${PRODUCTION_BRANCH}`]);
  } else if (mainHost !== root) {
    lines.push(`Local ${PRODUCTION_BRANCH} is checked out in ${mainHost}; fast-forward it there when convenient.`);
  }
  if (gitStatus(["merge", "--ff-only", `origin/${PRODUCTION_BRANCH}`])) {
    if (remoteBranchExists(branch)) git(["push", "origin", branch]);
    lines.push(`${branch} is level with ${PRODUCTION_BRANCH} and ready for the next session.`);
  } else {
    lines.push(`${branch} could not fast-forward onto ${PRODUCTION_BRANCH}. Nothing was rebased or reset.`);
  }

  const { removed, retained } = cleanupMergedBranches();
  if (removed.length) lines.push(`Removed merged branches: ${removed.join(", ")}`);
  if (retained.length) lines.push(`Merged branches retained because another worktree uses them: ${retained.join(", ")}`);
  lines.push(`${branch} is permanent and was not deleted.`);
  return report(lines, currentBranch());
}

function report(lines, branch) {
  const head = git(["rev-parse", "--short", "HEAD"]);
  console.log([`On ${branch} at ${head}.`, ...lines].join("\n"));
  return { branch, head, lines };
}

function run() {
  const publish = process.argv.includes("--publish");
  const hook = process.argv.includes("--hook");
  try {
    if (publish) updateMain();
    else syncStart();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (hook) {
      process.stdout.write(JSON.stringify({
        hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: `## Branch synchronization\n\n${message}` },
        suppressOutput: true,
      }));
    } else {
      console.error(message);
    }
    process.exitCode = 2;
  }
}

if (process.argv[1]?.endsWith("scripts/startup-sync.mjs")) run();
