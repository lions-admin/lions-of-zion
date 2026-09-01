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
import {
  evaluateCandidate,
  type DraftPassage,
  type QualityCandidate,
  type QualityCheck,
} from "./quality";
import type { Actor } from "@/server/core/audit";
import type { CreatePublication } from "@/server/contracts/publication";
import { enrichEvidenceWindow } from "@/server/modules/sources/enrich";

const ARTICLE_SECTIONS = ["israel_update", "war_update", "narrative_watch"] as const;
const PIPELINE_STAGES = ["enrich", "cluster", "triage", "draft", "quality", "publish"] as const;
export type EditorialStage = (typeof PIPELINE_STAGES)[number];

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

const articleSchema = z.object({
  section: z.enum(ARTICLE_SECTIONS),
  title: z.string().min(1).max(300),
  summary: z.string().min(1).max(1_200),
  evidenceIds: z.array(z.uuid()).min(1).max(20),
  claims: z.array(claimSchema).min(1).max(20),
  passages: z.array(passageSchema).min(2).max(30),
  narrativeTitle: z.string().min(1).max(300).nullable(),
  editorialTopic: z.string().min(1).max(120),
  primaryActor: z.string().min(1).max(160).nullable(),
  arena: z.string().min(1).max(120),
  featuredIsraelStory: z.boolean(),
  narrativeWatchDetails: z.object({
    exactClaim: z.string().min(1).max(4_000),
    propagators: z.array(z.string().min(1).max(300)).max(20),
    arenas: z.array(z.string().min(1).max(120)).min(1).max(20),
    trendDirection: z.enum(["rising", "stable", "declining", "new", "unclear"]),
    israeliPosition: z.string().min(1).max(6_000).nullable(),
    securityContext: z.string().min(1).max(6_000).nullable(),
    supportingEvidenceIds: z.array(z.uuid()).max(30),
    contradictingEvidenceIds: z.array(z.uuid()).max(30),
    verificationState: z.enum(["verified", "refuted", "misleading", "unsupported", "disputed", "unresolved"]),
    knownUnknowns: z.array(z.string().min(1).max(1_000)).max(20),
  }).nullable(),
}).superRefine((article, ctx) => {
  if ((article.section === "narrative_watch") !== Boolean(article.narrativeWatchDetails)) {
    ctx.addIssue({ code: "custom", path: ["narrativeWatchDetails"], message: "Narrative Watch requires structured monitoring details only." });
  }
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
  israeliPosition: dailySectionSchema.nullable(),
  internationalResponses: dailySectionSchema.nullable(),
  watchPoints: dailySectionSchema,
});

const editionSchema = z.object({
  dailyBrief: dailyBriefSchema,
  articles: z.array(articleSchema).max(8),
});

const selectionSchema = z.object({
  stories: z.array(z.object({
    title: z.string().min(1).max(300),
    section: z.enum(ARTICLE_SECTIONS),
    evidenceIds: z.array(z.uuid()).min(1).max(12),
    sourceClaim: z.string().min(1).max(2_000),
    narrativeTitle: z.string().min(1).max(300).nullable(),
  })).max(8),
});

const enrichArtifactSchema = z.object({ evidenceIds: z.array(z.uuid()), collectedThrough: z.string() });
const clusterArtifactSchema = z.object({
  clusters: z.array(z.object({ key: z.string(), title: z.string(), evidenceIds: z.array(z.uuid()).min(1) })),
});
const triageArtifactSchema = selectionSchema.extend({ aiRunId: z.uuid() });
const draftArtifactSchema = z.object({ edition: editionSchema, aiRunId: z.uuid() });
const qualityArtifactSchema = z.object({
  passed: z.boolean(),
  qualityRunId: z.uuid(),
  candidateKeys: z.array(z.string()),
});

