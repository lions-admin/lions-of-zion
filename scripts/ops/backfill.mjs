#!/usr/bin/env node
/**
 * One-time import of past work into the operations board.
 *
 *   npm run ops:backfill                                   # dry run: a table of what would be created
 *   npm run ops:backfill -- --apply                        # post it
 *   npm run ops:backfill -- --apply --summarize            # …then ask the server for a Hebrew summary of each
 *   npm run ops:backfill -- --summarize --only-missing     # only tasks the local ledger has not summarized yet
 *
 * Every session becomes a *digest* as well as a task — first prompt, last two
 * assistant texts, files edited, tool counts, commits in its time window —
 * built by the same readers `report.mjs` uses for a live session. The finish
 * line's `summary` is the last assistant text and its `changes` the files and
 * commits, so an imported task explains itself even before the server has
 * summarized it. `--summarize` POSTs each digest to the summarize route
 * (three at a time, a progress line every twenty) and records the task key
 * in `~/.lions-ops/state/summarized.json`, which `--only-missing` consults.
 *
 * Sources, each becoming one task with `taskKey = import:<sha1(source path)>`,
 * kind `import`, status `completed`, `meta.imported = true`:
 *
 *   docs/reviews/<slug>/REPORT.md   + before/*.png, after/*.png as paired attachments
 *   docs/audits/*.md
 *   docs/handoff/*.md
 *   ~/.claude/projects/<dir containing lions>/  every .jsonl, recursively: first user prompt = title/request (agent claude)
 *   ~/.codex/sessions/                          every .jsonl whose session cwd contains lions-of-zion (agent codex)
 *   ~/.grok/sessions/<url-encoded cwd>/<id>/ dirs whose decoded name contains lions-of-zion (agent grok)
 *
 * Every task is sent as a `start` line (occurredAt = creation) and a `finish`
 * line (occurredAt = last modification, summary "יובא מ-<source>"), with fixed
 * event keys so a second `--apply` is idempotent. Attachments are capped at
 * 60 per task and a PNG over 5 MB is skipped — the contract's upload limit is
 * 6.5 MB of base64, and a review folder here is 25 MB of viewport strips.
 */
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, openSync, readSync, closeSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { STATE_DIR, boundDigest, buildAttachment, buildDigestFromTranscript, buildReport, commitsSince, loadConfig, looksLikeSystemPrompt, postAttachment, postDigest, postReports, resolveIdentity, sha1 } from "./report.mjs";

const HOME = homedir();
const ROOT = process.env.CLAUDE_PROJECT_DIR ?? join(dirname(fileURLToPath(import.meta.url)), "..", "..");
const APPLY = process.argv.includes("--apply");
const SUMMARIZE = process.argv.includes("--summarize");
const ONLY_MISSING = process.argv.includes("--only-missing");
const MAX_ATTACHMENTS = 60;
const MAX_PNG_BYTES = 5 * 1024 * 1024;
const MAX_CLAUDE_FILES = 2000;
const MAX_SESSION_BYTES = 64 * 1024 * 1024;
const SUMMARIZE_CONCURRENCY = 3;
const SUMMARIZE_PROGRESS_EVERY = 20;
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);
export const LEDGER_PATH = join(STATE_DIR, "summarized.json");
const isMain = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];

const exists = (p) => existsSync(p);
const list = (dir) => (exists(dir) ? readdirSync(dir, { withFileTypes: true }) : []);
const iso = (ms) => new Date(ms).toISOString();
const heading = (markdown, fallback) => markdown.match(/^#\s+(.+)$/m)?.[1]?.trim() ?? fallback;

function walk(dir, predicate, out = [], depth = 0) {
  if (depth > 8) return out;
  for (const entry of list(dir)) {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) walk(path, predicate, out, depth + 1);
    else if (predicate(path)) out.push(path);
  }
  return out;
}

