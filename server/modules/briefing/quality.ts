import { ANALYSIS_AUTHOR, type EvidenceBasis } from "@/server/contracts/publication";

export type QualityEvidence = {
  id: string;
  title: string;
  excerpt: string | null;
  canonicalUrl: string | null;
  publisher: string;
  publisherDomain: string | null;
  sourceFamilyId: string;
  sourceCategory: string | null;
  usableTextLength: number;
  retrievalStatus: string;
  accessState: string;
};

export type DraftClaim = {
  title: string;
  text: string;
  layer: "source_claim" | "observed_fact" | "model_inference" | "editorial_conclusion";
  assessment: "verified" | "refuted" | "misleading" | "unsupported" | "disputed" | "unresolved";
  attributedTo: string | null;
  uncertainty: string | null;
  evidenceLinks: Array<{
    evidenceId: string;
    relation: "supports" | "partially_supports" | "contradicts" | "contextualizes";
    strength: "strong" | "adequate" | "weak" | "contextual";
    rationale: string;
  }>;
};

export type DraftPassage = { text: string; claimIndex: number; evidenceIds: string[] };

/**
 * What kind of record this is, from the caller's own knowledge rather than
 * from the candidate's prose.
 *
 * `evidenceBasis` is derived upstream from `evidenceIds.length === 0`; it is
 * never read off model output. `refutedClaim` is the Narrative Watch
 * `exactClaim` — the claim the piece exists to answer — and is the only
 * corpus an unsourced refutation can be anchored against. `verificationState`
 * is that record's published assessment of the claim.
 *
 * The field is required rather than optional so that adding an unsourced path
 * forces every call site to say which kind of record it is building, instead
 * of defaulting into the lenient branch by omission.
 */
export type QualityBasis = {
  evidenceBasis: EvidenceBasis;
  refutedClaim: string | null;
  verificationState: string | null;
};

export type QualityCandidate = {
  key: string;
  section: "daily_brief" | "israel_update" | "narrative_watch";
  title: string;
  summary: string;
  body: string;
  evidenceIds: string[];
  claims: DraftClaim[];
  passages: DraftPassage[];
  basis: QualityBasis;
};

export type QualityCheck = {
  name: string;
  status: "pass" | "fail";
  detail: string;
  /** False for a check whose failure is an editorial warning rather than a
   *  reason to refuse the package. See `ADVISORY_QUALITY_CHECKS`. */
  blocking: boolean;
};

export type QualityDecision = {
  /** True when every *blocking* check passes. Advisory failures do not
   *  affect it — read `advisoryFailures` for those. */
  passed: boolean;
  checks: QualityCheck[];
  /** Failed blocking checks. Non-empty means the package must be refused. */
  blockingFailures: QualityCheck[];
  /** Failed advisory checks. Reported and logged; never a reason to refuse. */
  advisoryFailures: QualityCheck[];
};

/**
 * Checks that express editorial judgement about a package rather than its
 * technical validity.
 *
 * These still run, still record a `pass`/`fail` audit row, and still appear in
 * the publish response — but a failure among them is a warning, not a refusal.
 * The owner's instruction is that a structurally valid, authenticated package
 * publishes even when its source mix, its title phrasing or its official-source
 * composition are imperfect, so none of these may return 422 or roll back the
 * publish transaction.
 *
 * What is deliberately NOT in this set, and why:
 *
 *   known_evidence, claim_evidence_matrix, paragraph_traceability
 *     Referential integrity of citations and of the paragraph→claim spine.
 *     A failure here means a citation key or claim index points at nothing,
 *     which is malformed input and a broken renderer, not an opinion.
 *   direct_publishers
 *     URL shape and publisher identity. Malformed-URL validation.
 *   processable_source_text
 *     A cited evidence row must actually carry retrievable text. Without it
 *     the citation renders as an empty source.
 *   exact_fact_fidelity
 *     Every exact figure and direct quotation in the body must appear in the
 *     source packet. This is the anti-fabrication guarantee, not an editorial
 *     preference, so it stays blocking.
 *   analysis_disclosure
 *     An unsourced piece may publish only as a labelled Narrative Watch
 *     record. This is the disclosure guarantee that stops unsourced material
 *     being presented as sourced reporting; it stays blocking.
 */
