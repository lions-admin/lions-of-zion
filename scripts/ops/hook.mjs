#!/usr/bin/env node
/**
 * Claude Code / Grok hook adapter for the operations board.
 *
 *   node scripts/ops/hook.mjs <session-start|prompt|stop|subagent-stop|session-end>
 *
 * Wired in the project's `.claude/settings.json`, which Grok consumes too
 * (`[compat.claude] hooks = true`), so both agents report through one file.
 * It reads the hook's JSON from stdin, turns it into a report line through
 * `report.mjs`, and prints `{}` — nothing else ever reaches stdout, because
 * Claude parses it. It always exits 0: a reporting failure must never block
 * a prompt or a stop.
 *
 * What each event becomes:
 *   session-start  → `start` with a placeholder title and the machine's
 *                    `hooksInventory` (scripts/ops/hooks-inventory.mjs)
 *   prompt         → first prompt: title + request. Later prompts: a `note`
 *   stop           → `progress` whose `summary` is the last assistant text and
 *                    whose `changes` is `git diff --stat` plus the changed
 *                    paths, so a running task always carries a current
 *                    explanation of where it stands
 *   subagent-stop  → `note`
 *   session-end    → a digest of the transcript (first prompt, last two
 *                    assistant texts, files edited, commits, tool counts)
 *                    POSTed to the summarize route, where a model writes the
 *                    Hebrew summary. Unreachable → spooled under
 *                    `~/.lions-ops/spool-digests/` for the next flush. Then,
 *                    unless a finish was recorded, a `note` "ended without a
 *                    finish". Status is left alone: a task is completed only
 *                    by an explicit finish.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { basename } from "node:path";
import { buildDigestFromTranscript, commitsSince, defaultTaskKey, readTaskState, rememberCurrentSession, reportEvent, resolveIdentity, sendDigest, writeTaskState } from "./report.mjs";

const HOOK_TIMEOUT_MS = 5000;
const DIGEST_TIMEOUT_MS = 8000;
const SUMMARY_MAX = 16000;
const CHANGES_MAX = 8000;
const CHANGED_FILES_MAX = 40;

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

function gitOut(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 }).trim();
  } catch {
    return null;
  }
}

function diffStat(cwd) {
  const out = gitOut(["diff", "--stat", "HEAD"], cwd);
  if (out == null) return null;
  return out ? out.split("\n").at(-1).trim() : "no uncommitted changes";
}

/** The `changes` field: the stat summary line, then up to 40 changed paths (tracked and untracked). */
function changesText(cwd) {
  const stat = diffStat(cwd);
  if (stat == null) return null;
  const tracked = (gitOut(["diff", "--name-only", "HEAD"], cwd) ?? "").split("\n").filter(Boolean);
  const untracked = (gitOut(["ls-files", "--others", "--exclude-standard"], cwd) ?? "").split("\n").filter(Boolean);
  const files = [...new Set([...tracked, ...untracked])];
  const lines = [`git diff --stat: ${stat}`, ...files.slice(0, CHANGED_FILES_MAX).map((f) => `- ${f}`)];
  if (files.length > CHANGED_FILES_MAX) lines.push(`- … ועוד ${files.length - CHANGED_FILES_MAX} קבצים`);
  return lines.join("\n").slice(0, CHANGES_MAX);
}

/** Last assistant text in a Claude transcript, reading only the file's tail. */
function lastAssistantText(transcriptPath, maxChars = 1500) {
  if (!transcriptPath) return null;
  try {
    const size = statSync(transcriptPath).size;
    const window = Math.min(size, 2 * 1024 * 1024);
    const fd = openSync(transcriptPath, "r");
    const buffer = Buffer.alloc(window);
    readSync(fd, buffer, 0, window, size - window);
    closeSync(fd);
    const lines = buffer.toString("utf8").split("\n").reverse();
    for (const line of lines) {
      if (!line.includes('"assistant"')) continue;
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (entry.type !== "assistant" || entry.isSidechain) continue;
      const content = entry.message?.content;
      const text = Array.isArray(content)
        ? content.filter((part) => part?.type === "text" && part.text).map((part) => part.text).join("\n")
        : typeof content === "string" ? content : "";
      if (text.trim()) return text.trim().slice(0, maxChars);
    }
  } catch {
    /* best effort */
  }
  return null;
}

