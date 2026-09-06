import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Database } from '@/server/db/client';
import { publicationService } from '@/server/modules/publications';
import { homeSections, homeCatalogSchema, homeOverridesSchema, homeSnapshotSchema, israelEditionDate, type HomeReference } from '@/server/contracts/homepage';
import { editorialMediaSchema, isHomepageSafeMedia } from '@/server/contracts/editorial-media';
import { publicationHomepageKind, publicationHomepageSection, publicationHref } from '@/lib/publication-routing';
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
  /* One automatic-publication query covers every routed destination. New
   * People and antisemitism records therefore enter their own homepage band
   * without a second, stale list that knows only the original three sections. */
  const [automatic,pins]=await Promise.all([
    service.listBriefingPublic({limit:100}), service.publicHomepagePins(),
  ]);
  const live=new Map([...automatic,...pins.map(p=>p.publication)].map(p=>[p.publicId,p]));
  const candidates:HomeReference[]=catalog.candidates.filter(c=>safeIds.has(c.mediaId));
  // A live publication's own hero decides whether it may reach the homepage.
  // It used to be `media.json`'s mapping, which meant a newly published record
  // could not appear without a hand-written commit — the registry is still the
  // fallback so publications that predate `editorial_media` keep their picture.
  const liveCandidates:HomeReference[]=[];
  for(const p of live.values()){
    const key=`publication:${p.publicId}`,legacyId=rawMedia.mappings[key] as string|undefined;
    const mediaId=p.media&&isHomepageSafeMedia(p.media)?p.media.id:legacyId&&safeIds.has(legacyId)?legacyId:null;
    if(!mediaId)continue;
    liveCandidates.push({key,id:p.publicId,kind:publicationHomepageKind(p.section),
      section:publicationHomepageSection(p.section),href:publicationHref(p.publicId),
      version:p.updatedAt,date:p.publishedAt,mediaId});
  }
  candidates.push(...liveCandidates);
  const date=israelEditionDate(now);
  const pinKeys=pins.map(p=>`publication:${p.publication.publicId}`);
  const overrideRevision=JSON.stringify(Object.fromEntries(homeSections.map(section=>[section,
    createHash('sha256').update(JSON.stringify({
      pins:pins.filter(p=>publicationHomepageSection(p.publication.section)===section).map(p=>p.publication.publicId),
      evergreen:overrides.pins.filter(p=>p.section===section&&(!p.expires||p.expires>=date)),
      breaking:section==='news'&&overrides.breakingNews&&overrides.breakingNews.expires>=date?overrides.breakingNews:null,
      // The live candidate set is folded into its own section's hash so an
      // article published after the morning edition moves that hash, and
      // `ensureEdition` re-selects that section instead of waiting for
      // tomorrow. Only the live half: the static catalogue changes by commit,
      // and folding it in would rebuild every band on every catalogue touch.
      // Sorted so query order cannot invent a revision on its own.
      live:liveCandidates.filter(c=>c.section===section).map(c=>`${c.key}|${c.version}|${c.date}|${c.mediaId}`).sort(),
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
