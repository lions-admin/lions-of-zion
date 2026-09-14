import 'server-only';
import { eq } from 'drizzle-orm';
import type { Database } from '@/server/db/client';
import { featuredSlot } from '@/server/db/schema';
import {
  featuredSlotStateSchema,
  type FeaturedSlotHistoryEntry,
  type FeaturedSlotName,
  type FeaturedSlotPin,
  type FeaturedSlotState,
} from '@/server/contracts/featured-slots';

const toState = (row: typeof featuredSlot.$inferSelect): FeaturedSlotState =>
  featuredSlotStateSchema.parse({
    slot: row.slot,
    currentKey: row.currentKey,
    selectedAt: row.selectedAt ? row.selectedAt.toISOString() : null,
    previous: row.previous,
    lastRefreshedAt: row.lastRefreshedAt.toISOString(),
    pin: row.pin,
  });

export function featuredSlotsRepo(db: Database) {
  return {
    async all(): Promise<FeaturedSlotState[]> {
      const rows = await db.select().from(featuredSlot);
      return rows.map(toState);
    },
    async get(slot: FeaturedSlotName): Promise<FeaturedSlotState | null> {
      const [row] = await db.select().from(featuredSlot).where(eq(featuredSlot.slot, slot)).limit(1);
      return row ? toState(row) : null;
    },
    /** Moves the slot to `key`, closing the open `previous` entry (if any)
     * and opening a new one — the row's own occupancy log. */
    async rotate(slot: FeaturedSlotName, key: string, now: Date, previous: FeaturedSlotHistoryEntry[]) {
      const closed = previous.map((p, i) => (i === previous.length - 1 && p.to === null ? { ...p, to: now.toISOString() } : p));
      const next = [...closed, { key, from: now.toISOString(), to: null }].slice(-20);
      await db
        .update(featuredSlot)
        .set({ currentKey: key, selectedAt: now, previous: next, lastRefreshedAt: now, updatedAt: now })
        .where(eq(featuredSlot.slot, slot));
    },
    async touchRefreshedAt(slot: FeaturedSlotName, now: Date) {
      await db.update(featuredSlot).set({ lastRefreshedAt: now, updatedAt: now }).where(eq(featuredSlot.slot, slot));
    },
    async setPin(slot: FeaturedSlotName, pin: FeaturedSlotPin | null, now: Date) {
      await db.update(featuredSlot).set({ pin, updatedAt: now }).where(eq(featuredSlot.slot, slot));
    },
  };
}
