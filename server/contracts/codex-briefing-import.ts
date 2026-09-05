import { z } from "zod";
import { publicationSectionSchema } from "./enums";

const sourceKeySchema = z.string().trim().min(1).max(100);

export const codexBriefingSourceSchema = z.object({
  key: sourceKeySchema,
  title: z.string().trim().min(1).max(500),
  publisher: z.string().trim().min(1).max(300),
  url: z.url().max(2_000),
  excerpt: z.string().trim().max(10_000).optional(),
  publishedAt: z.iso.datetime().optional(),
});

const narrativeDetailsSchema = z.object({
  exactClaim: z.string().trim().min(1).max(4_000),
  propagators: z.array(z.string().trim().min(1).max(300)).max(20).default([]),
  arenas: z.array(z.string().trim().min(1).max(120)).min(1).max(20),
  trendDirection: z.enum(["rising", "stable", "declining", "new", "unclear"]),
  israeliPosition: z.string().trim().min(1).max(6_000).nullable().default(null),
  securityContext: z.string().trim().min(1).max(6_000).nullable().default(null),
  supportingSourceKeys: z.array(sourceKeySchema).max(30).default([]),
  contradictingSourceKeys: z.array(sourceKeySchema).max(30).default([]),
  verificationState: z.enum(["verified", "refuted", "misleading", "unsupported", "disputed", "unresolved"]),
  knownUnknowns: z.array(z.string().trim().min(1).max(1_000)).max(20).default([]),
});

export const codexBriefingPublicationSchema = z.object({
  candidateKey: z.string().trim().min(1).max(120),
  section: publicationSectionSchema,
  title: z.string().trim().min(1).max(300),
  summary: z.string().trim().max(4_000).optional(),
  body: z.string().trim().min(1).max(200_000),
  sourceKeys: z.array(sourceKeySchema).min(1).max(30),
  editorialTopic: z.string().trim().min(1).max(120).optional(),
  primaryActor: z.string().trim().min(1).max(160).optional(),
  arena: z.string().trim().min(1).max(120).optional(),
  featuredIsraelStory: z.boolean().default(false),
  narrativeWatchDetails: narrativeDetailsSchema.optional(),
}).superRefine((publication, ctx) => {
  if ((publication.section === "narrative_watch") !== Boolean(publication.narrativeWatchDetails)) {
    ctx.addIssue({
      code: "custom",
      path: ["narrativeWatchDetails"],
      message: "Narrative Watch entries require structured narrative details, and other sections may not carry them.",
    });
  }
});

export const codexBriefingImportSchema = z.object({
  schemaVersion: z.literal(1),
  idempotencyKey: z.string().trim().min(8).max(200),
  editorialDate: z.iso.date(),
  sources: z.array(codexBriefingSourceSchema).min(1).max(100),
  publications: z.array(codexBriefingPublicationSchema).min(1).max(10),
}).superRefine((input, ctx) => {
  const sourceKeys = new Set<string>();
  for (const [index, source] of input.sources.entries()) {
    if (sourceKeys.has(source.key)) {
      ctx.addIssue({ code: "custom", path: ["sources", index, "key"], message: "Source keys must be unique." });
    }
    sourceKeys.add(source.key);
  }

  const candidateKeys = new Set<string>();
  for (const [index, publication] of input.publications.entries()) {
    if (candidateKeys.has(publication.candidateKey)) {
      ctx.addIssue({ code: "custom", path: ["publications", index, "candidateKey"], message: "Candidate keys must be unique." });
    }
    candidateKeys.add(publication.candidateKey);
    const references = [
      ...publication.sourceKeys,
      ...(publication.narrativeWatchDetails?.supportingSourceKeys ?? []),
      ...(publication.narrativeWatchDetails?.contradictingSourceKeys ?? []),
    ];
    for (const key of references) {
      if (!sourceKeys.has(key)) {
        ctx.addIssue({
          code: "custom",
          path: ["publications", index, "sourceKeys"],
          message: `Unknown source key: ${key}`,
        });
      }
    }
  }
});

export type CodexBriefingImport = z.infer<typeof codexBriefingImportSchema>;
