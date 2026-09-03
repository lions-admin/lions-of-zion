import "server-only";

import { sql } from "drizzle-orm";
import { createPublicationSchema, type CreatePublication } from "@/server/contracts/publication";
import type { CodexBriefingImport } from "@/server/contracts/codex-briefing-import";
import { setIdentity } from "@/server/core/versioning";
import { integrityHash } from "@/server/core/hash";
import type { Actor } from "@/server/core/audit";
import { createEvidenceInTx } from "@/server/modules/evidence/service";
import { publicationService } from "@/server/modules/publications/service";
import { briefingRepo } from "./repo";

type Tx = Parameters<typeof setIdentity>[0];
type Runner = { transaction: <T>(fn: (tx: unknown) => Promise<T>) => Promise<T> };
type SqlDb = { execute: <T>(query: unknown) => Promise<{ rows: T[] }> };

const MACHINE_AUTHOR = "machine:codex-scheduled-briefing";

export async function importCodexBriefing(
  database: unknown,
  input: CodexBriefingImport,
  actor: Actor,
  requestId?: string,
): Promise<{ duplicate: boolean; publications: Array<{ id: string; publicId: string; section: string; title: string }> }> {
  const runner = database as Runner;
  return runner.transaction(async (tx) => {
    await setIdentity(tx as Tx, actor.label);
    const store = briefingRepo(tx);
    const stage = `codex-import:${integrityHash(input.idempotencyKey).slice(0, 24)}`;
    const acquiredRunId = await store.acquire(input.editorialDate, stage);
    const run = acquiredRunId ? { id: acquiredRunId } : await store.runByDateStage(input.editorialDate, stage);
    if (!run) throw new Error("The Codex import run could not be created or recovered.");

    const evidenceByKey = new Map<string, string>();
    for (const source of input.sources) {
      const url = new URL(source.url);
      const domain = url.hostname.toLowerCase().replace(/^www\./, "");
      const sourceId = await ensurePublisherSource(tx, domain, source.publisher);
      const evidence = await createEvidenceInTx(tx, {
        sourceId,
        kind: "article",
        dataClass: "public",
        title: source.title,
        excerpt: source.excerpt,
        externalId: integrityHash(source.url),
        url: source.url,
        discoveryUrl: source.url,
        canonicalUrl: source.url,
        publisherDomain: domain,
        normalizedContentHash: integrityHash(`${source.title}\n${source.excerpt ?? ""}\n${source.url}`),
        usableTextLength: source.excerpt?.length ?? 0,
        retrievalStatus: source.excerpt ? "partial" : "discovered",
        accessState: "open",
        contentType: "text/html",
        discoveryMetadata: { importedBy: MACHINE_AUTHOR, sourceKey: source.key },
        retentionClass: "metadata_excerpt",
        language: "en",
        publishedAt: source.publishedAt,
      }, actor, { changeSource: "workflow", requestId, provenanceDetail: { import: input.idempotencyKey } });
      evidenceByKey.set(source.key, evidence.id);
    }

    const publications = input.publications.map((entry): CreatePublication => {
      const evidenceIds = [...new Set(entry.sourceKeys.map((key) => evidenceByKey.get(key)!).filter(Boolean))];
      const details = entry.narrativeWatchDetails;
      return createPublicationSchema.parse({
        kind: entry.section === "daily_brief" ? "brief" : "news_update",
        section: entry.section,
        title: entry.title,
        summary: entry.summary,
        body: entry.body,
        language: "en",
        evidenceIds,
        editorialTopic: entry.editorialTopic,
        primaryActor: entry.primaryActor,
        arena: entry.arena,
        featuredIsraelStory: entry.featuredIsraelStory,
        narrativeWatchDetails: details ? {
          exactClaim: details.exactClaim,
          propagators: details.propagators,
          arenas: details.arenas,
          trendDirection: details.trendDirection,
          israeliPosition: details.israeliPosition,
          securityContext: details.securityContext,
          supportingEvidenceIds: details.supportingSourceKeys.map((key) => evidenceByKey.get(key)!).filter(Boolean),
          contradictingEvidenceIds: details.contradictingSourceKeys.map((key) => evidenceByKey.get(key)!).filter(Boolean),
          verificationState: details.verificationState,
          knownUnknowns: details.knownUnknowns,
          evidenceBasis: "sourced",
        } : undefined,
      });
    });

    const transactionDb: Runner = { transaction: async <T>(fn: (inner: unknown) => Promise<T>) => fn(tx) };
    const rows = await publicationService(transactionDb).autoPublishMany(publications, {
      briefingRunId: run.id,
      machineAuthor: MACHINE_AUTHOR,
      candidateKeys: input.publications.map((entry) => entry.candidateKey),
      supersedeLocalDate: input.editorialDate,
    }, actor, requestId);

    if (acquiredRunId) await store.complete(run.id, input.sources.length, rows.length);
    return {
      duplicate: !acquiredRunId,
      publications: rows.map((row) => ({ id: row.id, publicId: row.publicId, section: row.section, title: row.title })),
    };
  });
}

async function ensurePublisherSource(tx: unknown, domain: string, publisher: string): Promise<string> {
  const d = tx as SqlDb;
  const digest = integrityHash(domain);
  const familySlug = `codex-publisher-${digest.slice(0, 16)}`;
  const family = await d.execute<{ id: string }>(sql`
    INSERT INTO source_family (slug, label, description)
    VALUES (${familySlug}, ${publisher}, 'Publisher discovered by the Codex briefing import.')
    ON CONFLICT (slug) DO UPDATE SET label = EXCLUDED.label
    RETURNING id
  `);
  const homepage = `https://${domain}`;
  const source = await d.execute<{ id: string }>(sql`
    INSERT INTO source (source_family_id, kind, slug, logical_key, name, homepage_url, language, active)
    VALUES (
      ${family.rows[0]!.id}, 'manual', ${`codex-${digest.slice(0, 20)}`},
      ${`codex-import:domain:${domain}`}, ${publisher}, ${homepage}, 'en', true
    )
    ON CONFLICT (slug) DO UPDATE
    SET name = EXCLUDED.name, homepage_url = EXCLUDED.homepage_url,
        logical_key = EXCLUDED.logical_key, updated_at = now()
    RETURNING id
  `);
  return source.rows[0]!.id;
}
