import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  startWholeSite: vi.fn(),
  getByRunKey: vi.fn(),
}));

vi.mock('@/server/modules/editorial-update', () => ({
  editorialUpdate: () => ({ startWholeSite: mocks.startWholeSite, getByRunKey: mocks.getByRunKey }),
}));
vi.mock('@/server/core/auth/actor', () => ({ authenticateAdmin: vi.fn(), registerActor: vi.fn(), requireActor: vi.fn() }));
vi.mock('@/server/db/client', async importOriginal => ({
  ...(await importOriginal<typeof import('@/server/db/client')>()),
  withDatabaseRole: (_role: string, _identity: string, fn: () => Promise<unknown>) => fn(),
}));

import { POST } from '@/app/api/internal/editorial-updates/ingest/route';
import { GET } from '@/app/api/internal/editorial-updates/runs/[runId]/route';

const secret = 'editorial-update-test-secret';
const endpoint = 'https://lionsofzion.io/api/internal/editorial-updates/ingest';
const body = {
  contractVersion: 'whole-site-update-v1', runId: 'route-package', composer: 'route-test', createdAt: '2026-09-06T10:00:00.000Z',
  creates: [{ key: 'story', publication: { kind: 'news_update', section: 'news', title: 'Route story', body: 'Route package content.', language: 'en' } }],
  updates: [], homepage: {}, siteRecommendations: [],
};

function request(value: unknown, supplied = secret): Request {
  return new Request(endpoint, { method: 'POST', headers: { 'content-type': 'application/json', 'x-editorial-update-secret': supplied }, body: JSON.stringify(value) });
}

beforeEach(() => {
  process.env.EDITORIAL_UPDATE_INGEST_SECRET = secret;
  mocks.startWholeSite.mockReset();
  mocks.getByRunKey.mockReset();
});
afterEach(() => { delete process.env.EDITORIAL_UPDATE_INGEST_SECRET; });

describe('internal whole-site editorial routes', () => {
  it('rejects an unauthenticated ingest before package parsing', async () => {
    const response = await POST(request({}, 'wrong'));
    expect(response.status).toBe(401);
    expect(mocks.startWholeSite).not.toHaveBeenCalled();
  });

  it('creates a durable run and returns its status URL', async () => {
    mocks.startWholeSite.mockResolvedValue({ id: 'e4c3f3c3-3c3c-4c3c-8c3c-3c3c3c3c3c3c', runKey: 'route-package', status: 'queued' });
    const response = await POST(request(body));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ runId: 'route-package', statusUrl: '/api/internal/editorial-updates/runs/route-package' });
    expect(mocks.startWholeSite).toHaveBeenCalledWith(expect.objectContaining({ runId: 'route-package' }), 'external:route-test');
  });

  it('returns a machine-readable status report by delivery run id', async () => {
    mocks.getByRunKey.mockResolvedValue({
      runKey: 'route-package', status: 'partial', stage: 'report', createdAt: new Date('2026-09-06T10:00:00Z'), startedAt: null, finishedAt: new Date('2026-09-06T10:02:00Z'),
      report: { publications: { created: 1, updated: 0, failed: 1 }, urls: ['/articles/route-story'], errors: [{ operationKey: 'broken', stage: 'media', message: 'bad source' }] },
      operations: [{ operationKey: 'story', status: 'completed', stage: 'publication', result: { publicId: 'route-story' }, failure: null }],
    });
    const response = await GET(new Request('https://lionsofzion.io/api/internal/editorial-updates/runs/route-package', { headers: { 'x-editorial-update-secret': secret } }), {
      params: Promise.resolve({ runId: 'route-package' }),
    });
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ runId: 'route-package', status: 'partial', report: { publications: { failed: 1 } } });
  });
});
