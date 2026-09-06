import 'server-only';

import { db, withDatabaseRole, type Database } from '@/server/db/client';
import { editorialRunMessageSchema, type EditorialFailure } from '@/server/contracts/editorial-update';
import { adminEmail } from '@/server/core/config';
import { materializeExternalMedia } from '@/server/modules/media/service';
import type { EditorialMediaDraft } from '@/server/modules/media/repo';
import { publicationService } from '@/server/modules/publications/service';
import { homepageService } from '@/server/modules/homepage/service';
import { mayActOnTheWorld } from '@/server/core/config';
import { sendWorkspaceEmail } from '@/server/core/email';
import { editorialRepo } from './repo';

type PreparedArtifact = { media: EditorialMediaDraft | null };

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
    let activeKey: string | null = null;
    let activeStage: EditorialFailure['stage'] =
      claimed.stage === 'research' || claimed.stage === 'classification' ? 'media' : claimed.stage;
    try {
      const state = await store.get(runId);
      let preparedMedia = 0;
      let reusedMedia = 0;
      let generatedMedia = 0;

      for (const persisted of state.operations) {
        if (persisted.status === 'completed') continue;
        const operation = persisted.input;
        activeKey = operation.key;
        activeStage = 'media';
        let artifact = persisted.artifact as PreparedArtifact | null;
        if (!artifact) {
          /* No media is not a reason to block publication — the same rule
             the external-briefing path already lives by: an illustration is
             enrichment, never the record. `saveArtifact` also checkpoints the
             operation's stage, so a resumed run does not re-fetch an image it
             already materialized; skipping it for a null image just means the
             operation moves straight to the publication stage below. */
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

        activeStage = 'publication';
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
            url: `/articles/${publication.publicId}`,
            action: operation.action,
          };
        });
      }

      activeStage = 'homepage';
      await store.checkpoint(runId, token, 'homepage');
      const completed = (await store.get(runId)).operations.filter(item => item.status === 'completed');
      const homepage = await homepageService(db()).ensureEdition();
      await store.finish(runId, token, {
        status: 'completed',
        publications: {
          created: completed.filter(item => item.input.action === 'create').length,
          updated: completed.filter(item => item.input.action === 'update').length,
        },
        operations: completed.map(item => item.result),
        homepage: { editionDate: homepage.editionDate, revision: homepage.revision },
        media: { prepared: preparedMedia, reused: reusedMedia, generated: generatedMedia },
        skipped: [],
      });
    } catch (cause) {
      await store.fail(runId, token, failure(activeStage, activeKey, cause));
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
    get: (id: string) => store.get(id),
    listRecent: () => store.listRecent(),
    resume: (id: string) => store.resume(id),
  };
}
