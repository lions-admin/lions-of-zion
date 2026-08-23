#!/usr/bin/env node
/**
 * Notices when the code moved but the journal did not.
 *
 * Reminding on every stop would be noise that gets tuned out within a day, so
 * this compares modification times: it only speaks when a source file is
 * genuinely newer than `.ai/STATE.md`. Editing the journal silences it, which
 * is the behaviour you want from a nudge — it goes away when satisfied, not
 * when dismissed.
 *
 * Never blocks. A reminder that can stop a turn is a reminder that gets
 * disabled.
 */

import { statSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const quiet = () => {
  process.stdout.write(JSON.stringify({ suppressOutput: true }));
  process.exit(0);
};

/* Config, docs and the journal itself are not "the work moved". */
const IGNORED = /^(\.ai\/|\.claude\/|\.mcp\.json|CLAUDE\.md|AGENTS\.md|README\.md|package-lock\.json)/;
const SOURCE = /\.(ts|tsx|css|mjs|json)$/;

let changed;
try {
  changed = execFileSync("git", ["status", "--porcelain"], { cwd: root, encoding: "utf8" })
    .split("\n")
    .map((l) => l.slice(3).trim())
    .filter((p) => p && !IGNORED.test(p) && SOURCE.test(p));
} catch {
  quiet();
}

if (!changed.length) quiet();

const mtime = (rel) => {
  try {
    return statSync(join(root, rel)).mtimeMs;
  } catch {
    return 0;
  }
};

const stateAt = mtime(".ai/STATE.md");
const stale = changed.filter((p) => mtime(p) > stateAt);
if (!stale.length) quiet();

const list = stale.slice(0, 5).join(", ") + (stale.length > 5 ? `, +${stale.length - 5} more` : "");

process.stdout.write(
  JSON.stringify({
    systemMessage:
      `Journal is behind the code — ${list} ` +
      `${stale.length === 1 ? "was" : "were"} modified after .ai/STATE.md. ` +
      `If the position of the work changed, update it (/sync). If this was a ` +
      `throwaway edit, ignore this.`,
  }),
);
