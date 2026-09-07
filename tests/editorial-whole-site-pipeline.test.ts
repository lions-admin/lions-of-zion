import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { sql } from 'drizzle-orm';
import { freshDatabase, type TestDatabase } from '@/server/db/testing';
import type { Database } from '@/server/db/client';
import { wholeSiteUpdatePackageSchema } from '@/server/contracts/whole-site-update';
import { compileWholeSiteUpdate } from '@/server/modules/editorial-update/service';
import { editorialRepo } from '@/server/modules/editorial-update/repo';
import { materializeSources } from '@/server/modules/editorial-update/sources';
import { publicationService } from '@/server/modules/publications/service';

/**
 * The real shape ChatGPT delivers, driven through the executor's own sequence.
 *
 * The fixture is the package from run `chatgpt-test-2026-09-07-0332-k4m9`,
 * trimmed in body length and renamed: three creates across two hubs, cited
 * `sources[]` with no excerpts and no internal UUIDs anywhere, no media, and
 * homepage placements naming operation keys. That run failed in Production on
 * a database fault before any operation ran, and nothing in the suite
 * exercised this shape end to end — so it published nothing and proved
 * nothing.
 */

let db: TestDatabase;
beforeAll(async () => { db = await freshDatabase(); }, 60000);
afterAll(async () => { await db?.$client.close(); });

const actor = { label: 'service:editorial-run', userId: null };
/**
 * The fixture, with its canonical story ids namespaced per test.
 *
 * `canonical_story_id` is unique across publications by design — that is what
 * makes a developing story one record — so two tests publishing the same
 * fixture into one database is a constraint violation rather than a finding.
 */
const fixture = (suffix = '') => {
  const raw = JSON.parse(readFileSync(join(process.cwd(), 'tests/fixtures/whole-site-package.json'), 'utf8')) as {
    runId: string; creates: Array<{ publication: { canonicalStoryId?: string } }>;
  };
  if (suffix) {
    raw.runId = `${raw.runId}-${suffix}`;
    for (const create of raw.creates) {
      if (create.publication.canonicalStoryId) create.publication.canonicalStoryId += `-${suffix}`;
    }
  }
  return wholeSiteUpdatePackageSchema.parse(raw);
};

/** The per-operation half of `processEditorialRun`, over a real database. */
async function runOperations(runId: string, leaseToken: string) {
  const store = editorialRepo(db as unknown as Database);
  const state = await store.get(runId);
  for (const persisted of state.operations) {
    if (persisted.status === 'completed') continue;
    const operation = persisted.input;
    await store.completeOperation(runId, leaseToken, operation.key, async tx => {
      const cited = await materializeSources(tx, operation.sources ?? [], { composer: 'fixture', runId, actor });
      const input = operation.action === 'create' && cited.evidenceIds.length
        ? { ...operation, publication: { ...operation.publication, evidenceIds: cited.evidenceIds } }
        : operation;
      const publication = await publicationService(tx).applyEditorial(
        input, { runId, machineAuthor: 'whole-site-editorial' }, null, actor,
      );
      return { publicationId: publication.id, publicId: publication.publicId, sources: cited.evidenceIds.length };
    });
  }
}

describe('a whole-site package from ChatGPT', () => {
  it('publishes every record, turns its cited URLs into evidence, and needs no internal UUID', async () => {
    const pkg = fixture();
    /* The composer supplies URLs and nothing else: no evidenceIds, no itemIds,
       no eventId. That is the whole point of `sources[]`. */
    for (const create of pkg.creates) {
      expect(create.publication.evidenceIds).toBeUndefined();
      expect(create.sources?.length).toBeGreaterThan(0);
      for (const source of create.sources ?? []) expect(source.url).toMatch(/^https:\/\//);
    }

    const store = editorialRepo(db as unknown as Database);
    const run = await store.start(compileWholeSiteUpdate(pkg), 'external:ChatGPT');
    const worker = await store.claim(run.id);
    await runOperations(run.id, worker!.leaseToken!);

    const done = await store.get(run.id);
    expect(done.operations.map(operation => operation.status)).toEqual(pkg.creates.map(() => 'completed'));

    /* Every record is live, on its own hub, citing the pages the package
       named — resolved to internal ids server-side. */
    for (const operation of done.operations) {
      const result = operation.result as { publicId: string; sources: number };
      const detail = await publicationService(db).getBriefingPublicDetail(result.publicId);
      const create = pkg.creates.find(item => item.key === operation.operationKey)!;
      expect(result.sources).toBe(create.sources!.length);
      expect(detail.sources.map(source => source.url).sort()).toEqual(create.sources!.map(source => source.url).sort());
      for (const source of detail.sources) expect(source.publisher).toBeTruthy();
    }

    /* A page cited by two records is one evidence row, and each outlet is one
       inactive source row — the dedup that keeps a repeated citation from
       multiplying the archive. */
    const cited = pkg.creates.flatMap(create => create.sources!.map(source => source.url));
    const distinct = new Set(cited);
    const evidence = await db.execute<{ count: string }>(sql`SELECT count(*)::text AS count FROM evidence`);
    expect(Number(evidence.rows[0]!.count)).toBe(distinct.size);
    const inactive = await db.execute<{ count: string }>(sql`SELECT count(*)::text AS count FROM source WHERE active = false AND kind = 'manual'`);
    expect(Number(inactive.rows[0]!.count)).toBeGreaterThan(0);
  }, 120000);

  it('is idempotent for the same package and refuses a changed one under the same runId', async () => {
    const pkg = fixture('idempotency');
    const store = editorialRepo(db as unknown as Database);
    const first = await store.start(compileWholeSiteUpdate(pkg), 'external:ChatGPT');
    const replay = await store.start(compileWholeSiteUpdate(pkg), 'external:ChatGPT');
    expect(replay.id).toBe(first.id);
    await expect(store.start(
      compileWholeSiteUpdate({ ...pkg, siteRecommendations: ['A different payload.'] }),
      'external:ChatGPT',
    )).rejects.toThrow('different request');
  }, 120000);

  it('replays a resumed run without publishing anything twice', async () => {
    const pkg = fixture('resume');
    const store = editorialRepo(db as unknown as Database);
    const run = await store.start(compileWholeSiteUpdate(pkg), 'external:ChatGPT');
    const worker = await store.claim(run.id);
    await runOperations(run.id, worker!.leaseToken!);
    const publicIds = (await store.get(run.id)).operations.map(operation => (operation.result as { publicId: string }).publicId);

    /* A run-level fault after the work committed, then the human resume path:
       the completed operations are skipped, so nothing publishes twice. */
    await store.fail(run.id, worker!.leaseToken!, { stage: 'report', operationKey: null, message: 'report stage threw', recovery: 'Resume.' });
    expect((await store.get(run.id)).status).toBe('partial');
    await store.resume(run.id);
    const second = await store.claim(run.id);
    await runOperations(run.id, second!.leaseToken!);

    const after = await store.get(run.id);
    expect(after.operations.map(operation => (operation.result as { publicId: string }).publicId)).toEqual(publicIds);
    const rows = await db.execute<{ count: string }>(sql`SELECT count(*)::text AS count FROM publication WHERE editorial_run_id = ${run.id}`);
    expect(Number(rows.rows[0]!.count)).toBe(pkg.creates.length);
  }, 120000);
});
