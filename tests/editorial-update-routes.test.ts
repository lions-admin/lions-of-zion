import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => ({
  startWholeSite: vi.fn(),
  getByRunKey: vi.fn(),
  deliveryState: vi.fn(),
  drainPendingOutbox: vi.fn(),
}));

vi.mock('@/server/modules/editorial-update', () => ({
  editorialUpdate: () => ({ startWholeSite: mocks.startWholeSite, getByRunKey: mocks.getByRunKey, deliveryState: mocks.deliveryState }),
}));
vi.mock('@/server/core/outbox', async importOriginal => ({
  ...(await importOriginal<typeof import('@/server/core/outbox')>()),
  drainPendingOutbox: mocks.drainPendingOutbox,
}));
vi.mock('@/server/core/auth/actor', () => ({ authenticateAdmin: vi.fn(), registerActor: vi.fn(), requireActor: vi.fn() }));
vi.mock('@/server/db/client', async importOriginal => ({
  ...(await importOriginal<typeof import('@/server/db/client')>()),
  withDatabaseRole: (_role: string, _identity: string, fn: () => Promise<unknown>) => fn(),
}));

import { editorialReportEmail } from '@/server/core/config';
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
  mocks.deliveryState.mockReset();
  mocks.drainPendingOutbox.mockReset();
  mocks.drainPendingOutbox.mockResolvedValue({ attempted: 1, dispatched: 1, failed: 0 });
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

  /* The run used to sit until the next quarter-hour cron tick — up to fifteen
     minutes of dead time before any work began, which a second package queued
     behind the first inherited on top of its own. Nothing was broken; the
     publisher simply ran out of poll budget waiting. */
  it('hands the queued run to the queue immediately instead of waiting for the cron', async () => {
    mocks.startWholeSite.mockResolvedValue({ id: 'e4c3f3c3-3c3c-4c3c-8c3c-3c3c3c3c3c3c', runKey: 'route-package', status: 'queued' });
    const response = await POST(request(body));
    expect(response.status).toBe(202);
    expect(mocks.drainPendingOutbox).toHaveBeenCalledTimes(1);
    /* Bounded on purpose: the drain reads oldest-first, so an unusual backlog
       stays the cron's problem rather than holding the 202 open. */
    expect(mocks.drainPendingOutbox).toHaveBeenCalledWith(expect.objectContaining({ limit: expect.any(Number) }));
  });

  /* The outbox row is committed inside `startWholeSite`'s transaction, so an
     unreachable queue costs latency and nothing else. Failing the ingest here
     would make the Action retry a package that is already durably recorded. */
  it('still accepts the package when the immediate queue handoff fails', async () => {
    mocks.startWholeSite.mockResolvedValue({ id: 'e4c3f3c3-3c3c-4c3c-8c3c-3c3c3c3c3c3c', runKey: 'route-package', status: 'queued' });
    mocks.drainPendingOutbox.mockRejectedValue(new Error('queue unreachable'));
    const response = await POST(request(body));
    expect(response.status).toBe(202);
    await expect(response.json()).resolves.toMatchObject({ runId: 'route-package', status: 'queued' });
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
    await expect(response.json()).resolves.toMatchObject({ runId: 'route-package', status: 'partial', phase: 'partial', delivery: null, report: { publications: { failed: 1 } } });
    expect(mocks.deliveryState).not.toHaveBeenCalled();
  });

  /* Three runs sat `queued` for twenty minutes each while the queue refused
     every send, and the status body could not say so. It reads the run's
     outbox row back now, and derives the phase from it. */
  it('exposes where a queued run stands in the outbox, with the queue\'s refusal', async () => {
    const id = '96eea424-179c-48a0-aeee-a7ea8f83181d';
    mocks.getByRunKey.mockResolvedValue({
      id, runKey: 'stuck-package', status: 'queued', stage: 'media', createdAt: new Date('2026-09-06T21:20:04Z'), startedAt: null, finishedAt: null, report: null, operations: [],
    });
    mocks.deliveryState.mockResolvedValue({
      outboxId: '3568', createdAt: '2026-09-06T21:20:04.307Z', availableAt: '2026-09-06T22:20:04.307Z', publishedAt: null, attempts: 27,
      lastError: '{"error":"Invalid V3 queue name. Must be 1-256 alphanumeric characters, hyphens, or underscores."}',
    });
    const response = await GET(new Request('https://lionsofzion.io/api/internal/editorial-updates/runs/stuck-package', { headers: { 'x-editorial-update-secret': secret } }), {
      params: Promise.resolve({ runId: 'stuck-package' }),
    });
    expect(response.status).toBe(200);
    const body = await response.json();
    expect(body).toMatchObject({ status: 'queued', phase: 'queued:drain-failing', delivery: { attempts: 27, publishedAt: null } });
    expect(body.delivery.lastError).toContain('Invalid V3 queue name');
    expect(mocks.deliveryState).toHaveBeenCalledWith(id);

    mocks.deliveryState.mockResolvedValue({ outboxId: '3568', createdAt: '2026-09-06T21:20:04.307Z', availableAt: '2026-09-06T21:20:04.307Z', publishedAt: '2026-09-06T21:30:16.000Z', attempts: 0, lastError: null });
    const handed = await GET(new Request('https://lionsofzion.io/api/internal/editorial-updates/runs/stuck-package', { headers: { 'x-editorial-update-secret': secret } }), {
      params: Promise.resolve({ runId: 'stuck-package' }),
    });
    await expect(handed.json()).resolves.toMatchObject({ phase: 'queued:dispatched' });
  });
});

/* The owner reads run reports on a mailbox that must never become a sign-in
   identity, so the recipient is its own variable rather than `ADMIN_EMAIL` —
   which is an authorization allowlist. It falls back so an unconfigured
   deployment still delivers instead of throwing inside a post-commit
   consumer, where a throw would only redeliver the same message. */
describe('editorial run report recipient', () => {
  afterEach(() => { delete process.env.EDITORIAL_REPORT_EMAIL; delete process.env.ADMIN_EMAIL; });

  it('prefers the configured report address, normalised', () => {
    process.env.ADMIN_EMAIL = 'admin@lionsofzion.io';
    process.env.EDITORIAL_REPORT_EMAIL = '  Owner@Example.com ';
    expect(editorialReportEmail()).toBe('owner@example.com');
  });

  it('falls back to the admin address when unset', () => {
    process.env.ADMIN_EMAIL = 'admin@lionsofzion.io';
    expect(editorialReportEmail()).toBe('admin@lionsofzion.io');
  });
});
