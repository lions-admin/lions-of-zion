import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { publicationService } from '@/server/modules/publications/service';
import type { EditorialMediaDraft } from '@/server/modules/media/repo';
import { eq, sql } from 'drizzle-orm';
import { freshDatabase, as, type TestDatabase } from '@/server/db/testing';
import type { Database } from '@/server/db/client';
import { editorialOperation, editorialRun, outbox } from '@/server/db/schema';
import { editorialRepo, editorialInputHash } from '@/server/modules/editorial-update/repo';
import { startEditorialRunSchema, type StartEditorialRun } from '@/server/contracts/editorial-update';
import { wholeSiteUpdatePackageSchema } from '@/server/contracts/whole-site-update';
import { composeEditorialRunReport, editorialUpdateService } from '@/server/modules/editorial-update/service';

let db: TestDatabase;
beforeAll(async () => { db = await freshDatabase(); }, 60000);
afterAll(async () => { await db?.$client.close(); });
const repo = () => editorialRepo(db as unknown as Database);
const request = (runId: string): StartEditorialRun => ({ runId, mode: 'operations', operations: [
  { key: 'story', action: 'create', publication: { kind: 'news_update', section: 'news', title: 'Source-linked report', body: 'A report with preserved evidence.', language: 'en' } },
  { key: 'profile', action: 'create', publication: { kind: 'news_update', section: 'people', title: 'People profile', body: 'A profile with preserved sources.', language: 'en' } },
] });

