import { date, integer, jsonb, pgTable, primaryKey, text, timestamp } from 'drizzle-orm/pg-core';
import type { HomeSelection } from '@/server/contracts/homepage';

/** Append-only. The highest committed revision for a date is its active one. */
export const homepageEdition = pgTable('homepage_edition', {
  editionDate: date('edition_date').notNull(), revision: integer('revision').notNull(),
  generatedAt: timestamp('generated_at', {withTimezone:true}).notNull().defaultNow(),
  catalogRevision:text('catalog_revision').notNull(), reason:text('reason').notNull(),
  overrideRevision:text('override_revision').notNull(), selection:jsonb('selection').$type<HomeSelection>().notNull(),
}, t=>[primaryKey({columns:[t.editionDate,t.revision]})]);
