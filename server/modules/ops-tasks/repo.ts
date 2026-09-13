import "server-only";

/**
 * Queries for the task board. No policy here — `rules.ts` decides what a
 * status means, `service.ts` decides what a report does; this file reads and
 * writes rows and shapes them for the contract.
 */

import { and, asc, desc, eq, gte, ilike, inArray, lt, or, sql, type SQL } from "drizzle-orm";
import type { Database } from "@/server/db/client";
import {
  editorialRun,
  opsReporter,
  opsTask,
  opsTaskAttachment,
  opsTaskEvent,
  type OpsReporterRecord,
  type OpsTaskAttachmentRecord,
  type OpsTaskEventRecord,
  type OpsTaskRecord,
} from "@/server/db/schema";
import type {
  OpsAttachmentRow,
  OpsEventRow,
  OpsReporterRow,
  OpsTaskListQuery,
  OpsTaskRow,
  OpsTaskSummary,
} from "@/server/contracts/ops-tasks";
import { deriveFlags, editorialRunStatus, israelDayEnd, israelDayStart, israelLocalDate } from "./rules";

/** Either the connection or a transaction on it — the queries are the same. */
export type Executor = Database | Parameters<Parameters<Database["transaction"]>[0]>[0];

type Counts = { eventCount: number; attachmentCount: number };

const iso = (value: Date) => value.toISOString();
const isoOrNull = (value: Date | null) => (value ? value.toISOString() : null);

export function shapeTask(record: OpsTaskRecord, counts: Counts, now: Date): OpsTaskRow {
  return {
    id: record.id,
    taskKey: record.taskKey,
    parentId: record.parentId,
    title: record.title,
    request: record.request,
    goal: record.goal,
    agent: record.agent,
    environment: record.environment,
    kind: record.kind,
    status: record.status,
    summary: record.summary,
    changes: record.changes,
    remaining: record.remaining,
    blockers: record.blockers,
    nextStep: record.nextStep,
    links: record.links ?? [],
    meta: record.meta ?? {},
    reportedFinish: record.reportedFinish,
    startedAt: isoOrNull(record.startedAt),
    lastUpdateAt: iso(record.lastUpdateAt),
    finishedAt: isoOrNull(record.finishedAt),
    createdAt: iso(record.createdAt),
    updatedAt: iso(record.updatedAt),
    derived: { ...deriveFlags(record, now), ...counts },
  };
}

export function shapeEvent(record: OpsTaskEventRecord): OpsEventRow {
  return {
    id: record.id,
    taskId: record.taskId,
    eventKey: record.eventKey,
    occurredAt: iso(record.occurredAt),
    kind: record.kind,
    actorLabel: record.actorLabel,
    fromStatus: record.fromStatus,
    toStatus: record.toStatus,
    message: record.message,
    payload: record.payload ?? null,
    createdAt: iso(record.createdAt),
  };
}

export function shapeAttachment(record: OpsTaskAttachmentRecord): OpsAttachmentRow {
  return {
    id: record.id,
    taskId: record.taskId,
    kind: record.kind,
    url: record.url,
    contentType: record.contentType,
    byteSize: record.byteSize,
    width: record.width,
    height: record.height,
    caption: record.caption,
    pairKey: record.pairKey,
    actorLabel: record.actorLabel,
    createdAt: iso(record.createdAt),
  };
}

export function shapeReporter(record: OpsReporterRecord): OpsReporterRow {
  return {
    agent: record.agent,
    environment: record.environment,
    hostname: record.hostname,
    reporterVersion: record.reporterVersion,
    lastSeenAt: iso(record.lastSeenAt),
    lastTaskId: record.lastTaskId,
    meta: record.meta ?? {},
  };
}

/**
 * The ChatGPT editorial run, read as a task without a second write path.
 * `id` is the run's own id; `detail()` resolves it the same way.
 */
export function shapeEditorialRun(run: typeof editorialRun.$inferSelect, now: Date): OpsTaskRow {
  const composer = (run.request as { delivery?: { composer?: string } } | null)?.delivery?.composer
    ?? run.requestedBy.replace(/^external:/, "");
  const lastUpdateAt = run.finishedAt ?? run.updatedAt;
  const status = editorialRunStatus(run.status);
  const report = run.report as { publications?: { created?: number; updated?: number; failed?: number } } | null;
  const summary = report?.publications
    ? `created ${report.publications.created ?? 0}, updated ${report.publications.updated ?? 0}, failed ${report.publications.failed ?? 0}`
    : null;
  return {
    id: run.id,
    taskKey: `editorial:${run.runKey}`,
    parentId: null,
    title: `${composer} · ${run.localDate}`,
    request: null,
    goal: null,
    agent: "chatgpt-editorial",
    environment: "editorial",
    kind: "editorial",
    status,
    summary,
    changes: null,
    remaining: null,
    blockers: run.failure ? JSON.stringify(run.failure).slice(0, 2000) : null,
    nextStep: null,
    links: [{ label: "מערכת העריכה", url: "/admin?area=editorial-runs" }],
    meta: { runKey: run.runKey, stage: run.stage, editorialStatus: run.status, mode: run.mode },
    reportedFinish: run.finishedAt !== null,
    startedAt: isoOrNull(run.startedAt),
    lastUpdateAt: iso(lastUpdateAt),
    finishedAt: isoOrNull(run.finishedAt),
    createdAt: iso(run.createdAt),
    updatedAt: iso(run.updatedAt),
    derived: {
      ...deriveFlags({ status, lastUpdateAt, reportedFinish: run.finishedAt !== null, meta: {} }, now),
      eventCount: 0,
      attachmentCount: 0,
    },
  };
}

