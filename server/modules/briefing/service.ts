import "server-only";

import { z } from "zod";
import { ApiError } from "@/server/http/responses";
import { appEnv, assertBriefingResourceIsolation, briefingAiBudgets, briefingFeatures, briefingStageEnabled } from "@/server/core/config";
import { integrityHash } from "@/server/core/hash";
import { briefingLog } from "@/server/core/log";
import {
  generateStructured,
  type GenerateInput,
  type StructuredGenerateOutput,
} from "@/server/core/ai/gateway";
import { aiRepo } from "@/server/modules/ai/repo";
import { recordBriefingRun } from "@/server/modules/ai";
import { itemService } from "@/server/modules/items/service";
import { itemEvidenceService } from "@/server/modules/assessments/service";
import { narrativeService } from "@/server/modules/narratives/service";
import { publicationService } from "@/server/modules/publications/service";
import { briefingRepo, type BriefingEvidence } from "./repo";
import { type DraftPassage } from "./quality";
import type { Actor } from "@/server/core/audit";
import {
  ANALYSIS_AUTHOR,
  evidenceBasisSchema,
  narrativeWatchTitle,
  type CreatePublication,
  type EvidenceBasis,
} from "@/server/contracts/publication";
import {
  WRITABLE_PUBLICATION_SECTIONS,
  type PublicationSection,
  type WritablePublicationSection,
} from "@/server/contracts/enums";
import { enrichEvidenceWindow } from "@/server/modules/sources/enrich";

/**
 * What the model may select.
 *
 * `war_update` was removed on 2026-09-01: security and war material now feeds
 * the Daily Brief instead of becoming a standalone article, so the model can
 * no longer route a story there. The value stays in `PUBLICATION_SECTIONS` and
 * in the Postgres enum on purpose — historic rows must remain legal.
 */
const ARTICLE_SECTIONS = ["israel_update", "narrative_watch"] as const;

/**
 * Sections a *stored* artifact may carry.
 *
 * The stages of one edition are separate runs and can straddle a deploy. An
 * artifact written while `war_update` was still selectable must therefore
 * still parse on the way back in, or the edition quarantines for no editorial
 * reason at all. Nothing writes the legacy value any more; this only reads it.
 */
const STORED_ARTICLE_SECTIONS = ["israel_update", "war_update", "narrative_watch"] as const;
const PIPELINE_STAGES = ["enrich", "cluster", "triage", "draft", "publish"] as const;
export type EditorialStage = (typeof PIPELINE_STAGES)[number];

/**
 * Read tolerance stops at the write.
 *
 * A stored artifact drafted while `war_update` was still selectable parses on
 * the way back in, but the pipeline builds publication *inputs* from that
 * artifact without ever crossing the HTTP boundary — so the narrowed write
 * contract in the route schemas would never see it. This guard is the write
 * gate for that path: a retired section reaching the publish stage is a
 * defect (docs/briefing-operations.md), and it fails the stage loudly so the
 * edition quarantines instead of silently skipping the article or writing the
 * row anyway.
 */
function assertWritableSection(candidate: string, section: PublicationSection): asserts section is WritablePublicationSection {
  if (!(WRITABLE_PUBLICATION_SECTIONS as readonly string[]).includes(section)) {
    throw new ApiError(
      "VALIDATION_ERROR",
      `Candidate ${candidate} carries section "${section}", which is retired from production and may no longer be written.`,
    );
  }
}

const evidenceLinkSchema = z.object({
  evidenceId: z.uuid(),
  relation: z.enum(["supports", "partially_supports", "contradicts", "contextualizes"]),
  strength: z.enum(["strong", "adequate", "weak", "contextual"]),
  rationale: z.string().min(1).max(2_000),
});

const claimSchema = z.object({
  title: z.string().min(1).max(300),
  text: z.string().min(1).max(4_000),
  layer: z.enum(["source_claim", "observed_fact", "model_inference", "editorial_conclusion"]),
  assessment: z.enum(["verified", "refuted", "misleading", "unsupported", "disputed", "unresolved"]),
  attributedTo: z.string().min(1).max(300).nullable(),
  uncertainty: z.string().min(1).max(2_000).nullable(),
  evidenceLinks: z.array(evidenceLinkSchema).min(1).max(8),
});

const passageSchema = z.object({
  text: z.string().min(40).max(6_000),
  // This is intentionally local to the enclosing Daily Brief or article.  A
  // global index across the edition would silently sever a paragraph from the
  // claim it is meant to substantiate.
  claimIndex: z.number().int().min(0).max(99).describe("Zero-based index into the claims array of this same Daily Brief or this same article; never a global edition or evidence index."),
  evidenceIds: z.array(z.uuid()).min(1).max(8),
});

/* Article-local relaxations of the two shared shapes above. A `superRefine`
 * runs *after* the shape parse, so it cannot lift an inner `.min(1)`: the
 * floor has to come off here and be re-imposed conditionally below. These
 * exist only for articles — `dailyBriefSchema` and `dailySectionSchema` keep
 * the strict `claimSchema` and `passageSchema`, because the Daily Brief is
 * always a sourced report and there is no unsourced path into it. */
const articleClaimSchema = claimSchema.extend({
  evidenceLinks: z.array(evidenceLinkSchema).max(8),
});

const articlePassageSchema = passageSchema.extend({
  evidenceIds: z.array(z.uuid()).max(8),
});

const narrativeWatchDraftSchema = z.object({
  exactClaim: z.string().min(1).max(4_000),
  propagators: z.array(z.string().min(1).max(300)).max(20),
  arenas: z.array(z.string().min(1).max(120)).min(1).max(20),
  trendDirection: z.enum(["rising", "stable", "declining", "new", "unclear"]),
  israeliPosition: z.string().min(1).max(6_000).nullable().default(null),
  securityContext: z.string().min(1).max(6_000).nullable().default(null),
  supportingEvidenceIds: z.array(z.uuid()).max(30),
  contradictingEvidenceIds: z.array(z.uuid()).max(30),
  verificationState: z.enum(["verified", "refuted", "misleading", "unsupported", "disputed", "unresolved"]),
  knownUnknowns: z.array(z.string().min(1).max(1_000)).max(20),
});

const articleShape = {
  section: z.enum(ARTICLE_SECTIONS),
  title: z.string().min(1).max(300),
  summary: z.string().min(1).max(1_200),
  evidenceIds: z.array(z.uuid()).max(20).describe(
    "Every source this article rests on. Normally at least one. The single exception is a narrative_watch refutation published as this organisation's own analysis, which must leave this array empty AND cite nothing anywhere else — no claim evidenceLinks, no passage evidenceIds, no narrativeWatchDetails supporting or contradicting IDs. Any other section with an empty array is rejected.",
  ),
  claims: z.array(articleClaimSchema).min(1).max(20),
  passages: z.array(articlePassageSchema).min(2).max(30),
  narrativeTitle: z.string().min(1).max(300).nullable().default(null),
  editorialTopic: z.string().min(1).max(120),
  primaryActor: z.string().min(1).max(160).nullable().default(null),
  arena: z.string().min(1).max(120),
  featuredIsraelStory: z.boolean(),
  narrativeWatchDetails: narrativeWatchDraftSchema.nullable().default(null),
} as const;

