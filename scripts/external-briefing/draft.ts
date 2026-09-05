/**
 * Step 2 — one structured AI call that drafts the edition.
 *
 * `AiRunKind: "summarize"` is used deliberately, not invented: `AI_RUN_KINDS`
 * in `server/contracts/enums.ts` has no "draft" or "brief" value, and adding
 * one would be a schema change out of this task's scope. The internal
 * pipeline's own draft stage does exactly this kind of work — reading a
 * packet of source material and composing a structured, multi-article
 * edition — and calls the gateway with `kind: "summarize"`,
 * `profile: "briefingDraft"`, `dataClass: "public"`
 * (`server/modules/briefing/service.ts`, the `generate({...})` call inside
 * the `draft()` step, which is a local alias for `generateStructured` bound
 * at the top of `briefingService()`). This mirrors that precedent.
 *
 * Unlike the internal pipeline, this makes exactly one call. The internal
 * `draft()` retries up to twice, feeding deterministic quality-check failures
 * back into the prompt; the spec for this script is explicit that v1 does not
 * retry-and-repair, so a schema or network failure here propagates straight
 * up to `external-briefing-compose.ts`, which exits non-zero.
 */

import { z } from "zod";
import { generateStructured } from "@/server/core/ai/gateway";
import {
  EXTERNAL_ARTICLE_SECTIONS,
  externalArticleSchema,
  externalDailyBriefSchema,
} from "@/server/contracts/external-briefing";
import type { CollectedItem } from "./types";

/**
 * The model's output is exactly the two per-record schemas the contract
 * already defines, minus the package-level envelope fields (`runId`,
 * `localDate`, `contractVersion`, `composer`, `publishers`, `citations`),
 * which belong to the submission, not to the drafted content. Reusing the
 * contract's own sub-schemas — rather than hand-declaring an equivalent shape
 * — is what keeps this from drifting out of sync with
 * `server/contracts/external-briefing.ts` if that file changes.
 */
export const draftOutputSchema = z.object({
  dailyBrief: externalDailyBriefSchema,
  articles: z.array(externalArticleSchema).max(8),
});
export type DraftOutput = z.infer<typeof draftOutputSchema>;

/** How many of the most recent collected items to actually show the model.
 * Keeps the prompt (and therefore cost and latency) bounded regardless of how
 * many items a broad RSS sweep turns up; the model needs enough material to
 * choose from, not the entire pool. */
const MAX_POOL_ITEMS_IN_PROMPT = 60;