function head(path, bytes = 256 * 1024) {
  const fd = openSync(path, "r");
  try {
    const size = Math.min(statSync(path).size, bytes);
    const buffer = Buffer.alloc(size);
    readSync(fd, buffer, 0, size, 0);
    return buffer.toString("utf8");
  } finally {
    closeSync(fd);
  }
}

/** Whole file as text, or null when it is too large or unreadable. */
function whole(path) {
  try {
    if (statSync(path).size > MAX_SESSION_BYTES) return null;
    return readFileSync(path, "utf8");
  } catch {
    return null;
  }
}

function parseLines(text) {
  const out = [];
  for (const line of (text ?? "").split("\n")) {
    if (!line.startsWith("{")) continue;
    try {
      out.push(JSON.parse(line));
    } catch {
      /* skip */
    }
  }
  return out;
}

function task({ source, agent, title, request, summary, kind = "import", createdMs, modifiedMs, links = [], attachments = [], digest = {} }) {
  const key = `import:${sha1(source)}`;
  return {
    taskKey: key,
    source,
    agent,
    title: String(title ?? basename(source)).replace(/\s+/g, " ").trim().slice(0, 300) || basename(source),
    request: request ? String(request).slice(0, 4000) : undefined,
    summary: summary ? String(summary).slice(0, 7000) : undefined,
    kind,
    createdAt: iso(createdMs ?? modifiedMs ?? Date.now()),
    finishedAt: iso(modifiedMs ?? createdMs ?? Date.now()),
    links,
    attachments,
    /* request / lastAssistant / priorAssistant / filesEdited / toolCounts; commits are added when posting. */
    digest: { source: `import:${agent}`, ...digest },
  };
}

/* ── repository documents ──────────────────────────────────────────────── */

function imageAttachments(dir, kind) {
  const out = [];
  for (const entry of list(dir)) {
    if (!entry.isFile() || !IMAGE_EXT.has(extname(entry.name).toLowerCase())) continue;
    const path = join(dir, entry.name);
    if (statSync(path).size > MAX_PNG_BYTES) continue;
    out.push({ path, kind, pairKey: basename(entry.name, extname(entry.name)), caption: `${kind}: ${entry.name}` });
  }
  return out;
}

function reviewTasks() {
  const tasks = [];
  const reviews = join(ROOT, "docs", "reviews");
  for (const entry of list(reviews)) {
    if (!entry.isDirectory()) continue;
    const dir = join(reviews, entry.name);
    const report = ["REPORT.md", "README.md"].map((n) => join(dir, n)).find(exists);
    if (!report) continue;
    const text = readFileSync(report, "utf8");
    const stat = statSync(report);
    const attachments = [...imageAttachments(join(dir, "before"), "before"), ...imageAttachments(join(dir, "after"), "after")].slice(0, MAX_ATTACHMENTS);
    tasks.push(task({
      source: relative(ROOT, report),
      agent: "claude",
      kind: "review",
      title: heading(text, entry.name),
      summary: text,
      createdMs: stat.birthtimeMs || stat.mtimeMs,
      modifiedMs: stat.mtimeMs,
      links: [{ label: "REPORT.md", url: `https://github.com/lions-admin/lions-of-zion/blob/main/${relative(ROOT, report)}` }],
      attachments,
      digest: { lastAssistant: text, filesEdited: [relative(ROOT, report)] },
    }));
  }
  return tasks;
}

function markdownTasks(subdir, kind) {
  const tasks = [];
  const dir = join(ROOT, "docs", subdir);
  for (const entry of list(dir)) {
    if (!entry.isFile() || extname(entry.name) !== ".md") continue;
    const path = join(dir, entry.name);
    const text = readFileSync(path, "utf8");
    const stat = statSync(path);
    tasks.push(task({
      source: relative(ROOT, path),
      agent: "claude",
      kind,
      title: heading(text, entry.name),
      summary: text,
      createdMs: stat.birthtimeMs || stat.mtimeMs,
      modifiedMs: stat.mtimeMs,
      links: [{ label: entry.name, url: `https://github.com/lions-admin/lions-of-zion/blob/main/${relative(ROOT, path)}` }],
      digest: { lastAssistant: text, filesEdited: [relative(ROOT, path)] },
    }));
  }
  return tasks;
}

