"use client";

import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/Button";
import { Dialog } from "@/components/ui/Dialog";
import { Field } from "@/components/ui/Field";
import { SelectField } from "@/components/ui/SelectField";
import { Skeleton } from "@/components/ui/Skeleton";
import {
  AreaHead,
  ConsoleNotices,
  EmptyLine,
  Metric,
  PanelTitle,
  Pill,
  ReadGate,
  formatAgo,
  formatDate,
  useOperations,
  type PillTone,
} from "./console-primitives";
import { ATTACHMENT_KIND_LABEL, TASK_AGENT_LABEL, TASK_EVENT_LABEL, TASK_KIND_LABEL, TASK_STATUS_LABEL, TASKS, T } from "./lexicon";
import { callConsole, readConsole, useConsoleRead } from "./useConsoleRead";
import {
  OPS_AGENTS,
  OPS_TASK_KINDS,
  OPS_TASK_STATUSES,
  type OpsAgent,
  type OpsAttachmentRow,
  type OpsEventRow,
  type OpsHookTool,
  type OpsHooksInventory,
  type OpsManualStatus,
  type OpsReporterRow,
  type OpsTaskDetail,
  type OpsTaskList,
  type OpsTaskRow,
  type OpsTaskStatus,
} from "@/server/contracts/ops-tasks";
import styles from "./admin.module.css";
import own from "./tasks.module.css";

/* ── Words and tones ───────────────────────────────────────────────────── */

const AGENTS: readonly OpsAgent[] = OPS_AGENTS;
const STATUSES: readonly OpsTaskStatus[] = OPS_TASK_STATUSES;
const KINDS = OPS_TASK_KINDS;

export function taskTone(status: OpsTaskStatus): PillTone {
  if (status === "completed") return "ok";
  if (status === "running") return "gold";
  if (status === "waiting") return "warn";
  if (status === "blocked" || status === "failed") return "danger";
  return "neutral";
}

const statusWord = (status: string) => TASK_STATUS_LABEL[status] ?? status;
const agentWord = (agent: string) => TASK_AGENT_LABEL[agent] ?? agent;
const kindWord = (kind: string) => TASK_KIND_LABEL[kind] ?? kind;

/** The last path segment of a workspace path, or the value as given. An
 *  environment is a host or a checkout path; the operator recognises the
 *  checkout by its directory name and the full path only clutters a row. */
export function environmentShort(environment: string | null | undefined): string {
  if (!environment) return "—";
  const trimmed = environment.replace(/[\\/]+$/, "");
  const last = trimmed.split(/[\\/]/).pop();
  return last && last.length ? last : environment;
}

const isImported = (task: OpsTaskRow) => task.meta?.imported === true || task.kind === "import";

/* ── Coverage roster ───────────────────────────────────────────────────── */

export type CoverageEntry = {
  agent: OpsAgent;
  label: string;
  /** What has to exist on the owner's machine or in the repository before
   *  this environment can report at all. Shown only while it never has. */
  missing: string;
  /** Reports commits and manual CLI calls only, because the tool exposes no
   *  hook surface. Said on the row so a quiet one is not read as broken. */
  partial?: boolean;
};

export const COVERAGE_ROSTER: readonly CoverageEntry[] = [
  { agent: "claude", label: TASK_AGENT_LABEL.claude, missing: "ווים ב־.claude/settings.json של הפרויקט, ו־OPS_REPORT_SECRET ב־~/.config/ai-dev/ops-report.env." },
  { agent: "grok", label: TASK_AGENT_LABEL.grok, missing: "אותם ווים כמו Claude (Grok צורך את .claude/settings.json), ו־OPS_REPORT_SECRET ב־~/.config/ai-dev/ops-report.env." },
  { agent: "codex", label: TASK_AGENT_LABEL.codex, missing: "עטיפת notify ב־~/.codex/config.toml שמפנה ל־scripts/ops/codex-notify.mjs." },
  { agent: "opencode", label: TASK_AGENT_LABEL.opencode, missing: "וו git post-commit בלבד ב־~/.config/ai-dev/git-hooks — אין ווי סשן, ולכן הכיסוי חלקי מתוכנן.", partial: true },
  { agent: "gemini-agy", label: TASK_AGENT_LABEL["gemini-agy"], missing: "וו git post-commit בלבד ב־~/.config/ai-dev/git-hooks — אין ווי סשן, ולכן הכיסוי חלקי מתוכנן.", partial: true },
  { agent: "chatgpt-editorial", label: TASK_AGENT_LABEL["chatgpt-editorial"], missing: "נקרא מריצות מערכת העריכה; לא נדרש סוד. שורה ריקה פירושה שעדיין לא נמסרה חבילה." },
  { agent: "github-actions", label: TASK_AGENT_LABEL["github-actions"], missing: "סוד OPS_REPORT_SECRET במאגר GitHub, לעבודת report-ops ב־ci.yml." },
  { agent: "local-script", label: TASK_AGENT_LABEL["local-script"], missing: "הרצה של npm run ops:report עם OPS_REPORT_SECRET בסביבה." },
];

