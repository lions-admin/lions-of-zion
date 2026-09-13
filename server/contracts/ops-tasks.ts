/**
 * The operations task board — one record per task, from every agent.
 *
 * The write side is `opsReportSchema`: a reporter (a Claude hook, the Codex
 * notify wrapper, a git post-commit hook, a CI job, a human at a CLI) posts
 * lines that name a stable `taskKey` and say what happened. The read side is
 * what the admin console lists and opens. Both are here, zod only, so the
 * admin panel, the reporter CLI and the tests can share one definition
 * without touching a database.
 *
 * Two rules the shapes encode on purpose:
 *
 *   - A task is never completed by inference. `completed` arrives only as a
 *     `finish` report (or a manual patch). A silent session stays `running`
 *     and shows as unreported.
 *   - `eventKey` is the retry key. A reporter spools offline and replays;
 *     the same key on the same task is ignored, so a replay is a no-op.
 */

import { z } from "zod";

export const OPS_AGENTS = [
  "claude",
  "codex",
  "grok",
  "opencode",
  "gemini-agy",
  "chatgpt-editorial",
  "github-actions",
  "local-script",
  "human",
  "unknown",
] as const;
export type OpsAgent = (typeof OPS_AGENTS)[number];

export const OPS_TASK_KINDS = [
  "code",
  "editorial",
  "design",
  "ops",
  "research",
  "review",
  "import",
  "other",
] as const;
export type OpsTaskKind = (typeof OPS_TASK_KINDS)[number];

export const OPS_TASK_STATUSES = [
  "queued",
  "running",
  "waiting",
  "blocked",
  "completed",
  "failed",
  "cancelled",
] as const;
export type OpsTaskStatus = (typeof OPS_TASK_STATUSES)[number];

export const OPS_EVENT_KINDS = [
  "started",
  "progress",
  "status",
  "note",
  "attachment",
  "finished",
  "heartbeat",
  "commit",
  "ci",
  "import",
] as const;
export type OpsEventKind = (typeof OPS_EVENT_KINDS)[number];

export const OPS_ATTACHMENT_KINDS = ["screenshot", "before", "after", "artifact", "file"] as const;
export type OpsAttachmentKind = (typeof OPS_ATTACHMENT_KINDS)[number];

/** What a reporter may say happened. Mapped to `OPS_EVENT_KINDS` by the
 *  service: `start` → `started`, `finish` → `finished`, the rest by name. */
export const OPS_REPORT_EVENTS = [
  "start",
  "progress",
  "status",
  "note",
  "finish",
  "heartbeat",
  "commit",
  "ci",
] as const;
export type OpsReportEvent = (typeof OPS_REPORT_EVENTS)[number];

/** The statuses a human may set from the console. */
export const OPS_MANUAL_STATUSES = ["cancelled", "completed", "blocked", "waiting"] as const;
export type OpsManualStatus = (typeof OPS_MANUAL_STATUSES)[number];

export const OPS_ATTACHMENT_CONTENT_TYPES = [
  "image/png",
  "image/jpeg",
  "image/webp",
  "image/gif",
  "application/pdf",
  "text/plain",
  "text/markdown",
  "application/json",
] as const;
export type OpsAttachmentContentType = (typeof OPS_ATTACHMENT_CONTENT_TYPES)[number];

/** Base64 text, ~6.5 MB. Vercel caps a function body at 4.5 MB anyway; this
 *  is the schema's own ceiling so a runaway upload fails at parse time. */
export const OPS_ATTACHMENT_MAX_BASE64_CHARS = 6_500_000;
/** Decoded bytes accepted by the service. */
export const OPS_ATTACHMENT_MAX_BYTES = 5 * 1024 * 1024;
/** Serialized `meta` ceiling. */
export const OPS_META_MAX_BYTES = 8 * 1024;

const isoDate = z.string();
const nullableIsoDate = isoDate.nullable();
const text = (max: number) => z.string().trim().min(1).max(max);

export const opsLinkSchema = z.object({
  label: text(200),
  url: z.string().trim().url().max(2000).refine((value) => /^https?:\/\//.test(value), {
    message: "Only http(s) links are accepted.",
  }),
}).strict();
export type OpsLink = z.infer<typeof opsLinkSchema>;

