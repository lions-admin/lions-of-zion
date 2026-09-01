import "server-only";

import { db, withDatabaseRole } from "@/server/db/client";
import { briefingLog } from "@/server/core/log";
import { deriveSourceLogicalKey, sourceFamilyService, sourceService, type SourceFamilyService, type SourceService } from "./service";
import { ingestSource, type IngestResult } from "./ingest";
import { sourceRepo } from "./repo";
import { sourceFetchRepo } from "./repo";
import type { Source } from "@/server/db/schema";
import type { Actor } from "@/server/core/audit";
import {
  agentSearchEstimatedUnitCostUsd,
  agentSearchMonthlyBudgetUsd,
  agentSearchMonthlyLimit,
  briefingCollectionSourceAllowlist,
} from "@/server/core/config";
import {
  BRIEFING_ATOM_CANDIDATES,
  BRIEFING_DISCOVERY_QUERIES,
  BRIEFING_OFFICIAL_API_CANDIDATES,
  BRIEFING_PRIORITY_DOMAINS,
  BRIEFING_RSS_CANDIDATES,
} from "./catalog";

/** Lazily bound, so importing this module does not demand a DATABASE_URL. */
export const sources = (): SourceService => sourceService(db());
export const sourceFamilies = (): SourceFamilyService => sourceFamilyService(db());

/** What the ingestion cron walks: every active source of a registered kind. */
export const activeSources = (kind: Source["kind"]) => sourceRepo(db()).activeByKind(kind);

export const ingest = (sourceId: string, actor: Actor): Promise<IngestResult> =>
  ingestSource(db(), sourceId, actor);

/** Reconciles registered RSS configuration with the reviewed source catalog.
 * It never enables a source: every changed endpoint is deliberately returned
 * to pending verification and must pass a real fetch before scheduling. */
export async function syncBriefingSourceCatalog(actor: Actor): Promise<{ created: number; updated: number }> {
  return withDatabaseRole("app_service", `service:source-catalog:${actor.label}`, () =>
    syncBriefingSourceCatalogAsService(actor),
  );
}

async function syncBriefingSourceCatalogAsService(actor: Actor): Promise<{ created: number; updated: number }> {
  let stage = "list_sources";
  try {
  const current = await sources().list({ limit: 100 });
  const bySlug = new Map(current.map((source) => [source.slug, source]));
  const byLogicalKey = new Map(current
    .filter((source) => source.logicalKey)
    .map((source) => [source.logicalKey!, source]));
  const familyBySlug = new Map<string, Awaited<ReturnType<SourceFamilyService["list"]>>[number]>();
  let familiesLoaded = false;
  const ensureFamily = async (slug: string, label: string, description: string) => {
    if (!familiesLoaded) {
      stage = "list_source_families";
      for (const family of await sourceFamilies().list()) familyBySlug.set(family.slug, family);
      familiesLoaded = true;
    }
    const existing = familyBySlug.get(slug);
    if (existing) return existing;
    stage = "create_source_family";
    const createdFamily = await sourceFamilies().create({ slug, label, description });
    familyBySlug.set(slug, createdFamily);
    return createdFamily;
  };
  let created = 0;
  let updated = 0;
  for (const candidate of BRIEFING_RSS_CANDIDATES) {
    const existing = bySlug.get(candidate.slug);
    if (!existing) {
      const family = await ensureFamily(
        `outlet-${candidate.slug}`,
        candidate.name,
        `Publisher family for ${candidate.name}; upstream wire relationships are resolved during clustering.`,
      );
      stage = "create_rss_source";
      const row = await sources().create({
        sourceFamilyId: family.id,
        kind: "rss",
        slug: candidate.slug,
        logicalKey: deriveSourceLogicalKey({ kind: "rss", feedUrl: candidate.feedUrl })!,
        name: candidate.name,
        homepageUrl: candidate.homepageUrl,
        feedUrl: candidate.feedUrl,
        language: candidate.language,
        country: candidate.country,
        active: false,
        config: { category: candidate.category, verificationState: "pending" },
      }, actor);
      bySlug.set(row.slug, row);
      if (row.logicalKey) byLogicalKey.set(row.logicalKey, row);
      created++;
      continue;
    }
    if (existing.feedUrl === candidate.feedUrl && existing.name === candidate.name
      && existing.homepageUrl === candidate.homepageUrl) continue;
    stage = "update_rss_source";
    await sources().update(existing.id, {
      name: candidate.name,
      homepageUrl: candidate.homepageUrl,
      feedUrl: candidate.feedUrl,
      language: candidate.language,
      country: candidate.country,
      active: false,
      config: {
        ...(existing.config && typeof existing.config === "object" ? existing.config as Record<string, unknown> : {}),
        category: candidate.category,
        verificationState: "pending",
        verificationError: null,
      },
      changeSummary: "RSS endpoint synchronized from the reviewed briefing source catalog; live re-verification required",
    }, actor);
    updated++;
  }

  for (const candidate of [...BRIEFING_ATOM_CANDIDATES, ...BRIEFING_OFFICIAL_API_CANDIDATES]) {
    const existing = bySlug.get(candidate.slug);
    if (existing) continue;
    const isAtom = "sourceFamilySlug" in candidate;
    const family = await ensureFamily(
      isAtom ? candidate.sourceFamilySlug : `official-api-${candidate.slug}`,
      candidate.name,
      `Publisher family for ${candidate.name}; upstream relationships are resolved during clustering.`,
    );
    const row = await sources().create({
      sourceFamilyId: family.id,
      kind: isAtom ? "rss" : "api",
      slug: candidate.slug,
      logicalKey: deriveSourceLogicalKey({
        kind: isAtom ? "rss" : "api",
        feedUrl: candidate.feedUrl,
        config: "config" in candidate ? candidate.config : undefined,
      })!,
      name: candidate.name,
      homepageUrl: candidate.homepageUrl,
      feedUrl: candidate.feedUrl,
      language: candidate.language,
      country: candidate.country,
      active: false,
      config: {
        category: candidate.category,
        verificationState: "pending",
        ...(isAtom ? {} : candidate.config),
      },
    }, actor);
    bySlug.set(row.slug, row);
    if (row.logicalKey) byLogicalKey.set(row.logicalKey, row);
    created++;
  }

  for (const query of BRIEFING_DISCOVERY_QUERIES) {
    const slug = `agent-search-${query.slug}`;
    const logicalKey = deriveSourceLogicalKey({ kind: "agent_search", config: { query: query.query } });
    if (!logicalKey) continue;
    if (bySlug.has(slug) || byLogicalKey.has(logicalKey)) continue;
    const discoveryFamily = await ensureFamily(
      "briefing-agent-search",
      "Google Agent Search discovery",
      "Discovery service only. Evidence is reassigned to each original publisher.",
    );
    stage = "create_agent_search_source";
    const row = await sources().create({
      sourceFamilyId: discoveryFamily.id,
      kind: "agent_search",
      slug,
      logicalKey,
      name: `${query.name} — Agent Search`,
      language: "en",
      country: "IL",
      active: false,
      config: {
        query: query.query,
        group: query.group,
        allowedDomains: BRIEFING_PRIORITY_DOMAINS,
        verificationState: "pending",
      },
    }, actor);
    bySlug.set(row.slug, row);
    if (row.logicalKey) byLogicalKey.set(row.logicalKey, row);
    created++;
  }
  return { created, updated };
  } catch (cause) {
    briefingLog("error", "briefing.source_catalog.sync_failed", {}, {
      stage,
      errorClass: cause instanceof Error ? cause.name : "UnknownError",
    });
    throw cause;
  }
}

