import { afterAll, beforeAll, describe, expect, it, vi } from 'vitest';
import { publicationService } from '@/server/modules/publications/service';
import type { EditorialMediaDraft } from '@/server/modules/media/repo';
import { eq, sql } from 'drizzle-orm';
import { freshDatabase, as, type TestDatabase } from '@/server/db/testing';
import type { Database } from '@/server/db/client';
import { editorialOperation, editorialRun } from '@/server/db/schema';
import { editorialRepo, editorialInputHash } from '@/server/modules/editorial-update/repo';
import { startEditorialRunSchema, type StartEditorialRun } from '@/server/contracts/editorial-update';

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

  it('accepts only explicit package operations', () => {
    expect(startEditorialRunSchema.safeParse({ runId: 'daily:2026-09-08', mode: 'daily', operations: [] }).success).toBe(false);
    expect(startEditorialRunSchema.safeParse({ runId: 'empty-package', mode: 'operations', operations: [] }).success).toBe(false);
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

  it('rejects duplicate operation identities before storage', () => {
    const input = request('invalid');
    input.operations.push(input.operations[0]);
    expect(startEditorialRunSchema.safeParse(input).success).toBe(false);
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
