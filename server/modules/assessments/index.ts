import "server-only";

import { db } from "@/server/db/client";
import {
  itemAssessmentService,
  itemEvidenceService,
  reviewQueueService,
  type ItemAssessmentService,
  type ItemEvidenceService,
  type ReviewQueueService,
} from "./service";

let boundEvidence: ItemEvidenceService | undefined;
let boundAssessments: ItemAssessmentService | undefined;
let boundQueue: ReviewQueueService | undefined;

/** Lazily bound, so importing this module does not demand a DATABASE_URL. */
export const itemEvidenceLinks = (): ItemEvidenceService => (boundEvidence ??= itemEvidenceService(db()));
export const itemAssessments = (): ItemAssessmentService => (boundAssessments ??= itemAssessmentService(db()));
export const reviewQueue = (): ReviewQueueService => (boundQueue ??= reviewQueueService(db()));

export {
  itemEvidenceService,
  itemAssessmentService,
  reviewQueueService,
  type ItemEvidenceService,
  type ItemAssessmentService,
  type ReviewQueueService,
} from "./service";
export { canAssignVerdict, assessEligibility, requiredReviewLevel, assertHumanReviewer, summarizeConfidence } from "./rules";
export type { Eligibility, EvidenceTally } from "./rules";
export { findReviewer, type Reviewer } from "./repo";