export const articleSchema = z.object(articleShape).superRefine((article, ctx) => {
  if ((article.section === "narrative_watch") !== Boolean(article.narrativeWatchDetails)) {
    ctx.addIssue({ code: "custom", path: ["narrativeWatchDetails"], message: "Narrative Watch requires structured monitoring details only." });
  }
  /* Derived here exactly as it is derived everywhere else. An article citing
   * nothing is the organisation's own analysis; nothing else may be. */
  const analysis = article.evidenceIds.length === 0;
  if (analysis && article.section !== "narrative_watch") {
    ctx.addIssue({
      code: "custom",
      path: ["evidenceIds"],
      message: "Only a narrative_watch refutation may cite no evidence. Every other section must cite the source material it reports.",
    });
  }
  if (analysis) {
    /* All or nothing. A half-sourced article — citing nothing at the top while
     * its claims and paragraphs still point at evidence — is how a piece would
     * launder sourced material into an unsourced record that seven quality
     * checks then treat leniently. Both this refine and `claim_evidence_matrix`
     * reject it, so neither can drift into permitting it alone. */
    const citesAnything = article.claims.some((claim) => claim.evidenceLinks.length > 0)
      || article.passages.some((passage) => passage.evidenceIds.length > 0)
      || (article.narrativeWatchDetails?.supportingEvidenceIds.length ?? 0) > 0
      || (article.narrativeWatchDetails?.contradictingEvidenceIds.length ?? 0) > 0;
    if (citesAnything) {
      ctx.addIssue({
        code: "custom",
        path: ["evidenceIds"],
        message: "An article published as this organisation's own analysis must cite nothing anywhere: leave claim evidenceLinks, passage evidenceIds, and the narrative watch supporting and contradicting evidence lists empty. If the article does rest on sources, list them in evidenceIds as well.",
      });
    }
    return;
  }
  for (const [index, claim] of article.claims.entries()) {
    if (!claim.evidenceLinks.length) {
      ctx.addIssue({
        code: "custom",
        path: ["claims", index, "evidenceLinks"],
        message: "Every claim in a sourced article needs at least one explained evidence edge.",
      });
    }
  }
  for (const [index, passage] of article.passages.entries()) {
    if (!passage.evidenceIds.length) {
      ctx.addIssue({
        code: "custom",
        path: ["passages", index, "evidenceIds"],
        message: "Every paragraph in a sourced article must cite the evidence supporting it.",
      });
    }
  }
});

/**
 * The persisted shape: what the model returned, plus the evidence basis the
 * normaliser derives and stamps on.
 *
 * It is deliberately absent from `articleSchema`, which is what
 * `toJSONSchema` shows the model. The draft retry loop feeds every quality
 * failure string back into attempt two, so a model-visible flag that switches
 * off seven evidence checks is a gradient pointed straight at itself. Keeping
 * the field out of the request and re-adding it here is also what lets the
 * value survive `draftArtifactSchema.parse()` — zod strips unknown keys, so a
 * basis stamped onto a shape that does not declare it would be silently lost
 * between the draft stage and the quality stage.
 */
const storedArticleSchema = z.object({
  ...articleShape,
  section: z.enum(STORED_ARTICLE_SECTIONS),
  narrativeWatchDetails: narrativeWatchDraftSchema
    .extend({ evidenceBasis: evidenceBasisSchema })
    .nullable(),
});

const dailySectionSchema = z.object({
  label: z.string().min(1).max(80),
  passages: z.array(passageSchema).min(1).max(10),
});

const dailyBriefSchema = z.object({
  title: z.string().min(1).max(300),
  summary: z.string().min(1).max(1_200),
  evidenceIds: z.array(z.uuid()).min(1).max(40),
  claims: z.array(claimSchema).min(1).max(30),
  situation: dailySectionSchema,
  keyEvents: dailySectionSchema,
  israeliPosition: dailySectionSchema.nullable().default(null),
  internationalResponses: dailySectionSchema.nullable().default(null),
  watchPoints: dailySectionSchema,
});

const editionSchema = z.object({
  dailyBrief: dailyBriefSchema,
  articles: z.array(articleSchema).max(8),
});

/** The edition as normalised, stored and re-read. See `storedArticleSchema`. */
const storedEditionSchema = z.object({
  dailyBrief: dailyBriefSchema,
  articles: z.array(storedArticleSchema).max(8),
});

const selectionStorySchema = z.object({
  title: z.string().min(1).max(300),
  section: z.enum(ARTICLE_SECTIONS),
  // Triage is an untrusted routing stage. Let it return malformed identifiers
  // so the explicit grounding filter below can discard only those references
  // while preserving a story's valid packet IDs. Drafting remains UUID-strict.
  evidenceIds: z.array(z.string().trim().min(1).max(100)).min(1).max(12),
  sourceClaim: z.string().min(1).max(2_000),
  narrativeTitle: z.string().min(1).max(300).nullable(),
});

const selectionSchema = z.object({
  stories: z.array(selectionStorySchema).max(8),
});

const enrichArtifactSchema = z.object({ evidenceIds: z.array(z.uuid()), collectedThrough: z.string() });
const clusterArtifactSchema = z.object({
  clusters: z.array(z.object({ key: z.string(), title: z.string(), evidenceIds: z.array(z.uuid()).min(1) })),
});
const triageArtifactSchema = z.object({
  stories: z.array(selectionStorySchema.extend({ section: z.enum(STORED_ARTICLE_SECTIONS) })).max(8),
  aiRunId: z.uuid(),
});
const draftArtifactSchema = z.object({ edition: storedEditionSchema, aiRunId: z.uuid() });
type DraftArticle = z.infer<typeof articleSchema>;
type StoredArticle = z.infer<typeof storedArticleSchema>;
type StoredEdition = z.infer<typeof storedEditionSchema>;
type DraftDailyBrief = z.infer<typeof dailyBriefSchema>;
type DraftContent = Pick<DraftArticle, "title" | "summary" | "evidenceIds" | "claims" | "passages">;

type Generator = <T>(input: GenerateInput & { schema: z.ZodType<T> }) => Promise<StructuredGenerateOutput<T>>;
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };

export const BRIEFING_CONTRACT_VERSION = "briefing-contract-v4";
export const BRIEFING_PROMPT_VERSION = "briefing-editorial-v4";
const MACHINE_AUTHOR = "machine:daily-brief-pipeline";

export type BriefingRunResult = {
  status: "completed" | "already_run" | "skipped";
  localDate: string;
  evidenceCount: number;
  publications: number;
  publicationMode?: "draft" | "automatic";
  reason?: string;
};

export type BriefingStageResult = {
  stage: EditorialStage;
  status: "completed" | "already_run" | "skipped";
  shouldContinue: boolean;
  inputCount: number;
  outputCount: number;
  reason?: string;
  publicationMode?: "draft" | "automatic";
};

/** Briefing spend is deliberately separate from chat. Keep the guard pure so
 * its exact ceiling behaviour is tested without invoking a model or queue. */
export type BriefingSpendReader = (since: Date) => Promise<number>;

export async function assertBriefingWithinBudget(
  spendSince: BriefingSpendReader,
  now = new Date(),
): Promise<void> {
  const budget = briefingAiBudgets();
  const timestamp = now.getTime();
  const [daily, monthly] = await Promise.all([
    spendSince(new Date(timestamp - 24 * 60 * 60 * 1_000)),
    spendSince(new Date(timestamp - 30 * 24 * 60 * 60 * 1_000)),
  ]);
  if (daily >= budget.daily || monthly >= budget.monthly) {
    throw new ApiError("RATE_LIMITED", "The briefing-specific AI budget is exhausted.");
  }
}

export function israelLocalDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric", month: "2-digit", day: "2-digit",
  }).format(now);
}

export function israelLocalHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit", hourCycle: "h23",
  }).format(now));
}

export function nextEditorialStage(stage: EditorialStage): EditorialStage | null {
  const index = PIPELINE_STAGES.indexOf(stage);
  return PIPELINE_STAGES[index + 1] ?? null;
}

