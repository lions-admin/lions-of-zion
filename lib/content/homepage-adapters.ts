import 'server-only';
import { getPublicPublication } from '@/lib/publications';
import type { HomePreview, HomeReference, HomeSource } from '@/server/contracts/homepage';
import { homepageContentRevision } from './homepage-revision';
import { getCase } from './fake-resistance-cases';
import { getOurHeroesEdition } from './our-heroes';
import { getIsraelsStoryEdition } from './israels-story';
import { getTestimony } from './testimonies';
import { getDocumentationRecord } from './documentation';
import { pickVersion } from './archive';
import { displayWitness } from './archive-display';
import { homepageMedia, homepageExcerpt } from './homepage-media';
import { isHomepageSafeMedia } from '@/server/contracts/editorial-media';
import { SECTION_LABELS } from '@/components/live/publication-labels';

const sources=(rows:{label:string;url?:string}[]):HomeSource[]=>rows.filter((s):s is {label:string;url:string}=>!!s.url).map(({label,url})=>({label,url}));
export async function resolveHomepageReference(ref:HomeReference):Promise<HomePreview|null>{
  const canonicalProfile=ref.kind==='hero' ? await getOurHeroesEdition().then(e=>[e.featured,...e.profiles].find(p=>p.id===ref.id)) : undefined;
  const canonicalChapter=ref.kind==='chapter' ? await getIsraelsStoryEdition().then(e=>e.chapters.find(p=>p.id===ref.id)) : undefined;
  if(ref.kind==='news'||ref.kind==='watch'){
    const p=await getPublicPublication(ref.id);
    if(ref.kind==='news' && p.section!=='israel_update' && p.section!=='daily_brief')return null;
    if((ref.kind==='watch')!==(p.section==='narrative_watch'))return null;
    /* A live record carries its own picture, so a publication published today
       reaches the homepage without a hand-written registry mapping. The static
       registry stays as the fallback: the publications mapped there predate
       the field and would otherwise lose the artwork they already have. */
    const media=p.media&&isHomepageSafeMedia(p.media)?p.media:homepageMedia(ref.key);
    if(!media)return null;
    const publicationBase={key:ref.key,href:ref.href,media,title:p.title,summary:p.summary??'',date:p.publishedAt,
      sources:p.sources.flatMap(s=>s.url?[{label:s.publisher?`${s.publisher} — ${s.title}`:s.title,url:s.url}]:[]),
      whyItMatters:homepageExcerpt(ref.key,'whyItMatters',p.updatedAt)};
    if(ref.kind==='news')return {...publicationBase,kind:'news',category:SECTION_LABELS[p.section]};
    if(!p.narrativeWatchDetails)return null;
    return {...publicationBase,kind:'watch',claim:p.narrativeWatchDetails.exactClaim,
      verification:p.narrativeWatchDetails.verificationState,basis:p.narrativeWatchDetails.evidenceBasis==='analysis'?'analysis':'sourced',
      finding:homepageExcerpt(ref.key,'finding',p.updatedAt)};
  }
  /* Every other kind is static content, resolved through the registry exactly
     as before: there is no record behind it to carry an image of its own. */
  const media=homepageMedia(ref.key,canonicalProfile?.mediaRef??canonicalChapter?.mediaRef);if(!media)return null;
  const base={key:ref.key,href:ref.href,media,date:ref.date,sources:[] as HomeSource[],whyItMatters:homepageExcerpt(ref.key,'whyItMatters',ref.version)};
  if(ref.kind==='case'){
    const c=await getCase(ref.id);if(!c)return null;
    return {...base,kind:'case',title:c.title,summary:c.publicInterestBasis,question:c.question,
      finding:c.bottomLine[0]?.text,confidence:c.confidence,sourceCount:c.sources.length,
      sources:sources(c.sources),date:c.updatedAt};
  }
  if(ref.kind==='hero'){
    const p=canonicalProfile;if(!p)return null;
    const canonicalMedia=homepageMedia(ref.key,p.mediaRef);if(!canonicalMedia)return null;
    return {...base,media:canonicalMedia,kind:'hero',title:p.name,summary:p.summary,role:p.role,meta:p.meta,sources:sources(p.sources)};
  }
  if(ref.kind==='chapter'){
    const p=canonicalChapter;if(!p)return null;
    const canonicalMedia=homepageMedia(ref.key,p.mediaRef);if(!canonicalMedia)return null;
    return {...base,media:canonicalMedia,whyItMatters:homepageExcerpt(ref.key,'whyItMatters',homepageContentRevision(p)),kind:'chapter',title:p.title,summary:p.intro,era:p.timeline[0]?.dateLabel??'',contested:!!p.contested,sources:sources(p.sources)};
  }
  const record=ref.kind==='testimony'?await getTestimony(ref.id):await getDocumentationRecord(ref.id);
  if(!record)return null;
  const version=pickVersion(record,'en');
  return {...base,kind:ref.kind,title:version.title,summary:homepageExcerpt(ref.key,'summary',homepageContentRevision(record))??version.excerpt??'',
    witness:record.witness_name?displayWitness(record.witness_name):undefined,
    warning:ref.kind==='documentation'?'Sensitive documentation. Media stays hidden until you choose to view it on the record.':'First-person testimony. Descriptions of violence may be distressing.',
    sources:version.source_url?[{label:record.source_site??'Original archive record',url:version.source_url}]:[]};
}
