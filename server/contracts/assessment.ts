/**
 * Evidence links, assessments and the review queue — request and response
 * shapes. Zod only.
 */

import { z } from "zod";
import {
  assessmentValueSchema,
  confidenceLevelSchema,
  evidenceRelationSchema,
  evidenceStrengthSchema,
  queueStateSchema,
} from "./enums";
import { uuidSchema } from "./item";

export const linkEvidenceSchema = z.object({
  evidenceId: uuidSchema,
  relation: evidenceRelationSchema,
  strength: evidenceStrengthSchema,
  rationale: z.string().trim().min(1).max(4_000),
});
export type LinkEvidence = z.infer<typeof linkEvidenceSchema>;

export const confidenceDimensionsSchema = z.object({
  evidenceCoverage: confidenceLevelSchema,
  sourceIndependence: confidenceLevelSchema,
  sourceAuthority: confidenceLevelSchema,
  mediaProvenance: confidenceLevelSchema,
  temporalConsistency: confidenceLevelSchema,
  geographicConsistency: confidenceLevelSchema,
  contradictionLevel: confidenceLevelSchema,
  translationCertainty: confidenceLevelSchema,
  humanReviewState: confidenceLevelSchema,
  remainingGaps: confidenceLevelSchema,
});
export type ConfidenceDimensions = z.infer<typeof confidenceDimensionsSchema>;

export const createAssessmentSchema = z.object({
  value: assessmentValueSchema,
  summary: z.string().trim().min(1).max(10_000),
  knownGaps: z.string().trim().min(1).max(4_000),
  /** Required for `misleading` — the service checks this, and the database
   *  refuses it regardless. */
  falseImpression: z.string().trim().max(2_000).optional(),
  confidence: confidenceDimensionsSchema,
});
export type CreateAssessment = z.infer<typeof createAssessmentSchema>;

export const enqueueReviewSchema = z.object({
  itemId: uuidSchema,
  kind: z.string().trim().min(1).max(100),
  priority: z.coerce.number().int().min(0).max(100).default(0),
  note: z.string().trim().max(2_000).optional(),
});
export type EnqueueReview = z.infer<typeof enqueueReviewSchema>;

export const listReviewQueueSchema = z.object({
  state: queueStateSchema.optional(),
  kind: z.string().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListReviewQueue = z.infer<typeof listReviewQueueSchema>;

export const completeReviewSchema = z.object({
  state: z.enum(["done", "dropped"]),
  note: z.string().trim().max(2_000).optional(),
});
export type CompleteReview = z.infer<typeof completeReviewSchema>;
