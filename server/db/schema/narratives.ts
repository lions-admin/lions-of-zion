/**
 * Who spreads what, and whether it is spreading or merely being amplified.
 *
 * Everything built before this answers "is this claim true". Nothing answered
 * "what is circulating right now, who is pushing it, and is that independent
 * spread or one operation wearing many faces". That is this file.
 *
 * Three shapes worth understanding before editing:
 *
 *   1. **A narrative is not an information item.** An item is a discrete
 *      claim that gets a verdict. A narrative is a persistent theme with a
 *      trajectory — when it appeared, whether it is building or fading. The
 *      opposite call from `publication`, where four surfaces were merged into
 *      one table *because* their lifecycle was identical. Here it isn't.
 *
 *   2. **A narrative carries no `assessment`.** A whole narrative is not
 *      "false" — the claims composing it are what get checked, each on its
 *      own. One sweeping verdict over a theme is exactly the overreach this
 *      platform exists to document, so the schema cannot express it.
 *
 *   3. **`source_family` finally does its most important job.** The signal
 *      that matters is not how many accounts pushed something, but how many
 *      *independent source families* did. Twenty accounts from one family is
 *      amplification; three from three families is spread. Counting accounts
 *      is how a monitoring system mistakes a megaphone for a consensus.
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
  uuid,
} from "drizzle-orm/pg-core";
import { actorKind, dataClass, narrativeStatus } from "./_enums";
import { appUser } from "./identity";
import { evidence } from "./evidence";
import { informationItem } from "./items";
import { event, topic } from "./taxonomy";
import { entityVersion } from "./versioning";
import { createdAt, isLanguage, nonBlank, primaryId, tsCol, updatedAt } from "./_shared";

/**
 * Who spreads. Uses `actor_kind`, which was declared in Phase 1 and then had
 * no table for eight phases — the vocabulary was always meant for this.
 */
export const actor = pgTable(
  "actor",
  {
    id: primaryId(),
    publicId: text("public_id").notNull().unique(),
    kind: actorKind("kind").notNull(),
    name: text("name").notNull(),
    /** Other names the same actor operates under. Kept as an array rather
     *  than a join table because nothing queries an alias on its own — it is
     *  matching material, not an entity. */
    aliases: text("aliases").array().notNull().default(sql`'{}'::text[]`),
    country: text("country"),
    /** platform → handle. jsonb because the set of platforms changes faster
     *  than a migration cycle. */
    platformHandles: jsonb("platform_handles"),
    description: text("description"),
    /** `internal` by default: naming someone as a spreader is an allegation
     *  before it is a finding, and it should not be public by accident. */
    dataClass: dataClass("data_class").notNull().default("internal"),
    currentVersionId: uuid("current_version_id").references(() => entityVersion.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("actor_by_kind").on(t.kind),
    index("actor_by_country").on(t.country),
    nonBlank(t.name, "actor_is_named"),
  ],
);

export const narrative = pgTable(
  "narrative",
  {
    id: primaryId(),
    publicId: text("public_id").notNull().unique(),
    title: text("title").notNull(),
    summary: text("summary"),
    language: text("language").notNull(),
    status: narrativeStatus("status").notNull().default("emerging"),

    primaryTopicId: uuid("primary_topic_id").references(() => topic.id),
    eventId: uuid("event_id").references(() => event.id),

    /* ── Derived. Trigger-maintained from observations. Never app-written. ──
       Same guard and same sanctioned bypass (`app.syncing_derived`) as the
       derived columns on `information_item`. A narrative whose `last_seen_at`
       disagrees with its observations is a monitoring system reporting a
       quiet threat as quiet. */
    firstSeenAt: tsCol("first_seen_at"),
    lastSeenAt: tsCol("last_seen_at"),
    observationCount: integer("observation_count").notNull().default(0),

    currentVersionId: uuid("current_version_id").references(() => entityVersion.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("narrative_by_status").on(t.status, t.lastSeenAt),
    index("narrative_active").on(t.lastSeenAt).where(sql`${t.status} IN ('emerging','active')`),
    nonBlank(t.title, "narrative_is_titled"),
    isLanguage(t.language, "narrative_language_is_a_tag"),
    check("narrative_count_is_not_negative", sql`${t.observationCount} >= 0`),
  ],
);

/** Which checked claims compose this narrative. The findings about a
 *  narrative are the accumulation of these items' assessments — which is why
 *  the narrative itself needs no verdict column. */
export const narrativeItem = pgTable(
  "narrative_item",
  {
    narrativeId: uuid("narrative_id")
      .notNull()
      .references(() => narrative.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => informationItem.id, { onDelete: "cascade" }),
    /** Why this claim belongs to this narrative. Required, same argument as
     *  every other rationale in the schema: an unexplained grouping is an
     *  assertion, and grouping claims is how a theme gets defined. */
    rationale: text("rationale").notNull(),
    addedBy: uuid("added_by").references(() => appUser.id),
    confirmedBy: uuid("confirmed_by").references(() => appUser.id),
    confirmedAt: tsCol("confirmed_at"),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.narrativeId, t.itemId] }),
    index("narrative_item_by_item").on(t.itemId),
    nonBlank(t.rationale, "narrative_item_states_why"),
    check(
      "narrative_item_confirmation_is_paired",
      sql`(${t.confirmedBy} IS NULL) = (${t.confirmedAt} IS NULL)`,
    ),
  ],
);