export function briefingService(database: unknown, options: { generate?: Generator; now?: () => Date } = {}) {
  const generate = options.generate ?? generateStructured;
  const now = options.now ?? (() => new Date());
  const store = briefingRepo(database);

  async function assertBudget(): Promise<void> {
    const repo = aiRepo(database);
    await assertBriefingWithinBudget((since) => repo.briefingSpendSince(since), now());
  }

  /** The exact packet the enrich stage closed over. Read by id: the cluster,
   * triage, draft and quality stages all call this, and a time-windowed read
   * silently loses rows on a late retry or a high-volume day. */
  async function evidenceForArtifact(editionId: string): Promise<BriefingEvidence[]> {
    const artifact = enrichArtifactSchema.parse(await requiredArtifact(store, editionId, "enrich"));
    return store.recentEvidenceByIds(artifact.evidenceIds);
  }

  async function runStage(
    stage: EditorialStage,
    localDate: string,
    actor: Actor,
    requestId?: string,
  ): Promise<BriefingStageResult> {
    const features = briefingFeatures();
    if (!features.processing) {
      return { stage, status: "skipped", shouldContinue: false, inputCount: 0, outputCount: 0, reason: "processing_paused" };
    }
    if (!briefingStageEnabled(stage)) {
      return { stage, status: "skipped", shouldContinue: false, inputCount: 0, outputCount: 0, reason: "stage_paused" };
    }
    if (appEnv() === "preview") {
      return { stage, status: "skipped", shouldContinue: false, inputCount: 0, outputCount: 0, reason: "preview_dry_run" };
    }
    assertBriefingResourceIsolation();
    const editionId = await store.ensureEdition(localDate, BRIEFING_CONTRACT_VERSION, BRIEFING_PROMPT_VERSION);
    const runId = await store.acquire(localDate, stage);
    if (!runId) {
      return { stage, status: "already_run", shouldContinue: false, inputCount: 0, outputCount: 0 };
    }

    try {
      let result: Omit<BriefingStageResult, "stage" | "status">;
      switch (stage) {
        case "enrich":
          result = await enrich(editionId, actor, requestId);
          break;
        case "cluster":
          result = await cluster(editionId);
          break;
        case "triage":
          result = await triage(editionId, runId, localDate, actor);
          break;
        case "draft":
          result = await draft(editionId, runId, localDate, actor);
          break;
        case "publish":
          result = await publish(editionId, runId, localDate, actor, requestId);
          break;
      }
      await store.complete(runId, result.inputCount, result.outputCount);
      return { stage, status: result.reason ? "skipped" : "completed", ...result };
    } catch (cause) {
      await store.fail(runId, 0, cause instanceof Error ? cause.message : "Unknown briefing error");
      await store.markEdition(localDate, cause instanceof ApiError && cause.code === "VALIDATION_ERROR" ? "quarantined" : "failed");
      throw cause;
    }
  }

  async function enrich(editionId: string, actor: Actor, requestId?: string): Promise<Omit<BriefingStageResult, "stage" | "status">> {
    const discovered = await store.recentEvidence(new Date(now().getTime() - 36 * 60 * 60 * 1_000), 120);
    /* A row stays inside the 36-hour window for two consecutive daily runs, so
     * fetching on `usableTextLength` alone re-fetched every genuinely short
     * article a second time. Skip whatever the enrich stage has already been
     * to. `retrieval_status` cannot answer this — ingestion writes `fetched`
     * for any feed item that arrived with an excerpt, so filtering on it would
     * also skip the first, real fetch of most RSS rows. */
    const short = discovered.filter((entry) => entry.usableTextLength < 1_000);
    const alreadyFetched = await store.enrichedEvidenceIds(short.map((entry) => entry.id));
    await enrichEvidenceWindow(database, short.filter((entry) => !alreadyFetched.has(entry.id)), actor, requestId);
    const evidence = await store.recentEvidence(new Date(now().getTime() - 36 * 60 * 60 * 1_000), 120);
    await store.saveArtifact(editionId, "enrich", integrityHash(evidence.map((entry) => entry.id).join("|")), {
      evidenceIds: evidence.map((entry) => entry.id),
      collectedThrough: now().toISOString(),
    });
    if (!evidence.length) {
      return { shouldContinue: false, inputCount: 0, outputCount: 0, reason: "no_processable_evidence" };
    }
    return { shouldContinue: true, inputCount: evidence.length, outputCount: evidence.length };
  }

  async function cluster(editionId: string): Promise<Omit<BriefingStageResult, "stage" | "status">> {
    const evidence = (await evidenceForArtifact(editionId)).filter(isProcessableEvidence);
    const clusters = clusterEvidence(evidence);
    await store.recordStoryClusters(editionId, clusters, new Map(evidence.map((entry) => [entry.id, entry])));
    await store.saveArtifact(editionId, "cluster", integrityHash(JSON.stringify(clusters)), { clusters });
    return clusters.length
      ? { shouldContinue: true, inputCount: evidence.length, outputCount: clusters.length }
      : { shouldContinue: false, inputCount: evidence.length, outputCount: 0, reason: "no_story_clusters" };
  }

  async function triage(
    editionId: string,
    runId: string,
    localDate: string,
    actor: Actor,
  ): Promise<Omit<BriefingStageResult, "stage" | "status">> {
    await assertBudget();
    const evidence = (await evidenceForArtifact(editionId)).filter(isProcessableEvidence);
    const clusters = clusterArtifactSchema.parse(await requiredArtifact(store, editionId, "cluster"));
    const evidenceById = new Map(evidence.map((entry) => [entry.id, entry]));
    const output = await generate({
      profile: "briefingTriage",
      kind: "classify",
      dataClass: "public",
      maxOutputTokens: 8_000,
      tags: ["feature:briefing", "stage:triage", `contract:${BRIEFING_CONTRACT_VERSION}`],
      schema: selectionSchema,
      system: TRIAGE_SYSTEM,
      prompt: `Israel-local editorial date: ${localDate}\n\nStory clusters:\n${JSON.stringify(clusters.clusters)}\n\nPublic evidence packet:\n${sourcePacket(evidence)}`,
    });
    // A triage response can contain one hallucinated UUID alongside otherwise
    // grounded selections. Drop only unknown references; any story left with
    // no evidence is discarded below. Drafting still rejects every unknown ID.
    const groundedStories = output.output.stories.map((story) => ({
      ...story,
      evidenceIds: story.evidenceIds.filter((id) => evidenceById.has(id)),
    }));
    // A single usable publisher is enough to create an attributed draft.  The
    // source-family count remains visible to quality and must never be
    // described as independent corroboration, but requiring two families at
    // triage would discard ordinary news updates before the editor can label
    // them as a single-source report with appropriate uncertainty.
    const stories = normalizeTriageStories(
      groundedStories.filter((story) => storyHasCitableSupport(story.evidenceIds, evidenceById)),
      evidenceById,
    );
    const aiRunId = await recordBriefingRun(database, {
      kind: "classify",
      model: output.model,
      modelProfile: "briefing_triage",
      inputTokens: output.inputTokens,
      outputTokens: output.outputTokens,
      inputHash: output.inputHash,
      costUsd: output.costUsd,
      latencyMs: output.latencyMs,
      actor,
    });
    await store.linkAiRun(runId, aiRunId, "triage");
    await store.saveArtifact(editionId, "triage", output.inputHash, { stories, aiRunId });
    briefingLog("info", "briefing.model.completed", {
      requestId: undefined, runId, stage: "triage", editionId, provider: "ai_gateway", model: output.model,
    }, { aiRunId, inputTokens: output.inputTokens, outputTokens: output.outputTokens, costUsd: output.costUsd, latencyMs: output.latencyMs });
    return stories.length
      ? { shouldContinue: true, inputCount: clusters.clusters.length, outputCount: stories.length }
      : { shouldContinue: false, inputCount: clusters.clusters.length, outputCount: 0, reason: "no_eligible_stories" };
  }

  async function draft(
    editionId: string,
    runId: string,
    localDate: string,
    actor: Actor,
  ): Promise<Omit<BriefingStageResult, "stage" | "status">> {
    await assertBudget();
    const evidence = (await evidenceForArtifact(editionId)).filter(isProcessableEvidence);
    const triaged = triageArtifactSchema.parse(await requiredArtifact(store, editionId, "triage"));
    const selectedEvidenceIds = new Set(triaged.stories.flatMap((story) => story.evidenceIds));
    const selectedEvidence = evidence.filter((entry) => selectedEvidenceIds.has(entry.id));
    const evidenceById = new Map(selectedEvidence.map((entry) => [entry.id, entry]));
    /* A refutation is an addition to a normal edition, never a substitute for
     * one: the Daily Brief is structurally required, and without a citable
     * story there is nothing to build it from. This stop stands unchanged. */
    if (!selectedEvidence.length) {
      return { shouldContinue: false, inputCount: 0, outputCount: 0, reason: "no_citable_supported_stories" };
    }
    /* Refutation targets come from the recorded narrative backlog rather than
     * from the model's own idea of what is being said about Israel. The
     * pipeline writes a narrative row for every narrative_watch article it
     * publishes, so this is the same monitoring record read back. */
    const openNarratives = (await narrativeService(database).listNarratives({ limit: 25 }))
      .filter((entry) => entry.status === "emerging" || entry.status === "active")
      .slice(0, 1)
      .map((entry) => ({
        title: entry.title,
        summary: entry.summary,
        status: entry.status,
        observationCount: entry.observationCount,
        lastSeenAt: entry.lastSeenAt?.toISOString() ?? null,
      }));
    const refutationTargets = openNarratives.length
      ? JSON.stringify(openNarratives)
      : "None recorded. Write a narrative_watch refutation only if the evidence packet itself carries an anti-Israel claim worth answering.";
    const basePrompt = `Israel-local editorial date: ${localDate}\n\nSelected stories:\n${JSON.stringify(triaged.stories)}\n\nRefutation targets:\n${refutationTargets}\n\nPublic evidence packet:\n${sourcePacket(selectedEvidence)}`;
    let output: StructuredGenerateOutput<z.infer<typeof editionSchema>> | undefined;
    let edition: StoredEdition | undefined;
    let schemaFeedback = "";
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      let candidate: StructuredGenerateOutput<z.infer<typeof editionSchema>>;
      try {
        candidate = await generate({
          profile: "briefingDraft",
          kind: "summarize",
          dataClass: "public",
          /* The edition is structured and can contain several articles. Give
           * the gateway enough time to emit valid JSON while keeping the total
           * response below the function's five-minute ceiling. Concise output
           * also leaves room for a deterministic second quality rewrite. */
          maxOutputTokens: 10_000,
          timeoutMs: 120_000,
          tags: ["feature:briefing", "stage:draft", `attempt:${attempt}`, `contract:${BRIEFING_CONTRACT_VERSION}`],
          schema: editionSchema,
          system: DRAFT_SYSTEM,
          prompt: `${basePrompt}${schemaFeedback}`,
        });
      } catch (cause) {
        /* `generateStructured` throws when the response fails the schema, and
         * the article refine is now part of that schema. A refine violation is
         * exactly the kind of mistake the second attempt exists to fix, so it
         * feeds the retry like any quality failure instead of quarantining the
         * edition. Everything else — budget, timeout, transport — still fails
         * immediately, because a second call would not fix it. */
        const retryable = cause instanceof ApiError && cause.code === "VALIDATION_ERROR";
        if (!retryable || attempt === 2) throw cause;
        schemaFeedback = `\n\nThe previous response did not match the required data structure. Return the complete edition again and correct this exact error:\n${cause.message}`;
        continue;
      }
      const normalized = normalizeEditionForPublication(
        limitEditionArticles(normalizeFeaturedIsraelStory(candidate.output)),
        evidenceById,
      );
      validateDraftEvidence(normalized, evidenceById);
      output = candidate;
      edition = normalized;
      break;
    }
    if (!output || !edition) throw new ApiError("VALIDATION_ERROR", "The drafting model did not produce a valid edition.");
    const aiRunId = await recordBriefingRun(database, {
      kind: "summarize",
      model: output.model,
      modelProfile: "briefing_draft",
      inputTokens: output.inputTokens,
      outputTokens: output.outputTokens,
      inputHash: output.inputHash,
      costUsd: output.costUsd,
      latencyMs: output.latencyMs,
      actor,
    });
    await store.linkAiRun(runId, aiRunId, "draft");
    await store.saveArtifact(editionId, "draft", output.inputHash, { edition, aiRunId });
    briefingLog("info", "briefing.model.completed", {
      requestId: undefined, runId, stage: "draft", editionId, provider: "ai_gateway", model: output.model,
    }, { aiRunId, inputTokens: output.inputTokens, outputTokens: output.outputTokens, costUsd: output.costUsd, latencyMs: output.latencyMs });
    return { shouldContinue: true, inputCount: triaged.stories.length, outputCount: edition.articles.length + 1 };
  }

  async function publish(
    editionId: string,
    runId: string,
    localDate: string,
    actor: Actor,
    requestId?: string,
  ): Promise<Omit<BriefingStageResult, "stage" | "status">> {
    const drafted = draftArtifactSchema.parse(await requiredArtifact(store, editionId, "draft"));
    const features = briefingFeatures();
    const control = await store.control();
    const automaticPublication = features.autoPublish && !control.automaticPublicationPaused;

    /* Materialisation and publication share one transaction. The previous
     * implementation created claims and narratives in separate transactions
     * before inserting the edition, so a retry after a late failure could
     * leave orphaned duplicate reasoning records. This adapter reuses the
     * existing policy services without opening nested connections. */
    const runner = database as Runner;
    return runner.transaction(async (tx) => {
      const transactionDb: Runner = {
        transaction: async <T>(fn: (inner: unknown) => Promise<T>) => fn(tx),
      };
      const txStore = briefingRepo(tx);
      const itemWriter = itemService(transactionDb);
      const evidenceWriter = itemEvidenceService(transactionDb);
      const narrativeWriter = narrativeService(transactionDb);
      const publicationWriter = publicationService(transactionDb);

      const materializeClaims = async (claims: z.infer<typeof claimSchema>[]) => {
      const claimItems = [];
      for (const claim of claims) {
        const item = await itemWriter.autoCreate({
          type: "claim",
          title: claim.title,
          canonicalText: claim.text,
          summary: `${claim.assessment}: machine classification from linked public source material.`,
          language: "en",
        }, actor, requestId);
        await txStore.recordClaim(item.id, claim, drafted.aiRunId);
        for (const link of claim.evidenceLinks) await evidenceWriter.link(item.id, link, actor, requestId);
        claimItems.push(item);
      }
        return claimItems;
      };

    const dailyContent = dailyAsContent(drafted.edition.dailyBrief);
    const dailyItems = await materializeClaims(dailyContent.claims);
    const articleItems = new Map<number, Awaited<ReturnType<typeof materializeClaims>>>();
    for (const [index, article] of drafted.edition.articles.entries()) {
      articleItems.set(index, await materializeClaims(article.claims));
    }

    const narrativeIds = new Map<string, string>();
    for (const [index, article] of drafted.edition.articles.entries()) {
      if (article.section !== "narrative_watch" || !article.narrativeTitle) continue;
      const narrative = await narrativeWriter.autoCreateNarrative({
        // A numbered slot is not a narrative identity: forced same-day
        // regeneration can select a different claim in the same position.
        // Tie the durable public key to the claim title instead, allowing an
        // unchanged recurring narrative to refresh while a new one is added.
        slug: `${localDate}-narrative-${integrityHash(article.narrativeTitle).slice(0, 12)}`,
        title: article.narrativeTitle,
        summary: `Monitored in the automated daily briefing for ${localDate}.`,
        language: "en",
      }, actor, requestId);
      for (const item of articleItems.get(index) ?? []) {
        await narrativeWriter.linkItem(narrative.id, {
          itemId: item.id,
          rationale: "This source-attributed atomic claim forms part of the monitored narrative.",
        }, actor);
      }
      for (const evidenceId of article.evidenceIds) {
        await narrativeWriter.observe(narrative.id, {
          evidenceId,
          platform: article.arena,
          note: `Observed in the closed source packet for ${localDate}; no actor attribution was inferred.`,
        }, actor);
      }
      narrativeIds.set(article.narrativeTitle, narrative.id);
    }

    const inputs: CreatePublication[] = [{
      kind: "brief",
      section: "daily_brief",
      title: drafted.edition.dailyBrief.title,
      summary: drafted.edition.dailyBrief.summary,
      body: dailyBody(drafted.edition.dailyBrief),
      language: "en",
      itemIds: dailyItems.map((item) => item.id),
      evidenceIds: drafted.edition.dailyBrief.evidenceIds,
      passages: publicationPassages(dailyContent.passages, dailyItems),
    }, ...drafted.edition.articles.map((article, index) => {
      assertWritableSection(`article-${index}`, article.section);
      return {
        kind: "news_update" as const,
        section: article.section,
        title: article.title,
        summary: article.summary,
        body: bodyFromPassages(article.passages),
        language: "en",
        itemIds: (articleItems.get(index) ?? []).map((item) => item.id),
        evidenceIds: article.evidenceIds,
        passages: publicationPassages(article.passages, articleItems.get(index) ?? []),
        narrativeIds: article.section === "narrative_watch" && article.narrativeTitle
          ? [narrativeIds.get(article.narrativeTitle)!]
          : undefined,
        editorialTopic: article.editorialTopic,
        primaryActor: article.primaryActor ?? undefined,
        arena: article.arena,
        featuredIsraelStory: article.featuredIsraelStory,
        narrativeWatchDetails: article.narrativeWatchDetails ?? undefined,
      };
    })];

    const candidateKeys = inputs.map((_, index) => index === 0 ? "daily-brief" : `article-${index}`);
    const created = automaticPublication
      ? await publicationWriter.autoPublishMany(inputs, {
          briefingRunId: runId,
          machineAuthor: MACHINE_AUTHOR,
          candidateKeys,
          supersedeLocalDate: await store.editionByDate(localDate).then((edition) =>
            edition?.publishedAt ? localDate : undefined),
        }, actor, requestId)
      : await publicationWriter.createMany(inputs, actor, requestId, {
          briefingRunId: runId,
          machineAuthor: MACHINE_AUTHOR,
          candidateKeys,
        });
      if (automaticPublication) await txStore.markEdition(localDate, "published");
      return {
        shouldContinue: false,
        inputCount: inputs.length,
        outputCount: created.length,
        publicationMode: automaticPublication ? "automatic" : "draft",
      };
    });
  }

  async function run(actor: Actor, requestId?: string): Promise<BriefingRunResult> {
    const localDate = israelLocalDate(now());
    let evidenceCount = 0;
    for (const stage of PIPELINE_STAGES) {
      const result = await runStage(stage, localDate, actor, requestId);
      if (stage === "enrich") evidenceCount = result.inputCount;
      if (result.status === "already_run" && stage !== "publish") continue;
      if (!result.shouldContinue) {
        return {
          status: result.status,
          localDate,
          evidenceCount,
          publications: stage === "publish" ? result.outputCount : 0,
          publicationMode: result.publicationMode,
          reason: result.reason,
        };
      }
    }
    return { status: "completed", localDate, evidenceCount, publications: 0 };
  }

  /** Complete the recovery path for an edition produced while publication was paused. */
  async function resumePausedEdition(actor: Actor, requestId?: string): Promise<BriefingRunResult> {
    const localDate = israelLocalDate(now());
    const features = briefingFeatures();
    const control = await store.control();
    if (!features.autoPublish || control.automaticPublicationPaused) {
      return { status: "skipped", localDate, evidenceCount: 0, publications: 0, reason: "automatic_publication_paused" };
    }
    const edition = await store.editionByDate(localDate);
    if (!edition) return { status: "skipped", localDate, evidenceCount: 0, publications: 0, reason: "no_edition" };
    const publishRun = await store.runByDateStage(localDate, "publish");
    if (!publishRun) return { status: "skipped", localDate, evidenceCount: 0, publications: 0, reason: "no_publish_run" };
    const drafted = draftArtifactSchema.parse(await requiredArtifact(store, edition.id, "draft"));
    const inputs: CreatePublication[] = [{
      kind: "brief",
      section: "daily_brief",
      title: drafted.edition.dailyBrief.title,
      summary: drafted.edition.dailyBrief.summary,
      body: dailyBody(drafted.edition.dailyBrief),
      language: "en",
    }, ...drafted.edition.articles.map((article, index) => {
      assertWritableSection(`article-${index}`, article.section);
      return {
        kind: "news_update" as const,
        section: article.section,
        title: article.title,
        summary: article.summary,
        body: bodyFromPassages(article.passages),
        language: "en",
      };
    })];
    const writer = publicationService(database);
    const candidateKeys = inputs.map((_, index) => index === 0 ? "daily-brief" : `article-${index}`);
    const published = await writer.resumeGeneratedDrafts(inputs, {
      briefingRunId: publishRun.id,
      machineAuthor: MACHINE_AUTHOR,
      candidateKeys,
    }, actor, requestId);
    await store.markEdition(localDate, "published");
    return {
      status: "completed",
      localDate,
      evidenceCount: 0,
      publications: published.length,
      publicationMode: "automatic",
    };
  }

  /** Authenticated editorial preview of the persisted draft artifact. This is
   * intentionally separate from public publication projections: a failed or
   * in-progress edition must remain reviewable by the administrator without
   * becoming visible to readers. */
  async function draftPreview(localDate = israelLocalDate(now())) {
    const edition = await store.editionByDate(localDate);
    if (!edition) throw new ApiError("NOT_FOUND", "Briefing edition was not found.");
    const drafted = draftArtifactSchema.parse(await requiredArtifact(store, edition.id, "draft"));
    return {
      localDate,
      dailyBrief: {
        title: drafted.edition.dailyBrief.title,
        summary: drafted.edition.dailyBrief.summary,
        body: dailyBody(drafted.edition.dailyBrief),
      },
      articles: drafted.edition.articles.map((article) => ({
        section: article.section,
        title: article.title,
        summary: article.summary,
        body: bodyFromPassages(article.passages),
      })),
    };
  }

  return {
    run,
    runStage,
    resumePausedEdition,
    draftPreview,
    setAutomaticPublicationPaused: (paused: boolean, actor: Actor) =>
      store.setAutomaticPublicationPaused(paused, actor.label),
    runScheduled: async (actor: Actor, requestId?: string) =>
      israelLocalHour(now()) === 7
        ? run(actor, requestId)
        : ({ status: "skipped", localDate: israelLocalDate(now()), evidenceCount: 0, publications: 0, reason: "outside_schedule" } satisfies BriefingRunResult),
    summary: () => store.summary(),
  };
}