export function opsTasksRepo(db: Executor) {
  const counts = async (taskIds: string[]): Promise<Map<string, Counts>> => {
    const map = new Map<string, Counts>();
    if (!taskIds.length) return map;
    for (const id of taskIds) map.set(id, { eventCount: 0, attachmentCount: 0 });
    const events = await db
      .select({ taskId: opsTaskEvent.taskId, n: sql<number>`count(*)::int` })
      .from(opsTaskEvent)
      .where(inArray(opsTaskEvent.taskId, taskIds))
      .groupBy(opsTaskEvent.taskId);
    for (const row of events) map.get(row.taskId)!.eventCount = row.n;
    const attachments = await db
      .select({ taskId: opsTaskAttachment.taskId, n: sql<number>`count(*)::int` })
      .from(opsTaskAttachment)
      .where(inArray(opsTaskAttachment.taskId, taskIds))
      .groupBy(opsTaskAttachment.taskId);
    for (const row of attachments) map.get(row.taskId)!.attachmentCount = row.n;
    return map;
  };

  return {
    counts,

    async byKeyForUpdate(taskKey: string): Promise<OpsTaskRecord | null> {
      const [row] = await db.select().from(opsTask).where(eq(opsTask.taskKey, taskKey)).for("update");
      return row ?? null;
    },

    async byKey(taskKey: string): Promise<OpsTaskRecord | null> {
      const [row] = await db.select().from(opsTask).where(eq(opsTask.taskKey, taskKey));
      return row ?? null;
    },

    async byId(id: string): Promise<OpsTaskRecord | null> {
      const [row] = await db.select().from(opsTask).where(eq(opsTask.id, id));
      return row ?? null;
    },

    async byIdForUpdate(id: string): Promise<OpsTaskRecord | null> {
      const [row] = await db.select().from(opsTask).where(eq(opsTask.id, id)).for("update");
      return row ?? null;
    },

    async create(values: typeof opsTask.$inferInsert): Promise<OpsTaskRecord> {
      const [row] = await db.insert(opsTask).values(values).returning();
      return row!;
    },

    async update(id: string, values: Partial<typeof opsTask.$inferInsert>): Promise<OpsTaskRecord> {
      const [row] = await db.update(opsTask).set(values).where(eq(opsTask.id, id)).returning();
      return row!;
    },

    /** `null` when `eventKey` was already recorded for this task. */
    async appendEvent(values: typeof opsTaskEvent.$inferInsert): Promise<OpsTaskEventRecord | null> {
      const query = db.insert(opsTaskEvent).values(values);
      const rows = values.eventKey
        ? await query
            .onConflictDoNothing({
              target: [opsTaskEvent.taskId, opsTaskEvent.eventKey],
              where: sql`${opsTaskEvent.eventKey} IS NOT NULL`,
            })
            .returning()
        : await query.returning();
      return rows[0] ?? null;
    },

    async addAttachment(values: typeof opsTaskAttachment.$inferInsert): Promise<OpsTaskAttachmentRecord> {
      const [row] = await db.insert(opsTaskAttachment).values(values).returning();
      return row!;
    },

    async touchReporter(values: typeof opsReporter.$inferInsert): Promise<void> {
      await db
        .insert(opsReporter)
        .values(values)
        .onConflictDoUpdate({
          target: opsReporter.agent,
          /* A line that omits hostname or version does not forget the last
             one heard; only a new value replaces it. */
          set: {
            environment: sql`coalesce(excluded.environment, ${opsReporter.environment})`,
            hostname: sql`coalesce(excluded.hostname, ${opsReporter.hostname})`,
            reporterVersion: sql`coalesce(excluded.reporter_version, ${opsReporter.reporterVersion})`,
            lastSeenAt: values.lastSeenAt ?? new Date(),
            lastTaskId: values.lastTaskId ?? null,
            meta: sql`${opsReporter.meta} || excluded.meta`,
          },
        });
    },

    async coverage(): Promise<OpsReporterRow[]> {
      const rows = await db.select().from(opsReporter).orderBy(desc(opsReporter.lastSeenAt));
      return rows.map(shapeReporter);
    },

    async summary(now: Date): Promise<OpsTaskSummary> {
      const todayStart = israelDayStart(israelLocalDate(now));
      const [row] = await db
        .select({
          running: sql<number>`count(*) filter (where ${opsTask.status} = 'running')::int`,
          blocked: sql<number>`count(*) filter (where ${opsTask.status} = 'blocked')::int`,
          waiting: sql<number>`count(*) filter (where ${opsTask.status} = 'waiting')::int`,
          unreported: sql<number>`count(*) filter (where ${opsTask.status} in ('running','waiting') and ${opsTask.reportedFinish} = false and (${opsTask.meta} ->> 'sessionEnded') = 'true')::int`,
          completedToday: sql<number>`count(*) filter (where ${opsTask.status} = 'completed' and ${opsTask.finishedAt} >= ${todayStart.toISOString()}::timestamptz)::int`,
        })
        .from(opsTask);
      return row ?? { running: 0, blocked: 0, waiting: 0, unreported: 0, completedToday: 0 };
    },

    /** One page of tasks, newest activity first, plus one extra row so the
     *  caller can tell whether a next page exists. */
    async page(query: OpsTaskListQuery, now: Date): Promise<OpsTaskRow[]> {
      const where: SQL[] = [];
      if (query.status) where.push(inArray(opsTask.status, query.status));
      if (query.agent) where.push(inArray(opsTask.agent, query.agent));
      if (query.kind) where.push(inArray(opsTask.kind, query.kind));
      if (query.q) {
        const needle = `%${query.q.replace(/[%_\\]/g, (c) => `\\${c}`)}%`;
        where.push(or(ilike(opsTask.title, needle), ilike(opsTask.request, needle), ilike(opsTask.summary, needle))!);
      }
      if (query.from) where.push(gte(opsTask.lastUpdateAt, israelDayStart(query.from)));
      if (query.to) where.push(lt(opsTask.lastUpdateAt, israelDayEnd(query.to)));
      if (query.before) where.push(lt(opsTask.lastUpdateAt, new Date(query.before)));
      const rows = await db
        .select()
        .from(opsTask)
        .where(where.length ? and(...where) : undefined)
        .orderBy(desc(opsTask.lastUpdateAt), desc(opsTask.createdAt))
        .limit(query.limit + 1);
      const byId = await counts(rows.map((row) => row.id));
      return rows.map((row) => shapeTask(row, byId.get(row.id)!, now));
    },

    /** Editorial runs that would pass the same filters, as board rows. */
    async editorialPage(query: OpsTaskListQuery, now: Date): Promise<OpsTaskRow[]> {
      if (query.agent && !query.agent.includes("chatgpt-editorial")) return [];
      if (query.kind && !query.kind.includes("editorial")) return [];
      const rows = await db
        .select()
        .from(editorialRun)
        .orderBy(desc(editorialRun.updatedAt))
        .limit(200);
      const shaped = rows.map((run) => shapeEditorialRun(run, now));
      const from = query.from ? israelDayStart(query.from).getTime() : null;
      const to = query.to ? israelDayEnd(query.to).getTime() : null;
      const before = query.before ? new Date(query.before).getTime() : null;
      const needle = query.q?.toLowerCase();
      return shaped.filter((task) => {
        const at = new Date(task.lastUpdateAt).getTime();
        if (query.status && !query.status.includes(task.status)) return false;
        if (from !== null && at < from) return false;
        if (to !== null && at >= to) return false;
        if (before !== null && at >= before) return false;
        if (needle && !`${task.title} ${task.summary ?? ""}`.toLowerCase().includes(needle)) return false;
        return true;
      });
    },

    async editorialById(id: string, now: Date): Promise<OpsTaskRow | null> {
      const [run] = await db.select().from(editorialRun).where(eq(editorialRun.id, id));
      return run ? shapeEditorialRun(run, now) : null;
    },

    async events(taskId: string): Promise<OpsEventRow[]> {
      const rows = await db
        .select()
        .from(opsTaskEvent)
        .where(eq(opsTaskEvent.taskId, taskId))
        .orderBy(desc(opsTaskEvent.occurredAt), desc(opsTaskEvent.createdAt));
      return rows.map(shapeEvent);
    },

    async attachments(taskId: string): Promise<OpsAttachmentRow[]> {
      const rows = await db
        .select()
        .from(opsTaskAttachment)
        .where(eq(opsTaskAttachment.taskId, taskId))
        .orderBy(asc(opsTaskAttachment.createdAt));
      return rows.map(shapeAttachment);
    },

    async children(parentId: string, now: Date): Promise<OpsTaskRow[]> {
      const rows = await db
        .select()
        .from(opsTask)
        .where(eq(opsTask.parentId, parentId))
        .orderBy(desc(opsTask.lastUpdateAt));
      const byId = await counts(rows.map((row) => row.id));
      return rows.map((row) => shapeTask(row, byId.get(row.id)!, now));
    },
  };
}
