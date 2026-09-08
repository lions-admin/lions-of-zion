import { describe, expect, it, vi } from 'vitest';
import { kickOutboxAfterRun } from '@/server/modules/editorial-update/service';

/**
 * A run's own follow-up messages — `editorial.run-report`, and the
 * `publication.cache-invalidate` / `search.reindex` rows every publication it
 * wrote — used to wait for the next quarter-hour cron tick after the run
 * finished. On 2026-09-08 the homepage-lead media run committed at 14:24:08
 * and its cache invalidation went out at 14:30:17. The kick is the cron's
 * `send`, done when the run ends instead.
 */
describe('post-run outbox kick', () => {
  it('drains a bounded batch once the run has committed', async () => {
    const drain = vi.fn(async () => ({ published: 3, failed: 0, remaining: 0 }));
    await kickOutboxAfterRun(drain as never);
    expect(drain).toHaveBeenCalledTimes(1);
    expect(drain).toHaveBeenCalledWith(expect.objectContaining({ limit: expect.any(Number) }));
  });

  /* The rows are already durable; the cron is the safety net. A slow queue
     must never turn a committed run into a failed one. */
  it('never fails the run when the queue handoff fails', async () => {
    const drain = vi.fn(async () => { throw new Error('queue unreachable'); });
    await expect(kickOutboxAfterRun(drain as never)).resolves.toBeUndefined();
    expect(drain).toHaveBeenCalledTimes(1);
  });
});
