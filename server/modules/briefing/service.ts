import "server-only";

import { z } from "zod";
import { ApiError } from "@/server/http/responses";
import { briefingAiBudgets } from "@/server/core/config";
import {
  generateStructured,
  type GenerateInput,
  type StructuredGenerateOutput,
} from "@/server/core/ai/gateway";
import { aiRepo } from "@/server/modules/ai/repo";
import { recordBriefingRun } from "@/server/modules/ai";
import { items } from "@/server/modules/items";
import { narratives } from "@/server/modules/narratives";
import { publications } from "@/server/modules/publications";
import { briefingRepo, type BriefingEvidence } from "./repo";
import type { Actor } from "@/server/core/audit";
import type { CreatePublication } from "@/server/contracts/publication";

const ARTICLE_SECTIONS = ["israel_update", "war_update", "narrative_watch"] as const;

const selectionSchema = z.object({
  stories: z.array(z.object({
    title: z.string().min(1).max(300),
    section: z.enum(ARTICLE_SECTIONS),
    evidenceIds: z.array(z.uuid()).min(1).max(8),
    sourceClaim: z.string().min(1).max(2_000),
    narrativeTitle: z.string().min(1).max(300).optional(),
  })).max(8),
});

const articleSchema = z.object({
  section: z.enum(ARTICLE_SECTIONS),
  title: z.string().min(1).max(300),
  summary: z.string().min(1).max(1_200),
  body: z.string().min(80).max(20_000),
  evidenceIds: z.array(z.uuid()).min(1).max(8),
  claim: z.string().min(1).max(4_000),
  confidence: z.enum(["verified", "refuted", "misleading", "unsupported", "disputed", "unresolved"]),
  narrativeTitle: z.string().min(1).max(300).optional(),
});

const editionSchema = z.object({
  dailyBrief: z.object({
    title: z.string().min(1).max(300),
    summary: z.string().min(1).max(1_200),
    body: z.string().min(80).max(20_000),
    evidenceIds: z.array(z.uuid()).min(1).max(30),
  }),
  articles: z.array(articleSchema).max(8),
});

type Generator = <T>(
  input: GenerateInput & { schema: z.ZodType<T> },
) => Promise<StructuredGenerateOutput<T>>;

export type BriefingRunResult = {
  status: "completed" | "already_run" | "skipped";
  localDate: string;
  evidenceCount: number;
  publications: number;
};

