/**
 * What evidence says about an item, and what we concluded.
 *
 * `item_evidence` gives one piece of evidence exactly one stated relation to
 * one item — a composite primary key on `(item_id, evidence_id)` makes a
 * second, competing edge structurally impossible. AI's own opinion lives in
 * `ai_relation` on that same row, never as a second edge it could disagree
 * with. Only a `confirmed_by IS NOT NULL` edge counts toward what a verdict
 * is allowed to be — `canAssignVerdict()` in `server/modules/assessments/rules.ts`
 * reads exactly that column.
 *
 * `item_assessment` breaks the one-generic-version-table rule on purpose: its
 * CHECKs are legally load-bearing and its ten confidence dimensions are
 * queried directly, so it keeps typed columns instead of a jsonb snapshot.
 * It is immutable except for one column — `superseded_by_assessment_id` — set
 * only by the next assessment for the same item. A row that can be edited is
 * not a record of what was concluded at the time; it is a record of what
 * someone wishes had been concluded.
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
import {
  assessmentValue,
  confidenceLevel,
  confidenceSummary,
  evidenceRelation,
  evidenceStrength,
  queueState,
} from "./_enums";
import { appUser } from "./identity";
import { informationItem } from "./items";
import { evidence } from "./evidence";
import { createdAt, nonBlank, primaryId, tsCol, updatedAt } from "./_shared";

export const itemEvidence = pgTable(
  "item_evidence",
  {
    itemId: uuid("item_id")
      .notNull()
      .references(() => informationItem.id, { onDelete: "cascade" }),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => evidence.id),
    relation: evidenceRelation("relation").notNull(),
    /** AI's competing read of the same edge — never a second row. */
    aiRelation: evidenceRelation("ai_relation"),
    strength: evidenceStrength("strength").notNull(),
    /** Why this piece of evidence bears this relation. The same argument as
     *  `known_gaps`: an unexplained edge is not a finding. */
    rationale: text("rationale").notNull(),
    addedBy: uuid("added_by").references(() => appUser.id),
    /** Null until a human confirms it. Only confirmed edges count toward
     *  verdict eligibility — AI or a first pass can propose an edge, but
     *  cannot make it count. */
    confirmedBy: uuid("confirmed_by").references(() => appUser.id),
    confirmedAt: tsCol("confirmed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.itemId, t.evidenceId] }),
    index("item_evidence_by_evidence").on(t.evidenceId),
    nonBlank(t.rationale, "item_evidence_states_why"),
    check(
      "item_evidence_confirmation_is_paired",
      sql`(${t.confirmedBy} IS NULL) = (${t.confirmedAt} IS NULL)`,
    ),
  ],
);

