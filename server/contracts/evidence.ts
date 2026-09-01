/**
 * Evidence — request and response shapes. Zod only.
 */

import { z } from "zod";
import { dataClassSchema, evidenceKindSchema } from "./enums";
import { languageSchema, uuidSchema } from "./item";

export const createEvidenceSchema = z.object({
  sourceId: uuidSchema,
  sourceFetchId: uuidSchema.optional(),
  kind: evidenceKindSchema,
  dataClass: dataClassSchema.default("public"),
  title: z.string().trim().min(1).max(500),
  excerpt: z.string().trim().max(10_000).optional(),
  externalId: z.string().trim().max(500).optional(),
  url: z.url().max(2000).optional(),
  discoveryUrl: z.url().max(2000).optional(),
  canonicalUrl: z.url().max(2000).optional(),
  publisherDomain: z.string().trim().max(300).optional(),
  normalizedContentHash: z.string().regex(/^[a-f0-9]{64}$/).optional(),
  usableTextLength: z.number().int().min(0).optional(),
  retrievalStatus: z.enum(["discovered", "fetched", "partial", "failed"]).optional(),
  accessState: z.enum(["open", "blocked", "login_required", "paywalled", "unavailable"]).optional(),
  contentType: z.string().trim().max(200).optional(),
  discoveryMetadata: z.record(z.string(), z.unknown()).optional(),
  retentionClass: z.enum(["metadata_only", "metadata_excerpt", "raw_permitted"]).optional(),
  language: languageSchema,
  publishedAt: z.iso.datetime().optional(),
});
export type CreateEvidence = z.infer<typeof createEvidenceSchema>;

export const listEvidenceSchema = z.object({
  sourceId: uuidSchema.optional(),
  kind: evidenceKindSchema.optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListEvidence = z.infer<typeof listEvidenceSchema>;

export const evidenceSchema = z.object({
  id: uuidSchema,
  sourceId: uuidSchema,
  sourceFetchId: uuidSchema.nullable(),
  kind: evidenceKindSchema,
  dataClass: dataClassSchema,
  title: z.string(),
  excerpt: z.string().nullable(),
  externalId: z.string().nullable(),
  discoveryUrl: z.string().nullable(),
  canonicalUrl: z.string().nullable(),
  publisherDomain: z.string().nullable(),
  url: z.string().nullable(),
  blobUrl: z.string().nullable(),
  language: z.string(),
  capturedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
  normalizedContentHash: z.string().nullable(),
  usableTextLength: z.number().int(),
  retrievalStatus: z.string(),
  accessState: z.string(),
  contentType: z.string().nullable(),
  discoveryMetadata: z.record(z.string(), z.unknown()).nullable(),
  retentionClass: z.string(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type EvidenceView = z.infer<typeof evidenceSchema>;