async function requiredArtifact(store: ReturnType<typeof briefingRepo>, editionId: string, stage: string): Promise<unknown> {
  const artifact = await store.artifact(editionId, stage);
  if (artifact === undefined) throw new ApiError("VALIDATION_ERROR", `The ${stage} stage artifact is missing.`);
  return artifact;
}

/**
 * Keep separately published versions of one report together even when their
 * URLs and copied excerpts differ.  A title-only comparison misses common
 * wire rewrites, while aggregating every cluster word causes unrelated stories
 * to bridge into one large cluster.  We therefore compare each incoming item
 * with every individual story fingerprint already in the cluster.
 */
export function clusterEvidence(evidence: BriefingEvidence[]): Array<{ key: string; title: string; evidenceIds: string[] }> {
  const clusters: Array<{
    key: string;
    title: string;
    evidenceIds: string[];
    hashes: Set<string>;
    fingerprints: Array<{ title: Set<string>; text: Set<string> }>;
  }> = [];
  for (const row of evidence) {
    const fingerprint = storyFingerprint(row);
    const match = clusters.find((cluster) =>
      Boolean(row.normalizedContentHash && cluster.hashes.has(row.normalizedContentHash))
      || cluster.fingerprints.some((existing) => isSimilarStory(fingerprint, existing)),
    );
    if (match) {
      match.evidenceIds.push(row.id);
      if (row.normalizedContentHash) match.hashes.add(row.normalizedContentHash);
      match.fingerprints.push(fingerprint);
    } else {
      clusters.push({
        key: `cluster-${clusters.length + 1}`,
        title: row.title,
        evidenceIds: [row.id],
        hashes: new Set(row.normalizedContentHash ? [row.normalizedContentHash] : []),
        fingerprints: [fingerprint],
      });
    }
  }
  return clusters.map((cluster) => ({
    key: cluster.key,
    title: cluster.title,
    evidenceIds: cluster.evidenceIds,
  }));
}

