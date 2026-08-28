/**
 * Sources and source families — request and response shapes. Zod only.
 */

import { z } from "zod";
import { languageSchema, uuidSchema } from "./item";
import { sourceKindSchema } from "./enums";

export const slugSchema = z
  .string()
  .min(2)
  .max(80)
  .regex(/^[a-z0-9][a-z0-9-]*[a-z0-9]$/, "must be lowercase kebab-case");

export const createSourceFamilySchema = z.object({
  slug: slugSchema,
  label: z.string().trim().min(1).max(200),
  description: z.string().trim().max(2000).optional(),
});
export type CreateSourceFamily = z.infer<typeof createSourceFamilySchema>;

export const sourceFamilySchema = z.object({
  id: uuidSchema,
  slug: slugSchema,
  label: z.string(),
  description: z.string().nullable(),
  createdAt: z.iso.datetime(),
});
export type SourceFamilyView = z.infer<typeof sourceFamilySchema>;

export const createSourceSchema = z.object({
  sourceFamilyId: uuidSchema,
  kind: sourceKindSchema,
  slug: slugSchema,
  name: z.string().trim().min(1).max(300),
  homepageUrl: z.url().max(2000).optional(),
  feedUrl: z.url().max(2000).optional(),
  language: languageSchema,
  country: z.string().trim().length(2).optional(),
  active: z.boolean().default(true),
  /** Connector settings such as a monitored Google query. Credentials stay in
   * the environment and are never stored in a source row. */
  config: z.record(z.string(), z.unknown()).optional(),
});
export type CreateSource = z.infer<typeof createSourceSchema>;

export const updateSourceSchema = createSourceSchema
  .partial()
  .omit({ kind: true, slug: true })
  .extend({ changeSummary: z.string().trim().min(1).max(500) });
export type UpdateSource = z.infer<typeof updateSourceSchema>;

export const listSourcesSchema = z.object({
  sourceFamilyId: uuidSchema.optional(),
  kind: sourceKindSchema.optional(),
  active: z.coerce.boolean().optional(),
  cursor: z.string().optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListSources = z.infer<typeof listSourcesSchema>;

export const sourceSchema = z.object({
  id: uuidSchema,
  sourceFamilyId: uuidSchema,
  kind: sourceKindSchema,
  slug: slugSchema,
  name: z.string(),
  homepageUrl: z.string().nullable(),
  feedUrl: z.string().nullable(),
  language: z.string(),
  country: z.string().nullable(),
  active: z.boolean(),
  config: z.record(z.string(), z.unknown()).nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SourceView = z.infer<typeof sourceSchema>;
