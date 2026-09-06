import 'server-only';

import { db, withDatabaseRole, type Database } from '@/server/db/client';
import { editorialRunMessageSchema, startEditorialRunSchema, type EditorialFailure, type StartEditorialRun } from '@/server/contracts/editorial-update';
import { wholeSiteHomepageSchema, wholeSiteUpdatePackageSchema, type WholeSiteUpdatePackage } from '@/server/contracts/whole-site-update';
import { editorialReportEmail, siteUrl } from '@/server/core/config';
import type { PublicationSection } from '@/server/contracts/enums';
import { publicationSectionLabel, routePublication } from '@/lib/publication-routing';
import { materializeExternalMedia } from '@/server/modules/media/service';
import type { EditorialMediaDraft } from '@/server/modules/media/repo';
import { publicationService } from '@/server/modules/publications/service';
import { homepageService } from '@/server/modules/homepage/service';
import { mayActOnTheWorld } from '@/server/core/config';
import { sendWorkspaceEmail } from '@/server/core/email';
import { editorialRepo } from './repo';

type PreparedArtifact = { media: EditorialMediaDraft | null };

type HomepageArea = 'news' | 'fakeResistance' | 'people';
type HomepagePosition = 'lead' | 'secondary';

/** One homepage slot this run actually moved. */
type HomepageChange = {
  area: HomepageArea;
  position: HomepagePosition;
  action: 'set' | 'remove';
  publicId: string | null;
  url: string | null;
};

/** What `completeOperation` records for a published or updated record. */
type EditorialOperationResult = {
  publicationId?: string;
  publicId?: string;
  canonicalStoryId?: string | null;
  url?: string;
  action?: 'create' | 'update';
  section?: PublicationSection;
  title?: string;
  hasMedia?: boolean;
};

/** Compile the external package to durable internal operations without losing
 * its delivery metadata, which is part of idempotency and the final report. */
export function compileWholeSiteUpdate(pkg: WholeSiteUpdatePackage): StartEditorialRun {
  return startEditorialRunSchema.parse({
    runId: pkg.runId,
    mode: 'operations',
    operations: [
      ...pkg.creates.map(item => ({ key: item.key, action: 'create' as const, publication: item.publication, media: item.media })),
      ...pkg.updates.map(item => ({ key: item.key, action: 'update' as const, target: item.target, publication: item.publication, media: item.media })),
    ],
    delivery: {
      contractVersion: pkg.contractVersion,
      composer: pkg.composer,
      createdAt: pkg.createdAt,
      homepage: pkg.homepage,
      siteRecommendations: pkg.siteRecommendations,
    },
  });
}

function failure(stage: EditorialFailure['stage'], operationKey: string | null, cause: unknown): EditorialFailure {
  const message = cause instanceof Error ? cause.message : String(cause);
  return {
    stage,
    operationKey,
    message,
    recovery: operationKey
      ? `Resume the run after resolving the ${stage} issue for operation "${operationKey}".`
      : `Resume the run after resolving the ${stage} issue.`,
  };
}

/**
 * Executes one durable run. Fetching and Blob writes happen before the short
 * publication transaction; the saved artifact makes a retry reuse them.
 */
