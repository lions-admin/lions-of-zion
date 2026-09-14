import { afterAll, beforeEach, describe, expect, it } from 'vitest';
import { freshDatabase, type TestDatabase } from '@/server/db/testing';
import type { Database } from '@/server/db/client';
import { featuredSlotsService } from '@/server/modules/featured-slots/service';
import { FEATURED_SLOTS, type SlotCandidate } from '@/server/contracts/featured-slots';
import type { SlotPools } from '@/server/modules/featured-slots/pools';

let db: TestDatabase;
beforeEach(async () => { db = await freshDatabase(); }, 60000);
afterAll(async () => { await db?.$client.close(); });

const pool = (...keys: string[]): SlotCandidate[] => keys.map((key) => ({ key }));

/** Every slot gets a two-candidate pool by default, distinct per slot so a
 * cross-slot diversity bug (one slot's key leaking into another's pool)
 * would be visible immediately. */
function pools(overrides: Partial<SlotPools> = {}): SlotPools {
  const base: SlotPools = Object.fromEntries(FEATURED_SLOTS.map((slot) => [slot, pool(`${slot}-a`, `${slot}-b`)])) as SlotPools;
  return { ...base, ...overrides };
}

const service = (loadPools: () => Promise<SlotPools> = async () => pools()) =>
  featuredSlotsService(db as unknown as Database, loadPools);

describe('featuredSlotsService', () => {
  it('seeds all six slots empty and initializes each on the first refresh', async () => {
    const before = await service().state();
    expect(before).toHaveLength(6);
    expect(before.every((s) => s.currentKey === null)).toBe(true);

    const { changed } = await service().refresh(new Date('2026-09-05T00:00:00.000Z'));
    expect(changed).toHaveLength(6);
    const after = await service().state();
    expect(after.every((s) => s.currentKey !== null)).toBe(true);
  });

  it('does not rotate again inside the minimum dwell', async () => {
    await service().refresh(new Date('2026-09-05T00:00:00.000Z'));
    const first = await service().state();
    const { changed } = await service().refresh(new Date('2026-09-06T00:00:00.000Z')); // +1 day
    expect(changed).toHaveLength(0);
    const second = await service().state();
    expect(second.map((s) => s.currentKey)).toEqual(first.map((s) => s.currentKey));
  });

  it('rotates a slot once a fresher candidate exists past the minimum dwell', async () => {
    const loadPools = async () => pools({ 'october7.testimony': pool('t1', 't2', 't3') });
    await service(loadPools).refresh(new Date('2026-09-05T00:00:00.000Z'));
    const { changed } = await service(loadPools).refresh(new Date('2026-09-07T12:00:00.000Z')); // +2.5 days
    expect(changed.some((c) => c.slot === 'october7.testimony')).toBe(true);
  });

  it('bounds the previous log and keeps rotating', async () => {
    const loadPools = async () => pools({ 'heroes.fallen': pool('f1', 'f2') });
    let day = new Date('2026-09-01T00:00:00.000Z');
    for (let i = 0; i < 30; i += 1) {
      day = new Date(day.getTime() + 5 * 86_400_000); // well past the 4-day maximum each time
      await service(loadPools).refresh(day);
    }
    const [fallen] = (await service().state()).filter((s) => s.slot === 'heroes.fallen');
    expect(fallen.previous.length).toBeLessThanOrEqual(20);
  });

  it('an active pin holds the slot regardless of dwell', async () => {
    const loadPools = async () => pools({ 'history.primary': pool('h1', 'h2', 'h3') });
    await service(loadPools).refresh(new Date('2026-09-05T00:00:00.000Z'));
    await service(loadPools).pin('history.primary', 'h2', 'Owner ruling.', undefined, 'owner@example.org');
    const { changed } = await service(loadPools).refresh(new Date('2026-09-12T00:00:00.000Z')); // well past max
    const primary = changed.find((c) => c.slot === 'history.primary');
    expect(primary?.to).toBe('h2');
    expect(primary?.action).toBe('pin');
    const state = (await service(loadPools).state()).find((s) => s.slot === 'history.primary');
    expect(state?.currentKey).toBe('h2');
  });

  it('release returns a pinned slot to ordinary rotation', async () => {
    const loadPools = async () => pools({ 'history.secondary': pool('s1', 's2') });
    await service(loadPools).refresh(new Date('2026-09-05T00:00:00.000Z'));
    await service(loadPools).pin('history.secondary', 's1', 'Temporary.', undefined, 'owner@example.org');
    await service(loadPools).refresh(new Date('2026-09-06T00:00:00.000Z'));
    let state = (await service(loadPools).state()).find((s) => s.slot === 'history.secondary');
    expect(state?.pin).not.toBeNull();
    await service(loadPools).release('history.secondary');
    state = (await service(loadPools).state()).find((s) => s.slot === 'history.secondary');
    expect(state?.pin).toBeNull();
  });

  it('never picks the same key for two slots in one refresh pass', async () => {
    // Both pools share their only candidate — one of the two slots must fall
    // back to keeping nothing new rather than colliding.
    const loadPools = async () => pools({ 'heroes.courage': pool('shared'), 'heroes.fallen': pool('shared') });
    await service(loadPools).refresh(new Date('2026-09-05T00:00:00.000Z'));
    const state = await service(loadPools).state();
    const courage = state.find((s) => s.slot === 'heroes.courage');
    const fallen = state.find((s) => s.slot === 'heroes.fallen');
    expect(courage?.currentKey === 'shared' && fallen?.currentKey === 'shared').toBe(false);
  });
});
