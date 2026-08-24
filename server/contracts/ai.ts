/**
 * AI runs, suggestions and translations — request and response shapes.
 * Zod only.
 */

import { z } from "zod";
import { aiRunKindSchema, entityTypeSchema } from "./enums";
import { languageSchema, uuidSchema } from "./item";

export const SUGGESTION_STATUSES = ["pending", "accepted", "rejected", "superseded"] as const;
export const suggestionStatusSchema = z.enum(SUGGESTION_STATUSES);
export type SuggestionStatus = z.infer<typeof suggestionStatusSchema>;

/** What a model may be asked to propose. Deliberately a closed list: an
 *  open-ended "field" would let a suggestion target anything, including the
 *  columns the publish gate depends on. */
export const SUGGESTABLE_FIELDS = ["summary", "topics", "relation", "translation"] as const;
export const suggestableFieldSchema = z.enum(SUGGESTABLE_FIELDS);
export type SuggestableField = z.infer<typeof suggestableFieldSchema>;

export const requestSuggestionSchema = z.object({
  subjectType: entityTypeSchema,
  subjectId: uuidSchema,
  field: suggestableFieldSchema,
});
export type RequestSuggestion = z.infer<typeof requestSuggestionSchema>;

export const decideSuggestionSchema = z.object({
  decision: z.enum(["accepted", "rejected"]),
  note: z.string().trim().max(2_000).optional(),
});
export type DecideSuggestion = z.infer<typeof decideSuggestionSchema>;

export const listSuggestionsSchema = z.object({
  subjectId: uuidSchema.optional(),
  status: suggestionStatusSchema.optional(),
  limit: z.coerce.number().int().min(1).max(100).default(25),
});
export type ListSuggestions = z.infer<typeof listSuggestionsSchema>;

export const requestTranslationSchema = z.object({
  subjectType: entityTypeSchema,
  subjectId: uuidSchema,
  field: z.string().trim().min(1).max(100),
  targetLanguage: languageSchema,
});
export type RequestTranslation = z.infer<typeof requestTranslationSchema>;

export const aiRunSchema = z.object({
  id: uuidSchema,
  kind: aiRunKindSchema,
  model: z.string(),
  modelProfile: z.string(),
  status: z.string(),
  inputTokens: z.number().nullable(),
  outputTokens: z.number().nullable(),
  costUsd: z.string().nullable(),
  latencyMs: z.number().nullable(),
  createdAt: z.iso.datetime(),
});
export type AiRunView = z.infer<typeof aiRunSchema>;