export function israelLocalDate(now = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

export function israelLocalHour(now = new Date()): number {
  return Number(new Intl.DateTimeFormat("en-US", {
    timeZone: "Asia/Jerusalem",
    hour: "2-digit",
    hourCycle: "h23",
  }).format(now));
}

export function briefingService(
  database: unknown,
  options: { generate?: Generator; now?: () => Date } = {},
) {
  const generate = options.generate ?? generateStructured;
  const now = options.now ?? (() => new Date());

  async function assertBudget(): Promise<void> {
    const budget = briefingAiBudgets();
    const repo = aiRepo(database);
    const timestamp = now().getTime();
    const [daily, monthly] = await Promise.all([
      repo.briefingSpendSince(new Date(timestamp - 24 * 60 * 60 * 1_000)),
      repo.briefingSpendSince(new Date(timestamp - 30 * 24 * 60 * 60 * 1_000)),
    ]);
    if (daily >= budget.daily || monthly >= budget.monthly) {
      throw new ApiError("RATE_LIMITED", "The briefing-specific AI budget is exhausted.");
    }
  }

  async function run(actor: Actor, requestId?: string): Promise<BriefingRunResult> {
    const date = israelLocalDate(now());
    const store = briefingRepo(database);
    const runId = await store.acquire(date, "editorial");
    if (!runId) return { status: "already_run", localDate: date, evidenceCount: 0, publications: 0 };

    const evidence = await store.recentEvidence(new Date(now().getTime() - 36 * 60 * 60 * 1_000));
    if (!evidence.length) {
      await store.complete(runId, 0, 0);
      return { status: "skipped", localDate: date, evidenceCount: 0, publications: 0 };
    }

    try {
      await assertBudget();
      const evidenceById = new Map(evidence.map((entry) => [entry.id, entry]));
      const packet = sourcePacket(evidence);
      const triage = await generate({
        profile: "briefingTriage",
        kind: "classify",
        dataClass: "public",
        maxOutputTokens: 2_000,
        tags: ["feature:briefing", "stage:triage"],
        schema: selectionSchema,
        system: TRIAGE_SYSTEM,
        prompt: "Israel-local editorial date: " + date + "\\n\\nPublic evidence packet:\\n" + packet,
      });
      validateEvidenceIds(triage.output.stories.flatMap((story) => story.evidenceIds), evidenceById);
      await recordBriefingRun(database, {
        kind: "classify",
        model: triage.model,
        modelProfile: "briefing_triage",
        inputTokens: triage.inputTokens,
        outputTokens: triage.outputTokens,
        inputHash: triage.inputHash,
        costUsd: triage.costUsd,
        latencyMs: triage.latencyMs,
        actor,
      });

      const selected = triage.output.stories.slice(0, 8);
      if (!selected.length) {
        await store.complete(runId, evidence.length, 0);
        return { status: "skipped", localDate: date, evidenceCount: evidence.length, publications: 0 };
      }

      await assertBudget();
      const draft = await generate({
        profile: "briefingDraft",
        kind: "summarize",
        dataClass: "public",
        maxOutputTokens: 8_000,
        tags: ["feature:briefing", "stage:draft"],
        schema: editionSchema,
        system: DRAFT_SYSTEM,
        prompt:
          "Israel-local editorial date: " + date +
          "\\n\\nSelected stories:\\n" + JSON.stringify(selected) +
          "\\n\\nPublic evidence packet:\\n" + packet,
      });
      validateEvidenceIds([
        ...draft.output.dailyBrief.evidenceIds,
        ...draft.output.articles.flatMap((article) => article.evidenceIds),
      ], evidenceById);
      enforceEditionLimits(draft.output.articles);
      await recordBriefingRun(database, {
        kind: "summarize",
        model: draft.model,
        modelProfile: "briefing_draft",
        inputTokens: draft.inputTokens,
        outputTokens: draft.outputTokens,
        inputHash: draft.inputHash,
        costUsd: draft.costUsd,
        latencyMs: draft.latencyMs,
        actor,
      });

      const articleItems = await Promise.all(draft.output.articles.map((article) =>
        items().autoCreate({
          type: "claim",
          title: article.title,
          canonicalText: article.claim,
          summary: article.confidence + ": generated from linked public source material.",
          language: "en",
        }, actor, requestId),
      ));

      const narrativeIds = new Map<string, string>();
      for (const [index, article] of draft.output.articles.entries()) {
        if (article.section !== "narrative_watch" || !article.narrativeTitle) continue;
        const narrative = await narratives().autoCreateNarrative({
          slug: date + "-narrative-" + (index + 1),
          title: article.narrativeTitle,
          summary: "Monitored in the automated daily briefing for " + date + ".",
          language: "en",
        }, actor, requestId);
        await narratives().linkItem(narrative.id, {
          itemId: articleItems[index]!.id,
          rationale: "The scheduled briefing linked this source-attributed claim to the monitored narrative.",
        }, actor);
        narrativeIds.set(article.narrativeTitle, narrative.id);
      }

      const publicationsToCreate: CreatePublication[] = [
        {
          kind: "brief",
          section: "daily_brief",
          title: draft.output.dailyBrief.title,
          summary: draft.output.dailyBrief.summary,
          body: draft.output.dailyBrief.body,
          language: "en",
          evidenceIds: draft.output.dailyBrief.evidenceIds,
        },
        ...draft.output.articles.map((article, index) => ({
          kind: "news_update" as const,
          section: article.section,
          title: article.title,
          summary: article.summary,
          body: article.body,
          language: "en",
          itemIds: [articleItems[index]!.id],
          evidenceIds: article.evidenceIds,
          narrativeIds: article.section === "narrative_watch" && article.narrativeTitle
            ? [narrativeIds.get(article.narrativeTitle)!]
            : undefined,
        })),
      ];
      const published = await publications().autoPublishMany(publicationsToCreate, actor, requestId);
      await store.complete(runId, evidence.length, published.length);
      return { status: "completed", localDate: date, evidenceCount: evidence.length, publications: published.length };
    } catch (cause) {
      await store.fail(runId, evidence.length, cause instanceof Error ? cause.message : "Unknown briefing error");
      throw cause;
    }
  }

  return {
    run,
    runScheduled: async (actor: Actor, requestId?: string) =>
      israelLocalHour(now()) === 7
        ? run(actor, requestId)
        : ({ status: "skipped", localDate: israelLocalDate(now()), evidenceCount: 0, publications: 0 } satisfies BriefingRunResult),
    summary: () => briefingRepo(database).summary(),
  };
}

function validateEvidenceIds(ids: string[], evidence: Map<string, BriefingEvidence>): void {
  for (const id of ids) {
    if (!evidence.has(id)) {
      throw new ApiError("VALIDATION_ERROR", "The model referenced source material outside this collection run.");
    }
  }
}

function enforceEditionLimits(articles: z.infer<typeof articleSchema>[]): void {
  const narrative = articles.filter((article) => article.section === "narrative_watch").length;
  const general = articles.length - narrative;
  if (general > 5 || narrative > 3) {
    throw new ApiError("VALIDATION_ERROR", "The model exceeded the daily article limit.");
  }
}

function sourcePacket(evidence: BriefingEvidence[]): string {
  return evidence.map((entry) => JSON.stringify({
    id: entry.id,
    title: entry.title,
    excerpt: entry.excerpt,
    url: entry.url,
    publisher: entry.publisher,
    sourceFamilyId: entry.sourceFamilyId,
    publishedAt: entry.publishedAt?.toISOString() ?? null,
    capturedAt: entry.capturedAt.toISOString(),
  })).join("\\n");
}

const TRIAGE_SYSTEM = [
  "You are a public-source triage system for an English Israel-focused daily brief.",
  "Use only the provided evidence packet. Do not use X, private sources, memory, or unlisted URLs.",
  "Group syndicated reports with the same sourceFamilyId as one origin. Keep the official Israeli position central when present in source material, but preserve attribution and uncertainty.",
  "Select at most five general stories and three narrative-watch stories. A narrative-watch story must name a specific recurring claim or framing; it is not a verdict that the claim is false.",
  "Return only the requested structured result.",
].join("\\n");

const DRAFT_SYSTEM = [
  "You write concise English articles for Lions of Zion from a fixed public evidence packet.",
  "Use only the supplied evidence IDs. Never add a fact, quote, source, casualty figure, chronology, or citation that is absent from that packet.",
  "Present the official Israeli position first when it is among the evidence, then state other claims with clear attribution. Separate reported claims from observed facts and analysis. Where sources disagree or are incomplete, say so.",
  "Do not call anything a lie, coordinated campaign, or verified fact unless the supplied source record supports that precise statement. Narrative Watch reports monitored narratives and their evidence status, not unsupported motives.",
  "Produce one Daily Brief plus no more than five general articles and three Narrative Watch articles. Return only the requested structured result.",
].join("\\n");

export type BriefingService = ReturnType<typeof briefingService>;
