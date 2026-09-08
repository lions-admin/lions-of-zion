#!/usr/bin/env node
/**
 * Chrome for whichever AI is asking, with a profile of its own.
 *
 * Every MCP-capable agent — Claude, Codex, Cursor, OpenCode, Gemini — reads
 * `.mcp.json`, and that file is tracked, so one entry reaches all five
 * workspaces. But one entry cannot name five different Chrome profiles, and
 * a shared profile is not a detail: Chrome locks its user-data directory, so
 * the second agent to open a browser either fails outright or fights the
 * first for the same tabs, cookies and session. That is the same collision
 * the worktrees exist to prevent, one layer up.
 *
 * So the config points here instead, and this resolves the caller before
 * handing off to `chrome-devtools-mcp`.
 *
 * ## stdout belongs to the protocol
 *
 * An MCP server speaks JSON-RPC over stdin/stdout. Anything else printed to
 * stdout corrupts the stream and the client drops the connection, usually
 * with no useful error. Every diagnostic here goes to stderr, which clients
 * surface as server logs.
 */
import { execFileSync, spawn } from "node:child_process";
import { mkdirSync } from "node:fs";
import { basename, join } from "node:path";
import { AI_BRANCHES } from "./startup-sync.mjs";
import { workspacesRoot } from "./workspace.mjs";

/** Pinned rather than `@latest`: an MCP server that changes its tool surface
 *  underneath five agents mid-session is a debugging problem nobody asked
 *  for. Bump deliberately. */
const SERVER = "chrome-devtools-mcp@1.8.0";

/**
 * Who is asking, for naming a profile — never for deciding whether to run.
 *
 * `LIONS_AI` first, then the checked-out branch, and failing both the
 * directory name. The last one matters more than it looks: each AI has
 * exactly one worktree, so the directory is already unique even when nothing
 * declares an identity, and falling back to it keeps two unidentified agents
 * apart instead of quietly merging them into one shared profile.
 */
function profileName() {
  const declared = process.env.LIONS_AI?.trim().toLowerCase();
  if (declared && AI_BRANCHES[declared]) return declared;

  try {
    const branch = execFileSync("git", ["branch", "--show-current"], { encoding: "utf8" }).trim();
    const byBranch = Object.entries(AI_BRANCHES).find(([, value]) => value === branch);
    if (byBranch) return byBranch[0];
  } catch {
    /* Not a checkout, or git is unavailable — the directory name still
       answers the only question being asked here. */
  }

  return basename(process.cwd()) || "unknown";
}

const name = profileName();
const profile = join(workspacesRoot(), ".chrome-profiles", name);
mkdirSync(profile, { recursive: true });

process.stderr.write(`chrome-devtools-mcp: profile "${name}" at ${profile}\n`);

const child = spawn(
  "npx",
  ["-y", SERVER, "--userDataDir", profile, ...process.argv.slice(2)],
  { stdio: "inherit", env: process.env },
);

child.on("error", (error) => {
  process.stderr.write(`chrome-devtools-mcp failed to start: ${error.message}\n`);
  process.exit(1);
});
child.on("exit", (code, signal) => process.exit(signal ? 1 : code ?? 0));

/* Hand signals down so closing the client closes Chrome rather than orphaning
   a browser holding a locked profile directory. */
for (const signal of ["SIGINT", "SIGTERM"]) {
  process.on(signal, () => child.kill(signal));
}
