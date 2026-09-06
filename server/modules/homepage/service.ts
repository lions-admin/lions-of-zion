import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Database } from '@/server/db/client';
import { publicationService } from '@/server/modules/publications';
import { homeSections, homeCatalogSchema, homeOverridesSchema, homeSnapshotSchema, israelEditionDate, type HomeReference } from '@/server/contracts/homepage';
import { editorialMediaSchema, isHomepageSafeMedia } from '@/server/contracts/editorial-media';
import { homepageRepo } from './repo';
import { catalogSourceRevision } from './catalog';
import { selectHomepage } from './selection';

const readJson=async(name:string)=>JSON.parse(await readFile(join(process.cwd(),'content-packages/homepage',name),'utf8'));
export async function homepageInputs(db:Database, now=new Date()) {
  const [rawCatalog,rawOverrides,rawMedia]=await Promise.all(['catalog.json','overrides.json','media.json'].map(readJson));
  const catalog=homeCatalogSchema.parse(rawCatalog), overrides=homeOverridesSchema.parse(rawOverrides);
  if(catalog.sourceRevision !== await catalogSourceRevision())throw new Error('Homepage catalogue is stale; run homepage:catalog');
  const safeIds=new Set((rawMedia.assets as unknown[]).map(a=>editorialMediaSchema.parse(a)).filter(isHomepageSafeMedia).map(a=>a.id));
  const service=publicationService(db);
  // A failed section is not a zero-record section: fail the job, preserve the prior snapshot.
  const [news,briefs,watch,pins]=await Promise.all([
    service.listBriefingPublic({section:'israel_update',limit:50}),
    service.listBriefingPublic({section:'daily_brief',limit:50}),
    service.listBriefingPublic({section:'narrative_watch',limit:25}),service.publicHomepagePins(),
  ]);
  const live=new Map([...news,...briefs,...watch,...pins.map(p=>p.publication)].map(p=>[p.publicId,p]));
  const candidates:HomeReference[]=catalog.candidates.filter(c=>safeIds.has(c.mediaId));
  /* A publication with no hand-mapped picture takes the drawn cover for its
     kind rather than being dropped from the edition. Requiring a mapping was
     why the live sections stayed empty: nobody hand-maps an image onto each
     morning's briefing, so no briefing was ever eligible. See
     `content-packages/homepage/cover-artwork.json`. */
  const defaults=(rawMedia.defaults??{}) as Record<string,string>;
  for(const p of live.values()){
    const kind=p.section==='narrative_watch'?'watch':'news';
    const key=`publication:${p.publicId}`,mapped=rawMedia.mappings[key] as string|undefined;
    const mediaId=mapped&&safeIds.has(mapped)?mapped:defaults[kind];
    if(!mediaId||!safeIds.has(mediaId))continue;
    candidates.push({key,id:p.publicId,kind,
      section:p.section==='narrative_watch'?'fakeResistance':'news',href:`/articles/${p.publicId}`,
      version:p.updatedAt,date:p.publishedAt,mediaId});
  }
  const date=israelEditionDate(now);
  const pinKeys=pins.map(p=>`publication:${p.publication.publicId}`);
  const overrideRevision=JSON.stringify(Object.fromEntries(homeSections.map(section=>[section,
    createHash('sha256').update(JSON.stringify({
      pins:pins.filter(p=>(p.publication.section==='narrative_watch'?'fakeResistance':'news')===section).map(p=>p.publication.publicId),
      evergreen:overrides.pins.filter(p=>p.section===section&&(!p.expires||p.expires>=date)),
      breaking:section==='news'&&overrides.breakingNews&&overrides.breakingNews.expires>=date?overrides.breakingNews:null,
    })).digest('hex')])));
  return {catalog,candidates,overrides,pinKeys,overrideRevision,date};
}
export function homepageService(db:Database, loadInputs=homepageInputs){return {
  read: (date=israelEditionDate())=>homepageRepo(db).latest(date),
  async ensureEdition(now=new Date()){
    const input=await loadInputs(db,now);
    return db.transaction(async tx=>{
      const r=homepageRepo(tx as unknown as Database);
      await r.lock(input.date);
      const existing=await r.latest(input.date);
      if(existing?.editionDate===input.date&&existing.overrideRevision===input.overrideRevision)return existing;
      const history=await r.history(input.date);
      const selection=selectHomepage(input.candidates,input.date,history,input.overrides,input.pinKeys);
      if(existing?.editionDate===input.date){
        const before=JSON.parse(existing.overrideRevision) as Record<string,string>;
        const after=JSON.parse(input.overrideRevision) as Record<string,string>;
        for(const section of homeSections)if(before[section]===after[section])selection[section]=existing.selection[section];
      }
      const snapshot=homeSnapshotSchema.parse({editionDate:input.date,revision:existing?.editionDate===input.date?existing.revision+1:1,
        generatedAt:now.toISOString(),catalogRevision:input.catalog.revision,
        reason:[existing?.editionDate===input.date?'Editorial override revision':'Daily edition',
          ...input.overrides.pins.filter(p=>!p.expires||p.expires>=input.date).map(p=>`${p.section}: ${p.reason}`),
          ...(input.overrides.breakingNews && input.overrides.breakingNews.expires>=input.date ? [`Breaking news: ${input.overrides.breakingNews.reason}`] : []),
          ...(input.pinKeys.length ? [`Publication editorial slots: ${input.pinKeys.join(', ')}`] : []),
        ].join(' · '),selection});
      await r.append(snapshot,input.overrideRevision);return snapshot;
    });
  },
};}
