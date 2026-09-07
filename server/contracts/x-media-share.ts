import { z } from "zod";

export const xArchivePackageSchema = z.enum(["october7", "hamas-massacre"]);

export const xArchiveMediaPostSchema = z.object({
  pkg: xArchivePackageSchema,
  recordId: z.string().min(1).max(220),
  mediaId: z.string().regex(/^(?:img|vid)-[a-f0-9]{16}$/),
  locale: z.string().min(2).max(12).optional(),
  assetUrl: z.string().url().max(4096),
}).strict();

export type XArchiveMediaPostInput = z.infer<typeof xArchiveMediaPostSchema>;

export const xArchiveMediaPostResponseSchema = z.discriminatedUnion("status", [
  z.object({ status: z.literal("posted"), postUrl: z.string().url() }).strict(),
  z.object({ status: z.literal("unauthorized") }).strict(),
  z.object({ status: z.literal("media_unavailable") }).strict(),
  z.object({ status: z.literal("upload_failed") }).strict(),
  z.object({ status: z.literal("post_failed") }).strict(),
]);

export type XArchiveMediaPostResponse = z.infer<typeof xArchiveMediaPostResponseSchema>;
