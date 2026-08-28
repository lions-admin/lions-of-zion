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
import { createEvidenceInTx, findEvidenceByExternalId, findEvidenceByUrl } from "@/server/modules/evidence";
import { connectorFor } from "./connectors";
import { sourceFamilyRepo, sourceFetchRepo, sourceRepo } from "./repo";
import type { FetchedItem } from "./connector";
import type { Actor } from "@/server/core/audit";
import type { Source, SourceFetch } from "@/server/db/schema";

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
  const storeRaw = opts.storeRaw ?? storeRawBytes;
  const run = db as Runner;

  const src = await sourceRepo(db).byId(sourceId);
  if (!src) throw notFound("Source");

  const connector = connectorFor(src.kind);
  const startedAt = new Date();
  const result = await connector.fetch(src as Source);
  const finishedAt = new Date();

  let rawBlobUrl: string | null = null;
  let rawContentHash: string | null = null;
  if (result.rawBody) {
    rawContentHash = integrityHash(result.rawBody);
    rawBlobUrl = await sourceFetchRepo(db).blobForHash(sourceId, rawContentHash);
    if (!rawBlobUrl) {
      const stored = await storeRaw(
        `sources/${sourceId}/${rawContentHash}.${src.kind === "rss" ? "xml" : "json"}`,
        result.rawBody,
        "application/xml",
      );
      rawBlobUrl = stored.url;
    }
  }

  return run.transaction(async (tx) => {
    await setIdentity(tx as Tx, actor.label);

    const newItems: FetchedItem[] = [];
    for (const item of result.items) {
      const existing =
        (await findEvidenceByExternalId(tx, sourceId, item.externalId)) ??
        (item.url ? await findEvidenceByUrl(tx, item.url) : undefined);
      if (!existing) newItems.push(item);
    }

    const fetchRow = await sourceFetchRepo(tx).insert({
      sourceId,
      status: result.status,
      startedAt,
      finishedAt,
      httpStatus: result.httpStatus ?? null,
      itemsSeen: result.items.length,
      itemsNew: newItems.length,
      errorMessage: result.errorMessage ?? null,
      searchQuery: result.query ?? null,
      rawBlobUrl,
      rawContentHash,
    });

    let created = 0;
    for (const item of newItems) {
      const evidenceSourceId = await resolveEvidenceSource(tx, src, item);
      await createEvidenceInTx(
        tx,
        {
          sourceId: evidenceSourceId,
          sourceFetchId: fetchRow.id,
          kind: "article",
          dataClass: "public",
          title: item.title,
          excerpt: item.excerpt,
          externalId: item.externalId,
          url: item.url,
          language: src.language,
          publishedAt: item.publishedAt?.toISOString(),
        },
        actor,
        { changeSource: "import", requestId: opts.requestId },
      );
      created++;
    }

    return { fetch: fetchRow, evidenceCreated: created };
  });
}

/** A Google citation belongs to its original publisher, not to Google. New
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
  const familySlug = `publisher-${suffix}`;
  const families = sourceFamilyRepo(tx);
  const family = (await families.bySlug(familySlug)) ?? await families.insert({
    slug: familySlug,
    label: item.publisher.name || host,
    description: `Publisher first discovered through Google Search: ${host}`,
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
    config: { discoveredBy: "google_search", hostname: host },
  });
  return source.id;
}
