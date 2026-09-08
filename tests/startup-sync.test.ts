import { execFileSync, spawnSync } from "node:child_process";
import { mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach, describe, expect, it } from "vitest";

/**
 * The AI-workspace branch model, tested by running it.
 *
 * An older version of this file read `scripts/startup-sync.mjs` as a string
 * and asserted that certain source lines appeared in it — including
 * `git(["switch", "main"])`, the exact behaviour this model removes. It pinned
 * the spelling of the implementation and verified none of its behaviour, so it
 * would have passed a script that did the right things in the wrong order and
 * failed a correct rewrite. The repository's own modernization audit had
 * already flagged it (A6-11).
 *
 * This builds a real repository with a real `origin` in a temp directory and
 * drives the script against it through `CLAUDE_PROJECT_DIR`. Nothing here
 * touches the network or the real remote — the ten scenarios in the brief are
 * exercised on a sandbox that is deleted afterwards.
 */

let dir: string;
let origin: string;
let repo: string;

const SCRIPT = join(process.cwd(), "scripts/startup-sync.mjs");

function git(cwd: string, ...args: string[]): string {
  return execFileSync("git", args, { cwd, encoding: "utf8" }).trim();
}

/**
 * Run the script the way npm does, as a named AI.
 *
 * `CLAUDECODE` is stripped deliberately: this suite runs inside Claude Code,
 * whose marker would otherwise resolve every identity to `claude` and make the
 * per-AI tests silently test nothing.
 */
function run(args: string[] = [], ai?: string): { ok: boolean; out: string } {
  const env: NodeJS.ProcessEnv = { ...process.env, CLAUDE_PROJECT_DIR: repo };
  delete env.CLAUDECODE;
  delete env.CLAUDE_CODE;
  delete env.LIONS_AI;
  if (ai) env.LIONS_AI = ai;
  try {
    const out = execFileSync("node", [SCRIPT, ...args], {
      cwd: repo,
      encoding: "utf8",
      env,
      stdio: ["ignore", "pipe", "pipe"],
    });
    return { ok: true, out };
  } catch (error) {
    const failure = error as { stdout?: string; stderr?: string };
    return { ok: false, out: `${failure.stdout ?? ""}${failure.stderr ?? ""}` };
  }
}

const branch = () => git(repo, "branch", "--show-current");
const localBranches = () => git(repo, "for-each-ref", "--format=%(refname:short)", "refs/heads").split("\n").filter(Boolean).sort();
const remoteBranches = () => git(origin, "for-each-ref", "--format=%(refname:short)", "refs/heads").split("\n").filter(Boolean).sort();

function commit(message: string, file = "file.txt"): void {
  writeFileSync(join(repo, file), `${message}\n`, { flag: "a" });
  git(repo, "add", "-A");
  git(repo, "commit", "-m", message);
}

beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "startup-sync-"));
  origin = join(dir, "origin.git");
  repo = join(dir, "repo");
  mkdirSync(join(dir, "no-hooks"));

  execFileSync("git", ["init", "--bare", "--initial-branch=main", origin]);
  execFileSync("git", ["init", "--initial-branch=main", repo]);
  git(repo, "config", "user.email", "test@example.com");
  git(repo, "config", "user.name", "Test");
  /* The fixture must not inherit the developer's machine configuration. This
     workstation sets a global `core.hooksPath` holding a pre-push guard that
     blocks pushes to `main` — correct for real repositories, and fatal to a
     sandbox whose whole purpose is to push to `main` a dozen times. Pointing
     `core.hooksPath` at an empty directory makes the test hermetic: it now
     behaves identically on a machine with that guard and on CI without it. */
  git(repo, "config", "core.hooksPath", join(dir, "no-hooks"));
  git(repo, "remote", "add", "origin", origin);
  commit("initial");
  git(repo, "push", "-u", "origin", "main");
});

afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

