import type { BriefingSourceCategory } from "@/server/modules/sources/catalog";

/**
 * One piece of source material collected from a candidate feed or official
 * API, after recency and length filtering, and already carrying the
 * package-local `citationKey` it will use in the submitted package.
 *
 * This is the shape shared by `collect.ts` (which produces it), `draft.ts`
 * (which shows a trimmed projection of it to the model), `fixture.ts` (which
 * fabricates it directly for `--fixture`), and `assemble.ts` (which turns the
 * subset actually cited by the model into `citations[]` and `publishers[]`).
 */
export type CollectedItem = {
  /** Package-local slug, e.g. "jerusalem-post-3". Matches `packageKeySchema`. */
  citationKey: string;
  /** Catalog slug of the publisher this item came from. Matches `packageKeySchema`. */
  publisherKey: string;
  publisherName: string;
  publisherHomepageUrl: string;
  publisherLanguage: string;
  publisherCountry: string | null;
  title: string;
  url: string;
  canonicalUrl: string | null;
  /** ISO 8601 with offset — when the outlet published it. */
  publishedAt: string;
  /** HTML-stripped, entity-decoded, 200-20,000 chars. */
  excerpt: string;
  language: string;
  category: BriefingSourceCategory | null;
  /** True for a government, military or ministry publisher (category === "official_israeli"). */
  official: boolean;
};
