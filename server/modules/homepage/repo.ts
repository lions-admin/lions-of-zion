import 'server-only';
import { desc, eq, lte, sql } from 'drizzle-orm';
import type { Database } from '@/server/db/client';
import { homepageEdition } from '@/server/db/schema';
import { homeSnapshotSchema, type HomeSnapshot } from '@/server/contracts/homepage';

export function homepageRepo(db: Database) {
  return {
    async latest(date:string) {
      const [row]=await db.select().from(homepageEdition).where(lte(homepageEdition.editionDate,date))
        .orderBy(desc(homepageEdition.editionDate),desc(homepageEdition.revision)).limit(1);
      return row?{...homeSnapshotSchema.parse({...row,generatedAt:row.generatedAt.toISOString()}),overrideRevision:row.overrideRevision}:null;
    },
    async history(date='9999-12-31'){
      const rows=await db.select().from(homepageEdition).where(lte(homepageEdition.editionDate,date)).orderBy(desc(homepageEdition.editionDate)).limit(500);
      const result:Record<string,string>={};
      for(const row of rows)for(const pair of Object.values(row.selection))for(const item of pair)
        if(!result[item.key]||result[item.key]<row.editionDate)result[item.key]=row.editionDate;
      return result;
    },
    async append(snapshot:HomeSnapshot, overrideRevision:string){
      return db.insert(homepageEdition).values({...snapshot,generatedAt:new Date(snapshot.generatedAt),overrideRevision}).returning();
    },
    async lock(date:string){await db.execute(sql`select pg_advisory_xact_lock(hashtext(${'homepage:'+date}))`);},
    async count(date:string){return db.select().from(homepageEdition).where(eq(homepageEdition.editionDate,date));},
  };
}
