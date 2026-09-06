import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import { readHomepageSnapshot, isLocalHomepagePreview } from './publications';
import { homeSnapshotSchema, israelEditionDate, type HomePreview, type HomeReference, type HomepageEdition, type HomepageSection, type HomeSnapshot } from '@/server/contracts/homepage';
import { resolveHomepageReference } from './content/homepage-adapters';
import { homepageExcerpt, homepageMedia } from './content/homepage-media';

export async function resolveHomepageSection<T extends HomePreview>(refs:HomeReference[],resolve=resolveHomepageReference):Promise<HomepageSection<T>> {
  const settled=await Promise.allSettled(refs.map(resolve));
  const items:T[]=[],gaps:string[]=[];
  settled.forEach((result,i)=>{
    if(result.status==='fulfilled'&&result.value)items.push(result.value as T);
    else gaps.push(refs[i].key);
  });
  return {items,gaps,state:items.length===2?'ready':items.length?'partial':refs.length?'unavailable':'empty'};
}

const localRecordSchema=z.object({
  kind:z.enum(['news','watch']), title:z.string().min(1), summary:z.string(), category:z.string().optional(),
  claim:z.string().optional(), verification:z.string().optional(), basis:z.enum(['sourced','analysis']).optional(),
  publishedAt:z.string().datetime(), updatedAt:z.string().datetime(),
  sources:z.array(z.object({label:z.string().min(1),url:z.string().min(1)})),
});
const localRecordsSchema=z.object({records:z.record(z.string(),localRecordSchema)});

/**
 * Development-only. The frozen local edition points at publication rows that
 * only a database can resolve, and a fresh checkout has none. When the real
 * resolution fails under the local preview, the reference is served from
 * `local-records.json` — a transcription of the same published records — so
 * the composition can still be reviewed. It is never consulted outside the
 * local preview, never when the database answers, and never a live fallback:
 * the edition is already flagged `localPreview` on the page.
 */
async function localPreviewResolver(){
  let records:z.infer<typeof localRecordsSchema>['records']={};
  try{records=localRecordsSchema.parse(JSON.parse(await readFile(join(process.cwd(),'content-packages/homepage/local-records.json'),'utf8'))).records;}catch{/* No transcription: behave exactly as before. */}
  return (ref:HomeReference):Promise<HomePreview|null>=>resolveHomepageReference(ref).catch((cause:unknown)=>{
    const record=records[ref.key],media=homepageMedia(ref.key);
    if(!record||!media||record.kind!==ref.kind)throw cause;
    const base={key:ref.key,href:ref.href,media,date:record.publishedAt,sources:record.sources,title:record.title,summary:record.summary,whyItMatters:homepageExcerpt(ref.key,'whyItMatters',record.updatedAt)};
    if(record.kind==='news')return {...base,kind:'news' as const,category:record.category??'Israel update'};
    return {...base,kind:'watch' as const,claim:record.claim??record.title,verification:record.verification??'unresolved',basis:record.basis??'sourced',finding:homepageExcerpt(ref.key,'finding',record.updatedAt)};
  });
}

export async function getHomepageEdition():Promise<HomepageEdition>{
  let snapshot:HomeSnapshot|null=null,localPreview=false;
  // Explicit development-only fixture: frozen references, not a live-selection fallback.
  if(await isLocalHomepagePreview()){
    try{snapshot=homeSnapshotSchema.parse(JSON.parse(await readFile(join(process.cwd(),'content-packages/homepage/local-edition.json'),'utf8')));localPreview=true;}catch{/* No local fixture: use the durable public store. */}
  }
  if(!snapshot)try{snapshot=await readHomepageSnapshot();}catch{console.error('[homepage] persisted edition unavailable');}
  const empty={state:'unavailable' as const,items:[],gaps:[]};
  if(!snapshot)return {editionDate:'',revision:0,generatedAt:'',state:'unavailable',localPreview:false,news:empty,fakeResistance:empty,october7:empty,people:empty,heroes:empty,israelsStory:empty};
  const resolve=localPreview?await localPreviewResolver():resolveHomepageReference;
  const [news,fakeResistance,october7,heroes,israelsStory,people]=await Promise.all([
    resolveHomepageSection<Extract<HomePreview,{kind:'news'}>>(snapshot.selection.news,resolve),
    resolveHomepageSection<Extract<HomePreview,{kind:'watch'|'case'}>>(snapshot.selection.fakeResistance,resolve),
    resolveHomepageSection<Extract<HomePreview,{kind:'testimony'|'documentation'}>>(snapshot.selection.october7,resolve),
    resolveHomepageSection<Extract<HomePreview,{kind:'hero'}>>(snapshot.selection.heroes,resolve),
    resolveHomepageSection<Extract<HomePreview,{kind:'chapter'}>>(snapshot.selection.israelsStory,resolve),
    resolveHomepageSection<Extract<HomePreview,{kind:'feature'}>>(snapshot.selection.people,resolve),
  ]);
  return {...snapshot,localPreview,state:snapshot.editionDate===israelEditionDate()?'current':'previous-edition',news,fakeResistance,october7,heroes,israelsStory,people};
}
