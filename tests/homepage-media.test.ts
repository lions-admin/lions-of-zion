import {describe,it,expect} from 'vitest';
import {readFileSync,existsSync} from 'node:fs';
import {editorialMediaSchema,isHomepageSafeMedia} from '@/server/contracts/editorial-media';
import {editorialMediaForSurface,homepageMedia,homepageExcerpt} from '@/lib/content/homepage-media';
import registry from '@/content-packages/homepage/media.json';
describe('homepage media and editorial integrity',()=>{
 it('clears only fully attributed, safe media with dimensions',()=>{for(const raw of registry.assets){const a=editorialMediaSchema.parse(raw);expect(isHomepageSafeMedia(a)).toBe(true);expect(existsSync(`public${a.src}`)).toBe(true);expect(a.credit).not.toBe('');}});
 it('fails closed for missing permission or sensitivity',()=>{const a=editorialMediaSchema.parse(registry.assets[0]);expect(isHomepageSafeMedia({...a,sensitivity:'unknown'})).toBe(false);expect(isHomepageSafeMedia({...a,rights:{...a.rights,status:'withdrawn'}})).toBe(false);expect(homepageMedia('missing')).toBeNull();});
 it('does not load original sensitive documentation as a homepage image',()=>{for(const [key,id] of Object.entries(registry.mappings)){if(key.startsWith('archive:')){const m=registry.assets.find(a=>a.id===id)!;expect(m.role).toBe('safe-cover');expect(readFileSync(`public${m.src}`,'utf8')).not.toContain('<image');}}});
 it('uses contextual artwork for the five reviewed homepage records',()=>{
  expect(homepageMedia('case:case_02_manosphere_far_right')?.id).toBe('manosphere-cluster-editorial');
  expect(homepageMedia('archive:hamas-massacre:85-year-old-yaffa-adar-being-abducted-into-gaza-in-a-golf-cart')?.id).toBe('yaffa-adar-safe-cover');
  expect(homepageMedia('publication:israel-ministry-of-defense-activities-regional-r-lref0')?.id).toBe('regional-defense-brief');
  expect(homepageMedia('publication:us-accepts-military-sale-of-helicopters-to-iraq--p5zzh')?.id).toBe('iraq-helicopter-sale-review');
  expect(homepageMedia('archive:october7:we-were-barricaded-for-hours-my-father-62-years-old-fought-terrorists-to-rescue')?.id).toBe('barricaded-safe-room');
 });
 it('exposes publication artwork to article pages only when that surface is cleared',()=>{
  expect(editorialMediaForSurface('publication:israel-ministry-of-defense-activities-regional-r-lref0','article')?.id).toBe('regional-defense-brief');
  expect(editorialMediaForSurface('publication:us-accepts-military-sale-of-helicopters-to-iraq--p5zzh','article')?.id).toBe('iraq-helicopter-sale-review');
  expect(editorialMediaForSurface('case:case_02_manosphere_far_right','article')).toBeNull();
 });
 it('does not carry a finding across a changed source version',()=>{expect(homepageExcerpt('publication:israel-ministry-of-defense-recent-announcements--m781m','whyItMatters','corrected')).toBeUndefined();expect(homepageExcerpt('missing','finding','1')).toBeUndefined();});
});
