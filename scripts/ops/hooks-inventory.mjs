#!/usr/bin/env node
/**
 * What automation is wired on this machine and in this repository — the
 * "הוקים ואוטומציות" section of a task on the operations board.
 *
 *   npm run ops:hooks                      # JSON for the current agent
 *   node scripts/ops/hooks-inventory.mjs --agent codex --repo /path
 *
 * `collectHooksInventory({ repoRoot, agent })` reads every hook surface the
 * five agents and the infrastructure have, and reports what it actually
 * finds — a missing file is `status: "none"` with a note saying so, never a
 * throw and never a guess dressed as a fact. The shape is the contract's
 * `hooksInventory`: tools (≤20) × hooks (≤60), every string clipped, the
 * whole thing under 64KB. Zero dependencies, because the SessionStart hook
 * calls it before `node_modules` is guaranteed to exist.
 *
 * Config formats are parsed just enough: Claude/Gemini/OpenCode settings are
 * JSON; Codex and Grok are TOML read line by line (one `notify = [...]`
 * array, one `[compat.claude]` table); workflows are YAML scanned for the
 * top-level `on:` and `jobs:` keys. None of that needs a parser to be right
 * about the questions asked here.
 */
import { execFileSync } from "node:child_process";
import { existsSync, readdirSync, readFileSync, readlinkSync, statSync } from "node:fs";
import { homedir, hostname } from "node:os";
import { basename, dirname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const HOME = homedir();
const LIMITS = { id: 40, label: 80, note: 600, event: 80, command: 600, source: 300, hooksPerTool: 60, tools: 20, totalBytes: 64 * 1024 };
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

const tilde = (path) => (path.startsWith(HOME) ? `~${path.slice(HOME.length)}` : path);
const clip = (value, max) => (value == null ? undefined : String(value).replace(/\s+/g, " ").trim().slice(0, max));
const exists = (path) => {
  try {
    return existsSync(path);
  } catch {
    return false;
  }
};

function readText(path) {
  try {
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function readJson(path) {
  const text = readText(path);
  if (text == null) return null;
  try {
    return JSON.parse(text.replace(/^\s*\/\/.*$/gm, ""));
  } catch {
    return undefined;
  }
}

function git(args, cwd) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 3000 }).trim();
  } catch {
    return null;
  }
}

function hook({ event, command, source, timeout, enabled, note }) {
  const out = { event: clip(event, LIMITS.event) || "?", command: clip(command, LIMITS.command) || "", source: clip(source, LIMITS.source) || "" };
  if (Number.isFinite(timeout)) out.timeout = timeout;
  if (typeof enabled === "boolean") out.enabled = enabled;
  if (note) out.note = clip(note, LIMITS.note);
  return out;
}

function tool({ id, label, status, configPath, note, hooks = [] }) {
  const out = { id: clip(id, LIMITS.id), label: clip(label, LIMITS.label), status: ["active", "partial", "none"].includes(status) ? status : "none", hooks: hooks.slice(0, LIMITS.hooksPerTool) };
  if (configPath) out.configPath = clip(configPath, LIMITS.source);
  if (note) out.note = clip(note, LIMITS.note);
  if (hooks.length > LIMITS.hooksPerTool) out.note = clip(`${out.note ? `${out.note} · ` : ""}מוצגים ${LIMITS.hooksPerTool} מתוך ${hooks.length}`, LIMITS.note);
  return out;
}

/* ── Claude settings (also what Grok consumes) ─────────────────────────── */

/** `hooks: { Event: [ { matcher?, hooks: [ { type, command, timeout } ] } ] }` → flat list. */
function claudeHooks(settings, source) {
  const out = [];
  const hooks = settings?.hooks;
  if (!hooks || typeof hooks !== "object") return out;
  for (const [event, groups] of Object.entries(hooks)) {
    if (!Array.isArray(groups)) continue;
    for (const group of groups) {
      const label = group?.matcher ? `${event}[${group.matcher}]` : event;
      for (const entry of Array.isArray(group?.hooks) ? group.hooks : []) {
        const command = entry?.type === "command" ? entry.command : entry?.type ? `${entry.type}: ${entry.prompt ?? entry.command ?? ""}` : "";
        out.push(hook({ event: label, command, source, timeout: entry?.timeout, note: entry?.statusMessage }));
      }
    }
  }
  return out;
}

