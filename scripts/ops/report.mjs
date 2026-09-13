#!/usr/bin/env node
/**
 * Report a task to the operations board — from any agent, any shell, offline.
 *
 *   npm run ops:report -- start  --title "…" --request "…" [--kind code]
 *   npm run ops:report -- progress --message "…"
 *   npm run ops:report -- finish --summary "…" --changes "…" [--status failed]
 *   npm run ops:report -- attach --file shot.png --attachment-kind after --pair hero
 *   npm run ops:report -- flush | whoami
 *
 * The contract it speaks is `server/contracts/ops-tasks.ts`; the doc every
 * agent follows is `docs/ops/task-reporting.md`. Three properties matter more
 * than the flags:
 *
 * **Offline-first.** Every line is written to `~/.lions-ops/spool/` *before*
 * any network is attempted, then the whole spool is flushed oldest-first. A
 * failure leaves the files where they are and exits 0 with one stderr line,
 * so a hook, a git hook or a CI step never fails because the site was
 * unreachable. Every line carries a random `eventKey`, which is what makes a
 * retried flush idempotent on the server.
 *
 * **Identity is resolved, never typed.** `LIONS_AI`, then the checked-out
 * `ai/*` branch, then the workspace directory name, then the CLI marker —
 * the same order as `scripts/startup-sync.mjs` — and `unknown` rather than a
 * guess. The task key defaults to the session the hooks recorded for this
 * directory, so a `finish` typed in a Claude shell lands on the task the
 * SessionStart hook opened.
 *
 * **Zero dependencies.** Node ≥ 24 only, because it runs from git hooks and
 * from Codex's notify slot where `node_modules` may not exist.
 */
import { execFileSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, renameSync, statSync, unlinkSync, writeFileSync } from "node:fs";
import { homedir, hostname as osHostname } from "node:os";
import { basename, extname, join } from "node:path";
import { fileURLToPath } from "node:url";

export const REPORTER_VERSION = "1.0.0";
export const DEFAULT_BASE_URL = "https://lionsofzion.io";

export const AGENTS = ["claude", "codex", "grok", "opencode", "gemini-agy", "chatgpt-editorial", "github-actions", "local-script", "human", "unknown"];
export const EVENTS = ["start", "progress", "status", "note", "finish", "heartbeat", "commit", "ci"];
export const KINDS = ["code", "editorial", "design", "ops", "research", "review", "import", "other"];
export const STATUSES = ["queued", "running", "waiting", "blocked", "completed", "failed", "cancelled"];
export const ATTACHMENT_KINDS = ["screenshot", "before", "after", "artifact", "file"];

/** Branch → agent, mirrored from scripts/startup-sync.mjs so this file stays dependency-free. */
const AI_BRANCHES = { claude: "ai/claude", grok: "ai/grok", codex: "ai/codex", opencode: "ai/opencode", "gemini-agy": "ai/gemini-agy" };

/* Field limits from the contract. Truncating here beats a 400 that would
   strand the spool. */
const LIMITS = { title: 300, request: 4000, goal: 2000, summary: 8000, changes: 8000, remaining: 4000, blockers: 4000, nextStep: 2000, message: 4000, environment: 300, eventKey: 120, taskKey: 200 };
const META_MAX_BYTES = 8 * 1024;
const BATCH_SIZE = 200;
export const DEFAULT_TIMEOUT_MS = 8000;

const CONTENT_TYPES = { ".png": "image/png", ".jpg": "image/jpeg", ".jpeg": "image/jpeg", ".webp": "image/webp", ".gif": "image/gif", ".pdf": "application/pdf", ".txt": "text/plain", ".md": "text/markdown", ".json": "application/json" };

export const OPS_HOME = process.env.LIONS_OPS_HOME?.trim() || join(homedir(), ".lions-ops");
export const SPOOL_DIR = join(OPS_HOME, "spool");
export const REJECTED_DIR = join(SPOOL_DIR, "rejected");
export const STATE_DIR = join(OPS_HOME, "state");
export const CAPTURES_DIR = join(OPS_HOME, "captures");
const SECRET_FILE = join(homedir(), ".config", "ai-dev", "ops-report.env");

