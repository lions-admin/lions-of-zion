import 'server-only';

import { db, withDatabaseRole, type Database } from '@/server/db/client';
import { editorialRunMessageSchema, startEditorialRunSchema, type EditorialFailure, type StartEditorialRun } from '@/server/contracts/editorial-update';
import { wholeSiteHomepageSchema, wholeSiteUpdatePackageSchema, type WholeSiteUpdatePackage } from '@/server/contracts/whole-site-update';
import { adminEmail } from '@/server/core/config';
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
      const errors: Array<{ operationKey: string | null; stage: EditorialFailure['stage']; message: string }> = [];

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
      let homepage: { editionDate: string; revision: number } | null = null;
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
              continue;
            }
            const reference = decision.publication;
            let publicationId: string;
            if (reference.operationKey) {
              const operation = completedState.operations.find(item => item.operationKey === reference.operationKey);
              const result = operation?.result as { publicationId?: string } | null;
              if (operation?.status !== 'completed' || !result?.publicationId) {
                throw new Error(`Homepage reference "${reference.operationKey}" did not complete.`);
              }
              publicationId = result.publicationId;
            } else {
              publicationId = (await publicationStore.resolveEditorialTarget(reference)).id;
            }
            await publicationStore.setHomepagePlacement(area, position, publicationId, { label: 'service:editorial-run', userId: null });
          }
        }
        const edition = await homepageService(db()).ensureEdition();
        homepage = { editionDate: edition.editionDate, revision: edition.revision };
      } catch (cause) {
        const homepageFailure = failure('homepage', null, cause);
        errors.push({ operationKey: null, stage: 'homepage', message: homepageFailure.message });
      }
      await store.finish(runId, token, {
        status: errors.length ? 'partial' : 'completed',
        publications: {
          created: completed.filter(item => item.input.action === 'create').length,
          updated: completed.filter(item => item.input.action === 'update').length,
          failed: completedState.operations.filter(item => item.status === 'failed').length,
        },
        operations: completed.map(item => item.result),
        urls: completed.map(item => (item.result as { url?: string } | null)?.url).filter((url): url is string => Boolean(url)),
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

/** Delivery is deliberately separate from publishing. A mail outage retries
 * through the outbox while the durable report remains readable in admin. */
export async function deliverEditorialRunReport(raw: unknown): Promise<void> {
  const { runId } = editorialRunMessageSchema.parse(raw);
  if (!mayActOnTheWorld()) return;
  await withDatabaseRole('app_service', 'service:editorial-report', async () => {
    const run = await editorialRepo(db()).get(runId);
    const report = run.report ?? {};
    const operations = run.operations.map(operation => operation.result).filter(Boolean);
    await sendWorkspaceEmail({
      to: adminEmail(),
      subject: `Lions of Zion editorial run — ${run.runKey}`,
      text: [
        `Run: ${run.runKey}`,
        `Status: ${run.status} at ${run.stage}`,
        `Started: ${run.startedAt?.toISOString() ?? 'not recorded'}`,
        `Finished: ${run.finishedAt?.toISOString() ?? 'not recorded'}`,
        `Report: ${JSON.stringify(report)}`,
        `Publications: ${JSON.stringify(operations)}`,
      ].join('\n'),
    });
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
    listRecent: () => store.listRecent(),
    resume: (id: string) => store.resume(id),
  };
}
