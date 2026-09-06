import { z } from 'zod';

/** A display asset is not evidence. Rights and sensitivity are independent. */
export const editorialMediaSchema = z.object({
  id: z.string().min(1),
  src: z.string().regex(/^\/(?!\/)/),
  width: z.number().int().positive(), height: z.number().int().positive(),
  alt: z.string().min(1), credit: z.string().min(1),
  sourceUrl: z.string().url().optional(), caption: z.string().optional(),
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
export const editorialMediaReferenceSchema = z.string().min(1);
export type EditorialMediaReference = z.infer<typeof editorialMediaReferenceSchema>;
export function isHomepageSafeMedia(media: EditorialMedia): boolean {
  return media.sensitivity === 'safe' && media.rights.status === 'cleared'
    && !!media.rights.clearedAt && media.rights.surfaces.includes('homepage');
}
