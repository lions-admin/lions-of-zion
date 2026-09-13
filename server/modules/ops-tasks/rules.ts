/**
 * Board policy with no database in it.
 *
 * What is "stale", what is "unreported", which manual transitions a human
 * may make, how a reporter's event names map to the timeline, and how the
 * ChatGPT editorial run's own statuses read on this board. Pure functions,
 * unit-tested directly.
 */

import {
  opsHooksInventorySchema,
  type OpsEventKind,
  type OpsHooksInventory,
  type OpsManualStatus,
  type OpsReportEvent,
  type OpsTaskStatus,
} from "@/server/contracts/ops-tasks";

/** A running or waiting task with nothing heard for this long is stale. */
export const STALE_AFTER_MINUTES = 30;

const LIVE: ReadonlySet<OpsTaskStatus> = new Set(["running", "waiting"]);
const TERMINAL: ReadonlySet<OpsTaskStatus> = new Set(["completed", "failed", "cancelled"]);

export const isTerminalStatus = (status: OpsTaskStatus): boolean => TERMINAL.has(status);

export type DerivableTask = {
  status: OpsTaskStatus;
  lastUpdateAt: Date;
  reportedFinish: boolean;
  meta: Record<string, unknown>;
};

/**
 * `stale`: live, and silent past the threshold.
 * `unreported`: live, the reporter's session ended (`meta.sessionEnded`),
 * and no `finish` ever came. The second is the honest state of a Claude
 * session that closed without reporting; nothing here upgrades it to
 * `completed`.
 */
export function deriveFlags(task: DerivableTask, now: Date): { stale: boolean; unreported: boolean } {
  const live = LIVE.has(task.status);
  const silentFor = now.getTime() - task.lastUpdateAt.getTime();
  const stale = live && silentFor > STALE_AFTER_MINUTES * 60_000;
  const unreported = live && task.meta.sessionEnded === true && !task.reportedFinish;
  return { stale, unreported };
}

/**
 * What a human may do from the console. Cancelling and completing by hand
 * are allowed from any non-terminal state; a completed task may still be
 * cancelled (it was wrong); blocked/waiting are only ever set on live work.
 */
export function allowedManualTransition(from: OpsTaskStatus, to: OpsManualStatus): boolean {
  switch (to) {
    case "cancelled":
      return from !== "cancelled";
    case "completed":
      return !TERMINAL.has(from);
    case "blocked":
    case "waiting":
      return !TERMINAL.has(from) && from !== to;
  }
}

export function eventKindFor(event: OpsReportEvent): OpsEventKind {
  switch (event) {
    case "start":
      return "started";
    case "finish":
      return "finished";
    default:
      return event;
  }
}

/**
 * The status a report implies, or `null` when it leaves status alone.
 * `finish` without a status is `completed`; `start` without one is
 * `running`; `status` requires one (the contract cannot express that, so the
 * service refuses it).
 */
export function statusImpliedBy(event: OpsReportEvent, given: OpsTaskStatus | undefined): OpsTaskStatus | null {
  if (given) return given;
  if (event === "finish") return "completed";
  if (event === "start") return "running";
  return null;
}

/**
 * The newest hooks inventory across every reporter's `meta.hooksInventory`,
 * by `collectedAt`. A stored value that no longer parses (an older shape) is
 * skipped rather than failing the whole list.
 */
export function newestHooksInventory(reporters: ReadonlyArray<{ meta: Record<string, unknown> }>): OpsHooksInventory | null {
  let newest: OpsHooksInventory | null = null;
  for (const reporter of reporters) {
    const parsed = opsHooksInventorySchema.safeParse(reporter.meta.hooksInventory);
    if (!parsed.success) continue;
    if (!newest || Date.parse(parsed.data.collectedAt) > Date.parse(newest.collectedAt)) newest = parsed.data;
  }
  return newest;
}

/** How an `editorial_run` status reads on this board. */
export function editorialRunStatus(status: string): OpsTaskStatus {
  switch (status) {
    case "queued":
      return "queued";
    case "running":
      return "running";
    case "completed":
    case "partial":
      return "completed";
    case "failed":
      return "failed";
    default:
      return "queued";
  }
}

/* ── Israel-local calendar days ─────────────────────────────────────────── */

const ISRAEL = "Asia/Jerusalem";

function israelOffsetMinutes(at: Date): number {
  const parts = new Intl.DateTimeFormat("en-US", {
    timeZone: ISRAEL,
    hourCycle: "h23",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
  }).formatToParts(at);
  const get = (type: string) => Number(parts.find((part) => part.type === type)?.value ?? "0");
  const asUtc = Date.UTC(get("year"), get("month") - 1, get("day"), get("hour"), get("minute"), get("second"));
  return Math.round((asUtc - at.getTime()) / 60_000);
}

/** The instant an Israel-local calendar day (`YYYY-MM-DD`) begins. */
export function israelDayStart(date: string): Date {
  const guess = new Date(`${date}T00:00:00Z`);
  return new Date(guess.getTime() - israelOffsetMinutes(guess) * 60_000);
}

/** The instant the day after an Israel-local calendar day begins. */
export function israelDayEnd(date: string): Date {
  const next = new Date(`${date}T00:00:00Z`);
  next.setUTCDate(next.getUTCDate() + 1);
  return israelDayStart(next.toISOString().slice(0, 10));
}

export function israelLocalDate(at: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: ISRAEL,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(at);
}
