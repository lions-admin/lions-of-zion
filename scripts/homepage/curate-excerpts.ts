import {homepageContentRevision} from '../../lib/content/homepage-revision';
import {writeFile} from 'node:fs/promises';
import { getOurHeroesEdition } from '../../lib/content/our-heroes';
import {getIsraelsStoryEdition} from '../../lib/content/israels-story';
import {getTestimony} from '../../lib/content/testimonies';
import {publications} from '../../server/modules/publications';
import {withDatabaseRole,closeDb} from '../../server/db/client';
async function main(){
const notes=[];
for(const id of ['israel-ministry-of-defense-recent-announcements--m781m','israel-ministry-of-defense-activities-regional-r-lref0']){
 const p=await withDatabaseRole('app_public','homepage:curation',()=>publications().getBriefingPublicDetail(id));
 const text=id.endsWith('m781m')?p.body.split('\n\n')[1]:p.body.split('## Watch points\n\n')[1]?.split('\n\n')[0];
 if(text)notes.push({key:`publication:${id}`,role:'whyItMatters',text,sourceField:'body',sourceReference:`/articles/${id}`,version:p.updatedAt});
}
const story=await getIsraelsStoryEdition();for(const id of ['the-founding','peace-when-it-came']){const c=story.chapters.find(c=>c.id===id)!;
const t=id==='the-founding'?c.timeline.find(t=>t.id==='independence')!:c.timeline[0];
notes.push({key:`chapter:${id}`,role:'whyItMatters',text:t.body,sourceField:`timeline.${t.id}.body`,sourceReference:t.sources?.[0]?.url??`/israels-story#${id}`,version:homepageContentRevision(c)});}
const id='we-were-barricaded-for-hours-my-father-62-years-old-fought-terrorists-to-rescue',record=(await getTestimony(id))!;
notes.push({key:`archive:october7:${id}`,role:'summary',text:'Initially, there was just a warning siren. It was just past six in the morning, and my wife Miri woke up to a familiar noise: the whistle of an incoming missile.',sourceField:'versions.en.content_blocks[1].text (opening sentences)',sourceReference:record.versions.en.source_url!,version:homepageContentRevision(record)});
await writeFile('content-packages/homepage/excerpts.json',JSON.stringify(notes,null,2)+'\n');await getOurHeroesEdition();await closeDb();}main();
