import 'server-only';

/**
 * A package's cited sources, turned into the evidence rows a record can cite.
 *
 * `whole-site-update-v1` carries content and placement, and until 2026-09-07
 * the only way to give a record a source stack was an `evidenceIds` list of
 * internal UUIDs — which a composer working from the open web cannot know and
 * must never invent. So every record published through this path had an
 * empty "Public sources" section, and the composer's veto note of that day
 * refused to write more of them. This is the missing half: a `sources` entry
 * is a URL, a title and an outlet, and it becomes a `source` row (the outlet,
 * deduplicated on its front page) plus an `evidence` row (the page,
 * deduplicated on its canonical URL) inside the operation's own transaction,
 * so a crash leaves nothing half-attached.
 *
 * No fetch happens here. The composer read the page; the row records that it
 * was `fetched` when an excerpt came with it and `discovered` when only the
 * address did. The public source stack renders either way.
 */

import type { EditorialSource } from '@/server/contracts/editorial-update';
import type { Actor } from '@/server/core/audit';
import { createEvidenceInTx, findEvidenceByUrl } from '@/server/modules/evidence';
import { hostnameOf, publisherHomepageOf, resolvePublisherSource } from '@/server/modules/sources/publishers';
import { sourceFamilyRepo, sourceRepo } from '@/server/modules/sources/repo';

export type MaterializedSources = { evidenceIds: string[]; created: number; reused: number };

export async function materializeSources(
  tx: unknown,
  sources: readonly EditorialSource[],
  context: { composer: string; runId: string; actor: Actor; requestId?: string },
): Promise<MaterializedSources> {
  const evidenceIds: string[] = [];
  let created = 0;
  let reused = 0;
  if (!sources.length) return { evidenceIds, created, reused };

  const outlets = sourceRepo(tx);
  const families = sourceFamilyRepo(tx);
  const sourceByHomepage = new Map<string, string>();

  for (const source of sources) {
    const homepageUrl = (source.publisherUrl ?? publisherHomepageOf(source.url)).replace(/\/$/, '');
    let sourceId = sourceByHomepage.get(homepageUrl);
    if (!sourceId) {
      sourceId = (await resolvePublisherSource(outlets, families, {
        name: source.publisher ?? hostnameOf(homepageUrl),
        homepageUrl,
        language: source.language,
        official: source.official,
      }, { channel: 'whole_site_update', composer: context.composer })).sourceId;
      sourceByHomepage.set(homepageUrl, sourceId);
    }

    const canonicalUrl = source.canonicalUrl ?? source.url;
    const preexisting = await findEvidenceByUrl(tx, canonicalUrl);
    const row = await createEvidenceInTx(tx, {
      sourceId,
      kind: 'article',
      dataClass: 'public',
      title: source.title,
      excerpt: source.excerpt ?? undefined,
      url: source.url,
      canonicalUrl,
      publisherDomain: hostnameOf(source.url),
      usableTextLength: source.excerpt?.length ?? 0,
      retrievalStatus: source.excerpt ? 'fetched' : 'discovered',
      accessState: 'open',
      language: source.language,
      publishedAt: source.publishedAt ?? undefined,
    }, context.actor, { requestId: context.requestId, provenanceDetail: { runId: context.runId, composer: context.composer } });
    if (preexisting) reused += 1; else created += 1;
    if (!evidenceIds.includes(row.id)) evidenceIds.push(row.id);
  }
  return { evidenceIds, created, reused };
}
