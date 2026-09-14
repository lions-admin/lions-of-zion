import { describe, expect, it } from 'vitest';
import { decideSlot } from '@/server/modules/featured-slots/rules';
import type { FeaturedSlotState, SlotCandidate } from '@/server/contracts/featured-slots';

const state = (overrides: Partial<FeaturedSlotState> = {}): FeaturedSlotState => ({
  slot: 'october7.testimony',
  currentKey: 'a',
  selectedAt: '2026-09-05T00:00:00.000Z',
  previous: [{ key: 'a', from: '2026-09-05T00:00:00.000Z', to: null }],
  lastRefreshedAt: '2026-09-05T00:00:00.000Z',
  pin: null,
  ...overrides,
});

const pool = (...keys: string[]): SlotCandidate[] => keys.map((key) => ({ key }));
const at = (isoDate: string) => new Date(isoDate);

describe('decideSlot', () => {
  it('keeps the current pick under the minimum dwell', () => {
    const decision = decideSlot(state(), pool('a', 'b', 'c'), new Set(), at('2026-09-06T00:00:00.000Z')); // +1 day
    expect(decision).toEqual({ action: 'keep', key: 'a', reason: expect.stringContaining('under the 2-day minimum') });
  });

  it('rotates to a never-shown alternative once past the minimum dwell', () => {
    const decision = decideSlot(state(), pool('a', 'b', 'c'), new Set(), at('2026-09-07T12:00:00.000Z')); // +2.5 days
    expect(decision.action).toBe('rotate');
    expect(['b', 'c']).toContain(decision.key);
    expect(decision.reason).toMatch(/never-shown/);
  });

  it('keeps the current pick between min and max dwell when nothing else is eligible', () => {
    const decision = decideSlot(state(), pool('a'), new Set(), at('2026-09-07T12:00:00.000Z'));
    expect(decision).toEqual({ action: 'keep', key: 'a', reason: 'No fresher alternative exists yet.' });
  });

  it('force-rotates past the maximum dwell when an alternative exists', () => {
    const decision = decideSlot(state(), pool('a', 'b'), new Set(), at('2026-09-10T00:00:00.000Z')); // +5 days
    expect(decision).toEqual({ action: 'rotate', key: 'b', reason: expect.stringContaining('4-day maximum') });
  });

  it('keeps the current pick past the maximum dwell when nothing else is eligible', () => {
    const decision = decideSlot(state(), pool('a'), new Set(), at('2026-09-10T00:00:00.000Z'));
    expect(decision).toEqual({ action: 'keep', key: 'a', reason: expect.stringContaining('no eligible alternative') });
  });

  it('prefers the longest-idle candidate over one shown more recently', () => {
    const s = state({
      currentKey: 'a',
      previous: [
        { key: 'b', from: '2026-09-01T00:00:00.000Z', to: '2026-09-02T00:00:00.000Z' },
        { key: 'c', from: '2026-08-01T00:00:00.000Z', to: '2026-08-02T00:00:00.000Z' },
        { key: 'a', from: '2026-09-05T00:00:00.000Z', to: null },
      ],
    });
    const decision = decideSlot(s, pool('a', 'b', 'c'), new Set(), at('2026-09-10T00:00:00.000Z'));
    expect(decision.action).toBe('rotate');
    expect(decision.key).toBe('c'); // idle since August, longer than b's September
  });

  it('an active pin overrides ordinary rotation', () => {
    const s = state({ pin: { key: 'c', reason: 'Owner ruling for the anniversary.', setBy: 'owner', setAt: '2026-09-01T00:00:00.000Z' } });
    const decision = decideSlot(s, pool('a', 'b', 'c'), new Set(), at('2026-09-06T00:00:00.000Z'));
    expect(decision).toEqual({ action: 'pin', key: 'c', reason: 'Owner ruling for the anniversary.' });
  });

  it('an expired pin falls through to ordinary rotation', () => {
    const s = state({ pin: { key: 'c', reason: 'Temporary.', setBy: 'owner', setAt: '2026-08-01T00:00:00.000Z', expires: '2026-08-15' } });
    const decision = decideSlot(s, pool('a', 'b', 'c'), new Set(), at('2026-09-06T00:00:00.000Z'));
    expect(decision.action).not.toBe('pin');
  });

  it('a pinned key missing from the pool falls through rather than stalling the slot', () => {
    const s = state({ pin: { key: 'gone', reason: 'Stale.', setBy: 'owner', setAt: '2026-09-01T00:00:00.000Z' } });
    const decision = decideSlot(s, pool('a', 'b'), new Set(), at('2026-09-06T00:00:00.000Z'));
    expect(decision.action).not.toBe('pin');
    expect(['a', 'b']).toContain(decision.key);
  });

  it('excludes keys another slot already claimed this refresh pass', () => {
    const decision = decideSlot(state(), pool('a', 'b', 'c'), new Set(['b', 'c']), at('2026-09-07T12:00:00.000Z'));
    expect(decision).toEqual({ action: 'keep', key: 'a', reason: 'No fresher alternative exists yet.' });
  });

  it('initializes a slot with no current key from the pool', () => {
    const s = state({ currentKey: null, selectedAt: null, previous: [] });
    const decision = decideSlot(s, pool('a', 'b'), new Set(), at('2026-09-05T00:00:00.000Z'));
    expect(decision.action).toBe('rotate');
    expect(['a', 'b']).toContain(decision.key);
  });

  /* Regression: two never-shown candidates both resolve to the sentinel
   * "never shown" value, and comparing `-Infinity - -Infinity` is `NaN` —
   * an `Array.sort` comparator returning `NaN` has undefined behaviour,
   * which silently broke the never-shown tie-break (it fell back to
   * insertion order instead of alphabetical) whenever three or more
   * untouched candidates were compared in one pass. */
  it('breaks ties between several never-shown candidates alphabetically, not by pool order', () => {
    const s = state({ currentKey: null, selectedAt: null, previous: [] });
    const decision = decideSlot(s, pool('zebra', 'alpha', 'middle'), new Set(), at('2026-09-05T00:00:00.000Z'));
    expect(decision.key).toBe('alpha');
  });

  it('is deterministic given identical inputs', () => {
    const s = state();
    const c = pool('a', 'b', 'c');
    const first = decideSlot(s, c, new Set(), at('2026-09-10T00:00:00.000Z'));
    const second = decideSlot(s, c, new Set(), at('2026-09-10T00:00:00.000Z'));
    expect(first).toEqual(second);
  });
});
