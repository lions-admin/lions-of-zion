import { describe, expect, it } from "vitest";
import { evaluateCandidate, type QualityCandidate, type QualityEvidence } from "@/server/modules/briefing/quality";

const evidence: QualityEvidence[] = [
  {
    id: "11111111-1111-4111-8111-111111111111",
    title: "Security cabinet publishes a detailed regional assessment",
    excerpt: "The official statement says the security cabinet met on Sunday and issued a detailed regional assessment.",
    canonicalUrl: "https://gov.example.il/security/update",
    publisher: "Government Office",
    publisherDomain: "gov.example.il",
    sourceFamilyId: "family-official",
    sourceCategory: "official_israeli",
    usableTextLength: 100,
    retrievalStatus: "fetched",
    accessState: "open",
  },
];

const candidate: QualityCandidate = {
  key: "article-1",
  section: "israel_update",
  title: "Security cabinet publishes a new regional assessment",
  summary: "The statement sets out the latest official position.",
  body: "The security cabinet published a new regional assessment after its Sunday meeting.\n\nThe statement is an official account; independent reporting was not yet included in the collection packet.\n\nThe article therefore attributes the development to the issuing office and preserves the current evidentiary limitation.",
  evidenceIds: [evidence[0]!.id],
  claims: [{
    title: "Official regional assessment",
    text: "The security cabinet published a regional assessment.",
    layer: "source_claim",
    assessment: "unresolved",
    attributedTo: "Government Office",
    uncertainty: "Independent reporting was not yet present.",
    evidenceLinks: [{
      evidenceId: evidence[0]!.id,
      relation: "supports",
      strength: "adequate",
      rationale: "The official statement directly makes this claim.",
    }],
  }],
  passages: [
    { text: "The security cabinet published a new regional assessment after its Sunday meeting.", claimIndex: 0, evidenceIds: [evidence[0]!.id] },
    { text: "The statement is an official account; independent reporting was not yet included in the collection packet.", claimIndex: 0, evidenceIds: [evidence[0]!.id] },
    { text: "The article therefore attributes the development to the issuing office and preserves the current evidentiary limitation.", claimIndex: 0, evidenceIds: [evidence[0]!.id] },
  ],
};