const DAY_MS = 24 * 60 * 60 * 1000;

export type CoverageRow = CoverageEntry & {
  lastSeenAt: string | null;
  environment: string | null;
  tone: PillTone;
  stateWord: string;
};

/** The roster merged with what the API has actually seen. An environment is
 *  connected only on the strength of a `lastSeenAt`; a roster entry with no
 *  API row, or an API row without a time, is not connected, whatever else
 *  the row says about itself. */
export function mergeCoverage(coverage: readonly OpsReporterRow[] | null | undefined, now = Date.now()): CoverageRow[] {
  const seen = new Map<string, OpsReporterRow>();
  for (const row of coverage ?? []) seen.set(row.agent, row);
  return COVERAGE_ROSTER.map((entry) => {
    const row = seen.get(entry.agent);
    const lastSeenAt = row?.lastSeenAt ?? null;
    const age = lastSeenAt ? now - new Date(lastSeenAt).getTime() : Number.NaN;
    if (!lastSeenAt || !Number.isFinite(age)) {
      return { ...entry, lastSeenAt: null, environment: row?.environment ?? null, tone: "neutral", stateWord: TASKS.notConnected };
    }
    return {
      ...entry,
      lastSeenAt,
      environment: row?.environment ?? null,
      tone: age > DAY_MS ? "warn" : "ok",
      stateWord: age > DAY_MS ? TASKS.quiet : TASKS.connected,
    };
  });
}

