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

/** The eight-step signal-to-intelligence journey shown in the story section. */
export const SIGNAL_JOURNEY: readonly { step: string; text: string }[] = [
  { step: "Detected", text: "A post or article is collected from a monitored source." },
  { step: "Attributed", text: "Its publisher, URL, retrieval time and source family are recorded." },
  { step: "Extracted", text: "The atomic claim is separated from commentary around it." },
  { step: "Clustered", text: "Copies of the same report merge under one origin; volume cannot pose as corroboration." },
  { step: "Verified", text: "The claim is checked across sources against primary material." },
  { step: "Scored", text: "Confidence is assessed across ten dimensions, gaps stated in writing." },
  { step: "Gated", text: "A second human — or twelve automated checks with run provenance — must approve." },
  { step: "Published", text: "The finding joins the public record, versioned and correctable." },
] as const;

/** The verification flow for a suspicious claim. */
export const CLAIM_FLOW: readonly { step: string; text: string }[] = [
  { step: "Claim detected", text: "An atomic claim is separated from the surrounding coverage." },
  { step: "Source analysis", text: "The publisher's family and upstream origin are resolved." },
  { step: "Primary-source search", text: "Original footage, documents or statements are sought first." },
  { step: "Cross-source comparison", text: "Independent families are weighed; syndicated copies count once." },
  { step: "Context check", text: "Date, place and translation are tested for recycled or stripped context." },
  { step: "Evidence assessment", text: "Ten confidence dimensions are scored; unknown gaps are written down." },
  { step: "Verdict with confidence", text: "A summary verdict publishes with its evidence chain — never a bare true/false." },
] as const;
