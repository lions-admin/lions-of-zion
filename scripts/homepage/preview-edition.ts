/** Local frozen references only. No edition/database writes. */
import { writeFile } from 'node:fs/promises';
import { db, withDatabaseRole, closeDb } from '../../server/db/client';
import { homepageInputs } from '../../server/modules/homepage/service';
import { selectHomepage } from '../../server/modules/homepage/selection';
import { homeSnapshotSchema } from '../../server/contracts/homepage';
async function main(){
 const now=new Date(),input=await withDatabaseRole('app_public','homepage:local-curation',()=>homepageInputs(db(),now));
 const selection=selectHomepage(input.candidates,input.date,{},input.overrides,input.pinKeys);
 const snapshot=homeSnapshotSchema.parse({editionDate:input.date,revision:1,generatedAt:now.toISOString(),catalogRevision:input.catalog.revision,reason:'Explicit local review edition; no production activation',selection});
 await writeFile('content-packages/homepage/local-edition.json',JSON.stringify(snapshot,null,2)+'\n');
 console.log('Local edition',Object.fromEntries(Object.entries(selection).map(([k,v])=>[k,v.length])));await closeDb();
}main();
