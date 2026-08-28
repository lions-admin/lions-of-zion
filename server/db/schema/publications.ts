/**
 * The four publication surfaces, as one table.
 *
 * The brief lists `news_update`, `brief`, `geopolitical_analysis` and
 * `scenario` separately, and the first instinct is four tables. They would be
 * four near-identical tables: the same lifecycle, the same versioning path,
 * the same publish gate, the same approver rules — differing only in which
 * two or three optional columns they use. That is four places to forget the
 * gate, and four migrations every time the gate changes.
 *
 * So they are one table discriminated by `kind`, with the kind-specific
 * columns nullable and their presence enforced by CHECKs. This is the same
 * argument `entity_version` makes against per-entity version tables, and the
 * opposite call from `item_assessment` — which kept its own table precisely
 * because its constraints are legally load-bearing and unlike anything else.
 *
 * `scenario_likelihood` is a band and there is deliberately **no numeric
 * probability column anywhere**. A fabricated `0.62` gets screenshotted and
 * quoted, and no amount of surrounding caveat travels with the screenshot.
 */

import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { evidence } from "./evidence";
import { likelihoodBand, publicationKind, publicationSection, publicationStatus } from "./_enums";
import { appUser } from "./identity";
import { informationItem } from "./items";
import { narrative } from "./narratives";
import { event, topic } from "./taxonomy";
import { entityVersion } from "./versioning";
import { createdAt, isLanguage, nonBlank, primaryId, tsCol, updatedAt } from "./_shared";

export const publication = pgTable(
  "publication",
  {
    id: primaryId(),
    kind: publicationKind("kind").notNull(),
    section: publicationSection("section").notNull().default("israel_update"),
    publicId: text("public_id").notNull().unique(),

    title: text("title").notNull(),
    /** The standfirst — one paragraph, shown in listings. */
    summary: text("summary"),
    body: text("body").notNull(),
    language: text("language").notNull(),

    status: publicationStatus("status").notNull().default("draft"),
    publishedAt: tsCol("published_at"),
    /** A transparent audit marker for the owner-approved automatic policy.
     * It never pretends that a named human reviewed the article. */
    autoPublishedAt: tsCol("auto_published_at"),

    eventId: uuid("event_id").references(() => event.id),
    primaryTopicId: uuid("primary_topic_id").references(() => topic.id),

    /** Scenarios only — a band, never a number. Enforced both ways below. */
    scenarioLikelihood: likelihoodBand("scenario_likelihood"),
    /** Scenarios only: what would have to happen for this to occur. */
    scenarioIndicators: text("scenario_indicators"),

    createdBy: uuid("created_by").references(() => appUser.id),
    /** The second human, same rule as an information item. */
    approvedBy: uuid("approved_by").references(() => appUser.id),

    currentVersionId: uuid("current_version_id").references(() => entityVersion.id),

    contentHash: text("content_hash").generatedAlwaysAs(
      sql`md5(title || E'\n' || body || E'\n' || coalesce(summary, ''))`,
    ),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("publication_by_kind_status").on(t.kind, t.status, t.createdAt),
    index("publication_by_section_status").on(t.section, t.status, t.publishedAt),
    index("publication_live").on(t.publishedAt).where(sql`${t.publishedAt} IS NOT NULL`),
    nonBlank(t.title, "publication_is_titled"),
    nonBlank(t.body, "publication_has_a_body"),
    isLanguage(t.language, "publication_language_is_a_tag"),
    /* A published publication is either explicitly human-approved or carries
       the distinct automatic-publication marker. The trigger keeps the human
       path's non-self-approval rule intact. */
    check(
      "published_publication_has_timestamp_and_approver",
      sql`${t.status} NOT IN ('published', 'updated')
          OR (${t.publishedAt} IS NOT NULL
              AND (${t.approvedBy} IS NOT NULL OR ${t.autoPublishedAt} IS NOT NULL))`,
    ),
    /* A scenario states a likelihood band; nothing else may. Both directions
       matter: a scenario without one is an assertion wearing a hedge, and a
       brief with one is a forecast nobody reviewed as such. */
    check(
      "only_scenarios_state_a_likelihood",
      sql`(${t.kind} = 'scenario') = (${t.scenarioLikelihood} IS NOT NULL)`,
    ),
  ],
);

/** Which items a publication rests on. A brief that cites no item is
 *  editorially possible but worth being able to find. */
export const publicationItem = pgTable(
  "publication_item",
  {
    publicationId: uuid("publication_id")
      .notNull()
      .references(() => publication.id, { onDelete: "cascade" }),
    itemId: uuid("item_id")
      .notNull()
      .references(() => informationItem.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("publication_item_is_unique").on(t.publicationId, t.itemId),
    index("publication_item_by_item").on(t.itemId),
  ],
);

/** A publication may describe a recurring narrative without assigning a
 * verdict to the narrative itself. The linked evidence and items carry the
 * claim-level assessment. */
export const publicationNarrative = pgTable(
  "publication_narrative",
  {
    publicationId: uuid("publication_id").notNull().references(() => publication.id, { onDelete: "cascade" }),
    narrativeId: uuid("narrative_id").notNull().references(() => narrative.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.publicationId, t.narrativeId], name: "publication_narrative_pk" }),
    index("publication_narrative_by_narrative").on(t.narrativeId),
  ],
);

/** Direct source evidence joins make every generated article traceable even
 * when an item is still under investigation. */
export const publicationEvidence = pgTable(
  "publication_evidence",
  {
    publicationId: uuid("publication_id").notNull().references(() => publication.id, { onDelete: "cascade" }),
    evidenceId: uuid("evidence_id").notNull().references(() => evidence.id, { onDelete: "cascade" }),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.publicationId, t.evidenceId], name: "publication_evidence_pk" }),
    index("publication_evidence_by_evidence").on(t.evidenceId),
  ],
);

/** Exactly three ordered homepage slots. Keeping placement in a separate
 * table avoids turning a publication's editorial history into page chrome. */
export const homepageFeature = pgTable(
  "homepage_feature",
  {
    slot: integer("slot").primaryKey(),
    publicationId: uuid("publication_id").notNull().unique().references(() => publication.id, { onDelete: "cascade" }),
    updatedAt: updatedAt(),
  },
  (t) => [check("homepage_feature_slot_is_valid", sql`${t.slot} BETWEEN 1 AND 3`)],
);

/** The idempotency record for discovery, drafting and automatic publication.
 * `localDate` is an Israel-local calendar date, not a UTC approximation. */
export const briefingRun = pgTable(
  "briefing_run",
  {
    id: primaryId(),
    localDate: text("local_date").notNull(),
    stage: text("stage").notNull(),
    status: text("status").notNull(),
    inputCount: integer("input_count").notNull().default(0),
    outputCount: integer("output_count").notNull().default(0),
    errorMessage: text("error_message"),
    startedAt: tsCol("started_at").notNull(),
    finishedAt: tsCol("finished_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("briefing_run_once_per_stage_day").on(t.localDate, t.stage),
    index("briefing_run_by_date").on(t.localDate, t.createdAt),
    nonBlank(t.stage, "briefing_run_has_stage"),
    nonBlank(t.status, "briefing_run_has_status"),
  ],
);

export type Publication = typeof publication.$inferSelect;
export type NewPublication = typeof publication.$inferInsert;
