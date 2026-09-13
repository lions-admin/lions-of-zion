import "server-only";

/**
 * The task board's workflow.
 *
 * `report()` is the one write path every reporter uses. A line names a task
 * by its stable key; the task is created on first sight with whatever the
 * line carries, the fields it carries are applied, the timeline gets one
 * event, and the reporter roster records who was heard from. Nothing here
 * infers completion: `completed` is set by a `finish` line (or a human
 * patch), and a session that closes without one stays `running` — which is
 * what the console then shows as unreported.
 *
 * `eventKey` makes a replay a no-op: the event insert is `ON CONFLICT DO
 * NOTHING`, and when it inserted nothing the task update is skipped too, so
 * a spooled line posted twice cannot move `last_update_at` forward twice.
 *
 * Reads parse their result against the contract, as the admin console does,
 * so a column that drifts fails here rather than as `NaN` on the board.
 */

import { createHash } from "node:crypto";
import type { Database } from "@/server/db/client";
import { writeAudit, type Actor } from "@/server/core/audit";
import { storeOpsAttachment } from "@/server/core/blob";
import {
  OPS_ATTACHMENT_MAX_BYTES,
  opsAttachmentRowSchema,
  opsAttachmentUploadSchema,
  opsReportAcceptedSchema,
  opsReportBatchSchema,
  opsTaskDetailSchema,
  opsTaskListQuerySchema,
  opsTaskListSchema,
  opsTaskPatchSchema,
  opsTaskRowSchema,
  type OpsAttachmentRow,
  type OpsReport,
  type OpsReportAccepted,
  type OpsTaskDetail,
  type OpsTaskList,
  type OpsTaskRow,
  type OpsTaskStatus,
} from "@/server/contracts/ops-tasks";
import type { opsTask } from "@/server/db/schema";
import { ApiError, notFound } from "@/server/http/responses";
import { opsTasksRepo, shapeAttachment, shapeTask, type Executor } from "./repo";
import { allowedManualTransition, eventKindFor, isTerminalStatus, statusImpliedBy } from "./rules";

const EXTENSION: Record<string, string> = {
  "image/png": "png",
  "image/jpeg": "jpg",
  "image/webp": "webp",
  "image/gif": "gif",
  "application/pdf": "pdf",
  "text/plain": "txt",
  "text/markdown": "md",
  "application/json": "json",
};

type TaskInsert = typeof opsTask.$inferInsert;

/** The task fields a report line may set, in column form. Absent means untouched. */
function fieldsOf(report: OpsReport): Partial<TaskInsert> {
  const out: Partial<TaskInsert> = {};
  if (report.title !== undefined) out.title = report.title;
  if (report.request !== undefined) out.request = report.request;
  if (report.goal !== undefined) out.goal = report.goal;
  if (report.kind !== undefined) out.kind = report.kind;
  if (report.summary !== undefined) out.summary = report.summary;
  if (report.changes !== undefined) out.changes = report.changes;
  if (report.remaining !== undefined) out.remaining = report.remaining;
  if (report.blockers !== undefined) out.blockers = report.blockers;
  if (report.nextStep !== undefined) out.nextStep = report.nextStep;
  if (report.links !== undefined) out.links = report.links;
  if (report.environment !== undefined) out.environment = report.environment;
  return out;
}

export type OpsTasksServiceOptions = {
  /** Injected by tests; production uses the wall clock. */
  now?: () => Date;
  store?: typeof storeOpsAttachment;
};