export const ADVISORY_QUALITY_CHECKS: ReadonlySet<string> = new Set([
  /* Minimum source diversity / corroboration threshold. */
  "source_independence",
  /* Subjective title quality. */
  "specific_title",
  /* Subjective completeness scoring: body length and passage count. */
  "substantive_body",
  /* Prose-style heuristic over the body text. */
  "non_placeholder_body",
  /* Title/source semantic alignment threshold. */
  "title_source_alignment",
  /* Per-claim corroboration threshold. */
  "claim_source_independence",
  /* Editorial source-balance rule for a single-source report. */
  "single_source_attribution",
  /* Narrative/source-balance routing requirements. */
  "hostile_only_routing",
  "adversarial_only_routing",
  /* Mandatory official-source composition for the Daily Brief. */
  "daily_brief_official_context",
]);

export const REQUIRED_QUALITY_CHECKS = [
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
  "single_source_attribution",
  "hostile_only_routing",
  "adversarial_only_routing",
  "daily_brief_official_context",
  "paragraph_traceability",
  "exact_fact_fidelity",
  "analysis_disclosure",
] as const;

const GENERIC_TITLES = /^(daily brief|latest news|news update|war update|israel update|what you need to know|breaking news)$/i;

/** The assessments an unsourced refutation may reach. A piece that cites
 * nothing cannot conclude that something is `verified`, `disputed`, or
 * `unresolved` — those are findings about source material it does not have. */
const REFUTATION_ASSESSMENTS = new Set(["refuted", "misleading", "unsupported"]);

/** Deterministic checks run after drafting and before any publication row can
 * receive an automatic-publish marker. Model output cannot waive them.
 *
 * Every name in `REQUIRED_QUALITY_CHECKS` is written and recorded — including
 * for an unsourced Narrative Watch refutation. There is deliberately no skip
 * path: a check that does not apply carries its exemption *inside its own pass
 * condition*, with a detail string saying so. That is what keeps the recorded
 * audit row honest.
 *
 * Not every recorded check refuses a package. Each one is tagged `blocking`
 * from `ADVISORY_QUALITY_CHECKS`, and `passed` reflects the blocking set only:
 * the editorial checks report their verdict into the audit trail and the
 * publish response as warnings, while structural, citation-integrity,
 * anti-fabrication and disclosure checks still refuse. The SQL publish gate
 * that used to count a fixed twelve of these names as passes was retired in
 * migration 0049; the trigger now verifies machine provenance only, so no
 * database layer re-imposes the editorial set.
 */
