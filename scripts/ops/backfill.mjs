#!/usr/bin/env node
/**
 * One-time import of past work into the operations board.
 *
 *   npm run ops:backfill            # dry run: a table of what would be created
 *   npm run ops:backfill -- --apply # post it
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
import { existsSync, readdirSync, readFileSync, statSync, openSync, readSync, closeSync } from "node:fs";
import { homedir } from "node:os";
import { basename, dirname, extname, join, relative } from "node:path";
import { buildAttachment, buildReport, loadConfig, postAttachment, postReports, resolveIdentity, sha1 } from "./report.mjs";

const HOME = homedir();
const ROOT = process.env.CLAUDE_PROJECT_DIR ?? join(dirname(new URL(import.meta.url).pathname), "..", "..");
const APPLY = process.argv.includes("--apply");
const MAX_ATTACHMENTS = 60;
const MAX_PNG_BYTES = 5 * 1024 * 1024;
const MAX_CLAUDE_FILES = 2000;
const IMAGE_EXT = new Set([".png", ".jpg", ".jpeg", ".webp"]);

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

function task({ source, agent, title, request, summary, kind = "import", createdMs, modifiedMs, links = [], attachments = [] }) {
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
    }));
  }
  return tasks;
}

/* ── Claude sessions ───────────────────────────────────────────────────── */

/* Prompts a tool wrote for itself, not the owner: skill invocations, title
   generation, compaction summaries, seeded context. */
const SYSTEM_PREFIXES = ["Base directory for this skill", "Based on the user's message below", "The following is the Codex agent history", "⟦TEMPO_SEED_CONTEXT⟧", "# Schedule Cloud Agents", "# AGENTS.md"];
const looksLikeSystem = (text) => /^\s*</.test(text) || SYSTEM_PREFIXES.some((prefix) => text.startsWith(prefix)) || text.includes("<command-name>") || text.includes("<local-command");

function firstClaudePrompt(path) {
  for (const line of head(path, 512 * 1024).split("\n")) {
    if (!line.includes('"type":"user"')) continue;
    let entry;
    try {
      entry = JSON.parse(line);
    } catch {
      continue;
    }
    if (entry.type !== "user" || entry.isSidechain) continue;
    const content = entry.message?.content;
    const text = typeof content === "string" ? content
      : Array.isArray(content) ? content.filter((p) => p?.type === "text").map((p) => p.text).join("\n") : "";
    const trimmed = text.trim();
    if (trimmed && !looksLikeSystem(trimmed)) return { text: trimmed, at: Date.parse(entry.timestamp) || null, cwd: entry.cwd };
  }
  return null;
}

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
    const prompt = firstClaudePrompt(path);
    if (!prompt) continue;
    const stat = statSync(path);
    tasks.push(task({
      source: path.replace(HOME, "~"),
      agent: "claude",
      title: prompt.text.slice(0, 120),
      request: prompt.text,
      createdMs: prompt.at ?? stat.birthtimeMs ?? stat.mtimeMs,
      modifiedMs: stat.mtimeMs,
    }));
  }
  return tasks;
}

/* ── Codex sessions ────────────────────────────────────────────────────── */

function codexTasks() {
  const root = join(HOME, ".codex", "sessions");
  const tasks = [];
  for (const path of walk(root, (p) => p.endsWith(".jsonl"))) {
    const lines = head(path).split("\n");
    let cwd = null;
    let title = null;
    let startedAt = null;
    for (const line of lines) {
      let entry;
      try {
        entry = JSON.parse(line);
      } catch {
        continue;
      }
      if (entry.type === "session_meta") {
        cwd = entry.payload?.cwd ?? null;
        startedAt = Date.parse(entry.payload?.timestamp ?? entry.timestamp) || null;
        if (!cwd || !cwd.includes("lions-of-zion")) break;
      }
      if (entry.type === "response_item" && entry.payload?.role === "user") {
        const text = (entry.payload.content ?? []).filter((p) => p?.type === "input_text").map((p) => p.text).join("\n").trim();
        if (text && !text.startsWith("# AGENTS.md") && !text.startsWith("<environment_context>") && !looksLikeSystem(text)) {
          title = text;
          break;
        }
      }
    }
    if (!cwd || !cwd.includes("lions-of-zion")) continue;
    const stat = statSync(path);
    tasks.push(task({
      source: path.replace(HOME, "~"),
      agent: "codex",
      title: (title ?? basename(path, ".jsonl")).slice(0, 120),
      request: title ?? undefined,
      createdMs: startedAt ?? stat.birthtimeMs ?? stat.mtimeMs,
      modifiedMs: stat.mtimeMs,
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
      const stat = statSync(sdir);
      tasks.push(task({
        source: sdir.replace(HOME, "~"),
        agent: "grok",
        title: summary.generated_title ?? summary.session_summary ?? prompt?.slice(0, 120) ?? session.name,
        request: prompt ?? undefined,
        summary: summary.last_turn_summary ?? undefined,
        createdMs: Date.parse(summary.created_at) || stat.birthtimeMs || stat.mtimeMs,
        modifiedMs: Date.parse(summary.updated_at) || stat.mtimeMs,
      }));
    }
  }
  return tasks;
}

/* ── output and posting ────────────────────────────────────────────────── */

function toReports(item) {
  const identity = resolveIdentity();
  const environment = `import:${item.source}`.slice(0, 300);
  const common = { agent: item.agent, environment, meta: { imported: true, source: item.source, importedBy: identity.agent } };
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
    summary: `יובא מ-${item.source}${item.summary ? `\n\n${item.summary}` : ""}`,
    occurredAt: item.finishedAt,
  }, { identity, taskKey: item.taskKey });
  return [start, finish];
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
  const groups = {
    "docs/reviews": reviewTasks(),
    "docs/audits": markdownTasks("audits", "review"),
    "docs/handoff": markdownTasks("handoff", "ops"),
    "claude sessions": claudeTasks(),
    "codex sessions": codexTasks(),
    "grok sessions": grokTasks(),
  };
  const tasks = Object.values(groups).flat();
  const attachmentCount = tasks.reduce((n, t) => n + t.attachments.length, 0);

  printTable(tasks);
  console.log("");
  for (const [name, items] of Object.entries(groups)) console.log(`${name.padEnd(16)} ${items.length}`);
  console.log(`${"total".padEnd(16)} ${tasks.length} tasks, ${attachmentCount} attachments`);

  if (!APPLY) {
    console.log("\nDry run. Add --apply to post.");
    return 0;
  }

  const config = loadConfig();
  if (!config.secret) {
    console.error("[backfill] OPS_REPORT_SECRET is not set; nothing posted.");
    return 1;
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
  return failed ? 1 : 0;
}

main().then(
  (code) => process.exit(code),
  (error) => {
    console.error(`[backfill] ${error?.message ?? error}`);
    process.exit(1);
  },
);
