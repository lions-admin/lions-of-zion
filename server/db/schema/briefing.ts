/** Stored editorial reasoning for the automated Daily Brief pipeline.
 * Anonymous readers receive only passage projections attached to a published
 * publication; run state, model links, checks and quarantine remain internal. */

import { sql } from "drizzle-orm";
import {
  check,
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  text,
  uniqueIndex,
  uuid,
} from "drizzle-orm/pg-core";
import { aiRun } from "./ai";
import { evidence } from "./evidence";
import { informationItem } from "./items";
import { briefingRun, publication } from "./publications";
import { source, sourceFamily, sourceFetch } from "./sources";
import { createdAt, nonBlank, primaryId, tsCol, updatedAt } from "./_shared";

export const briefingEdition = pgTable(
  "briefing_edition",
  {
    id: primaryId(),
    localDate: text("local_date").notNull().unique(),
    status: text("status").notNull().default("collecting"),
    contractVersion: text("contract_version").notNull(),
    promptVersion: text("prompt_version").notNull(),
    collectionOpenedAt: tsCol("collection_opened_at").notNull(),
    collectionClosedAt: tsCol("collection_closed_at"),
    publishedAt: tsCol("published_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("briefing_edition_by_status_date").on(t.status, t.localDate),
    check("briefing_edition_status_is_known", sql`${t.status} IN ('collecting', 'processing', 'quarantined', 'published', 'failed')`),
    nonBlank(t.contractVersion, "briefing_edition_has_contract_version"),
    nonBlank(t.promptVersion, "briefing_edition_has_prompt_version"),
  ],
);

export const briefingRunAi = pgTable(
  "briefing_run_ai",
  {
    briefingRunId: uuid("briefing_run_id").notNull().references(() => briefingRun.id, { onDelete: "cascade" }),
    aiRunId: uuid("ai_run_id").notNull().references(() => aiRun.id),
    stage: text("stage").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.briefingRunId, t.aiRunId], name: "briefing_run_ai_pk" }),
    index("briefing_run_ai_by_stage").on(t.briefingRunId, t.stage),
    nonBlank(t.stage, "briefing_run_ai_has_stage"),
  ],
);

export const briefingClaim = pgTable(
  "briefing_claim",
  {
    itemId: uuid("item_id").primaryKey().references(() => informationItem.id, { onDelete: "cascade" }),
    layer: text("layer").notNull(),
    machineAssessment: text("machine_assessment").notNull(),
    attributedTo: text("attributed_to"),
    uncertainty: text("uncertainty"),
    aiRunId: uuid("ai_run_id").references(() => aiRun.id),
    createdAt: createdAt(),
  },
  (t) => [
    index("briefing_claim_by_assessment").on(t.machineAssessment, t.createdAt),
    check("briefing_claim_layer_is_known", sql`${t.layer} IN ('source_claim', 'observed_fact', 'model_inference', 'editorial_conclusion')`),
    check("briefing_claim_assessment_is_known", sql`${t.machineAssessment} IN ('verified', 'refuted', 'misleading', 'unsupported', 'disputed', 'unresolved')`),
  ],
);

export const briefingQualityCheck = pgTable(
  "briefing_quality_check",
  {
    id: primaryId(),
    briefingRunId: uuid("briefing_run_id").notNull().references(() => briefingRun.id, { onDelete: "cascade" }),
    candidateKey: text("candidate_key").notNull(),
    checkName: text("check_name").notNull(),
    status: text("status").notNull(),
    detail: text("detail").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("briefing_quality_check_unique").on(t.briefingRunId, t.candidateKey, t.checkName),
    index("briefing_quality_check_failures").on(t.status, t.createdAt),
    check("briefing_quality_check_status_is_known", sql`${t.status} IN ('pass', 'fail')`),
    nonBlank(t.candidateKey, "briefing_quality_check_has_candidate"),
    nonBlank(t.checkName, "briefing_quality_check_has_name"),
    nonBlank(t.detail, "briefing_quality_check_has_detail"),
  ],
);

export const briefingQuarantine = pgTable(
  "briefing_quarantine",
  {
    id: primaryId(),
    briefingRunId: uuid("briefing_run_id").notNull().references(() => briefingRun.id, { onDelete: "cascade" }),
    candidateKey: text("candidate_key").notNull(),
    stage: text("stage").notNull(),
    reason: text("reason").notNull(),
    payload: jsonb("payload"),
    status: text("status").notNull().default("open"),
    resolvedAt: tsCol("resolved_at"),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("briefing_quarantine_open_candidate")
      .on(t.briefingRunId, t.candidateKey)
      .where(sql`${t.status} = 'open'`),
    index("briefing_quarantine_by_status").on(t.status, t.createdAt),
    check("briefing_quarantine_status_is_known", sql`${t.status} IN ('open', 'resolved', 'discarded')`),
    nonBlank(t.stage, "briefing_quarantine_has_stage"),
    nonBlank(t.reason, "briefing_quarantine_has_reason"),
  ],
);

