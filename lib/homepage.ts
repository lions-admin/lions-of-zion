import 'server-only';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import { readHomepageSnapshot, isLocalHomepagePreview } from './publications';
import { homeSections, homeSnapshotSchema, israelEditionDate, type HomePreview, type HomeReference, type HomepageEdition, type HomepageSection, type HomeSectionName, type HomeSnapshot } from '@/server/contracts/homepage';
import { resolveHomepageReference } from './content/homepage-adapters';
import { standbyReferences } from './content/homepage-standby';

export async function resolveHomepageSection<T extends HomePreview>(refs:HomeReference[],resolve=resolveHomepageReference):Promise<HomepageSection<T>> {
  const settled=await Promise.allSettled(refs.map(resolve));
  const items:T[]=[],gaps:string[]=[];
  settled.forEach((result,i)=>{
    if(result.status==='fulfilled'&&result.value)items.push(result.value as T);
    else gaps.push(refs[i].key);
  });
  return {items,gaps,state:items.length===2?'ready':items.length?'partial':refs.length?'unavailable':'empty'};
}

type ResolvedSections = {[K in HomeSectionName]:HomepageSection<HomePreview>};
const emptySection=():HomepageSection<HomePreview>=>({state:'unavailable',items:[],gaps:[]});

/**
 * Fill sections the persisted edition left empty from the committed
 * catalogue. See `lib/content/homepage-standby.ts` for why this is here: with
 * no edition row in Production, every section rendered "temporarily
 * unavailable" and the homepage carried no picture at all, including the four
 * sections whose records are committed to this repository and need no
 * database. A section that standby cannot fill either keeps its own state, so
 * the reader is still told the truth rather than shown a filled page.
 */
async function fillFromStandby(resolved:ResolvedSections, editionDate:string):Promise<HomeSectionName[]> {
  const empty=homeSections.filter(section=>resolved[section].items.length===0);
  if(!empty.length)return [];
  const refs=await standbyReferences(empty,editionDate);
  const used:HomeSectionName[]=[];
  await Promise.all(empty.map(async section=>{
    const candidates=refs[section];
    if(!candidates?.length)return;
    const filled=await resolveHomepageSection(candidates);
    if(!filled.items.length)return;
    resolved[section]=filled;
    used.push(section);
  }));
  return homeSections.filter(section=>used.includes(section));
}

export async function getHomepageEdition():Promise<HomepageEdition>{
  let snapshot:HomeSnapshot|null=null,localPreview=false;
  // Explicit development-only fixture: frozen references, not a live-selection fallback.
  if(await isLocalHomepagePreview()){
    try{snapshot=homeSnapshotSchema.parse(JSON.parse(await readFile(join(process.cwd(),'content-packages/homepage/local-edition.json'),'utf8')));localPreview=true;}catch{/* No local fixture: use the durable public store. */}
  }
  if(!snapshot)try{snapshot=await readHomepageSnapshot();}catch{console.error('[homepage] persisted edition unavailable');}

  const today=israelEditionDate();
  const selection=snapshot?.selection;
  const resolved:ResolvedSections=selection
    ? Object.fromEntries(await Promise.all(homeSections.map(async section=>
        [section,await resolveHomepageSection(selection[section])] as const))) as ResolvedSections
    : Object.fromEntries(homeSections.map(section=>[section,emptySection()])) as ResolvedSections;

  const standby=await fillFromStandby(resolved,snapshot?.editionDate??today);
  const base=snapshot
    ? {editionDate:snapshot.editionDate,revision:snapshot.revision,generatedAt:snapshot.generatedAt,
       state:(snapshot.editionDate===today?'current':'previous-edition') as HomepageEdition['state']}
    : {editionDate:standby.length?today:'',revision:0,generatedAt:'',
       state:(standby.length?'current':'unavailable') as HomepageEdition['state']};

  return {...base,localPreview,standby,
    news:resolved.news as HomepageEdition['news'],
    fakeResistance:resolved.fakeResistance as HomepageEdition['fakeResistance'],
    october7:resolved.october7 as HomepageEdition['october7'],
    heroes:resolved.heroes as HomepageEdition['heroes'],
    israelsStory:resolved.israelsStory as HomepageEdition['israelsStory']};
}
