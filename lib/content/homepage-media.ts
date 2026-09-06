import 'server-only';
/* The static/legacy media path: a hand-mapped registry keyed by homepage
 * reference. A live publication now carries its own `media` on the public
 * projection and uses this only as the fallback for records mapped here
 * before that field existed. */
import { z } from 'zod';
import media from '@/content-packages/homepage/media.json';
import excerpts from '@/content-packages/homepage/excerpts.json';
import { editorialMediaSchema, isArticleSafeMedia, isHomepageSafeMedia, type EditorialMedia } from '@/server/contracts/editorial-media';
import type { PublicPublication } from '@/server/contracts/publication';
import { SITE_URL } from '@/lib/site-config';
const registrySchema = z.object({assets:z.array(editorialMediaSchema), mappings:z.record(z.string(),z.string())});
const excerptSchema=z.array(z.object({key:z.string(),role:z.enum(['summary','finding','whyItMatters']),text:z.string().min(1),sourceField:z.string().min(1),sourceReference:z.string().min(1),version:z.string().min(1)}));
const registry=registrySchema.parse(media);
const notes=excerptSchema.parse(excerpts);
export function homepageMedia(key:string, canonicalId?:string){
  const asset=editorialMediaForSurface(key,'homepage',canonicalId);
  return asset&&isHomepageSafeMedia(asset)?asset:null;
}
export function editorialMediaForSurface(key:string,surface:EditorialMedia['rights']['surfaces'][number],canonicalId?:string){
  const id=canonicalId??registry.mappings[key];
  const asset=registry.assets.find(a=>a.id===id);
  return asset&&asset.sensitivity==='safe'&&asset.rights.status==='cleared'
    &&!!asset.rights.clearedAt&&asset.rights.surfaces.includes(surface)?asset:null;
}
export function homepageExcerpt(key:string,role:'summary'|'finding'|'whyItMatters',version:string){
  return notes.find(n=>n.key===key&&n.role===role&&n.version===version)?.text;
}
export function homepageMediaMappings(){return registry.mappings;}
export function homepageMediaConflict(key:string, canonicalId?:string){
  const mappedId=registry.mappings[key];
  return canonicalId && mappedId && canonicalId!==mappedId
    ? {key,canonicalId,mappedId,resolution:'canonical-reference-wins'} : null;
}

/**
 * The record's own picture first, the static registry second.
 *
 * Lived as a private function in `app/articles/[publicId]/page.tsx` until the
 * share card needed the same answer. Two copies of "which image may this
 * article wear" is exactly how a page and its Open Graph card end up
 * disagreeing about a rights state, so there is one.
 *
 * Checked against `isArticleSafeMedia` rather than trusted: the projection
 * filters, but a surface that assumes it did is one refactor away from
 * publishing an uncleared image.
 */
export function articleHeroMedia(article: PublicPublication): EditorialMedia | null {
  if (article.media && isArticleSafeMedia(article.media)) return article.media;
  return editorialMediaForSurface(`publication:${article.publicId}`, 'article');
}

/** `src` is a local path or an absolute Blob URL; only the first needs a host. */
export function absoluteMediaUrl(src: string): string {
  return src.startsWith('/') ? SITE_URL + src : src;
}
