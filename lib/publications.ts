import "server-only";
/* This module is the server-only public-content boundary. It deliberately
 * reads the data layer directly so server rendering never self-fetches the
 * public API or crosses an environment boundary. */
/* eslint-disable no-restricted-imports */

import { unstable_cache } from "next/cache";
import { listPublicPublicationsSchema } from "@/server/contracts/publication";
import type { PublicPublication, PublicPublicationDetail } from "@/server/contracts/publication";
import { withDatabaseRole } from "@/server/db/client";
import { publications } from "@/server/modules/publications";
import { ApiError } from "@/server/http/responses";
import { withLastGoodRead, type LastGoodValue } from "@/server/core/last-good-read";
import { publicReadCache } from "@/server/core/public-read-cache";

const lastGoodLists = new Map<string, LastGoodValue<PublicPublication[]>>();
const lastGoodDetails = new Map<string, LastGoodValue<PublicPublicationDetail>>();

const cachedPublications = unstable_cache(
  async (filters: ReturnType<typeof listPublicPublicationsSchema.parse>) =>
    withDatabaseRole("app_public", "server:public-content", () =>
      publications().listPublic(filters),
    ),
  ["public-publications-v1"],
  { tags: ["publications"], revalidate: 300 },
);

const cachedBriefingPublications = unstable_cache(
  async (filters: ReturnType<typeof listPublicPublicationsSchema.parse>) =>
    withDatabaseRole("app_public", "server:public-briefing", () =>
      publications().listBriefingPublic(filters),
    ),
  ["public-briefing-publications-v1"],
  { tags: ["publications"], revalidate: 300 },
);

const cachedPublicationDetail = unstable_cache(
  async (publicId: string) =>
    withDatabaseRole("app_public", "server:public-content", () =>
      publications().getBriefingPublicDetail(publicId),
    ),
  ["public-publication-detail-v1"],
  { tags: ["publications"], revalidate: 300 },
);

const cachedFeaturedPublications = unstable_cache(
  async () => withDatabaseRole("app_public", "server:public-content", () => publications().featured()),
  ["public-featured-publications-v1"],
  { tags: ["publications"], revalidate: 300 },
);

export async function listPublicPublications(query = ""): Promise<PublicPublication[]> {
  const raw = Object.fromEntries(new URLSearchParams(query.startsWith("?") ? query.slice(1) : query));
  const filters = listPublicPublicationsSchema.parse(raw);
  const key = `public:${JSON.stringify(filters)}`;
  return publicReadCache(key, () => withLastGoodRead(key, () => cachedPublications(filters), lastGoodLists));
}

export async function listBriefingPublications(query = ""): Promise<PublicPublication[]> {
  const raw = Object.fromEntries(new URLSearchParams(query.startsWith("?") ? query.slice(1) : query));
  const filters = listPublicPublicationsSchema.parse(raw);
  const key = `briefing:${JSON.stringify(filters)}`;
  return publicReadCache(key, () => withLastGoodRead(key, () => cachedBriefingPublications(filters), lastGoodLists));
}

export function getPublicPublication(publicId: string): Promise<PublicPublicationDetail> {
  return publicReadCache(`detail:${publicId}`, () => withLastGoodRead(publicId, () => cachedPublicationDetail(publicId), lastGoodDetails));
}

export function isMissingPublication(cause: unknown): boolean {
  return cause instanceof ApiError && cause.code === "NOT_FOUND";
}

export function featuredPublications(): Promise<PublicPublication[]> {
  return publicReadCache("featured", () => withLastGoodRead("featured", cachedFeaturedPublications, lastGoodLists));
}

/** No cache here: membership is durable; withdrawals are checked on resolution. */
export async function readHomepageSnapshot() {
  const { homepage } = await import('@/server/modules/homepage');
  return withDatabaseRole('app_public','server:homepage',()=>homepage().read());
}
export async function isLocalHomepagePreview() {
  const { homepageLocalPreview } = await import('@/server/core/config');
  return homepageLocalPreview();
}