export async function processEditorialRun(raw: unknown): Promise<void> {
  const { runId } = editorialRunMessageSchema.parse(raw);
  await withDatabaseRole('app_service', 'service:editorial-run', async () => {
    const store = editorialRepo(db());
    const claimed = await store.claim(runId);
    if (!claimed) return;
    const token = claimed.leaseToken!;
    try {
      const state = await store.get(runId);
      let preparedMedia = 0;
      let reusedMedia = 0;
      let generatedMedia = 0;
      const errors: Array<{ operationKey: string | null; stage: EditorialFailure['stage']; message: string; recovery?: string }> = [];

      for (const persisted of state.operations) {
        if (persisted.status === 'completed') continue;
        const operation = persisted.input;
        let stage: EditorialFailure['stage'] = 'media';
        try {
          let artifact = persisted.artifact as PreparedArtifact | null;
          if (!artifact) {
            /* Media stays enrichment rather than a package-wide stop. A media
             * failure marks only this operation failed and the next item runs. */
            if (operation.media) {
              const media = await materializeExternalMedia(operation.media, {
                runId,
                candidateKey: operation.key,
                composer: 'whole-site-editorial',
              });
              await store.saveArtifact(runId, token, operation.key, { media });
              artifact = { media };
              preparedMedia += 1;
            } else {
              artifact = { media: null };
            }
          } else {
            reusedMedia += 1;
          }
          if (artifact.media?.generated) generatedMedia += 1;

          stage = 'publication';
          await store.completeOperation(runId, token, operation.key, async tx => {
            const publication = await publicationService(tx).applyEditorial(
              operation,
              { runId, machineAuthor: 'whole-site-editorial' },
              artifact!.media,
              { label: 'service:editorial-run', userId: null },
            );
            return {
              publicationId: publication.id,
              publicId: publication.publicId,
              canonicalStoryId: publication.canonicalStoryId,
              url: `/articles/${publication.publicId}`,
              action: operation.action,
              /* Recorded on the result rather than derived from the operation
                 input at report time: an update names no section, and the row
                 is the only place the destination of an updated record is
                 actually known. This is what makes the per-category count in
                 the owner's report true for updates as well as creates. */
              section: publication.section,
              title: publication.title,
              hasMedia: Boolean(artifact!.media),
            };
          });
        } catch (cause) {
          const itemFailure = failure(stage, operation.key, cause);
          await store.failOperation(runId, token, operation.key, itemFailure);
          errors.push({ operationKey: operation.key, stage, message: itemFailure.message });
        }
      }

      await store.checkpoint(runId, token, 'homepage');
      const completedState = await store.get(runId);
      const completed = completedState.operations.filter(item => item.status === 'completed');
      let homepage: { editionDate: string; revision: number; changes: HomepageChange[] } | null = null;
      /* Recorded as they are applied. A placement the package did not name is
         deliberately absent rather than listed as unchanged — the loop below
         skips it, so whatever already occupies that slot survives the run, and
         the report states only what this run actually moved. */
      const homepageChanges: HomepageChange[] = [];
      try {
        const delivery = completedState.request.delivery;
        if (delivery) {
          const decisions = wholeSiteHomepageSchema.parse(delivery.homepage);
          const publicationStore = publicationService(db());
          const areas: readonly HomepageArea[] = ['news', 'fakeResistance', 'people'];
          const positions: readonly HomepagePosition[] = ['lead', 'secondary'];
          for (const area of areas) for (const position of positions) {
            const decision = decisions[area]?.[position];
            if (!decision) continue;
            if (decision.action === 'remove') {
              await publicationStore.setHomepagePlacement(area, position, null, { label: 'service:editorial-run', userId: null });
              homepageChanges.push({ area, position, action: 'remove', publicId: null, url: null });
              continue;
            }
            const reference = decision.publication;
            let publicationId: string;
            let publicId: string | null = null;
            if (reference.operationKey) {
              const operation = completedState.operations.find(item => item.operationKey === reference.operationKey);
              const result = operation?.result as { publicationId?: string; publicId?: string } | null;
              if (operation?.status !== 'completed' || !result?.publicationId) {
                throw new Error(`Homepage reference "${reference.operationKey}" did not complete.`);
              }
              publicationId = result.publicationId;
              publicId = result.publicId ?? null;
            } else {
              const resolved = await publicationStore.resolveEditorialTarget(reference);
              publicationId = resolved.id;
              publicId = resolved.publicId;
            }
            await publicationStore.setHomepagePlacement(area, position, publicationId, { label: 'service:editorial-run', userId: null });
            homepageChanges.push({ area, position, action: 'set', publicId, url: publicId ? `/articles/${publicId}` : null });
          }
        }
        const edition = await homepageService(db()).ensureEdition();
        homepage = { editionDate: edition.editionDate, revision: edition.revision, changes: homepageChanges };
      } catch (cause) {
        const homepageFailure = failure('homepage', null, cause);
        errors.push({ operationKey: null, stage: 'homepage', message: homepageFailure.message, recovery: homepageFailure.recovery });
        homepage = homepageChanges.length ? { editionDate: '', revision: 0, changes: homepageChanges } : null;
      }
      const results = completed.map(item => item.result as EditorialOperationResult | null);
      /* Per destination rather than per run: "three published" says nothing
         about whether the People desk got anything. The count is keyed by the
         section the record actually carries, which routes it to its hub. */
      const byCategory: Record<string, { created: number; updated: number }> = {};
      for (const result of results) {
        if (!result?.section) continue;
        const bucket = byCategory[result.section] ?? (byCategory[result.section] = { created: 0, updated: 0 });
        if (result.action === 'update') bucket.updated += 1; else bucket.created += 1;
      }
      await store.finish(runId, token, {
        status: errors.length ? 'partial' : 'completed',
        publications: {
          created: completed.filter(item => item.input.action === 'create').length,
          updated: completed.filter(item => item.input.action === 'update').length,
          failed: completedState.operations.filter(item => item.status === 'failed').length,
          requested: completedState.operations.length,
        },
        byCategory,
        operations: results,
        urls: results.map(result => result?.url).filter((url): url is string => Boolean(url)),
        homepage,
        media: { prepared: preparedMedia, reused: reusedMedia, generated: generatedMedia },
        errors,
        siteRecommendations: completedState.request.delivery?.siteRecommendations ?? [],
      });
    } catch (cause) {
      await store.fail(runId, token, failure('report', null, cause));
      throw cause;
    }
  });
}

