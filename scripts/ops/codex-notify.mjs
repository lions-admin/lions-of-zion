#!/usr/bin/env node
/**
 * Codex `notify` wrapper: report the turn to the operations board, then hand
 * the same arguments to the client Codex was calling before this existed.
 *
 * `~/.codex/config.toml` used to read
 *   notify = ["<SkyComputerUseClient>", "turn-ended"]
 * and now reads
 *   notify = ["node", "<primary checkout>/scripts/ops/codex-notify.mjs"]
 * Codex appends one JSON argument to whatever is configured, so the original
 * call was `<client> turn-ended <json>` and this script reproduces it exactly
 * after reporting. Its exit code is the client's exit code, so nothing about
 * Codex's own behaviour changes; only Codex threads whose cwd is inside a
 * lions-of-zion checkout are reported at all.
 *
 * The payload Codex sends today:
 *   { type: "agent-turn-complete", "thread-id", "turn-id", cwd,
 *     "input-messages": [...], "last-assistant-message": "…" }
 * Every key is treated as optional.
 */
import { spawnSync } from "node:child_process";
import { existsSync } from "node:fs";
import { readTaskState, reportEvent, resolveIdentity, writeTaskState } from "./report.mjs";

const ORIGINAL_CLIENT = "/Users/danielsmac/.codex/computer-use/Codex Computer Use.app/Contents/SharedSupport/SkyComputerUseClient.app/Contents/MacOS/SkyComputerUseClient";
const ORIGINAL_ARGS = ["turn-ended"];

function parsePayload(raw) {
  try {
    const parsed = JSON.parse(raw ?? "{}");
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

async function report(payload) {
  const cwd = typeof payload.cwd === "string" ? payload.cwd : "";
  if (!cwd.includes("lions-of-zion")) return;
  const threadId = payload["thread-id"] ?? payload.thread_id ?? payload.threadId;
  if (!threadId) return;

  const identity = resolveIdentity({ cwd, env: { ...process.env, LIONS_AI: "codex" } });
  const taskKey = `codex:${threadId}`;
  const state = readTaskState(taskKey);
  const inputs = Array.isArray(payload["input-messages"]) ? payload["input-messages"] : [];
  const firstInput = inputs.map((m) => (typeof m === "string" ? m : m?.text ?? m?.content ?? "")).find((m) => String(m).trim());
  const last = String(payload["last-assistant-message"] ?? "").trim().slice(0, 1500);
  const meta = { branch: identity.branch, threadId, turnId: payload["turn-id"] ?? undefined, type: payload.type ?? undefined };

  const fields = { message: last || "turn ended", meta, status: "running" };
  if (!state.titled && firstInput) {
    fields.title = String(firstInput).trim().slice(0, 120);
    fields.request = String(firstInput).trim().slice(0, 4000);
    fields.kind = "code";
  }
  await reportEvent("progress", fields, { identity, taskKey, timeoutMs: 5000 });
  if (fields.title) writeTaskState(taskKey, { titled: true });
}

function forward(args) {
  if (!existsSync(ORIGINAL_CLIENT)) {
    process.stderr.write(`[codex-notify] original client missing, nothing forwarded: ${ORIGINAL_CLIENT}\n`);
    return 0;
  }
  const result = spawnSync(ORIGINAL_CLIENT, [...ORIGINAL_ARGS, ...args], { stdio: "inherit" });
  if (result.error) {
    process.stderr.write(`[codex-notify] could not run the original client: ${result.error.message}\n`);
    return 0;
  }
  return result.status ?? 0;
}

const args = process.argv.slice(2);
report(parsePayload(args[0]))
  .catch((error) => process.stderr.write(`[codex-notify] ${error?.message ?? error}\n`))
  .finally(() => process.exit(forward(args)));