describe("identity decides the branch, not the task", () => {
  /* The success criterion from the brief, stated as a test: ten Codex
     sessions must still produce exactly one Codex branch. */
  it("reuses ai/codex across repeated sessions and creates nothing else", () => {
    for (let session = 0; session < 10; session += 1) run([], "codex");

    expect(branch()).toBe("ai/codex");
    expect(localBranches()).toEqual(["ai/codex", "main"]);
    expect(remoteBranches()).toEqual(["ai/codex", "main"]);
  });

  it("gives each AI its own branch and only its own", () => {
    for (const ai of ["claude", "grok", "codex", "opencode", "gemini-agy"]) {
      const { ok, out } = run([], ai);
      expect(ok, out).toBe(true);
      expect(branch()).toBe(`ai/${ai}`);
    }
    expect(remoteBranches()).toEqual([
      "ai/claude", "ai/codex", "ai/gemini-agy", "ai/grok", "ai/opencode", "main",
    ]);
  });

  /* Being on an ai/* branch already answers the question, so a session that
     starts in a workspace needs no environment variable at all. */
  it("takes identity from the current branch when it is already an AI branch", () => {
    run([], "grok");
    const { ok, out } = run();

    expect(ok).toBe(true);
    expect(out).toMatch(/Identity: grok \(from current branch\)/);
    expect(branch()).toBe("ai/grok");
  });

  /* Never guess: switching an agent onto another agent's branch would mix two
     sets of work. */
  it("changes nothing when it cannot tell which AI it is", () => {
    const before = branch();
    const { ok, out } = run();

    expect(ok).toBe(true);
    expect(out).toMatch(/Could not tell which AI environment this is/);
    expect(out).toMatch(/ai\/codex/);
    expect(branch()).toBe(before);
    expect(localBranches()).toEqual(["main"]);
  });

  it("refuses an unknown LIONS_AI rather than inventing a branch", () => {
    const { ok, out } = run([], "hal9000");

    expect(ok).toBe(false);
    expect(out).toMatch(/not one of/);
    expect(localBranches()).toEqual(["main"]);
  });
});

describe("keeping an AI branch current without losing work", () => {
  /* Behind main and nothing of its own: a plain fast-forward. */
  it("fast-forwards a branch that has no unpublished work", () => {
    run([], "codex");
    git(repo, "switch", "main");
    commit("someone else published");
    git(repo, "push", "origin", "main");

    const { ok, out } = run([], "codex");

    expect(ok).toBe(true);
    expect(out).toMatch(/fast-forwarded/);
    expect(git(repo, "rev-parse", "ai/codex")).toBe(git(repo, "rev-parse", "main"));
  });

  /* The case the brief calls out: Claude publishes while Codex is mid-task.
     Codex's commits must survive, and no new branch may appear. */
  it("merges main into a branch that has unpublished work, losing nothing", () => {
    run([], "codex");
    commit("codex work in progress");
    const codexWork = git(repo, "rev-parse", "HEAD");

    git(repo, "switch", "main");
    commit("claude published first", "other.txt");
    git(repo, "push", "origin", "main");

    const { ok, out } = run([], "codex");

    expect(ok).toBe(true);
    expect(out).toMatch(/Merged 1 new main commit into ai\/codex/);
    expect(branch()).toBe("ai/codex");
    /* Both histories are present, and nothing was rebased away. */
    expect(git(repo, "merge-base", "--is-ancestor", codexWork, "HEAD") === "").toBe(true);
    expect(git(repo, "log", "--format=%s")).toMatch(/codex work in progress/);
    expect(git(repo, "log", "--format=%s")).toMatch(/claude published first/);
    expect(localBranches()).toEqual(["ai/codex", "main"]);
  });

  it("aborts a conflicting merge and tells you to resolve it on the same branch", () => {
    run([], "codex");
    commit("codex edits the shared line");

    git(repo, "switch", "main");
    writeFileSync(join(repo, "file.txt"), "a conflicting line\n", { flag: "a" });
    git(repo, "add", "-A");
    git(repo, "commit", "-m", "main edits the shared line");
    git(repo, "push", "origin", "main");

    const { ok, out } = run([], "codex");

    expect(ok).toBe(true);
    expect(out).toMatch(/conflict/);
    expect(out).toMatch(/Do not make another branch/);
    /* Aborted cleanly: no conflict markers left, no new branch. */
    expect(git(repo, "status", "--porcelain")).toBe("");
    expect(localBranches()).toEqual(["ai/codex", "main"]);
  });

  it("preserves an uncommitted change and refuses to move", () => {
    run([], "codex");
    writeFileSync(join(repo, "file.txt"), "work in progress\n", { flag: "a" });
    writeFileSync(join(repo, "untracked.txt"), "also mine\n");

    const { ok, out } = run([], "codex");

    expect(ok).toBe(true);
    expect(out).toMatch(/uncommitted change/);
    expect(out).toMatch(/left exactly as they are/);
    expect(git(repo, "status", "--porcelain")).toMatch(/file\.txt/);
    expect(git(repo, "status", "--porcelain")).toMatch(/untracked\.txt/);
  });
});