const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

/* ── small helpers ─────────────────────────────────────────────────────── */

export function git(args, cwd = process.cwd()) {
  try {
    return execFileSync("git", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "ignore"], timeout: 4000 }).trim();
  } catch {
    return null;
  }
}

export const sha1 = (text) => createHash("sha1").update(String(text)).digest("hex");
const clip = (value, max) => (value == null ? undefined : String(value).slice(0, max));
const safeName = (key) => String(key).replace(/[^A-Za-z0-9._-]+/g, "_").slice(0, 150);
const note = (line) => process.stderr.write(`[ops-report] ${line}\n`);

function ensureDir(dir) {
  mkdirSync(dir, { recursive: true });
  return dir;
}

function readJson(path, fallback = null) {
  try {
    return JSON.parse(readFileSync(path, "utf8"));
  } catch {
    return fallback;
  }
}

/* ── configuration ─────────────────────────────────────────────────────── */

function readEnvFile(path) {
  if (!existsSync(path)) return {};
  const out = {};
  for (const raw of readFileSync(path, "utf8").split("\n")) {
    const line = raw.trim();
    if (!line || line.startsWith("#")) continue;
    const eq = line.indexOf("=");
    if (eq === -1) continue;
    const key = line.slice(0, eq).trim().replace(/^export\s+/, "");
    let value = line.slice(eq + 1).trim();
    if ((value.startsWith('"') && value.endsWith('"')) || (value.startsWith("'") && value.endsWith("'"))) value = value.slice(1, -1);
    out[key] = value;
  }
  return out;
}

/** Environment first, then `~/.config/ai-dev/ops-report.env`. The secret is never printed. */
export function loadConfig(env = process.env) {
  const file = readEnvFile(SECRET_FILE);
  const secret = env.OPS_REPORT_SECRET?.trim() || file.OPS_REPORT_SECRET?.trim() || "";
  const baseUrl = (env.OPS_REPORT_BASE_URL?.trim() || file.OPS_REPORT_BASE_URL?.trim() || DEFAULT_BASE_URL).replace(/\/+$/, "");
  return { baseUrl, secret, secretSource: env.OPS_REPORT_SECRET ? "env" : file.OPS_REPORT_SECRET ? SECRET_FILE : null };
}

/* ── identity ──────────────────────────────────────────────────────────── */

/**
 * Who is reporting. Same order as `resolveIdentity` in startup-sync.mjs, plus
 * the workspace directory (a worktree on a detached HEAD still knows whose it
 * is), and `unknown` when nothing answers.
 */
export function resolveIdentity({ env = process.env, cwd = process.cwd() } = {}) {
  const branch = git(["branch", "--show-current"], cwd) || null;
  const host = osHostname();
  const base = { branch, cwd, hostname: host, environment: clip(`${host}:${cwd}`, LIMITS.environment) };

  const declared = env.LIONS_AI?.trim().toLowerCase();
  if (declared && AGENTS.includes(declared)) return { ...base, agent: declared, source: "LIONS_AI" };

  const byBranch = Object.entries(AI_BRANCHES).find(([, b]) => b === branch);
  if (byBranch) return { ...base, agent: byBranch[0], source: "current branch" };

  const match = cwd.match(/lions-of-zion-workspaces\/([^/]+)/);
  if (match && AI_BRANCHES[match[1]]) return { ...base, agent: match[1], source: "workspace directory" };

  if (env.GITHUB_ACTIONS) return { ...base, agent: "github-actions", source: "GITHUB_ACTIONS" };
  if (env.CLAUDECODE || env.CLAUDE_CODE) return { ...base, agent: "claude", source: "CLAUDECODE" };
  if (env.CODEX_THREAD_ID || env.CODEX_HOME) return { ...base, agent: "codex", source: "CODEX_HOME" };

  return { ...base, agent: "unknown", source: "unresolved" };
}

/* ── task key and per-task state ───────────────────────────────────────── */

const statePath = (taskKey) => join(STATE_DIR, `${safeName(taskKey)}.json`);
const currentSessionPath = (cwd) => join(STATE_DIR, "current", `${sha1(cwd).slice(0, 16)}.json`);