function storyFingerprint(row: Pick<BriefingEvidence, "title" | "excerpt">): { title: Set<string>; text: Set<string> } {
  return {
    title: meaningfulWords(row.title),
    // A bounded excerpt keeps this deterministic and prevents one unusually
    // long retrieved page from dominating a cluster comparison.
    text: meaningfulWords(`${row.title}\n${row.excerpt ?? ""}`.slice(0, 2_400)),
  };
}

function isSimilarStory(
  candidate: { title: Set<string>; text: Set<string> },
  existing: { title: Set<string>; text: Set<string> },
): boolean {
  const titleSimilarity = jaccard(candidate.title, existing.title);
  if (titleSimilarity >= 0.55) return true;

  // Different headlines can describe the same wire report. Require shared
  // headline terms as well as a substantial title-plus-excerpt overlap so
  // broad regional coverage does not collapse into one story.
  const sharedTitleTerms = [...candidate.title].filter((word) => existing.title.has(word)).length;
  return sharedTitleTerms >= 2 && jaccard(candidate.text, existing.text) >= 0.45;
}

function meaningfulWords(value: string): Set<string> {
  const stop = new Set(["the", "and", "that", "with", "from", "after", "into", "over", "says", "report", "this", "were", "will", "have", "about"]);
  return new Set((value.toLocaleLowerCase().match(/[\p{L}\p{N}]{4,}/gu) ?? []).filter((word) => !stop.has(word)));
}