/* ── Claude sessions ───────────────────────────────────────────────────── */

/* Prompts a tool wrote for itself, not the owner: skill invocations, title
   generation, compaction summaries, seeded context. The recogniser lives in
   report.mjs so the live digest and the import agree. */
const looksLikeSystem = looksLikeSystemPrompt;

function claudeTasks() {
  const projects = join(HOME, ".claude", "projects");
  const dirs = list(projects).filter((e) => e.isDirectory() && e.name.toLowerCase().includes("lions"));
  /* `agent-*.jsonl` are sub-agent transcripts; their parent session already carries the task. */
  const files = dirs.flatMap((e) => walk(join(projects, e.name), (p) => p.endsWith(".jsonl") && !basename(p).startsWith("agent-")));
  if (files.length > MAX_CLAUDE_FILES) {
    console.error(`[backfill] ${files.length} Claude transcripts exceed the ${MAX_CLAUDE_FILES} cap; skipping that source.`);
    return [];
  }
  const tasks = [];
  for (const path of files) {
    const digest = buildDigestFromTranscript(path, { withCommits: false });
    if (digest.error || !digest.request) continue;
    const stat = statSync(path);
    tasks.push(task({
      source: path.replace(HOME, "~"),
      agent: "claude",
      title: digest.request.slice(0, 120),
      request: digest.request,
      createdMs: Date.parse(digest.startedAt) || stat.birthtimeMs || stat.mtimeMs,
      modifiedMs: Date.parse(digest.endedAt) || stat.mtimeMs,
      digest: { request: digest.request, lastAssistant: digest.lastAssistant, priorAssistant: digest.priorAssistant, filesEdited: digest.filesEdited, toolCounts: digest.toolCounts, cwd: digest.cwd },
    }));
  }
  return tasks;
}

/* ── Codex sessions ────────────────────────────────────────────────────── */

/** `*** Update File: path` / `*** Add File: path` inside an apply_patch body. */
function patchedFiles(text) {
  return [...String(text ?? "").matchAll(/\*\*\* (?:Update|Add|Delete) File: ([^\n]+)/g)].map((m) => m[1].trim());
}

/**
 * A Codex rollout (`~/.codex/sessions/**.jsonl`): `session_meta` carries cwd
 * and start; `response_item` messages carry user `input_text` and assistant
 * `output_text`; `function_call` items are the tool calls, with edits inside
 * `apply_patch` (as its own call or through `shell`).
 */
export function buildDigestFromCodexSession(path) {
  const digest = { source: "codex-session", filesEdited: [], toolCounts: {} };
  const text = whole(path);
  if (text == null) return { ...digest, error: "unreadable or too large" };
  const files = new Set();
  const assistantTexts = [];
  let lastAt = null;
  for (const entry of parseLines(text)) {
    if (entry.timestamp) lastAt = entry.timestamp;
    if (entry.type === "session_meta") {
      digest.cwd = entry.payload?.cwd ?? null;
      digest.startedAt = entry.payload?.timestamp ?? entry.timestamp ?? null;
      digest.sessionId = entry.payload?.id ?? entry.payload?.session_id ?? null;
      continue;
    }
    if (entry.type !== "response_item") continue;
    const payload = entry.payload ?? {};
    if (payload.type === "message" && payload.role === "user") {
      if (digest.request) continue;
      const prompt = (payload.content ?? []).filter((p) => p?.type === "input_text").map((p) => p.text).join("\n").trim();
      if (prompt && !prompt.startsWith("# AGENTS.md") && !prompt.startsWith("<environment_context>") && !looksLikeSystem(prompt)) digest.request = prompt;
      continue;
    }
    if (payload.type === "message" && payload.role === "assistant") {
      const out = (payload.content ?? []).filter((p) => p?.type === "output_text").map((p) => p.text).join("\n").trim();
      if (out) assistantTexts.push(out);
      continue;
    }
    /* `function_call` carries JSON `arguments`; `custom_tool_call` (exec, apply_patch)
       carries a raw `input` — a JS snippet or a patch body. Edits are the
       `*** Update File:` lines wherever they appear. */
    if (payload.type === "function_call" || payload.type === "custom_tool_call") {
      const name = String(payload.name ?? "tool");
      digest.toolCounts[name] = (digest.toolCounts[name] ?? 0) + 1;
      let body = payload.input ?? payload.arguments ?? "";
      if (typeof body === "string" && body.startsWith("{")) {
        try {
          const parsed = JSON.parse(body);
          body = parsed.input ?? parsed.patch ?? parsed.cmd ?? parsed.command ?? body;
          if (Array.isArray(body)) body = body.join(" ");
        } catch {
          /* raw string */
        }
      }
      if (typeof body === "string" && body.includes("File:")) {
        for (const file of patchedFiles(body.replace(/\\n/g, "\n"))) files.add(file);
      }
    }
  }
  digest.endedAt = lastAt;
  digest.lastAssistant = assistantTexts.at(-1);
  digest.priorAssistant = assistantTexts.length > 1 ? assistantTexts.at(-2) : undefined;
  digest.filesEdited = [...files];
  return digest;
}

