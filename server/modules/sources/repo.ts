import "server-only";

/**
 * Persistence for source families, sources, and fetch records. Owns SQL;
 * owns no policy.
 *
 * `source_fetch` is insert-only — there is no `update` here for it, because
 * a fetch attempt is written once, after it is known how it ended.
 */

import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import { source, sourceFamily, sourceFetch } from "@/server/db/schema";
import type { Source, SourceFamily, SourceFetch } from "@/server/db/schema";
import type { ListSources } from "@/server/contracts/source";

type AnyDb = Record<string, (...args: never[]) => never>;

export function sourceFamilyRepo(db: unknown) {
  const d = db as AnyDb & {
    select: (f?: unknown) => {
      from: (t: unknown) => { orderBy: (o: SQL) => Promise<SourceFamily[]> };
    };
    insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<SourceFamily[]> } };
  };

  return {
    async list(): Promise<SourceFamily[]> {
      return d.select().from(sourceFamily).orderBy(desc(sourceFamily.createdAt));
    },
    async insert(values: Record<string, unknown>): Promise<SourceFamily> {
      const rows = await d.insert(sourceFamily).values(values).returning();
      return rows[0]!;
    },
  };
}

export function sourceRepo(db: unknown) {
  const d = db as AnyDb & {
    select: (f?: unknown) => {
      from: (t: unknown) => {
        where: (w: SQL | undefined) => { orderBy: (o: SQL) => { limit: (n: number) => Promise<Source[]> } };
      };
    };
    insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<Source[]> } };
    update: (t: unknown) => { set: (v: unknown) => { where: (w: SQL) => { returning: () => Promise<Source[]> } } };
  };

  return {
    async byId(id: string): Promise<Source | undefined> {
      const rows = await d
        .select()
        .from(source)
        .where(eq(source.id, id))
        .orderBy(desc(source.createdAt))
        .limit(1);
      return rows[0];
    },

    async list(filters: ListSources): Promise<Source[]> {
      const clauses: SQL[] = [];
      if (filters.sourceFamilyId) clauses.push(eq(source.sourceFamilyId, filters.sourceFamilyId));
      if (filters.kind) clauses.push(eq(source.kind, filters.kind));
      if (filters.active !== undefined) clauses.push(eq(source.active, filters.active));
      if (filters.cursor) clauses.push(lt(source.createdAt, new Date(filters.cursor)));

      return d
        .select()
        .from(source)
        .where(clauses.length ? and(...clauses) : undefined)
        .orderBy(desc(source.createdAt))
        .limit(filters.limit);
    },

    /** What the ingestion cron walks: active sources of a kind a connector
     *  is actually registered for. */
    async activeByKind(kind: Source["kind"]): Promise<Source[]> {
      return d
        .select()
        .from(source)
        .where(and(eq(source.kind, kind), eq(source.active, true)))
        .orderBy(desc(source.createdAt))
        .limit(1000);
    },

    async insert(values: Record<string, unknown>): Promise<Source> {
      const rows = await d.insert(source).values(values).returning();
      return rows[0]!;
    },

    async update(id: string, values: Record<string, unknown>): Promise<Source> {
      const rows = await d.update(source).set(values).where(eq(source.id, id)).returning();
      return rows[0]!;
    },
  };
}

export function sourceFetchRepo(db: unknown) {
  const d = db as AnyDb & {
    insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<SourceFetch[]> } };
  };

  return {
    async insert(values: Record<string, unknown>): Promise<SourceFetch> {
      const rows = await d.insert(sourceFetch).values(values).returning();
      return rows[0]!;
    },
  };
}

export type SourceRepo = ReturnType<typeof sourceRepo>;
export type SourceFamilyRepo = ReturnType<typeof sourceFamilyRepo>;
export type SourceFetchRepo = ReturnType<typeof sourceFetchRepo>;
