import { z } from 'zod';
import type { EditorialMedia } from './editorial-media';

export const homeSections = ['news', 'fakeResistance', 'october7', 'heroes', 'israelsStory', 'people'] as const;
export const homeSectionSchema = z.enum(homeSections);
export type HomeSectionName = z.infer<typeof homeSectionSchema>;
export const homeReferenceSchema = z.object({
  key: z.string().min(1), section: homeSectionSchema,
  kind: z.enum(['news', 'watch', 'case', 'testimony', 'documentation', 'hero', 'chapter', 'feature']),
  id: z.string().min(1), href: z.string().regex(/^\/(?!\/)/),
  version: z.string().min(1), date: z.string(), mediaId: z.string().min(1).nullable().default(null),
}).superRefine((ref, ctx) => {
  const sectionForKind = {news:'news', watch:'fakeResistance', case:'fakeResistance', testimony:'october7', documentation:'october7', hero:'heroes', chapter:'israelsStory', feature:'people'};
  if (sectionForKind[ref.kind] !== ref.section) ctx.addIssue({code:'custom',message:'Content kind does not belong in this homepage section'});
});
export type HomeReference = z.infer<typeof homeReferenceSchema>;
export const homePairSchema = z.array(homeReferenceSchema).max(2);
export const homeSelectionSchema = z.object({
  news: homePairSchema, fakeResistance: homePairSchema, october7: homePairSchema,
  heroes: homePairSchema, israelsStory: homePairSchema, people: homePairSchema.default([]),
}).superRefine((s, ctx) => {
  const keys = new Set<string>();
  for (const section of homeSections) for (const ref of s[section]) {
    if (keys.has(ref.key) || ref.section !== section) ctx.addIssue({code:'custom',message:'Duplicate or misplaced homepage reference'});
    keys.add(ref.key);
  }
});
export type HomeSelection = z.infer<typeof homeSelectionSchema>;
export const homeSnapshotSchema = z.object({
  editionDate: z.string().date(), revision: z.number().int().positive(),
  generatedAt: z.string().datetime(), catalogRevision: z.string().min(1), reason: z.string().min(1),
  selection: homeSelectionSchema,
});
export type HomeSnapshot = z.infer<typeof homeSnapshotSchema>;
export const homeCatalogSchema = z.object({revision:z.string().min(1), sourceRevision:z.string().min(1), candidates:z.array(homeReferenceSchema)});
export const homeOverridesSchema = z.object({revision:z.string(), pins:z.array(z.object({
  key:z.string(), section:homeSectionSchema, order:z.number().int().nonnegative(),
  reason:z.string().min(1), expires:z.string().date().optional(),
})), breakingNews:z.object({keys:z.array(z.string()).max(2), reason:z.string().min(1), revision:z.string(), expires:z.string().date()}).nullable()});
export type HomeOverrides = z.infer<typeof homeOverridesSchema>;
export type HomeSource = { label:string; url:string };
type PreviewBase = {key:string; href:string; title:string; summary:string; date:string; media:EditorialMedia|null; sources:HomeSource[]; whyItMatters?:string};
export type NewsPreview = PreviewBase & {kind:'news'; category:string};
export type WatchPreview = PreviewBase & {kind:'watch'; claim:string; finding?:string; verification:string; basis:'sourced'|'analysis'};
export type CasePreview = PreviewBase & {kind:'case'; question:string; finding?:string; confidence:string; sourceCount:number};
export type ArchivePreview = PreviewBase & {kind:'testimony'|'documentation'; witness?:string; warning:string};
export type HeroPreview = PreviewBase & {kind:'hero'; role:string; meta:string};
export type HistoryPreview = PreviewBase & {kind:'chapter'; era:string; contested:boolean};
export type FeaturePreview = PreviewBase & {kind:'feature'; category:string};
export type HomePreview = FeaturePreview|NewsPreview|WatchPreview|CasePreview|ArchivePreview|HeroPreview|HistoryPreview;
export type HomepageSection<T> = {state:'ready'|'partial'|'empty'|'unavailable'; items:T[]; gaps:string[]};
export type HomepageEdition = {
  editionDate:string; revision:number; generatedAt:string;
  state:'current'|'previous-edition'|'unavailable'; localPreview:boolean;
  news:HomepageSection<NewsPreview>; fakeResistance:HomepageSection<WatchPreview|CasePreview>;
  people?:HomepageSection<FeaturePreview>;
  october7:HomepageSection<ArchivePreview>; heroes:HomepageSection<HeroPreview>; israelsStory:HomepageSection<HistoryPreview>;
};
export function israelEditionDate(now = new Date()): string {
  return new Intl.DateTimeFormat('en-CA',{timeZone:'Asia/Jerusalem',year:'numeric',month:'2-digit',day:'2-digit'}).format(now);
}
