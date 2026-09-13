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
 *   session-start  → `start` with a placeholder title; the first prompt names it
 *   prompt         → first prompt: title + request. Later prompts: a `note`
 *   stop           → `progress` with the last assistant text and `git diff --stat`
 *   subagent-stop  → `note`
 *   session-end    → `note` "ended without a finish" + meta.sessionEnded, unless
 *                    a finish was recorded for this task. Status is left alone:
 *                    a task is completed only by an explicit finish.
 */
import { execFileSync } from "node:child_process";
import { readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { basename } from "node:path";
import { defaultTaskKey, readTaskState, rememberCurrentSession, reportEvent, resolveIdentity, writeTaskState } from "./report.mjs";

const HOOK_TIMEOUT_MS = 5000;

function readStdin() {
  try {
    return JSON.parse(readFileSync(0, "utf8") || "{}");
  } catch {
    return {};
  }
}

function diffStat(cwd) {
  try {
    const out = execFileSync("git", ["diff", "--stat", "HEAD"], { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 }).trim();
    return out ? out.split("\n").at(-1).trim() : "no uncommitted changes";
  } catch {
    return null;
  }
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
      writeTaskState(taskKey, { started: true, titled: false, finished: false, prompts: 0 });
      await reportEvent("start", {
        title: `סשן ${identity.agent} – ${basename(cwd)}`,
        kind: "code",
        status: "running",
        meta: { ...baseMeta, source: input.source },
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
      const parts = [];
      const text = lastAssistantText(input.transcript_path);
      if (text) parts.push(text);
      const stat = diffStat(cwd);
      if (stat) parts.push(`git diff --stat: ${stat}`);
      if (!parts.length) parts.push("turn ended");
      await reportEvent("progress", { message: parts.join("\n\n"), meta: baseMeta }, options);
      return;
    }
    case "subagent-stop": {
      await reportEvent("note", { message: "sub-agent finished", meta: { ...baseMeta, agentId: input.agent_id ?? undefined } }, options);
      return;
    }
    case "session-end": {
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
