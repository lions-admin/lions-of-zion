import { describe, expect, it } from "vitest";
import {
  assertHumanReviewer,
  canAssignVerdict,
  requiredReviewLevel,
  summarizeConfidence,
} from "@/server/modules/assessments/rules";
import { ASSESSMENT_VALUES } from "@/server/contracts/enums";
import type { EvidenceTally } from "@/server/modules/assessments/rules";

const tally = (overrides: Partial<EvidenceTally> = {}): EvidenceTally => ({
  supportingFamilies: 0,
  contradictingFamilies: 0,
  confirmedTotal: 0,
  ...overrides,
});

describe("canAssignVerdict", () => {
  it("every verdict answers eligible with at least one reason", () => {
    for (const value of ASSESSMENT_VALUES) {
      const result = canAssignVerdict(value, tally());
      expect(typeof result.eligible).toBe("boolean");
      expect(result.reasons.length).toBeGreaterThan(0);
    }
  });

  it("verified needs two independent supporting families and no contradiction", () => {
    expect(canAssignVerdict("verified", tally({ supportingFamilies: 1 })).eligible).toBe(false);
    expect(canAssignVerdict("verified", tally({ supportingFamilies: 2 })).eligible).toBe(true);
    expect(
      canAssignVerdict("verified", tally({ supportingFamilies: 2, contradictingFamilies: 1 })).eligible,
    ).toBe(false);
  });

  it("false is the mirror of verified", () => {
    expect(canAssignVerdict("false", tally({ contradictingFamilies: 1 })).eligible).toBe(false);
    expect(canAssignVerdict("false", tally({ contradictingFamilies: 2 })).eligible).toBe(true);
    expect(
      canAssignVerdict("false", tally({ contradictingFamilies: 2, supportingFamilies: 1 })).eligible,
    ).toBe(false);
  });

  it("contested needs confirmed evidence on both sides", () => {
    expect(canAssignVerdict("contested", tally({ supportingFamilies: 1 })).eligible).toBe(false);
    expect(
      canAssignVerdict("contested", tally({ supportingFamilies: 1, contradictingFamilies: 1 })).eligible,
    ).toBe(true);
  });

  it("manipulated, misleading and out_of_context need at least one confirmed edge", () => {
    for (const value of ["manipulated", "misleading", "out_of_context"] as const) {
      expect(canAssignVerdict(value, tally()).eligible).toBe(false);
      expect(canAssignVerdict(value, tally({ confirmedTotal: 1 })).eligible).toBe(true);
    }
  });

  it("unsupported requires nothing confirmed at all; unverified and satire are always open", () => {
    expect(canAssignVerdict("unsupported", tally()).eligible).toBe(true);
    expect(canAssignVerdict("unsupported", tally({ confirmedTotal: 1 })).eligible).toBe(false);
    expect(canAssignVerdict("unverified", tally({ confirmedTotal: 5 })).eligible).toBe(true);
    expect(canAssignVerdict("satire", tally()).eligible).toBe(true);
  });
});

describe("requiredReviewLevel", () => {
  it("elevates only manipulated, matching the DB CHECK", () => {
    for (const value of ASSESSMENT_VALUES) {
      expect(requiredReviewLevel(value)).toBe(value === "manipulated" ? 2 : 1);
    }
  });
});

describe("summarizeConfidence", () => {
  const dims = (level: "high" | "medium" | "limited" | "not_applicable") => ({
    evidence_coverage: level,
    source_independence: level,
    source_authority: level,
    media_provenance: level,
    temporal_consistency: level,
    geographic_consistency: level,
    contradiction_level: level,
    translation_certainty: level,
    human_review_state: level,
    remaining_gaps: level,
  } as const);

  it("all high is high; all limited is limited", () => {
    expect(summarizeConfidence(dims("high"))).toBe("high");
    expect(summarizeConfidence(dims("limited"))).toBe("limited");
  });

  it("all not_applicable defaults to limited rather than high", () => {
    expect(summarizeConfidence(dims("not_applicable"))).toBe("limited");
  });

  it("excludes not_applicable dimensions rather than penalising them", () => {
    const mixed = { ...dims("high"), remaining_gaps: "not_applicable" as const };
    expect(summarizeConfidence(mixed)).toBe("high");
  });
});

describe("assertHumanReviewer", () => {
  it("refuses an automated reviewer", () => {
    expect(() => assertHumanReviewer({ id: "u1", isAutomated: true }, "u2")).toThrow(/automated/);
  });

  it("refuses the author reviewing their own work", () => {
    expect(() => assertHumanReviewer({ id: "u1", isAutomated: false }, "u1")).toThrow(/cannot also be the reviewer/);
  });

  it("allows a human reviewer who is not the author", () => {
    expect(() => assertHumanReviewer({ id: "u1", isAutomated: false }, "u2")).not.toThrow();
  });

  it("allows a human reviewer when there is no known author", () => {
    expect(() => assertHumanReviewer({ id: "u1", isAutomated: false }, null)).not.toThrow();
  });
});
