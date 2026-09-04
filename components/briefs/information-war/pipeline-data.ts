/**
 * Shared pipeline model for `/information-war`.
 *
 * The seven explanatory stages are the page's vocabulary; each carries the
 * real job stage(s) it maps to (`collect → publish` in
 * `server/contracts/admin-console.ts` `PIPELINE_STAGES`). Keeping the mapping
 * in one place means the map, the inspector and the tests all read the same
 * table instead of restating it.
 */

export interface PipelineStage {
  number: string;
  name: string;
  job: string;
  detail: string;
  mechanism: string;
  inputs: string;
  outputs: string;
}

export const PIPELINE_STAGES: readonly PipelineStage[] = [
  {
    number: "01",
    name: "Source",
    job: "collect",
    detail: "Public reporting enters through monitored search queries and verified feeds.",
    mechanism:
      "Every source belongs to a named family. That is what lets five syndicated copies of one wire report be counted as one origin instead of five.",
    inputs: "RSS/Atom feeds, official APIs, discovery queries over a bounded domain corpus.",
    outputs: "Raw fetch records queued per source.",
  },
  {
    number: "02",
    name: "Ingestion",
    job: "collect + enrich",
    detail: "Each result keeps its publisher, URL, retrieval time, and original source family.",
    mechanism:
      "Provenance is append-only in the database. A record of where something came from and when it was fetched cannot be edited afterwards, only added to.",
    inputs: "Raw fetches from collection.",
    outputs: "Normalized evidence rows with provenance.",
  },
  {
    number: "03",
    name: "Detection",
    job: "cluster",
    detail: "Relevant stories, atomic claims, duplicates, and candidate narratives are separated.",
    mechanism:
      "Reports of the same event are clustered before anything is written about them, so volume never reaches an editor disguised as corroboration.",
    inputs: "Enriched evidence packet for the edition.",
    outputs: "Event clusters, duplicate groups, candidate narratives.",
  },
  {
    number: "04",
    name: "Analysis",
    job: "triage + draft",
    detail:
      "A claim is assessed against the material on record, and the assessment states what it could not establish.",
    mechanism:
      "An assessment scores ten separate confidence dimensions, and a database constraint refuses one that leaves its known gaps blank. Once written it is immutable: a changed finding is a new assessment, not an edited one.",
    inputs: "Clustered evidence.",
    outputs: "Draft assessments with stated gaps.",
  },
  {
    number: "05",
    name: "Evidence",
    job: "draft",
    detail: "Supporting and contradicting material stays attached to the statements it bears on.",
    mechanism:
      "A publication is refused unless every passage cites the evidence under it. The single exception is a Narrative Watch record published as our own analysis, which must cite nothing anywhere — never partly.",
    inputs: "Draft assessments.",
    outputs: "Passages with attached citations.",
  },
  {
    number: "06",
    name: "Verification",
    job: "quality + publish gate",
    detail: "Nothing publishes on the say-so of whoever wrote it.",
    mechanism:
      "A database trigger holds the gate, so no code path reaches publication around it. An editor's publication must be approved by a human who is not the author. An automatic one must carry its run provenance and have passed all twelve named quality checks — and may not also claim human approval.",
    inputs: "Cited drafts.",
    outputs: "Gate decision: approved, returned, or blocked.",
  },
  {
    number: "07",
    name: "Publication",
    job: "publish",
    detail: "The record goes public, and stays correctable.",
    mechanism:
      "Every published record is versioned and every version is kept. A correction is a new version with a stated reason, and the history travels with the record rather than replacing it.",
    inputs: "Approved editions.",
    outputs: "Daily Brief, updates feed, fact-check desk entries.",
  },
] as const;

/** Collection cadence, mirrored from `vercel.json` via `SCHEDULES`. */
export const COLLECTION_CADENCE = "Every 30 minutes (:00 and :30)" as const;

