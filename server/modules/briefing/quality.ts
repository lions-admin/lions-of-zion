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

export type QualityCandidate = {
  key: string;
  section: "daily_brief" | "israel_update" | "war_update" | "narrative_watch";
  title: string;
  summary: string;
  body: string;
  evidenceIds: string[];
  claims: DraftClaim[];
  passages: DraftPassage[];
};

export type QualityCheck = {
  name: string;
  status: "pass" | "fail";
  detail: string;
};

export type QualityDecision = {
  passed: boolean;
  checks: QualityCheck[];
};

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
  "official_position_first",
  "paragraph_traceability",
  "exact_fact_fidelity",
] as const;

const GENERIC_TITLES = /^(daily brief|latest news|news update|war update|israel update|what you need to know|breaking news)$/i;

/** Deterministic checks run after drafting and before any publication row can
 * receive an automatic-publish marker. Model output cannot waive them. */
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

  add(checks, "known_evidence", evidence.length === candidate.evidenceIds.length && evidence.length > 0,
    evidence.length === candidate.evidenceIds.length
      ? `${evidence.length} evidence records resolved.`
      : "At least one cited evidence ID is outside the closed collection packet.");

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
  const citable = evidence.length > 0;
  const independent = families.size >= 2 || officialException;
  add(checks, "source_independence", citable,
    !citable
      ? "At least one directly attributed public source is required."
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

  const titleWords = meaningfulWords(candidate.title);
  const evidenceWords = meaningfulWords(evidence.map((row) => `${row.title} ${row.excerpt ?? ""}`).join(" "));
  const overlap = titleWords.filter((word) => evidenceWords.includes(word));
  const titleAligned = titleWords.length >= 3 && overlap.length >= Math.min(3, Math.ceil(titleWords.length * 0.4));
  add(checks, "title_source_alignment", titleAligned,
    titleAligned ? `The title shares ${overlap.length} meaningful terms with cited source material.` : "The title is not sufficiently anchored in the cited source material.");

  const claimLinksValid = candidate.claims.length > 0 && candidate.claims.every((claim) =>
    claim.text.trim()
    && claim.evidenceLinks.length > 0
    && claim.evidenceLinks.every((link) => ids.has(link.evidenceId) && link.rationale.trim()),
  );
  add(checks, "claim_evidence_matrix", claimLinksValid,
    claimLinksValid ? `${candidate.claims.length} atomic claims have explained evidence edges.` : "Every atomic claim must have an explained edge to cited evidence.");

  const claimIndependence = candidate.claims.length > 0 && candidate.claims.every((claim) => {
    const claimEvidence = claim.evidenceLinks.flatMap((link) => {
      const row = evidenceById.get(link.evidenceId);
      return row ? [row] : [];
    });
    return claimEvidence.length > 0;
  });
  add(checks, "claim_source_independence", claimIndependence,
    claimIndependence ? "Every claim cites at least one known source. Multiple source families are recorded when available but are not required." : "A claim has no known source evidence.");

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

  const officialEvidenceIds = new Set(officialIsraeliEvidence.map((row) => row.id));
  const officialPositionFirst = candidate.section === "narrative_watch"
    || officialEvidenceIds.size === 0
    || candidate.passages[0]?.evidenceIds.some((id) => officialEvidenceIds.has(id)) === true;
  add(checks, "official_position_first", officialPositionFirst,
    officialPositionFirst
      ? officialEvidenceIds.size > 0 && candidate.section !== "narrative_watch"
        ? "The first public passage is anchored in official Israeli evidence."
        : "No official Israeli source is present, or the candidate is Narrative Watch."
      : "When official Israeli evidence is available, the first public passage must present that position before other claims.");

  const passageLinksValid = candidate.passages.length > 0 && candidate.passages.every((passage) =>
    passage.text.trim().length >= 40
    && Number.isInteger(passage.claimIndex)
    && passage.claimIndex >= 0
    && passage.claimIndex < candidate.claims.length
    && passage.evidenceIds.length > 0
    && passage.evidenceIds.every((id) => ids.has(id)),
  );
  add(checks, "paragraph_traceability", passageLinksValid,
    passageLinksValid ? "Every public paragraph maps to one atomic claim and its source evidence." : "A paragraph has no valid claim and evidence path.");

  const sourceText = evidence.map((row) => `${row.title}\n${row.excerpt ?? ""}`).join("\n").toLowerCase();
  const exactTokens = [
    ...candidate.body.matchAll(/\b\d[\d,.]*(?:%|\s+(?:people|soldiers|civilians|days|hours|missiles|rockets))?\b/gi),
  ].map((match) => match[0].toLowerCase());
  const quoted = [...candidate.body.matchAll(/[“"]([^”"]{15,})[”"]/g)].map((match) => match[1]!.toLowerCase());
  const exactSupported = [...exactTokens, ...quoted].every((token) => sourceText.includes(token));
  add(checks, "exact_fact_fidelity", exactSupported,
    exactSupported ? "Every exact number and direct quotation appears in the cited source packet." : "An exact number or quotation is absent from the cited source packet.");

  return { passed: checks.every((check) => check.status === "pass"), checks };
}

function add(checks: QualityCheck[], name: string, passed: boolean, detail: string): void {
  checks.push({ name, status: passed ? "pass" : "fail", detail });
}

function meaningfulWords(value: string): string[] {
  const stop = new Set(["the", "a", "an", "and", "or", "of", "to", "in", "on", "for", "with", "from", "after", "new", "latest"]);
  return [...new Set(value.toLowerCase().match(/[a-z]{4,}/g) ?? [])].filter((word) => !stop.has(word));
}