export const itemAssessment = pgTable(
  "item_assessment",
  {
    id: primaryId(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => informationItem.id, { onDelete: "cascade" }),
    value: assessmentValue("value").notNull(),
    summary: text("summary").notNull(),
    /** What remains unknown even after this assessment. The same rule as
     *  every other reasoning field here: blank is an evasion. */
    knownGaps: text("known_gaps").notNull(),
    /** Required only for `misleading` — see the CHECK below. What false
     *  impression the item creates, stated rather than implied. */
    falseImpression: text("false_impression"),

    confidenceEvidenceCoverage: confidenceLevel("confidence_evidence_coverage").notNull(),
    confidenceSourceIndependence: confidenceLevel("confidence_source_independence").notNull(),
    confidenceSourceAuthority: confidenceLevel("confidence_source_authority").notNull(),
    confidenceMediaProvenance: confidenceLevel("confidence_media_provenance").notNull(),
    confidenceTemporalConsistency: confidenceLevel("confidence_temporal_consistency").notNull(),
    confidenceGeographicConsistency: confidenceLevel("confidence_geographic_consistency").notNull(),
    confidenceContradictionLevel: confidenceLevel("confidence_contradiction_level").notNull(),
    confidenceTranslationCertainty: confidenceLevel("confidence_translation_certainty").notNull(),
    confidenceHumanReviewState: confidenceLevel("confidence_human_review_state").notNull(),
    confidenceRemainingGaps: confidenceLevel("confidence_remaining_gaps").notNull(),
    /** Rolled up from the ten dimensions above, at write time, by
     *  `summarizeConfidence()` — not recomputed later. */
    confidenceSummary: confidenceSummary("confidence_summary").notNull(),

    /** 1 (single reviewer) or 2 (elevated: two independent human sign-offs).
     *  `requiredReviewLevel()` derives the floor from `value`; the CHECK below
     *  duplicates the one bound that must survive a service bug. */
    reviewLevel: integer("review_level").notNull().default(1),

    /** The rules engine's output at the moment of writing — which verdicts
     *  were eligible and why. Frozen: a reader two years later sees which bar
     *  this passed, which re-running today's code cannot tell them. */
    eligibility: jsonb("eligibility").notNull(),

    /** The one mutable column. Set only by the next assessment for this item.
     *  Deliberately NOT a foreign key: the service points the outgoing
     *  assessment at the incoming one's id before that row exists, so the old
     *  row is never briefly `NULL`-and-colliding with the new one under
     *  `item_assessment_one_current_per_item`, which is a plain index and
     *  cannot be made deferrable — Postgres does not support a deferrable
     *  partial unique constraint. `enforce_assessment_immutability()` is what
     *  actually guards this column; a FK would only add a race it cannot win. */
    supersededByAssessmentId: uuid("superseded_by_assessment_id"),

    /** Nullable until Phase 8 supplies real identities — same as
     *  `information_item.created_by`. The self-review guards this enables
     *  (here and in the publish gate) are only as meaningful as the actor
     *  attribution feeding them. */
    createdBy: uuid("created_by").references(() => appUser.id),
    /** The second human. Null until this assessment has been reviewed —
     *  distinct from `information_item.approved_by`, which is about
     *  publishing the item, not reviewing this specific assessment. */
    approvedBy: uuid("approved_by").references(() => appUser.id),

    createdAt: createdAt(),
  },
  (t) => [
    index("item_assessment_by_item").on(t.itemId, t.createdAt),
    /* At most one live (non-superseded) assessment per item — the invariant
       `information_item.current_assessment_id` depends on. */
    uniqueIndex("item_assessment_one_current_per_item")
      .on(t.itemId)
      .where(sql`${t.supersededByAssessmentId} IS NULL`),
    nonBlank(t.summary, "item_assessment_has_a_summary"),
    nonBlank(t.knownGaps, "item_assessment_states_its_gaps"),
    check("item_assessment_review_level_is_1_or_2", sql`${t.reviewLevel} IN (1, 2)`),
    check(
      "manipulated_requires_elevated_review",
      sql`${t.value} <> 'manipulated' OR ${t.reviewLevel} >= 2`,
    ),
    check(
      "misleading_states_the_false_impression",
      sql`${t.value} <> 'misleading'
          OR length(btrim(coalesce(${t.falseImpression}, ''))) > 0`,
    ),
  ],
);

export const reviewQueue = pgTable(
  "review_queue",
  {
    id: primaryId(),
    itemId: uuid("item_id")
      .notNull()
      .references(() => informationItem.id, { onDelete: "cascade" }),
    /** Free text, not an enum: what needs doing grows with the workflow —
     *  "initial_review", "assessment_approval", "evidence_linking" today,
     *  more later, none of them worth a migration to add. */
    kind: text("kind").notNull(),
    state: queueState("state").notNull().default("open"),
    priority: integer("priority").notNull().default(0),
    claimedBy: uuid("claimed_by").references(() => appUser.id),
    claimedAt: tsCol("claimed_at"),
    completedBy: uuid("completed_by").references(() => appUser.id),
    completedAt: tsCol("completed_at"),
    note: text("note"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("review_queue_by_state").on(t.state, t.priority, t.createdAt),
    index("review_queue_by_item").on(t.itemId),
    nonBlank(t.kind, "review_queue_names_a_kind"),
    check(
      "claimed_queue_entry_has_a_claimant",
      sql`${t.state} <> 'claimed' OR ${t.claimedBy} IS NOT NULL`,
    ),
    check(
      "resolved_queue_entry_is_attributed",
      sql`${t.state} NOT IN ('done', 'dropped')
          OR (${t.completedBy} IS NOT NULL AND ${t.completedAt} IS NOT NULL)`,
    ),
  ],
);

export type ItemEvidence = typeof itemEvidence.$inferSelect;
export type NewItemEvidence = typeof itemEvidence.$inferInsert;
export type ItemAssessment = typeof itemAssessment.$inferSelect;
export type NewItemAssessment = typeof itemAssessment.$inferInsert;
export type ReviewQueueEntry = typeof reviewQueue.$inferSelect;
export type NewReviewQueueEntry = typeof reviewQueue.$inferInsert;
