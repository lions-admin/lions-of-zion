import 'server-only';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';
/** Hash inputs, never import frontend code into the scheduler. */
export const catalogInputs = [
 'lib/content/our-heroes.ts','lib/content/israels-story.ts',
 'lib/content/fake-resistance-cases.ts','lib/content/fake-resistance-editorial.ts',
 'content-packages/fake-resistance/index.json',
 'content-packages/october7/index.json','content-packages/hamas-massacre/index.json',
 'content-packages/homepage/media.json',
];
export async function catalogSourceRevision(){
 const media=JSON.parse(await readFile(join(process.cwd(),'content-packages/homepage/media.json'),'utf8')) as {mappings:Record<string,string>};
 const index=JSON.parse(await readFile(join(process.cwd(),'content-packages/fake-resistance/index.json'),'utf8')) as {cases:{caseId:string;slug:string}[]};
 const records=Object.keys(media.mappings).flatMap(key=>{
   if(key.startsWith('case:')){const c=index.cases.find(c=>`case:${c.caseId}`===key);return c?[`content-packages/fake-resistance/cases/${c.slug}.json`]:[];}
   const match=key.match(/^archive:(october7|hamas-massacre):([a-z0-9-]+)$/);
   return match?[`content-packages/${match[1]}/records/${match[2]}.json`]:[];
 });
 const contents=await Promise.all([...catalogInputs,...records.sort()].map(p=>readFile(join(process.cwd(),p),'utf8')));
 return createHash('sha256').update(contents.join('\0')).digest('hex');
}