export function readTaskState(taskKey) {
  return readJson(statePath(taskKey), {}) ?? {};
}

export function writeTaskState(taskKey, patch) {
  ensureDir(STATE_DIR);
  const next = { ...readTaskState(taskKey), ...patch, updatedAt: new Date().toISOString() };
  writeFileSync(statePath(taskKey), JSON.stringify(next, null, 2));
  return next;
}

/** The hooks call this so a CLI invoked from the same directory joins the session's task. */
export function rememberCurrentSession(cwd, info) {
  ensureDir(join(STATE_DIR, "current"));
  writeFileSync(currentSessionPath(cwd), JSON.stringify({ ...info, cwd, updatedAt: new Date().toISOString() }, null, 2));
}

export function currentSession(cwd) {
  const found = readJson(currentSessionPath(cwd));
  if (!found?.taskKey) return null;
  const ageMs = Date.now() - Date.parse(found.updatedAt ?? 0);
  return Number.isFinite(ageMs) && ageMs < 36 * 60 * 60 * 1000 ? found : null;
}

/**
 * `OPS_TASK_KEY` → the session id the CLI is running under → the session the
 * hooks recorded for this directory → a per-day, per-directory key.
 */
export function defaultTaskKey(identity, env = process.env) {
  if (env.OPS_TASK_KEY?.trim()) return { taskKey: env.OPS_TASK_KEY.trim(), source: "OPS_TASK_KEY" };
  if (env.CLAUDE_SESSION_ID) return { taskKey: `claude:${env.CLAUDE_SESSION_ID}`, source: "CLAUDE_SESSION_ID" };
  if (env.CODEX_THREAD_ID) return { taskKey: `codex:${env.CODEX_THREAD_ID}`, source: "CODEX_THREAD_ID" };
  const session = currentSession(identity.cwd);
  if (session) return { taskKey: session.taskKey, source: "session recorded by hook" };
  const day = new Date().toISOString().slice(0, 10);
  return { taskKey: `${identity.agent}:${day}-${sha1(identity.cwd).slice(0, 10)}`, source: "date + directory" };
}

/* ── building lines ────────────────────────────────────────────────────── */

function boundedMeta(meta) {
  if (!meta || typeof meta !== "object") return undefined;
  let json = JSON.stringify(meta);
  if (Buffer.byteLength(json) <= META_MAX_BYTES) return meta;
  const trimmed = {};
  for (const [key, value] of Object.entries(meta)) {
    trimmed[key] = typeof value === "string" ? value.slice(0, 500) : value;
    json = JSON.stringify(trimmed);
    if (Buffer.byteLength(json) > META_MAX_BYTES) {
      delete trimmed[key];
      break;
    }
  }
  return trimmed;
}

/**
 * One report line, exactly the contract's shape and nothing else — the
 * schema is `.strict()`, so an extra key is a rejected batch.
 */
export function buildReport(event, fields = {}, { identity = resolveIdentity(), taskKey } = {}) {
  if (!EVENTS.includes(event)) throw new Error(`Unknown event "${event}". One of: ${EVENTS.join(", ")}`);
  const key = taskKey ?? fields.taskKey ?? defaultTaskKey(identity).taskKey;
  const report = {
    eventKey: clip(fields.eventKey ?? randomUUID(), LIMITS.eventKey),
    taskKey: clip(key, LIMITS.taskKey),
    agent: AGENTS.includes(fields.agent) ? fields.agent : identity.agent,
    environment: clip(fields.environment ?? identity.environment, LIMITS.environment),
    hostname: identity.hostname,
    reporterVersion: REPORTER_VERSION,
    event,
    occurredAt: fields.occurredAt ?? new Date().toISOString(),
  };
  if (fields.parentKey) report.parentKey = clip(fields.parentKey, LIMITS.taskKey);
  for (const name of ["title", "request", "goal", "summary", "changes", "remaining", "blockers", "nextStep", "message"]) {
    if (fields[name] != null && String(fields[name]).trim() !== "") report[name] = clip(fields[name], LIMITS[name]);
  }
  if (fields.kind) {
    if (!KINDS.includes(fields.kind)) throw new Error(`Unknown kind "${fields.kind}". One of: ${KINDS.join(", ")}`);
    report.kind = fields.kind;
  }
  if (fields.status) {
    if (!STATUSES.includes(fields.status)) throw new Error(`Unknown status "${fields.status}". One of: ${STATUSES.join(", ")}`);
    report.status = fields.status;
  }
  if (Array.isArray(fields.links) && fields.links.length) {
    report.links = fields.links.slice(0, 50).map((link) => ({ label: clip(link.label, 200), url: String(link.url) }));
  }
  const meta = boundedMeta(fields.meta);
  if (meta && Object.keys(meta).length) report.meta = meta;
  return report;
}