function codexTasks() {
  const root = join(HOME, ".codex", "sessions");
  const tasks = [];
  for (const path of walk(root, (p) => p.endsWith(".jsonl"))) {
    /* The cwd is in the first line; skip the rest of the file when it is not ours. */
    const meta = parseLines(head(path, 64 * 1024)).find((e) => e.type === "session_meta");
    const cwd = meta?.payload?.cwd ?? null;
    if (!cwd || !cwd.includes("lions-of-zion")) continue;
    const digest = buildDigestFromCodexSession(path);
    if (digest.error) continue;
    const stat = statSync(path);
    tasks.push(task({
      source: path.replace(HOME, "~"),
      agent: "codex",
      title: (digest.request ?? basename(path, ".jsonl")).slice(0, 120),
      request: digest.request ?? undefined,
      createdMs: Date.parse(digest.startedAt) || stat.birthtimeMs || stat.mtimeMs,
      modifiedMs: Date.parse(digest.endedAt) || stat.mtimeMs,
      digest: { request: digest.request, lastAssistant: digest.lastAssistant, priorAssistant: digest.priorAssistant, filesEdited: digest.filesEdited, toolCounts: digest.toolCounts, cwd },
    }));
  }
  return tasks;
}

/* ── Grok sessions ─────────────────────────────────────────────────────── */

function grokTasks() {
  const root = join(HOME, ".grok", "sessions");
  const tasks = [];
  for (const entry of list(root)) {
    if (!entry.isDirectory()) continue;
    let decoded = entry.name;
    try {
      decoded = decodeURIComponent(entry.name);
    } catch {
      /* keep raw */
    }
    if (!decoded.includes("lions-of-zion")) continue;
    const dir = join(root, entry.name);
    for (const session of list(dir)) {
      if (!session.isDirectory()) continue;
      const sdir = join(dir, session.name);
      const summaryPath = join(sdir, "summary.json");
      let summary = {};
      try {
        summary = JSON.parse(readFileSync(summaryPath, "utf8"));
      } catch {
        /* no summary */
      }
      let prompt = null;
      const history = join(sdir, "prompt_history.jsonl");
      if (exists(history)) {
        for (const line of head(history, 64 * 1024).split("\n")) {
          try {
            const text = JSON.parse(line).prompt;
            if (text?.trim()) {
              prompt = text.trim();
              break;
            }
          } catch {
            /* skip */
          }
        }
      }
      const digest = buildDigestFromGrokSession(sdir);
      const stat = statSync(sdir);
      tasks.push(task({
        source: sdir.replace(HOME, "~"),
        agent: "grok",
        title: summary.generated_title ?? summary.session_summary ?? (prompt ?? digest.request)?.slice(0, 120) ?? session.name,
        request: prompt ?? digest.request ?? undefined,
        summary: summary.last_turn_summary ?? undefined,
        createdMs: Date.parse(summary.created_at) || stat.birthtimeMs || stat.mtimeMs,
        modifiedMs: Date.parse(summary.updated_at) || stat.mtimeMs,
        digest: { request: prompt ?? digest.request, lastAssistant: digest.lastAssistant ?? summary.last_turn_summary, priorAssistant: digest.priorAssistant, filesEdited: digest.filesEdited, toolCounts: digest.toolCounts, cwd: summary.info?.cwd ?? decoded },
      }));
    }
  }
  return tasks;
}

