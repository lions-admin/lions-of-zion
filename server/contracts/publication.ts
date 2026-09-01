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

export const narrativeWatchDetailsSchema = z.object({
  exactClaim: z.string().trim().min(1).max(4_000),
  propagators: z.array(z.string().trim().min(1).max(300)).max(20),
  arenas: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  trendDirection: z.enum(["rising", "stable", "declining", "new", "unclear"]),
  israeliPosition: z.string().trim().min(1).max(6_000).nullable(),
  securityContext: z.string().trim().min(1).max(6_000).nullable(),
  supportingEvidenceIds: z.array(uuidSchema).max(30),
  contradictingEvidenceIds: z.array(uuidSchema).max(30),
  verificationState: z.enum(["verified", "refuted", "misleading", "unsupported", "disputed", "unresolved"]),
  knownUnknowns: z.array(z.string().trim().min(1).max(1_000)).max(20),
});
export type NarrativeWatchDetails = z.infer<typeof narrativeWatchDetailsSchema>;

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
    editorialTopic: z.string().trim().min(1).max(120).optional(),
    primaryActor: z.string().trim().min(1).max(160).optional(),
    arena: z.string().trim().min(1).max(120).optional(),
    featuredIsraelStory: z.boolean().optional(),
    narrativeWatchDetails: narrativeWatchDetailsSchema.optional(),
    itemIds: z.array(uuidSchema).max(100).optional(),
    narrativeIds: z.array(uuidSchema).max(50).optional(),
    evidenceIds: z.array(uuidSchema).max(100).optional(),
    passages: z.array(z.object({
      text: z.string().trim().min(1).max(20_000),
      itemId: uuidSchema.optional(),
      evidenceIds: z.array(uuidSchema).min(1).max(20),
    })).max(100).optional(),
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
  })
  .refine((v) => (v.section === "narrative_watch") === (v.narrativeWatchDetails !== undefined), {
    message: "Narrative Watch publications require structured monitoring details, and other sections may not carry them.",
    path: ["narrativeWatchDetails"],
  });
export type CreatePublication = z.infer<typeof createPublicationSchema>;

export const updatePublicationSchema = z.object({
  section: publicationSectionSchema.optional(),
  editorialTopic: z.string().trim().min(1).max(120).nullable().optional(),
  primaryActor: z.string().trim().min(1).max(160).nullable().optional(),
  arena: z.string().trim().min(1).max(120).nullable().optional(),
  featuredIsraelStory: z.boolean().optional(),
  narrativeWatchDetails: narrativeWatchDetailsSchema.nullable().optional(),
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
  /** The news editor must not be cluttered with historic static site pages
   * that happen to share the publication table. */
  briefingOnly: z.union([z.literal("true"), z.literal("false"), z.boolean()]).optional()
    .transform((value) => value === true || value === "true"),
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
  editorialTopic: z.string().nullable(),
  primaryActor: z.string().nullable(),
  arena: z.string().nullable(),
  featuredIsraelStory: z.boolean(),
  narrativeWatchDetails: narrativeWatchDetailsSchema.nullable(),
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
  passages: z.array(z.object({
    position: z.number().int().positive(),
    text: z.string(),
    claim: z.object({
      publicId: z.string(),
      title: z.string(),
      assessment: z.string().nullable(),
    }).nullable(),
    sources: z.array(z.object({
      title: z.string(),
      publisher: z.string(),
      url: z.string().nullable(),
    })),
  })),
  relatedArticles: z.array(z.object({
    publicId: z.string(),
    section: publicationSectionSchema,
    title: z.string(),
    summary: z.string().nullable(),
  })),
  corrections: z.array(z.object({
    version: z.number().int().positive(),
    changedAt: z.string(),
    summary: z.string(),
  })),
});
export type PublicPublicationDetail = z.infer<typeof publicPublicationDetailSchema>;

export const publicPublicationCursorSchema = z.string().refine((value) => {
  const split = value.lastIndexOf("|");
  return split > 0
    && !Number.isNaN(new Date(value.slice(0, split)).getTime())
    && value.slice(split + 1).length > 0;
}, "Invalid publication cursor.");

export function encodePublicPublicationCursor(publication: Pick<PublicPublication, "publishedAt" | "publicId">): string {
  return `${publication.publishedAt}|${publication.publicId}`;
}

export function decodePublicPublicationCursor(cursor: string): { publishedAt: Date; publicId: string } {
  const value = publicPublicationCursorSchema.parse(cursor);
  const split = value.lastIndexOf("|");
  return { publishedAt: new Date(value.slice(0, split)), publicId: value.slice(split + 1) };
}

export const listPublicPublicationsSchema = z.object({
  kind: publicationKindSchema.optional(),
  section: publicationSectionSchema.optional(),
  date: z.iso.date().optional(),
  topic: uuidSchema.optional(),
  topicLabel: z.string().trim().min(1).max(120).optional(),
  actor: z.string().trim().min(1).max(160).optional(),
  arena: z.string().trim().min(1).max(120).optional(),
  narrative: uuidSchema.optional(),
  cursor: publicPublicationCursorSchema.optional(),
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