/** PNG IHDR is the only header worth parsing without a dependency. */
export function imageSize(buffer) {
  if (buffer.length > 24 && buffer.subarray(0, 8).equals(Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]))) {
    return { width: buffer.readUInt32BE(16), height: buffer.readUInt32BE(20) };
  }
  return {};
}

export function buildAttachment(filePath, { taskKey, kind = "screenshot", caption, pairKey, eventKey, contentType } = {}) {
  if (!ATTACHMENT_KINDS.includes(kind)) throw new Error(`Unknown attachment kind "${kind}". One of: ${ATTACHMENT_KINDS.join(", ")}`);
  const type = contentType ?? CONTENT_TYPES[extname(filePath).toLowerCase()];
  if (!type) throw new Error(`Cannot infer a content type for ${filePath}; pass --content-type.`);
  const data = readFileSync(filePath);
  const attachment = { taskKey, kind, contentType: type, dataBase64: data.toString("base64"), eventKey: clip(eventKey ?? randomUUID(), LIMITS.eventKey) };
  if (caption) attachment.caption = clip(caption, 500);
  if (pairKey) attachment.pairKey = clip(pairKey, 120);
  Object.assign(attachment, imageSize(data));
  return attachment;
}

/* ── transport ─────────────────────────────────────────────────────────── */

async function post(path, body, { baseUrl, secret, timeoutMs = DEFAULT_TIMEOUT_MS }) {
  const response = await fetch(`${baseUrl}${path}`, {
    method: "POST",
    headers: { "content-type": "application/json", "x-ops-report-secret": secret },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(timeoutMs),
  });
  const text = await response.text().catch(() => "");
  return { ok: response.ok, status: response.status, text: text.slice(0, 300) };
}

export const postReports = (reports, config) => post("/api/internal/ops/tasks/report", { reports }, config);
export const postAttachment = (attachment, config) => post("/api/internal/ops/tasks/attachments", attachment, config);

/* ── spool ─────────────────────────────────────────────────────────────── */

export function writeSpool(entry) {
  ensureDir(SPOOL_DIR);
  const file = join(SPOOL_DIR, `${Date.now()}-${randomUUID()}.json`);
  writeFileSync(file, JSON.stringify(entry));
  return file;
}

export function spoolFiles() {
  if (!existsSync(SPOOL_DIR)) return [];
  return readdirSync(SPOOL_DIR).filter((name) => name.endsWith(".json")).sort().map((name) => join(SPOOL_DIR, name));
}

/** "fetch failed" hides the real reason in `cause`; surface it. */
function describeError(error) {
  const cause = error?.cause;
  return cause?.code ?? cause?.errors?.[0]?.code ?? cause?.message ?? (error?.name === "TimeoutError" ? "timeout" : error?.message ?? String(error));
}

/* A rejected line (400/413/422) would block everything behind it forever;
   a rejected batch is moved aside so the rest of the spool keeps flowing. */
const isRejection = (status) => status === 400 || status === 413 || status === 422;

function reject(files, why) {
  ensureDir(REJECTED_DIR);
  for (const file of files) renameSync(file, join(REJECTED_DIR, basename(file)));
  note(`${files.length} line(s) rejected by the server (${why}); moved to ${REJECTED_DIR}`);
}

/**
 * Flush everything spooled, oldest first, stopping at the first transport
 * failure so order is preserved. Returns counts; never throws.
 */
