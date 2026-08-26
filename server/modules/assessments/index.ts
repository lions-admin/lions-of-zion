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

/** Fresh bindings preserve the request-scoped database role from AsyncLocalStorage. */
export const itemEvidenceLinks = (): ItemEvidenceService => itemEvidenceService(db());
export const itemAssessments = (): ItemAssessmentService => itemAssessmentService(db());
export const reviewQueue = (): ReviewQueueService => reviewQueueService(db());

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
