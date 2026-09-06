import { describe, expect, it } from "vitest";
import {
  evaluateCandidate,
  REQUIRED_QUALITY_CHECKS,
  type QualityCandidate,
  type QualityEvidence,
} from "@/server/modules/briefing/quality";
import { ANALYSIS_AUTHOR } from "@/server/contracts/publication";
import { dedupeDraftPassages } from "@/server/modules/briefing/service";

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
  basis: { evidenceBasis: "sourced", refutedClaim: null, verificationState: null },
};

/** The claim an unsourced refutation exists to answer. It is the only corpus
 * the title and the exact-fact check can be anchored against. */
const REFUTED_CLAIM =
  "Israel deliberately targeted a humanitarian convoy in Gaza and then blocked every independent investigation into the strike.";

const refutation: QualityCandidate = {
  key: "article-2",
  section: "narrative_watch",
  title: "Israel did not deliberately target the humanitarian convoy, and no investigation was blocked",
  summary: "The circulating convoy accusation inverts a documented sequence and omits the review that followed it.",
  body: [
    "The accusation asserts intent, and intent is the part it never demonstrates: it moves from an outcome that is terrible to a purpose that is assumed, without supplying the step between them.",
    "The claim also describes a blocked investigation while the review mechanism it names was announced publicly, briefed to journalists, and reported on by outlets hostile to Israel's account of the same events.",
    "What the framing removes is context: a convoy moving through an active combat corridor operated by a party that fights from within civilian traffic, which is precisely the condition the accusation treats as irrelevant.",
  ].join("\n\n"),
  evidenceIds: [],
  claims: [{
    title: "Deliberate targeting is asserted, not shown",
    text: "The accusation infers deliberate targeting from the outcome alone and never establishes intent.",
    layer: "editorial_conclusion",
    assessment: "refuted",
    attributedTo: ANALYSIS_AUTHOR,
    uncertainty: "This reasoning addresses the structure of the accusation. It does not establish what any individual commander knew at the time.",
    evidenceLinks: [],
  }],
  passages: [
    { text: "The accusation asserts intent, and intent is the part it never demonstrates: it moves from an outcome that is terrible to a purpose that is assumed, without supplying the step between them.", claimIndex: 0, evidenceIds: [] },
    { text: "The claim also describes a blocked investigation while the review mechanism it names was announced publicly, briefed to journalists, and reported on by outlets hostile to Israel's account of the same events.", claimIndex: 0, evidenceIds: [] },
    { text: "What the framing removes is context: a convoy moving through an active combat corridor operated by a party that fights from within civilian traffic, which is precisely the condition the accusation treats as irrelevant.", claimIndex: 0, evidenceIds: [] },
  ],
  basis: { evidenceBasis: "analysis", refutedClaim: REFUTED_CLAIM, verificationState: "refuted" },
};

const packet = new Map(evidence.map((row) => [row.id, row]));
const failed = (candidate: QualityCandidate, sources: ReadonlyMap<string, QualityEvidence>): string[] =>
  evaluateCandidate(candidate, sources).checks.filter((check) => check.status === "fail").map((check) => check.name);