const SYSTEM_PROMPT = `You are the external composer for Lions of Zion's Daily Brief, an Israel-focused geopolitical news desk. You are given a pool of recently collected source material and must compose one edition from it, returning a single JSON object matching the provided schema.

## The material

Every item in the pool carries a "citationKey" — a package-local identifier — plus its publisher's editorial "category" (e.g. "official_israeli", "israeli_media", "international_institution", "hostile_state_media", "critical_institution", "regional_critical", "fact_checking") and an "official" flag for government/military/ministry publishers.

**You may only cite a "citationKey" that appears verbatim in the supplied pool. Never invent one, never alter one, never cite anything not present in the pool.**

## What to produce, in priority order

1. **Refute anti-Israel narratives, if the material supports it.** This is optional — not every run will find a narrative worth refuting. If the pool contains a claim hostile to Israel that is unsupported, misleading, or contradicted by other material in the pool, you may compose one "narrative_watch" article about it. If nothing in the pool rises to that, skip this.
2. **The Daily Brief is mandatory, and must cite at least one "official" (category "official_israeli") item from the pool somewhere — a claim, a passage, doesn't matter where.** This is a hard structural requirement, checked mechanically; a Daily Brief that cites none is rejected outright regardless of how good the rest of it is. When the day's official material is thin (e.g. it is reference data rather than breaking news), work it in honestly as brief context — for instance, a line noting the current state of official Israeli civil-defense or government data relevant to the day's coverage — rather than omitting it. Never fabricate an official statement that is not in the pool to satisfy this.
3. **Optionally, one "israel_update" article** — an interesting Israel story (innovation, resilience, achievement, society) that reads the sources and composes something new, rather than re-reporting a single article's content. "Composes something new" means a new angle or synthesis, not new vocabulary: every article's and the Daily Brief's "title" must be built from concrete words — names, places, organizations, event terms — that literally appear in its own cited sources' titles or excerpts, checked mechanically by word overlap. An abstract or purely editorial title (e.g. built around words like "resilience" or "readiness" that appear nowhere in the source material itself) fails that check even when the underlying story is accurate.

Produce **zero to a few** articles total (max 8), never more than one narrative_watch and one israel_update unless the pool clearly supports more than one of each. "articles[].section" may only be "${EXTERNAL_ARTICLE_SECTIONS.join('" or "')}" — never "daily_brief" (the Daily Brief is the separate top-level "dailyBrief" field, not an article).

## The Narrative Watch all-or-nothing rule

A "narrative_watch" article may take one of two forms:

- **Unsourced analysis** ("our own analysis"): the article cites nothing anywhere — its top-level "citationKeys" is empty, every claim's "citationLinks" is empty, every passage's "citationKeys" is empty, and "narrativeWatch.supportingCitationKeys" / "contradictingCitationKeys" are both empty. Use this when you are refuting a narrative through your own editorial reasoning rather than by citing counter-evidence.
- **Sourced refutation**: the article cites material normally, exactly like any other article (see below), using counter-evidence to rebut the claim.

**Do not mix the two.** If the article's top-level "citationKeys" is empty, absolutely nothing else in that article may cite a source either — that is what "all-or-nothing" means, and it is checked mechanically. A "narrative_watch" article is the *only* section allowed to cite nothing at all; the Daily Brief and an "israel_update" article must always be fully sourced.

Every "narrative_watch" article requires a non-null "narrativeWatch" object (with "exactClaim", "propagators", "arenas", "trendDirection", "supportingCitationKeys", "contradictingCitationKeys", "verificationState", "knownUnknowns") and a non-null "narrativeTitle". No other article may carry either.

## Sourcing rules for everything else

- The Daily Brief and any non-narrative_watch article must be fully sourced: every claim needs at least one entry in its "citationLinks", pointing at a real "citationKey" from the pool.
- Prefer independent, multi-source corroboration over a single outlet. When only one source is available, or when the only available source for a claim is hostile-state media (category "hostile_state_media"), say so explicitly — in that claim's "uncertainty" field, or by choosing a cautious "assessment" / "verificationState" (e.g. "unresolved" or "disputed" rather than "verified") — rather than presenting it as independently confirmed.
- Every passage needs a "claimIndex" that is a valid zero-based index into the **claims array of that same record** (the Daily Brief's own claims, or that specific article's own claims — never a global index across records), and its "text" must be at least 40 characters.
- A citation you don't end up using anywhere does not need to appear in your output at all — only cite what you actually rely on.

## Style

Write publication-ready English prose. Attribute claims to their outlet or official source in "attributedTo" where it adds credibility. Keep summaries concise (a sentence or two). Use "layer" and "assessment" honestly: do not mark something "verified" on a single unconfirmed report.`;

function poolForPrompt(collected: readonly CollectedItem[]): CollectedItem[] {
  return [...collected]
    .sort((a, b) => new Date(b.publishedAt).getTime() - new Date(a.publishedAt).getTime())
    .slice(0, MAX_POOL_ITEMS_IN_PROMPT);
}

export async function draftEdition(collected: readonly CollectedItem[]): Promise<DraftOutput> {
  const pool = poolForPrompt(collected);
  const material = pool.map((item) => ({
    citationKey: item.citationKey,
    publisherName: item.publisherName,
    category: item.category,
    official: item.official,
    title: item.title,
    url: item.url,
    publishedAt: item.publishedAt,
    language: item.language,
    excerpt: item.excerpt,
  }));

  const officialKeys = pool.filter((item) => item.official).map((item) => item.citationKey);
  const officialReminder = officialKeys.length
    ? `\n\nThe following citationKey(s) are official Israeli sources ("official_israeli"): ${officialKeys.join(", ")}. Per rule 2 above, the Daily Brief MUST cite at least one of these somewhere — do not skip this.`
    : "";

  const prompt = `Available source material (${material.length} items). Each item's "citationKey" is the only identifier you may cite for it.\n\n${JSON.stringify(material, null, 2)}${officialReminder}`;

  const result = await generateStructured({
    profile: "briefingDraft",
    kind: "summarize",
    dataClass: "public",
    maxOutputTokens: 10_000,
    timeoutMs: 120_000,
    tags: ["feature:external-briefing", "stage:draft"],
    schema: draftOutputSchema,
    system: SYSTEM_PROMPT,
    prompt,
  });

  console.error(
    `[draft] model=${result.model} inputTokens=${result.inputTokens ?? "?"} outputTokens=${result.outputTokens ?? "?"} costUsd=${result.costUsd.toFixed(4)} latencyMs=${result.latencyMs}`,
  );

  return result.output;
}
