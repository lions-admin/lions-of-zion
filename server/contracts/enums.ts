/**
 * The vocabulary, once.
 *
 * These const arrays are the single source of truth for both the Zod schemas
 * and the Postgres enum types — `server/db/schema/_enums.ts` builds every
 * `pgEnum` from the array right here, so a value cannot exist in the database
 * and not in the contracts, or the reverse.
 *
 * This file imports nothing but `zod`. It has to stay importable from a React
 * Server Component and from a test with no database, which is what lets the
 * frontend eventually share these types with no risk of dragging a Postgres
 * driver into a client bundle.
 */

import { z } from "zod";

/** Turns a const array into a Zod enum without restating the members. */
const enumOf = <T extends readonly [string, ...string[]]>(values: T) => z.enum(values);

/* ── Assessment ────────────────────────────────────────────────────────────
   The spec listed `undetermined` alongside `unverified`. Nobody applies that
   distinction consistently, and an inconsistently applied verdict label is
   worse than a missing one, so they are collapsed.

   `unsupported` and `satire` are added back. "We searched and found nothing"
   is editorially different from "nobody has looked yet", and satire is a real
   and frequent category here that is emphatically not `false`. */
export const ASSESSMENT_VALUES = [
  "false",
  "misleading",
  "manipulated",
  "out_of_context",
  "unsupported",
  "unverified",
  "contested",
  "satire",
  "verified",
] as const;
export const assessmentValueSchema = enumOf(ASSESSMENT_VALUES);
export type AssessmentValue = z.infer<typeof assessmentValueSchema>;

/** Workflow position. Deliberately a separate axis from the verdict — an item
 *  can be `published` with any assessment, and `under_review` with any too. */
export const ITEM_STATUSES = [
  "detected",
  "under_review",
  "reviewed",
  "edited",
  "approved",
  "published",
  "updated",
  "archived",
  "rejected",
] as const;
export const itemStatusSchema = enumOf(ITEM_STATUSES);
export type ItemStatus = z.infer<typeof itemStatusSchema>;

export const INFORMATION_ITEM_TYPES = [
  "claim",
  "narrative",
  "media_asset",
  "statement",
  "incident_report",
  "official_record",
  "campaign",
] as const;
export const informationItemTypeSchema = enumOf(INFORMATION_ITEM_TYPES);
export type InformationItemType = z.infer<typeof informationItemTypeSchema>;

/* ── Confidence ────────────────────────────────────────────────────────────
   Ten named dimensions on the assessment, never one number. The item carries
   only a derived summary, typed so that `0.94` cannot be stored in it. */
export const CONFIDENCE_LEVELS = ["high", "medium", "limited", "not_applicable"] as const;
export const confidenceLevelSchema = enumOf(CONFIDENCE_LEVELS);
export type ConfidenceLevel = z.infer<typeof confidenceLevelSchema>;

export const CONFIDENCE_SUMMARIES = ["high", "medium", "limited"] as const;
export const confidenceSummarySchema = enumOf(CONFIDENCE_SUMMARIES);
export type ConfidenceSummary = z.infer<typeof confidenceSummarySchema>;

export const CONFIDENCE_DIMENSIONS = [
  "evidence_coverage",
  "source_independence",
  "source_authority",
  "media_provenance",
  "temporal_consistency",
  "geographic_consistency",
  "contradiction_level",
  "translation_certainty",
  "human_review_state",
  "remaining_gaps",
] as const;
export type ConfidenceDimension = (typeof CONFIDENCE_DIMENSIONS)[number];

/* ── Evidence ──────────────────────────────────────────────────────────────
   `inconclusive` is dropped from the spec's list. An edge that concludes
   nothing is either `contextualizes` or should not exist; inconclusiveness is
   a property of the assessment, not of one piece of evidence's bearing. */
export const EVIDENCE_RELATIONS = [
  "supports",
  "partially_supports",
  "contradicts",
  "contextualizes",
] as const;
export const evidenceRelationSchema = enumOf(EVIDENCE_RELATIONS);
export type EvidenceRelation = z.infer<typeof evidenceRelationSchema>;

export const EVIDENCE_STRENGTHS = ["strong", "adequate", "weak", "contextual"] as const;
export const evidenceStrengthSchema = enumOf(EVIDENCE_STRENGTHS);
export type EvidenceStrength = z.infer<typeof evidenceStrengthSchema>;

export const EVIDENCE_KINDS = [
  "document",
  "article",
  "image",
  "video",
  "audio",
  "dataset",
  "satellite",
  "testimony",
  "official_record",
  "social_post",
] as const;
export const evidenceKindSchema = enumOf(EVIDENCE_KINDS);
export type EvidenceKind = z.infer<typeof evidenceKindSchema>;

/* ── Classification ────────────────────────────────────────────────────────
   Drives two hard constraints: restricted material may carry no URL or blob
   reference, and restricted material may never be recorded as sent to a model. */
export const DATA_CLASSES = ["public", "internal", "confidential", "restricted", "secret"] as const;
export const dataClassSchema = enumOf(DATA_CLASSES);
export type DataClass = z.infer<typeof dataClassSchema>;

