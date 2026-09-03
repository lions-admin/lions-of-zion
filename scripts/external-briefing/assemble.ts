/**
 * Step 3 — turn collected material plus the model's draft into a full
 * `ExternalBriefingPackage`.
 *
 * The contract's `superRefine` (server/contracts/external-briefing.ts)
 * rejects a citation nobody cites and a publisher nobody's citation
 * references, so this module first works out exactly which `citationKey`s
 * the drafted edition actually uses — everywhere the contract itself checks
 * for a reference — and only then builds `citations[]` and `publishers[]`
 * from that surviving subset.
 */

import {
  EXTERNAL_BRIEFING_CONTRACT_VERSION,
  type ExternalArticle,
  type ExternalBriefingPackage,
  type ExternalCitation,
  type ExternalClaim,
  type ExternalDailyBrief,
  type ExternalPassage,
  type ExternalPublisher,
} from "@/server/contracts/external-briefing";
import type { DraftOutput } from "./draft";
import type { CollectedItem } from "./types";

const DAILY_BRIEF_SECTION_NAMES = [
  "situation",
  "keyEvents",
  "israeliPosition",
  "internationalResponses",
  "watchPoints",
] as const;

function claimCitationKeys(claims: readonly ExternalClaim[]): string[] {
  return claims.flatMap((claim) => claim.citationLinks.map((link) => link.citationKey));
}

function passageCitationKeys(passages: readonly ExternalPassage[]): string[] {
  return passages.flatMap((passage) => passage.citationKeys);
}

function citedKeysForBrief(brief: ExternalDailyBrief): string[] {
  const keys = [...brief.citationKeys, ...claimCitationKeys(brief.claims)];
  for (const name of DAILY_BRIEF_SECTION_NAMES) {
    const section = brief[name];
    if (section) keys.push(...passageCitationKeys(section.passages));
  }
  return keys;
}

function citedKeysForArticle(article: ExternalArticle): string[] {
  const keys = [
    ...article.citationKeys,
    ...claimCitationKeys(article.claims),
    ...passageCitationKeys(article.passages),
  ];
  if (article.narrativeWatch) {
    keys.push(...article.narrativeWatch.supportingCitationKeys, ...article.narrativeWatch.contradictingCitationKeys);
  }
  return keys;
}

/** Every `citationKey` referenced anywhere in the drafted edition — the same
 * set the contract's own `superRefine` computes to reject a dead citation. */
export function referencedCitationKeys(output: DraftOutput): Set<string> {
  const keys = new Set<string>(citedKeysForBrief(output.dailyBrief));
  for (const article of output.articles) {
    for (const key of citedKeysForArticle(article)) keys.add(key);
  }
  return keys;
}

/** Israel-local calendar day, YYYY-MM-DD — `en-CA` formats exactly that way. */
export function israelLocalDate(now: Date = new Date()): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(now);
}

/** GitHub Actions injects `GITHUB_RUN_ID`/`GITHUB_RUN_ATTEMPT` into every
 * step automatically; a local/manual run falls back to a timestamp. */
export function deriveRunId(now: Date = new Date()): string {
  const githubRunId = process.env.GITHUB_RUN_ID?.trim();
  const githubRunAttempt = process.env.GITHUB_RUN_ATTEMPT?.trim();
  if (githubRunId && githubRunAttempt) return `${githubRunId}-${githubRunAttempt}`;
  return `local-${now.getTime()}`;
}

export function assemblePackage(
  collected: readonly CollectedItem[],
  output: DraftOutput,
  composer: string,
  now: Date = new Date(),
): ExternalBriefingPackage {
  const cited = referencedCitationKeys(output);
  const survivingItems = collected.filter((item) => cited.has(item.citationKey));

  const citations: ExternalCitation[] = survivingItems.map((item) => ({
    key: item.citationKey,
    publisherKey: item.publisherKey,
    title: item.title,
    url: item.url,
    canonicalUrl: item.canonicalUrl,
    publishedAt: item.publishedAt,
    excerpt: item.excerpt,
    language: item.language,
  }));

  const publishersByKey = new Map<string, ExternalPublisher>();
  for (const item of survivingItems) {
    const existing = publishersByKey.get(item.publisherKey);
    if (existing) {
      // An official item on an otherwise non-official-tagged publisher still
      // marks the publisher official; never the other direction.
      if (item.official && !existing.official) existing.official = true;
      continue;
    }
    publishersByKey.set(item.publisherKey, {
      key: item.publisherKey,
      name: item.publisherName,
      homepageUrl: item.publisherHomepageUrl,
      language: item.publisherLanguage,
      country: item.publisherCountry,
      official: item.official,
    });
  }

  return {
    runId: deriveRunId(now),
    localDate: israelLocalDate(now),
    contractVersion: EXTERNAL_BRIEFING_CONTRACT_VERSION,
    composer,
    publishers: [...publishersByKey.values()],
    citations,
    dailyBrief: output.dailyBrief,
    articles: output.articles,
  };
}
