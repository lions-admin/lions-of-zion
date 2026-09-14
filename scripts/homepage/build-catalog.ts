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
/** A candidate with no homepage-cleared image is admitted text-led rather
 * than dropped (owner ruling 2026-09-07, extended from live publications to
 * the static catalogue on 2026-09-14) — the alternative was a pool too small
 * to rotate at all: 2 october7 candidates, 3 heroes, 7 chapters against a
 * 6-slot rotation module (`server/modules/featured-slots`) that needs a real
 * pool to choose from. */
function add(ref:Omit<HomeReference,'mediaId'>,canonicalId?:string){
 const conflict=homepageMediaConflict(ref.key,canonicalId);if(conflict)console.warn('Media conflict',conflict);
 const media=homepageMedia(ref.key,canonicalId);
 candidates.push({...ref,mediaId:media?.id??null});
}
async function main(){
 for(const c of await getCaseIndex())add({key:`case:${c.caseId}`,id:c.slug,kind:'case',section:'fakeResistance',href:`/fake-resistance/cases/${c.slug}`,version:homepageContentRevision(await getCase(c.slug)),date:c.updatedAt});
 for(const e of await getTestimonyIndex())add({key:`archive:october7:${e.id}`,id:e.id,kind:'testimony',section:'october7',href:`/october-7/testimonies/${e.id}`,version:homepageContentRevision(await getTestimony(e.id)),date:e.date??''});
 for(const e of await getDocumentationIndex())add({key:`archive:hamas-massacre:${e.id}`,id:e.id,kind:'documentation',section:'october7',href:`/october-7/documentation/${categorySlug(e.category)}/${e.id}`,version:homepageContentRevision(await getDocumentationRecord(e.id)),date:e.date??''});
 const heroes=await getOurHeroesEdition();for(const h of [heroes.featured,...heroes.profiles])add({key:`hero:${h.id}`,id:h.id,kind:'hero',section:'heroes',href:`/our-heroes#${h.id}`,version:homepageContentRevision(h),date:heroes.publishedAt},h.mediaRef);
 const story=await getIsraelsStoryEdition();for(const c of story.chapters)add({key:`chapter:${c.id}`,id:c.id,kind:'chapter',section:'israelsStory',href:`/israels-story#${c.id}`,version:homepageContentRevision(c),date:story.publishedAt},c.mediaRef);
 candidates.sort((a,b)=>a.key.localeCompare(b.key));
 const revision=createHash('sha256').update(JSON.stringify(candidates)).digest('hex');
 await writeFile('content-packages/homepage/catalog.json',JSON.stringify(homeCatalogSchema.parse({revision,sourceRevision:await catalogSourceRevision(),candidates}),null,2)+'\n');
 const withMedia=candidates.filter(c=>c.mediaId!==null).length;
 console.log(`Catalogue: ${candidates.length} static references (${withMedia} with a cleared image)`);
}main();
