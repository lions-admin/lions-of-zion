/**
 * The information item — request and response shapes.
 *
 * Zod only. Nothing here may reach the database or the runtime; the frontend
 * is meant to import these types eventually, and a Postgres driver must never
 * ride along with them.
 */

import { z } from "zod";
import {
  assessmentValueSchema,
  confidenceSummarySchema,
  informationItemTypeSchema,
  itemStatusSchema,
  type ItemStatus,
} from "./enums";

export const uuidSchema = z.uuid();
export const languageSchema = z
  .string()
  .regex(/^[a-z]{2}(-[A-Za-z0-9-]+)*$/, "must be a BCP-47 language tag, e.g. en or he-IL");

/** URL-safe, human-typeable, stable. Separate from the uuid so a public link
 *  never leaks row-creation order. */
export const publicIdSchema = z
  .string()
  .min(6)
  .max(64)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "must be lowercase kebab-case");

export const createItemSchema = z.object({
  type: informationItemTypeSchema,
  title: z.string().trim().min(1).max(500),
  /** The claim as it was actually made. Not our paraphrase of it — the whole
   *  point is that a reader can check what we assessed against what was said. */
  canonicalText: z.string().trim().min(1).max(20_000),
  summary: z.string().trim().max(4_000).optional(),
  language: languageSchema,
  eventId: uuidSchema.optional(),
  primaryTopicId: uuidSchema.optional(),
  topicIds: z.array(uuidSchema).max(20).optional(),
});
export type CreateItem = z.infer<typeof createItemSchema>;

/** Editable fields. Status is deliberately absent: it moves through
 *  `transitionItem`, which checks legality and records who and why. */
export const updateItemSchema = createItemSchema
  .partial()
  .omit({ type: true })
  .extend({ changeSummary: z.string().trim().min(1).max(500) });
export type UpdateItem = z.infer<typeof updateItemSchema>;

export const transitionItemSchema = z.object({
  to: itemStatusSchema,
  /** Required when moving to `rejected`; a rejection with no stated reason is
   *  the failure mode this field exists to prevent. */
  reason: z.string().trim().max(2_000).optional(),
});
export type TransitionItem = z.infer<typeof transitionItemSchema>;

export const listPublishedItemsSchema = z.object({
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListPublishedItems = z.infer<typeof listPublishedItemsSchema>;

export const listItemsSchema = z.object({
  status: itemStatusSchema.optional(),
  type: informationItemTypeSchema.optional(),
  language: languageSchema.optional(),
  eventId: uuidSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListItems = z.infer<typeof listItemsSchema>;

/** What an item looks like on the way out. `assessment` and `confidenceSummary`
 *  are derived — the database maintains them from the live assessment and
 *  refuses application writes, so they are read-only here by construction. */
export const itemSchema = z.object({
  id: uuidSchema,
  publicId: publicIdSchema,
  type: informationItemTypeSchema,
  title: z.string(),
  canonicalText: z.string(),
  summary: z.string().nullable(),
  language: z.string(),
  status: itemStatusSchema,
  statusReason: z.string().nullable(),
  assessment: assessmentValueSchema.nullable(),
  confidenceSummary: confidenceSummarySchema.nullable(),
  firstDetectedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
  eventId: uuidSchema.nullable(),
  primaryTopicId: uuidSchema.nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type Item = z.infer<typeof itemSchema>;

/**
 * Which status may follow which.
 *
 * The database holds the same table and enforces it in a trigger, so a service
 * bug cannot move an item somewhere it should not go. This copy exists so the
 * API can reject an illegal transition with a useful message instead of a
 * constraint violation, and a test asserts the two agree.
 *
 * `edited` earns its place as a state rather than an event: it means "returned
 * to the author for rewriting", which is genuinely distinct from
 * `under_review` ("being fact-checked"). It was unreachable in the first draft
 * of this table — nothing transitioned into it — which is what prompted
 * giving it inbound edges from the three points where changes get asked for.
 */
export const LEGAL_TRANSITIONS: Readonly<Record<ItemStatus, readonly ItemStatus[]>> =
  Object.freeze({
    detected: ["under_review", "rejected", "archived"],
    under_review: ["reviewed", "edited", "rejected", "archived"],
    reviewed: ["approved", "edited", "under_review", "rejected", "archived"],
    edited: ["under_review", "reviewed", "approved"],
    approved: ["published", "edited", "under_review", "archived"],
    published: ["updated", "under_review", "archived"],
    updated: ["published", "under_review", "archived"],
    /* Both terminal-ish: an archived or rejected item can be reopened, which is
       how a correction begins, but it cannot jump straight back to published. */
    archived: ["under_review"],
    rejected: ["under_review"],
  });

export const canTransition = (from: ItemStatus, to: ItemStatus): boolean =>
  LEGAL_TRANSITIONS[from].includes(to);

/** Statuses a reader outside the organisation may ever see. */
export const PUBLIC_STATUSES: readonly ItemStatus[] = Object.freeze(["published", "updated"]);
export const isPublic = (status: ItemStatus): boolean => PUBLIC_STATUSES.includes(status);