/** Operational alerts are durable and deduplicated. They contain only a
 * compact reason and counters — never source bodies, prompts, or secrets. */
export const briefingAlert = pgTable(
  "briefing_alert",
  {
    id: primaryId(),
    fingerprint: text("fingerprint").notNull().unique(),
    kind: text("kind").notNull(),
    severity: text("severity").notNull(),
    message: text("message").notNull(),
    details: jsonb("details"),
    notifiedAt: tsCol("notified_at"),
    resolvedAt: tsCol("resolved_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("briefing_alert_open").on(t.severity, t.createdAt).where(sql`${t.resolvedAt} IS NULL`),
    check("briefing_alert_severity_is_known", sql`${t.severity} IN ('warning', 'critical')`),
    nonBlank(t.kind, "briefing_alert_has_kind"),
    nonBlank(t.message, "briefing_alert_has_message"),
  ],
);

export const publicationPassage = pgTable(
  "publication_passage",
  {
    id: primaryId(),
    publicationId: uuid("publication_id").notNull().references(() => publication.id, { onDelete: "cascade" }),
    position: integer("position").notNull(),
    text: text("text").notNull(),
    itemId: uuid("item_id").references(() => informationItem.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("publication_passage_position_unique").on(t.publicationId, t.position),
    index("publication_passage_by_item").on(t.itemId),
    check("publication_passage_position_is_positive", sql`${t.position} >= 1`),
    nonBlank(t.text, "publication_passage_has_text"),
  ],
);

export const publicationPassageEvidence = pgTable(
  "publication_passage_evidence",
  {
    passageId: uuid("passage_id").notNull().references(() => publicationPassage.id, { onDelete: "cascade" }),
    evidenceId: uuid("evidence_id").notNull().references(() => evidence.id),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.passageId, t.evidenceId], name: "publication_passage_evidence_pk" }),
    index("publication_passage_evidence_by_evidence").on(t.evidenceId),
  ],
);

/** Every discovered link, including duplicates that do not warrant a second
 * evidence row. This preserves attribution and makes merge decisions auditable. */
export const evidenceDiscovery = pgTable(
  "evidence_discovery",
  {
    id: primaryId(),
    sourceFetchId: uuid("source_fetch_id").notNull().references(() => sourceFetch.id, { onDelete: "cascade" }),
    discoverySourceId: uuid("discovery_source_id").notNull().references(() => source.id),
    evidenceId: uuid("evidence_id").notNull().references(() => evidence.id, { onDelete: "cascade" }),
    externalId: text("external_id"),
    discoveryUrl: text("discovery_url"),
    canonicalUrl: text("canonical_url"),
    publisherDomain: text("publisher_domain"),
    title: text("title").notNull(),
    normalizedContentHash: text("normalized_content_hash"),
    deduplicationMethod: text("deduplication_method").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("evidence_discovery_by_evidence").on(t.evidenceId, t.createdAt),
    index("evidence_discovery_by_fetch").on(t.sourceFetchId),
    index("evidence_discovery_by_hash").on(t.normalizedContentHash),
    check("evidence_discovery_method_is_known", sql`${t.deduplicationMethod} IN ('new', 'external_id', 'canonical_url', 'content_hash')`),
    nonBlank(t.title, "evidence_discovery_has_title"),
  ],
);

export const briefingStoryCluster = pgTable(
  "briefing_story_cluster",
  {
    id: primaryId(),
    editionId: uuid("edition_id").notNull().references(() => briefingEdition.id, { onDelete: "cascade" }),
    storyKey: text("story_key").notNull(),
    title: text("title").notNull(),
    primaryEvidenceId: uuid("primary_evidence_id").notNull().references(() => evidence.id),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("briefing_story_cluster_unique").on(t.editionId, t.storyKey),
    index("briefing_story_cluster_by_edition").on(t.editionId, t.createdAt),
    nonBlank(t.storyKey, "briefing_story_cluster_has_key"),
    nonBlank(t.title, "briefing_story_cluster_has_title"),
  ],
);