export function CoverageTable({ coverage }: { coverage: readonly OpsReporterRow[] | null | undefined }) {
  const rows = mergeCoverage(coverage);
  return (
    <div className={styles.tableWrap}>
      <table className={`${styles.table} ${own.coverageTable}`}>
        <caption className={styles.tableCaption}>{TASKS.coverageNote}</caption>
        <thead>
          <tr>
            <th scope="col">{TASKS.coverageEnvironment}</th>
            <th scope="col">{TASKS.coverageState}</th>
            <th scope="col">{TASKS.coverageLastSeen}</th>
            <th scope="col">{TASKS.coverageMissing}</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((row) => (
            <tr key={row.agent} data-agent={row.agent} data-connected={row.lastSeenAt ? "true" : "false"}>
              <th scope="row">
                {row.label}
                {row.environment ? <small className={styles.plainSmall}><bdi title={row.environment}>{environmentShort(row.environment)}</bdi></small> : null}
              </th>
              <td>
                <Pill tone={row.tone}>{row.stateWord}</Pill>
                {row.partial ? <small className={styles.plainSmall}>{TASKS.partial}</small> : null}
              </td>
              <td>{row.lastSeenAt ? formatAgo(row.lastSeenAt) : T.never}</td>
              <td className={own.missingCell}>{row.lastSeenAt ? (row.partial ? row.missing : "—") : row.missing}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/* ── Hooks inventory ───────────────────────────────────────────────────── */

const hookToolTone = (status: OpsHookTool["status"]): PillTone => (status === "active" ? "ok" : status === "partial" ? "warn" : "neutral");
const hookToolWord = (status: OpsHookTool["status"]) =>
  status === "active" ? TASKS.hookToolActive : status === "partial" ? TASKS.hookToolPartial : TASKS.hookToolNone;

/** Hooks the inventory says are switched on: `enabled` absent counts as on,
 *  because a collector that does not know the flag reports the hook as found. */
export const activeHookCount = (inventory: OpsHooksInventory) =>
  inventory.tools.reduce((sum, tool) => sum + tool.hooks.filter((hook) => hook.enabled !== false).length, 0);

function HookToolCard({ tool }: { tool: OpsHookTool }) {
  const bare = tool.status === "none" && tool.hooks.length === 0;
  return (
    <article className={own.hookCard} data-tool={tool.id} data-status={tool.status}>
      <div className={own.hookCardHead}>
        <strong>{tool.label}</strong>
        <Pill tone={hookToolTone(tool.status)}>{hookToolWord(tool.status)}</Pill>
      </div>
      {tool.configPath ? <code className={own.mono}><bdi>{tool.configPath}</bdi></code> : null}
      {tool.note ? <p className={styles.muted}>{tool.note}</p> : null}
      {bare ? null : (
        <div className={styles.tableWrap}>
          <table className={`${styles.table} ${own.hookTable}`}>
            <thead>
              <tr>
                <th scope="col">{TASKS.hookEvent}</th>
                <th scope="col">{TASKS.hookCommand}</th>
                <th scope="col">{TASKS.hookSource}</th>
                <th scope="col">{TASKS.hookTimeout}</th>
              </tr>
            </thead>
            <tbody>
              {tool.hooks.map((hook, index) => (
                <tr key={`${hook.event}-${index}`} data-enabled={hook.enabled === false ? "false" : "true"}>
                  <th scope="row"><bdi>{hook.event}</bdi>{hook.enabled === false ? <small className={styles.plainSmall}>{TASKS.hookDisabled}</small> : null}</th>
                  <td><code className={own.hookCommand} dir="ltr">{hook.command}</code>{hook.note ? <small className={styles.plainSmall}>{hook.note}</small> : null}</td>
                  <td><bdi>{hook.source}</bdi></td>
                  <td>{hook.timeout ? `${hook.timeout}s` : "—"}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </article>
  );
}

export function HooksSection({ inventory }: { inventory: OpsHooksInventory | null | undefined }) {
  if (!inventory) return <EmptyLine>{TASKS.hooksNone}</EmptyLine>;
  return (
    <div className={own.hooks}>
      <p className={styles.muted}>{TASKS.hooksCollected(formatAgo(inventory.collectedAt), inventory.hostname, agentWord(inventory.agent))}</p>
      <p className={own.hooksCount}>{TASKS.hooksCount(inventory.tools.length, activeHookCount(inventory))}</p>
      <div className={own.hooksGrid}>
        {inventory.tools.map((tool) => <HookToolCard key={tool.id} tool={tool} />)}
      </div>
    </div>
  );
}

/* ── Rows ──────────────────────────────────────────────────────────────── */

export function TaskRow({ task, onOpen }: { task: OpsTaskRow; onOpen?: (task: OpsTaskRow) => void }) {
  const title = task.title.trim() || task.taskKey;
  const finished = task.status === "completed" || task.status === "failed" || task.status === "cancelled";
  return (
    <li>
      <button type="button" className={own.taskRow} onClick={() => onOpen?.(task)} aria-label={`${TASKS.openDetail}: ${title}`} data-task-id={task.id}>
        <span className={own.rowStatus}><Pill tone={taskTone(task.status)}>{statusWord(task.status)}</Pill></span>
        <span className={own.rowMain}>
          <strong>{title}</strong>
          <small>
            {agentWord(task.agent)} · {kindWord(task.kind)} · <bdi title={task.environment}>{environmentShort(task.environment)}</bdi>
          </small>
        </span>
        <span className={own.rowMeta}>
          <small>{TASKS.lastUpdate}: {formatAgo(task.lastUpdateAt)}</small>
          <small>{TASKS.attachments}: {task.derived.attachmentCount}</small>
        </span>
        <span className={own.rowMarkers}>
          {task.derived.stale && !finished ? <Pill tone="warn">{TASKS.stale}</Pill> : null}
          {task.derived.unreported ? <Pill tone="danger">{TASKS.unreported}</Pill> : null}
          {isImported(task) ? <Pill tone="neutral">{TASKS.imported}</Pill> : null}
        </span>
      </button>
    </li>
  );
}

export function TaskRowList({ tasks, onOpen, label }: { tasks: readonly OpsTaskRow[]; onOpen?: (task: OpsTaskRow) => void; label?: string }) {
  return (
    <ul className={own.taskList} aria-label={label ?? TASKS.tasks}>
      {tasks.map((task) => <TaskRow key={task.id} task={task} onOpen={onOpen} />)}
    </ul>
  );
}

/* ── Gallery ───────────────────────────────────────────────────────────── */

export type AttachmentPair = { pairKey: string; before: OpsAttachmentRow | null; after: OpsAttachmentRow | null };

/** Before/after pairs first, in the order their first half arrived; every
 *  other attachment, pair-less or a pair with only one side, in the singles
 *  grid. A pair needs both halves to be read side by side — a lone `before`
 *  next to an empty slot claims a comparison nobody made. */
export function groupAttachments(attachments: readonly OpsAttachmentRow[]): { pairs: AttachmentPair[]; singles: OpsAttachmentRow[] } {
  const byKey = new Map<string, AttachmentPair>();
  const singles: OpsAttachmentRow[] = [];
  for (const attachment of attachments) {
    if (!attachment.pairKey || (attachment.kind !== "before" && attachment.kind !== "after")) { singles.push(attachment); continue; }
    const pair = byKey.get(attachment.pairKey) ?? { pairKey: attachment.pairKey, before: null, after: null };
    if (attachment.kind === "before" && !pair.before) pair.before = attachment;
    else if (attachment.kind === "after" && !pair.after) pair.after = attachment;
    else singles.push(attachment);
    byKey.set(attachment.pairKey, pair);
  }
  const pairs: AttachmentPair[] = [];
  for (const pair of byKey.values()) {
    if (pair.before && pair.after) pairs.push(pair);
    else singles.push(...[pair.before, pair.after].filter((half): half is OpsAttachmentRow => half !== null));
  }
  return { pairs, singles };
}

const isImage = (attachment: OpsAttachmentRow) =>
  attachment.contentType.startsWith("image/") || /\.(png|jpe?g|webp|gif)(\?|$)/i.test(attachment.url);

function AttachmentFigure({ attachment, roleWord }: { attachment: OpsAttachmentRow; roleWord?: string }) {
  const caption = attachment.caption?.trim() || `${ATTACHMENT_KIND_LABEL[attachment.kind] ?? attachment.kind} · ${formatDate(attachment.createdAt)}`;
  return (
    <figure className={own.figure}>
      <a href={attachment.url} target="_blank" rel="noopener noreferrer" aria-label={`${TASKS.openImage}: ${caption}`}>
        {isImage(attachment) ? (
          /* eslint-disable-next-line @next/next/no-img-element -- a screenshot
             on the editorial-media Blob store, not a page asset: no known
             dimensions to optimise for, and lazy-loaded behind a click. */
          <img src={attachment.url} alt={caption} loading="lazy" width={attachment.width ?? undefined} height={attachment.height ?? undefined} />
        ) : (
          <span className={own.fileTile}><bdi>{attachment.contentType}</bdi></span>
        )}
      </a>
      <figcaption>
        {roleWord ? <strong>{roleWord}</strong> : null}
        <span>{caption}</span>
      </figcaption>
    </figure>
  );
}

export function Gallery({ attachments, finished }: { attachments: readonly OpsAttachmentRow[]; finished: boolean }) {
  if (!attachments.length) return <EmptyLine>{finished ? TASKS.noCaptureFinished : TASKS.noCapturePending}</EmptyLine>;
  const { pairs, singles } = groupAttachments(attachments);
  return (
    <div className={own.gallery}>
      {pairs.map((pair) => (
        <div key={pair.pairKey} className={own.pair} role="group" aria-label={`${TASKS.pair}: ${pair.pairKey}`}>
          <AttachmentFigure attachment={pair.before!} roleWord={ATTACHMENT_KIND_LABEL.before} />
          <AttachmentFigure attachment={pair.after!} roleWord={ATTACHMENT_KIND_LABEL.after} />
        </div>
      ))}
      {singles.length ? (
        <div className={own.singles}>
          {singles.map((attachment) => <AttachmentFigure key={attachment.id} attachment={attachment} />)}
        </div>
      ) : null}
    </div>
  );
}

/* ── Prose ─────────────────────────────────────────────────────────────── */

export type ProseBlock = { kind: "paragraph"; text: string } | { kind: "list"; items: string[] };

/**
 * A narrative field, split into the two shapes a report actually uses: runs
 * of `- ` lines become one list, everything else is a paragraph that keeps
 * its line breaks. No markdown library — the reporter writes plain text with
 * bullets, and anything richer would be rendered literally, which is the
 * right failure for a report an operator has to trust verbatim.
 */
export function parseProse(text: string): ProseBlock[] {
  const blocks: ProseBlock[] = [];
  let paragraph: string[] = [];
  let list: string[] | null = null;
  const flushParagraph = () => { if (paragraph.length) { blocks.push({ kind: "paragraph", text: paragraph.join("\n") }); paragraph = []; } };
  const flushList = () => { if (list) { blocks.push({ kind: "list", items: list }); list = null; } };
  for (const raw of text.replace(/\r\n?/g, "\n").split("\n")) {
    const line = raw.trimEnd();
    const bullet = /^\s*[-*•]\s+(.*)$/.exec(line);
    if (bullet) { flushParagraph(); (list ??= []).push(bullet[1]); continue; }
    flushList();
    if (!line.trim()) { flushParagraph(); continue; }
    paragraph.push(line);
  }
  flushParagraph();
  flushList();
  return blocks;
}

export function Prose({ text }: { text: string }) {
  const blocks = parseProse(text);
  return (
    <div className={own.prose}>
      {blocks.map((block, index) =>
        block.kind === "list" ? (
          <ul key={index} className={own.proseList}>{block.items.map((item, i) => <li key={i}>{item}</li>)}</ul>
        ) : (
          <p key={index}>{block.text}</p>
        ),
      )}
    </div>
  );
}

/** A message longer than this is clipped behind a toggle; shorter ones are
 *  shown in full with no control at all, so a short timeline stays short. */
export const LONG_MESSAGE = 600;

export function EventMessage({ message }: { message: string }) {
  const [open, setOpen] = useState(false);
  const long = message.length > LONG_MESSAGE;
  return (
    <span className={own.eventMessage}>
      <span className={long && !open ? own.clipped : undefined}>{message}</span>
      {long ? (
        <button type="button" className={own.expandButton} aria-expanded={open} onClick={() => setOpen((current) => !current)}>
          {open ? TASKS.showLess : TASKS.showAll}
        </button>
      ) : null}
    </span>
  );
}

/* ── Timeline ──────────────────────────────────────────────────────────── */

export function Timeline({ events }: { events: readonly OpsEventRow[] }) {
  if (!events.length) return <EmptyLine>{TASKS.timelineEmpty}</EmptyLine>;
  const ordered = [...events].sort((a, b) => new Date(b.occurredAt).getTime() - new Date(a.occurredAt).getTime());
  return (
    <ol className={own.timeline}>
      {ordered.map((event) => {
        const transition = event.kind === "status" || (event.fromStatus && event.toStatus && event.fromStatus !== event.toStatus);
        return (
          <li key={event.id} className={transition ? own.statusEvent : undefined} data-kind={event.kind}>
            <span className={own.eventWhen}>{formatDate(event.occurredAt)}</span>
            <span className={own.eventBody}>
              <strong>
                {TASK_EVENT_LABEL[event.kind] ?? event.kind}
                {event.fromStatus || event.toStatus ? (
                  <span className={own.fromTo}> {event.fromStatus ? statusWord(event.fromStatus) : "—"} ← {event.toStatus ? statusWord(event.toStatus) : "—"}</span>
                ) : null}
              </strong>
              {event.message ? <EventMessage message={event.message} /> : null}
              {event.actorLabel ? <small><bdi>{event.actorLabel}</bdi></small> : null}
            </span>
          </li>
        );
      })}
    </ol>
  );
}

/* ── Detail ────────────────────────────────────────────────────────────── */


const NARRATIVE: ReadonlyArray<[keyof Pick<OpsTaskRow, "request" | "goal" | "summary" | "changes" | "remaining" | "blockers" | "nextStep">, string]> = [
  ["request", TASKS.request],
  ["goal", TASKS.goal],
  ["summary", TASKS.fullReport],
  ["changes", TASKS.changes],
  ["remaining", TASKS.remaining],
  ["blockers", TASKS.blockers],
  ["nextStep", TASKS.nextStep],
];

export function TaskNarrative({ task }: { task: OpsTaskRow }) {
  const present = NARRATIVE.filter(([key]) => (task[key] ?? "").trim().length > 0);
  if (!present.length) return <EmptyLine>{TASKS.noNarrative}</EmptyLine>;
  return (
    <dl className={own.narrative}>
      {present.map(([key, label]) => (
        <div key={key}>
          <dt>{label}</dt>
          <dd><Prose text={task[key] ?? ""} /></dd>
        </div>
      ))}
    </dl>
  );
}

function TaskDetailBody({ detail, onOpenChild, onChanged }: { detail: OpsTaskDetail; onOpenChild: (task: OpsTaskRow) => void; onChanged: () => void }) {
  const { task, events, attachments, children } = detail;
  const finished = task.finishedAt !== null || task.status === "completed" || task.status === "failed" || task.status === "cancelled";
  const ops = useOperations();
  const [note, setNote] = useState("");
  const [noteError, setNoteError] = useState<string | null>(null);

  async function mark(status: OpsManualStatus, label: string) {
    const text = note.trim();
    if (!text) { setNoteError(TASKS.needNote); return; }
    setNoteError(null);
    await ops.run(`task:${task.id}:${status}`, async () => {
      await callConsole(`admin/console/tasks/${task.id}`, { method: "PATCH", body: { status, note: text }, failure: TASKS.patchFailure });
      setNote("");
      onChanged();
      return `${label}: ${task.title.trim() || task.taskKey}.`;
    });
  }

  return (
    <div className={own.detail}>
      <div className={own.detailHead}>
        <div className={own.detailPills}>
          <Pill tone={taskTone(task.status)}>{statusWord(task.status)}</Pill>
          <Pill tone="neutral">{agentWord(task.agent)}</Pill>
          <Pill tone="neutral">{kindWord(task.kind)}</Pill>
          {task.derived.unreported ? <Pill tone="danger">{TASKS.unreported}</Pill> : null}
          {isImported(task) ? <Pill tone="neutral">{TASKS.imported}</Pill> : null}
        </div>
        <dl className={own.facts}>
          <div><dt>{TASKS.environment}</dt><dd><bdi title={task.environment}>{task.environment}</bdi></dd></div>
          <div><dt>{TASKS.taskKey}</dt><dd><code className={own.mono}><bdi>{task.taskKey}</bdi></code></dd></div>
          <div><dt>{TASKS.started}</dt><dd>{formatDate(task.startedAt)}</dd></div>
          <div><dt>{TASKS.lastUpdate}</dt><dd>{formatDate(task.lastUpdateAt)}</dd></div>
          <div><dt>{TASKS.finished}</dt><dd>{task.finishedAt ? formatDate(task.finishedAt) : "—"}</dd></div>
        </dl>
      </div>

      <section className={own.section} aria-labelledby={`task-${task.id}-narrative`}>
        <h3 id={`task-${task.id}-narrative`} className={styles.sectionLabel}>{TASKS.request} · {TASKS.fullReport} · {TASKS.remaining}</h3>
        <TaskNarrative task={task} />
      </section>

      {task.links.length ? (
        <section className={own.section} aria-labelledby={`task-${task.id}-links`}>
          <h3 id={`task-${task.id}-links`} className={styles.sectionLabel}>{TASKS.links}</h3>
          <ul className={own.linkList}>
            {task.links.map((link, index) => (
              <li key={`${link.url}-${index}`}><a href={link.url} target="_blank" rel="noopener noreferrer">{link.label || link.url}</a></li>
            ))}
          </ul>
        </section>
      ) : null}

      <section className={own.section} aria-labelledby={`task-${task.id}-timeline`}>
        <h3 id={`task-${task.id}-timeline`} className={styles.sectionLabel}>{TASKS.timeline}</h3>
        <Timeline events={events} />
      </section>

      <section className={own.section} aria-labelledby={`task-${task.id}-gallery`}>
        <h3 id={`task-${task.id}-gallery`} className={styles.sectionLabel}>{TASKS.gallery}</h3>
        <Gallery attachments={attachments} finished={finished} />
      </section>

      <section className={own.section} aria-labelledby={`task-${task.id}-children`}>
        <h3 id={`task-${task.id}-children`} className={styles.sectionLabel}>{TASKS.children}</h3>
        {children.length ? <TaskRowList tasks={children} onOpen={onOpenChild} label={TASKS.children} /> : <EmptyLine>{TASKS.childrenEmpty}</EmptyLine>}
      </section>

      <section className={`${own.section} ${own.actions}`} aria-labelledby={`task-${task.id}-actions`}>
        <h3 id={`task-${task.id}-actions`} className={styles.sectionLabel}>{TASKS.manualActions}</h3>
        <p className={styles.muted}>{TASKS.manualNote}</p>
        <ConsoleNotices busy={ops.busy} notice={ops.notice} idPrefix={`task-${task.id}`} />
        <Field
          className={styles.editorField}
          name="note"
          label={TASKS.note}
          description={TASKS.noteRequired}
          required
          maxLength={2000}
          value={note}
          error={noteError}
          disabled={ops.disabled}
          onChange={(event) => { setNote(event.currentTarget.value); if (noteError) setNoteError(null); }}
        />
        <div className={styles.actionRow}>
          <Button variant="secondary" type="button" disabled={ops.disabled} isLoading={ops.busy === `task:${task.id}:blocked`} onClick={() => mark("blocked", TASKS.markBlocked)}>{TASKS.markBlocked}</Button>
          <Button variant="secondary" type="button" disabled={ops.disabled} isLoading={ops.busy === `task:${task.id}:completed`} onClick={() => mark("completed", TASKS.markCompleted)}>{TASKS.markCompleted}</Button>
          <Button variant="danger" type="button" disabled={ops.disabled} isLoading={ops.busy === `task:${task.id}:cancelled`} onClick={() => mark("cancelled", TASKS.markCancelled)}>{TASKS.markCancelled}</Button>
        </div>
      </section>
    </div>
  );
}

function TaskDrawer({ taskId, onClose, onOpenChild, onListChanged }: { taskId: string | null; onClose: () => void; onOpenChild: (task: OpsTaskRow) => void; onListChanged: () => void }) {
  const detail = useConsoleRead<OpsTaskDetail>(`admin/console/tasks/${taskId ?? "none"}`, { enabled: taskId !== null });
  const title = detail.value?.task.title.trim() || detail.value?.task.taskKey || TASKS.detailWhat;
  return (
    <Dialog open={taskId !== null} onClose={onClose} variant="drawer" size="wide" title={title} closeLabel={TASKS.closeDetail} dismissOnBackdrop={false}>
      {taskId !== null ? (
        <ReadGate state={detail.state} what={TASKS.detailWhat} reload={detail.reload} skeleton={<Skeleton shape="block" height="24rem" />}>
          {(value) => <TaskDetailBody detail={value} onOpenChild={onOpenChild} onChanged={() => { detail.reload(); onListChanged(); }} />}
        </ReadGate>
      ) : null}
    </Dialog>
  );
}

/* ── The list ──────────────────────────────────────────────────────────── */

type Filters = { agent: string; status: string; kind: string; from: string; to: string; q: string };
const EMPTY_FILTERS: Filters = { agent: "", status: "", kind: "", from: "", to: "", q: "" };

export function tasksQuery(filters: Filters, before: string | null): string {
  const params = new URLSearchParams();
  params.set("limit", "40");
  if (before) params.set("before", before);
  if (filters.agent) params.set("agent", filters.agent);
  if (filters.status) params.set("status", filters.status);
  if (filters.kind) params.set("kind", filters.kind);
  if (filters.from) params.set("from", filters.from);
  if (filters.to) params.set("to", filters.to);
  if (filters.q.trim()) params.set("q", filters.q.trim());
  return `admin/console/tasks?${params.toString()}`;
}

/**
 * The task board: every environment's reported work, one row per task, a
 * drawer per row, and the coverage table that says who is actually
 * reporting. The first page polls every 30 s; older pages are appended by
 * keyset and survive a poll — a refreshed first page is merged in front of
 * them by id rather than replacing them.
 */
export function TasksPanel({ signal }: { signal: number }) {
  const [filters, setFilters] = useState<Filters>(EMPTY_FILTERS);
  const [applied, setApplied] = useState<Filters>(EMPTY_FILTERS);
  const [older, setOlder] = useState<{ rows: OpsTaskRow[]; nextBefore: string | null; loading: boolean; error: string | null }>({ rows: [], nextBefore: null, loading: false, error: null });
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const areaRef = useRef<HTMLElement | null>(null);
  const path = tasksQuery(applied, null);
  const list = useConsoleRead<OpsTaskList>(path, { signal, pollInterval: 30_000 });

  useEffect(() => { setOlder({ rows: [], nextBefore: null, loading: false, error: null }); }, [path]);

  async function loadMore(firstPageBefore: string | null | undefined) {
    const before = older.rows.length ? older.nextBefore : firstPageBefore ?? null;
    if (!before) return;
    setOlder((current) => ({ ...current, loading: true, error: null }));
    try {
      const page = await readConsole<OpsTaskList>(tasksQuery(applied, before));
      setOlder((current) => ({ rows: [...current.rows, ...page.tasks], nextBefore: page.nextBefore ?? null, loading: false, error: null }));
    } catch (cause) {
      setOlder((current) => ({ ...current, loading: false, error: cause instanceof Error ? cause.message : TASKS.patchFailure }));
    }
  }

  const select = (task: OpsTaskRow) => setSelectedId(task.id);

  return (
    <section className={styles.area} id="console-tasks" aria-labelledby="console-tasks-heading" ref={areaRef} tabIndex={-1}>
      <AreaHead id="console-tasks" label={TASKS.areaLabel} title={TASKS.areaTitle} note={TASKS.areaNote} />

      <form
        className={styles.filterRow}
        aria-label={TASKS.filterLabel}
        noValidate
        onSubmit={(event) => { event.preventDefault(); setApplied(filters); }}
      >
        <SelectField className={styles.editorField} label={TASKS.filterAgent} value={filters.agent} onChange={(event) => setFilters({ ...filters, agent: event.target.value })}>
          <option value="">{TASKS.filterAll}</option>
          {AGENTS.map((agent) => <option key={agent} value={agent}>{agentWord(agent)}</option>)}
        </SelectField>
        <SelectField className={styles.editorField} label={TASKS.filterStatus} value={filters.status} onChange={(event) => setFilters({ ...filters, status: event.target.value })}>
          <option value="">{TASKS.filterAll}</option>
          {STATUSES.map((status) => <option key={status} value={status}>{statusWord(status)}</option>)}
        </SelectField>
        <SelectField className={styles.editorField} label={TASKS.filterKind} value={filters.kind} onChange={(event) => setFilters({ ...filters, kind: event.target.value })}>
          <option value="">{TASKS.filterAll}</option>
          {KINDS.map((kind) => <option key={kind} value={kind}>{kindWord(kind)}</option>)}
        </SelectField>
        <Field className={styles.editorField} type="date" label={TASKS.filterFrom} value={filters.from} onChange={(event) => setFilters({ ...filters, from: event.currentTarget.value })} />
        <Field className={styles.editorField} type="date" label={TASKS.filterTo} value={filters.to} onChange={(event) => setFilters({ ...filters, to: event.currentTarget.value })} />
        <Field className={styles.editorField} type="search" label={TASKS.filterSearch} value={filters.q} maxLength={200} onChange={(event) => setFilters({ ...filters, q: event.currentTarget.value })} />
        <div className={styles.filterActions}>
          <Button variant="secondary" type="submit" disabled={list.refreshing}>{T.applyFilters}</Button>
          <Button variant="ghost" type="button" onClick={() => { setFilters(EMPTY_FILTERS); setApplied(EMPTY_FILTERS); }}>{T.clear}</Button>
        </div>
      </form>

      <ReadGate state={list.state} what={TASKS.what} reload={list.reload}>
        {(value) => {
          const seen = new Set(value.tasks.map((task) => task.id));
          const rows = [...value.tasks, ...older.rows.filter((task) => !seen.has(task.id))];
          const nextBefore = older.rows.length ? older.nextBefore : value.nextBefore ?? null;
          return (
            <>
              <div className={styles.compactMetrics}>
                <Metric label={TASKS.running} value={String(value.summary.running)} tone={value.summary.running ? "gold" : undefined} />
                <Metric label={TASKS.blocked} value={String(value.summary.blocked)} tone={value.summary.blocked ? "danger" : undefined} />
                <Metric label={TASKS.waiting} value={String(value.summary.waiting)} tone={value.summary.waiting ? "warn" : undefined} />
                <Metric label={TASKS.completedToday} value={String(value.summary.completedToday)} tone={value.summary.completedToday ? "ok" : undefined} />
              </div>
              {value.summary.unreported > 0 ? (
                <p className={styles.warnNote}><Pill tone="warn">{TASKS.unreported}: {value.summary.unreported}</Pill> {TASKS.unreportedNote}.</p>
              ) : null}

              {rows.length ? (
                <>
                  <TaskRowList tasks={rows} onOpen={select} />
                  <div className={styles.actionRow}>
                    {nextBefore ? (
                      <Button variant="secondary" type="button" isLoading={older.loading} onClick={() => loadMore(value.nextBefore)}>{TASKS.more}</Button>
                    ) : (
                      <p className={styles.muted}>{TASKS.endOfList}</p>
                    )}
                    {older.error ? <p className={styles.error} role="alert">{older.error}</p> : null}
                  </div>
                </>
              ) : (
                <EmptyLine>{TASKS.empty}</EmptyLine>
              )}

              <div className={styles.panel}>
                <PanelTitle>{TASKS.coverage}</PanelTitle>
                <CoverageTable coverage={value.coverage} />
              </div>

              <div className={styles.panel} data-section="hooks">
                <PanelTitle>{TASKS.hooks}</PanelTitle>
                <HooksSection inventory={value.hooksInventory} />
              </div>
            </>
          );
        }}
      </ReadGate>

      <TaskDrawer taskId={selectedId} onClose={() => setSelectedId(null)} onOpenChild={select} onListChanged={list.reload} />
    </section>
  );
}

export type { Filters as TaskFilters };
