import "server-only";

/**
 * Evidence links, assessments, and the review queue. Owns policy; owns no SQL.
 *
 * `itemAssessmentService.create` supersedes the previous current assessment
 * (if any) *before* inserting the new row, and does so by generating the new
 * row's id up front. `item_assessment_one_current_per_item` is a plain unique
 * index, not a deferrable constraint, so it is checked after every statement —
 * inserting the new row while the old one is still "current" would violate it
 * for the instant between the two writes. Pointing the old row at a
 * not-yet-inserted id closes that window instead of racing it.
 *
 * Every route here needs a real reviewer identity (`actor.userId`), not just a
 * label — confirming evidence and approving an assessment are exactly the
 * acts `assertHumanReviewer()` exists to gate, and it needs to know whether
 * that identity is automated. `requireActor()`'s development shim never sets
 * one, so these paths are built and tested now; Production reaches them through
 * the Neon Auth session boundary and the same capability checks.
 */

import { ApiError, notFound } from "@/server/http/responses";
import { setIdentity } from "@/server/core/versioning";
import { writeAudit } from "@/server/core/audit";
import { emit, TOPICS } from "@/server/core/outbox";
import { findReviewer, itemAssessmentRepo, itemEvidenceRepo, reviewQueueRepo } from "./repo";
import { assertHumanReviewer, assessEligibility, canAssignVerdict, requiredReviewLevel, summarizeConfidence } from "./rules";
import type {
  CompleteReview,
  CreateAssessment,
  EnqueueReview,
  LinkEvidence,
  ListReviewQueue,
} from "@/server/contracts/assessment";
import type { Actor } from "@/server/core/audit";
import type { ItemAssessment, ItemEvidence, ReviewQueueEntry } from "@/server/db/schema";
import type { ConfidenceDimension, ConfidenceLevel } from "@/server/contracts/enums";

type Tx = Parameters<typeof setIdentity>[0];
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };

const requireReviewerId = (actor: Actor, verb: string): string => {
  if (!actor.userId) {
    throw new ApiError("FORBIDDEN", `${verb} requires a known reviewer identity, not just a label.`);
  }
  return actor.userId;
};

const dimensionsOf = (input: CreateAssessment["confidence"]): Record<ConfidenceDimension, ConfidenceLevel> => ({
  evidence_coverage: input.evidenceCoverage,
  source_independence: input.sourceIndependence,
  source_authority: input.sourceAuthority,
  media_provenance: input.mediaProvenance,
  temporal_consistency: input.temporalConsistency,
  geographic_consistency: input.geographicConsistency,
  contradiction_level: input.contradictionLevel,
  translation_certainty: input.translationCertainty,
  human_review_state: input.humanReviewState,
  remaining_gaps: input.remainingGaps,
});

export function itemEvidenceService(db: unknown) {
  const run = db as unknown as Runner;

  return {
    list: (itemId: string): Promise<ItemEvidence[]> => itemEvidenceRepo(db).list(itemId),

    async link(itemId: string, input: LinkEvidence, actor: Actor, requestId?: string): Promise<ItemEvidence> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const row = await itemEvidenceRepo(tx).insert({
          itemId,
          evidenceId: input.evidenceId,
          relation: input.relation,
          strength: input.strength,
          rationale: input.rationale,
          addedBy: actor.userId ?? null,
        });
        await writeAudit(tx as never, {
          actor,
          action: "item_evidence.linked",
          entityType: "information_item",
          entityId: itemId,
          after: row,
          requestId,
        });
        return row;
      });
    },

    async confirm(itemId: string, evidenceId: string, actor: Actor, requestId?: string): Promise<ItemEvidence> {
      const reviewerId = requireReviewerId(actor, "Confirming evidence");
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const reviewer = await findReviewer(tx, reviewerId);
        if (!reviewer) throw new ApiError("VALIDATION_ERROR", "Unknown reviewer identity.");
        assertHumanReviewer(reviewer, undefined);

        const row = await itemEvidenceRepo(tx).confirm(itemId, evidenceId, reviewerId);
        await writeAudit(tx as never, {
          actor,
          action: "item_evidence.confirmed",
          entityType: "information_item",
          entityId: itemId,
          after: row,
          requestId,
        });
        return row;
      });
    },

    async eligibility(itemId: string) {
      const tally = await itemEvidenceRepo(db).tally(itemId);
      return { tally, eligibility: assessEligibility(tally) };
    },
  };
}