export const briefingStoryEvidence = pgTable(
  "briefing_story_evidence",
  {
    clusterId: uuid("cluster_id").notNull().references(() => briefingStoryCluster.id, { onDelete: "cascade" }),
    evidenceId: uuid("evidence_id").notNull().references(() => evidence.id),
    role: text("role").notNull(),
    sourceFamilyId: uuid("source_family_id").notNull().references(() => sourceFamily.id),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.clusterId, t.evidenceId], name: "briefing_story_evidence_pk" }),
    index("briefing_story_evidence_by_evidence").on(t.evidenceId),
    check("briefing_story_evidence_role_is_known", sql`${t.role} IN ('primary', 'independent', 'syndicated')`),
  ],
);

export const briefingJob = pgTable(
  "briefing_job",
  {
    id: primaryId(),
    jobKey: text("job_key").notNull().unique(),
    contractVersion: integer("contract_version").notNull().default(1),
    stage: text("stage").notNull(),
    localDate: text("local_date").notNull(),
    sourceId: uuid("source_id").references(() => source.id, { onDelete: "cascade" }),
    editionId: uuid("edition_id").references(() => briefingEdition.id, { onDelete: "cascade" }),
    state: text("state").notNull().default("pending"),
    attempts: integer("attempts").notNull().default(0),
    maxAttempts: integer("max_attempts").notNull().default(5),
    availableAt: tsCol("available_at").notNull().defaultNow(),
    leaseUntil: tsCol("lease_until"),
    heartbeatAt: tsCol("heartbeat_at"),
    checkpoint: jsonb("checkpoint"),
    lastError: text("last_error"),
    startedAt: tsCol("started_at"),
    finishedAt: tsCol("finished_at"),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("briefing_job_ready").on(t.state, t.availableAt),
    index("briefing_job_by_stage_date").on(t.stage, t.localDate, t.state),
    index("briefing_job_stale_lease").on(t.leaseUntil).where(sql`${t.state} = 'running'`),
    check("briefing_job_stage_is_known", sql`${t.stage} IN ('collect', 'enrich', 'cluster', 'triage', 'draft', 'quality', 'publish')`),
    check("briefing_job_state_is_known", sql`${t.state} IN ('pending', 'running', 'completed', 'quarantined')`),
    check("briefing_job_attempts_are_valid", sql`${t.attempts} >= 0 AND ${t.maxAttempts} BETWEEN 1 AND 20`),
    nonBlank(t.jobKey, "briefing_job_has_key"),
  ],
);

export const briefingJobDelivery = pgTable(
  "briefing_job_delivery",
  {
    messageId: text("message_id").primaryKey(),
    jobId: uuid("job_id").notNull().references(() => briefingJob.id, { onDelete: "cascade" }),
    deliveryCount: integer("delivery_count").notNull(),
    status: text("status").notNull(),
    receivedAt: createdAt(),
    finishedAt: tsCol("finished_at"),
  },
  (t) => [
    index("briefing_job_delivery_by_job").on(t.jobId, t.receivedAt),
    check("briefing_job_delivery_status_is_known", sql`${t.status} IN ('received', 'completed', 'failed', 'duplicate', 'quarantined', 'deferred')`),
    check("briefing_job_delivery_count_positive", sql`${t.deliveryCount} >= 1`),
  ],
);

export const briefingStageArtifact = pgTable(
  "briefing_stage_artifact",
  {
    id: primaryId(),
    editionId: uuid("edition_id").notNull().references(() => briefingEdition.id, { onDelete: "cascade" }),
    stage: text("stage").notNull(),
    artifactVersion: integer("artifact_version").notNull().default(1),
    inputHash: text("input_hash").notNull(),
    payload: jsonb("payload").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    uniqueIndex("briefing_stage_artifact_unique").on(t.editionId, t.stage, t.artifactVersion),
    index("briefing_stage_artifact_by_edition").on(t.editionId, t.createdAt),
    check("briefing_stage_artifact_stage_is_known", sql`${t.stage} IN ('enrich', 'cluster', 'triage', 'draft', 'quality')`),
    check("briefing_stage_artifact_version_positive", sql`${t.artifactVersion} >= 1`),
    nonBlank(t.inputHash, "briefing_stage_artifact_has_input_hash"),
  ],
);

export const briefingControl = pgTable(
  "briefing_control",
  {
    id: text("id").primaryKey().default("global"),
    automaticPublicationPaused: boolean("automatic_publication_paused").notNull().default(true),
    updatedBy: text("updated_by"),
    updatedAt: updatedAt(),
  },
  (t) => [
    check("briefing_control_singleton", sql`${t.id} = 'global'`),
  ],
);

export type BriefingQualityCheck = typeof briefingQualityCheck.$inferSelect;
export type BriefingQuarantineEntry = typeof briefingQuarantine.$inferSelect;
export type PublicationPassage = typeof publicationPassage.$inferSelect;