async function collectInventory(identity) {
  try {
    const { collectHooksInventory } = await import("./hooks-inventory.mjs");
    return collectHooksInventory({ repoRoot: process.env.CLAUDE_PROJECT_DIR || identity.cwd, agent: identity.agent });
  } catch (error) {
    process.stderr.write(`[ops-hook] hooks inventory skipped: ${error?.message ?? error}\n`);
    return undefined;
  }
}

async function run(subcommand, input) {
  const cwd = input.cwd || process.cwd();
  const sessionId = input.session_id || null;
  const identity = resolveIdentity({ cwd });
  const taskKey = process.env.OPS_TASK_KEY?.trim() || (sessionId ? `${identity.agent}:${sessionId}` : defaultTaskKey(identity).taskKey);
  const options = { identity, taskKey, timeoutMs: HOOK_TIMEOUT_MS };
  const state = readTaskState(taskKey);
  const baseMeta = { branch: identity.branch, sessionId, hook: input.hook_event_name ?? subcommand };

  switch (subcommand) {
    case "session-start": {
      rememberCurrentSession(cwd, { taskKey, sessionId, agent: identity.agent });
      writeTaskState(taskKey, { started: true, startedAt: new Date().toISOString(), titled: false, finished: false, prompts: 0 });
      const hooksInventory = await collectInventory(identity);
      await reportEvent("start", {
        title: `סשן ${identity.agent} – ${basename(cwd)}`,
        kind: "code",
        status: "running",
        meta: { ...baseMeta, source: input.source },
        hooksInventory,
      }, options);
      return;
    }
    case "prompt": {
      const prompt = String(input.prompt ?? "").trim();
      if (!prompt) return;
      rememberCurrentSession(cwd, { taskKey, sessionId, agent: identity.agent });
      const prompts = (state.prompts ?? 0) + 1;
      if (!state.titled) {
        writeTaskState(taskKey, { titled: true, prompts });
        await reportEvent("progress", { title: prompt.slice(0, 120), request: prompt.slice(0, 4000), status: "running", meta: baseMeta }, options);
      } else {
        writeTaskState(taskKey, { prompts });
        await reportEvent("note", { message: `הנחיה נוספת (#${prompts}): ${prompt.slice(0, 1200)}`, meta: baseMeta }, options);
      }
      return;
    }
    case "stop": {
      const text = lastAssistantText(input.transcript_path, SUMMARY_MAX);
      const changes = changesText(cwd);
      const message = [text ? text.slice(0, 1500) : null, changes ? changes.split("\n")[0] : null].filter(Boolean).join("\n\n") || "turn ended";
      const fields = { message, meta: baseMeta };
      if (text) fields.summary = text;
      if (changes) fields.changes = changes;
      await reportEvent("progress", fields, options);
      return;
    }
    case "subagent-stop": {
      await reportEvent("note", { message: "sub-agent finished", meta: { ...baseMeta, agentId: input.agent_id ?? undefined } }, options);
      return;
    }
    case "session-end": {
      if (input.transcript_path) {
        const digest = buildDigestFromTranscript(input.transcript_path, { taskKey });
        if (digest.error) process.stderr.write(`[ops-hook] digest skipped: ${digest.error}\n`);
        else if (digest.lastAssistant || digest.request) {
          if (!digest.commits?.length && state.startedAt) digest.commits = commitsSince(cwd, state.startedAt);
          const result = await sendDigest(digest, { timeoutMs: DIGEST_TIMEOUT_MS });
          if (!result.sent) process.stderr.write(`[ops-hook] digest ${result.spooled ? "spooled" : "rejected"}: ${result.error ?? ""}\n`);
          writeTaskState(taskKey, { digestSentAt: result.sent ? new Date().toISOString() : undefined, digestSpooled: result.spooled || undefined });
        }
      }
      if (state.finished) return;
      await reportEvent("note", {
        message: "הסשן הסתיים ללא דוח סיום",
        meta: { ...baseMeta, sessionEnded: true, reason: input.reason ?? undefined },
      }, options);
      return;
    }
    default:
      process.stderr.write(`[ops-hook] unknown subcommand "${subcommand}"\n`);
  }
}

const subcommand = process.argv[2];
const input = readStdin();
run(subcommand, input)
  .catch((error) => process.stderr.write(`[ops-hook] ${error?.message ?? error}\n`))
  .finally(() => {
    process.stdout.write("{}\n");
    process.exit(0);
  });
