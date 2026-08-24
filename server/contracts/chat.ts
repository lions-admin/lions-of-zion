/**
 * Chat threads, messages and citations — request and response shapes.
 * Zod only.
 */

import { z } from "zod";
import { uuidSchema } from "./item";

export const CHAT_ROLES = ["user", "assistant", "system"] as const;
export const chatRoleSchema = z.enum(CHAT_ROLES);
export type ChatRole = z.infer<typeof chatRoleSchema>;

export const createThreadSchema = z.object({
  title: z.string().trim().min(1).max(200).optional(),
});
export type CreateThread = z.infer<typeof createThreadSchema>;

export const postMessageSchema = z.object({
  content: z.string().trim().min(1).max(10_000),
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

/** What the retrieval tool hands back to the model, and what the transcript
 *  records. `documentId` is the only thing a citation may name. */
export const retrievedDocumentSchema = z.object({
  documentId: uuidSchema,
  title: z.string(),
  excerpt: z.string(),
});
export type RetrievedDocument = z.infer<typeof retrievedDocumentSchema>;