function jaccard(a: Set<string>, b: Set<string>): number {
  if (!a.size || !b.size) return 0;
  const intersection = [...a].filter((word) => b.has(word)).length;
  return intersection / (a.size + b.size - intersection);
}

function allDailyPassages(brief: DraftDailyBrief): DraftPassage[] {
  return [
    ...brief.situation.passages,
    ...brief.keyEvents.passages,
    ...(brief.israeliPosition?.passages ?? []),
    ...(brief.internationalResponses?.passages ?? []),
    ...brief.watchPoints.passages,
  ];
}

function dailyAsContent(brief: DraftDailyBrief): DraftContent {
  return {
    title: brief.title,
    summary: brief.summary,
    evidenceIds: brief.evidenceIds,
    claims: brief.claims,
    passages: dedupeDraftPassages(allDailyPassages(brief)),
  };
}

function dailyBody(brief: DraftDailyBrief): string {
  const sections = [brief.situation, brief.keyEvents, brief.israeliPosition, brief.internationalResponses, brief.watchPoints]
    .filter((section): section is NonNullable<typeof section> => Boolean(section));
  return sections.map((section) => `## ${section.label}\n\n${bodyFromPassages(section.passages)}`).join("\n\n");
}

/** Small drafting models sometimes restate the same source claim several
 * times with slightly different wording. Keep the first traceable passage;
 * preserve distinct evidence or genuinely different explanations. */
export function dedupeDraftPassages(passages: readonly DraftPassage[]): DraftPassage[] {
  const kept: DraftPassage[] = [];
  for (const passage of passages) {
    const words = meaningfulWords(passage.text);
    const evidenceIds = new Set(passage.evidenceIds);
    const duplicate = kept.some((existing) => {
      if (existing.claimIndex !== passage.claimIndex) return false;
      if (![...evidenceIds].some((id) => existing.evidenceIds.includes(id))) return false;
      return jaccard(words, meaningfulWords(existing.text)) >= 0.58;
    });
    if (!duplicate) kept.push(passage);
  }
  return kept;
}

function bodyFromPassages(passages: readonly DraftPassage[]): string {
  return passages.map((passage) => passage.text.trim()).join("\n\n");
}

function publicationPassages(
  passages: readonly DraftPassage[],
  claimItems: readonly { id: string }[],
): NonNullable<CreatePublication["passages"]> {
  return dedupeDraftPassages(passages).map((passage) => ({
    text: passage.text,
    itemId: claimItems[passage.claimIndex]?.id,
    evidenceIds: passage.evidenceIds,
  }));
}

/** Reject a model reference unless it belongs to the exact evidence packet for
 * this run. Exported for the regression test that protects that boundary. */
export function validateEvidenceIds(ids: string[], evidence: ReadonlyMap<string, BriefingEvidence>): void {
  for (const id of ids) {
    if (!evidence.has(id)) {
      throw new ApiError("VALIDATION_ERROR", "The model referenced source material outside this collection window.");
    }
  }
}

/** Independent families are useful corroboration, but not a prerequisite for
 * an attributed public-source report. This helper remains strict so callers
 * and tests can explicitly ask whether a story is independently supported. */
export function storyHasIndependentSupport(
  evidenceIds: readonly string[],
  evidence: ReadonlyMap<string, Pick<BriefingEvidence, "sourceFamilyId" | "sourceCategory">>,
): boolean {
  const rows = evidenceIds.flatMap((id) => {
    const row = evidence.get(id);
    return row ? [row] : [];
  });
  return rows.length === evidenceIds.length
    && (new Set(rows.map((row) => row.sourceFamilyId)).size >= 2
      || rows.some((row) => row.sourceCategory?.startsWith("official_")));
}

/** Triage may route a story when every selected ID resolves to usable public
 * evidence. A one-family story is later required to stay attributed and
 * uncertainty-aware; it is never counted as independently corroborated. */
export function storyHasCitableSupport(
  evidenceIds: readonly string[],
  evidence: ReadonlyMap<string, Pick<BriefingEvidence, "sourceFamilyId" | "sourceCategory">>,
): boolean {
  return evidenceIds.length > 0 && evidenceIds.every((id) => evidence.has(id));
}

type TriageStory = z.infer<typeof selectionSchema>["stories"][number];

/** Preserve source-routing rules and add official Israeli context when the
 * closed packet already contains it. */
export function normalizeTriageStories(
  stories: readonly TriageStory[],
  evidence: ReadonlyMap<string, BriefingEvidence>,
): TriageStory[] {
  const adversarial = new Set(["hostile_state_media", "regional_critical", "critical_media", "critical_institution"]);
  const routed = stories.map((story) => {
    const rows = story.evidenceIds.flatMap((id) => {
      const entry = evidence.get(id);
      return entry ? [entry] : [];
    });
    const adversarialOnly = rows.length > 0 && rows.every((entry) =>
      entry.sourceCategory !== null && adversarial.has(entry.sourceCategory),
    );
    return adversarialOnly
      ? { ...story, section: "narrative_watch" as const, narrativeTitle: story.narrativeTitle ?? story.title }
      : story;
  });
  const official = [...evidence.values()].find((entry) => entry.sourceCategory === "official_israeli");
  const withOfficial = official && !routed.some((story) => story.evidenceIds.includes(official.id))
    ? [{
        title: official.title,
        section: "israel_update" as const,
        evidenceIds: [official.id],
        sourceClaim: (official.excerpt?.trim() || official.title).slice(0, 2_000),
        narrativeTitle: null,
      }, ...routed]
    : routed;
  /* The same ceilings `limitEditionArticles` enforces on the drafted edition.
   * They are stated twice because triage decides what reaches the packet at
   * all, and a triage ceiling below the drafting one would silently make the
   * drafting one unreachable. */
  let general = 0;
  let narrative = 0;
  return withOfficial.filter((story) => {
    if (story.section === "narrative_watch") {
      narrative += 1;
      return narrative <= 5;
    }
    general += 1;
    return general <= 3;
  });
}

function validateDraftEvidence(edition: StoredEdition, evidence: Map<string, BriefingEvidence>): void {
  const content = [dailyAsContent(edition.dailyBrief), ...edition.articles];
  validateEvidenceIds(content.flatMap((entry) => [
    ...entry.evidenceIds,
    ...entry.claims.flatMap((claim) => claim.evidenceLinks.map((link) => link.evidenceId)),
    ...entry.passages.flatMap((passage) => passage.evidenceIds),
  ]), evidence);
  validateEvidenceIds(edition.articles.flatMap((article) => article.narrativeWatchDetails
    ? [...article.narrativeWatchDetails.supportingEvidenceIds, ...article.narrativeWatchDetails.contradictingEvidenceIds]
    : []), evidence);
  for (const entry of content) {
    for (const passage of entry.passages) {
      if (!entry.claims[passage.claimIndex]) {
        throw new ApiError("VALIDATION_ERROR", "A drafted paragraph referenced a missing atomic claim.");
      }
    }
  }
}

/**
 * Only Israel Updates can occupy the dedicated daily Israel feature slot.
 * A model may return a misplaced or duplicate boolean even while the article
 * itself is fully valid.  We make the UI-safe choice deterministic rather
 * than rejecting the edition or allowing an invalid feature placement.
 */
export function normalizeFeaturedIsraelStory<T extends { articles: DraftArticle[] }>(edition: T): T {
  let selected = false;
  return {
    ...edition,
    articles: edition.articles.map((article) => {
      const eligible = article.section === "israel_update" && article.featuredIsraelStory && !selected;
      if (eligible) selected = true;
      return { ...article, featuredIsraelStory: eligible };
    }),
  };
}

/**
 * The daily contract permits up to five Narrative Watch articles and three
 * Israel Updates, and at most **one** of those may be an unsourced analysis.
 * Models can occasionally return a valid extra item, so keep the highest-ranked
 * entries (their returned order) instead of discarding an otherwise publishable
 * edition.
 *
 * The analysis cap is keyed on the same derivation as everything else — an
 * empty `evidenceIds` — and is separate from the section caps because a day
 * that produced no source-backed refutation must not become a day of five
 * unsourced ones.
 */
