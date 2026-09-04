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

/** The fields of a source creation request. `kind` is the one field an
 *  update may not change, so the update schema strips it below. */
const createSourceFields = {
  sourceFamilyId: uuidSchema,
  kind: sourceKindSchema,
  slug: slugSchema,
  logicalKey: z.string().trim().min(3).max(500).optional(),
  name: z.string().trim().min(1).max(300),
  homepageUrl: z.url().max(2000).optional(),
  feedUrl: z.url().max(2000).optional(),
  language: languageSchema,
  country: z.string().trim().length(2).optional(),
  active: z.boolean().default(true),
  /** Connector settings such as a monitored Google query. Credentials stay in
   * the environment and are never stored in a source row. */
  config: z.record(z.string(), z.unknown()).optional(),
};

/**
 * `gdelt` stays a legal enum value (legacy rows keep rendering and their
 * collection attempt keeps throwing the registered NOT_IMPLEMENTED), but no
 * NEW source may be created with it: no connector is registered, so the row
 * would exist only to be collected into an error. Blocking at creation
 * prevents dead sources; registering a collector is a separate, larger
 * decision (`.ai/DECISIONS.md`, 2026-09-04).
 */
export const createSourceSchema = z.object(createSourceFields).refine(
  (input) => input.kind !== "gdelt",
  { message: "GDELT sources cannot be created: no connector is registered for that kind." },
);
export type CreateSource = z.infer<typeof createSourceSchema>;

export const updateSourceSchema = z.object(createSourceFields)
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
  logicalKey: z.string().nullable(),
  name: z.string(),
  homepageUrl: z.string().nullable(),
  feedUrl: z.string().nullable(),
  language: z.string(),
  country: z.string().nullable(),
  active: z.boolean(),
  config: z.record(z.string(), z.unknown()).nullable(),
  consecutiveFailures: z.number().int().nonnegative(),
  lastSuccessfulFetchAt: z.iso.datetime().nullable(),
  disabledAt: z.iso.datetime().nullable(),
  disabledReason: z.string().nullable(),
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
});
export type SourceView = z.infer<typeof sourceSchema>;