describe("worktrees keep two AIs out of each other's files", () => {
  it("lets two AI workspaces hold different uncommitted changes", () => {
    run([], "codex");
    run([], "grok");

    const codexTree = join(dir, "ws-codex");
    const grokTree = join(dir, "ws-grok");
    /* The sandbox checkout has to let go of the branches first: git refuses to
       check one out in two trees at once, which is the same guarantee that
       keeps two real agents apart. */
    git(repo, "switch", "main");
    git(repo, "worktree", "add", codexTree, "ai/codex");
    git(repo, "worktree", "add", grokTree, "ai/grok");

    writeFileSync(join(codexTree, "codex-only.txt"), "codex\n");
    writeFileSync(join(grokTree, "grok-only.txt"), "grok\n");

    /* Each tree sees its own change and nothing of the other's — the whole
       reason the model uses one worktree per AI rather than one shared tree. */
    expect(git(codexTree, "status", "--porcelain")).toMatch(/codex-only\.txt/);
    expect(git(codexTree, "status", "--porcelain")).not.toMatch(/grok-only/);
    expect(git(grokTree, "status", "--porcelain")).toMatch(/grok-only\.txt/);
    expect(git(grokTree, "status", "--porcelain")).not.toMatch(/codex-only/);
    expect(git(codexTree, "branch", "--show-current")).toBe("ai/codex");
    expect(git(grokTree, "branch", "--show-current")).toBe("ai/grok");
  });
});

describe("publishing leaves the permanent branch alive", () => {
  it("merges into main, pushes, and returns the AI branch level with main", () => {
    run([], "codex");
    commit("a completed round");
    git(repo, "push", "origin", "ai/codex");

    const { ok, out } = run(["--publish"], "codex");

    expect(ok).toBe(true);
    expect(branch()).toBe("ai/codex");
    expect(out).toMatch(/Merged ai\/codex into main and pushed it/);
    expect(out).toMatch(/ai\/codex is permanent and was not deleted/);
    expect(git(origin, "rev-parse", "main")).toBe(git(repo, "rev-parse", "main"));
    expect(git(repo, "rev-parse", "ai/codex")).toBe(git(repo, "rev-parse", "main"));
    expect(remoteBranches()).toContain("ai/codex");
  });

  it("creates no branch beyond the AI branch and main across repeated cycles", () => {
    run([], "codex");
    commit("round one");
    run(["--publish"], "codex");
    run([], "codex");
    commit("round two");
    run(["--publish"], "codex");
    run([], "codex");

    expect(localBranches()).toEqual(["ai/codex", "main"]);
    expect(remoteBranches()).toEqual(["ai/codex", "main"]);
    expect(branch()).toBe("ai/codex");
  });

  it("refuses to publish from main rather than guessing what was meant", () => {
    run([], "codex");
    git(repo, "switch", "main");

    const { ok, out } = run(["--publish"], "codex");

    expect(ok).toBe(false);
    expect(out).toMatch(/cannot publish main into itself/);
  });

  it("refuses to publish a dirty tree and discards nothing", () => {
    run([], "codex");
    writeFileSync(join(repo, "file.txt"), "uncommitted\n", { flag: "a" });

    const { ok, out } = run(["--publish"], "codex");

    expect(ok).toBe(false);
    expect(out).toMatch(/uncommitted changes/);
    expect(out).toMatch(/Nothing was stashed, reset or discarded/);
    expect(git(repo, "status", "--porcelain")).toMatch(/file\.txt/);
  });
});