export function evaluateCandidate(
  candidate: QualityCandidate,
  evidenceById: ReadonlyMap<string, QualityEvidence>,
): QualityDecision {
  const evidence = candidate.evidenceIds.flatMap((id) => {
    const row = evidenceById.get(id);
    return row ? [row] : [];
  });
  const ids = new Set(evidence.map((row) => row.id));
  const checks: QualityCheck[] = [];
  /* Derived upstream from `evidenceIds.length === 0`, never chosen by a model.
   * Seven checks below carry a second pass condition for this case. */
  const analysis = candidate.basis.evidenceBasis === "analysis";

  const allEvidenceResolved = evidence.length === candidate.evidenceIds.length;
  add(checks, "known_evidence", allEvidenceResolved && (evidence.length > 0 || analysis),
    !allEvidenceResolved
      ? "At least one cited evidence ID is outside the closed collection packet."
      : evidence.length === 0
        ? "This record cites nothing and is published as the organisation's own analysis."
        : `${evidence.length} evidence records resolved.`);

  /* `direct_publishers`, `processable_source_text` and `single_source_attribution`
   * need no unsourced branch: the first two quantify over an empty array and
   * the third turns on `families.size === 1`, which an empty packet is not. */
  const direct = evidence.every((row) => {
    if (!row.canonicalUrl || !row.publisher || !row.publisherDomain) return false;
    try {
      const parsed = new URL(row.canonicalUrl);
      return parsed.protocol === "https:" || parsed.protocol === "http:";
    } catch {
      return false;
    }
  });
  add(checks, "direct_publishers", direct,
    direct ? "Every source has a direct publisher URL and publisher identity." : "A source lacks a direct publisher URL or identity.");

  const processable = evidence.every((row) =>
    row.accessState === "open"
    && ["fetched", "partial"].includes(row.retrievalStatus)
    && row.usableTextLength >= 80
    && Boolean(row.excerpt?.trim()),
  );
  add(checks, "processable_source_text", processable,
    processable ? "All cited sources have enough accessible text for grounded drafting." : "A source is blocked, incomplete, or has less than 80 usable characters.");

  const families = new Set(evidence.map((row) => row.sourceFamilyId));
  const officialException = evidence.some((row) => row.sourceCategory?.startsWith("official_"));
  /* A source is a bonus on a refutation, not a requirement: the organisation
   * may answer a hostile claim from its own reasoning. What it may not do is
   * publish that piece as an ordinary report — `analysis_disclosure` below
   * holds it to Narrative Watch and a labelled verification state. */
  const citable = evidence.length > 0 || analysis;
  const independent = families.size >= 2 || officialException;
  add(checks, "source_independence", citable,
    !citable
      ? "At least one directly attributed public source is required."
      : evidence.length === 0
        ? "No source is cited. This record is published as this organisation's own analysis and is labelled as such."
        : independent
          ? officialException && families.size < 2
            ? "A primary official source supports this narrowly attributed report."
            : `${families.size} independent source families are represented.`
          : "One source family is recorded as a single-source report, not as independent corroboration.");

  const specificTitle = candidate.title.trim().length >= 18 && !GENERIC_TITLES.test(candidate.title.trim());
  add(checks, "specific_title", specificTitle,
    specificTitle ? "The title names a specific subject rather than a generic update." : "The title is too generic for publication.");

  const substantive = candidate.body.trim().length >= 240 && candidate.passages.length >= 2;
  add(checks, "substantive_body", substantive,
    substantive ? `${candidate.passages.length} traced passages form a substantive article.` : "The article needs at least two traced passages and 240 characters.");

  const placeholderPattern = /(the (?:available )?(?:sources|material) (?:do not|does not|did not) (?:contain|provide|include)|insufficient (?:information|detail)|no details? (?:were|was) provided|this article summarizes the sources)/i;
  const nonPlaceholder = !placeholderPattern.test(candidate.body);
  add(checks, "non_placeholder_body", nonPlaceholder,
    nonPlaceholder ? "The article reports the supported event rather than describing source availability." : "The body contains source-availability placeholder prose instead of reporting an event.");

  /* A refutation has no cited source to be anchored in, so it is anchored in
   * the claim it answers instead. The threshold is unchanged: a headline that
   * shares nothing with its own subject is still rejected. */
  const alignmentCorpus = analysis
    ? candidate.basis.refutedClaim ?? ""
    : evidence.map((row) => `${row.title} ${row.excerpt ?? ""}`).join(" ");
  const titleWords = meaningfulWords(candidate.title);
  const alignmentWords = meaningfulWords(alignmentCorpus);
  const overlap = titleWords.filter((word) => alignmentWords.includes(word));
  const titleAligned = titleWords.length >= 3 && overlap.length >= Math.min(3, Math.ceil(titleWords.length * 0.4));
  add(checks, "title_source_alignment", titleAligned,
    titleAligned
      ? analysis
        ? `The title shares ${overlap.length} meaningful terms with the claim being refuted.`
        : `The title shares ${overlap.length} meaningful terms with cited source material.`
      : analysis
        ? "The title is not sufficiently anchored in the exact claim this analysis refutes."
        : "The title is not sufficiently anchored in the cited source material.");

  /* The unsourced substitute deliberately *forbids* citations rather than
   * merely excusing their absence, mirroring the zod refine on
   * `createPublicationSchema`: a half-sourced record — some claims cited, the
   * article itself citing nothing — is the laundering shape, and both gates
   * must reject it so neither can drift into permitting it alone. */
  const claimLinksValid = candidate.claims.length > 0 && candidate.claims.every((claim) =>
    claim.text.trim()
    && (analysis
      ? claim.evidenceLinks.length === 0
        && claim.layer === "editorial_conclusion"
        && claim.attributedTo?.trim() === ANALYSIS_AUTHOR
        && Boolean(claim.uncertainty?.trim())
      : claim.evidenceLinks.length > 0
        && claim.evidenceLinks.every((link) => ids.has(link.evidenceId) && link.rationale.trim())),
  );
  add(checks, "claim_evidence_matrix", claimLinksValid,
    claimLinksValid
      ? analysis
        ? `${candidate.claims.length} atomic claims are stated as this organisation's own editorial conclusions and cite nothing.`
        : `${candidate.claims.length} atomic claims have explained evidence edges.`
      : analysis
        ? `Every claim in an unsourced analysis must have an empty evidenceLinks array, layer "editorial_conclusion", attributedTo exactly "${ANALYSIS_AUTHOR}", and a written uncertainty note.`
        : "Every atomic claim must have an explained edge to cited evidence.");

  /* Kept distinct from the substitute above on purpose. If one of the two
   * unsourced conditions regresses, the other still fails the candidate. */
  const claimIndependence = candidate.claims.length > 0 && candidate.claims.every((claim) => {
    if (analysis) return REFUTATION_ASSESSMENTS.has(claim.assessment);
    const claimEvidence = claim.evidenceLinks.flatMap((link) => {
      const row = evidenceById.get(link.evidenceId);
      return row ? [row] : [];
    });
    return claimEvidence.length > 0;
  });
  add(checks, "claim_source_independence", claimIndependence,
    claimIndependence
      ? analysis
        ? "Every claim states a refuting judgement about the monitored narrative rather than a finding about source material."
        : "Every claim cites at least one known source. Multiple source families are recorded when available but are not required."
      : analysis
        ? "Every claim in an unsourced analysis must assess the narrative as refuted, misleading, or unsupported."
        : "A claim has no known source evidence.");

  // A lone non-official publisher can support a timely update, but it is not
  // a neutral fact record. Make that limit enforceable rather than relying on
  // the model to remember a prose instruction. Official primary statements are
  // exempt because their authority is the subject of the attributed report.
  const isSingleNonOfficialSource = families.size === 1 && !officialException;
  const singleSourceAttributed = !isSingleNonOfficialSource || candidate.claims.every((claim) =>
    claim.layer === "source_claim"
    && Boolean(claim.attributedTo?.trim())
    && Boolean(claim.uncertainty?.trim()),
  );
  add(checks, "single_source_attribution", singleSourceAttributed,
    !isSingleNonOfficialSource
      ? "The source packet includes an official primary source or more than one source family."
      : singleSourceAttributed
        ? "Every claim is explicitly attributed and uncertainty-aware for this single-source report."
        : "A single non-official source may publish only as an attributed source claim with an uncertainty note.");

  // A hostile-state outlet is useful evidence of what that outlet is saying,
  // not standalone evidence of the underlying event. Keep an all-hostile
  // packet in Narrative Watch, where the public label and evidence status
  // make that distinction explicit.
  const hostileOnly = evidence.length > 0 && evidence.every((row) => row.sourceCategory === "hostile_state_media");
  const hostileOnlyRouted = !hostileOnly || candidate.section === "narrative_watch";
  add(checks, "hostile_only_routing", hostileOnlyRouted,
    !hostileOnly
      ? "The candidate includes a source outside hostile-state media."
      : hostileOnlyRouted
        ? "An all-hostile source packet is routed through Narrative Watch."
        : "An all-hostile source packet may publish only in Narrative Watch.");

  /* A packet made solely of hostile-state or persistently adversarial outlets
   * can document a narrative, but cannot become an Israel/war news report.
   * This closes the loophole where mixing one hostile source with one
   * adversarial outlet bypassed the all-hostile routing check. */
  const adversarialCategories = new Set([
    "hostile_state_media",
    "regional_critical",
    "critical_media",
    "critical_institution",
  ]);
  const adversarialOnly = evidence.length > 0 && evidence.every((row) =>
    row.sourceCategory !== null && adversarialCategories.has(row.sourceCategory),
  );
  const adversarialOnlyRouted = !adversarialOnly || candidate.section === "narrative_watch";
  add(checks, "adversarial_only_routing", adversarialOnlyRouted,
    !adversarialOnly
      ? "The source packet includes an official, independent, institutional, or other non-adversarial source."
      : adversarialOnlyRouted
        ? "An adversarial-only packet is labelled and routed through Narrative Watch."
        : "An adversarial-only packet may publish only in Narrative Watch.");

  const officialIsraeliEvidence = evidence.filter((row) => row.sourceCategory === "official_israeli");
  const dailyBriefHasOfficialContext = candidate.section !== "daily_brief" || officialIsraeliEvidence.length > 0;
  add(checks, "daily_brief_official_context", dailyBriefHasOfficialContext,
    dailyBriefHasOfficialContext
      ? candidate.section === "daily_brief"
        ? "The Daily Brief includes an official Israeli source."
        : "Official Israeli context is required only for the Daily Brief."
      : "The Daily Brief requires at least one official Israeli source; do not publish a daily edition without it.");

  /* The paragraph-to-claim spine survives unchanged: the 40-character floor
   * and the local claim index are what make a refutation auditable at all.
   * Only the evidence leg differs, and there it is *required* to be empty. */
  const passageLinksValid = candidate.passages.length > 0 && candidate.passages.every((passage) =>
    passage.text.trim().length >= 40
    && Number.isInteger(passage.claimIndex)
    && passage.claimIndex >= 0
    && passage.claimIndex < candidate.claims.length
    && (analysis
      ? passage.evidenceIds.length === 0
      : passage.evidenceIds.length > 0 && passage.evidenceIds.every((id) => ids.has(id))),
  );
  add(checks, "paragraph_traceability", passageLinksValid,
    passageLinksValid
      ? analysis
        ? "Every public paragraph maps to one atomic editorial claim and cites no source."
        : "Every public paragraph maps to one atomic claim and its source evidence."
      : analysis
        ? "A paragraph has no valid claim path, or an unsourced analysis paragraph cites evidence."
        : "A paragraph has no valid claim and evidence path.");

  /* Not exempted. An unsourced piece is the one place a fabricated figure has
   * nothing at all to contradict it, so the corpus is widened rather than the
   * check dropped: every exact number and quotation must still appear either
   * somewhere in the whole collected packet or in the claim being refuted —
   * quoting the narrative under refutation is the point of the piece. This
   * stays non-circular (the article's own prose is never part of the corpus)
   * and degrades correctly: an empty packet permits no figures at all. */
  const citedSourceText = evidence.map((row) => `${row.title}\n${row.excerpt ?? ""}`).join("\n").toLowerCase();
  const factCorpus = analysis
    ? [
        ...[...evidenceById.values()]
          .filter((row) => Boolean(row.excerpt?.trim()))
          .map((row) => `${row.title}\n${row.excerpt ?? ""}`),
        candidate.basis.refutedClaim ?? "",
      ].join("\n").toLowerCase()
    : citedSourceText;
  const exactTokens = [
    ...candidate.body.matchAll(/\b\d[\d,.]*(?:%|\s+(?:people|soldiers|civilians|days|hours|missiles|rockets))?\b/gi),
  ].map((match) => match[0].toLowerCase());
  const quoted = [...candidate.body.matchAll(/[“"]([^”"]{15,})[”"]/g)].map((match) => match[1]!.toLowerCase());
  const exactSupported = [...exactTokens, ...quoted].every((token) => factCorpus.includes(token));
  add(checks, "exact_fact_fidelity", exactSupported,
    exactSupported
      ? analysis
        ? "Every exact number and direct quotation appears in the collected source packet or in the claim being refuted."
        : "Every exact number and direct quotation appears in the cited source packet."
      : analysis
        ? "An exact number or quotation appears nowhere in the collected source packet or in the claim being refuted."
        : "An exact number or quotation is absent from the cited source packet.");

  /* Vacuously true for a sourced record, so the check is still written and
   * still recorded. For an unsourced one it is the disclosure itself: the
   * organisation's own reasoning may only appear where the section, the empty
   * citation list, and the published verification state all say what it is. */
  const disclosed = !analysis
    || (candidate.section === "narrative_watch"
      && candidate.evidenceIds.length === 0
      && candidate.basis.verificationState !== null
      && REFUTATION_ASSESSMENTS.has(candidate.basis.verificationState));
  add(checks, "analysis_disclosure", disclosed,
    !analysis
      ? "This record rests on cited sources, so no analysis disclosure is required."
      : disclosed
        ? `An unsourced refutation is published in Narrative Watch, cites nothing, and states the narrative as ${candidate.basis.verificationState}.`
        : "An unsourced analysis may publish only as a Narrative Watch record that cites nothing and states the narrative as refuted, misleading, or unsupported.");

  const failures = checks.filter((check) => check.status === "fail");
  const blockingFailures = failures.filter((check) => check.blocking);
  const advisoryFailures = failures.filter((check) => !check.blocking);
  return { passed: blockingFailures.length === 0, checks, blockingFailures, advisoryFailures };
}

function add(checks: QualityCheck[], name: string, passed: boolean, detail: string): void {
  checks.push({
    name,
    status: passed ? "pass" : "fail",
    detail,
    blocking: !ADVISORY_QUALITY_CHECKS.has(name),
  });
}

function meaningfulWords(value: string): string[] {
  const stop = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "from", "after", "new", "latest"]);
  return [...new Set(value.toLowerCase().match(/[a-z]{4,}/g) ?? [])].filter((word) => !stop.has(word));
}
