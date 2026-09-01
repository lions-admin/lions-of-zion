import { describe, expect, it } from "vitest";
import { z } from "zod";
import { articleSchema } from "@/server/modules/briefing/service";
import { ANALYSIS_AUTHOR } from "@/server/contracts/publication";

/**
 * The drafted-article contract, at the seam where an unsourced refutation is
 * either admitted or refused.
 *
 * The evidence floors used to live on `claimSchema.evidenceLinks.min(1)` and
 * `passageSchema.evidenceIds.min(1)`, where a `superRefine` could never reach
 * them — a refinement runs after the shape parse, so it can add a rule but not
 * lift one. The floors were therefore moved off the shape and re-imposed
 * conditionally, which means these tests are now the only thing holding them
 * in place for sourced articles.
 */

const EVIDENCE_ID = "11111111-1111-4111-8111-111111111111";

const sourcedClaim = {
  title: "Official regional assessment",
  text: "The security cabinet published a regional assessment.",
  layer: "source_claim" as const,
  assessment: "unresolved" as const,
  attributedTo: "Government Office",
  uncertainty: "Independent reporting was not yet present.",
  evidenceLinks: [{
    evidenceId: EVIDENCE_ID,
    relation: "supports" as const,
    strength: "adequate" as const,
    rationale: "The official statement directly makes this claim.",
  }],
};

const analysisClaim = {
  title: "Intent is asserted rather than shown",
  text: "The accusation infers deliberate targeting from the outcome alone.",
  layer: "editorial_conclusion" as const,
  assessment: "refuted" as const,
  attributedTo: ANALYSIS_AUTHOR,
  uncertainty: "This addresses the structure of the accusation, not any commander's knowledge.",
  evidenceLinks: [] as typeof sourcedClaim.evidenceLinks,
};

const passageText = [
  "The accusation moves from a terrible outcome to an assumed purpose without supplying the step between them.",
  "The context the framing removes is a convoy moving through an active combat corridor.",
];

const sourcedArticle = {
  section: "israel_update" as const,
  title: "Security cabinet publishes a new regional assessment",
  summary: "The statement sets out the latest official position.",
  evidenceIds: [EVIDENCE_ID],
  claims: [sourcedClaim],
  passages: passageText.map((text) => ({ text, claimIndex: 0, evidenceIds: [EVIDENCE_ID] })),
  narrativeTitle: null,
  editorialTopic: "security policy",
  primaryActor: null,
  arena: "domestic",
  featuredIsraelStory: false,
  narrativeWatchDetails: null,
};

const narrativeWatchDetails = {
  exactClaim: "Israel deliberately targeted a humanitarian convoy and blocked every investigation.",
  propagators: [],
  arenas: ["international media"],
  trendDirection: "rising" as const,
  israeliPosition: null,
  securityContext: null,
  supportingEvidenceIds: [] as string[],
  contradictingEvidenceIds: [] as string[],
  verificationState: "refuted" as const,
  knownUnknowns: [],
};

const analysisArticle = {
  ...sourcedArticle,
  section: "narrative_watch" as const,
  title: "The convoy accusation asserts intent it never demonstrates",
  summary: "The circulating accusation infers deliberate targeting from an outcome alone.",
  evidenceIds: [] as string[],
  claims: [analysisClaim],
  passages: passageText.map((text) => ({ text, claimIndex: 0, evidenceIds: [] as string[] })),
  narrativeWatchDetails,
};

describe("drafted article contract", () => {
  it("accepts an ordinary sourced article", () => {
    expect(articleSchema.safeParse(sourcedArticle).success).toBe(true);
  });

  it("accepts a Narrative Watch refutation that cites nothing anywhere", () => {
    expect(articleSchema.safeParse(analysisArticle).success).toBe(true);
  });

  it("refuses an article that cites nothing outside Narrative Watch", () => {
    const result = articleSchema.safeParse({ ...analysisArticle, section: "israel_update", narrativeWatchDetails: null });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("Only a narrative_watch refutation may cite no evidence");
  });

  /* The laundering case, and the most important assertion in this file. An
   * article that cites nothing at the top is treated as the organisation's own
   * analysis, which switches off seven evidence checks. If its claims may
   * still point at sources, sourced material can be republished through the
   * lenient path with no citation trail attached to it. All or nothing. */
  it("refuses a half-sourced article whose claims still cite evidence", () => {
    const result = articleSchema.safeParse({
      ...analysisArticle,
      claims: [{ ...analysisClaim, evidenceLinks: sourcedClaim.evidenceLinks }],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("must cite nothing anywhere");
  });

  it("refuses a half-sourced article whose passages still cite evidence", () => {
    const result = articleSchema.safeParse({
      ...analysisArticle,
      passages: passageText.map((text) => ({ text, claimIndex: 0, evidenceIds: [EVIDENCE_ID] })),
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("must cite nothing anywhere");
  });

  it("refuses a half-sourced article whose monitoring details still cite evidence", () => {
    const result = articleSchema.safeParse({
      ...analysisArticle,
      narrativeWatchDetails: { ...narrativeWatchDetails, supportingEvidenceIds: [EVIDENCE_ID] },
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("must cite nothing anywhere");
  });

  it("still requires an evidence edge on every claim of a sourced article", () => {
    const result = articleSchema.safeParse({
      ...sourcedArticle,
      claims: [{ ...sourcedClaim, evidenceLinks: [] }],
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("needs at least one explained evidence edge");
  });

  it("still requires every paragraph of a sourced article to cite its evidence", () => {
    const result = articleSchema.safeParse({
      ...sourcedArticle,
      passages: passageText.map((text) => ({ text, claimIndex: 0, evidenceIds: [] })),
    });
    expect(result.success).toBe(false);
    expect(JSON.stringify(result.error?.issues)).toContain("must cite the evidence supporting it");
  });

  it("keeps the one exception visible to the model, which never sees the refinements", () => {
    /* `gateway.ts` sends `z.toJSONSchema(schema)` to the model, and refinements
     * do not survive that conversion. Dropping `minItems` from `evidenceIds`
     * therefore removed the only model-facing signal that a source is normally
     * required; the description is what puts it back, and unlike the refine it
     * is emitted. */
    const emitted = z.toJSONSchema(articleSchema) as {
      properties: Record<string, { minItems?: number; description?: string }>;
    };
    const evidenceIds = emitted.properties.evidenceIds!;
    expect(evidenceIds.minItems).toBeUndefined();
    expect(evidenceIds.description).toContain("The single exception is a narrative_watch refutation");
    // The derived basis is stamped on after parsing and is never offered to
    // the model, which would otherwise be able to set it.
    expect(JSON.stringify(emitted)).not.toContain("evidenceBasis");
  });
});