/*
 * The three routes, over the one spine.
 *
 * This page used to teach the pipeline four times: `PIPELINE_STAGES` as a map,
 * `SIGNAL_JOURNEY` as eight steps, a narrative panel as four, and `CLAIM_FLOW`
 * as seven — four ordered lists rendering one journey, two of them through the
 * same component and the same stylesheet with different data. Mapped against
 * each other they are the same stations under different names: `Detection` is
 * "Extracted"/"Clustered" is "Semantic clusters" is "Claim detected".
 *
 * So there is one spine — `PIPELINE_STAGES` — and three routes across it. Every
 * sentence the four lists carried is kept; what is gone is the pretence that
 * they were different diagrams. A route names the stages it touches and what
 * happens at each, in the spine's order rather than its own, because the order
 * belongs to the system and not to the telling.
 *
 * `at` must be a `number` in `PIPELINE_STAGES`, and a route may stop at a stage
 * more than once — a claim is both searched for and context-checked at
 * `Evidence`. `tests/information-war-routes.test.ts` holds both invariants.
 */
export interface RouteStep {
  /** The `number` of the `PIPELINE_STAGES` entry this step happens at. */
  at: string;
  step: string;
  text: string;
}

export interface PipelineRoute {
  id: "signal" | "narrative" | "claim";
  name: string;
  /** What a reader is following, in one clause. */
  subject: string;
  steps: readonly RouteStep[];
}

export const PIPELINE_ROUTES: readonly PipelineRoute[] = [
  {
    id: "signal",
    name: "A signal",
    subject: "One post, from the moment it is collected to the moment it is public.",
    steps: [
      { at: "01", step: "Detected", text: "A post or article is collected from a monitored source." },
      { at: "02", step: "Attributed", text: "Its publisher, URL, retrieval time and source family are recorded." },
      { at: "03", step: "Extracted", text: "The atomic claim is separated from commentary around it." },
      { at: "03", step: "Clustered", text: "Copies of the same report merge under one origin; volume cannot pose as corroboration." },
      { at: "04", step: "Verified", text: "The claim is checked across sources against primary material." },
      { at: "04", step: "Scored", text: "Confidence is assessed across ten dimensions, gaps stated in writing." },
      { at: "05", step: "Cited", text: "Every passage carries the evidence it rests on, or the record cites nothing anywhere." },
      { at: "06", step: "Gated", text: "A second human — or twelve automated checks with run provenance — must approve." },
      { at: "07", step: "Published", text: "The finding joins the public record, versioned and correctable." },
    ],
  },
  {
    id: "narrative",
    name: "A narrative",
    subject: "A frame that persists across many reports, and how it is measured.",
    steps: [
      { at: "01", step: "Individual signals", text: "Collected posts and articles, each with publisher, URL and retrieval time." },
      { at: "03", step: "Semantic clusters", text: "Reports of the same event merge; duplicates never count as corroboration." },
      { at: "04", step: "The frame", text: "A persistent frame across clusters — the story the copies are telling together." },
      { at: "06", step: "Assessment", text: "Growth, source diversity and evidence status are weighed; gaps are stated in writing." },
      { at: "07", step: "Narrative Watch", text: "It publishes as this desk's own analysis — which must cite nothing anywhere, never partly." },
    ],
  },
  {
    id: "claim",
    name: "A claim",
    subject: "A specific assertion in circulation, and whether it survives checking.",
    steps: [
      { at: "02", step: "Source analysis", text: "The publisher's family and upstream origin are resolved." },
      { at: "03", step: "Claim detected", text: "An atomic claim is separated from the surrounding coverage." },
      { at: "04", step: "Cross-source comparison", text: "Independent families are weighed; syndicated copies count once." },
      { at: "05", step: "Primary-source search", text: "Original footage, documents or statements are sought first." },
      { at: "05", step: "Context check", text: "Date, place and translation are tested for recycled or stripped context." },
      { at: "06", step: "Evidence assessment", text: "Ten confidence dimensions are scored; unknown gaps are written down." },
      { at: "07", step: "Verdict with confidence", text: "A summary verdict publishes with its evidence chain — never a bare true/false." },
    ],
  },
] as const;