const GROK_EDIT_TOOLS = new Set(["write", "search_replace", "edit", "edit_file", "multi_edit", "create_file", "delete_file"]);

/**
 * A Grok Build session directory: `chat_history.jsonl` holds `{type: user|
 * assistant|system|tool, content, tool_calls?: [{name, arguments}]}` lines.
 */
export function buildDigestFromGrokSession(dir) {
  const digest = { source: "grok-session", filesEdited: [], toolCounts: {} };
  const text = whole(join(dir, "chat_history.jsonl"));
  if (text == null) return { ...digest, error: "no chat_history.jsonl" };
  const files = new Set();
  const assistantTexts = [];
  for (const entry of parseLines(text)) {
    const content = typeof entry.content === "string" ? entry.content.trim() : Array.isArray(entry.content) ? entry.content.filter((p) => p?.type === "text").map((p) => p.text).join("\n").trim() : "";
    if (entry.type === "user" || entry.role === "user") {
      if (!digest.request && content && !looksLikeSystem(content)) digest.request = content;
      continue;
    }
    if (entry.type !== "assistant" && entry.role !== "assistant") continue;
    if (content) assistantTexts.push(content);
    for (const call of Array.isArray(entry.tool_calls) ? entry.tool_calls : []) {
      const name = String(call?.name ?? call?.function?.name ?? "tool");
      digest.toolCounts[name] = (digest.toolCounts[name] ?? 0) + 1;
      if (!GROK_EDIT_TOOLS.has(name)) continue;
      try {
        const args = JSON.parse(call.arguments ?? call.function?.arguments ?? "{}");
        const file = args.file_path ?? args.target_file ?? args.path;
        if (file) files.add(String(file));
      } catch {
        /* skip */
      }
    }
  }
  digest.lastAssistant = assistantTexts.at(-1);
  digest.priorAssistant = assistantTexts.length > 1 ? assistantTexts.at(-2) : undefined;
  digest.filesEdited = [...files];
  return digest;
}

/* ── output and posting ────────────────────────────────────────────────── */

/** Commits in the task's time window, from this checkout (every AI branch carries `main`'s history). */
function commitsFor(item) {
  if (item.digest.commits) return item.digest.commits;
  const cwd = item.digest.cwd && exists(item.digest.cwd) ? item.digest.cwd : ROOT;
  item.digest.commits = commitsSince(cwd, item.createdAt, item.finishedAt);
  return item.digest.commits;
}

/** The finish line's `changes`: the files the session edited and the commits it made. */
function changesFor(item) {
  const files = (item.digest.filesEdited ?? []).slice(0, 40).map((f) => `- ${f.replace(HOME, "~")}`);
  const commits = commitsFor(item).slice(0, 40).map((c) => `- ${c.sha} ${c.subject}`);
  const parts = [];
  if (files.length) parts.push(`קבצים (${item.digest.filesEdited.length}):\n${files.join("\n")}`);
  if (commits.length) parts.push(`קומיטים (${item.digest.commits.length}):\n${commits.join("\n")}`);
  return parts.join("\n\n") || undefined;
}

export function digestFor(item) {
  return boundDigest({ ...item.digest, taskKey: item.taskKey, request: item.digest.request ?? item.request, commits: commitsFor(item) });
}

