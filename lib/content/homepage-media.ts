import 'server-only';
import { z } from 'zod';
import media from '@/content-packages/homepage/media.json';
import excerpts from '@/content-packages/homepage/excerpts.json';
import { editorialMediaSchema, isHomepageSafeMedia } from '@/server/contracts/editorial-media';
import type { HomeReference } from '@/server/contracts/homepage';

/** `defaults` is the cover of last resort, one per record kind. It exists
 *  because `resolveHomepageReference` drops a record whole when this returns
 *  null, so an unmapped picture used to cost the reader the record — the
 *  homepage went to a bare "temporarily unavailable" line for want of an
 *  image. A default is drawn artwork, carries its own caption saying so, and
 *  is held to the same safety gate as every other asset. */
const registrySchema = z.object({
  assets: z.array(editorialMediaSchema),
  mappings: z.record(z.string(), z.string()),
  defaults: z.record(z.string(), z.string()).default({}),
});
const excerptSchema=z.array(z.object({key:z.string(),role:z.enum(['summary','finding','whyItMatters']),text:z.string().min(1),sourceField:z.string().min(1),sourceReference:z.string().min(1),version:z.string().min(1)}));
const registry=registrySchema.parse(media);
const notes=excerptSchema.parse(excerpts);

type HomeKind = HomeReference['kind'];
const safeAsset=(id:string|undefined)=>{
  const asset=id?registry.assets.find(a=>a.id===id):undefined;
  return asset&&isHomepageSafeMedia(asset)?asset:null;
};
export function homepageMedia(key:string, canonicalId?:string, kind?:HomeKind){
  return safeAsset(canonicalId??registry.mappings[key]) ?? (kind?safeAsset(registry.defaults[kind]):null);
}
export function homepageExcerpt(key:string,role:'summary'|'finding'|'whyItMatters',version:string){
  return notes.find(n=>n.key===key&&n.role===role&&n.version===version)?.text;
}
export function homepageMediaMappings(){return registry.mappings;}
export function homepageDefaultMediaId(kind:HomeKind){return registry.defaults[kind];}
export function homepageMediaConflict(key:string, canonicalId?:string){
  const mappedId=registry.mappings[key];
  return canonicalId && mappedId && canonicalId!==mappedId
    ? {key,canonicalId,mappedId,resolution:'canonical-reference-wins'} : null;
}