function claudeTool(id, label, path, { extraNote } = {}) {
  const shown = tilde(path);
  if (!exists(path)) return tool({ id, label, status: "none", configPath: shown, note: `הקובץ ${shown} לא קיים` });
  const settings = readJson(path);
  if (settings === undefined) return tool({ id, label, status: "none", configPath: shown, note: `הקובץ ${shown} אינו JSON תקין` });
  const hooks = claudeHooks(settings, shown);
  if (settings?.disableAllHooks) return tool({ id, label, status: "none", configPath: shown, note: "disableAllHooks מופעל — שום hook לא רץ", hooks: hooks.map((h) => ({ ...h, enabled: false })) });
  if (!hooks.length) return tool({ id, label, status: "none", configPath: shown, note: `אין hooks מוגדרים ב-${shown}` });
  return tool({ id, label, status: "active", configPath: shown, note: extraNote, hooks });
}

/* ── TOML, read just enough ────────────────────────────────────────────── */

/** The value of `key = ...` at the top level (before the first `[table]`), or inside a named table. */
function tomlValue(text, key, table = null) {
  let current = null;
  for (const raw of text.split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const header = line.match(/^\[([^\]]+)\]$/);
    if (header) {
      current = header[1].trim();
      continue;
    }
    if (current !== table) continue;
    const match = line.match(/^([A-Za-z0-9_.-]+)\s*=\s*(.+)$/);
    if (match && match[1] === key) return match[2].replace(/\s+#.*$/, "").trim();
  }
  return undefined;
}

function tomlStringArray(value) {
  if (!value || !value.startsWith("[")) return null;
  return [...value.matchAll(/"((?:[^"\\]|\\.)*)"/g)].map((m) => m[1].replace(/\\"/g, '"'));
}

function grokTool(claudeMachine, claudeProject) {
  const path = join(HOME, ".grok", "config.toml");
  const shown = tilde(path);
  const text = readText(path);
  let enabled = true;
  let note;
  if (text == null) {
    note = `הקובץ ${shown} לא קיים; לפי התיעוד ברירת המחדל היא [compat.claude] hooks = true, ולכן Grok משתמש ב-hooks של Claude דרך compat — הנחה מתועדת, לא נמדדה`;
  } else {
    const value = tomlValue(text, "hooks", "compat.claude");
    enabled = value === undefined ? true : /^true$/i.test(value);
    note = enabled
      ? `משתמש ב-hooks של Claude דרך compat${value === undefined ? " (ברירת המחדל, לא נכתב במפורש)" : ""}`
      : "[compat.claude] hooks = false — Grok לא מריץ את ה-hooks של Claude";
  }
  const grokDir = join(HOME, ".grok");
  if (!exists(grokDir)) return tool({ id: "grok", label: "Grok Build", status: "none", configPath: shown, note: "~/.grok לא קיים — Grok לא מותקן במכונה הזו" });
  if (!enabled) return tool({ id: "grok", label: "Grok Build", status: "none", configPath: shown, note });
  const hooks = [...claudeMachine.hooks, ...claudeProject.hooks].map((h) => hook({ ...h, source: `${h.source} (דרך compat.claude)` }));
  if (!hooks.length) return tool({ id: "grok", label: "Grok Build", status: "partial", configPath: shown, note: `${note}; אבל לא נמצאו hooks של Claude להריץ` });
  return tool({ id: "grok", label: "Grok Build", status: "active", configPath: shown, note, hooks });
}