export function limitEditionArticles<T extends { articles: DraftArticle[] }>(edition: T): T {
  let general = 0;
  let narrative = 0;
  let analysis = 0;
  return {
    ...edition,
    articles: edition.articles.filter((article) => {
      if (article.evidenceIds.length === 0) {
        analysis += 1;
        if (analysis > 1) return false;
      }
      if (article.section === "narrative_watch") {
        narrative += 1;
        return narrative <= 5;
      }
      general += 1;
      return general <= 3;
    }),
  };
}

const ADVERSARIAL_SOURCE_CATEGORIES = new Set([
  "hostile_state_media",
  "regional_critical",
  "critical_media",
  "critical_institution",
]);

/** Keep blocked or near-empty retrievals out of the closed model packet. A
 * source may remain in the evidence archive, but it must not be used to
 * create a publication that cannot later pass the same public quality gate. */
export function isProcessableEvidence(entry: BriefingEvidence): boolean {
  return entry.accessState === "open"
    && ["fetched", "partial"].includes(entry.retrievalStatus)
    && entry.usableTextLength >= 80
    && Boolean(entry.excerpt?.trim());
}

/**
 * The model chooses the story and writes the edition. These deterministic
 * corrections merely preserve source-routing and attribution facts already
 * present in its closed evidence packet, so a valid report is not discarded
 * because a small model misplaced an otherwise correctly grounded story.
 */
export function normalizeEditionForPublication(
  edition: z.infer<typeof editionSchema>,
  evidence: ReadonlyMap<string, BriefingEvidence>,
): StoredEdition {
  const dailyBrief = dedupeDailyBriefPassages(normalizeDailyBriefOfficialContext(edition.dailyBrief, evidence));
  return {
    ...edition,
    dailyBrief,
    articles: edition.articles.map((article) => {
      const rows = article.evidenceIds.flatMap((id) => {
        const entry = evidence.get(id);
        return entry ? [entry] : [];
      });
      const adversarialOnly = rows.length > 0 && rows.every((entry) =>
        entry.sourceCategory !== null && ADVERSARIAL_SOURCE_CATEGORIES.has(entry.sourceCategory),
      );
      const section = adversarialOnly ? "narrative_watch" as const : article.section;
      const publisher = rows[0]?.publisher;
      const singleNonOfficial = new Set(rows.map((entry) => entry.sourceFamilyId)).size === 1
        && !rows.some((entry) => entry.sourceCategory?.startsWith("official_"));
      const claims = singleNonOfficial && publisher
        ? article.claims.map((claim) => ({
            ...claim,
            layer: "source_claim" as const,
            attributedTo: publisher,
            uncertainty: `This report is based on one non-official publisher family and remains subject to further corroboration.`,
          }))
        : article.claims;
      /* Derived, never read off model output. `evidenceBasis` switches off
       * seven evidence checks, and the retry loop hands the model every
       * failure string from attempt one — a model-set flag would be found and
       * used within a single regeneration. It is stamped onto both branches:
       * the details the model supplied, and the fallback synthesized when an
       * adversarial-only story was rerouted into Narrative Watch. */
      const evidenceBasis: EvidenceBasis = article.evidenceIds.length === 0 ? "analysis" : "sourced";
      const narrativeWatchDetails = section === "narrative_watch"
        ? article.narrativeWatchDetails
          ? { ...article.narrativeWatchDetails, evidenceBasis }
          : {
              exactClaim: article.summary,
              propagators: [...new Set(rows.map((entry) => entry.publisher))].slice(0, 20),
              arenas: [article.arena],
              trendDirection: "unclear" as const,
              israeliPosition: null,
              securityContext: null,
              supportingEvidenceIds: article.evidenceIds,
              contradictingEvidenceIds: [],
              verificationState: "unresolved" as const,
              knownUnknowns: ["The source packet contains only adversarial reporting and does not independently establish the underlying event."],
              evidenceBasis,
            }
        : null;
      /* A source-only allegation must not be rendered as a bare factual
       * headline.  The model already receives this instruction, but applying
       * the attribution deterministically keeps the list, homepage fallback,
       * metadata, and social cards safe when a small drafting model omits it.
       * This changes presentation only; the original model title remains in
       * the versioned draft artifact and narrative detail. */
      const publicTitle = section === "narrative_watch"
        ? narrativeWatchTitle(article.title, evidenceBasis).slice(0, 300)
        : article.title;
      return {
        ...article,
        passages: dedupeDraftPassages(article.passages),
        title: publicTitle,
        section,
        claims,
        featuredIsraelStory: section === "israel_update" ? article.featuredIsraelStory : false,
        narrativeTitle: section === "narrative_watch" ? article.narrativeTitle ?? publicTitle : null,
        narrativeWatchDetails,
      };
    }),
  };
}

function dedupeDailyBriefPassages(brief: DraftDailyBrief): DraftDailyBrief {
  return {
    ...brief,
    situation: { ...brief.situation, passages: dedupeDraftPassages(brief.situation.passages) },
    keyEvents: { ...brief.keyEvents, passages: dedupeDraftPassages(brief.keyEvents.passages) },
    israeliPosition: brief.israeliPosition
      ? { ...brief.israeliPosition, passages: dedupeDraftPassages(brief.israeliPosition.passages) }
      : null,
    internationalResponses: brief.internationalResponses
      ? { ...brief.internationalResponses, passages: dedupeDraftPassages(brief.internationalResponses.passages) }
      : null,
    watchPoints: { ...brief.watchPoints, passages: dedupeDraftPassages(brief.watchPoints.passages) },
  };
}

function normalizeDailyBriefOfficialContext(
  dailyBrief: DraftDailyBrief,
  evidence: ReadonlyMap<string, BriefingEvidence>,
): DraftDailyBrief {
  const official = [...evidence.values()].find((entry) => entry.sourceCategory === "official_israeli");
  if (!official) return dailyBrief;

  const hasOfficialPassage = allDailyPassages(dailyBrief).some((passage) => passage.evidenceIds.includes(official.id));
  if (hasOfficialPassage) {
    return dailyBrief.evidenceIds.includes(official.id)
      ? dailyBrief
      : { ...dailyBrief, evidenceIds: [...dailyBrief.evidenceIds, official.id] };
  }

  const sourceText = `${official.title}. ${official.excerpt?.trim() ?? ""}`.replace(/\s+/g, " ").trim().slice(0, 4_000);
  const claimIndex = dailyBrief.claims.length;
  const claim = {
    title: `Official Israeli update: ${official.title}`.slice(0, 300),
    text: `${official.publisher} reported: ${sourceText}`.slice(0, 4_000),
    layer: "source_claim" as const,
    assessment: "unresolved" as const,
    attributedTo: official.publisher,
    uncertainty: "This is the official Israeli position as stated by the issuing authority.",
    evidenceLinks: [{
      evidenceId: official.id,
      relation: "supports" as const,
      strength: "adequate" as const,
      rationale: "This passage directly attributes the update to the official Israeli source.",
    }],
  };
  const passage = {
    text: `According to ${official.publisher}, ${sourceText}`.slice(0, 6_000),
    claimIndex,
    evidenceIds: [official.id],
  };
  return {
    ...dailyBrief,
    evidenceIds: [...new Set([...dailyBrief.evidenceIds, official.id])],
    claims: [...dailyBrief.claims, claim],
    israeliPosition: dailyBrief.israeliPosition
      ? { ...dailyBrief.israeliPosition, passages: [passage, ...dailyBrief.israeliPosition.passages] }
      : { label: "Israeli position", passages: [passage] },
  };
}

/**
 * The closed evidence packet as the model sees it.
 *
 * Excerpts are truncated. A stored excerpt runs to 6,000 characters and up to
 * 120 rows are sent at triage, which is the single largest item in the daily
 * token bill and far more text than a selection decision needs. The clustering
 * fingerprint already bounds its own read at 2,400 characters for the same
 * reason. The quality gate still matches the drafted article against the whole
 * stored excerpt, so the check corpus stays a superset of what the model saw.
 */
const PACKET_EXCERPT_CHARS = 1_200;