/* ── Sources and actors ────────────────────────────────────────────────────── */
export const SOURCE_KINDS = [
  "rss",
  "api",
  "scraper",
  "telegram",
  "x",
  "youtube",
  "manual",
  "partner",
  "archive",
] as const;
export const sourceKindSchema = enumOf(SOURCE_KINDS);
export type SourceKind = z.infer<typeof sourceKindSchema>;

/** One row per fetch attempt, written once. `partial` is a fetch that reached
 *  the source but could not parse or store everything it found — distinct
 *  from `failed`, which never got usable data at all. */
export const FETCH_STATUSES = ["success", "partial", "failed"] as const;
export const fetchStatusSchema = enumOf(FETCH_STATUSES);
export type FetchStatus = z.infer<typeof fetchStatusSchema>;

export const ACTOR_KINDS = [
  "person",
  "organization",
  "state",
  "outlet",
  "network",
  "platform_account",
] as const;
export const actorKindSchema = enumOf(ACTOR_KINDS);
export type ActorKind = z.infer<typeof actorKindSchema>;

/* ── Provenance ───────────────────────────────────────────────────────────── */
export const CHANGE_SOURCES = [
  "human_edit",
  "ai_suggestion_accepted",
  "import",
  "correction",
  "migration",
  "workflow",
] as const;
export const changeSourceSchema = enumOf(CHANGE_SOURCES);
export type ChangeSource = z.infer<typeof changeSourceSchema>;

/** Everything that can be versioned, audited, queued for review, translated or
 *  indexed. Used as a discriminator on the polymorphic infrastructure tables. */
export const ENTITY_TYPES = [
  "information_item",
  "item_assessment",
  "evidence",
  "source",
  "event",
  "actor",
  "news_update",
  "brief",
  "geopolitical_analysis",
  "scenario",
  "translation",
  "report",
] as const;
export const entityTypeSchema = enumOf(ENTITY_TYPES);
export type EntityType = z.infer<typeof entityTypeSchema>;

export const QUEUE_STATES = ["open", "claimed", "blocked", "done", "dropped"] as const;
export const queueStateSchema = enumOf(QUEUE_STATES);
export type QueueState = z.infer<typeof queueStateSchema>;

/* ── AI ────────────────────────────────────────────────────────────────────── */
export const AI_RUN_KINDS = [
  "extract",
  "classify",
  "suggest_relation",
  "summarize",
  "translate",
  "embed",
  "chat",
  "rerank",
] as const;
export const aiRunKindSchema = enumOf(AI_RUN_KINDS);
export type AiRunKind = z.infer<typeof aiRunKindSchema>;

/* ── Publication surfaces ──────────────────────────────────────────────────
   News updates, briefs, analyses and scenarios share one lifecycle. It is
   deliberately NOT `item_status`: an information item is *detected* by
   ingestion, whereas a brief is *drafted* by a person, and there is no such
   thing as a `rejected` brief — an unwanted draft is archived. Reusing the
   item's list would have made three of its nine values unreachable here. */
export const PUBLICATION_STATUSES = [
  "draft",
  "under_review",
  "approved",
  "published",
  "updated",
  "archived",
] as const;
export const publicationStatusSchema = enumOf(PUBLICATION_STATUSES);
export type PublicationStatus = z.infer<typeof publicationStatusSchema>;

/** The five publication surfaces, as a discriminator. */
export const PUBLICATION_KINDS = [
  "news_update",
  "brief",
  "geopolitical_analysis",
  "scenario",
] as const;
export const publicationKindSchema = enumOf(PUBLICATION_KINDS);
export type PublicationKind = z.infer<typeof publicationKindSchema>;

/* ── User-submitted reports ────────────────────────────────────────────────
   Brief §44: reports *of suspected false information*, submitted by the
   public — not generated deliverables. The two terminal-ish states are
   distinct on purpose: `closed` means we looked and there was nothing to do,
   `rejected` means the submission itself was unusable (spam, abuse, empty). */
export const REPORT_STATUSES = [
  "received",
  "triaged",
  "investigating",
  "linked_to_existing_item",
  "converted_to_item",
  "closed",
  "rejected",
] as const;
export const reportStatusSchema = enumOf(REPORT_STATUSES);
export type ReportStatus = z.infer<typeof reportStatusSchema>;

/* ── Scenarios ─────────────────────────────────────────────────────────────
   Bands, never a percentage. There is deliberately no numeric probability
   column anywhere in the schema: a fabricated `0.62` gets screenshotted and
   quoted, and no amount of surrounding caveat travels with the screenshot. */
export const LIKELIHOOD_BANDS = ["remote", "unlikely", "even", "likely", "near_certain"] as const;
export const likelihoodBandSchema = enumOf(LIKELIHOOD_BANDS);
export type LikelihoodBand = z.infer<typeof likelihoodBandSchema>;

/* ── Capabilities ──────────────────────────────────────────────────────────
   Held as a const so `reject_automated_privilege` in SQL and the TypeScript
   guard cannot drift. An automated identity may never hold one of these. */
export const NEVER_AUTOMATED_CAPABILITIES = [
  "assessment.publish",
  "approval.grant",
  "evidence.restricted.read",
  "policy.manage",
] as const;
export type NeverAutomatedCapability = (typeof NEVER_AUTOMATED_CAPABILITIES)[number];