describe('durable whole-site editorial runs', () => {
  it('replays the same request and rejects conflicting run identifiers', async () => {
    const input = request('replay');
    const first = await repo().start(input, 'test:owner');
    expect((await repo().start(input, 'test:owner')).id).toBe(first.id);
    await expect(repo().start({ ...input, operations: input.operations.slice(0, 1) }, 'test:owner')).rejects.toThrow('different request');
    expect((await repo().get(first.id)).operations).toHaveLength(2);
    expect(editorialInputHash({ a: 1, b: 2 })).toBe(editorialInputHash({ b: 2, a: 1 }));
  });

  it('accepts only the operations delivery mode', () => {
    expect(startEditorialRunSchema.safeParse({ runId: 'daily:2026-09-08', mode: 'daily', operations: [] }).success).toBe(false);
    expect(startEditorialRunSchema.safeParse({ runId: 'empty-package', mode: 'operations', operations: [] }).success).toBe(true);
  });

  it('fences an expired worker after another worker reclaims the run', async () => {
    const run = await repo().start(request('lease'), 'test:owner');
    const now = new Date('2026-09-06T07:00:00Z');
    const first = await repo().claim(run.id, now);
    expect(await repo().claim(run.id, now)).toBeNull();
    const later = new Date(now.getTime() + 301_000);
    const second = await repo().claim(run.id, later);
    expect(second?.leaseToken).not.toBe(first?.leaseToken);
    await expect(repo().checkpoint(run.id, first!.leaseToken!, 'publication', later)).rejects.toThrow('lease expired');
    await repo().checkpoint(run.id, second!.leaseToken!, 'publication', later);
  });

  it('preserves finished work and prepared media across failure and resume', async () => {
    const run = await repo().start(request('recovery'), 'test:owner');
    const worker = await repo().claim(run.id);
    const publish = vi.fn(async () => ({ publicId: 'canonical-story', url: '/articles/canonical-story' }));
    await repo().completeOperation(run.id, worker!.leaseToken!, 'story', publish);
    await repo().completeOperation(run.id, worker!.leaseToken!, 'story', publish);
    expect(publish).toHaveBeenCalledTimes(1);
    await repo().saveArtifact(run.id, worker!.leaseToken!, 'profile', { mediaId: 'stored-asset', generationId: 'generation-once' });
    await repo().fail(run.id, worker!.leaseToken!, { stage: 'publication', operationKey: 'profile', message: 'Interrupted write', recovery: 'Resume the existing run.' });
    expect((await repo().get(run.id)).status).toBe('partial');
    await repo().resume(run.id);
    const resumed = await repo().get(run.id);
    expect(resumed.operations[0].status).toBe('completed');
    expect(resumed.operations[1].artifact).toEqual({ mediaId: 'stored-asset', generationId: 'generation-once' });
    const next = await repo().claim(run.id);
    await expect(repo().finish(run.id, next!.leaseToken!, {})).rejects.toThrow('unfinished');
    await repo().completeOperation(run.id, next!.leaseToken!, 'profile', async () => ({ publicId: 'profile' }));
    expect((await repo().finish(run.id, next!.leaseToken!, { publications: ['canonical-story', 'profile'] })).status).toBe('completed');
    expect(await repo().claim(run.id)).toBeNull();
  });

  it('rolls back operation side effects when its publication transaction fails', async () => {
    const run = await repo().start(request('rollback'), 'test:owner');
    const worker = await repo().claim(run.id);
    await expect(repo().completeOperation(run.id, worker!.leaseToken!, 'story', async tx => {
      await tx.update(editorialOperation).set({ artifact: { mustRollback: true } }).where(eq(editorialOperation.runId, run.id));
      throw new Error('Simulated failed publication');
    })).rejects.toThrow('Simulated');
    const state = await repo().get(run.id);
    expect(state.operations.every(operation => operation.artifact === null && operation.status === 'pending')).toBe(true);
  });

  it('keeps private run inputs inaccessible to public database readers', async () => {
    await expect(as(db, 'app_public', null, tx => tx.execute(sql`SELECT * FROM editorial_run`))).rejects.toThrow();
    await expect(as(db, 'app_public', null, tx => tx.execute(sql`SELECT * FROM editorial_operation`))).rejects.toThrow();
    await as(db, 'app_service', 'service:editorial', async tx => {
      const created = await editorialRepo(tx as unknown as Database).start(request('service-write'), 'service:editorial');
      expect(created.id).toBeTruthy();
    });
    await expect(as(db, 'app_staff', 'staff:editorial', tx => tx.delete(editorialRun))).rejects.toThrow();
  });

  it('publishes and updates one canonical story with media, provenance, and version history', async () => {
    const input = request('publish');
    const run = await repo().start(input, 'test:owner');
    const worker = await repo().claim(run.id);
    const media: EditorialMediaDraft = {
      src: '/images/test-editorial.webp', width: 1536, height: 1024,
      alt: 'Editorial test illustration', caption: null, credit: 'Lions of Zion', sourceUrl: null, originUrl: null,
      disclosure: 'Editorial illustration — not evidence', role: 'editorial-illustration',
      focalPoint: { x: 50, y: 50 }, sensitivity: 'safe',
      rights: { status: 'cleared', basis: 'Original editorial illustration', reference: 'test generation', clearedAt: '2026-09-06', surfaces: ['homepage', 'article'] },
      contentHash: 'b'.repeat(64), byteSize: 12000, contentType: 'image/webp', generated: true, provenance: { runId: run.id },
    };
    let publicationId = '';
    const first = await repo().completeOperation(run.id, worker!.leaseToken!, 'story', async tx => {
      const row = await publicationService(tx).applyEditorial(input.operations[0], { runId: run.id, machineAuthor: 'machine:editorial' }, media, { label: 'service:editorial' });
      publicationId = row.id;
      return { publicId: row.publicId, publishedAt: row.publishedAt!.toISOString() };
    });
    const original = await publicationService(db).getBriefingPublicDetail(first.publicId as string);
    expect(original.media?.src).toBe(media.src);
    expect(original.corrections).toHaveLength(0);
    expect((await publicationService(db).get(publicationId)).briefingRunId).toBeNull();
    expect((await publicationService(db).get(publicationId)).editorialRunId).toBe(run.id);
    await publicationService(db).applyEditorial({ key: 'development', action: 'update', publicationId,
      publication: { body: 'Updated evidence and new development.', changeSummary: 'Added a confirmed development' } },
      { runId: run.id, machineAuthor: 'machine:editorial' }, media, { label: 'service:editorial' });
    const updated = await publicationService(db).getBriefingPublicDetail(first.publicId as string);
    expect(updated.publicId).toBe(original.publicId);
    expect(updated.publishedAt).toBe(original.publishedAt);
    expect(updated.body).toContain('new development');
    expect(updated.corrections).toHaveLength(1);
    expect(updated.corrections[0].summary).toBe('Added a confirmed development');
    expect(updated.media).toEqual(original.media);
    await expect(publicationService(db).applyEditorial(input.operations[1], { runId: run.id, machineAuthor: 'machine:editorial' },
      { ...media, contentHash: 'c'.repeat(64), rights: { ...media.rights, status: 'unknown' } }, { label: 'service:editorial' })).rejects.toThrow('cleared');
  });


  /* The report is the whole point of a run the owner does not watch. It was
     unreachable in both directions: `editorial.run-report` sat in
     `RETIRED_TOPICS` with nothing left to emit it, so `deliverEditorialRunReport`
     stayed registered as a consumer for a topic no transaction ever produced. */
  it('emits a report job when a run reaches a terminal state, in both directions', async () => {
    const finished = await repo().start(request('report-emitted'), 'test:owner');
    const worker = await repo().claim(finished.id);
    await repo().completeOperation(finished.id, worker!.leaseToken!, 'story', async () => ({ publicId: 'a' }));
    await repo().completeOperation(finished.id, worker!.leaseToken!, 'profile', async () => ({ publicId: 'b' }));
    await repo().finish(finished.id, worker!.leaseToken!, { status: 'completed' });

    const crashed = await repo().start(request('report-crashed'), 'test:owner');
    const crashedWorker = await repo().claim(crashed.id);
    await repo().fail(crashed.id, crashedWorker!.leaseToken!, {
      stage: 'homepage', operationKey: null, message: 'Homepage composition threw.', recovery: 'Resume the run.',
    });

    const queued = await db.select().from(outbox).where(eq(outbox.topic, 'editorial.run-report'));
    const runIds = queued.map(row => (row.payload as { runId?: string }).runId);
    expect(runIds).toContain(finished.id);
    expect(runIds).toContain(crashed.id);
    expect(queued.every(row => row.publishedAt === null)).toBe(true);
  });

  it('reports destinations, homepage moves, refusals, recommendations and the next action', async () => {
    const run = await repo().start(request('report-content'), 'test:owner');
    const worker = await repo().claim(run.id);
    await repo().completeOperation(run.id, worker!.leaseToken!, 'story', async () => ({
      publicationId: '11111111-1111-4111-8111-111111111111', publicId: 'source-linked-report',
      url: '/articles/source-linked-report', action: 'create', section: 'news',
      title: 'Source-linked report', hasMedia: true,
    }));
    await repo().failOperation(run.id, worker!.leaseToken!, 'profile', {
      stage: 'media', operationKey: 'profile', message: 'Image URL returned HTTP 404.',
      recovery: 'Replace the image and resume the run.',
    });
    await repo().finish(run.id, worker!.leaseToken!, {
      status: 'partial',
      publications: { created: 1, updated: 0, failed: 1, requested: 2 },
      byCategory: { news: { created: 1, updated: 0 } },
      urls: ['/articles/source-linked-report'],
      homepage: { editionDate: '2026-09-06', revision: 2, changes: [
        { area: 'news', position: 'lead', action: 'set', publicId: 'source-linked-report', url: '/articles/source-linked-report' },
        { area: 'people', position: 'secondary', action: 'remove', publicId: null, url: null },
      ] },
      media: { prepared: 1, reused: 0, generated: 1 },
      errors: [{ operationKey: 'profile', stage: 'media', message: 'Image URL returned HTTP 404.' }],
      siteRecommendations: ['Give the People desk a second lead.'],
    });

    const { subject, text } = composeEditorialRunReport(await repo().get(run.id));
    expect(subject).toContain('PARTIAL');
    /* Per category, by the section's own reading name and its hub. */
    expect(text).toContain('News & Analysis');
    /* A full URL, not a path: the owner opens this from a mail client. */
    expect(text).toContain('/articles/source-linked-report');
    expect(text).toMatch(/https?:\/\/[^\s]+\/articles\/source-linked-report/);
    /* Homepage: what moved, and the slot that was cleared. */
    expect(text).toContain('News & Analysis / lead');
    expect(text).toContain('The People of Israel / secondary: cleared');
    /* The veto, its stage, its reason and its remedy. */
    expect(text).toContain('NOT PUBLISHED / VETOED');
    expect(text).toContain('Image URL returned HTTP 404.');
    expect(text).toContain('Replace the image and resume the run.');
    expect(text).toContain('Give the People desk a second lead.');
    /* Failure detail: stage, what already succeeded, retry safety, next step. */
    expect(text).toContain('Stage reached: media');
    expect(text).toContain('Failing operations: profile');
    expect(text).toContain('Succeeded before the failure: 1 of 2');
    expect(text).toContain('Retry safe: yes');
    expect(text).toContain(`/api/v1/admin/editorial-update/${run.id}`);
    expect(text).toContain('editorial illustrations: 1');
  });

  it('rejects duplicate operation identities before storage', () => {
    const input = request('invalid');
    input.operations.push(input.operations[0]);
    expect(startEditorialRunSchema.safeParse(input).success).toBe(false);
  });

  it('uses canonical story identity for an update and rejects conflicting identifiers', async () => {
    const input = request('canonical-target');
    input.operations[0]!.publication.canonicalStoryId = 'northern-front-developing-story';
    const run = await repo().start(input, 'test:owner');
    const worker = await repo().claim(run.id);
    const created = await repo().completeOperation(run.id, worker!.leaseToken!, 'story', async tx => {
      const publication = await publicationService(tx).applyEditorial(input.operations[0]!, { runId: run.id, machineAuthor: 'machine:editorial' }, null, { label: 'service:editorial' });
      return { publicationId: publication.id, publicId: publication.publicId };
    });
    await publicationService(db).applyEditorial({
      key: 'canonical-update', action: 'update', target: { canonicalStoryId: 'northern-front-developing-story' },
      publication: { body: 'A canonical update without creating a duplicate.', changeSummary: 'Canonical update' },
    }, { runId: run.id, machineAuthor: 'machine:editorial' }, null, { label: 'service:editorial' });
    expect((await publicationService(db).get(created.publicationId as string)).body).toContain('without creating a duplicate');
    await expect(publicationService(db).applyEditorial({
      key: 'conflicting-update', action: 'update', target: { publicId: created.publicId as string, canonicalStoryId: 'not-the-same-story' },
      publication: { body: 'This must not write.', changeSummary: 'Conflicting identifiers' },
    }, { runId: run.id, machineAuthor: 'machine:editorial' }, null, { label: 'service:editorial' })).rejects.toThrow('identifiers');
  });

  it('keeps a package run idempotent across its full delivery payload', async () => {
    const pkg = wholeSiteUpdatePackageSchema.parse({
      contractVersion: 'whole-site-update-v1', runId: 'package-idempotency', composer: 'test-composer', createdAt: '2026-09-06T10:00:00.000Z',
      creates: [{ key: 'story', publication: { kind: 'news_update', section: 'news', title: 'Package story', body: 'A finished package story.', language: 'en' } }],
      updates: [], homepage: { news: { lead: { action: 'set', publication: { operationKey: 'story' } } } }, siteRecommendations: ['Keep the card concise.'],
    });
    const service = editorialUpdateService(db as unknown as Database);
    const first = await service.startWholeSite(pkg, 'external:test');
    expect((await service.startWholeSite(pkg, 'external:test')).id).toBe(first.id);
    await expect(service.startWholeSite({ ...pkg, siteRecommendations: ['Changed payload'] }, 'external:test')).rejects.toThrow('different request');
  });

  it('finishes partial after one failed operation while retaining successful work', async () => {
    const run = await repo().start(request('partial-continue'), 'test:owner');
    const worker = await repo().claim(run.id);
    await repo().completeOperation(run.id, worker!.leaseToken!, 'story', async () => ({ publicId: 'published-story' }));
    await repo().failOperation(run.id, worker!.leaseToken!, 'profile', {
      stage: 'publication', operationKey: 'profile', message: 'Broken image metadata', recovery: 'Fix the package and resume.',
    });
    expect((await repo().finish(run.id, worker!.leaseToken!, { status: 'partial', publications: { failed: 1 } })).status).toBe('partial');
  });

  it('publishes without a picture rather than blocking on a missing image, and an update with no media keeps the one already attached', async () => {
    const input = request('no-media');
    const run = await repo().start(input, 'test:owner');
    const worker = await repo().claim(run.id);
    let publicationId = '';
    const first = await repo().completeOperation(run.id, worker!.leaseToken!, 'story', async tx => {
      const row = await publicationService(tx).applyEditorial(input.operations[0], { runId: run.id, machineAuthor: 'machine:editorial' }, null, { label: 'service:editorial' });
      publicationId = row.id;
      return { publicId: row.publicId };
    });
    const published = await publicationService(db).getBriefingPublicDetail(first.publicId as string);
    expect(published.media).toBeNull();

    const media: EditorialMediaDraft = {
      src: '/images/test-editorial-2.webp', width: 1536, height: 1024,
      alt: 'Editorial test illustration', caption: null, credit: 'Lions of Zion', sourceUrl: null, originUrl: null,
      disclosure: 'Editorial illustration — not evidence', role: 'editorial-illustration',
      focalPoint: { x: 50, y: 50 }, sensitivity: 'safe',
      rights: { status: 'cleared', basis: 'Original editorial illustration', reference: 'test generation', clearedAt: '2026-09-06', surfaces: ['homepage', 'article'] },
      contentHash: 'd'.repeat(64), byteSize: 12000, contentType: 'image/webp', generated: true, provenance: { runId: run.id },
    };
    await publicationService(db).applyEditorial(
      { key: 'development', action: 'update', publicationId, publication: { body: 'Updated body with new evidence.', changeSummary: 'Added a confirmed development' } },
      { runId: run.id, machineAuthor: 'machine:editorial' }, media, { label: 'service:editorial' },
    );
    const withPicture = await publicationService(db).getBriefingPublicDetail(first.publicId as string);
    expect(withPicture.media?.src).toBe(media.src);

    await publicationService(db).applyEditorial(
      { key: 'development-2', action: 'update', publicationId, publication: { body: 'A second update, still no new picture.', changeSummary: 'Second update' } },
      { runId: run.id, machineAuthor: 'machine:editorial' }, null, { label: 'service:editorial' },
    );
    const stillWithPicture = await publicationService(db).getBriefingPublicDetail(first.publicId as string);
    expect(stillWithPicture.media?.src).toBe(media.src);
  });
});