function toReports(item) {
  const identity = resolveIdentity();
  const environment = `import:${item.source}`.slice(0, 300);
  const common = { agent: item.agent, environment, meta: { imported: true, source: item.source, importedBy: identity.agent } };
  const summary = item.digest.lastAssistant ?? item.summary;
  const start = buildReport("start", {
    ...common,
    eventKey: `${item.taskKey}:start`,
    title: item.title,
    request: item.request,
    kind: item.kind,
    status: "running",
    occurredAt: item.createdAt,
    links: item.links,
  }, { identity, taskKey: item.taskKey });
  const finish = buildReport("finish", {
    ...common,
    eventKey: `${item.taskKey}:finish`,
    status: "completed",
    summary: `יובא מ-${item.source}${summary ? `\n\n${String(summary).slice(0, 15000)}` : ""}`,
    changes: changesFor(item),
    occurredAt: item.finishedAt,
  }, { identity, taskKey: item.taskKey });
  return [start, finish];
}

/* ── the summarize pass ────────────────────────────────────────────────── */

export function readLedger() {
  try {
    const parsed = JSON.parse(readFileSync(LEDGER_PATH, "utf8"));
    return parsed && typeof parsed === "object" ? parsed : {};
  } catch {
    return {};
  }
}

export function writeLedger(ledger) {
  mkdirSync(STATE_DIR, { recursive: true });
  writeFileSync(LEDGER_PATH, JSON.stringify(ledger, null, 2));
}

/**
 * POST one digest per task to the summarize route, three at a time, and
 * remember every success in the ledger. Returns counts; a task whose digest
 * has nothing to summarize (no text at all) is skipped, not failed.
 */
export async function summarizeTasks(tasks, { config = loadConfig(), onlyMissing = false, concurrency = SUMMARIZE_CONCURRENCY, log = console.log } = {}) {
  const ledger = readLedger();
  const queue = tasks.filter((t) => !(onlyMissing && ledger[t.taskKey]));
  const result = { total: queue.length, skipped: tasks.length - queue.length, sent: 0, failed: 0, empty: 0 };
  if (!queue.length) return result;
  let cursor = 0;
  let done = 0;
  const worker = async () => {
    while (cursor < queue.length) {
      const item = queue[cursor++];
      const digest = digestFor(item);
      if (!digest.lastAssistant && !digest.request) {
        result.empty += 1;
      } else {
        try {
          const response = await postDigest(digest, { ...config, timeoutMs: 90000 });
          if (response.ok) {
            result.sent += 1;
            ledger[item.taskKey] = new Date().toISOString();
          } else {
            result.failed += 1;
            log(`  summarize ${item.taskKey.slice(0, 24)} (${item.source.slice(0, 60)}): ${response.status} ${response.text.slice(0, 160)}`);
          }
        } catch (error) {
          result.failed += 1;
          log(`  summarize ${item.taskKey.slice(0, 24)}: ${error?.cause?.code ?? error?.message ?? error}`);
        }
      }
      done += 1;
      if (done % SUMMARIZE_PROGRESS_EVERY === 0 || done === queue.length) {
        writeLedger(ledger);
        log(`  summarized ${done}/${queue.length} (sent ${result.sent}, failed ${result.failed}, empty ${result.empty})`);
      }
    }
  };
  await Promise.all(Array.from({ length: Math.min(concurrency, queue.length) }, worker));
  writeLedger(ledger);
  return result;
}

/** Every importable task, grouped by source — shared with summarize.mjs. */
export function collectTasks() {
  return {
    "docs/reviews": reviewTasks(),
    "docs/audits": markdownTasks("audits", "review"),
    "docs/handoff": markdownTasks("handoff", "ops"),
    "claude sessions": claudeTasks(),
    "codex sessions": codexTasks(),
    "grok sessions": grokTasks(),
  };
}

