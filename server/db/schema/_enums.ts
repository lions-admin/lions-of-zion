/**
 * Postgres enum types, generated from the contract arrays.
 *
 * `pgEnum` is handed the same const array Zod is handed, so the database and
 * the validation layer cannot drift. Adding a value means editing exactly one
 * line in `server/contracts/enums.ts`.
 *
 * Every type is declared here in Phase 1, including ones whose tables arrive
 * in Phase 6 or 8. Enum types cost nothing until used, and declaring them
 * up front keeps `CREATE TYPE` out of seven later migrations.
 */

import { pgEnum } from "drizzle-orm/pg-core";
import {
  ACTOR_KINDS,
  AI_RUN_KINDS,
  ASSESSMENT_VALUES,
  CHANGE_SOURCES,
  CONFIDENCE_LEVELS,
  CONFIDENCE_SUMMARIES,
  DATA_CLASSES,
  ENTITY_TYPES,
  EVIDENCE_KINDS,
  EVIDENCE_RELATIONS,
  EVIDENCE_STRENGTHS,
  INFORMATION_ITEM_TYPES,
  ITEM_STATUSES,
  LIKELIHOOD_BANDS,
  QUEUE_STATES,
  SOURCE_KINDS,
} from "@/server/contracts/enums";

export const assessmentValue = pgEnum("assessment_value", ASSESSMENT_VALUES);
export const itemStatus = pgEnum("item_status", ITEM_STATUSES);
export const informationItemType = pgEnum("information_item_type", INFORMATION_ITEM_TYPES);
export const confidenceLevel = pgEnum("confidence_level", CONFIDENCE_LEVELS);
export const confidenceSummary = pgEnum("confidence_summary", CONFIDENCE_SUMMARIES);
export const evidenceRelation = pgEnum("evidence_relation", EVIDENCE_RELATIONS);
export const evidenceStrength = pgEnum("evidence_strength", EVIDENCE_STRENGTHS);
export const evidenceKind = pgEnum("evidence_kind", EVIDENCE_KINDS);
export const dataClass = pgEnum("data_class", DATA_CLASSES);
export const sourceKind = pgEnum("source_kind", SOURCE_KINDS);
export const actorKind = pgEnum("actor_kind", ACTOR_KINDS);
export const changeSource = pgEnum("change_source", CHANGE_SOURCES);
export const entityType = pgEnum("entity_type", ENTITY_TYPES);
export const queueState = pgEnum("queue_state", QUEUE_STATES);
export const aiRunKind = pgEnum("ai_run_kind", AI_RUN_KINDS);
export const likelihoodBand = pgEnum("likelihood_band", LIKELIHOOD_BANDS);
