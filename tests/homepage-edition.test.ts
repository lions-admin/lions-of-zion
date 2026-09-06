import {describe,it,expect} from 'vitest';
import {israelEditionDate,homeSelectionSchema,type HomeReference,type HomeOverrides} from '@/server/contracts/homepage';
import {selectHomepage} from '@/server/modules/homepage/selection';
const overrides:HomeOverrides={revision:'1',pins:[],breakingNews:null};
const ref=(id:string,section:HomeReference['section']='news',kind:HomeReference['kind']='news'):HomeReference=>({key:`${kind}:${id}`,id,kind,section,href:`/articles/${id}`,version:'1',date:'2026-09-05',mediaId:'image'});
describe('daily homepage selection',()=>{
 it('uses Israel calendar boundaries, including DST',()=>{
 expect(israelEditionDate(new Date('2026-09-05T20:59:00Z'))).toBe('2026-09-05');
 expect(israelEditionDate(new Date('2026-09-05T21:00:00Z'))).toBe('2026-09-06');
 expect(israelEditionDate(new Date('2026-01-05T21:30:00Z'))).toBe('2026-01-05');
 });
 it('is deterministic, capped, unique and section-separated',()=>{
 const c=[ref('b'),ref('a'),ref('c'),ref('x','fakeResistance','watch'),ref('x','fakeResistance','watch')];
 const a=selectHomepage(c,'2026-09-05',{},overrides);
 expect(a).toEqual(selectHomepage([...c].reverse(),'2026-09-05',{},overrides));
 expect(a.news.map(r=>r.id)).toEqual(['a','b']);expect(a.fakeResistance).toHaveLength(1);
 expect(homeSelectionSchema.safeParse({...a,fakeResistance:a.news}).success).toBe(false);
 });
 it('pins override cooldown but cannot introduce unknown records',()=>{
 const c=[ref('a','heroes','hero'),ref('b','heroes','hero'),ref('c','heroes','hero')];
 const h={'hero:a':'2026-09-04','hero:b':'2026-09-03'};
 expect(selectHomepage(c,'2026-09-05',h,overrides).heroes.map(r=>r.id)).toEqual(['c','b']);
 expect(selectHomepage(c,'2026-09-05',h,{...overrides,pins:[{key:'hero:a',section:'heroes',order:0,reason:'Editor selection'},{key:'hero:missing',section:'heroes',order:1,reason:'Invalid'}]}).heroes[0].id).toBe('a');
 });
 it('prefers testimony before documentation and keeps one of each',()=>{
 const c=[ref('d','october7','documentation'),ref('t','october7','testimony'),ref('t2','october7','testimony')];
 expect(selectHomepage(c,'2026-09-05',{},overrides).october7.map(r=>r.kind)).toEqual(['testimony','documentation']);
 });
 it('does not fabricate a second item and ignores expired overrides',()=>{
 expect(selectHomepage([ref('only')],'2026-09-05',{},overrides).news).toHaveLength(1);
 expect(selectHomepage([],'2026-09-05',{},overrides).news).toEqual([]);
 });
 it('prefers an explicit breaking pair only while active',()=>{
 const c=[ref('a'),ref('b'),ref('z')];
 expect(selectHomepage(c,'2026-09-05',{}, {...overrides,breakingNews:{keys:['news:z'],reason:'Breaking',revision:'1',expires:'2026-09-05'}}).news[0].id).toBe('z');
 expect(selectHomepage(c,'2026-09-06',{}, {...overrides,breakingNews:{keys:['news:z'],reason:'Breaking',revision:'1',expires:'2026-09-05'}}).news[0].id).toBe('a');
 });
});