export function opsTasksService(database: Database, options: OpsTasksServiceOptions = {}) {
  const now = options.now ?? (() => new Date());
  const store = options.store ?? storeOpsAttachment;

  /** Find or create the task a key names, locked for this transaction. */
  async function ensureTask(
    tx: Executor,
    taskKey: string,
    seed: Omit<TaskInsert, "taskKey" | "title"> & { title?: string },
  ) {
    const repo = opsTasksRepo(tx);
    const existing = await repo.byKeyForUpdate(taskKey);
    if (existing) return { task: existing, created: false };
    const task = await repo.create({ ...seed, taskKey, title: seed.title ?? taskKey });
    return { task, created: true };
  }

  async function applyReport(tx: Executor, report: OpsReport, actorLabel: string, at: Date): Promise<string> {
    const repo = opsTasksRepo(tx);
    const occurredAt = report.occurredAt ? new Date(report.occurredAt) : at;

    if (report.event === "status" && !report.status) {
      throw new ApiError("VALIDATION_ERROR", `A status report for ${report.taskKey} must carry a status.`);
    }

    let parentId: string | null = null;
    if (report.parentKey) {
      if (report.parentKey === report.taskKey) {
        throw new ApiError("VALIDATION_ERROR", `Task ${report.taskKey} cannot be its own parent.`);
      }
      const parent = await ensureTask(tx, report.parentKey, {
        agent: report.agent,
        environment: report.environment,
        lastUpdateAt: occurredAt,
        meta: {},
      });
      parentId = parent.task.id;
    }

    const fields = fieldsOf(report);
    const { task, created } = await ensureTask(tx, report.taskKey, {
      ...fields,
      agent: report.agent,
      environment: report.environment,
      parentId,
      status: statusImpliedBy(report.event, report.status) ?? "queued",
      startedAt: report.event === "start" ? occurredAt : null,
      lastUpdateAt: occurredAt,
      meta: report.meta ?? {},
    });

    /* The status this line implies for an existing task. A `start` on a task
       that already finished does not reopen it unless the line says so. */
    let nextStatus: OpsTaskStatus | null = null;
    if (report.event === "start") {
      nextStatus = report.status ?? (isTerminalStatus(task.status) ? null : "running");
    } else {
      nextStatus = statusImpliedBy(report.event, report.status);
    }
    const toStatus = !created && nextStatus && nextStatus !== task.status ? nextStatus : null;

    const event = await repo.appendEvent({
      taskId: task.id,
      eventKey: report.eventKey ?? null,
      occurredAt,
      kind: eventKindFor(report.event),
      actorLabel,
      fromStatus: toStatus ? task.status : null,
      toStatus: created ? task.status : toStatus,
      message: report.message ?? null,
      payload: report.meta ?? null,
    });

    /* A replayed line: the event already exists, and the task must not move. */
    if (!event) return task.id;

    if (!created) {
      const patch: Partial<TaskInsert> = {
        ...fields,
        parentId: parentId ?? task.parentId,
        lastUpdateAt: occurredAt > task.lastUpdateAt ? occurredAt : task.lastUpdateAt,
        updatedAt: at,
      };
      if (report.meta) patch.meta = { ...(task.meta ?? {}), ...report.meta };
      if (nextStatus) patch.status = nextStatus;
      if (report.event === "start") patch.startedAt = task.startedAt ?? occurredAt;
      if (report.event === "finish") {
        patch.reportedFinish = true;
        patch.finishedAt = occurredAt;
      }
      await repo.update(task.id, patch);
    } else if (report.event === "finish") {
      await repo.update(task.id, { reportedFinish: true, finishedAt: occurredAt, updatedAt: at });
    }

    await repo.touchReporter({
      agent: report.agent,
      environment: report.environment,
      hostname: report.hostname ?? null,
      reporterVersion: report.reporterVersion ?? null,
      lastSeenAt: at,
      lastTaskId: task.id,
      meta: {},
    });

    return task.id;
  }

  return {
    /** Every line in one transaction: a batch is accepted whole or not at all. */
    async report(raw: unknown, actorLabel: string): Promise<OpsReportAccepted> {
      const { reports } = opsReportBatchSchema.parse(raw);
      const at = now();
      const taskIds = await database.transaction(async (tx) => {
        const ids: string[] = [];
        for (const line of reports) ids.push(await applyReport(tx, line, actorLabel, at));
        return ids;
      });
      return opsReportAcceptedSchema.parse({ accepted: reports.length, taskIds: [...new Set(taskIds)] });
    },

    /**
     * Decode, check, store, record. The object is written before the row —
     * the same order as editorial images — so a failed transaction leaves a
     * harmless orphan object rather than a row pointing at nothing.
     */
    async attach(raw: unknown, actorLabel: string): Promise<OpsAttachmentRow> {
      const upload = opsAttachmentUploadSchema.parse(raw);
      const at = now();
      const bytes = Buffer.from(upload.dataBase64, "base64");
      if (!bytes.length) throw new ApiError("VALIDATION_ERROR", "The attachment is empty.");
      if (bytes.length > OPS_ATTACHMENT_MAX_BYTES) {
        throw new ApiError("VALIDATION_ERROR", `The attachment exceeds ${OPS_ATTACHMENT_MAX_BYTES} bytes.`);
      }
      if ((upload.width === undefined) !== (upload.height === undefined)) {
        throw new ApiError("VALIDATION_ERROR", "width and height are given together or not at all.");
      }

      const task = await opsTasksRepo(database).byKey(upload.taskKey);
      if (!task) throw notFound(`Task ${upload.taskKey}`);

      const digest = createHash("sha256").update(bytes).digest("hex");
      const pathname = `ops/attachments/${task.id}/${digest}.${EXTENSION[upload.contentType] ?? "bin"}`;
      const stored = await store(pathname, bytes, upload.contentType);

      const row = await database.transaction(async (tx) => {
        const repo = opsTasksRepo(tx);
        const locked = await repo.byIdForUpdate(task.id);
        if (!locked) throw notFound(`Task ${upload.taskKey}`);
        const event = await repo.appendEvent({
          taskId: locked.id,
          eventKey: upload.eventKey ?? null,
          occurredAt: at,
          kind: "attachment",
          actorLabel,
          message: upload.caption ?? null,
          payload: { kind: upload.kind, url: stored.url, pairKey: upload.pairKey ?? null },
        });
        if (!event) {
          const existing = (await repo.attachments(locked.id)).find((item) => item.url === stored.url);
          if (existing) return existing;
        }
        const attachment = await repo.addAttachment({
          taskId: locked.id,
          kind: upload.kind,
          url: stored.url,
          contentType: upload.contentType,
          byteSize: bytes.length,
          width: upload.width ?? null,
          height: upload.height ?? null,
          caption: upload.caption ?? null,
          pairKey: upload.pairKey ?? null,
          actorLabel,
          createdAt: at,
        });
        await repo.update(locked.id, { lastUpdateAt: at > locked.lastUpdateAt ? at : locked.lastUpdateAt, updatedAt: at });
        return shapeAttachment(attachment);
      });
      return opsAttachmentRowSchema.parse(row);
    },

    async list(raw: unknown): Promise<OpsTaskList> {
      const query = opsTaskListQuerySchema.parse(raw);
      const at = now();
      const repo = opsTasksRepo(database);
      const [page, editorial, summary, coverage] = await Promise.all([
        repo.page(query, at),
        repo.editorialPage(query, at),
        repo.summary(at),
        repo.coverage(),
      ]);
      const merged = [...page, ...editorial].sort((a, b) =>
        b.lastUpdateAt.localeCompare(a.lastUpdateAt) || b.createdAt.localeCompare(a.createdAt),
      );
      const tasks = merged.slice(0, query.limit);
      const nextBefore = merged.length > query.limit ? tasks.at(-1)!.lastUpdateAt : null;
      const running = summary.running + editorial.filter((task) => task.status === "running").length;
      return opsTaskListSchema.parse({ summary: { ...summary, running }, tasks, nextBefore, coverage });
    },

    async detail(id: string): Promise<OpsTaskDetail> {
      const at = now();
      const repo = opsTasksRepo(database);
      const record = await repo.byId(id);
      if (!record) {
        const editorial = await repo.editorialById(id, at);
        if (!editorial) throw notFound("Task");
        return opsTaskDetailSchema.parse({ task: editorial, events: [], attachments: [], children: [] });
      }
      const [events, attachments, children] = await Promise.all([
        repo.events(record.id),
        repo.attachments(record.id),
        repo.children(record.id, at),
      ]);
      const task = shapeTask(record, { eventCount: events.length, attachmentCount: attachments.length }, at);
      return opsTaskDetailSchema.parse({ task, events, attachments, children });
    },

    /** A human's override, audited under `system` because it touches no
     *  editorial record — the same entity the console's other tools use. */
    async patch(id: string, raw: unknown, actor: Actor, requestId?: string): Promise<OpsTaskRow> {
      const patch = opsTaskPatchSchema.parse(raw);
      const at = now();
      const updated = await database.transaction(async (tx) => {
        const repo = opsTasksRepo(tx);
        const task = await repo.byIdForUpdate(id);
        if (!task) throw notFound("Task");
        if (!allowedManualTransition(task.status, patch.status)) {
          throw new ApiError("CONFLICT", `A ${task.status} task cannot be set to ${patch.status} by hand.`);
        }
        await repo.appendEvent({
          taskId: task.id,
          occurredAt: at,
          kind: "note",
          actorLabel: actor.label,
          fromStatus: task.status,
          toStatus: patch.status,
          message: patch.note,
        });
        const terminal = isTerminalStatus(patch.status);
        const next = await repo.update(task.id, {
          status: patch.status,
          lastUpdateAt: at,
          updatedAt: at,
          finishedAt: terminal ? (task.finishedAt ?? at) : task.finishedAt,
          meta: { ...(task.meta ?? {}), manualStatus: { by: actor.label, at: at.toISOString(), note: patch.note } },
        });
        await writeAudit(tx as never, {
          actor,
          action: "ops_task.patch",
          entityType: "system",
          entityId: task.id,
          before: { status: task.status },
          after: { status: patch.status, note: patch.note },
          requestId: requestId ?? null,
        });
        const counts = await repo.counts([task.id]);
        return shapeTask(next, counts.get(task.id)!, at);
      });
      return opsTaskRowSchema.parse(updated);
    },
  };
}

export type OpsTasksService = ReturnType<typeof opsTasksService>;
