import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import { renderToStaticMarkup } from "react-dom/server";
import {
  COVERAGE_ROSTER,
  CoverageTable,
  Gallery,
  HooksSection,
  LONG_MESSAGE,
  TaskNarrative,
  TaskRowList,
  Timeline,
  activeHookCount,
  environmentShort,
  groupAttachments,
  mergeCoverage,
  parseProse,
  taskTone,
  tasksQuery,
} from "@/app/admin/TasksPanel";
import type { OpsAttachmentRow, OpsEventRow, OpsHooksInventory, OpsReporterRow, OpsTaskRow } from "@/server/contracts/ops-tasks";
import { TASKS, TASK_AGENT_LABEL, TASK_STATUS_LABEL } from "@/app/admin/lexicon";

/**
 * The task board, pinned two ways.
 *
 * Structurally over the sources, like the rest of the console's shell tests,
 * for the properties a first paint cannot show: which path the panel reads,
 * how often it polls, that a manual status change goes through PATCH and a
 * note, and that nothing in the panel completes a task on its own — the
 * board only ever *reads* completion the environment reported.
 *
 * And as rendered markup for the pure pieces — the row list, the gallery's
 * pairing, the coverage merge — because those are functions of their input
 * and `renderToStaticMarkup` shows exactly what an operator would read.
 */

const ROOT = process.cwd();
const read = (rel: string) => readFileSync(path.join(ROOT, rel), "utf8");

const NOW = Date.parse("2026-09-12T10:00:00Z");

function task(over: Partial<OpsTaskRow> = {}): OpsTaskRow {
  return {
    id: "t1", taskKey: "claude:abc", parentId: null, title: "Build the task board", request: null, goal: null,
    agent: "claude", environment: "/Users/owner/Documents/lions-of-zion-workspaces/claude", kind: "code", status: "running",
    summary: null, changes: null, remaining: null, blockers: null, nextStep: null, links: [], meta: {}, reportedFinish: false,
    startedAt: "2026-09-12T08:00:00Z", lastUpdateAt: "2026-09-12T09:50:00Z", finishedAt: null,
    createdAt: "2026-09-12T08:00:00Z", updatedAt: "2026-09-12T09:50:00Z",
    derived: { stale: false, unreported: false, eventCount: 3, attachmentCount: 2 },
    ...over,
  };
}

function attachment(over: Partial<OpsAttachmentRow> & { id: string }): OpsAttachmentRow {
  return { taskId: "t1", kind: "screenshot", url: `/ops/${over.id}.png`, contentType: "image/png", byteSize: 10, width: 800, height: 500, caption: null, pairKey: null, actorLabel: "service:ops-reporter:claude", createdAt: "2026-09-12T09:00:00Z", ...over };
}

