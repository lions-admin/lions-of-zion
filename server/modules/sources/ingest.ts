import "server-only";

/**
 * Runs one source through its connector and turns new items into evidence.
 *
 * The network fetch and the Blob upload happen before any transaction opens
 * — they are slow, external, and have nothing to do with Postgres, and
 * holding a database transaction open across either would turn a slow feed
 * into a held lock. Once the raw bytes are dealt with, everything about this
 * attempt — the fetch record and every new evidence row it produced — commits
 * as one unit: a `source_fetch` row whose `items_new` count does not match
 * what is actually queryable is worse than no record at all.
 */

import { notFound } from "@/server/http/responses";
import { setIdentity } from "@/server/core/versioning";
import { storeRawBytes } from "@/server/core/blob";
import { integrityHash } from "@/server/core/hash";
import { normalizePublicUrl, publisherDomain } from "@/server/core/url-normalization";
import {
  createEvidenceInTx,
  findEvidenceByContentHash,
  findEvidenceByExternalId,
  findEvidenceByUrl,
} from "@/server/modules/evidence";
import { connectorFor } from "./connectors";
import { sourceCategoryForDomain } from "./catalog";
import { sourceFamilyRepo, sourceFetchRepo, sourceRepo } from "./repo";
import type { FetchedItem } from "./connector";
import type { Actor } from "@/server/core/audit";
import type { Source, SourceFetch } from "@/server/db/schema";
import { assertBriefingResourceIsolation } from "@/server/core/config";
import { briefingLog } from "@/server/core/log";

type Tx = Parameters<typeof setIdentity>[0];
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };
type StoreRaw = typeof storeRawBytes;

export type IngestResult = { fetch: SourceFetch; evidenceCreated: number };