/* ── The run report ─────────────────────────────────────────────────────────
 *
 * The owner reads this instead of the database, so it has to answer, without
 * a follow-up question: what was asked for, what is now live and where, what
 * did not publish and why, what did the run do to the homepage, and — when a
 * run died — at which stage, on what error, with what already committed, and
 * whether pressing resume is safe.
 *
 * It is assembled from the stored run rather than from anything held in
 * memory during the run, which is what lets a crashed run report at all: the
 * failure transaction wrote the stage and the error before this ever ran.
 */

type StoredReport = {
  status?: string;
  publications?: { created?: number; updated?: number; failed?: number; requested?: number };
  byCategory?: Record<string, { created: number; updated: number }>;
  urls?: string[];
  homepage?: { editionDate?: string; revision?: number; changes?: HomepageChange[] } | null;
  media?: { prepared?: number; reused?: number; generated?: number };
  errors?: Array<{ operationKey: string | null; stage: string; message: string; recovery?: string }>;
  siteRecommendations?: string[];
};

type StoredRun = Awaited<ReturnType<ReturnType<typeof editorialRepo>['get']>>;

const HOMEPAGE_AREA_LABELS: Record<string, string> = {
  news: 'News & Analysis', fakeResistance: 'Fake Resistance', people: 'The People of Israel',
};

/** A section's own reading label, falling back to the raw value so an unknown
 *  one is reported rather than swallowed. */
function categoryLabel(section: string): string {
  try {
    return publicationSectionLabel(section as PublicationSection);
  } catch {
    return section;
  }
}

function hubOf(section: string): string {
  try {
    return routePublication(section as PublicationSection).hub;
  } catch {
    return 'Unrouted';
  }
}

function absolute(path: string): string {
  return path.startsWith('http') ? path : `${siteUrl()}${path}`;
}