describe("the task board (source)", () => {
  const shell = read("app/admin/OperationsConsole.tsx");
  const panel = read("app/admin/TasksPanel.tsx");

  it("is the first entry of the control group and receives the shared signal", () => {
    expect(shell).toContain('{ title: "בקרה", entries: [["tasks", "משימות ופעילות"]');
    expect(shell).toContain('area === "tasks" ? <TasksPanel signal={signal} />');
  });

  it("reads the list on a 30 s poll and the detail only while a drawer is open", () => {
    expect(panel).toContain("useConsoleRead<OpsTaskList>(path, { signal, pollInterval: 30_000 })");
    expect(panel.match(/pollInterval: 30_000/g)).toHaveLength(1);
    expect(panel).toContain("useConsoleRead<OpsTaskDetail>(`admin/console/tasks/${taskId ?? \"none\"}`, { enabled: taskId !== null })");
  });

  it("changes a status only by PATCH with a note, and never completes a task on its own", () => {
    expect(panel).toContain("callConsole(`admin/console/tasks/${task.id}`, { method: \"PATCH\", body: { status, note: text }");
    expect(panel).toContain("if (!text) { setNoteError(TASKS.needNote); return; }");
    /* Three manual verbs, each behind the same note, none of them automatic:
       no timer, no effect, no poll ever calls `mark`. */
    expect(panel.match(/mark\("(blocked|completed|cancelled)"/g)).toHaveLength(3);
    expect(panel).not.toMatch(/setInterval|setTimeout/);
    expect(panel).not.toMatch(/useEffect\([^)]*mark\(/);
    expect(panel).not.toContain("status: \"completed\" }");
  });

  it("imports the wire shapes from the contract rather than mirroring them", () => {
    expect(panel).toContain('from "@/server/contracts/ops-tasks"');
    expect(panel).not.toContain("TODO(integration)");
  });

  it("takes every word from the lexicon rather than retyping it", () => {
    for (const piece of ["TASK_STATUS_LABEL", "TASK_AGENT_LABEL", "TASK_KIND_LABEL", "TASK_EVENT_LABEL", "ATTACHMENT_KIND_LABEL", "TASKS."]) {
      expect(panel, piece).toContain(piece);
    }
    const lexicon = read("app/admin/lexicon.ts");
    for (const value of ["waiting", "blocked", "cancelled"]) expect(TASK_STATUS_LABEL[value]).toMatch(/[֐-׿]/);
    expect(lexicon).toContain("export const TASKS = {");
  });
});

describe("the row list", () => {
  it("renders status word, agent, short environment, age, attachment count and the markers", () => {
    const rows = [
      task(),
      task({ id: "t2", status: "waiting", derived: { stale: true, unreported: true, eventCount: 1, attachmentCount: 0 } }),
      task({ id: "t3", status: "completed", kind: "import", meta: { imported: true }, finishedAt: "2026-09-11T09:00:00Z" }),
    ];
    const html = renderToStaticMarkup(<TaskRowList tasks={rows} />);
    expect(html).toContain(TASK_STATUS_LABEL.running);
    expect(html).toContain(TASK_AGENT_LABEL.claude);
    expect(html).toContain(">claude<");
    /* The full path survives only as the title tooltip; the visible text is the directory name. */
    expect(html).not.toContain(">/Users/owner/Documents");
    expect(html).toContain(`${TASKS.attachments}: 2`);
    expect(html).toContain(TASKS.stale);
    expect(html).toContain(TASKS.unreported);
    expect(html).toContain(TASKS.imported);
    /* Every row is a real button with an accessible name, never a clickable div. */
    expect(html.match(/<button type="button" class="[^"]*"/g)).toHaveLength(3);
    expect(html).toContain(`aria-label="${TASKS.openDetail}: Build the task board"`);
  });

  it("does not flag a finished task as stale, whatever the derived flag says", () => {
    const html = renderToStaticMarkup(<TaskRowList tasks={[task({ status: "completed", derived: { stale: true, unreported: false, eventCount: 1, attachmentCount: 0 } })]} />);
    expect(html).not.toContain(TASKS.stale);
  });

  it("maps every status to a tone with a word beside it", () => {
    expect(taskTone("completed")).toBe("ok");
    expect(taskTone("running")).toBe("gold");
    expect(taskTone("blocked")).toBe("danger");
    expect(taskTone("cancelled")).toBe("neutral");
    expect(environmentShort("/a/b/claude/")).toBe("claude");
    expect(environmentShort("ci:github")).toBe("ci:github");
    expect(environmentShort(null)).toBe("—");
  });

  it("builds the list query from the applied filters and the keyset cursor", () => {
    expect(tasksQuery({ agent: "codex", status: "running", kind: "", from: "2026-09-01", to: "", q: "  board " }, "2026-09-10T00:00:00Z"))
      .toBe("admin/console/tasks?limit=40&before=2026-09-10T00%3A00%3A00Z&agent=codex&status=running&from=2026-09-01&q=board");
  });
});

describe("the gallery", () => {
  it("pairs before/after by pair_key and leaves everything else in the singles grid", () => {
    const all = [
      attachment({ id: "b1", kind: "before", pairKey: "hero", caption: "Hero, before" }),
      attachment({ id: "s1", kind: "screenshot", caption: "Board at 1280" }),
      attachment({ id: "a1", kind: "after", pairKey: "hero", caption: "Hero, after" }),
      attachment({ id: "b2", kind: "before", pairKey: "orphan" }),
      attachment({ id: "f1", kind: "file", url: "/ops/report.pdf", contentType: "application/pdf" }),
    ];
    const grouped = groupAttachments(all);
    expect(grouped.pairs.map((pair) => pair.pairKey)).toEqual(["hero"]);
    expect(grouped.singles.map((single) => single.id)).toEqual(["s1", "f1", "b2"]);

    const html = renderToStaticMarkup(<Gallery attachments={all} finished={false} />);
    expect(html).toContain(`aria-label="${TASKS.pair}: hero"`);
    expect(html.indexOf("Hero, before")).toBeLessThan(html.indexOf("Hero, after"));
    expect(html.match(/loading="lazy"/g)).toHaveLength(4);
    expect(html).toContain('alt="Hero, before"');
    expect(html).toContain('target="_blank" rel="noopener noreferrer"');
    expect(html).not.toContain("<img src=\"/ops/report.pdf\"");
  });

  it("says why nothing is shown, differently for a finished and an unfinished task", () => {
    expect(renderToStaticMarkup(<Gallery attachments={[]} finished />)).toContain(TASKS.noCaptureFinished);
    expect(renderToStaticMarkup(<Gallery attachments={[]} finished={false} />)).toContain(TASKS.noCapturePending);
  });
});

describe("the timeline and the narrative", () => {
  it("orders newest first and highlights a status change with both ends", () => {
    const events: OpsEventRow[] = [
      { id: "e1", taskId: "t1", eventKey: null, occurredAt: "2026-09-12T08:00:00Z", kind: "started", actorLabel: "service:ops-reporter:claude", fromStatus: null, toStatus: null, message: null, payload: null, createdAt: "2026-09-12T08:00:00Z" },
      { id: "e2", taskId: "t1", eventKey: null, occurredAt: "2026-09-12T09:00:00Z", kind: "status", actorLabel: "admin:owner", fromStatus: "running", toStatus: "blocked", message: "waiting on secret", payload: null, createdAt: "2026-09-12T09:00:00Z" },
    ];
    const html = renderToStaticMarkup(<Timeline events={events} />);
    expect(html.indexOf('data-kind="status"')).toBeLessThan(html.indexOf('data-kind="started"'));
    expect(html).toContain(`${TASK_STATUS_LABEL.running} ← ${TASK_STATUS_LABEL.blocked}`);
    expect(html).toContain("waiting on secret");
    expect(html.match(/class="[^"]*statusEvent[^"]*"/g)).toHaveLength(1);
  });

  it("shows only the narrative sections the environment reported, or one absence line", () => {
    const html = renderToStaticMarkup(<TaskNarrative task={task({ summary: "Wrote the panel", remaining: "Tests" })} />);
    expect(html).toContain(TASKS.fullReport);
    expect(html).toContain(TASKS.remaining);
    expect(html).not.toContain(TASKS.blockers);
    expect(renderToStaticMarkup(<TaskNarrative task={task()} />)).toContain(TASKS.noNarrative);
  });

  it("renders a narrative in full: paragraphs keep their line breaks and `- ` lines become one list", () => {
    const text = "First line\nsecond line\n\n- one\n- two\n* three\n\nTail";
    expect(parseProse(text)).toEqual([
      { kind: "paragraph", text: "First line\nsecond line" },
      { kind: "list", items: ["one", "two", "three"] },
      { kind: "paragraph", text: "Tail" },
    ]);
    const html = renderToStaticMarkup(<TaskNarrative task={task({ summary: text })} />);
    expect(html.match(/<li>/g)).toHaveLength(3);
    expect(html).toContain("<li>one</li>");
    expect(html).toContain("First line\nsecond line");
    /* No markdown: anything richer than a bullet is shown as typed. */
    expect(renderToStaticMarkup(<TaskNarrative task={task({ summary: "**bold** and `code`" })} />)).toContain("**bold** and `code`");
    const css = read("app/admin/tasks.module.css");
    expect(css).toMatch(/\.prose p \{[^}]*white-space: pre-wrap/);
  });

  it("clips a timeline message behind a toggle only past the long threshold", () => {
    const event = (id: string, message: string): OpsEventRow =>
      ({ id, taskId: "t1", eventKey: null, occurredAt: "2026-09-12T08:00:00Z", kind: "progress", actorLabel: "service:ops-reporter:claude", fromStatus: null, toStatus: null, message, payload: null, createdAt: "2026-09-12T08:00:00Z" });
    const short = renderToStaticMarkup(<Timeline events={[event("s", "x".repeat(LONG_MESSAGE))]} />);
    expect(short).not.toContain(TASKS.showAll);
    const long = renderToStaticMarkup(<Timeline events={[event("l", "y".repeat(LONG_MESSAGE + 1))]} />);
    expect(long).toContain(TASKS.showAll);
    expect(long).toContain('aria-expanded="false"');
    /* The full text is in the markup either way; the clip is CSS, never a substring. */
    expect(long).toContain("y".repeat(LONG_MESSAGE + 1));
  });
});

describe("the hooks inventory", () => {
  const inventory: OpsHooksInventory = {
    collectedAt: new Date().toISOString(),
    hostname: "daniels-mac",
    agent: "claude",
    tools: [
      {
        id: "claude", label: "Claude Code", status: "active", configPath: "/w/claude/.claude/settings.json",
        hooks: [
          { event: "SessionStart", command: "node scripts/ops/report.mjs start", source: ".claude/settings.json", timeout: 30 },
          { event: "Stop", command: "node scripts/ops/report.mjs finish", source: ".claude/settings.json", enabled: false, note: "off while testing" },
        ],
      },
      { id: "opencode", label: "OpenCode", status: "partial", note: "git post-commit only", hooks: [{ event: "post-commit", command: "ops-report commit", source: "~/.config/ai-dev/git-hooks" }] },
      { id: "gemini", label: "Gemini", status: "none", note: "no hook surface", hooks: [] },
    ],
  };

  it("counts tools and enabled hooks, and renders a card per tool in inventory order", () => {
    expect(activeHookCount(inventory)).toBe(2);
    const html = renderToStaticMarkup(<HooksSection inventory={inventory} />);
    expect(html).toContain(TASKS.hooksCount(3, 2));
    expect(html).toContain("daniels-mac");
    expect(html).toContain(TASK_AGENT_LABEL.claude);
    expect(html.match(/data-tool="/g)).toHaveLength(3);
    expect(html.indexOf('data-tool="claude"')).toBeLessThan(html.indexOf('data-tool="opencode"'));
    expect(html.indexOf('data-tool="opencode"')).toBeLessThan(html.indexOf('data-tool="gemini"'));
    /* The hook row: event, a left-to-right command, source and timeout. */
    expect(html).toContain("SessionStart");
    expect(html).toContain('dir="ltr">node scripts/ops/report.mjs start</code>');
    expect(html).toContain("30s");
    expect(html).toContain('data-enabled="false"');
    expect(html).toContain(TASKS.hookDisabled);
    expect(html).toContain("/w/claude/.claude/settings.json");
  });

  it("says partial and none in words, and a hookless tool is one line, not an empty table", () => {
    const html = renderToStaticMarkup(<HooksSection inventory={inventory} />);
    expect(html).toContain(`data-status="active"`);
    expect(html).toContain(TASKS.hookToolActive);
    expect(html).toContain(TASKS.hookToolPartial);
    expect(html).toContain(TASKS.hookToolNone);
    expect(html).toContain("no hook surface");
    expect(html.match(/<table /g)).toHaveLength(2);
  });

  it("shows one absence line when no reporter has sent an inventory yet", () => {
    const html = renderToStaticMarkup(<HooksSection inventory={null} />);
    expect(html).toContain(TASKS.hooksNone);
    expect(html).not.toContain("<table");
  });
});

describe("the coverage roster", () => {
  it("lists every environment, and calls one connected only on a recorded lastSeenAt", () => {
    const api: OpsReporterRow[] = [
      { agent: "claude", environment: "/w/claude", hostname: "mac", reporterVersion: "1", lastSeenAt: "2026-09-12T09:30:00Z", lastTaskId: null, meta: {} },
      { agent: "codex", environment: "/w/codex", hostname: "mac", reporterVersion: "1", lastSeenAt: "2026-09-09T09:30:00Z", lastTaskId: null, meta: {} },
      /* Off-contract on purpose: the schema says `lastSeenAt` is a string, and
         the merge still has to refuse to call a row without one connected. */
      { agent: "grok", environment: "/w/grok", hostname: "mac", reporterVersion: "1", lastSeenAt: null, lastTaskId: null, meta: {} } as unknown as OpsReporterRow,
    ];
    const rows = mergeCoverage(api, NOW);
    expect(rows.map((row) => row.agent)).toEqual(COVERAGE_ROSTER.map((entry) => entry.agent));
    expect(rows.find((row) => row.agent === "claude")).toMatchObject({ tone: "ok", stateWord: TASKS.connected });
    expect(rows.find((row) => row.agent === "codex")).toMatchObject({ tone: "warn", stateWord: TASKS.quiet });
    /* A row the API returned without a time is exactly as unconnected as one it never returned. */
    expect(rows.find((row) => row.agent === "grok")).toMatchObject({ tone: "neutral", stateWord: TASKS.notConnected, lastSeenAt: null });
    expect(rows.find((row) => row.agent === "github-actions")).toMatchObject({ stateWord: TASKS.notConnected });
    for (const entry of COVERAGE_ROSTER) expect(entry.missing.length, entry.agent).toBeGreaterThan(20);
  });

  it("renders the missing setting only for an environment that has never reported", () => {
    const html = renderToStaticMarkup(<CoverageTable coverage={[{ agent: "claude", environment: null, hostname: null, reporterVersion: null, lastSeenAt: new Date().toISOString(), lastTaskId: null, meta: {} }]} />);
    expect(html).toContain('data-agent="claude" data-connected="true"');
    expect(html).toContain('data-agent="codex" data-connected="false"');
    expect(html).toContain("~/.codex/config.toml");
    expect(html).not.toContain("ווים ב־.claude/settings.json");
    expect(html.match(/data-connected="false"/g)).toHaveLength(COVERAGE_ROSTER.length - 1);
  });
});
