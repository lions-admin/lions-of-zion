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
import { materializeSources } from './sources';

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
  /** Cited pages materialized as evidence and linked to the record. */
  sources?: number;
};

/** Compile the external package to durable internal operations without losing
 * its delivery metadata, which is part of idempotency and the final report. */
export function compileWholeSiteUpdate(pkg: WholeSiteUpdatePackage): StartEditorialRun {
  return startEditorialRunSchema.parse({
    runId: pkg.runId,
    mode: 'operations',
    operations: [
      ...pkg.creates.map(item => ({ key: item.key, action: 'create' as const, publication: item.publication, media: item.media, sources: item.sources })),
      ...pkg.updates.map(item => ({ key: item.key, action: 'update' as const, target: item.target, publication: item.publication, media: item.media, sources: item.sources })),
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

/**
 * The driver's own words, dug out of the error it was wrapped in.
 *
 * Drizzle reports a query fault as `Failed query: select …` and puts the
 * reason — permission denied, column does not exist, connection terminated —
 * in `cause`, sometimes with a Postgres `code` beside it. Run
 * `chatgpt-test-2026-09-07-0332-k4m9` failed on such an error and recorded
 * only the SQL, so the reason existed nowhere: not in the run, not on the
 * status endpoint, not in the Action. One level of unwrapping is enough for
 * every error shape this pipeline throws.
 */
function describeCause(cause: unknown): string | undefined {
  if (!(cause instanceof Error)) return undefined;
  const inner = (cause as { cause?: unknown }).cause;
  const parts: string[] = [];
  if (inner instanceof Error) {
    const code = (inner as { code?: unknown }).code;
    parts.push(`${inner.name}: ${inner.message}`);
    if (typeof code === 'string' && code) parts.push(`code=${code}`);
  } else if (typeof inner === 'string' && inner) {
    parts.push(inner);
  }
  const code = (cause as { code?: unknown }).code;
  if (typeof code === 'string' && code) parts.push(`code=${code}`);
  if (cause.name && cause.name !== 'Error') parts.unshift(cause.name);
  return parts.length ? parts.join(' · ') : undefined;
}

function failure(stage: EditorialFailure['stage'], operationKey: string | null, cause: unknown): EditorialFailure {
  const message = cause instanceof Error ? cause.message : String(cause);
  const described = describeCause(cause);
  return {
    stage,
    operationKey,
    message,
    ...(described ? { cause: described } : {}),
    recovery: operationKey
      ? `Resume the run after resolving the ${stage} issue for operation "${operationKey}".`
      : `Resume the run after resolving the ${stage} issue.`,
  };
}

/**
 * How many workers may try a run before its run-level fault is called
 * terminal. Three: enough to ride out a database that was scaled to zero, a
 * dropped pooled connection or a deploy swapping underneath the worker, and
 * few enough that a genuinely broken run reaches a person quickly. The queue
 * redelivers on the rethrow, so these are redeliveries, not a loop here.
 */
const MAX_RUN_ATTEMPTS = 3;

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
            const actor = { label: 'service:editorial-run', userId: null };
            /* Cited pages become evidence in this same transaction, so the
               record and its source stack commit together or not at all. A
               create cites them through `evidenceIds`, which also settles
               `evidenceBasis`; an update attaches them to the live record
               beside whatever it already cites. */
            const cited = await materializeSources(tx, operation.sources ?? [], {
              composer: state.request.delivery?.composer ?? 'whole-site-editorial', runId, actor,
            });
            const input = operation.action === 'create' && cited.evidenceIds.length
              ? { ...operation, publication: { ...operation.publication, evidenceIds: [...new Set([...(operation.publication.evidenceIds ?? []), ...cited.evidenceIds])] } }
              : operation;
            const publication = await publicationService(tx).applyEditorial(
              input,
              { runId, machineAuthor: 'whole-site-editorial' },
              artifact!.media,
              actor,
            );
            if (operation.action === 'update' && cited.evidenceIds.length) {
              await publicationService(tx).attachEvidence(publication.id, cited.evidenceIds);
            }
            return {
              sources: cited.evidenceIds.length,
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
          /* One slot at a time, and one slot's refusal is that slot's alone.
             A single try around the whole loop used to abort every placement
             after the first refused one, so a package asking for three slots
             could lose two of them to a fault in the first — and report only
             the first. Each refusal is recorded against its own area and
             position so the composer can read exactly which request did not
             land and why, and the edition is still recomposed below with
             whatever did. */
          for (const area of areas) for (const position of positions) {
            const decision = decisions[area]?.[position];
            if (!decision) continue;
            try {
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
            } catch (cause) {
              const message = cause instanceof Error ? cause.message : String(cause);
              errors.push({
                operationKey: null, stage: 'homepage',
                message: `${area}/${position} was not placed: ${message}`,
                recovery: `Resolve the cause for ${area}/${position} and place it again in the next package; the other slots were not affected.`,
              });
            }
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
      /* A run-level fault, outside any operation. Whether it ends the run
         depends on whether anything has actually been committed and on how
         many workers have already tried: an infrastructure error that has
         published nothing is exactly what the queue's redelivery is for,
         while `fail()` would end the run for good and leave redelivery
         unable to touch it — see `releaseForRetry`. Either way the failure is
         recorded first, so the run can always say what happened to it. */
      const current = await store.get(runId).catch(() => null);
      const previous = current?.failure as EditorialFailure | null | undefined;
      const committed = current?.operations.some(operation => operation.status === 'completed') ?? false;
      const attempts = (previous?.attempts ?? 0) + 1;
      const record: EditorialFailure = { ...failure('report', null, cause), attempts };
      const retryable = !committed && attempts < MAX_RUN_ATTEMPTS;
      try {
        if (retryable) {
          await store.releaseForRetry(runId, token, {
            ...record,
            recovery: `Attempt ${attempts} of ${MAX_RUN_ATTEMPTS} failed before any operation completed; the queue will redeliver this run.`,
          });
        } else {
          await store.fail(runId, token, record);
        }
      } catch {
        /* The lease is gone or the database is unreachable — the same class of
           fault we are recording. Rethrowing below still lets the queue
           redeliver, and the lease expiry lets a later worker reclaim. */
      }
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
        `      ${result.action === 'update' ? 'Updated' : 'Published'} · ${categoryLabel(result.section ?? '')} · ${hubOf(result.section ?? '')}${result.hasMedia === false ? ' · no hero image' : ''}${result.sources ? ` · ${result.sources} source${result.sources === 1 ? '' : 's'} attached` : ''}`,
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
  /* Said outright rather than left to the per-record annotation above: a
     record without a hero is invisible to the homepage composer, so every
     homepage placement that names one is refused. Three runs shipped with
     no pictures at all before this line existed, and their reports read as
     complete successes. */
  const withoutHero = results.filter(result => result.hasMedia === false);
  if (withoutHero.length) {
    lines.push(
      `  Published WITHOUT a hero image: ${withoutHero.length} — ${withoutHero.map(result => result.publicId ?? '?').join(', ')}.`,
      '  A record without a picture still takes its homepage slot, text-led; the DNA asks for a strong hero on every new piece.',
    );
  }

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
