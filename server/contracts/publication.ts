/**
 * Publication surfaces — request and response shapes. Zod only.
 */

import { z } from "zod";
import {
  likelihoodBandSchema,
  publicationKindSchema,
  publicationSectionSchema,
  publicationStatusSchema,
} from "./enums";
import { languageSchema, uuidSchema } from "./item";

export const createPublicationSchema = z
  .object({
    kind: publicationKindSchema,
    section: publicationSectionSchema.optional(),
    title: z.string().trim().min(1).max(300),
    summary: z.string().trim().max(4_000).optional(),
    body: z.string().trim().min(1).max(200_000),
    language: languageSchema,
    eventId: uuidSchema.optional(),
    primaryTopicId: uuidSchema.optional(),
    itemIds: z.array(uuidSchema).max(100).optional(),
    narrativeIds: z.array(uuidSchema).max(50).optional(),
    evidenceIds: z.array(uuidSchema).max(100).optional(),
    /** Scenarios only — a band, never a number. */
    scenarioLikelihood: likelihoodBandSchema.optional(),
    scenarioIndicators: z.string().trim().max(10_000).optional(),
  })
  /* Mirrors `only_scenarios_state_a_likelihood`, so the API can explain the
     refusal instead of surfacing a constraint violation. */
  .refine((v) => (v.kind === "scenario") === (v.scenarioLikelihood !== undefined), {
    message:
      "A scenario must state a likelihood band, and nothing else may state one. There is deliberately no numeric probability.",
    path: ["scenarioLikelihood"],
  });
export type CreatePublication = z.infer<typeof createPublicationSchema>;

export const updatePublicationSchema = z.object({
  section: publicationSectionSchema.optional(),
  title: z.string().trim().min(1).max(300).optional(),
  summary: z.string().trim().max(4_000).optional(),
  body: z.string().trim().min(1).max(200_000).optional(),
  scenarioIndicators: z.string().trim().max(10_000).optional(),
  changeSummary: z.string().trim().min(1).max(500),
});
export type UpdatePublication = z.infer<typeof updatePublicationSchema>;

export const transitionPublicationSchema = z.object({
  to: publicationStatusSchema,
});
export type TransitionPublication = z.infer<typeof transitionPublicationSchema>;

export const listPublicationsSchema = z.object({
  kind: publicationKindSchema.optional(),
  section: publicationSectionSchema.optional(),
  status: publicationStatusSchema.optional(),
  eventId: uuidSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListPublications = z.infer<typeof listPublicationsSchema>;

/** The deliberately narrow projection returned to anonymous readers. */
export const publicPublicationSchema = z.object({
  publicId: z.string(),
  kind: publicationKindSchema,
  section: publicationSectionSchema,
  title: z.string(),
  summary: z.string().nullable(),
  body: z.string(),
  language: z.string(),
  publishedAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  autoPublishedAt: z.iso.datetime().nullable(),
});
export type PublicPublication = z.infer<typeof publicPublicationSchema>;

export const publicPublicationDetailSchema = publicPublicationSchema.extend({
  sources: z.array(z.object({
    title: z.string(),
    publisher: z.string(),
    url: z.string().nullable(),
    publishedAt: z.string().nullable(),
  })),
  narratives: z.array(z.object({
    publicId: z.string(),
    title: z.string(),
    status: z.string(),
  })),
});
export type PublicPublicationDetail = z.infer<typeof publicPublicationDetailSchema>;

export const listPublicPublicationsSchema = z.object({
  kind: publicationKindSchema.optional(),
  section: publicationSectionSchema.optional(),
  date: z.iso.date().optional(),
  topic: uuidSchema.optional(),
  narrative: uuidSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListPublicPublications = z.infer<typeof listPublicPublicationsSchema>;

/**
 * Which status may follow which.
 *
 * Mirrored by nothing in SQL — unlike `information_item`, whose transitions
 * are a table read by a trigger. That asymmetry is deliberate and worth
 * knowing: an item's lifecycle is walked by ingestion, AI and several humans,
 * so it needed the database's guarantee. A publication is only ever moved by
 * an editor through this service.
 */
export const LEGAL_PUBLICATION_TRANSITIONS = Object.freeze({
  draft: ["under_review", "archived"],
  under_review: ["approved", "draft", "archived"],
  approved: ["published", "draft", "archived"],
  published: ["updated", "archived"],
  updated: ["published", "archived"],
  archived: ["draft"],
} as const);

export const canTransitionPublication = (
  from: keyof typeof LEGAL_PUBLICATION_TRANSITIONS,
  to: string,
): boolean => (LEGAL_PUBLICATION_TRANSITIONS[from] as readonly string[]).includes(to);
