import {beforeAll,afterAll,describe,it,expect} from 'vitest';
import {freshDatabase,as,type TestDatabase} from '@/server/db/testing';
import {sql} from 'drizzle-orm';
import {homepageRepo} from '@/server/modules/homepage/repo';
import type {Database} from '@/server/db/client';
let db:TestDatabase;
beforeAll(async()=>{db=await freshDatabase()},60000);afterAll(async()=>{await db.$client.close()});
const selection={news:[],fakeResistance:[],october7:[],heroes:[],israelsStory:[],people:[]};
describe('durable homepage edition store',()=>{
 it('is append-only and chooses latest committed revision',async()=>{
 const repo=homepageRepo(db as unknown as Database);
 await repo.append({editionDate:'2026-09-05',revision:1,generatedAt:'2026-09-05T09:00:00Z',catalogRevision:'c1',reason:'Daily edition',selection},'p1');
 await repo.append({editionDate:'2026-09-05',revision:2,generatedAt:'2026-09-05T10:00:00Z',catalogRevision:'c1',reason:'Editor pin',selection},'p2');
 expect((await repo.latest('2026-09-06'))?.revision).toBe(2);
 expect((await repo.latest('2026-09-06'))?.editionDate).toBe('2026-09-05');
 await expect(db.execute(sql`update homepage_edition set reason='changed'`)).rejects.toThrow();
 await expect(db.execute(sql`delete from homepage_edition`)).rejects.toThrow();
 await expect(repo.append({editionDate:'2026-09-05',revision:2,generatedAt:'2026-09-05T10:00:00Z',catalogRevision:'c1',reason:'Duplicate',selection},'p2')).rejects.toThrow();
 });
 it('allows public reads but rejects public writes',async()=>{
 await as(db,'app_public',null,async tx=>{const rows=await tx.execute(sql`select * from homepage_edition`);expect(rows.rows.length).toBe(2);});
 await expect(as(db,'app_public',null,tx=>tx.execute(sql`insert into homepage_edition(edition_date,revision,catalog_revision,override_revision,reason,selection) values ('2026-09-06',1,'c','p','Unauthorized',${JSON.stringify(selection)}::jsonb)`))).rejects.toThrow();
 });
});