/** A stored link as read back. Looser than the write side on purpose: the
 *  editorial-run merge carries a site-relative link to its own console area. */
export const opsLinkRowSchema = z.object({ label: z.string(), url: z.string() });

const metaSchema = z.record(z.string(), z.unknown()).refine(
  (value) => JSON.stringify(value).length <= OPS_META_MAX_BYTES,
  { message: `meta must serialize to at most ${OPS_META_MAX_BYTES} bytes.` },
);

/* ── Write side ─────────────────────────────────────────────────────────── */

/** One report line. A batch is `{ reports: OpsReport[] }`. */
export const opsReportSchema = z.object({
  /** Client idempotency id; the same key on the same task is a no-op replay. */
  eventKey: text(120).optional(),
  taskKey: text(200),
  /** A sub-action files under its parent; the parent is created on first sight. */
  parentKey: text(200).optional(),
  agent: z.enum(OPS_AGENTS),
  environment: text(300),
  hostname: text(200).optional(),
  reporterVersion: text(60).optional(),
  event: z.enum(OPS_REPORT_EVENTS),
  occurredAt: z.iso.datetime({ offset: true }).optional(),
  title: text(300).optional(),
  request: text(4000).optional(),
  goal: text(2000).optional(),
  kind: z.enum(OPS_TASK_KINDS).optional(),
  /** With `status`: the new status. With `finish`: defaults to `completed`
   *  unless given (`failed`, `cancelled`). */
  status: z.enum(OPS_TASK_STATUSES).optional(),
  summary: text(8000).optional(),
  changes: text(8000).optional(),
  remaining: text(4000).optional(),
  blockers: text(4000).optional(),
  nextStep: text(2000).optional(),
  /** progress / note / commit / ci text. */
  message: text(4000).optional(),
  links: z.array(opsLinkSchema).max(50).optional(),
  meta: metaSchema.optional(),
}).strict();
export type OpsReport = z.infer<typeof opsReportSchema>;

export const opsReportBatchSchema = z.object({
  reports: z.array(opsReportSchema).min(1).max(200),
}).strict();
export type OpsReportBatch = z.infer<typeof opsReportBatchSchema>;

export const opsAttachmentUploadSchema = z.object({
  taskKey: text(200),
  kind: z.enum(OPS_ATTACHMENT_KINDS),
  caption: text(1000).optional(),
  /** Links a `before` and an `after` so the console shows them side by side. */
  pairKey: text(120).optional(),
  contentType: z.enum(OPS_ATTACHMENT_CONTENT_TYPES),
  dataBase64: z.string().min(1).max(OPS_ATTACHMENT_MAX_BASE64_CHARS),
  width: z.number().int().positive().optional(),
  height: z.number().int().positive().optional(),
  eventKey: text(120).optional(),
}).strict();
export type OpsAttachmentUpload = z.infer<typeof opsAttachmentUploadSchema>;

/* ── Read side ──────────────────────────────────────────────────────────── */

export const opsTaskDerivedSchema = z.object({
  /** running/waiting with nothing heard for `STALE_AFTER_MINUTES`. */
  stale: z.boolean(),
  /** running/waiting, the reporter's session ended, and no `finish` came. */
  unreported: z.boolean(),
  eventCount: z.number().int().nonnegative(),
  attachmentCount: z.number().int().nonnegative(),
});
export type OpsTaskDerived = z.infer<typeof opsTaskDerivedSchema>;

export const opsTaskRowSchema = z.object({
  id: z.string(),
  taskKey: z.string(),
  parentId: z.string().nullable(),
  title: z.string(),
  request: z.string().nullable(),
  goal: z.string().nullable(),
  agent: z.enum(OPS_AGENTS),
  environment: z.string(),
  kind: z.enum(OPS_TASK_KINDS),
  status: z.enum(OPS_TASK_STATUSES),
  summary: z.string().nullable(),
  changes: z.string().nullable(),
  remaining: z.string().nullable(),
  blockers: z.string().nullable(),
  nextStep: z.string().nullable(),
  links: z.array(opsLinkRowSchema),
  meta: z.record(z.string(), z.unknown()),
  reportedFinish: z.boolean(),
  startedAt: nullableIsoDate,
  lastUpdateAt: isoDate,
  finishedAt: nullableIsoDate,
  createdAt: isoDate,
  updatedAt: isoDate,
  derived: opsTaskDerivedSchema,
});
export type OpsTaskRow = z.infer<typeof opsTaskRowSchema>;

