import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
import type { Database } from '@/server/db/client';
import { publicationService } from '@/server/modules/publications';
import { homeSections, homeCatalogSchema, homeOverridesSchema, homeSnapshotSchema, israelEditionDate, type HomeReference } from '@/server/contracts/homepage';
import { editorialMediaSchema, isArticleSafeMedia, isHomepageSafeMedia } from '@/server/contracts/editorial-media';
import { publicationHomepageKind, publicationHomepageSection, publicationHref } from '@/lib/publication-routing';
import { featuredSlotsService, type FeaturedSlotName } from '@/server/modules/featured-slots';
import { homepageRepo } from './repo';
import { catalogSourceRevision } from './catalog';
import { selectHomepage, type ForcedSelections, type HomepagePublicationPlacement } from './selection';

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
  // A static candidate with no picture is not dropped — the same owner
  // ruling (2026-09-07) applied to live publications below now applies here:
  // one carrying a mediaId must still resolve to a homepage-safe asset, but
  // the absence of one is not itself disqualifying. Before this the archive
  // and heroes pools were starved to the handful of records someone had
  // curated a cover for — 2 october7 candidates, 3 heroes, 7 chapters — which
  // is why the homepage never actually rotated them.
  const candidates:HomeReference[]=catalog.candidates.filter(c=>c.mediaId===null||safeIds.has(c.mediaId));
  // A live publication reaches the homepage with or without a picture. Until
  // 2026-09-07 a record was admitted only with a hero cleared for the homepage
  // surface, and a placement naming any other record silently fell through to
  // the automatic pick — the owner's ruling is that the picture is not the
  // gate. Its own article-cleared hero is used when it has one, the registry
  // mapping when it predates `editorial_media`, and nothing otherwise.
  const liveCandidates:HomeReference[]=[];
  for(const p of live.values()){
    const key=`publication:${p.publicId}`,legacyId=rawMedia.mappings[key] as string|undefined;
    const mediaId=p.media&&isArticleSafeMedia(p.media)?p.media.id:legacyId&&safeIds.has(legacyId)?legacyId:null;
    liveCandidates.push({key,id:p.publicId,kind:publicationHomepageKind(p.section),
      section:publicationHomepageSection(p.section),href:publicationHref(p.publicId),
      version:p.updatedAt,date:p.publishedAt,mediaId});
  }
  candidates.push(...liveCandidates);
  const date=israelEditionDate(now);
  const placements: HomepagePublicationPlacement[] = pins.map(pin => ({
    area: pin.area,
    position: pin.position,
    key: `publication:${pin.publication.publicId}`,
  }));
  // October 7, Courage & service, Fallen and History & context have no
  // `homepage_placement` area of their own (docs/editorial-dna.md: "October
  // 7 is not placeable"). `featured-slots` owns their dwell/diversity/pin
  // decisions instead; refreshing it here means every caller of
  // `ensureEdition` — the editorial ingest, the homepage cron route, and (via
  // its own `ensureEdition` call) the maintenance tick — picks up a rotation
  // for free, and never a page GET.
  const { changed: slotChanges, states: slotStates } = await featuredSlotsService(db).refresh(now);
  const slotKey = (slot: FeaturedSlotName) => slotStates.get(slot) ?? undefined;
  const forcedSelections: ForcedSelections = {
    heroes: [slotKey('heroes.courage'), slotKey('heroes.fallen')].filter((k): k is string => Boolean(k)),
    israelsStory: [slotKey('history.primary'), slotKey('history.secondary')].filter((k): k is string => Boolean(k)),
    october7: [slotKey('october7.testimony'), slotKey('october7.documentation')].filter((k): k is string => Boolean(k)),
  };
  const overrideRevision=JSON.stringify(Object.fromEntries(homeSections.map(section=>[section,
    createHash('sha256').update(JSON.stringify({
      placements:placements.filter(placement=>placement.area===section).map(placement=>`${placement.position}:${placement.key}`),
      evergreen:overrides.pins.filter(p=>p.section===section&&(!p.expires||p.expires>=date)),
      breaking:section==='news'&&overrides.breakingNews&&overrides.breakingNews.expires>=date?overrides.breakingNews:null,
      // The live candidate set is folded into its own section's hash so an
      // article published after the morning edition moves that hash, and
      // `ensureEdition` re-selects that section instead of waiting for
      // tomorrow. Only the live half: the static catalogue changes by commit,
      // and folding it in would rebuild every band on every catalogue touch.
      // Sorted so query order cannot invent a revision on its own.
      live:liveCandidates.filter(c=>c.section===section).map(c=>`${c.key}|${c.version}|${c.date}|${c.mediaId}`).sort(),
      // A featured-slot pick for this section — folded in the same way, so a
      // rotation with no placement/live change is still a new revision.
      featured:(forcedSelections as Record<string,string[]|undefined>)[section]??[],
    })).digest('hex')])));
  return {catalog,candidates,overrides,placements,forcedSelections,overrideRevision,date,slotChanges};
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
      const selection=selectHomepage(input.candidates,input.date,history,input.overrides,input.placements,input.forcedSelections);
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
          ...(input.placements.length ? [`Publication editorial placements: ${input.placements.map(placement=>`${placement.area}/${placement.position}:${placement.key}`).join(', ')}`] : []),
          ...(input.slotChanges.length ? [`Featured-slot rotation: ${input.slotChanges.map(c=>`${c.slot} -> ${c.to} (${c.reason})`).join('; ')}`] : []),
        ].join(' · '),selection});
      await r.append(snapshot,input.overrideRevision);return snapshot;
    });
  },
};}
