/**
 * One version table for every versioned entity, with a jsonb snapshot.
 *
 * The alternative — a typed version table per entity — is eight near-identical
 * tables, eight write paths, and one more of each whenever an entity is added,
 * bought in exchange for typing nobody queries. Nobody asks "show me all v3
 * briefs". `item_assessment` is the one exception and keeps its own typed
 * table, because its CHECK constraints are legally load-bearing and its fields
 * really are queried.
 *
 * Append-only via trigger. A version that can be edited is not a version.
 */

import { index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { sql } from "drizzle-orm";
import { check } from "drizzle-orm/pg-core";
import { appUser } from "./identity";
import { aiRun } from "./ai";
import { changeSource, entityType } from "./_enums";
import { createdAt, nonBlank, primaryId } from "./_shared";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const entityVersion = pgTable(
  "entity_version",
  {
    id: primaryId(),
    entityType: entityType("entity_type").notNull(),
    entityId: uuid("entity_id").notNull(),
    versionNumber: integer("version_number").notNull(),
    previousVersionId: uuid("previous_version_id").references(
      (): AnyPgColumn => entityVersion.id,
    ),
    /** The entity as it was, verbatim. */
    snapshot: jsonb("snapshot").notNull(),
    /** Bumped when the snapshot's own shape changes, so an old row can still
     *  be read by code that knows which shape it is looking at. */
    schemaVersion: integer("schema_version").notNull().default(1),
    changeSummary: text("change_summary").notNull(),
    changeSource: changeSource("change_source").notNull(),
    changedBy: uuid("changed_by").references(() => appUser.id),
    changedByLabel: text("changed_by_label").notNull(),
    /** Set when `change_source = ai_suggestion_accepted`; enforced below.
     *  The FK arrived in Phase 6 with `ai_run` — until then this was a bare
     *  uuid, which meant an AI-attributed version could name a run that did
     *  not exist. */
    aiRunId: uuid("ai_run_id").references(() => aiRun.id),
    changedAt: createdAt(),
    /** md5 of the snapshot. Change detection only — never an integrity claim.
     *  Written by the application: `convert_to()` is STABLE, so a sha256
     *  generated column is rejected by Postgres as non-immutable. */
    contentHash: text("content_hash").notNull(),
  },
  (t) => [
    uniqueIndex("entity_version_is_sequential").on(t.entityType, t.entityId, t.versionNumber),
    index("entity_version_by_entity").on(t.entityType, t.entityId, t.changedAt),
    check("entity_version_number_is_positive", sql`${t.versionNumber} >= 1`),
    nonBlank(t.changeSummary, "entity_version_states_what_changed"),
    nonBlank(t.changedByLabel, "entity_version_names_who_changed_it"),
    check(
      "ai_change_names_its_run",
      sql`${t.changeSource} <> 'ai_suggestion_accepted' OR ${t.aiRunId} IS NOT NULL`,
    ),
  ],
);

export type EntityVersion = typeof entityVersion.$inferSelect;
