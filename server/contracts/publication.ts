/**
 * Publication surfaces — request and response shapes. Zod only.
 */

import { z } from "zod";
import { editorialMediaSchema } from "./editorial-media";
import {
  likelihoodBandSchema,
  publicationKindSchema,
  publicationSectionSchema,
  publicationStatusSchema,
} from "./enums";
import { languageSchema, uuidSchema } from "./item";

/**
 * Whether a Narrative Watch record rests on cited sources or on this
 * organisation's own reasoning.
 *
 * This is **derived, never chosen** — it is exactly `evidenceIds.length === 0`
 * on the drafted article. A model-set flag would be found by the draft retry
 * loop, which feeds every quality failure back into the next attempt: one
 * token would switch off seven evidence checks, and the loop is a gradient
 * pointed straight at whatever stops the failures.
 *
 * Legacy rows predate the field, so it defaults. Read it as `=== "analysis"`
 * and never as `!== "analysis"`: an absent value must fall to the strict side.
 */
export const evidenceBasisSchema = z.enum(["sourced", "analysis"]).default("sourced");
export type EvidenceBasis = z.infer<typeof evidenceBasisSchema>;

/** The byline an unsourced refutation's claims are attributed to. */
export const ANALYSIS_AUTHOR = "Lions of Zion editorial analysis";

/** Secondary subjects refine discovery without creating another destination. */
export const publicationTopicTagSchema = z.string().trim().toLowerCase().regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use lowercase hyphenated topic tags.").max(80);
/** Stable editorial identity for a developing story, independent of its URL. */
export const canonicalStoryIdSchema = z.string().trim().toLowerCase()
  .regex(/^[a-z0-9]+(?:-[a-z0-9]+)*$/, "Use a lowercase hyphenated canonical story id.")
  .max(160);

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
  evidenceBasis: evidenceBasisSchema,
});
export type NarrativeWatchDetails = z.infer<typeof narrativeWatchDetailsSchema>;

/** The editable half of the monitoring record — everything a human may set. */
export const narrativeWatchDetailsUpdateSchema = narrativeWatchDetailsSchema.omit({
  evidenceBasis: true,
});
export type NarrativeWatchDetailsUpdate = z.infer<typeof narrativeWatchDetailsUpdateSchema>;

/** True only for a record that cites nothing. Absent reads as sourced. */
export function isAnalysisBasis(details: { evidenceBasis?: string } | null | undefined): boolean {
  return details?.evidenceBasis === "analysis";
}

/**
 * The public headline prefix for a Narrative Watch record.
 *
 * Two call sites apply this — the briefing normaliser at draft time and the
 * public projection on read — and they used to carry separate copies of the
 * wording and the recogniser regex. A sourced record is a *report of* a claim;
 * an unsourced refutation is our own answer to one, so they cannot share a
 * prefix, and a mismatched pair renders "Reported claim: Analysis: …".
 */
const NARRATIVE_PREFIXES = { sourced: "Reported claim: ", analysis: "Analysis: " } as const;
const PREFIXED = /^(?:reported|unverified|disputed)\s+(?:claim|report)\s*:|^analysis\s*:/i;

export function narrativeWatchTitle(title: string, basis: EvidenceBasis): string {
  const trimmed = title.trim();
  if (!trimmed || PREFIXED.test(trimmed)) return trimmed;
  return `${NARRATIVE_PREFIXES[basis]}${trimmed}`;
}

export const createPublicationSchema = z
  .object({
    kind: publicationKindSchema,
    section: publicationSectionSchema.optional(),
    canonicalStoryId: canonicalStoryIdSchema.optional(),
    title: z.string().trim().min(1).max(300),
    summary: z.string().trim().max(4_000).optional(),
    body: z.string().trim().min(1).max(200_000),
    language: languageSchema,
    eventId: uuidSchema.optional(),
    primaryTopicId: uuidSchema.optional(),
    editorialTopic: z.string().trim().min(1).max(120).optional(),
    topicTags: z.array(publicationTopicTagSchema).max(20).optional(),
    primaryActor: z.string().trim().min(1).max(160).optional(),
    arena: z.string().trim().min(1).max(120).optional(),
    featuredIsraelStory: z.boolean().optional(),
    narrativeWatchDetails: narrativeWatchDetailsSchema.optional(),
    itemIds: z.array(uuidSchema).max(100).optional(),
    narrativeIds: z.array(uuidSchema).max(50).optional(),
    evidenceIds: z.array(uuidSchema).max(100).optional(),
    /* The floor lives in the refine below rather than here, because only the
       whole publication knows whether it is an unsourced Narrative Watch
       analysis — the one record permitted to cite nothing. */
    passages: z.array(z.object({
      text: z.string().trim().min(1).max(20_000),
      itemId: uuidSchema.optional(),
      evidenceIds: z.array(uuidSchema).max(20),
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
  })
  /* Every passage cites the evidence supporting it. The single exception is a
     Narrative Watch record published as this organisation's own analysis,
     which cites nothing anywhere — never partly. */
  .refine(
    (v) => {
      const passages = v.passages ?? [];
      if (isAnalysisBasis(v.narrativeWatchDetails)) {
        return passages.every((passage) => passage.evidenceIds.length === 0);
      }
      return passages.every((passage) => passage.evidenceIds.length > 0);
    },
    {
      message:
        "Every passage must cite its supporting evidence, unless the publication is a Narrative Watch analysis, which must cite none.",
      path: ["passages"],
    },
  );
export type CreatePublication = z.infer<typeof createPublicationSchema>;

export const updatePublicationSchema = z.object({
  section: publicationSectionSchema.optional(),
  canonicalStoryId: canonicalStoryIdSchema.nullable().optional(),
  editorialTopic: z.string().trim().min(1).max(120).nullable().optional(),
  topicTags: z.array(publicationTopicTagSchema).max(20).optional(),
  primaryActor: z.string().trim().min(1).max(160).nullable().optional(),
  arena: z.string().trim().min(1).max(120).nullable().optional(),
  featuredIsraelStory: z.boolean().optional(),
  /* `evidenceBasis` is deliberately absent, and its absence is load-bearing.
     It is derived from whether the record cites anything, so no editor and no
     API client may set it — and because the create schema gives it a
     `"sourced"` default, accepting the full shape here would let a PATCH that
     merely omits the key silently relabel an unsourced analysis as a
     documented report, which is exactly the disclosure this field exists to
     carry. `publicationService.update` merges the stored value back in. */
  narrativeWatchDetails: narrativeWatchDetailsUpdateSchema.nullable().optional(),
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
  canonicalStoryId: canonicalStoryIdSchema.nullable().default(null),
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
  topicTags: z.array(publicationTopicTagSchema).default([]),
  primaryActor: z.string().nullable(),
  arena: z.string().nullable(),
  featuredIsraelStory: z.boolean(),
  narrativeWatchDetails: narrativeWatchDetailsSchema.nullable(),
  /**
   * The hero image this publication owns, or null.
   *
   * On the projection rather than in a static registry so that every surface
   * that receives a publication draws the same picture: the homepage band,
   * the hub listing, the narrative desk and the article page all read this
   * one field. A dynamically published record has no manual mapping to add.
   *
   * Defaulted so a value serialized before the field existed still parses —
   * `withLastGoodRead` and `unstable_cache` both hold projections across a
   * deploy. Absent reads as "no image", never as an unchecked one.
   */
  media: editorialMediaSchema.nullable().default(null),
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
  tag: publicationTopicTagSchema.optional(),
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