describe("briefing quality gate", () => {
  it("removes near-duplicate passages for the same traced claim", () => {
    const passages = dedupeDraftPassages([
      { text: "The ministry published a regional security update after its Sunday meeting.", claimIndex: 0, evidenceIds: [evidence[0]!.id] },
      { text: "The ministry published a new regional security update following its Sunday meeting.", claimIndex: 0, evidenceIds: [evidence[0]!.id] },
      { text: "The statement is an official account and independent reporting was not present in this packet.", claimIndex: 0, evidenceIds: [evidence[0]!.id] },
    ]);
    expect(passages).toHaveLength(2);
    expect(passages[0]?.text).toContain("regional security update");
    expect(passages[1]?.text).toContain("independent reporting");
  });

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
    /* Editorial source-balance judgement: recorded and reported, but it does
       not refuse the package. */
    expect(result.advisoryFailures.map((check) => check.name)).toContain("single_source_attribution");
    expect(result.blockingFailures).toEqual([]);
    expect(result.passed).toBe(true);
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
    /* Routing is an editorial judgement about source composition: it warns
       rather than refusing. */
    expect(blocked.advisoryFailures.map((check) => check.name)).toContain("hostile_only_routing");
    expect(blocked.passed).toBe(true);

    const routed = evaluateCandidate({ ...attributed, section: "narrative_watch" }, new Map([[hostile.id, hostile]]));
    expect(routed.checks.find((check) => check.name === "hostile_only_routing")?.status).toBe("pass");
    expect(routed.passed).toBe(true);
  });

  it("warns, without blocking, on a Daily Brief assembled only from hostile and adversarial outlets", () => {
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
    /* Both are source-composition judgements. They are reported as warnings
       and no longer refuse a Daily Brief that has no official Israeli source. */
    expect(result.advisoryFailures.map((check) => check.name)).toEqual(
      expect.arrayContaining(["adversarial_only_routing", "daily_brief_official_context"]),
    );
    expect(result.blockingFailures).toEqual([]);
    expect(result.passed).toBe(true);
  });

  it("allows official Israeli evidence to appear after the first passage", () => {
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
    expect(result.checks.some((check) => check.name === "official_position_first")).toBe(false);
    expect(result.passed).toBe(true);
  });

  /* `REQUIRED_QUALITY_CHECKS` is the list `evaluateCandidate()` must emit in
   * full. A check written but never emitted — or emitted under a different
   * name — would silently weaken the external-publish gate, which is now the
   * only path that runs these checks at all.
   *
   * This comment used to say the list was counted by `publications/repo.ts`
   * and by a SQL trigger. Neither is true since 2026-09-03: `595ca9d` deleted
   * the repo counter and migration `0049` removed the count from the trigger.
   * The assertion below is still worth keeping — it pins emit-completeness —
   * but it no longer protects a database constraint. */
  it("emits exactly the checks the external-publish gate evaluates", () => {
    for (const subject of [candidate, refutation]) {
      const emitted = evaluateCandidate(subject, packet).checks.map((check) => check.name);
      expect(emitted).toEqual([...REQUIRED_QUALITY_CHECKS]);
      expect(new Set(emitted).size).toBe(REQUIRED_QUALITY_CHECKS.length);
    }
  });
});

/**
 * HISTORICAL. Read this before trusting the block below.
 *
 * This comment described a publish gate split across two enforcement layers
 * that counted differently — `publications/repo.ts` recomputing from
 * `REQUIRED_QUALITY_CHECKS.length`, and the SQL trigger
 * `enforce_publication_publish_gate` hardcoding twelve literal names and
 * raising unless exactly twelve passed. **Both were removed on 2026-09-03**:
 * `595ca9d` deleted the repo counter, and migration `0049` replaced the
 * trigger body with a machine-provenance check that counts nothing.
 *
 * The twelve names below are therefore no longer enforced anywhere. The
 * assertions are kept deliberately rather than deleted, for two reasons:
 *
 *   1. Rows written before `0049` were gated by exactly this arithmetic, so it
 *      documents what the historical constraint required.
 *   2. If the internal pipeline ever gets a deterministic gate again — an open
 *      owner decision, see docs/data-model.md#the-publish-gate — this is the
 *      shape it would take, and the frozen subset is the part that bit before.
 *
 * What it does NOT do any more is protect Production. Nothing raises if these
 * twelve stop passing.
 */
const TRIGGER_REQUIRED_CHECKS = [
  "known_evidence",
  "direct_publishers",
  "processable_source_text",
  "source_independence",
  "specific_title",
  "substantive_body",
  "non_placeholder_body",
  "title_source_alignment",
  "claim_evidence_matrix",
  "claim_source_independence",
  "paragraph_traceability",
  "exact_fact_fidelity",
] as const;

describe("briefing quality gate: the SQL trigger's frozen subset", () => {
  it("still names twelve checks that all exist in the current suite", () => {
    expect(TRIGGER_REQUIRED_CHECKS).toHaveLength(12);
    for (const name of TRIGGER_REQUIRED_CHECKS) {
      expect(REQUIRED_QUALITY_CHECKS).toContain(name);
    }
  });

  it("yields exactly twelve passes for an unsourced refutation, as the trigger demands", () => {
    for (const subject of [candidate, refutation]) {
      const passes = evaluateCandidate(subject, packet).checks.filter(
        (check) => check.status === "pass" && (TRIGGER_REQUIRED_CHECKS as readonly string[]).includes(check.name),
      );
      expect(passes).toHaveLength(12);
    }
  });
});

