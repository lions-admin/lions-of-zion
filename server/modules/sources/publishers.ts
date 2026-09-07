import "server-only";

/**
 * A publisher first seen through attribution, registered as a `source` row.
 *
 * Lived inside `briefing/external-publish.ts` as a private function until the
 * whole-site path needed the same answer: a composer cites an outlet by URL,
 * and the outlet has to exist as a `source` before an `evidence` row can
 * point at it. Two copies of "which source row is this publisher" would drift
 * on exactly the dedup key (`homepage_url`) that keeps one outlet one row.
 *
 * `manual` is the `source.kind` — the value the ingest fallback already uses
 * for a publisher registered by attribution rather than by its own feed. The
 * row is created inactive: nothing here schedules a fetch of the outlet.
 */

import { integrityHash } from "@/server/core/hash";
import { sourceCategoryForDomain } from "./catalog";
import type { sourceFamilyRepo, sourceRepo } from "./repo";

export type PublisherDescriptor = {
  name: string;
  homepageUrl: string;
  language?: string;
  country?: string | null;
  official?: boolean;
};

export function hostnameOf(url: string): string {
  return new URL(url).hostname.toLowerCase().replace(/^www\./, "");
}

/** The outlet's front page for a cited URL, when the composer did not say. */
export function publisherHomepageOf(url: string): string {
  const parsed = new URL(url);
  return `${parsed.protocol}//${parsed.host}`;
}

export async function resolvePublisherSource(
  sources: ReturnType<typeof sourceRepo>,
  families: ReturnType<typeof sourceFamilyRepo>,
  publisher: PublisherDescriptor,
  discoveredBy: { channel: string; composer: string },
): Promise<{ sourceId: string; sourceFamilyId: string }> {
  const homepageUrl = publisher.homepageUrl.replace(/\/$/, "");
  const existing = await sources.byHomepageUrl(homepageUrl);
  if (existing) return { sourceId: existing.id, sourceFamilyId: existing.sourceFamilyId };

  const host = hostnameOf(homepageUrl);
  const suffix = integrityHash(homepageUrl).slice(0, 12);
  const familySlug = `publisher-${suffix}`;
  const family = (await families.bySlug(familySlug)) ?? await families.insert({
    slug: familySlug,
    label: publisher.name || host,
    description: `Publisher first registered from an external submission (${discoveredBy.composer}).`,
  });
  const category = sourceCategoryForDomain(host)
    ?? (publisher.official && publisher.country === "IL" ? "official_israeli" : null);
  const created = await sources.insert({
    sourceFamilyId: family.id,
    kind: "manual",
    slug: `publisher-${suffix}`,
    name: publisher.name || host,
    homepageUrl,
    feedUrl: null,
    language: publisher.language ?? "en",
    country: publisher.country ?? null,
    active: false,
    config: {
      discoveredBy: discoveredBy.channel,
      hostname: host,
      category,
      composer: discoveredBy.composer,
      official: publisher.official ?? false,
    },
  });
  return { sourceId: created.id, sourceFamilyId: created.sourceFamilyId };
}
