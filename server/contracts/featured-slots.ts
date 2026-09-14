import { z } from 'zod';

/**
 * The six evergreen homepage positions with no editorial placement
 * mechanism today — see `docs/editorial-dna.md` ("October 7 is not
 * placeable") and `homepage_placement`'s CHECK on `area`. Each slot holds
 * exactly one candidate key and feeds one fixed array position in
 * `HomeSelection` (`server/contracts/homepage.ts`):
 *
 *   october7.testimony     -> selection.october7[0]
 *   october7.documentation -> selection.october7[1]
 *   heroes.courage         -> selection.heroes[0]
 *   heroes.fallen          -> selection.heroes[1]
 *   history.primary        -> selection.israelsStory[0]
 *   history.secondary      -> selection.israelsStory[1]
 */
export const FEATURED_SLOTS = [
  'october7.testimony',
  'october7.documentation',
  'heroes.courage',
  'heroes.fallen',
  'history.primary',
  'history.secondary',
] as const;

export const featuredSlotNameSchema = z.enum(FEATURED_SLOTS);
export type FeaturedSlotName = z.infer<typeof featuredSlotNameSchema>;

/** Owner ruling 2026-09-14: nothing rotates before two days; nothing sits
 * past four when an eligible alternative exists. */
export const FEATURED_SLOT_RULES = { minDays: 2, maxDays: 4 } as const;

export const featuredSlotPinSchema = z.object({
  key: z.string().trim().min(1),
  reason: z.string().trim().min(1).max(2000),
  expires: z.string().date().optional(),
  setBy: z.string().trim().min(1),
  setAt: z.string().datetime(),
});
export type FeaturedSlotPin = z.infer<typeof featuredSlotPinSchema>;

/** One past occupancy of a slot. `to` is null for the row currently open —
 * i.e. the slot's own `previous` log always closes an entry before adding
 * the next one, so at most one entry per slot is ever open. */
export const featuredSlotHistoryEntrySchema = z.object({
  key: z.string().trim().min(1),
  from: z.string().datetime(),
  to: z.string().datetime().nullable(),
});
export type FeaturedSlotHistoryEntry = z.infer<typeof featuredSlotHistoryEntrySchema>;

export const featuredSlotStateSchema = z.object({
  slot: featuredSlotNameSchema,
  currentKey: z.string().nullable(),
  selectedAt: z.string().datetime().nullable(),
  previous: z.array(featuredSlotHistoryEntrySchema).max(20).default([]),
  lastRefreshedAt: z.string().datetime(),
  pin: featuredSlotPinSchema.nullable(),
});
export type FeaturedSlotState = z.infer<typeof featuredSlotStateSchema>;

/** One item a slot may choose. `person` is the identity used for
 * cross-slot diversity — a hero id or a testimony's witness slug — never a
 * display name. Slots without a meaningful person concept (documentation
 * records) omit it and diversify by key alone. */
export type SlotCandidate = { key: string; person?: string };

export const featuredSlotChangeSchema = z.object({
  slot: featuredSlotNameSchema,
  from: z.string().nullable(),
  to: z.string(),
  action: z.enum(['pin', 'rotate']),
  reason: z.string(),
});
export type FeaturedSlotChange = z.infer<typeof featuredSlotChangeSchema>;
