#!/usr/bin/env node
/**
 * Loads the project journal into context at session start.
 *
 * The half of a memory system that agents skip is the reading, because nothing
 * makes them do it. This does: `.ai/STATE.md` and the newest decisions arrive
 * as context before the first prompt, alongside the git facts that would
 * otherwise be guessed at.
 *
 * Deliberately bounded. A context file large enough to be ignored is worse
 * than none, so decisions are truncated to the most recent few and the whole
 * payload is capped. If it is being cut, that is a signal to prune the source.
 */

import { readFileSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { join } from "node:path";

const root = process.env.CLAUDE_PROJECT_DIR ?? process.cwd();
const MAX_DECISIONS = 4;
const MAX_CHARS = 6000;

const read = (rel) => {
  try {
    return readFileSync(join(root, rel), "utf8").trim();
  } catch {
    return "";
  }
};

const git = (...args) => {
  try {
    return execFileSync("git", args, { cwd: root, encoding: "utf8" }).trim();
  } catch {
    return "";
  }
};

const state = read(".ai/STATE.md");
const decisions = read(".ai/DECISIONS.md");

/* Entries are `## ` sections, newest first by convention. Keep the preamble
   out of the count — it explains the format, not a decision. */
let recent = "";
if (decisions) {
  const parts = decisions.split(/\n(?=## )/);
  const kept = parts.slice(1, 1 + MAX_DECISIONS);
  const dropped = Math.max(0, parts.length - 1 - kept.length);
  recent =
    kept.join("\n").trim() +
    (dropped ? `\n\n_(${dropped} older decision(s) in \`.ai/DECISIONS.md\`.)_` : "");
}

const status = git("status", "--porcelain");
const branch = git("rev-parse", "--abbrev-ref", "HEAD");
const log = git("log", "--oneline", "-5");

const sections = [];

if (state) sections.push(`### Current state (\`.ai/STATE.md\`)\n\n${state}`);
if (recent) sections.push(`### Recent decisions (\`.ai/DECISIONS.md\`)\n\n${recent}`);

const gitLines = [];
if (branch) gitLines.push(`Branch \`${branch}\`.`);
if (log) gitLines.push(`\nRecent commits:\n\`\`\`\n${log}\n\`\`\``);
gitLines.push(
  status
    ? `\nUncommitted changes:\n\`\`\`\n${status}\n\`\`\``
    : "\nWorking tree is clean.",
);
sections.push(`### Git\n\n${gitLines.join("\n")}`);

if (!state && !recent) {
  sections.push(
    "_No `.ai/STATE.md` yet. If this session changes anything worth knowing " +
      "later, create one._",
  );
}

let body = sections.join("\n\n");
if (body.length > MAX_CHARS) {
  body = `${body.slice(0, MAX_CHARS)}\n\n_(truncated — prune \`.ai/STATE.md\`.)_`;
}

const context = `## Project journal

Loaded automatically. \`.ai/STATE.md\` is the snapshot of where things stand;
\`.ai/DECISIONS.md\` records why things are the way they are. Stable
architecture and invariants live in \`CLAUDE.md\` instead.

**Before you finish**: if this session changed the position of the work,
started or unblocked something, or made a decision a later reader could
undo by accident, update the journal. \`/sync\` walks through it.

${body}`;

process.stdout.write(
  JSON.stringify({
    hookSpecificOutput: { hookEventName: "SessionStart", additionalContext: context },
    suppressOutput: true,
  }),
);
