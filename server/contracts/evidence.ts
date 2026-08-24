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
  url: z.string().nullable(),
  blobUrl: z.string().nullable(),
  language: z.string(),
  capturedAt: z.iso.datetime(),
  publishedAt: z.iso.datetime().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type EvidenceView = z.infer<typeof evidenceSchema>;