/** @deprecated The full catalog sync also registers missing reviewed sources. */
export const syncBriefingRssCatalog = syncBriefingSourceCatalog;

/** Google discovery is once per Israel-local day per query, with a separate
 * hard monthly ceiling. RSS retains its normal recurring cadence. */
export async function shouldCollectSource(src: Source, now = new Date()): Promise<boolean> {
  const allowlist = briefingCollectionSourceAllowlist();
  if (allowlist && !allowlist.has(src.id) && !allowlist.has(src.slug)) return false;
  const fetches = sourceFetchRepo(db());
  if (src.kind === "agent_search") {
    const monthStart = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), 1));
    const successfulQueries = await fetches.countSuccessfulForKindSince("agent_search", monthStart);
    if (successfulQueries >= agentSearchMonthlyLimit()) {
      return false;
    }
    const budget = agentSearchMonthlyBudgetUsd();
    const unitCost = agentSearchEstimatedUnitCostUsd();
    if (budget !== undefined && (unitCost === undefined || successfulQueries * unitCost >= budget)) return false;
  }
  const last = await fetches.latestForSource(src.id);
  if (!last) return true;
  if (last.status === "failed") return now.getTime() - last.startedAt.getTime() >= 2 * 60 * 60 * 1_000;
  if (src.kind === "agent_search") return israelDate(last.startedAt) !== israelDate(now);
  return now.getTime() - last.startedAt.getTime() >= sourceCadenceMinutes(src) * 60_000;
}

/** A feed's front page is commonly unchanged for several polling windows.
 * Hourly collection keeps the briefing current without repeatedly recording
 * the same 50–100 entries every few minutes. Individual sources may opt into
 * a slower cadence; no source can exceed one request per half hour. */
export function sourceCadenceMinutes(src: Pick<Source, "kind" | "config">): number {
  const config = src.config && typeof src.config === "object" ? src.config as Record<string, unknown> : {};
  const rawCadence = Number(config.cadenceMinutes);
  if (Number.isFinite(rawCadence)) return Math.max(30, Math.min(1_440, Math.floor(rawCadence)));
  if (src.kind === "rss" || src.kind === "api") return 60;
  return 60;
}

function israelDate(date: Date): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Jerusalem",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

export { sourceService, sourceFamilyService, type SourceService, type SourceFamilyService } from "./service";
export { ingestSource, type IngestResult } from "./ingest";
export { CONNECTORS } from "./connectors";
