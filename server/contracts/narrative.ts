/**
 * Narratives, actors and observations — request and response shapes.
 * Zod only.
 */

import { z } from "zod";
import { actorKindSchema, dataClassSchema, narrativeStatusSchema } from "./enums";
import { languageSchema, uuidSchema } from "./item";
import { slugSchema } from "./source";

/* ── Actors ─────────────────────────────────────────────────────────────── */

export const createActorSchema = z.object({
  kind: actorKindSchema,
  slug: slugSchema,
  name: z.string().trim().min(1).max(300),
  aliases: z.array(z.string().trim().min(1).max(300)).max(50).default([]),
  country: z.string().trim().length(2).optional(),
  platformHandles: z.record(z.string(), z.string()).optional(),
  description: z.string().trim().max(4_000).optional(),
  dataClass: dataClassSchema.default("internal"),
});
export type CreateActor = z.infer<typeof createActorSchema>;

export const listActorsSchema = z.object({
  kind: actorKindSchema.optional(),
  country: z.string().trim().length(2).optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListActors = z.infer<typeof listActorsSchema>;

/* ── Narratives ─────────────────────────────────────────────────────────── */

export const createNarrativeSchema = z.object({
  slug: slugSchema,
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(4_000).optional(),
  language: languageSchema,
  primaryTopicId: uuidSchema.optional(),
  eventId: uuidSchema.optional(),
});
export type CreateNarrative = z.infer<typeof createNarrativeSchema>;

export const listNarrativesSchema = z.object({
  status: narrativeStatusSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListNarratives = z.infer<typeof listNarrativesSchema>;

export const transitionNarrativeSchema = z.object({ to: narrativeStatusSchema });
export type TransitionNarrative = z.infer<typeof transitionNarrativeSchema>;

/** Linking a checked claim into a narrative. The rationale is required for
 *  the same reason it is on an evidence edge: grouping claims is how a theme
 *  gets defined, and an unexplained grouping is an assertion. */
export const linkNarrativeItemSchema = z.object({
  itemId: uuidSchema,
  rationale: z.string().trim().min(1).max(4_000),
});
export type LinkNarrativeItem = z.infer<typeof linkNarrativeItemSchema>;

/* ── Observations ───────────────────────────────────────────────────────── */

export const recordObservationSchema = z.object({
  /** Required. An attribution with no source is the kind of claim this
   *  platform exists to refuse; it must not be able to produce one. */
  evidenceId: uuidSchema,
  actorId: uuidSchema.optional(),
  observedAt: z.iso.datetime().optional(),
  platform: z.string().trim().max(100).optional(),
  /** As the platform reported it — never presented as a verified figure. */
  reportedReach: z.coerce.number().int().min(0).optional(),
  note: z.string().trim().max(2_000).optional(),
});
export type RecordObservation = z.infer<typeof recordObservationSchema>;

/* ── The monitoring answer ──────────────────────────────────────────────── */

export const monitoringWindowSchema = z.object({
  /** How far back to look. Defaults to 24 hours. */
  hours: z.coerce.number().int().min(1).max(720).default(24),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type MonitoringWindow = z.infer<typeof monitoringWindowSchema>;

export const narrativeActivitySchema = z.object({
  narrativeId: uuidSchema,
  publicId: z.string(),
  title: z.string(),
  status: narrativeStatusSchema,
  observations: z.number(),
  distinctActors: z.number(),
  /** The number that matters. Independent origins, not voices. */
  distinctFamilies: z.number(),
  /** Actors per independent family. ~1 means each voice is its own origin;
   *  well above 1 means few origins and many mouths. */
  amplification: z.number().nullable(),
  reportedReach: z.number(),
  linkedItems: z.number(),
  itemsFoundProblematic: z.number(),
  lastSeen: z.iso.datetime(),
  /** Plain-language reading of the amplification figure, so a client never
   *  has to invent its own threshold. */
  reading: z.enum(["independent_spread", "mixed", "likely_amplification"]),
});
export type NarrativeActivity = z.infer<typeof narrativeActivitySchema>;

/**
 * Where the line sits between "travelling" and "being pushed".
 *
 * Deliberately coarse and stated in one place. A precise-looking threshold
 * would imply a precision the underlying counts do not have — the same
 * reasoning that keeps numeric probabilities out of scenarios.
 */
export function readActivity(distinctActors: number, distinctFamilies: number) {
  if (distinctFamilies === 0) return "mixed" as const;
  const ratio = distinctActors / distinctFamilies;
  if (distinctFamilies >= 3 && ratio <= 2) return "independent_spread" as const;
  if (ratio >= 4) return "likely_amplification" as const;
  return "mixed" as const;
}
