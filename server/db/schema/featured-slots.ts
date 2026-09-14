import { check, jsonb, pgTable, text, timestamp } from 'drizzle-orm/pg-core';
import { sql } from 'drizzle-orm';
import type { FeaturedSlotHistoryEntry, FeaturedSlotPin } from '@/server/contracts/featured-slots';

/**
 * The six evergreen homepage positions that have no editorial placement
 * mechanism (`homepage_placement` is CHECK-constrained to `news` /
 * `fakeResistance` / `people`): October 7 testimony/documentation, Courage &
 * service, Fallen, History & context primary/secondary. One row per slot,
 * updated in place by `server/modules/featured-slots`; `previous` is a
 * bounded (≤20) rolling log, not a second source of truth.
 */
export const featuredSlot = pgTable(
  'featured_slot',
  {
    slot: text('slot').primaryKey(),
    currentKey: text('current_key'),
    selectedAt: timestamp('selected_at', { withTimezone: true }),
    previous: jsonb('previous').$type<FeaturedSlotHistoryEntry[]>().notNull().default([]),
    lastRefreshedAt: timestamp('last_refreshed_at', { withTimezone: true }).notNull().defaultNow(),
    pin: jsonb('pin').$type<FeaturedSlotPin | null>(),
    updatedAt: timestamp('updated_at', { withTimezone: true }).notNull().defaultNow(),
  },
  (t) => [
    check(
      'featured_slot_slot_check',
      sql`${t.slot} IN ('october7.testimony','october7.documentation','heroes.courage','heroes.fallen','history.primary','history.secondary')`,
    ),
  ],
);