function codexTool() {
  const path = join(HOME, ".codex", "config.toml");
  const shown = tilde(path);
  const text = readText(path);
  if (text == null) return tool({ id: "codex", label: "Codex", status: "none", configPath: shown, note: `הקובץ ${shown} לא קיים — Codex אינו מוגדר במכונה הזו` });
  const value = tomlValue(text, "notify");
  const parts = tomlStringArray(value);
  if (!parts?.length) return tool({ id: "codex", label: "Codex", status: "none", configPath: shown, note: "אין שורת notify ב-config.toml; Codex מדווח רק דרך קומיטים ו-CLI" });
  const command = parts.join(" ");
  const wrapped = command.includes("scripts/ops/codex-notify.mjs");
  const target = parts.find((p) => p.includes("codex-notify.mjs"));
  const targetExists = target ? exists(target) : false;
  const hooks = [hook({ event: "turn-ended", command, source: shown, enabled: wrapped ? targetExists : true, note: wrapped ? (targetExists ? "עטיפת הדיווח של הלוח; מעבירה הלאה ללקוח המקורי" : `הסקריפט ${target} לא נמצא — ה-notify יכשל בשקט`) : "notify לא עטוף בדיווח ללוח" })];
  if (wrapped && targetExists) return tool({ id: "codex", label: "Codex", status: "active", configPath: shown, note: "מדווח progress בסוף כל תור דרך notify; אין SessionStart, ולכן אין start אוטומטי", hooks });
  if (wrapped) return tool({ id: "codex", label: "Codex", status: "partial", configPath: shown, note: `notify מצביע על ${target}, אבל הקובץ לא קיים`, hooks });
  return tool({ id: "codex", label: "Codex", status: "partial", configPath: shown, note: "notify קיים אך אינו עטוף ב-scripts/ops/codex-notify.mjs; הלוח מקבל רק קומיטים ו-CLI", hooks });
}

/* ── OpenCode, Gemini AGY ──────────────────────────────────────────────── */

const NO_HOOK_SURFACE = "אין ממשק hooks; מדווח רק דרך קומיטים ו-CLI";

function opencodeTool() {
  const dir = join(HOME, ".config", "opencode");
  const candidates = ["opencode.json", "opencode.jsonc", "config.json"].map((n) => join(dir, n));
  const path = candidates.find(exists);
  if (!path) return tool({ id: "opencode", label: "OpenCode", status: "none", configPath: tilde(candidates[0]), note: `${NO_HOOK_SURFACE}. אין קובץ הגדרות ב-${tilde(dir)}` });
  const config = readJson(path);
  const shown = tilde(path);
  if (config === undefined) return tool({ id: "opencode", label: "OpenCode", status: "none", configPath: shown, note: `${NO_HOOK_SURFACE}. ${shown} אינו JSON תקין` });
  const hooks = [];
  const plugins = Array.isArray(config?.plugin) ? config.plugin : Array.isArray(config?.plugins) ? config.plugins : [];
  for (const plugin of plugins) hooks.push(hook({ event: "plugin", command: typeof plugin === "string" ? plugin : JSON.stringify(plugin), source: shown }));
  if (config?.hooks && typeof config.hooks === "object") {
    for (const [event, value] of Object.entries(config.hooks)) hooks.push(hook({ event, command: typeof value === "string" ? value : JSON.stringify(value), source: shown }));
  }
  if (!hooks.length) return tool({ id: "opencode", label: "OpenCode", status: "none", configPath: shown, note: `${NO_HOOK_SURFACE}. ${shown} קיים ללא plugins או hooks` });
  return tool({ id: "opencode", label: "OpenCode", status: "partial", configPath: shown, note: "plugins/hooks מוגדרים, אך אף אחד מהם אינו מדווח ללוח; הדיווח נשאר דרך קומיטים ו-CLI", hooks });
}

function geminiTool() {
  const path = join(HOME, ".gemini", "settings.json");
  const shown = tilde(path);
  if (!exists(path)) return tool({ id: "gemini-agy", label: "Gemini AGY (Antigravity)", status: "none", configPath: shown, note: `${NO_HOOK_SURFACE}. ${shown} לא קיים` });
  const settings = readJson(path);
  if (settings === undefined) return tool({ id: "gemini-agy", label: "Gemini AGY (Antigravity)", status: "none", configPath: shown, note: `${NO_HOOK_SURFACE}. ${shown} אינו JSON תקין` });
  const hooks = settings?.hooks && typeof settings.hooks === "object" ? claudeHooks(settings, shown) : [];
  if (!hooks.length) return tool({ id: "gemini-agy", label: "Gemini AGY (Antigravity)", status: "none", configPath: shown, note: `${NO_HOOK_SURFACE}. ${shown} קיים ללא hooks` });
  return tool({ id: "gemini-agy", label: "Gemini AGY (Antigravity)", status: "partial", configPath: shown, note: "hooks מוגדרים, אך אינם מדווחים ללוח; הדיווח נשאר דרך קומיטים ו-CLI", hooks });
}