type DraftArticle = z.infer<typeof articleSchema>;
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

  async function evidenceForArtifact(editionId: string): Promise<BriefingEvidence[]> {
    const artifact = enrichArtifactSchema.parse(await requiredArtifact(store, editionId, "enrich"));
    const ids = new Set(artifact.evidenceIds);
    return (await store.recentEvidence(new Date(now().getTime() - 72 * 60 * 60 * 1_000), 500))
      .filter((entry) => ids.has(entry.id));
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
        case "quality":
          result = await quality(editionId, runId);
          break;
        case "publish":
          result = await publish(editionId, localDate, actor, requestId);
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
    await enrichEvidenceWindow(database, discovered.filter((entry) => entry.usableTextLength < 1_000), actor, requestId);
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
    if (!selectedEvidence.length) {
      return { shouldContinue: false, inputCount: 0, outputCount: 0, reason: "no_citable_supported_stories" };
    }
    const basePrompt = `Israel-local editorial date: ${localDate}\n\nSelected stories:\n${JSON.stringify(triaged.stories)}\n\nPublic evidence packet:\n${sourcePacket(selectedEvidence)}`;
    let output: StructuredGenerateOutput<z.infer<typeof editionSchema>> | undefined;
    let edition: z.infer<typeof editionSchema> | undefined;
    let qualityFeedback = "";
    let finalQualityFailures: string[] = [];
    for (let attempt = 1; attempt <= 2; attempt += 1) {
      const candidate = await generate({
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
        prompt: `${basePrompt}${qualityFeedback}`,
      });
      const normalized = normalizeEditionForQuality(
        limitEditionArticles(normalizeFeaturedIsraelStory(candidate.output)),
        evidenceById,
      );
      validateDraftEvidence(normalized, evidenceById);
      const failures = draftQualityFailures(normalized, evidenceById);
      output = candidate;
      edition = normalized;
      finalQualityFailures = failures;
      if (!failures.length) break;
      qualityFeedback = `\n\nThe previous draft failed deterministic quality checks. Regenerate the entire edition and fix these exact failures before returning it:\n${failures.join("\n")}`;
    }
    if (!output || !edition) throw new ApiError("VALIDATION_ERROR", "The drafting model did not produce a valid edition.");
    if (finalQualityFailures.length) {
      throw new ApiError("VALIDATION_ERROR", "The drafting model did not meet the deterministic publication requirements after regeneration.");
    }
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

  async function quality(
    editionId: string,
    runId: string,
  ): Promise<Omit<BriefingStageResult, "stage" | "status">> {
    const evidence = await evidenceForArtifact(editionId);
    const evidenceById = new Map(evidence.map((entry) => [entry.id, entry]));
    const drafted = draftArtifactSchema.parse(await requiredArtifact(store, editionId, "draft"));
    const candidates = [
      qualityCandidate("daily-brief", dailyAsContent(drafted.edition.dailyBrief), "daily_brief"),
      ...drafted.edition.articles.map((article, index) => qualityCandidate(`article-${index + 1}`, article, article.section)),
    ];
    let passed = true;
    for (const [index, candidate] of candidates.entries()) {
      const decision = evaluateCandidate(candidate, evidenceById);
      await store.recordQualityChecks(runId, candidate.key, decision.checks);
      if (!decision.passed) {
        passed = false;
        await store.quarantine(
          runId,
          candidate.key,
          "quality",
          failedChecks(decision.checks),
          index === 0 ? drafted.edition.dailyBrief : drafted.edition.articles[index - 1],
        );
      }
    }
    await store.saveArtifact(editionId, "quality", integrityHash(JSON.stringify(candidates.map((entry) => entry.key))), {
      passed,
      qualityRunId: runId,
      candidateKeys: candidates.map((entry) => entry.key),
    });
    if (!passed) {
      await store.markEditionById(editionId, "quarantined");
      throw new ApiError("VALIDATION_ERROR", "The generated edition did not meet the publication quality gate.");
    }
    await store.resolveQuarantine(runId, candidates.map((candidate) => candidate.key));
    return { shouldContinue: true, inputCount: candidates.length, outputCount: candidates.length };
  }

  async function publish(
    editionId: string,
    localDate: string,
    actor: Actor,
    requestId?: string,
  ): Promise<Omit<BriefingStageResult, "stage" | "status">> {
    const quality = qualityArtifactSchema.parse(await requiredArtifact(store, editionId, "quality"));
    if (!quality.passed) {
      return { shouldContinue: false, inputCount: 0, outputCount: 0, reason: "edition_failed_quality" };
    }
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
        slug: `${localDate}-narrative-${index + 1}`,
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
    }, ...drafted.edition.articles.map((article, index) => ({
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
    }))];

    const created = automaticPublication
      ? await publicationWriter.autoPublishMany(inputs, {
          briefingRunId: quality.qualityRunId,
          machineAuthor: MACHINE_AUTHOR,
          candidateKeys: quality.candidateKeys,
        }, actor, requestId)
      : await publicationWriter.createMany(inputs, actor, requestId, {
          briefingRunId: quality.qualityRunId,
          machineAuthor: MACHINE_AUTHOR,
          candidateKeys: quality.candidateKeys,
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

  /** Complete the one safe recovery path for an edition produced while
   * publication was paused. This never drafts again: it only promotes the
   * exact stored draft rows after re-checking the recorded quality gate. */
  async function resumePausedEdition(actor: Actor, requestId?: string): Promise<BriefingRunResult> {
    const localDate = israelLocalDate(now());
    const features = briefingFeatures();
    const control = await store.control();
    if (!features.autoPublish || control.automaticPublicationPaused) {
      return { status: "skipped", localDate, evidenceCount: 0, publications: 0, reason: "automatic_publication_paused" };
    }
    const edition = await store.editionByDate(localDate);
    if (!edition) return { status: "skipped", localDate, evidenceCount: 0, publications: 0, reason: "no_edition" };
    const quality = qualityArtifactSchema.parse(await requiredArtifact(store, edition.id, "quality"));
    if (!quality.passed) return { status: "skipped", localDate, evidenceCount: 0, publications: 0, reason: "edition_failed_quality" };
    const drafted = draftArtifactSchema.parse(await requiredArtifact(store, edition.id, "draft"));
    const inputs: CreatePublication[] = [{
      kind: "brief",
      section: "daily_brief",
      title: drafted.edition.dailyBrief.title,
      summary: drafted.edition.dailyBrief.summary,
      body: dailyBody(drafted.edition.dailyBrief),
      language: "en",
    }, ...drafted.edition.articles.map((article) => ({
      kind: "news_update" as const,
      section: article.section,
      title: article.title,
      summary: article.summary,
      body: bodyFromPassages(article.passages),
      language: "en",
    }))];
    const writer = publicationService(database);
    const published = await writer.resumeGeneratedDrafts(inputs, {
      briefingRunId: quality.qualityRunId,
      machineAuthor: MACHINE_AUTHOR,
      candidateKeys: quality.candidateKeys,
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

  return {
    run,
    runStage,
    resumePausedEdition,
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

function qualityCandidate(
  key: string,
  content: DraftContent,
  section: QualityCandidate["section"],
): QualityCandidate {
  const passages = dedupeDraftPassages(content.passages);
  return { ...content, key, section, passages, body: bodyFromPassages(passages) };
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
  let general = 0;
  let narrative = 0;
  return withOfficial.filter((story) => {
    if (story.section === "narrative_watch") {
      narrative += 1;
      return narrative <= 3;
    }
    general += 1;
    return general <= 5;
  });
}

function validateDraftEvidence(edition: z.infer<typeof editionSchema>, evidence: Map<string, BriefingEvidence>): void {
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
 * The daily contract permits up to five general articles and three Narrative
 * Watch articles. Models can occasionally return a valid extra item, so keep
 * the highest-ranked entries (their returned order) instead of discarding an
 * otherwise publishable edition.
 */
export function limitEditionArticles<T extends { articles: DraftArticle[] }>(edition: T): T {
  let general = 0;
  let narrative = 0;
  return {
    ...edition,
    articles: edition.articles.filter((article) => {
      if (article.section === "narrative_watch") {
        narrative += 1;
        return narrative <= 3;
      }
      general += 1;
      return general <= 5;
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
export function normalizeEditionForQuality(
  edition: z.infer<typeof editionSchema>,
  evidence: ReadonlyMap<string, BriefingEvidence>,
): z.infer<typeof editionSchema> {
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
      const narrativeWatchDetails = section === "narrative_watch"
        ? article.narrativeWatchDetails ?? {
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
          }
        : null;
      /* A source-only allegation must not be rendered as a bare factual
       * headline.  The model already receives this instruction, but applying
       * the attribution deterministically keeps the list, homepage fallback,
       * metadata, and social cards safe when a small drafting model omits it.
       * This changes presentation only; the original model title remains in
       * the versioned draft artifact and narrative detail. */
      const publicTitle = section === "narrative_watch"
        ? narrativeWatchHeadline(article.title)
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

function narrativeWatchHeadline(title: string): string {
  const trimmed = title.trim();
  if (/^(?:reported|unverified|disputed)\s+(?:claim|report)\s*:/i.test(trimmed)) return trimmed;
  return `Reported claim: ${trimmed}`.slice(0, 300);
}

function normalizeDailyBriefOfficialContext(
  dailyBrief: DraftDailyBrief,
  evidence: ReadonlyMap<string, BriefingEvidence>,
): DraftDailyBrief {
  const official = [...evidence.values()].find((entry) => entry.sourceCategory === "official_israeli");
  if (!official) return dailyBrief;

  const hasOfficialPassage = allDailyPassages(dailyBrief).some((passage) => passage.evidenceIds.includes(official.id));
  if (hasOfficialPassage && dailyBrief.evidenceIds.includes(official.id)) return dailyBrief;

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
    situation: { ...dailyBrief.situation, passages: [passage, ...dailyBrief.situation.passages] },
  };
}

function draftQualityFailures(
  edition: z.infer<typeof editionSchema>,
  evidence: ReadonlyMap<string, BriefingEvidence>,
): string[] {
  const candidates = [
    qualityCandidate("daily-brief", dailyAsContent(edition.dailyBrief), "daily_brief"),
    ...edition.articles.map((article, index) => qualityCandidate(`article-${index + 1}`, article, article.section)),
  ];
  return candidates.flatMap((candidate) => {
    const decision = evaluateCandidate(candidate, evidence);
    return decision.checks.filter((check) => check.status === "fail").map((check) => `${candidate.key}: ${check.name} — ${check.detail}`);
  });
}

function sourcePacket(evidence: BriefingEvidence[]): string {
  return evidence.map((entry) => JSON.stringify({
    id: entry.id,
    title: entry.title,
    excerpt: entry.excerpt,
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

function failedChecks(checks: readonly QualityCheck[]): string {
  return checks.filter((check) => check.status === "fail").map((check) => `${check.name}: ${check.detail}`).join(" | ").slice(0, 4_000) || "Quality checks failed.";
}

const TRIAGE_SYSTEM = [
  "You are a public-source triage system for an English Israel-focused daily brief.",
  "Use only the supplied evidence and clusters. Never use X, private sources, model memory, or unlisted URLs.",
  "Treat syndicated reports sharing one sourceFamilyId as one origin, not independent confirmation.",
  "When a cluster has only hostile_state_media evidence, route it to Narrative Watch or omit it. A hostile-state report alone is evidence of that outlet's claim, not independent proof of the event it describes.",
  "When every source for a story is hostile-state, regional-critical, critical-media, or critical-institutional, route it to Narrative Watch or omit it.",
  "Select a story when every evidenceId resolves to supplied public evidence. One valid source is sufficient. Use additional independent source families when available, but never require them and never describe one family as independent corroboration.",
  "Present the official Israeli position first when it exists in the packet, while preserving attribution and uncertainty.",
  "Select no more than five general stories and three narrative-watch stories. A narrative-watch story must identify a precise recurring claim or framing, not merely a controversial topic.",
  "Select one source-grounded Israel Update about resilience, recovery, innovation, security, diplomacy, civic assistance, or community when suitable evidence exists. Never invent one to fill a quota.",
  "Return only the validated structured result.",
].join("\n");

const DRAFT_SYSTEM = [
  "Write publication-ready English journalism for Lions of Zion from the fixed public evidence packet only.",
  "Never add a fact, quotation, source, number, chronology, motive, casualty figure, or citation absent from the packet.",
  "Present the official Israeli position first when available, then clearly attribute other claims. Preserve dispute and uncertainty.",
  "An article supported solely by hostile_state_media evidence may be Narrative Watch only. Describe the outlet's claim and its evidence status; never present it as a confirmed Israel or war update.",
  "When every cited source is hostile-state, regional-critical, critical-media, or critical-institutional, the article MUST be Narrative Watch.",
  "Decompose every article into atomic claims. Label each as source_claim, observed_fact, model_inference, or editorial_conclusion and attach explained supporting, contradicting, or contextual evidence edges.",
  "Every paragraph passage must point to one claim index and the exact evidence IDs supporting it. claimIndex is zero-based and LOCAL: it indexes only the claims array in that same Daily Brief or that same individual article. It is never a global index across the edition and never an evidence index. If a passage supports the first local claim, use claimIndex: 0.",
  "Every claim needs at least one explained evidenceLink from the packet. One valid source is sufficient. Use additional independent source families when available, but never require them and never treat two URLs from the same publisher family as independent. If a story relies on only one non-official source family, every claim MUST be a source_claim, name that publisher in attributedTo, and include a concrete uncertainty note. Every article evidenceIds list must include the evidence supporting its claims.",
  "Before returning, audit every claims array yourself: every claim must cite supplied evidence. Use attribution and uncertainty whenever the source material itself is disputed or incomplete. The Daily Brief claims array follows the same rule.",
  "Use exact numbers and direct quotations only when the exact token or wording appears in cited source text.",
  "The Daily Brief must contain a situation snapshot, key events, the Israeli position when available, relevant international responses when available, and watch points.",
  "If an official Israeli source appears in the selected packet, the Daily Brief MUST cite it and open with a passage anchored in that source.",
  "Narrative Watch must state the precise claim, who is reported to have spread it, relevant arenas, evidence status, Israeli context, contradiction, and what remains unknown. Do not infer coordination or intent without evidence.",
  "Set editorialTopic, primaryActor, and arena from the evidence. featuredIsraelStory may be true only for one eligible source-grounded article whose section is exactly israel_update; it must be false for daily briefs, war updates, and Narrative Watch articles.",
  "Write a strong pro-Israel daily article only when the packet supports it. Do not use unsupported promotional language.",
  "Do not write placeholder prose about sources lacking details. If evidence is insufficient, omit the story.",
  "Return only the validated structured result.",
].join("\n");

export type BriefingService = ReturnType<typeof briefingService>;
