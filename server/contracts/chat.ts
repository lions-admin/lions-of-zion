/**
 * Chat threads, messages and citations — request and response shapes.
 * Zod only.
 */

import { z } from "zod";
import { assessmentValueSchema, confidenceSummarySchema } from "./enums";
import { uuidSchema } from "./item";

export const CHAT_ROLES = ["user", "assistant", "system"] as const;
export const chatRoleSchema = z.enum(CHAT_ROLES);
export type ChatRole = z.infer<typeof chatRoleSchema>;

export const createThreadSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});
export type CreateThread = z.infer<typeof createThreadSchema>;

export const postMessageSchema = z.object({
  content: z.string().trim().min(1).max(600),
});
export type PostMessage = z.infer<typeof postMessageSchema>;

export const citationSchema = z.object({
  documentId: uuidSchema,
  quote: z.string().nullable(),
});
export type Citation = z.infer<typeof citationSchema>;

export const chatMessageSchema = z.object({
  id: uuidSchema,
  threadId: uuidSchema,
  seq: z.number().int(),
  role: chatRoleSchema,
  content: z.string(),
  citations: z.array(citationSchema),
  createdAt: z.iso.datetime(),
});
export type ChatMessageView = z.infer<typeof chatMessageSchema>;

/**
 * What the retrieval tool hands back to the model, and what the transcript
 * records. `documentId` is the only thing a citation may name.
 *
 * `verdict` is the important field and the reason this shape exists.
 *
 * `search_document` deliberately indexes only title, body and language — a
 * search for "verified" must not return every verified item ahead of an
 * article about verification. That exclusion was right for search and wrong
 * for chat: it meant the most persuasive surface in the system was answering
 * from claim text with no idea what had been concluded about it. A model
 * shown "the hospital was struck by X" and nothing else will summarise the
 * claim as though it stood, because nothing told it otherwise.
 *
 * So the verdict travels **beside** the text, never inside it. It is joined on
 * after retrieval, so it informs the answer without polluting the index.
 */
export const documentVerdictSchema = z.object({
  /** The published conclusion, when there is one. */
  assessment: assessmentValueSchema.nullable(),
  confidence: confidenceSummarySchema.nullable(),
  /** Whether this conclusion is public or still internal. A finding under
   *  review must not be voiced as settled. */
  isPublished: z.boolean(),
  /** What the assessment said remains unknown. The single most important
   *  field to carry through: an answer that omits the caveats is worse than
   *  one that omits the finding. */
  knownGaps: z.string().nullable(),
});
export type DocumentVerdict = z.infer<typeof documentVerdictSchema>;

export const retrievedDocumentSchema = z.object({
  documentId: uuidSchema,
  title: z.string(),
  excerpt: z.string(),
  /** Null for anything that is not a checked claim — evidence and narratives
   *  carry no verdict of their own. */
  verdict: documentVerdictSchema.nullable(),
});
export type RetrievedDocument = z.infer<typeof retrievedDocumentSchema>;
