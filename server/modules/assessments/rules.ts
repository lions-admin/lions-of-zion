/**
 * Verdict eligibility, review level, and reviewer legality — pure and DB-free
 * on purpose, ported in spirit from `lionshomeMAIN`'s `canAssignVerdict()`,
 * `requiredReviewLevel()` and `assertHumanReviewer()`.
 *
 * The aggregation (which source families confirmed what) lives in the
 * repository; this module only reasons about the tally it is handed, which
 * is what makes it testable with no database at all. Every verdict gets an
 * eligible/ineligible answer AND a human-readable reason — "check constraint
 * violated" is not what an analyst needs to hear, and `eligibility` is stored
 * verbatim on the assessment specifically so that reason survives.
 *
 * Thresholds here are a first, principled cut, not settled policy — they will
 * change. What must not drift is the shape.
 */

import { ApiError } from "@/server/http/responses";
import { ASSESSMENT_VALUES } from "@/server/contracts/enums";
import type {
  AssessmentValue,
  ConfidenceDimension,
  ConfidenceLevel,
  ConfidenceSummary,
} from "@/server/contracts/enums";

export type EvidenceTally = {
  /** Distinct source families among confirmed edges of adequate-or-better
   *  strength whose relation is `supports` or `partially_supports`. */
  supportingFamilies: number;
  /** Same, for `contradicts`. */
  contradictingFamilies: number;
  /** Every confirmed edge, any relation or strength — the floor for a
   *  verdict that claims someone actually looked at something. */
  confirmedTotal: number;
};

export type Eligibility = { eligible: boolean; reasons: string[] };

export function canAssignVerdict(value: AssessmentValue, tally: EvidenceTally): Eligibility {
  switch (value) {
    case "verified": {
      const ok = tally.supportingFamilies >= 2 && tally.contradictingFamilies === 0;
      return {
        eligible: ok,
        reasons: ok
          ? ["Two or more independent source families of adequate or better strength support this, and none confirmed contradicts it."]
          : [
              tally.supportingFamilies < 2
                ? `Needs two independent source families of adequate or better strength; has ${tally.supportingFamilies}.`
                : undefined,
              tally.contradictingFamilies > 0
                ? `${tally.contradictingFamilies} confirmed contradicting source family/families remain unresolved.`
                : undefined,
            ].filter((r): r is string => r !== undefined),
      };
    }
    case "false": {
      const ok = tally.contradictingFamilies >= 2 && tally.supportingFamilies === 0;
      return {
        eligible: ok,
        reasons: ok
          ? ["Two or more independent source families of adequate or better strength contradict this, and none confirmed supports it."]
          : [
              tally.contradictingFamilies < 2
                ? `Needs two independent source families of adequate or better strength contradicting it; has ${tally.contradictingFamilies}.`
                : undefined,
              tally.supportingFamilies > 0
                ? `${tally.supportingFamilies} confirmed supporting source family/families remain unresolved.`
                : undefined,
            ].filter((r): r is string => r !== undefined),
      };
    }
    case "contested": {
      const ok = tally.supportingFamilies >= 1 && tally.contradictingFamilies >= 1;
      return {
        eligible: ok,
        reasons: ok
          ? ["Confirmed evidence supports and confirmed evidence contradicts — a genuine, evidenced disagreement."]
          : ["Needs at least one confirmed source family on each side; contested is not a default for uncertainty."],
      };
    }
    case "manipulated":
    case "misleading":
    case "out_of_context": {
      const ok = tally.confirmedTotal >= 1;
      return {
        eligible: ok,
        reasons: ok
          ? ["At least one confirmed piece of evidence documents this."]
          : ["Needs at least one confirmed piece of evidence — this verdict cannot rest on an unconfirmed edge."],
      };
    }
    case "unsupported": {
      const ok = tally.confirmedTotal === 0;
      return {
        eligible: ok,
        reasons: ok
          ? ["No confirmed evidence either way. Use this when a search was made and found nothing — use unverified if nobody has looked yet."]
          : ["Confirmed evidence exists; this item has been looked at, so unsupported no longer fits."],
      };
    }
    case "unverified":
      return { eligible: true, reasons: ["Always available: the default position before or during review."] };
    case "satire":
      return { eligible: true, reasons: ["An editorial judgment about the item's own form and intent, not an evidence tally."] };
  }
}

/** Every verdict's eligibility at once — what the transparency endpoint and
 *  the frozen `eligibility` column both want. */
export function assessEligibility(tally: EvidenceTally): Record<AssessmentValue, Eligibility> {
  return Object.fromEntries(ASSESSMENT_VALUES.map((v) => [v, canAssignVerdict(v, tally)])) as Record<
    AssessmentValue,
    Eligibility
  >;
}

/** The floor `manipulated_requires_elevated_review` also enforces in SQL —
 *  duplicated deliberately, same as the status-transition table. */
export function requiredReviewLevel(value: AssessmentValue): 1 | 2 {
  return value === "manipulated" ? 2 : 1;
}

const LEVEL_RANK: Record<ConfidenceLevel, number | null> = {
  high: 3,
  medium: 2,
  limited: 1,
  not_applicable: null,
};

/** Rolls the ten dimensions into the summary an item's derived column
 *  actually carries. `not_applicable` dimensions are excluded rather than
 *  penalised — a dimension that does not apply here should not drag the
 *  summary down. No applicable dimensions at all is `limited`, never `high`. */
export function summarizeConfidence(
  dimensions: Record<ConfidenceDimension, ConfidenceLevel>,
): ConfidenceSummary {
  const ranks = Object.values(dimensions)
    .map((level) => LEVEL_RANK[level])
    .filter((r): r is number => r !== null);
  if (ranks.length === 0) return "limited";
  const average = ranks.reduce((a, b) => a + b, 0) / ranks.length;
  if (average >= 2.5) return "high";
  if (average >= 1.5) return "medium";
  return "limited";
}

/** The same rule the publish gate and the assessment-immutability trigger
 *  enforce in SQL, checked here first so the API can explain the refusal. */
export function assertHumanReviewer(
  reviewer: { id: string; isAutomated: boolean },
  authorId: string | null | undefined,
): void {
  if (reviewer.isAutomated) {
    throw new ApiError("FORBIDDEN", "An automated identity may not review or approve this.");
  }
  if (authorId && reviewer.id === authorId) {
    throw new ApiError("FORBIDDEN", "The author cannot also be the reviewer.");
  }
}
