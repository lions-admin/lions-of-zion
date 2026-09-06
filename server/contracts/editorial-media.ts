import { z } from 'zod';

/**
 * Where an editorial image may be served from.
 *
 * Two origins, both ours: a file committed under `public/`, or an object in
 * this project's public Vercel Blob store, which is what the media ingest
 * path writes after fetching an external image once. Deliberately **not**
 * `z.string().url()` — an open URL field would let a publisher's CDN become
 * the site's image host by accident, which is a permanent hotlink, an
 * uncontrolled third-party request from every reader, and a picture that can
 * be swapped underneath us after publication.
 *
 * `next.config.ts` carries the matching `images.remotePatterns` entry and the
 * CSP already allows this host in `img-src`; all three have to agree.
 */
export const BLOB_MEDIA_HOST = /^https:\/\/[a-z0-9-]+\.public\.blob\.vercel-storage\.com\/[^\s]+$/;
const LOCAL_MEDIA_PATH = /^\/(?!\/)/;

export const editorialMediaSrcSchema = z.string().min(1).refine(
  (value) => LOCAL_MEDIA_PATH.test(value) || BLOB_MEDIA_HOST.test(value),
  { message: 'An editorial image is served from this site or from its own public Blob store, never hotlinked.' },
);

/** True for an image we host ourselves rather than a local file. */
export const isStoredMediaUrl = (src: string): boolean => BLOB_MEDIA_HOST.test(src);

/** A display asset is not evidence. Rights and sensitivity are independent. */
export const editorialMediaSchema = z.object({
  id: z.string().min(1),
  src: editorialMediaSrcSchema,
  width: z.number().int().positive(), height: z.number().int().positive(),
  alt: z.string().min(1), credit: z.string().min(1),
  sourceUrl: z.string().url().optional(), caption: z.string().optional(),
  /** What the image is not, stated first and on its own line: "Context image — not incident documentation". Manufactured kinds (illustration, safe cover) get a default from their role; archival photographs and portraits say it here only when it needs saying. */
  disclosure: z.string().min(1).optional(),
  role: z.enum(['documentation', 'portrait', 'archival-context', 'editorial-illustration', 'safe-cover']),
  focalPoint: z.object({ x: z.number().min(0).max(100), y: z.number().min(0).max(100) }),
  sensitivity: z.enum(['safe', 'sensitive', 'unknown']).default('unknown'),
  rights: z.object({
    status: z.enum(['cleared', 'unknown', 'withdrawn']),
    basis: z.string().min(1), reference: z.string().min(1),
    clearedAt: z.string().date().optional(),
    surfaces: z.array(z.enum(['homepage', 'article'])),
  }),
});
export type EditorialMedia = z.infer<typeof editorialMediaSchema>;
export type EditorialMediaSurface = EditorialMedia['rights']['surfaces'][number];
export type EditorialMediaRole = EditorialMedia['role'];
export const editorialMediaReferenceSchema = z.string().min(1);
export type EditorialMediaReference = z.infer<typeof editorialMediaReferenceSchema>;

/** The homepage bar: safe, cleared, dated, and licensed for this surface. */
export function isHomepageSafeMedia(media: EditorialMedia): boolean {
  return media.sensitivity === 'safe' && media.rights.status === 'cleared'
    && !!media.rights.clearedAt && media.rights.surfaces.includes('homepage');
}

/**
 * The article bar. Lower than the homepage's on purpose: an article may carry
 * a cleared image the homepage would not lead with, and the record's own page
 * is where a sensitive-but-cleared picture belongs if it belongs anywhere.
 * Clearance itself is never optional.
 */
export function isArticleSafeMedia(media: EditorialMedia): boolean {
  return media.rights.status === 'cleared' && media.rights.surfaces.includes('article');
}

/** Surface-agnostic form of the two above. */
export function isMediaAllowedOnSurface(media: EditorialMedia, surface: EditorialMediaSurface): boolean {
  return surface === 'homepage' ? isHomepageSafeMedia(media) : isArticleSafeMedia(media);
}
