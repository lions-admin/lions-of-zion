import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readHomepageSnapshot, isLocalHomepagePreview } from './publications';
import { homeSnapshotSchema, israelEditionDate, type HomePreview, type HomeReference, type HomepageEdition, type HomepageSection, type HomeSnapshot } from '@/server/contracts/homepage';
import { resolveHomepageReference } from './content/homepage-adapters';

export async function resolveHomepageSection<T extends HomePreview>(refs:HomeReference[],resolve=resolveHomepageReference):Promise<HomepageSection<T>> {
  const settled=await Promise.allSettled(refs.map(resolve));
  const items:T[]=[],gaps:string[]=[];
  settled.forEach((result,i)=>{
    if(result.status==='fulfilled'&&result.value)items.push(result.value as T);
    else gaps.push(refs[i].key);
  });
  return {items,gaps,state:items.length===2?'ready':items.length?'partial':refs.length?'unavailable':'empty'};
}
export async function getHomepageEdition():Promise<HomepageEdition>{
  let snapshot:HomeSnapshot|null=null,localPreview=false;
  // Explicit development-only fixture: frozen references, not a live-selection fallback.
  if(await isLocalHomepagePreview()){
    try{snapshot=homeSnapshotSchema.parse(JSON.parse(await readFile(join(process.cwd(),'content-packages/homepage/local-edition.json'),'utf8')));localPreview=true;}catch{/* No local fixture: use the durable public store. */}
  }
  if(!snapshot)try{snapshot=await readHomepageSnapshot();}catch{console.error('[homepage] persisted edition unavailable');}
  const empty={state:'unavailable' as const,items:[],gaps:[]};
  if(!snapshot)return {editionDate:'',revision:0,generatedAt:'',state:'unavailable',localPreview:false,news:empty,fakeResistance:empty,october7:empty,heroes:empty,israelsStory:empty};
  const [news,fakeResistance,october7,heroes,israelsStory]=await Promise.all([
    resolveHomepageSection<Extract<HomePreview,{kind:'news'}>>(snapshot.selection.news),
    resolveHomepageSection<Extract<HomePreview,{kind:'watch'|'case'}>>(snapshot.selection.fakeResistance),
    resolveHomepageSection<Extract<HomePreview,{kind:'testimony'|'documentation'}>>(snapshot.selection.october7),
    resolveHomepageSection<Extract<HomePreview,{kind:'hero'}>>(snapshot.selection.heroes),
    resolveHomepageSection<Extract<HomePreview,{kind:'chapter'}>>(snapshot.selection.israelsStory),
  ]);
  return {...snapshot,localPreview,state:snapshot.editionDate===israelEditionDate()?'current':'previous-edition',news,fakeResistance,october7,heroes,israelsStory};
}