export function itemAssessmentService(db: unknown) {
  const run = db as unknown as Runner;

  return {
    async get(id: string): Promise<ItemAssessment> {
      const row = await itemAssessmentRepo(db).byId(id);
      if (!row) throw notFound("Assessment");
      return row;
    },

    current: (itemId: string): Promise<ItemAssessment | undefined> => itemAssessmentRepo(db).current(itemId),
    history: (itemId: string): Promise<ItemAssessment[]> => itemAssessmentRepo(db).history(itemId),

    async create(itemId: string, input: CreateAssessment, actor: Actor, requestId?: string): Promise<ItemAssessment> {
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);

        const tally = await itemEvidenceRepo(tx).tally(itemId);
        const check = canAssignVerdict(input.value, tally);
        if (!check.eligible) {
          throw new ApiError(
            "PRECONDITION_FAILED",
            `"${input.value}" is not eligible yet: ${check.reasons.join(" ")}`,
          );
        }

        const dimensions = dimensionsOf(input.confidence);
        const reviewLevel = requiredReviewLevel(input.value);
        const eligibility = assessEligibility(tally);

        /* Generated up front so the previous current assessment can be
         * superseded before this row exists — see the module docstring. */
        const newId = crypto.randomUUID();
        const previous = await itemAssessmentRepo(tx).current(itemId);
        if (previous) {
          await itemAssessmentRepo(tx).supersede(previous.id, newId);
        }

        const row = await itemAssessmentRepo(tx).insert({
          id: newId,
          itemId,
          value: input.value,
          summary: input.summary,
          knownGaps: input.knownGaps,
          falseImpression: input.falseImpression ?? null,
          confidenceEvidenceCoverage: dimensions.evidence_coverage,
          confidenceSourceIndependence: dimensions.source_independence,
          confidenceSourceAuthority: dimensions.source_authority,
          confidenceMediaProvenance: dimensions.media_provenance,
          confidenceTemporalConsistency: dimensions.temporal_consistency,
          confidenceGeographicConsistency: dimensions.geographic_consistency,
          confidenceContradictionLevel: dimensions.contradiction_level,
          confidenceTranslationCertainty: dimensions.translation_certainty,
          confidenceHumanReviewState: dimensions.human_review_state,
          confidenceRemainingGaps: dimensions.remaining_gaps,
          confidenceSummary: summarizeConfidence(dimensions),
          reviewLevel,
          eligibility,
          createdBy: actor.userId ?? null,
        });

        await reviewQueueRepo(tx).insert({
          itemId,
          kind: "assessment_approval",
          priority: reviewLevel === 2 ? 10 : 0,
          note: `Assessment ${row.id} awaiting a second human reviewer.`,
        });

        await writeAudit(tx as never, {
          actor,
          action: "item_assessment.created",
          entityType: "item_assessment",
          entityId: row.id,
          after: row,
          requestId,
        });

        await emit(tx as never, TOPICS.searchReindex, { entityType: "information_item", id: itemId }, {
          entityType: "information_item",
          entityId: itemId,
        });

        return row;
      });
    },

    async approve(assessmentId: string, actor: Actor, requestId?: string): Promise<ItemAssessment> {
      const reviewerId = requireReviewerId(actor, "Approving an assessment");
      return run.transaction(async (tx) => {
        await setIdentity(tx as Tx, actor.label);
        const assessment = await itemAssessmentRepo(tx).byId(assessmentId);
        if (!assessment) throw notFound("Assessment");

        const reviewer = await findReviewer(tx, reviewerId);
        if (!reviewer) throw new ApiError("VALIDATION_ERROR", "Unknown reviewer identity.");
        assertHumanReviewer(reviewer, assessment.createdBy);

        const updated = await itemAssessmentRepo(tx).approve(assessmentId, reviewerId);
        await writeAudit(tx as never, {
          actor,
          action: "item_assessment.approved",
          entityType: "item_assessment",
          entityId: assessmentId,
          after: updated,
          requestId,
        });
        return updated;
      });
    },
  };
}

export function reviewQueueService(db: unknown) {
  const repo = reviewQueueRepo(db);

  return {
    list: (filters: ListReviewQueue): Promise<ReviewQueueEntry[]> => repo.list(filters),

    enqueue: (input: EnqueueReview): Promise<ReviewQueueEntry> =>
      repo.insert({
        itemId: input.itemId,
        kind: input.kind,
        priority: input.priority,
        note: input.note ?? null,
      }),

    async claim(id: string, actor: Actor): Promise<ReviewQueueEntry> {
      const reviewerId = requireReviewerId(actor, "Claiming a review");
      const row = await repo.byId(id);
      if (!row) throw notFound("Review queue entry");
      return repo.claim(id, reviewerId);
    },

    async complete(id: string, input: CompleteReview, actor: Actor): Promise<ReviewQueueEntry> {
      const reviewerId = requireReviewerId(actor, "Completing a review");
      const row = await repo.byId(id);
      if (!row) throw notFound("Review queue entry");
      return repo.complete(id, input.state, reviewerId, input.note ?? null);
    },
  };
}

export type ItemEvidenceService = ReturnType<typeof itemEvidenceService>;
export type ItemAssessmentService = ReturnType<typeof itemAssessmentService>;
export type ReviewQueueService = ReturnType<typeof reviewQueueService>;
