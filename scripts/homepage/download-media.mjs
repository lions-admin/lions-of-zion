// Explicit Commons file URLs only. Curation/rights are recorded separately.
import fs from 'node:fs/promises';
import sharp from 'sharp';
const entries = [
 ['matcal','Matcal_Tower,_Tel_Aviv-Yafo,_2009-1.jpg'],
 ['rami-davidian','Rami_Davidian.jpg'], ['noam-tibon','Noam_Tibon.jpg'],
 ['declaration','Declaration_of_State_of_Israel_1948.jpg'],
 ['camp-david','Camp_David,_Menachem_Begin,_Anwar_Sadat,_1978.jpg'],
 ['blue-line','UNIFIL_Blue_Barrels.jpg'],
];
await fs.mkdir('public/images/homepage',{recursive:true});
for(const [id,file] of entries){
 const url='https://commons.wikimedia.org/wiki/File:'+file;
 if(await fs.stat('public/images/homepage/'+id+'.webp').catch(()=>null))continue;
 const html=await (await fetch(url)).text();
 const original=html.match(/class="fullImageLink"[^>]*>[\s\S]*?<a href="([^"]+)"/)?.[1];
 if(!original)throw new Error('Missing original '+file);
 await fs.writeFile('/tmp/home-media-'+id+'.html',html);
 const data=Buffer.from(await (await fetch(original.split('?')[0])).arrayBuffer());
 await sharp(data).resize({width:1440,withoutEnlargement:true}).webp({quality:86}).toFile('public/images/homepage/'+id+'.webp');
 console.log(id,original,await sharp(data).metadata().then(({width,height})=>({width,height})));
}