/**
 * One sighting: this narrative, pushed by this actor, at this time — with the
 * evidence that shows it.
 *
 * `evidence_id` is NOT NULL and that is the load-bearing decision in this
 * table. An attribution with no source is precisely the kind of claim this
 * platform exists to refuse; producing them internally would be indefensible.
 *
 * Append-only: an observation is a record of something seen at a moment. If
 * it was wrong, the correction is a new row, not a rewrite of history.
 */
export const narrativeObservation = pgTable(
  "narrative_observation",
  {
    id: primaryId(),
    narrativeId: uuid("narrative_id")
      .notNull()
      .references(() => narrative.id, { onDelete: "cascade" }),
    /** Nullable on purpose: spread is often visible before attribution is.
     *  An anonymous sighting is still a real signal about volume and reach. */
    actorId: uuid("actor_id").references(() => actor.id),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => evidence.id),
    observedAt: tsCol("observed_at").notNull().defaultNow(),
    platform: text("platform"),
    /** What the platform said, not what we verified. Named `reported_` so no
     *  reader mistakes it for a measurement of ours — engagement numbers are
     *  trivially inflated and are exactly the figure a hostile actor controls. */
    reportedReach: integer("reported_reach"),
    /** Set when a human confirms the attribution. Observations naming a state
     *  or network actor do not count toward any signal without it. */
    confirmedBy: uuid("confirmed_by").references(() => appUser.id),
    confirmedAt: tsCol("confirmed_at"),
    note: text("note"),
    createdAt: createdAt(),
  },
  (t) => [
    index("narrative_observation_by_narrative").on(t.narrativeId, t.observedAt),
    index("narrative_observation_by_actor").on(t.actorId, t.observedAt),
    check(
      "narrative_observation_confirmation_is_paired",
      sql`(${t.confirmedBy} IS NULL) = (${t.confirmedAt} IS NULL)`,
    ),
    check(
      "reported_reach_is_not_negative",
      sql`${t.reportedReach} IS NULL OR ${t.reportedReach} >= 0`,
    ),
  ],
);

export type Actor = typeof actor.$inferSelect;
export type NewActor = typeof actor.$inferInsert;
export type Narrative = typeof narrative.$inferSelect;
export type NewNarrative = typeof narrative.$inferInsert;
export type NarrativeObservation = typeof narrativeObservation.$inferSelect;
