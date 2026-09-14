import { FEATURED_SLOT_RULES, type FeaturedSlotState, type SlotCandidate } from '@/server/contracts/featured-slots';

export type SlotDecision = { action: 'pin' | 'rotate' | 'keep'; key: string; reason: string };

const DAY_MS = 86_400_000;

/** A "never shown" timestamp that still sorts before any real one — a
 * sentinel rather than `-Infinity`, because two never-shown candidates
 * compared as `-Infinity - (-Infinity)` is `NaN`, and an `Array.sort`
 * comparator that returns `NaN` has undefined ordering behaviour. Every real
 * `Date.parse` result is enormously larger than this. */
const NEVER_SHOWN = Number.MIN_SAFE_INTEGER;

/** When a candidate was last shown in this slot, oldest (or never) first. */
function lastSeen(state: FeaturedSlotState, key: string): number {
  const entry = [...state.previous].reverse().find((p) => p.key === key);
  if (!entry) return NEVER_SHOWN;
  return Date.parse(entry.to ?? entry.from);
}

/** Never-shown first, then longest-idle, then stable key order — so two
 * runs given the same inputs always agree. */
function bestAlternative(state: FeaturedSlotState, pool: SlotCandidate[]): SlotCandidate | undefined {
  return [...pool].sort((a, b) => {
    const seenDiff = lastSeen(state, a.key) - lastSeen(state, b.key);
    if (seenDiff !== 0) return seenDiff;
    return a.key.localeCompare(b.key);
  })[0];
}

/**
 * The rotation decision for one slot, in isolation. Pure and deterministic:
 * every input the decision can depend on is a parameter, so a run of a
 * whole-site edition and a unit test agree given the same clock and pool.
 *
 * `excludedKeys` carries this refresh pass's cross-slot diversity — a key
 * (or the key of an already-claimed person) another slot picked earlier in
 * the same pass is never offered to a later one.
 */
export function decideSlot(
  state: FeaturedSlotState,
  candidates: SlotCandidate[],
  excludedKeys: ReadonlySet<string>,
  now: Date,
): SlotDecision {
  const eligible = candidates.filter((c) => !excludedKeys.has(c.key));
  const today = now.toISOString().slice(0, 10);

  if (state.pin && (!state.pin.expires || state.pin.expires >= today)) {
    const pinned = eligible.find((c) => c.key === state.pin!.key);
    if (pinned) return { action: 'pin', key: pinned.key, reason: state.pin.reason };
    // The pinned key left the pool or collided with this pass's diversity
    // rule; fall through to ordinary rotation rather than stall the slot.
  }

  const withoutCurrent = eligible.filter((c) => c.key !== state.currentKey);

  if (!state.currentKey || !eligible.some((c) => c.key === state.currentKey)) {
    // Either a genuine first run, or the slot's own pick fell out of the
    // pool (removed content) or out of THIS pass (another slot claimed it).
    // Either way the slot may only take what this pass's `eligible` set
    // actually allows — reaching into the unfiltered `candidates` here would
    // undo the whole cross-slot diversity guarantee on exactly the runs
    // where it matters most (a shared, narrow pool).
    const first = bestAlternative(state, eligible);
    if (first) {
      return {
        action: 'rotate', key: first.key,
        reason: state.currentKey ? 'The previous selection is no longer eligible.' : 'First selection for this slot.',
      };
    }
    return {
      action: 'keep', key: state.currentKey ?? '',
      reason: state.currentKey ? 'No eligible alternative; keeping the current selection.' : 'No eligible candidate this pass.',
    };
  }

  const dwellDays = state.selectedAt ? (now.getTime() - Date.parse(state.selectedAt)) / DAY_MS : Infinity;

  if (dwellDays < FEATURED_SLOT_RULES.minDays) {
    return { action: 'keep', key: state.currentKey, reason: `Shown ${dwellDays.toFixed(1)} days; under the ${FEATURED_SLOT_RULES.minDays}-day minimum.` };
  }

  const alternative = bestAlternative(state, withoutCurrent);

  if (dwellDays < FEATURED_SLOT_RULES.maxDays) {
    if (!alternative) return { action: 'keep', key: state.currentKey, reason: 'No fresher alternative exists yet.' };
    const neverShown = lastSeen(state, alternative.key) === NEVER_SHOWN;
    return {
      action: 'rotate',
      key: alternative.key,
      reason: neverShown ? 'A never-shown alternative is available.' : 'A longer-idle alternative is available.',
    };
  }

  if (!alternative) {
    return { action: 'keep', key: state.currentKey, reason: `Past the ${FEATURED_SLOT_RULES.maxDays}-day maximum, but no eligible alternative exists.` };
  }
  return { action: 'rotate', key: alternative.key, reason: `Past the ${FEATURED_SLOT_RULES.maxDays}-day maximum dwell.` };
}