export async function ingestSource(
  db: unknown,
  sourceId: string,
  actor: Actor,
  opts: { storeRaw?: StoreRaw; requestId?: string } = {},
): Promise<IngestResult> {
  assertBriefingResourceIsolation();
  const storeRaw = opts.storeRaw ?? storeRawBytes;
  const run = db as Runner;

  const src = await sourceRepo(db).byId(sourceId);
  if (!src) throw notFound("Source");

  const connector = connectorFor(src.kind);
  const startedAt = new Date();
  let result: Awaited<ReturnType<typeof connector.fetch>>;
  try {
    result = await connector.fetch(src as Source);
  } catch (cause) {
    briefingLog("error", "briefing.source.failed", {
      requestId: opts.requestId,
      sourceId,
      provider: src.kind,
    }, {
      durationMs: Date.now() - startedAt.getTime(),
      errorClass: cause instanceof Error ? cause.name : "UnknownError",
    });
    throw cause;
  }
  /* Discovery rows are the durable public-evidence input. Do not preserve a
   * thin redirect, untitled result, or empty teaser merely because a provider
   * returned it: those records cannot support a traceable public article. */
  const normalizedItems = result.items.map(normalizeFetchedItem).filter(isUsableDiscoveryItem);
  const usableStatus = normalizedItems.length > 0 || result.status !== "success" ? result.status : "partial";
  const usableError = normalizedItems.length > 0 || result.status !== "success"
    ? result.errorMessage
    : "Source returned no usable direct publisher records.";
  const finishedAt = new Date();
  briefingLog(usableStatus === "success" ? "info" : "warn", "briefing.source.collected", {
    requestId: opts.requestId,
    sourceId,
    provider: src.kind,
  }, {
    status: usableStatus,
    itemsSeen: normalizedItems.length,
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  });

  let rawBlobUrl: string | null = null;
  let rawContentHash: string | null = null;
  if (result.rawBody) {
    rawContentHash = integrityHash(result.rawBody);
    rawBlobUrl = await sourceFetchRepo(db).blobForHash(sourceId, rawContentHash);
    if (!rawBlobUrl) {
      const stored = await storeRaw(
        `briefing/raw/${sourceId}/${rawContentHash}.${src.kind === "rss" ? "xml" : "json"}`,
        result.rawBody,
        result.rawContentType ?? (src.kind === "rss" ? "application/xml" : "application/json"),
      );
      rawBlobUrl = stored.url;
    }
  }

  return run.transaction(async (tx) => {
    await setIdentity(tx as Tx, actor.label);

    const decisions: Array<{
      item: FetchedItem;
      normalizedHash: string | null;
      existing: Awaited<ReturnType<typeof findEvidenceByUrl>>;
      method: "new" | "external_id" | "canonical_url" | "content_hash";
    }> = [];
    for (const item of normalizedItems) {
      const normalizedHash = item.excerpt
        ? integrityHash(normalizeText(item.title + "\n" + item.excerpt))
        : null;
      const byExternalId = await findEvidenceByExternalId(tx, sourceId, item.externalId);
      const byCanonicalUrl = !byExternalId && item.canonicalUrl
        ? await findEvidenceByUrl(tx, item.canonicalUrl)
        : undefined;
      const byContentHash = !byExternalId && !byCanonicalUrl && normalizedHash
        ? await findEvidenceByContentHash(tx, normalizedHash)
        : undefined;
      decisions.push({
        item,
        normalizedHash,
        existing: byExternalId ?? byCanonicalUrl ?? byContentHash,
        method: byExternalId ? "external_id" : byCanonicalUrl ? "canonical_url" : byContentHash ? "content_hash" : "new",
      });
    }

    const fetchRow = await sourceFetchRepo(tx).insert({
      sourceId,
      status: usableStatus,
      startedAt,
      finishedAt,
      httpStatus: result.httpStatus ?? null,
      itemsSeen: normalizedItems.length,
      itemsNew: decisions.filter((decision) => !decision.existing).length,
      errorMessage: usableError ?? null,
      searchQuery: result.query ?? null,
      rawBlobUrl,
      rawContentHash,
      rawContentType: result.rawContentType ?? null,
      rawByteSize: result.rawBody ? Buffer.byteLength(result.rawBody, "utf8") : null,
    });

    await sourceRepo(tx).recordFetchHealth(src.id, usableStatus, finishedAt, usableError);

    let created = 0;
    for (const decision of decisions) {
      const { item, normalizedHash } = decision;
      let evidenceId = decision.existing?.id;
      if (evidenceId) {
        await sourceFetchRepo(tx).insertDiscovery({
          sourceFetchId: fetchRow.id,
          discoverySourceId: sourceId,
          evidenceId,
          externalId: item.externalId,
          discoveryUrl: item.discoveryUrl ?? item.url ?? null,
          canonicalUrl: item.canonicalUrl ?? null,
          publisherDomain: item.canonicalUrl ? publisherDomain(item.canonicalUrl) : null,
          title: item.title,
          normalizedContentHash: normalizedHash,
          deduplicationMethod: decision.method,
        });
        continue;
      }
      const evidenceSourceId = await resolveEvidenceSource(tx, src, item);
      const createdEvidence = await createEvidenceInTx(
        tx,
        {
          sourceId: evidenceSourceId,
          sourceFetchId: fetchRow.id,
          kind: "article",
          dataClass: "public",
          title: item.title,
          excerpt: item.excerpt,
          externalId: item.externalId,
          url: item.canonicalUrl ?? item.url,
          discoveryUrl: item.discoveryUrl ?? item.url,
          canonicalUrl: item.canonicalUrl,
          publisherDomain: item.canonicalUrl ? publisherDomain(item.canonicalUrl) : undefined,
          normalizedContentHash: normalizedHash ?? undefined,
          usableTextLength: item.excerpt?.trim().length ?? 0,
          retrievalStatus: item.excerpt?.trim() ? "fetched" : "partial",
          accessState: "open",
          contentType: item.contentType,
          discoveryMetadata: item.discoveryMetadata,
          retentionClass: "metadata_excerpt",
          language: src.language,
          publishedAt: item.publishedAt?.toISOString(),
        },
        actor,
        { changeSource: "import", requestId: opts.requestId },
      );
      evidenceId = createdEvidence.id;
      await sourceFetchRepo(tx).insertDiscovery({
        sourceFetchId: fetchRow.id,
        discoverySourceId: sourceId,
        evidenceId,
        externalId: item.externalId,
        discoveryUrl: item.discoveryUrl ?? item.url ?? null,
        canonicalUrl: item.canonicalUrl ?? null,
        publisherDomain: item.canonicalUrl ? publisherDomain(item.canonicalUrl) : null,
        title: item.title,
        normalizedContentHash: normalizedHash,
        deduplicationMethod: "new",
      });
      created++;
    }

    return { fetch: fetchRow, evidenceCreated: created };
  });
}