describe("permanent branches survive automatic cleanup", () => {
  it("never deletes an AI or editorial branch, and still deletes a merged temporary one", () => {
    run([], "codex");
    for (const name of ["chatgpt-editorial-updates", "editorial-updates", "ai/grok"]) {
      git(repo, "branch", name, "main");
      git(repo, "push", "origin", name);
    }
    git(repo, "branch", "owner-requested-isolation", "main");
    git(repo, "push", "origin", "owner-requested-isolation");

    const { ok, out } = run([], "codex");

    expect(ok).toBe(true);
    expect(remoteBranches()).toEqual([
      "ai/codex", "ai/grok", "chatgpt-editorial-updates", "editorial-updates", "main",
    ]);
    expect(out).toMatch(/Removed merged branches: owner-requested-isolation/);
  });
});

describe("no AI branch reaches Vercel", () => {
  /* Two independent controls, because the first one alone is not enough.
     `ignoreCommand` runs *inside* a deployment, so it stops the build but a
     deployment record is still created and queued — measured on 2026-09-08,
     when pushing the five branches produced five queued previews before the
     ignore step reached them. `git.deploymentEnabled` is the one that stops
     the deployment from being created at all, which is why the editorial
     delivery branches have always used it. Both are asserted. */
  it("never lets git create a deployment for a permanent AI branch", () => {
    const config = JSON.parse(readFileSync(join(process.cwd(), "vercel.json"), "utf8")) as {
      git: { deploymentEnabled: Record<string, boolean> };
    };
    for (const ai of ["claude", "grok", "codex", "opencode", "gemini-agy"]) {
      expect(config.git.deploymentEnabled[`ai/${ai}`], `ai/${ai} must not deploy`).toBe(false);
    }
    /* The editorial delivery branches keep the same protection. */
    for (const branch of ["chatgpt-editorial-updates", "editorial-updates", "briefing-packages"]) {
      expect(config.git.deploymentEnabled[branch], `${branch} must not deploy`).toBe(false);
    }
  });

  it("skips the build for every permanent AI branch as a second line", () => {
    const script = join(process.cwd(), "scripts/vercel-ignore-build.sh");
    for (const ref of ["ai/claude", "ai/grok", "ai/codex", "ai/opencode", "ai/gemini-agy"]) {
      const result = spawnSync("bash", [script], {
        env: { ...process.env, VERCEL_GIT_COMMIT_REF: ref },
        encoding: "utf8",
      });
      expect(result.status, `${ref} must not build`).toBe(0);
      expect(result.stdout).toMatch(/SKIP/);
    }
  });
});

describe("the script never reaches for a destructive command", () => {
  it("contains no force push, hard reset, stash or clean", () => {
    const source = readFileSync(SCRIPT, "utf8");
    for (const forbidden of ["--force", "reset\", \"--hard", "\"stash\"", "\"clean\"", "-D"]) {
      expect(source, `startup-sync.mjs must not use ${forbidden}`).not.toContain(forbidden);
    }
  });
});
