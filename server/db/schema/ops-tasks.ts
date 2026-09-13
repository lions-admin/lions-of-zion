/**
 * The operations task board.
 *
 * One `ops_task` per stable key, an append-only `ops_task_event` timeline, the
 * screenshots and files an agent attaches, and the roster of who reports.
 * The rules that live in SQL (append-only events, trigger-written status
 * history, the self-hosted attachment URL, RLS) are in migration `0066`;
 * this file is the shape drizzle queries against. `server/contracts/ops-tasks.ts`
 * states the same enums in zod and they have to agree.
 */

import { sql } from "drizzle-orm";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import { boolean, check, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { createdAt, nonBlank, primaryId, tsCol, updatedAt } from "./_shared";
import type {
  OpsAgent,
  OpsAttachmentKind,
  OpsEventKind,
  OpsLink,
  OpsTaskKind,
  OpsTaskStatus,
} from "@/server/contracts/ops-tasks";

export const opsTask = pgTable(
  "ops_task",
  {
    id: primaryId(),
    /** Stable id chosen by the reporter: `claude:<session>`, `git:<sha>`, `import:<hash>`. */
    taskKey: text("task_key").notNull().unique(),
    parentId: uuid("parent_id").references((): AnyPgColumn => opsTask.id, { onDelete: "set null" }),
    title: text("title").notNull(),
    /** The original ask, verbatim. */
    request: text("request"),
    goal: text("goal"),
    agent: text("agent").$type<OpsAgent>().notNull(),
    /** Host, workspace path or CI — where the work ran. */
    environment: text("environment").notNull(),
    kind: text("kind").$type<OpsTaskKind>().notNull().default("other"),
    status: text("status").$type<OpsTaskStatus>().notNull().default("queued"),
    summary: text("summary"),
    changes: text("changes"),
    remaining: text("remaining"),
    blockers: text("blockers"),
    nextStep: text("next_step"),
    links: jsonb("links").$type<OpsLink[]>().notNull().default(sql`'[]'::jsonb`),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
    /** True only after a `finish` report. `completed` is never inferred. */
    reportedFinish: boolean("reported_finish").notNull().default(false),
    startedAt: tsCol("started_at"),
    lastUpdateAt: tsCol("last_update_at").notNull().defaultNow(),
    finishedAt: tsCol("finished_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("ops_task_by_status").on(t.status, t.lastUpdateAt.desc()),
    index("ops_task_by_agent").on(t.agent, t.lastUpdateAt.desc()),
    index("ops_task_by_parent").on(t.parentId),
    index("ops_task_by_last_update").on(t.lastUpdateAt.desc()),
    nonBlank(t.taskKey, "ops_task_has_key"),
    nonBlank(t.title, "ops_task_has_title"),
    check("ops_task_agent_known",
      sql`${t.agent} IN ('claude','codex','grok','opencode','gemini-agy','chatgpt-editorial','github-actions','local-script','human','unknown')`),
    check("ops_task_kind_known",
      sql`${t.kind} IN ('code','editorial','design','ops','research','review','import','other')`),
    check("ops_task_status_known",
      sql`${t.status} IN ('queued','running','waiting','blocked','completed','failed','cancelled')`),
    check("ops_task_not_its_own_parent", sql`${t.parentId} IS NULL OR ${t.parentId} <> ${t.id}`),
  ],
);

export const opsTaskEvent = pgTable(
  "ops_task_event",
  {
    id: primaryId(),
    taskId: uuid("task_id").notNull().references(() => opsTask.id, { onDelete: "cascade" }),
    /** Client idempotency id; unique per task where present. */
    eventKey: text("event_key"),
    occurredAt: tsCol("occurred_at").notNull().defaultNow(),
    kind: text("kind").$type<OpsEventKind>().notNull(),
    actorLabel: text("actor_label").notNull(),
    fromStatus: text("from_status"),
    toStatus: text("to_status"),
    message: text("message"),
    payload: jsonb("payload").$type<unknown>(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("ops_task_event_key_once").on(t.taskId, t.eventKey).where(sql`${t.eventKey} IS NOT NULL`),
    index("ops_task_event_by_task").on(t.taskId, t.occurredAt.desc()),
    check("ops_task_event_kind_known",
      sql`${t.kind} IN ('started','progress','status','note','attachment','finished','heartbeat','commit','ci','import')`),
    nonBlank(t.actorLabel, "ops_task_event_has_actor"),
  ],
);

export const opsTaskAttachment = pgTable(
  "ops_task_attachment",
  {
    id: primaryId(),
    taskId: uuid("task_id").notNull().references(() => opsTask.id, { onDelete: "cascade" }),
    kind: text("kind").$type<OpsAttachmentKind>().notNull(),
    /** An object in our public Blob store under `ops/attachments/`, or a site path. */
    url: text("url").notNull(),
    contentType: text("content_type").notNull(),
    byteSize: integer("byte_size").notNull(),
    width: integer("width"),
    height: integer("height"),
    caption: text("caption"),
    /** Links a before/after pair. */
    pairKey: text("pair_key"),
    actorLabel: text("actor_label").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("ops_task_attachment_by_task").on(t.taskId, t.createdAt),
    check("ops_task_attachment_kind_known",
      sql`${t.kind} IN ('screenshot','before','after','artifact','file')`),
    check("ops_task_attachment_is_self_hosted",
      sql`${t.url} ~ '^/[^/]' OR ${t.url} ~ '^https://[a-z0-9-]+\\.public\\.blob\\.vercel-storage\\.com/'`),
    check("ops_task_attachment_has_bytes", sql`${t.byteSize} > 0`),
    check("ops_task_attachment_dimensions_paired", sql`(${t.width} IS NULL) = (${t.height} IS NULL)`),
    nonBlank(t.actorLabel, "ops_task_attachment_has_actor"),
  ],
);

/** Who reports, and when they were last heard from. Upserted on every report. */
export const opsReporter = pgTable(
  "ops_reporter",
  {
    agent: text("agent").$type<OpsAgent>().primaryKey(),
    environment: text("environment"),
    hostname: text("hostname"),
    reporterVersion: text("reporter_version"),
    lastSeenAt: tsCol("last_seen_at").notNull().defaultNow(),
    lastTaskId: uuid("last_task_id").references(() => opsTask.id, { onDelete: "set null" }),
    meta: jsonb("meta").$type<Record<string, unknown>>().notNull().default(sql`'{}'::jsonb`),
  },
  (t) => [
    check("ops_reporter_agent_known",
      sql`${t.agent} IN ('claude','codex','grok','opencode','gemini-agy','chatgpt-editorial','github-actions','local-script','human','unknown')`),
  ],
);

export type OpsTaskRecord = typeof opsTask.$inferSelect;
export type OpsTaskEventRecord = typeof opsTaskEvent.$inferSelect;
export type OpsTaskAttachmentRecord = typeof opsTaskAttachment.$inferSelect;
export type OpsReporterRecord = typeof opsReporter.$inferSelect;