function normalizeFetchedItem(item: FetchedItem): FetchedItem {
  if (!item.url && !item.canonicalUrl) return item;
  const discoveryUrl = item.discoveryUrl ?? item.url ?? item.canonicalUrl;
  const candidate = item.canonicalUrl ?? item.url;
  if (!candidate) return { ...item, discoveryUrl };
  try {
    return { ...item, discoveryUrl, canonicalUrl: normalizePublicUrl(candidate) };
  } catch {
    return { ...item, discoveryUrl, canonicalUrl: undefined, url: undefined };
  }
}

function isUsableDiscoveryItem(item: FetchedItem): boolean {
  const excerpt = item.excerpt?.trim();
  return Boolean(
    item.canonicalUrl
    && item.title.trim().length >= 8
    && excerpt
    && excerpt.length >= 20,
  );
}

function normalizeText(value: string): string {
  return value.normalize("NFKC").toLowerCase().replace(/\s+/g, " ").trim();
}

/** A discovery citation belongs to its original publisher, not to the search
 * service. New
 * publishers are inactive reference sources so later reports from the same
 * domain share a source family rather than looking independently corroborated. */
async function resolveEvidenceSource(tx: unknown, fallback: Source, item: FetchedItem): Promise<string> {
  if (!item.publisher?.homepageUrl) return fallback.id;
  const homepageUrl = item.publisher.homepageUrl.replace(/\/$/, "");
  const sources = sourceRepo(tx);
  const existing = await sources.byHomepageUrl(homepageUrl);
  if (existing) return existing.id;

  const host = new URL(homepageUrl).hostname.toLowerCase().replace(/^www\./, "");
  const suffix = integrityHash(homepageUrl).slice(0, 12);
  const wire = detectWireOrigin(item);
  const familySlug = sourceFamilyIdentityForItem(item, suffix);
  const families = sourceFamilyRepo(tx);
  const family = (await families.bySlug(familySlug)) ?? await families.insert({
    slug: familySlug,
    label: wire?.label ?? item.publisher.name ?? host,
    description: wire
      ? `Syndicated reporting attributed to ${wire.label}; publisher link preserved separately.`
      : `Publisher first discovered through ${fallback.kind}: ${host}`,
  });
  const source = await sources.insert({
    sourceFamilyId: family.id,
    kind: "manual",
    slug: `publisher-${suffix}`,
    name: item.publisher.name || host,
    homepageUrl,
    feedUrl: null,
    language: fallback.language,
    country: null,
    active: false,
    config: {
      discoveredBy: fallback.kind,
      hostname: host,
      category: sourceCategoryForDomain(host),
      upstreamWire: wire?.slug ?? null,
    },
  });
  return source.id;
}

export function sourceFamilyIdentityForItem(item: FetchedItem, publisherSuffix: string): string {
  const wire = detectWireOrigin(item);
  return wire ? `wire-${wire.slug}` : `publisher-${publisherSuffix}`;
}

export function detectWireOrigin(item: FetchedItem): { slug: string; label: string } | null {
  const text = `${item.title}\n${item.excerpt ?? ""}`;
  const patterns: Array<[RegExp, string, string]> = [
    [/\bReuters\b/i, "reuters", "Reuters"],
    [/\b(?:Associated Press|AP)\b/i, "associated-press", "Associated Press"],
    [/\bAgence France-Presse\b|\bAFP\b/i, "afp", "Agence France-Presse"],
  ];
  for (const [pattern, slug, label] of patterns) {
    if (pattern.test(text)) return { slug, label };
  }
  return null;
}