/* ── git hooks ─────────────────────────────────────────────────────────── */

function firstComment(text) {
  for (const raw of (text ?? "").split("\n").slice(0, 12)) {
    const line = raw.trim();
    if (!line || line.startsWith("#!")) continue;
    if (line.startsWith("#")) return line.replace(/^#+\s?/, "");
    break;
  }
  return undefined;
}

function gitTool(repoRoot) {
  const configured = git(["config", "--get", "core.hooksPath"], repoRoot) ?? git(["config", "--global", "--get", "core.hooksPath"], repoRoot);
  const dir = configured ? resolve(configured.replace(/^~(?=\/|$)/, HOME)) : join(repoRoot, ".git", "hooks");
  const shown = tilde(dir);
  const scope = configured ? "core.hooksPath — חל על כל ריפו וכל סוכן ואדם במכונה" : "hooks של הריפו בלבד (אין core.hooksPath)";
  if (!exists(dir)) return tool({ id: "git", label: "Git hooks", status: "none", configPath: shown, note: `${scope}; התיקייה ${shown} לא קיימת` });
  const hooks = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.endsWith(".sample") || entry.name.startsWith(".")) continue;
    const path = join(dir, entry.name);
    let stat;
    try {
      stat = statSync(path);
    } catch {
      continue;
    }
    if (!stat.isFile()) continue;
    const executable = (stat.mode & 0o111) !== 0;
    const text = readText(path);
    hooks.push(hook({ event: entry.name, command: entry.isSymbolicLink() ? `${path} → ${tilde(resolve(dir, readLink(path)))}` : path, source: shown, enabled: executable, note: firstComment(text) ?? (executable ? undefined : "לא ניתן להרצה (chmod)") }));
  }
  if (!hooks.length) return tool({ id: "git", label: "Git hooks", status: "none", configPath: shown, note: `${scope}; אין קובצי hook ב-${shown}` });
  const active = hooks.some((h) => h.enabled);
  const reports = hooks.some((h) => h.event === "post-commit" && h.enabled);
  return tool({ id: "git", label: "Git hooks", status: active ? (reports ? "active" : "partial") : "none", configPath: shown, note: `${scope}${reports ? "; post-commit מדווח כל קומיט ללוח" : "; אין post-commit שמדווח ללוח"}`, hooks });
}

function readLink(path) {
  try {
    return readlinkSync(path);
  } catch {
    return path;
  }
}

/* ── GitHub Actions ────────────────────────────────────────────────────── */

