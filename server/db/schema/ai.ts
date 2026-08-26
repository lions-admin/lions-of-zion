/**
 * What the model was asked, what it cost, and what it proposed.
 *
 * The whole point of these three tables is that "the AI said so" is never a
 * sufficient answer. `prompt_registry` says exactly which text produced a
 * result, `ai_run` says what it cost and which model answered, and
 * `ai_suggestion` keeps the model's output *outside* the entity until a named
 * human accepts it. Nothing here writes to `information_item` or
 * `item_assessment` directly, by construction.
 *
 * `prompt_registry` and `ai_run` are append-only (the shared
 * `reject_mutation()` trigger). An editable prompt version means an assessment
 * can cite a prompt whose text has since changed underneath it, which makes
 * the citation worse than none.
 */

import { sql } from "drizzle-orm";
import {
  check,
  index,
  integer,
  jsonb,
  numeric,
  pgTable,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { aiRunKind, dataClass, entityType } from "./_enums";
import { appUser } from "./identity";
import { createdAt, isLanguage, nonBlank, primaryId, sha256Col, isSha256, tsCol, updatedAt } from "./_shared";

export const promptRegistry = pgTable(
  "prompt_registry",
  {
    id: primaryId(),
    /** Stable across versions: `extract.claim`, `translate.article`. */
    slug: text("slug").notNull(),
    version: integer("version").notNull(),
    kind: aiRunKind("kind").notNull(),
    /** The exact text sent, templated. Append-only — a prompt version is a
     *  fixed artifact that results are allowed to cite. */
    template: text("template").notNull(),
    /** Which profile this prompt expects (`fast`, `reasoning`, …), not a
     *  provider slug — the slug lives in `server/core/config.ts` alone. */
    modelProfile: text("model_profile").notNull(),
    notes: text("notes"),
    /** Null until this version is the one in use. Exactly one active version
     *  per slug, enforced below. */
    activatedAt: tsCol("activated_at"),
    createdBy: uuid("created_by").references(() => appUser.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("prompt_registry_version_is_unique").on(t.slug, t.version),
    uniqueIndex("prompt_registry_one_active_per_slug")
      .on(t.slug)
      .where(sql`${t.activatedAt} IS NOT NULL`),
    check("prompt_registry_version_is_positive", sql`${t.version} >= 1`),
    nonBlank(t.template, "prompt_registry_has_a_template"),
    nonBlank(t.slug, "prompt_registry_has_a_slug"),
  ],
);

/**
 * One row per model call. Append-only.
 *
 * `cost_usd` is `numeric`, never a float: this is money, it is summed for the
 * budget guard, and binary floating point loses cents in exactly the direction
 * that makes a ceiling stop working.
 */
export const aiRun = pgTable(
  "ai_run",
  {
    id: primaryId(),
    kind: aiRunKind("kind").notNull(),
    /** The resolved provider slug, recorded verbatim — the profile mapping
     *  will change, and a run must stay readable after it does. */
    model: text("model").notNull(),
    modelProfile: text("model_profile").notNull(),
    promptId: uuid("prompt_id").references(() => promptRegistry.id),

    /** What it was run against, when it was about something in particular. */
    subjectType: entityType("subject_type"),
    subjectId: uuid("subject_id"),

    inputTokens: integer("input_tokens"),
    outputTokens: integer("output_tokens"),
    // Nine decimal places preserve sub-micro-dollar embedding calls instead
    // of rounding a real Gateway charge down to zero.
    costUsd: numeric("cost_usd", { precision: 16, scale: 9 }),
    latencyMs: integer("latency_ms"),

    /** `ok`, or the error class — never the provider's raw message, which can
     *  echo the prompt back and with it whatever was in the input. */
    status: text("status").notNull(),
    errorCode: text("error_code"),

    /** sha256 of the input, so an identical run is recognisable without
     *  storing the input itself. */
    inputHash: sha256Col("input_hash"),
    /** The highest classification present in the input. The CHECK below is
     *  the one that matters most in this file. */
    inputDataClass: dataClass("input_data_class").notNull().default("public"),

    actorLabel: text("actor_label").notNull(),
    actorUserId: uuid("actor_user_id").references(() => appUser.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("ai_run_by_subject").on(t.subjectType, t.subjectId, t.createdAt),
    /* The budget guard's only query: sum cost over a time window. */
    index("ai_run_by_time").on(t.createdAt),
    nonBlank(t.model, "ai_run_names_a_model"),
    nonBlank(t.status, "ai_run_has_a_status"),
    nonBlank(t.actorLabel, "ai_run_names_an_actor"),
    isSha256(t.inputHash, "ai_run_input_hash_is_sha256"),
    check("ai_run_cost_is_not_negative", sql`${t.costUsd} IS NULL OR ${t.costUsd} >= 0`),
    /* Restricted material must never be recorded as having been sent to a
       model. This is a CHECK rather than a service rule because the row IS
       the record — if the row can exist, the send already happened, and the
       only place to refuse it that survives a service bug is here. */
    check(
      "restricted_data_never_reaches_a_model",
      sql`${t.inputDataClass} NOT IN ('restricted', 'secret')`,
    ),
  ],
);

/**
 * What the model proposed — held outside the entity until a human accepts it.
 *
 * This is the table that makes "AI with human approval gates" structural
 * rather than procedural. There is no path from a model's output to a
 * published claim that does not pass through a row here being accepted by a
 * named person.
 */
export const aiSuggestion = pgTable(
  "ai_suggestion",
  {
    id: primaryId(),
    aiRunId: uuid("ai_run_id")
      .notNull()
      .references(() => aiRun.id),
    subjectType: entityType("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    /** What is being proposed: `summary`, `relation`, `topic`, … */
    field: text("field").notNull(),
    /** The proposal itself, shaped by `field`. */
    proposed: jsonb("proposed").notNull(),
    /** What the entity said when the suggestion was made, so a reviewer can
     *  see the diff they are actually accepting rather than a diff against
     *  whatever the row has drifted to since. */
    baseline: jsonb("baseline"),
    /** The model's own stated reasoning. Required — an unexplained suggestion
     *  is not reviewable, it is only acceptable or not. */
    rationale: text("rationale").notNull(),

    /** `pending` until someone acts. Accepting is what writes to the entity,
     *  through the normal versioned path, with `change_source =
     *  ai_suggestion_accepted` and this run's id. */
    status: text("status").notNull().default("pending"),
    decidedBy: uuid("decided_by").references(() => appUser.id),
    decidedAt: tsCol("decided_at"),
    decisionNote: text("decision_note"),

    createdAt: createdAt(),
  },
  (t) => [
    index("ai_suggestion_by_subject").on(t.subjectType, t.subjectId, t.status),
    index("ai_suggestion_pending").on(t.createdAt).where(sql`${t.status} = 'pending'`),
    nonBlank(t.field, "ai_suggestion_names_a_field"),
    nonBlank(t.rationale, "ai_suggestion_states_its_reasoning"),
    check(
      "ai_suggestion_status_is_known",
      sql`${t.status} IN ('pending', 'accepted', 'rejected', 'superseded')`,
    ),
    /* A HUMAN decision names the human. Anonymous acceptance of a model's
       output is the failure this whole table exists to prevent.

       `superseded` is deliberately exempt: it is not a decision, it is the
       system retiring a stale proposal when a newer one arrives for the same
       field, and there is no person to name. Demanding a decider for it —
       which the first draft of this CHECK did — forces the superseding code
       to invent one, which is precisely the false attribution the rest of
       this table is built to prevent. */
    check(
      "human_decision_is_attributed",
      sql`${t.status} NOT IN ('accepted', 'rejected')
          OR (${t.decidedBy} IS NOT NULL AND ${t.decidedAt} IS NOT NULL)`,
    ),
  ],
);

/**
 * A translation of one entity's field into one language.
 *
 * `source_content_hash` is the only way to know a translation is stale: it
 * records the hash of the text that was actually translated, so a source edit
 * makes the mismatch visible instead of leaving a confidently wrong
 * translation in place.
 */
export const translation = pgTable(
  "translation",
  {
    id: primaryId(),
    subjectType: entityType("subject_type").notNull(),
    subjectId: uuid("subject_id").notNull(),
    field: text("field").notNull(),
    language: text("language").notNull(),
    content: text("content").notNull(),

    /** md5 of the source text at translation time. Compare against the
     *  source's current hash to detect staleness. */
    sourceContentHash: text("source_content_hash").notNull(),

    /** Null when a human translated it. */
    aiRunId: uuid("ai_run_id").references(() => aiRun.id),
    /** A machine translation nobody has checked must be labelled as such
     *  wherever it is shown. */
    reviewedBy: uuid("reviewed_by").references(() => appUser.id),
    reviewedAt: tsCol("reviewed_at"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    uniqueIndex("translation_is_one_per_field_and_language").on(
      t.subjectType,
      t.subjectId,
      t.field,
      t.language,
    ),
    nonBlank(t.content, "translation_has_content"),
    nonBlank(t.sourceContentHash, "translation_records_its_source_hash"),
    isLanguage(t.language, "translation_language_is_a_tag"),
    check(
      "reviewed_translation_is_attributed",
      sql`(${t.reviewedBy} IS NULL) = (${t.reviewedAt} IS NULL)`,
    ),
  ],
);

export type PromptRegistryEntry = typeof promptRegistry.$inferSelect;
export type AiRun = typeof aiRun.$inferSelect;
export type NewAiRun = typeof aiRun.$inferInsert;
export type AiSuggestion = typeof aiSuggestion.$inferSelect;
export type Translation = typeof translation.$inferSelect;