export async function flushSpool({ config = loadConfig(), timeoutMs = DEFAULT_TIMEOUT_MS } = {}) {
  const files = spoolFiles();
  const result = { sent: 0, remaining: files.length, rejected: 0, error: null };
  if (!files.length) return result;
  if (!config.secret) {
    result.error = "no OPS_REPORT_SECRET (env or ~/.config/ai-dev/ops-report.env)";
    return result;
  }
  const options = { ...config, timeoutMs };

  let index = 0;
  while (index < files.length) {
    const entry = readJson(files[index]);
    if (!entry || (entry.type !== "report" && entry.type !== "attachment")) {
      reject([files[index]], "unreadable spool file");
      result.rejected += 1;
      index += 1;
      continue;
    }
    try {
      if (entry.type === "attachment") {
        const response = await postAttachment(entry.attachment, options);
        if (response.ok) {
          unlinkSync(files[index]);
          result.sent += 1;
        } else if (isRejection(response.status)) {
          reject([files[index]], `${response.status} ${response.text}`);
          result.rejected += 1;
        } else {
          result.error = `${response.status} ${response.text}`.trim();
          break;
        }
        index += 1;
        continue;
      }
      /* Consecutive report lines go as one batch. */
      const batchFiles = [];
      const reports = [];
      let cursor = index;
      while (cursor < files.length && reports.length < BATCH_SIZE) {
        const next = readJson(files[cursor]);
        if (!next || next.type !== "report") break;
        batchFiles.push(files[cursor]);
        reports.push(next.report);
        cursor += 1;
      }
      const response = await postReports(reports, options);
      if (response.ok) {
        for (const file of batchFiles) unlinkSync(file);
        result.sent += reports.length;
      } else if (isRejection(response.status)) {
        reject(batchFiles, `${response.status} ${response.text}`);
        result.rejected += batchFiles.length;
      } else {
        result.error = `${response.status} ${response.text}`.trim();
        break;
      }
      index = cursor;
    } catch (error) {
      result.error = describeError(error);
      break;
    }
  }
  result.remaining = spoolFiles().length;
  return result;
}

/**
 * The one entry point hooks and scripts use: spool the line, try to flush
 * everything, and report what happened without ever throwing.
 */
export async function spoolAndFlush(entry, { config, timeoutMs } = {}) {
  let file = null;
  try {
    file = writeSpool(entry);
  } catch (error) {
    note(`could not write the spool: ${error?.message ?? error}`);
    return { spooled: false, sent: 0, remaining: 0, error: "spool unwritable" };
  }
  const flushed = await flushSpool({ config, timeoutMs });
  if (flushed.error) note(`${flushed.remaining} line(s) kept in ${SPOOL_DIR} — ${flushed.error}`);
  return { spooled: true, file, ...flushed };
}

export const reportEvent = (event, fields, options = {}) =>
  spoolAndFlush({ type: "report", report: buildReport(event, fields, options) }, options);

export const reportAttachment = (filePath, fields, options = {}) =>
  spoolAndFlush({ type: "attachment", attachment: buildAttachment(filePath, fields) }, options);

/* ── CLI ───────────────────────────────────────────────────────────────── */

const FLAG_NAMES = {
  task: "taskKey",
  parent: "parentKey",
  title: "title",
  request: "request",
  goal: "goal",
  kind: "kind",
  status: "status",
  summary: "summary",
  changes: "changes",
  remaining: "remaining",
  blockers: "blockers",
  next: "nextStep",
  message: "message",
  file: "file",
  "attachment-kind": "attachmentKind",
  caption: "caption",
  pair: "pairKey",
  "content-type": "contentType",
  agent: "agent",
};

export function parseArgs(argv) {
  const out = { links: [], meta: {}, _: [] };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (!arg.startsWith("--")) {
      out._.push(arg);
      continue;
    }
    const [flag, inline] = arg.slice(2).split(/=(.*)/s);
    const value = inline ?? argv[++i];
    if (flag === "link") {
      const [label, ...rest] = String(value).split("=");
      out.links.push({ label, url: rest.join("=") });
    } else if (flag === "meta") {
      const [key, ...rest] = String(value).split("=");
      out.meta[key] = rest.join("=");
    } else if (FLAG_NAMES[flag]) {
      out[FLAG_NAMES[flag]] = value;
    } else {
      throw new Error(`Unknown flag --${flag}`);
    }
  }
  return out;
}