describe("briefing quality gate", () => {
  it("allows a narrowly attributed primary official report", () => {
    const result = evaluateCandidate(candidate, new Map(evidence.map((row) => [row.id, row])));
    expect(result.passed).toBe(true);
    expect(result.checks.every((check) => check.status === "pass")).toBe(true);
  });

  it("rejects a generic, untraceable draft", () => {
    const result = evaluateCandidate({
      ...candidate,
      title: "Latest news",
      claims: [],
      passages: [],
      body: "A short unsupported update.",
    }, new Map(evidence.map((row) => [row.id, row])));
    expect(result.passed).toBe(false);
    expect(result.checks.filter((check) => check.status === "fail").map((check) => check.name)).toEqual(
      expect.arrayContaining(["specific_title", "substantive_body", "claim_evidence_matrix", "paragraph_traceability"]),
    );
  });

  it("rejects exact numbers absent from the evidence packet", () => {
    const result = evaluateCandidate({
      ...candidate,
      body: candidate.body + " The report confirmed 37 missiles.",
    }, new Map(evidence.map((row) => [row.id, row])));
    expect(result.checks.find((check) => check.name === "exact_fact_fidelity")?.status).toBe("fail");
    expect(result.passed).toBe(false);
  });

  it("allows a clearly attributed single-source report with uncertainty", () => {
    const singleSource = {
      ...candidate,
      claims: [{
        ...candidate.claims[0]!,
        layer: "source_claim" as const,
        attributedTo: "Government Office",
        uncertainty: "This report is based on one publisher family pending independent confirmation.",
      }],
    };
    const result = evaluateCandidate(singleSource, new Map(evidence.map((row) => [row.id, row])));
    expect(result.passed).toBe(true);
  });

  it("requires explicit attribution for a single non-official source", () => {
    const nonOfficial: QualityEvidence = {
      ...evidence[0]!,
      publisher: "Independent Publisher",
      publisherDomain: "example.com",
      sourceFamilyId: "family-independent",
      sourceCategory: "international_media",
    };
    const singleSource = {
      ...candidate,
      claims: [{
        ...candidate.claims[0]!,
        layer: "observed_fact" as const,
        attributedTo: null,
        uncertainty: null,
      }],
    };
    const result = evaluateCandidate(singleSource, new Map([[nonOfficial.id, nonOfficial]]));
    expect(result.checks.find((check) => check.name === "single_source_attribution")?.status).toBe("fail");
    expect(result.passed).toBe(false);
  });

  it("allows a clearly attributed single non-official source", () => {
    const nonOfficial: QualityEvidence = {
      ...evidence[0]!,
      publisher: "Independent Publisher",
      publisherDomain: "example.com",
      sourceFamilyId: "family-independent",
      sourceCategory: "international_media",
    };
    const singleSource = {
      ...candidate,
      claims: [{
        ...candidate.claims[0]!,
        attributedTo: "Independent Publisher",
        uncertainty: "This report is based on one non-official publisher family.",
      }],
    };
    const result = evaluateCandidate(singleSource, new Map([[nonOfficial.id, nonOfficial]]));
    expect(result.checks.find((check) => check.name === "single_source_attribution")?.status).toBe("pass");
    expect(result.passed).toBe(true);
  });

  it("routes an all-hostile source packet to Narrative Watch", () => {
    const hostile: QualityEvidence = {
      ...evidence[0]!,
      publisher: "State Media",
      publisherDomain: "state.example",
      sourceFamilyId: "family-state-media",
      sourceCategory: "hostile_state_media",
    };
    const attributed = {
      ...candidate,
      claims: [{
        ...candidate.claims[0]!,
        attributedTo: "State Media",
        uncertainty: "This report is based on one hostile-state media source.",
      }],
    };
    const blocked = evaluateCandidate(attributed, new Map([[hostile.id, hostile]]));
    expect(blocked.checks.find((check) => check.name === "hostile_only_routing")?.status).toBe("fail");
    expect(blocked.passed).toBe(false);

    const routed = evaluateCandidate({ ...attributed, section: "narrative_watch" }, new Map([[hostile.id, hostile]]));
    expect(routed.checks.find((check) => check.name === "hostile_only_routing")?.status).toBe("pass");
    expect(routed.passed).toBe(true);
  });

  it("blocks a Daily Brief assembled only from hostile and adversarial outlets", () => {
    const hostile: QualityEvidence = {
      ...evidence[0]!,
      id: "22222222-2222-4222-8222-222222222222",
      publisher: "State Media",
      publisherDomain: "state.example",
      sourceFamilyId: "family-state-media",
      sourceCategory: "hostile_state_media",
    };
    const adversarial: QualityEvidence = {
      ...hostile,
      id: "33333333-3333-4333-8333-333333333333",
      publisher: "Regional Critical Outlet",
      publisherDomain: "regional.example",
      sourceFamilyId: "family-regional-critical",
      sourceCategory: "regional_critical",
    };
    const daily = {
      ...candidate,
      section: "daily_brief" as const,
      evidenceIds: [hostile.id, adversarial.id],
      claims: candidate.claims.map((claim) => ({
        ...claim,
        attributedTo: "State Media",
        uncertainty: "These reports require independent corroboration.",
        evidenceLinks: [{ ...claim.evidenceLinks[0]!, evidenceId: hostile.id }],
      })),
      passages: candidate.passages.map((passage) => ({ ...passage, evidenceIds: [hostile.id] })),
    };
    const result = evaluateCandidate(daily, new Map([[hostile.id, hostile], [adversarial.id, adversarial]]));
    expect(result.checks.filter((check) => check.status === "fail").map((check) => check.name)).toEqual(
      expect.arrayContaining(["adversarial_only_routing", "daily_brief_official_context"]),
    );
    expect(result.passed).toBe(false);
  });

  it("requires official Israeli evidence to anchor the first passage when it is available", () => {
    const independent: QualityEvidence = {
      ...evidence[0]!,
      id: "44444444-4444-4444-8444-444444444444",
      publisher: "Independent Publisher",
      publisherDomain: "independent.example",
      sourceFamilyId: "family-independent",
      sourceCategory: "international_media",
    };
    const outOfOrder = {
      ...candidate,
      evidenceIds: [evidence[0]!.id, independent.id],
      passages: candidate.passages.map((passage, index) => ({
        ...passage,
        evidenceIds: index === 0 ? [independent.id] : passage.evidenceIds,
      })),
    };
    const result = evaluateCandidate(outOfOrder, new Map([[evidence[0]!.id, evidence[0]!], [independent.id, independent]]));
    expect(result.checks.find((check) => check.name === "official_position_first")?.status).toBe("fail");
    expect(result.passed).toBe(false);
  });
});