/** Keys of a top-level YAML block (`on:` / `jobs:`) — the two-space-indented `name:` lines under it. */
function yamlBlockKeys(text, key) {
  const lines = text.split("\n");
  const start = lines.findIndex((l) => new RegExp(`^${key}:\\s*(#.*)?$`).test(l));
  if (start === -1) {
    const inline = lines.find((l) => new RegExp(`^${key}:\\s*\\[`).test(l));
    if (inline) return inline.replace(/^[^[]*\[/, "").replace(/\].*$/, "").split(",").map((s) => s.trim()).filter(Boolean);
    const scalar = lines.find((l) => new RegExp(`^${key}:\\s*\\S`).test(l));
    return scalar ? [scalar.split(":").slice(1).join(":").trim()] : [];
  }
  const keys = [];
  for (const line of lines.slice(start + 1)) {
    if (/^\S/.test(line) && line.trim() && !line.trim().startsWith("#")) break;
    const match = line.match(/^ {2}([A-Za-z0-9_-]+):/);
    if (match) keys.push(match[1]);
  }
  return keys;
}

function workflowsTool(repoRoot) {
  const dir = join(repoRoot, ".github", "workflows");
  const shown = relative(repoRoot, dir) || dir;
  if (!exists(dir)) return tool({ id: "github-actions", label: "GitHub Actions", status: "none", configPath: shown, note: "אין תיקיית .github/workflows" });
  const hooks = [];
  let files = 0;
  for (const name of readdirSync(dir).filter((n) => /\.ya?ml$/.test(n)).sort()) {
    const path = join(dir, name);
    const text = readText(path);
    if (text == null) continue;
    files += 1;
    const source = `${shown}/${name}`;
    const title = text.match(/^name:\s*(.+)$/m)?.[1]?.trim().replace(/^["']|["']$/g, "") ?? name;
    const triggers = yamlBlockKeys(text, "on");
    const jobs = yamlBlockKeys(text, "jobs");
    const command = `jobs: ${jobs.join(", ") || "—"}`;
    if (!triggers.length) hooks.push(hook({ event: `${title}: ?`, command, source, note: "לא זוהה טריגר on:" }));
    for (const trigger of triggers) hooks.push(hook({ event: `${title}: ${trigger}`, command, source }));
  }
  if (!files) return tool({ id: "github-actions", label: "GitHub Actions", status: "none", configPath: shown, note: "אין קובצי workflow" });
  const scheduled = hooks.some((h) => h.event.endsWith(": schedule"));
  return tool({ id: "github-actions", label: "GitHub Actions", status: "active", configPath: shown, note: `${files} workflows; ${scheduled ? "יש לוח זמנים (schedule)" : "אין schedule — הכול ידני או על push/PR"}`, hooks });
}

/* ── Vercel ────────────────────────────────────────────────────────────── */

function vercelTool(repoRoot) {
  const path = join(repoRoot, "vercel.json");
  const shown = "vercel.json";
  if (!exists(path)) return tool({ id: "vercel", label: "Vercel", status: "none", configPath: shown, note: "אין vercel.json" });
  const config = readJson(path);
  if (config === undefined) return tool({ id: "vercel", label: "Vercel", status: "none", configPath: shown, note: "vercel.json אינו JSON תקין" });
  const hooks = [];
  if (config.ignoreCommand) hooks.push(hook({ event: "ignoreCommand", command: config.ignoreCommand, source: shown, note: "מדלג על build לכל ענף שאינו main" }));
  const disabled = Object.entries(config.git?.deploymentEnabled ?? {}).filter(([, v]) => v === false).map(([k]) => k);
  if (disabled.length) hooks.push(hook({ event: "git.deploymentEnabled=false", command: disabled.join(", "), source: shown, note: "ענפים שלא יוצרים deployment בכלל" }));
  for (const [route, fn] of Object.entries(config.functions ?? {})) {
    for (const trigger of Array.isArray(fn?.experimentalTriggers) ? fn.experimentalTriggers : []) {
      hooks.push(hook({ event: `${trigger.type ?? "trigger"}:${trigger.topic ?? "?"}`, command: route, source: shown, note: trigger.retryAfterSeconds ? `retryAfterSeconds=${trigger.retryAfterSeconds}` : undefined }));
    }
  }
  for (const cron of Array.isArray(config.crons) ? config.crons : []) hooks.push(hook({ event: `cron ${cron.schedule ?? "?"}`, command: cron.path ?? "", source: shown }));
  const crons = Array.isArray(config.crons) ? config.crons.length : 0;
  if (!hooks.length) return tool({ id: "vercel", label: "Vercel", status: "none", configPath: shown, note: "vercel.json ללא ignoreCommand, טריגרים או crons" });
  return tool({ id: "vercel", label: "Vercel", status: "active", configPath: shown, note: crons ? `${crons} crons` : "אין crons (הנחיית הבעלים 2026-09-08); push ל-main = Production", hooks });
}

/* ── MCP ───────────────────────────────────────────────────────────────── */

function mcpTool(repoRoot) {
  const path = join(repoRoot, ".mcp.json");
  const shown = ".mcp.json";
  if (!exists(path)) return tool({ id: "mcp", label: "שרתי MCP של הריפו", status: "none", configPath: shown, note: "אין .mcp.json" });
  const config = readJson(path);
  if (config === undefined) return tool({ id: "mcp", label: "שרתי MCP של הריפו", status: "none", configPath: shown, note: ".mcp.json אינו JSON תקין" });
  const hooks = [];
  for (const [name, server] of Object.entries(config.mcpServers ?? {})) {
    const command = server?.url ?? [server?.command, ...(Array.isArray(server?.args) ? server.args : [])].filter(Boolean).join(" ");
    hooks.push(hook({ event: name, command, source: shown, note: server?.type ? `type=${server.type}` : undefined }));
  }
  if (!hooks.length) return tool({ id: "mcp", label: "שרתי MCP של הריפו", status: "none", configPath: shown, note: "אין mcpServers ב-.mcp.json" });
  return tool({ id: "mcp", label: "שרתי MCP של הריפו", status: "active", configPath: shown, note: "מגיע עם ה-checkout לכל חמשת הסוכנים", hooks });
}

/* ── assembly ──────────────────────────────────────────────────────────── */

function findRepoRoot(start) {
  return git(["rev-parse", "--show-toplevel"], start) ?? resolve(dirname(fileURLToPath(import.meta.url)), "..", "..");
}

/** Shrink notes and commands until the serialized inventory fits the contract. */
function fitToBudget(inventory) {
  const size = () => Buffer.byteLength(JSON.stringify(inventory));
  if (size() <= LIMITS.totalBytes) return inventory;
  for (const t of inventory.tools) for (const h of t.hooks) delete h.note;
  if (size() <= LIMITS.totalBytes) return inventory;
  for (const t of inventory.tools) for (const h of t.hooks) h.command = h.command.slice(0, 120);
  if (size() <= LIMITS.totalBytes) return inventory;
  for (const t of inventory.tools) t.hooks = t.hooks.slice(0, 10);
  return inventory;
}

/**
 * Every tool, in the order the board shows them. Each collector is wrapped so
 * one surprise (a permission error, an odd file) costs one entry, not the
 * inventory.
 */
export function collectHooksInventory({ repoRoot, agent = "unknown" } = {}) {
  const root = repoRoot ? resolve(repoRoot) : findRepoRoot(process.cwd());
  const safe = (id, label, fn) => {
    try {
      return fn();
    } catch (error) {
      return tool({ id, label, status: "none", note: `שגיאה באיסוף: ${error?.message ?? error}` });
    }
  };
  const claudeMachine = safe("claude-machine", "Claude Code — הגדרות המכונה", () => claudeTool("claude-machine", "Claude Code — הגדרות המכונה", join(HOME, ".claude", "settings.json")));
  const claudeProject = safe("claude-project", "Claude Code — הגדרות הריפו", () => claudeTool("claude-project", "Claude Code — הגדרות הריפו", join(root, ".claude", "settings.json"), { extraNote: "מדווח ללוח: SessionStart, UserPromptSubmit, Stop, SubagentStop, SessionEnd" }));
  const tools = [
    claudeMachine,
    claudeProject,
    safe("grok", "Grok Build", () => grokTool(claudeMachine, claudeProject)),
    safe("codex", "Codex", codexTool),
    safe("opencode", "OpenCode", opencodeTool),
    safe("gemini-agy", "Gemini AGY (Antigravity)", geminiTool),
    safe("git", "Git hooks", () => gitTool(root)),
    safe("github-actions", "GitHub Actions", () => workflowsTool(root)),
    safe("vercel", "Vercel", () => vercelTool(root)),
    safe("mcp", "שרתי MCP של הריפו", () => mcpTool(root)),
  ].slice(0, LIMITS.tools);
  return fitToBudget({ collectedAt: new Date().toISOString(), hostname: hostname(), agent, tools });
}

if (isMain) {
  const argv = process.argv.slice(2);
  const flag = (name) => {
    const index = argv.indexOf(`--${name}`);
    return index === -1 ? undefined : argv[index + 1];
  };
  if (argv.includes("--help") || argv.includes("-h")) {
    console.log("usage: hooks-inventory.mjs [--agent NAME] [--repo PATH] [--summary]");
    process.exit(0);
  }
  let agent = flag("agent");
  if (!agent) {
    try {
      const { resolveIdentity } = await import("./report.mjs");
      agent = resolveIdentity().agent;
    } catch {
      agent = "unknown";
    }
  }
  const inventory = collectHooksInventory({ repoRoot: flag("repo"), agent });
  if (argv.includes("--summary")) {
    for (const t of inventory.tools) console.log(`${t.status.padEnd(8)} ${t.id.padEnd(16)} ${String(t.hooks.length).padStart(3)} hooks  ${t.note ?? ""}`);
  } else {
    console.log(JSON.stringify(inventory, null, 2));
  }
  process.exit(0);
}