function usage() {
  return [
    "usage: report.mjs <start|progress|status|note|finish|heartbeat|attach|flush|whoami> [flags]",
    "  --task KEY --parent KEY --title T --request R --goal G --kind code|editorial|design|ops|research|review|import|other",
    "  --status queued|running|waiting|blocked|completed|failed|cancelled",
    "  --summary S --changes C --remaining R --blockers B --next N --message M",
    "  --link label=url (repeatable)  --meta key=value (repeatable)",
    "  attach: --file PATH --attachment-kind screenshot|before|after|artifact|file [--caption C] [--pair KEY]",
    "  env: OPS_REPORT_SECRET, OPS_REPORT_BASE_URL, OPS_TASK_KEY, LIONS_AI  (or ~/.config/ai-dev/ops-report.env)",
  ].join("\n");
}

export async function main(argv = process.argv.slice(2)) {
  const command = argv[0];
  if (!command || command === "--help" || command === "-h") {
    console.log(usage());
    return 0;
  }
  const args = parseArgs(argv.slice(1));
  const identity = resolveIdentity();
  const config = loadConfig();
  const chosen = args.taskKey ? { taskKey: args.taskKey, source: "--task" } : defaultTaskKey(identity);

  if (command === "whoami") {
    const lines = {
      agent: `${identity.agent} (${identity.source})`,
      branch: identity.branch ?? "—",
      environment: identity.environment,
      taskKey: `${chosen.taskKey} (${chosen.source})`,
      baseUrl: config.baseUrl,
      secret: config.secret ? `present (${config.secretSource})` : "MISSING — reports will spool only",
      spool: `${spoolFiles().length} pending in ${SPOOL_DIR}`,
      reporterVersion: REPORTER_VERSION,
    };
    for (const [key, value] of Object.entries(lines)) console.log(`${key.padEnd(16)} ${value}`);
    return 0;
  }

  if (command === "flush") {
    const result = await flushSpool({ config });
    console.log(`flushed ${result.sent}, rejected ${result.rejected}, remaining ${result.remaining}${result.error ? ` — ${result.error}` : ""}`);
    return 0;
  }

  if (command === "attach") {
    if (!args.file) throw new Error("attach needs --file PATH");
    const result = await reportAttachment(args.file, {
      taskKey: chosen.taskKey,
      kind: args.attachmentKind ?? "screenshot",
      caption: args.caption,
      pairKey: args.pairKey,
      contentType: args.contentType,
    }, { config });
    console.log(`${result.sent ? "attached" : "spooled"} ${basename(args.file)} → ${chosen.taskKey}${result.error ? ` (${result.error})` : ""}`);
    return 0;
  }

  if (!EVENTS.includes(command)) throw new Error(`Unknown command "${command}".\n${usage()}`);

  const fields = { ...args, meta: { ...args.meta } };
  if (identity.branch && fields.meta.branch === undefined) fields.meta.branch = identity.branch;
  if (command === "finish" && !fields.status) fields.status = "completed";
  if (command === "start" && !fields.status) fields.status = "running";
  if (command === "start" && !fields.kind) fields.kind = "code";

  const result = await reportEvent(command, fields, { identity, taskKey: chosen.taskKey, config });
  if (command === "finish") writeTaskState(chosen.taskKey, { finished: true, finishedAt: new Date().toISOString() });
  if (command === "start" && fields.title) writeTaskState(chosen.taskKey, { titled: true });

  if (!config.secret) note("no secret configured; the line is spooled and will be sent by the next flush that has one");
  console.log(`${result.sent ? "reported" : "spooled"} ${command} → ${chosen.taskKey}${result.remaining ? ` (${result.remaining} pending)` : ""}`);
  return 0;
}

if (isMain) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      note(error?.message ?? String(error));
      process.exit(1);
    },
  );
}
