/**
 * The audit log. Append-only, enforced by a trigger, not by discipline.
 *
 * `bigint generated always as identity` rather than a uuid: this is an ordered
 * append on a hot path, and reading it back in the order things happened is
 * the entire point.
 */

import { bigint, index, inet, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { appUser } from "./identity";
import { entityType } from "./_enums";
import { createdAt, nonBlank } from "./_shared";

export const auditLog = pgTable(
  "audit_log",
  {
    id: bigint("id", { mode: "bigint" }).primaryKey().generatedAlwaysAsIdentity(),
    occurredAt: createdAt(),
    actorUserId: uuid("actor_user_id").references(() => appUser.id),
    /** Denormalised on purpose: the log must stay readable after a user row is
     *  disabled, renamed, or (under a legal hold) removed. */
    actorLabel: text("actor_label").notNull(),
    action: text("action").notNull(),
    entityType: entityType("entity_type").notNull(),
    entityId: uuid("entity_id"),
    beforeState: jsonb("before_state"),
    afterState: jsonb("after_state"),
    requestId: text("request_id"),
    ip: inet("ip"),
    userAgent: text("user_agent"),
  },
  (t) => [
    index("audit_log_by_entity").on(t.entityType, t.entityId, t.occurredAt),
    index("audit_log_by_actor").on(t.actorUserId, t.occurredAt),
    nonBlank(t.actorLabel, "audit_log_names_an_actor"),
    nonBlank(t.action, "audit_log_names_an_action"),
  ],
);

export type AuditEntry = typeof auditLog.$inferSelect;
