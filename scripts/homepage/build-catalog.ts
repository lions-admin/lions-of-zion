import { catalogSourceRevision } from '../../server/modules/homepage/catalog';
import { createHash } from 'node:crypto';
import { writeFile } from 'node:fs/promises';
import { homepageContentRevision } from '../../lib/content/homepage-revision';
import { getCaseIndex, getCase } from '../../lib/content/fake-resistance-cases';
import { getTestimonyIndex,getTestimony } from '../../lib/content/testimonies';
import { getDocumentationIndex,getDocumentationRecord,categorySlug } from '../../lib/content/documentation';
import { getOurHeroesEdition } from '../../lib/content/our-heroes';
import { getIsraelsStoryEdition } from '../../lib/content/israels-story';
import { homepageMedia,homepageMediaConflict } from '../../lib/content/homepage-media';
import { homeCatalogSchema, type HomeReference } from '../../server/contracts/homepage';
const candidates:HomeReference[]=[];
function add(ref:Omit<HomeReference,'mediaId'>,canonicalId?:string){
 const conflict=homepageMediaConflict(ref.key,canonicalId);if(conflict)console.warn('Media conflict',conflict);
 const media=homepageMedia(ref.key,canonicalId);if(media)candidates.push({...ref,mediaId:media.id});
}
async function main(){
 for(const c of await getCaseIndex())add({key:`case:${c.caseId}`,id:c.slug,kind:'case',section:'fakeResistance',href:`/fake-resistance/cases/${c.slug}`,version:homepageContentRevision(await getCase(c.slug)),date:c.updatedAt});
 for(const e of await getTestimonyIndex())if(homepageMedia(`archive:october7:${e.id}`))add({key:`archive:october7:${e.id}`,id:e.id,kind:'testimony',section:'october7',href:`/october-7/testimonies/${e.id}`,version:homepageContentRevision(await getTestimony(e.id)),date:e.date??''});
 for(const e of await getDocumentationIndex())if(homepageMedia(`archive:hamas-massacre:${e.id}`))add({key:`archive:hamas-massacre:${e.id}`,id:e.id,kind:'documentation',section:'october7',href:`/october-7/documentation/${categorySlug(e.category)}/${e.id}`,version:homepageContentRevision(await getDocumentationRecord(e.id)),date:e.date??''});
 const heroes=await getOurHeroesEdition();for(const h of [heroes.featured,...heroes.profiles])add({key:`hero:${h.id}`,id:h.id,kind:'hero',section:'heroes',href:`/our-heroes#${h.id}`,version:homepageContentRevision(h),date:heroes.publishedAt},h.mediaRef);
 const story=await getIsraelsStoryEdition();for(const c of story.chapters)add({key:`chapter:${c.id}`,id:c.id,kind:'chapter',section:'israelsStory',href:`/israels-story#${c.id}`,version:homepageContentRevision(c),date:story.publishedAt},c.mediaRef);
 candidates.sort((a,b)=>a.key.localeCompare(b.key));
 const revision=createHash('sha256').update(JSON.stringify(candidates)).digest('hex');
 await writeFile('content-packages/homepage/catalog.json',JSON.stringify(homeCatalogSchema.parse({revision,sourceRevision:await catalogSourceRevision(),candidates}),null,2)+'\n');
 console.log(`Catalogue: ${candidates.length} cleared static references`);
}main();
