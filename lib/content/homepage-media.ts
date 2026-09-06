import 'server-only';
import { z } from 'zod';
import media from '@/content-packages/homepage/media.json';
import excerpts from '@/content-packages/homepage/excerpts.json';
import { editorialMediaSchema, isHomepageSafeMedia, type EditorialMedia } from '@/server/contracts/editorial-media';
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
