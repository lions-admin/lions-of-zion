import 'server-only';
import type { Database } from '@/server/db/client';
import {
  featuredSlotChangeSchema,
  type FeaturedSlotChange,
  type FeaturedSlotName,
  type FeaturedSlotState,
} from '@/server/contracts/featured-slots';
import { decideSlot } from './rules';
import { buildSlotPools, type SlotPools } from './pools';
import { featuredSlotsRepo } from './repo';

/** Fixed processing order for one refresh pass. Earlier slots claim their
 * key (and, where the candidate carries one, their person) before later
 * slots see the pool — this is the whole of the cross-slot diversity rule:
 * a hero, witness or chapter already placed this pass is not offered again.
 * Fallen goes first only to keep the order stable and reviewable; nothing
 * depends on it beyond that. */
const REFRESH_ORDER: FeaturedSlotName[] = [
  'heroes.fallen',
  'heroes.courage',
  'history.primary',
  'history.secondary',
  'october7.testimony',
  'october7.documentation',
];

export function featuredSlotsService(db: Database, loadPools: () => Promise<SlotPools> = buildSlotPools) {
  const repo = featuredSlotsRepo(db);

  return {
    state(): Promise<FeaturedSlotState[]> {
      return repo.all();
    },

    /**
     * Runs the rotation decision for every slot, in order, persisting the
     * ones that move. Called from the editorial ingest's homepage stage, the
     * admin maintenance tick, and the manual homepage cron route — never
     * from a page request, so a static-file pool read here costs nothing a
     * reader waits on.
     */
    async refresh(now = new Date()): Promise<{ changed: FeaturedSlotChange[]; states: Map<FeaturedSlotName, string | null> }> {
      const [pools, states] = await Promise.all([loadPools(), repo.all()]);
      const byName = new Map(states.map((s) => [s.slot, s]));
      const resultKeys = new Map<FeaturedSlotName, string | null>();
      const excludedKeys = new Set<string>();
      const excludedPersons = new Set<string>();
      const changed: FeaturedSlotChange[] = [];

      for (const slot of REFRESH_ORDER) {
        const state = byName.get(slot);
        if (!state) continue; // a slot missing its seed row is a migration gap, not something to guess at here
        const pool = pools[slot] ?? [];

        const effectiveExcluded = new Set(excludedKeys);
        for (const c of pool) if (c.person && excludedPersons.has(c.person)) effectiveExcluded.add(c.key);

        const decision = decideSlot(state, pool, effectiveExcluded, now);
        /* `decision.action === 'keep'` can still carry a (meaningless, empty)
         * `key` when nothing was eligible at all — see `decideSlot`'s
         * first-run/fallback branch. Branching on the action, not on the
         * key's truthiness, is what keeps that case from being written as a
         * real rotation to an empty string. */
        const moved = decision.action !== 'keep' && Boolean(decision.key) && decision.key !== state.currentKey;

        if (moved) {
          await repo.rotate(slot, decision.key, now, state.previous);
          changed.push(
            featuredSlotChangeSchema.parse({
              slot,
              from: state.currentKey,
              to: decision.key,
              action: decision.action === 'pin' ? 'pin' : 'rotate',
              reason: decision.reason,
            }),
          );
        } else {
          await repo.touchRefreshedAt(slot, now);
        }

        const chosenKey = (moved ? decision.key : state.currentKey) || null;
        resultKeys.set(slot, chosenKey);
        if (chosenKey) {
          excludedKeys.add(chosenKey);
          const chosen = pool.find((c) => c.key === chosenKey);
          if (chosen?.person) excludedPersons.add(chosen.person);
        }
      }

      return { changed, states: resultKeys };
    },

    /** An editorial pin. `key` is trusted to the caller — an invalid or
     * since-removed key is caught by `decideSlot` on the next refresh, which
     * falls through to ordinary rotation rather than stalling the slot. */
    async pin(slot: FeaturedSlotName, key: string, reason: string, expires: string | undefined, actor: string): Promise<void> {
      const now = new Date();
      await repo.setPin(slot, { key, reason, expires, setBy: actor, setAt: now.toISOString() }, now);
    },

    async release(slot: FeaturedSlotName): Promise<void> {
      await repo.setPin(slot, null, new Date());
    },
  };
}