export const opsEventRowSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  eventKey: z.string().nullable(),
  occurredAt: isoDate,
  kind: z.enum(OPS_EVENT_KINDS),
  actorLabel: z.string(),
  fromStatus: z.string().nullable(),
  toStatus: z.string().nullable(),
  message: z.string().nullable(),
  payload: z.unknown().nullable(),
  createdAt: isoDate,
});
export type OpsEventRow = z.infer<typeof opsEventRowSchema>;

export const opsAttachmentRowSchema = z.object({
  id: z.string(),
  taskId: z.string(),
  kind: z.enum(OPS_ATTACHMENT_KINDS),
  url: z.string(),
  contentType: z.string(),
  byteSize: z.number().int().nonnegative(),
  width: z.number().int().nullable(),
  height: z.number().int().nullable(),
  caption: z.string().nullable(),
  pairKey: z.string().nullable(),
  actorLabel: z.string(),
  createdAt: isoDate,
});
export type OpsAttachmentRow = z.infer<typeof opsAttachmentRowSchema>;

export const opsReporterRowSchema = z.object({
  agent: z.enum(OPS_AGENTS),
  environment: z.string().nullable(),
  hostname: z.string().nullable(),
  reporterVersion: z.string().nullable(),
  lastSeenAt: isoDate,
  lastTaskId: z.string().nullable(),
  meta: z.record(z.string(), z.unknown()),
});
export type OpsReporterRow = z.infer<typeof opsReporterRowSchema>;

/** Comma-separated enum values in a query string. */
const csvOf = <const T extends readonly [string, ...string[]]>(values: T) =>
  z.string().trim().min(1)
    .transform((raw) => raw.split(",").map((part) => part.trim()).filter(Boolean))
    .pipe(z.array(z.enum(values)).min(1).max(values.length));

export const opsTaskListQuerySchema = z.object({
  status: csvOf(OPS_TASK_STATUSES).optional(),
  agent: csvOf(OPS_AGENTS).optional(),
  kind: csvOf(OPS_TASK_KINDS).optional(),
  /** Substring match on title, request and summary. */
  q: z.string().trim().min(1).max(200).optional(),
  /** Israel-local calendar days on `lastUpdateAt`, inclusive. */
  from: z.iso.date().optional(),
  to: z.iso.date().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(40),
  /** Keyset cursor: `lastUpdateAt` of the last row seen; older rows follow. */
  before: z.iso.datetime({ offset: true }).optional(),
});
export type OpsTaskListQuery = z.infer<typeof opsTaskListQuerySchema>;

export const opsTaskSummarySchema = z.object({
  running: z.number().int().nonnegative(),
  blocked: z.number().int().nonnegative(),
  waiting: z.number().int().nonnegative(),
  unreported: z.number().int().nonnegative(),
  completedToday: z.number().int().nonnegative(),
});
export type OpsTaskSummary = z.infer<typeof opsTaskSummarySchema>;

export const opsTaskListSchema = z.object({
  summary: opsTaskSummarySchema,
  tasks: z.array(opsTaskRowSchema),
  nextBefore: isoDate.nullable(),
  coverage: z.array(opsReporterRowSchema),
});
export type OpsTaskList = z.infer<typeof opsTaskListSchema>;

export const opsTaskDetailSchema = z.object({
  task: opsTaskRowSchema,
  /** Newest first. */
  events: z.array(opsEventRowSchema),
  attachments: z.array(opsAttachmentRowSchema),
  children: z.array(opsTaskRowSchema),
});
export type OpsTaskDetail = z.infer<typeof opsTaskDetailSchema>;

export const opsTaskPatchSchema = z.object({
  status: z.enum(OPS_MANUAL_STATUSES),
  note: text(2000),
}).strict();
export type OpsTaskPatch = z.infer<typeof opsTaskPatchSchema>;

export const opsReportAcceptedSchema = z.object({
  accepted: z.number().int().nonnegative(),
  taskIds: z.array(z.string()),
});
export type OpsReportAccepted = z.infer<typeof opsReportAcceptedSchema>;