export function composeEditorialRunReport(run: StoredRun): { subject: string; text: string } {
  const report = (run.report ?? {}) as StoredReport;
  const failure = run.failure as { stage?: string; message?: string; operationKey?: string | null; recovery?: string } | null;
  const results = run.operations
    .filter(operation => operation.status === 'completed')
    .map(operation => operation.result as EditorialOperationResult | null)
    .filter((result): result is EditorialOperationResult => Boolean(result));
  const failed = run.operations.filter(operation => operation.status !== 'completed');
  const delivery = run.request?.delivery;
  const recommendations = report.siteRecommendations ?? delivery?.siteRecommendations ?? [];
  const outcome = run.status === 'completed' ? 'SUCCESS' : run.status === 'partial' ? 'PARTIAL' : run.status === 'failed' ? 'FAILURE' : run.status.toUpperCase();

  const lines: string[] = [
    `Run: ${run.runKey}`,
    `Outcome: ${outcome} (status ${run.status}, stage ${run.stage})`,
    `Composer: ${delivery?.composer ?? run.requestedBy}${delivery?.contractVersion ? ` · ${delivery.contractVersion}` : ''}`,
    `Started: ${run.startedAt?.toISOString() ?? 'not recorded'}`,
    `Finished: ${run.finishedAt?.toISOString() ?? 'not recorded'}`,
    '',
    'REQUESTED',
    `  Operations delivered: ${run.operations.length} (${run.operations.filter(o => o.input.action === 'create').length} new, ${run.operations.filter(o => o.input.action === 'update').length} developing-story updates)`,
    ...run.operations.map(operation => {
      const result = operation.result as EditorialOperationResult | null;
      const title = result?.title ?? (operation.input.action === 'create' ? operation.input.publication.title : operation.input.publication.title ?? '(title unchanged)');
      return `  · ${operation.operationKey} [${operation.input.action}] ${operation.status} — ${title}`;
    }),
    '',
    'PUBLISHED',
  ];

  if (results.length) {
    for (const result of results) {
      lines.push(
        `  · ${result.title ?? result.publicId ?? 'untitled'}`,
        `      ${result.action === 'update' ? 'Updated' : 'Published'} · ${categoryLabel(result.section ?? '')} · ${hubOf(result.section ?? '')}${result.hasMedia === false ? ' · no hero image' : ''}`,
        `      ${result.url ? absolute(result.url) : 'no URL recorded'}`,
      );
    }
  } else {
    lines.push('  Nothing was published by this run.');
  }

  lines.push('', 'BY CATEGORY');
  const byCategory = report.byCategory ?? {};
  const categories = Object.keys(byCategory);
  if (categories.length) {
    for (const section of categories) {
      const counts = byCategory[section]!;
      lines.push(`  ${categoryLabel(section)} (${hubOf(section)}): ${counts.created} new, ${counts.updated} updated`);
    }
  } else {
    lines.push('  No category received a record.');
  }

  lines.push('', 'HOMEPAGE');
  const changes = report.homepage?.changes ?? [];
  if (changes.length) {
    for (const change of changes) {
      lines.push(change.action === 'remove'
        ? `  ${HOMEPAGE_AREA_LABELS[change.area] ?? change.area} / ${change.position}: cleared`
        : `  ${HOMEPAGE_AREA_LABELS[change.area] ?? change.area} / ${change.position}: ${change.publicId ?? 'set'}${change.url ? ` — ${absolute(change.url)}` : ''}`);
    }
  } else {
    lines.push('  No placement was changed; every slot kept what it already held.');
  }
  if (report.homepage?.editionDate) {
    lines.push(`  Edition ${report.homepage.editionDate}, revision ${report.homepage.revision ?? '?'}.`);
  } else {
    lines.push('  The homepage edition was not recomposed.');
  }
  lines.push('  October 7 rotates on its own and is never written by a run.');

  lines.push('', 'MEDIA',
    `  Fetched and stored: ${report.media?.prepared ?? 0} · reused from a previous attempt: ${report.media?.reused ?? 0} · editorial illustrations: ${report.media?.generated ?? 0}`,
    '  Every stored image is served from this project\'s own Blob store; nothing is hotlinked.');

  lines.push('', 'NOT PUBLISHED / VETOED');
  if (failed.length || report.errors?.length) {
    for (const operation of failed) {
      const operationFailure = operation.failure as { stage?: string; message?: string; recovery?: string } | null;
      lines.push(
        `  · ${operation.operationKey} — refused at the ${operationFailure?.stage ?? operation.stage} stage`,
        `      ${operationFailure?.message ?? 'no reason recorded'}`,
        `      ${operationFailure?.recovery ?? 'Resume the run once the cause is resolved.'}`,
      );
    }
    for (const error of report.errors ?? []) {
      if (error.operationKey) continue;
      lines.push(`  · run-level ${error.stage}: ${error.message}`);
    }
  } else {
    lines.push('  Nothing was refused.');
  }

  lines.push('', 'RECOMMENDATIONS');
  if (recommendations.length) for (const recommendation of recommendations) lines.push(`  · ${recommendation}`);
  else lines.push('  The composer sent none.');

  if (run.status === 'failed' || run.status === 'partial') {
    /* Everything a decision needs, in the order it gets asked. `resume`
       replays only the operations that did not complete, so a retry cannot
       double-publish what already went live. */
    /* A partial run has no run-level `failure` row — `finish` clears it — so
       the stage and the error come from the operations that were refused.
       Stating `run.stage` there would report "report", which is where every
       run ends and tells the owner nothing about where it actually broke. */
    const operationStages = failed.map(operation => (operation.failure as { stage?: string } | null)?.stage ?? operation.stage);
    const operationMessages = failed.map(operation => (operation.failure as { message?: string } | null)?.message).filter(Boolean);
    const runLevel = (report.errors ?? []).filter(error => !error.operationKey).map(error => `${error.stage}: ${error.message}`);
    lines.push('', 'FAILURE DETAIL',
      `  Stage reached: ${failure?.stage ?? ([...new Set([...operationStages, ...runLevel.map(entry => entry.split(':')[0]!)])].join(', ') || run.stage)}`,
      `  Error: ${failure?.message ?? ([...operationMessages, ...runLevel].join(' · ') || 'not recorded')}`,
      failure?.operationKey ? `  Failing operation: ${failure.operationKey}`
        : failed.length ? `  Failing operations: ${failed.map(operation => operation.operationKey).join(', ')}`
        : '  Failing operation: none — the run itself failed.',
      `  Succeeded before the failure: ${results.length} of ${run.operations.length} operations, listed under PUBLISHED above.`,
      `  Not published: ${failed.map(operation => operation.operationKey).join(', ') || 'none'}`,
      '  Retry safe: yes. Resuming replays only the operations that did not complete; finished work and prepared media are reused, and a completed operation is never published twice.',
      `  Next action: POST {"action":"resume"} to /api/v1/admin/editorial-update/${run.id}, or re-deliver a corrected package under a new runId.`);
  } else {
    lines.push('', 'NEXT ACTION', '  None. The run completed and every delivered operation is live.');
  }

  return { subject: `Lions of Zion editorial run — ${outcome} — ${run.runKey}`, text: lines.join('\n') };
}

/** Delivery is deliberately separate from publishing. A mail outage retries
 * through the outbox while the durable report remains readable in admin. */
export async function deliverEditorialRunReport(raw: unknown): Promise<void> {
  const { runId } = editorialRunMessageSchema.parse(raw);
  if (!mayActOnTheWorld()) return;
  await withDatabaseRole('app_service', 'service:editorial-report', async () => {
    const run = await editorialRepo(db()).get(runId);
    const { subject, text } = composeEditorialRunReport(run);
    await sendWorkspaceEmail({ to: editorialReportEmail(), subject, text });
  });
}

export function editorialUpdateService(database: Database = db()) {
  const store = editorialRepo(database);
  return {
    start: (input: Parameters<typeof store.start>[0], actor: string) => store.start(input, actor),
    async startWholeSite(raw: unknown, actor: string) {
      const pkg = wholeSiteUpdatePackageSchema.parse(raw);
      return store.start(compileWholeSiteUpdate(pkg), actor);
    },
    get: (id: string) => store.get(id),
    getByRunKey: (runKey: string) => store.getByRunKey(runKey),
    deliveryState: (id: string) => store.deliveryState(id),
    listRecent: () => store.listRecent(),
    resume: (id: string) => store.resume(id),
  };
}