function sourcePacket(evidence: BriefingEvidence[]): string {
  return evidence.map((entry) => JSON.stringify({
    id: entry.id,
    title: entry.title,
    excerpt: entry.excerpt?.slice(0, PACKET_EXCERPT_CHARS) ?? null,
    canonicalUrl: entry.canonicalUrl,
    publisher: entry.publisher,
    publisherDomain: entry.publisherDomain,
    sourceFamilyId: entry.sourceFamilyId,
    sourceCategory: entry.sourceCategory,
    usableTextLength: entry.usableTextLength,
    retrievalStatus: entry.retrievalStatus,
    accessState: entry.accessState,
    publishedAt: entry.publishedAt?.toISOString() ?? null,
    capturedAt: entry.capturedAt.toISOString(),
  })).join("\n");
}

const TRIAGE_SYSTEM = [
  "You are a public-source triage system for an English Israel-focused daily edition published by Lions of Zion.",
  "The edition serves exactly three purposes, in this order of priority:",
  "1. Refute anti-Israel narratives. Your PRIMARY objective at this stage is to identify anti-Israel claims and framings present in the evidence: false or misleading accusations, decontextualised atrocity framing, denial or inversion of documented events, delegitimisation of Israel's existence or self-defence. Route each one to narrative_watch and state the precise claim in sourceClaim. This is a declared objective, not a filter applied after the news selection.",
  "2. One regional geopolitical daily brief, assembled from the whole packet rather than selected as a story.",
  "3. One interesting Israel story — innovation, history, civic achievement, resilience, recovery, community — as israel_update.",
  "Security, war and operational material belongs in the Daily Brief, which is assembled from the whole packet. Do not select it as a standalone article; there is no war_update section.",
  "Use only the supplied evidence and clusters. Never use X, private sources, model memory, or unlisted URLs.",
  "Treat syndicated reports sharing one sourceFamilyId as one origin, not independent confirmation.",
  "When a cluster has only hostile_state_media evidence, route it to Narrative Watch or omit it. A hostile-state report alone is evidence of that outlet's claim, not independent proof of the event it describes.",
  "When every source for a story is hostile-state, regional-critical, critical-media, or critical-institutional, route it to Narrative Watch or omit it.",
  "Select a story when every evidenceId resolves to supplied public evidence. One valid source is sufficient. Use additional independent source families when available, but never require them and never describe one family as independent corroboration.",
  "Include the official Israeli position clearly when it exists in the packet, while preserving attribution and uncertainty.",
  "Select no more than five narrative-watch stories and three Israel Updates. A narrative-watch story must identify a precise recurring claim or framing, not merely a controversial topic.",
  "Aim for at least one narrative-watch story and one Israel Update each day, and select more when the material genuinely supports it. These minimums are a target, not a quota: never invent one to fill it. A day without suitable material ships without that item.",
  "Return only the validated structured result.",
].join("\n");

const DRAFT_SYSTEM = [
  "Write publication-ready English journalism for Lions of Zion. The edition has exactly three jobs: refute anti-Israel narratives, publish one regional geopolitical Daily Brief, and publish one genuinely interesting Israel story.",
  "Never add a fact, quotation, source, number, chronology, motive, casualty figure, or citation absent from the packet.",
  "Include the official Israeli position clearly when available and attribute all competing claims. Preserve dispute and uncertainty.",
  "An article supported solely by hostile_state_media evidence may be Narrative Watch only. Never present it as a confirmed Israel update.",
  "When every cited source is hostile-state, regional-critical, critical-media, or critical-institutional, the article MUST be Narrative Watch.",
  "Decompose every article into atomic claims. Label each as source_claim, observed_fact, model_inference, or editorial_conclusion and attach explained supporting, contradicting, or contextual evidence edges.",
  "Every paragraph passage must point to one claim index. claimIndex is zero-based and LOCAL: it indexes only the claims array in that same Daily Brief or that same individual article. It is never a global index across the edition and never an evidence index. If a passage supports the first local claim, use claimIndex: 0.",
  "In a sourced article every paragraph must also list the exact evidence IDs supporting it, and every claim needs at least one explained evidenceLink from the packet. One valid source is sufficient. Use additional independent source families when available, but never require them and never treat two URLs from the same publisher family as independent. If a story relies on only one non-official source family, every claim MUST be a source_claim, name that publisher in attributedTo, and include a concrete uncertainty note. Every article evidenceIds list must include the evidence supporting its claims.",
  "Before returning, audit every claims array yourself. Use attribution and uncertainty whenever the source material itself is disputed or incomplete. The Daily Brief claims array follows the same rule.",
  "Use exact numbers and direct quotations only when the exact token or wording appears in the supplied source text or in the exact claim being refuted.",
  "",
  "NARRATIVE WATCH — REFUTE, DO NOT MERELY DOCUMENT.",
  "A Narrative Watch article exists to answer an anti-Israel claim, not to catalogue it. State the claim exactly and in full; then say plainly why it is false or misleading; then supply the context its tellers omit. Record who is reported to have spread it, the relevant arenas, the evidence status, Israeli context, contradiction, and what genuinely remains unknown. Do not infer coordination or intent without evidence. Refute the claim; never repeat it approvingly and never leave it standing unanswered.",
  "The prompt supplies a 'Refutation targets' block drawn from the tracked narrative backlog. Prefer answering one of those when the packet or the claim itself gives you something substantive to say.",
  "",
  "ANALYSIS MODE — A REFUTATION MAY CITE NOTHING.",
  "A source is a bonus on a refutation, not a requirement. When you can answer a narrative from reasoning and public context alone, publish it as this organisation's own analysis, clearly marked. To do that, ALL of the following must hold together:",
  "- section is exactly narrative_watch, and the article's evidenceIds array is empty.",
  "- It cites nothing ANYWHERE: every claim's evidenceLinks array is empty, every passage's evidenceIds array is empty, and narrativeWatchDetails.supportingEvidenceIds and .contradictingEvidenceIds are both empty. A half-sourced article is rejected outright — either cite sources everywhere they belong, or cite none at all.",
  `- Every claim has layer "editorial_conclusion", attributedTo set to exactly "${ANALYSIS_AUTHOR}", and a written uncertainty note saying what this reasoning does not establish.`,
  "- Every claim's assessment is refuted, misleading, or unsupported. An unsourced piece cannot conclude that something is verified, disputed, or unresolved.",
  "- narrativeWatchDetails.verificationState is refuted, misleading, or unsupported, and exactClaim states the claim being answered in full.",
  "- The title is anchored in that exact claim, since there is no source text for it to be anchored in.",
  "- Every exact number and direct quotation in the body must still appear either somewhere in the supplied packet or in exactClaim itself. Reasoning does not license a figure.",
  "At most ONE article per edition may be an unsourced analysis. Everything else cites its sources.",
  "",
  "ISRAEL UPDATE — COMPOSE, DO NOT RE-REPORT.",
  "An israel_update reads the sources and then writes something new from that reading: an innovation and why it matters, a piece of history the day's events illuminate, a civic or community achievement, a story of recovery or resilience. It is not a rewrite of one wire report. Ground every claim in the packet as usual, but the shape, the argument and the significance are yours to compose. Do not use unsupported promotional language.",
  "",
  "The Daily Brief must contain a situation snapshot, key events, the Israeli position when available, relevant international responses when available, and watch points. Security, war and operational material belongs here rather than in a standalone article.",
  "If an official Israeli source appears in the selected packet, the Daily Brief MUST cite it in the relevant section.",
  "Set editorialTopic, primaryActor, and arena from the evidence. featuredIsraelStory may be true only for one eligible source-grounded article whose section is exactly israel_update; it must be false for the Daily Brief and for Narrative Watch articles.",
  "",
  "VOLUME. Exactly one Daily Brief. Aim for at least one Narrative Watch refutation and at least one Israel Update, and write more when the material genuinely supports it — up to five Narrative Watch articles and three Israel Updates. These minimums are a target, NOT a quota. Never invent a story to fill one. A day without suitable material ships without that item.",
  "Do not write placeholder prose about what the sources do or do not contain. Never write sentences of the form 'the sources do not contain', 'the material does not provide', 'insufficient information', or 'no details were provided'. If a sourced story lacks the evidence to stand up, omit that story — but do not omit a refutation merely because it has no sources: publish it in analysis mode instead. When something is genuinely unknown, name the specific missing fact in the claim's uncertainty note or in knownUnknowns, in your own words, rather than describing the state of the packet in the body.",
  "Return only the validated structured result.",
].join("\n");

export type BriefingService = ReturnType<typeof briefingService>;