function printTable(tasks) {
  const rows = tasks.map((t) => ({
    agent: t.agent,
    kind: t.kind,
    taskKey: t.taskKey.slice(0, 24),
    when: t.finishedAt.slice(0, 10),
    att: String(t.attachments.length),
    title: t.title.slice(0, 56),
    source: t.source.slice(0, 60),
  }));
  const cols = ["agent", "kind", "taskKey", "when", "att", "title", "source"];
  const width = Object.fromEntries(cols.map((c) => [c, Math.max(c.length, ...rows.map((r) => r[c].length))]));
  console.log(cols.map((c) => c.toUpperCase().padEnd(width[c])).join("  "));
  for (const row of rows) console.log(cols.map((c) => row[c].padEnd(width[c])).join("  "));
}

async function main() {
  const groups = collectTasks();
  const tasks = Object.values(groups).flat();
  const attachmentCount = tasks.reduce((n, t) => n + t.attachments.length, 0);
  const withDigest = tasks.filter((t) => t.digest.lastAssistant).length;

  printTable(tasks);
  console.log("");
  for (const [name, items] of Object.entries(groups)) console.log(`${name.padEnd(16)} ${items.length}`);
  console.log(`${"total".padEnd(16)} ${tasks.length} tasks, ${attachmentCount} attachments, ${withDigest} with a digest to summarize`);

  if (!APPLY && !SUMMARIZE) {
    console.log("\nDry run. Add --apply to post, --summarize to request Hebrew summaries.");
    return 0;
  }

  const config = loadConfig();
  if (!config.secret) {
    console.error("[backfill] OPS_REPORT_SECRET is not set; nothing posted.");
    return 1;
  }
  if (!APPLY) {
    console.log(`\nSummarizing against ${config.baseUrl}${ONLY_MISSING ? " (only tasks missing from the ledger)" : ""} …`);
    const summarized = await summarizeTasks(tasks, { config, onlyMissing: ONLY_MISSING });
    console.log(`done: ${summarized.sent} summarized, ${summarized.failed} failed, ${summarized.empty} empty, ${summarized.skipped} already in ${LEDGER_PATH.replace(HOME, "~")}`);
    return summarized.failed ? 1 : 0;
  }
  console.log(`\nPosting to ${config.baseUrl} …`);
  const reports = tasks.flatMap(toReports);
  let posted = 0;
  for (let i = 0; i < reports.length; i += 200) {
    const batch = reports.slice(i, i + 200);
    const response = await postReports(batch, { ...config, timeoutMs: 30000 });
    if (!response.ok) {
      console.error(`[backfill] batch ${i / 200 + 1} failed: ${response.status} ${response.text}`);
      return 1;
    }
    posted += batch.length;
    console.log(`  reports ${posted}/${reports.length}`);
  }
  let attached = 0;
  let failed = 0;
  for (const item of tasks) {
    for (const att of item.attachments) {
      const attachment = buildAttachment(att.path, { taskKey: item.taskKey, kind: att.kind, caption: att.caption, pairKey: att.pairKey, eventKey: `${item.taskKey}:att:${sha1(att.path).slice(0, 16)}` });
      const response = await postAttachment(attachment, { ...config, timeoutMs: 60000 });
      if (response.ok) attached += 1;
      else {
        failed += 1;
        console.error(`  attachment ${att.path}: ${response.status} ${response.text}`);
      }
    }
  }
  console.log(`done: ${posted} report lines, ${attached} attachments, ${failed} attachment failures`);
  if (SUMMARIZE) {
    console.log(`\nSummarizing${ONLY_MISSING ? " (only tasks missing from the ledger)" : ""} …`);
    const summarized = await summarizeTasks(tasks, { config, onlyMissing: ONLY_MISSING });
    console.log(`done: ${summarized.sent} summarized, ${summarized.failed} failed, ${summarized.empty} empty, ${summarized.skipped} already in ${LEDGER_PATH.replace(HOME, "~")}`);
    if (summarized.failed) return 1;
  }
  return failed ? 1 : 0;
}

if (isMain) {
  main().then(
    (code) => process.exit(code),
    (error) => {
      console.error(`[backfill] ${error?.message ?? error}`);
      process.exit(1);
    },
  );
}
