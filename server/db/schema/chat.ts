/**
 * Conversations, and the rule that citations have to be real.
 *
 * The failure this schema is built against is the one every RAG chat has: the
 * model writes a fluent answer and attaches a citation to a document that was
 * never retrieved, or that says nothing of the kind. On a verification
 * platform that is not a cosmetic bug — a fabricated citation is
 * indistinguishable from the thing the whole product exists to detect.
 *
 * So a citation is not free text and not a model output. `chat_citation`
 * references a `search_document` by id, and a trigger refuses any citation
 * naming a document that was not actually returned by a tool run earlier in
 * the same thread. The model may only cite what retrieval actually handed it.
 *
 * `chat_tool_run` is append-only for the same reason `ai_run` is: it is the
 * evidence that the retrieval happened and what it returned, and the citation
 * check reads it.
 */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { aiRun } from "./ai";
import { appUser } from "./identity";
import { searchDocument } from "./search";
import { createdAt, nonBlank, primaryId, tsCol } from "./_shared";

export const chatThread = pgTable(
  "chat_thread",
  {
    id: primaryId(),
    title: text("title"),
    createdBy: uuid("created_by").references(() => appUser.id),
    /** Denormalised, so a thread stays attributable after a user row goes. */
    createdByLabel: text("created_by_label").notNull(),
    archivedAt: tsCol("archived_at"),
    createdAt: createdAt(),
  },
  (t) => [
    index("chat_thread_by_creator").on(t.createdBy, t.createdAt),
    nonBlank(t.createdByLabel, "chat_thread_names_its_creator"),
  ],
);

export const chatMessage = pgTable(
  "chat_message",
  {
    id: primaryId(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    /** Monotonic within a thread. Ordering by `created_at` alone breaks when
     *  a user message and its answer land in the same millisecond.
     *
     *  Defaults to 0, which `assign_chat_message_seq()` reads as "allocate
     *  me the next one" — callers never compute this, so two concurrent
     *  writes to one thread cannot race for the same number. */
    seq: integer("seq").notNull().default(0),
    role: text("role").notNull(),
    content: text("content").notNull(),
    /** Set on assistant messages; null for user messages. */
    aiRunId: uuid("ai_run_id").references(() => aiRun.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("chat_message_is_sequential").on(t.threadId, t.seq),
    check("chat_message_role_is_known", sql`${t.role} IN ('user', 'assistant', 'system')`),
    check("chat_message_seq_is_positive", sql`${t.seq} >= 1`),
    /* An assistant message names the run that produced it. Without this, a
       turn's cost and model are unattributable after the fact. */
    check(
      "assistant_message_names_its_run",
      sql`${t.role} <> 'assistant' OR ${t.aiRunId} IS NOT NULL`,
    ),
  ],
);

/**
 * One tool invocation, append-only.
 *
 * `result_document_ids` is the list retrieval actually returned. The citation
 * trigger reads exactly this column, which is why it is a plain uuid array
 * rather than buried inside the `output` jsonb.
 */
export const chatToolRun = pgTable(
  "chat_tool_run",
  {
    id: primaryId(),
    threadId: uuid("thread_id")
      .notNull()
      .references(() => chatThread.id, { onDelete: "cascade" }),
    /** Null while the turn is still being generated. */
    messageId: uuid("message_id").references(() => chatMessage.id),
    tool: text("tool").notNull(),
    input: jsonb("input").notNull(),
    output: jsonb("output"),
    resultDocumentIds: uuid("result_document_ids").array().notNull().default(sql`'{}'::uuid[]`),
    status: text("status").notNull().default("ok"),
    latencyMs: integer("latency_ms"),
    createdAt: createdAt(),
  },
  (t) => [
    index("chat_tool_run_by_thread").on(t.threadId, t.createdAt),
    nonBlank(t.tool, "chat_tool_run_names_a_tool"),
    check("chat_tool_run_status_is_known", sql`${t.status} IN ('ok', 'error')`),
  ],
);

/**
 * A citation on an assistant message.
 *
 * Composite primary key: one message cites one document once. Citing the same
 * source twice for the same sentence is noise; citing it for two different
 * claims is what `quote` is for.
 */
export const chatCitation = pgTable(
  "chat_citation",
  {
    messageId: uuid("message_id")
      .notNull()
      .references(() => chatMessage.id, { onDelete: "cascade" }),
    documentId: uuid("document_id")
      .notNull()
      .references(() => searchDocument.id, { onDelete: "cascade" }),
    /** The span the assistant claims to be relying on. */
    quote: text("quote"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.messageId, t.documentId] }),
    index("chat_citation_by_document").on(t.documentId),
  ],
);

export type ChatThread = typeof chatThread.$inferSelect;
export type ChatMessage = typeof chatMessage.$inferSelect;
export type ChatToolRun = typeof chatToolRun.$inferSelect;
export type ChatCitation = typeof chatCitation.$inferSelect;
