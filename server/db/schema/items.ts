/**
 * The central entity.
 *
 * Two axes, deliberately never collapsed into one: `status` is where the item
 * is in the workflow, `assessment` is what we concluded about it. An item can
 * be `published` with any assessment and `under_review` with any assessment,
 * and a schema that fuses them makes "we are still checking" unrepresentable.
 *
 * Four columns here are DERIVED and application code may not write them —
 * a trigger raises if it tries. They cache facts owned by other tables, and on
 * a platform that publishes verdicts a stale cache is not a performance
 * question: an item reading `verified` while its live assessment says
 * `contested` is a false publication.
 */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  pgTable,
  primaryKey,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";
import {
  assessmentValue,
  confidenceSummary,
  informationItemType,
  itemStatus,
} from "./_enums";
import { appUser } from "./identity";
import { event, topic } from "./taxonomy";
import { entityVersion } from "./versioning";
import { itemAssessment } from "./assessments";
import { createdAt, isLanguage, nonBlank, primaryId, tsCol, updatedAt } from "./_shared";

export const informationItem = pgTable(
  "information_item",
  {
    id: primaryId(),
    /** Stable, URL-safe, and independent of insertion order. */
    publicId: text("public_id").notNull().unique(),
    type: informationItemType("type").notNull(),
    title: text("title").notNull(),
    /** The claim as made, not as paraphrased. */
    canonicalText: text("canonical_text").notNull(),
    summary: text("summary"),
    language: text("language").notNull(),

    status: itemStatus("status").notNull().default("detected"),
    /** Required for `rejected` — see the CHECK below. */
    statusReason: text("status_reason"),

    /* ── Derived. Trigger-maintained. Never written by the application. ──── */
    assessment: assessmentValue("assessment"),
    confidenceSummary: confidenceSummary("confidence_summary"),
    currentAssessmentId: uuid("current_assessment_id").references((): AnyPgColumn => itemAssessment.id),
    currentVersionId: uuid("current_version_id").references(() => entityVersion.id),

    firstDetectedAt: tsCol("first_detected_at").notNull().defaultNow(),
    publishedAt: tsCol("published_at"),
    eventId: uuid("event_id").references(() => event.id),
    primaryTopicId: uuid("primary_topic_id").references(() => topic.id),

    createdBy: uuid("created_by").references(() => appUser.id),
    /** The second human. The publish gate in Phase 4 requires it to differ
     *  from `created_by` and to belong to a non-automated identity. */
    approvedBy: uuid("approved_by").references(() => appUser.id),

    /** md5 of the substantive text. Change detection for reindexing, nothing
     *  more — a generated column cannot use sha256, because `convert_to` is
     *  STABLE and Postgres refuses a non-immutable generation expression. */
    contentHash: text("content_hash").generatedAlwaysAs(
      sql`md5(title || E'\n' || canonical_text || E'\n' || coalesce(summary, ''))`,
    ),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("information_item_by_status").on(t.status, t.firstDetectedAt),
    index("information_item_by_event").on(t.eventId),
    index("information_item_published").on(t.publishedAt).where(sql`${t.publishedAt} IS NOT NULL`),
    nonBlank(t.title, "information_item_is_titled"),
    nonBlank(t.canonicalText, "information_item_has_canonical_text"),
    isLanguage(t.language, "information_item_language_is_a_tag"),
    /* A published item must carry a verdict, a timestamp and an approver. The
       cross-table half — that the approver is human, is not the author, and
       that the assessment was reviewed — is the Phase 4 publish-gate trigger. */
    check(
      "published_has_timestamp_and_approver",
      sql`${t.status} NOT IN ('published', 'updated')
          OR (${t.approvedBy} IS NOT NULL
              AND ${t.publishedAt} IS NOT NULL
              AND ${t.assessment} IS NOT NULL)`,
    ),
    /* Same argument as a non-blank `known_gaps`: a rejection with no stated
       reason is an evasion, and this is the only layer that can refuse it on
       every path. */
    check(
      "rejected_states_why",
      sql`${t.status} <> 'rejected' OR length(btrim(coalesce(${t.statusReason}, ''))) > 0`,
    ),
  ],
);

/** Items carry several topics; `primary_topic_id` is only the headline one. */
export const informationItemTopic = pgTable(
  "information_item_topic",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => informationItem.id, { onDelete: "cascade" }),
    topicId: uuid("topic_id")
      .notNull()
      .references(() => topic.id, { onDelete: "cascade" }),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.topicId] }),
    index("information_item_topic_by_topic").on(t.topicId),
  ],
);

/**
 * Every status change, append-only.
 *
 * Written by the legality trigger rather than by the service, so the trail
 * cannot be skipped by forgetting to call something. `entity_version` records
 * what the item said; this records where it stood.
 */
export const itemStatusTransition = pgTable(
  "item_status_transition",
  {
    id: primaryId(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => informationItem.id, { onDelete: "cascade" }),
    fromStatus: itemStatus("from_status"),
    toStatus: itemStatus("to_status").notNull(),
    actorUserId: uuid("actor_user_id").references(() => appUser.id),
    actorLabel: text("actor_label").notNull(),
    reason: text("reason"),
    occurredAt: createdAt(),
  },
  (t) => [
    index("item_status_transition_by_item").on(t.itemId, t.occurredAt),
    nonBlank(t.actorLabel, "item_status_transition_names_an_actor"),
  ],
);

/**
 * Which status may follow which — as data, not as code.
 *
 * A legal transition is then a row to insert rather than a migration plus a
 * redeploy, and the trigger that enforces it reads this table. The TypeScript
 * copy in `server/contracts/item.ts` exists only so the API can explain a
 * refusal; a test asserts the two agree.
 */
export const statusTransition = pgTable(
  "status_transition",
  {
    fromStatus: itemStatus("from_status").notNull(),
    toStatus: itemStatus("to_status").notNull(),
    /** Null means any authenticated staff member may make this move. */
    requiresCapability: text("requires_capability"),
  },
  (t) => [primaryKey({ columns: [t.fromStatus, t.toStatus] })],
);

export type InformationItem = typeof informationItem.$inferSelect;
export type NewInformationItem = typeof informationItem.$inferInsert;
export type ItemStatusTransition = typeof itemStatusTransition.$inferSelect;
