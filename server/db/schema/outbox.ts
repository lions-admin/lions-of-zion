/**
 * Transactional outbox, and the idempotency ledger.
 *
 * Enqueueing to a Vercel Queue after the database commits is not atomic. A
 * crash in the gap loses a reindex or an AI job with no error anywhere and no
 * way to notice — the write succeeded, the work simply never happens.
 *
 * So the intent is written inside the same transaction as the change that
 * caused it, and a separate drain publishes it. Adding this with one consumer
 * costs almost nothing; retrofitting it once four consumers exist is a
 * migration plus four rewrites plus an unknowable backlog.
 */

import { bigint, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { entityType } from "./_enums";
import { createdAt, nonBlank, tsCol } from "./_shared";

export const outbox = pgTable(
  "outbox",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    topic: text("topic").notNull(),
    payload: jsonb("payload").notNull(),
    entityType: entityType("entity_type"),
    entityId: uuid("entity_id"),
    createdAt: createdAt(),
    /** Lets a producer schedule work rather than only enqueue it. */
    availableAt: tsCol("available_at").notNull().defaultNow(),
    publishedAt: tsCol("published_at"),
    attempts: integer("attempts").notNull().default(0),
    lastError: text("last_error"),
  },
  (t) => [
    /* The drain's only query. Partial, so it stays the size of the backlog
       rather than the size of history. */
    index("outbox_pending").on(t.availableAt).where(sql`${t.publishedAt} IS NULL`),
    nonBlank(t.topic, "outbox_names_a_topic"),
  ],
);

/**
 * Replay protection for anything that can be delivered more than once:
 * webhooks, queue messages, cron entries, client retries.
 *
 * Stores the response too, so a repeat delivery returns what the first one
 * returned instead of a conflict the caller has to interpret.
 */
export const idempotencyKey = pgTable(
  "idempotency_key",
  {
    key: text("key").primaryKey(),
    route: text("route").notNull(),
    /** Guards against a key reused with a different body — that is a caller
     *  bug, and returning the first response would hide it. */
    requestHash: text("request_hash").notNull(),
    response: jsonb("response"),
    statusCode: integer("status_code"),
    createdAt: createdAt(),
    expiresAt: tsCol("expires_at").notNull(),
  },
  (t) => [index("idempotency_key_expiry").on(t.expiresAt)],
);

export type OutboxRow = typeof outbox.$inferSelect;