describe("briefing quality gate: unsourced refutations", () => {
  it("passes every check for a Narrative Watch refutation that cites nothing", () => {
    const result = evaluateCandidate(refutation, packet);
    expect(result.checks.filter((check) => check.status === "fail")).toEqual([]);
    expect(result.passed).toBe(true);
    expect(result.checks).toHaveLength(REQUIRED_QUALITY_CHECKS.length);
  });

  it("refuses the same unsourced article in any other section", () => {
    const misrouted = { ...refutation, section: "israel_update" as const };
    expect(failed(misrouted, packet)).toEqual(["analysis_disclosure"]);
  });

  it("refuses an unsourced article whose verification state is not a refutation", () => {
    const undecided: QualityCandidate = {
      ...refutation,
      basis: { ...refutation.basis, verificationState: "unresolved" },
    };
    expect(failed(undecided, packet)).toEqual(["analysis_disclosure"]);
  });

  it("refuses a figure that appears nowhere in the collected packet", () => {
    const invented: QualityCandidate = {
      ...refutation,
      body: `${refutation.body}\n\nThe convoy is described in the accusation as carrying 1,847 pallets.`,
    };
    expect(failed(invented, packet)).toContain("exact_fact_fidelity");
  });

  it("accepts a figure carried by a packet row the article does not cite", () => {
    /* The point of widening rather than exempting: an unsourced article has no
     * citation list of its own, so the corpus is the whole collected packet.
     * This row is in the packet and cited by nothing. */
    const uncited: QualityEvidence = {
      ...evidence[0]!,
      id: "55555555-5555-4555-8555-555555555555",
      title: "Convoy manifest published by the coordinating agency",
      excerpt: "The manifest lists 1,847 pallets loaded across the convoy before it entered the corridor.",
      publisher: "Coordinating Agency",
      publisherDomain: "agency.example",
      sourceFamilyId: "family-agency",
      sourceCategory: "international_institution",
    };
    const cited: QualityCandidate = {
      ...refutation,
      body: `${refutation.body}\n\nThe convoy is described in the accusation as carrying 1,847 pallets.`,
    };
    const widened = new Map([...packet, [uncited.id, uncited]]);
    expect(failed(cited, widened)).toEqual([]);
    expect(evaluateCandidate(cited, widened).passed).toBe(true);
    // The article still cites nothing; the figure is grounded, not attributed.
    expect(cited.evidenceIds).toEqual([]);
  });

  it("refuses unsourced claims that pose as source claims", () => {
    const posing: QualityCandidate = {
      ...refutation,
      claims: refutation.claims.map((claim) => ({ ...claim, layer: "source_claim" as const })),
    };
    expect(failed(posing, packet)).toEqual(["claim_evidence_matrix"]);
  });

  it("refuses unsourced claims attributed to anyone but the organisation", () => {
    const misattributed: QualityCandidate = {
      ...refutation,
      claims: refutation.claims.map((claim) => ({ ...claim, attributedTo: "A senior official" })),
    };
    expect(failed(misattributed, packet)).toEqual(["claim_evidence_matrix"]);
  });

  it("keeps the two unsourced claim substitutes independent of each other", () => {
    /* `claim_evidence_matrix` and `claim_source_independence` check different
     * properties on purpose, so a partial regression still trips one of them. */
    const hedged: QualityCandidate = {
      ...refutation,
      claims: refutation.claims.map((claim) => ({ ...claim, assessment: "unresolved" as const })),
    };
    expect(failed(hedged, packet)).toEqual(["claim_source_independence"]);
  });

  it("still rejects an unresolvable evidence ID on an unsourced article", () => {
    const ghost: QualityCandidate = {
      ...refutation,
      evidenceIds: ["66666666-6666-4666-8666-666666666666"],
    };
    const failures = failed(ghost, packet);
    expect(failures).toContain("known_evidence");
    expect(failures).toContain("analysis_disclosure");
  });
});
