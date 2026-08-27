import "server-only";

/**
 * Persistence for publications. Owns SQL; owns no policy.
 *
 * Extracted from `service.ts` 2026-08-27 to match the other modules — this one
 * and `reports` were the two that kept the repository inline, which made the
 * shape `CLAUDE.md` documents true of nine modules out of eleven. The code is
 * unchanged; only its address is.
 */

import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import { publication, publicationItem } from "@/server/db/schema";
import type { Publication } from "@/server/db/schema";
import type { ListPublications } from "@/server/contracts/publication";

/* Structural typing: the same repository runs against the Neon pool in
   production and PGlite in tests, and neither driver's concrete type belongs
   in this signature. */
type AnyDb = Record<string, (...args: never[]) => never>;

export function repo(db: unknown) {
  const d = db as AnyDb & {
    select: (f?: unknown) => {
      from: (t: unknown) => {
        where: (w: SQL | undefined) => {
          orderBy: (o: SQL) => { limit: (n: number) => Promise<Publication[]> };
        };
      };
    };
    insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<Publication[]> } };
    update: (t: unknown) => {
      set: (v: unknown) => { where: (w: SQL) => { returning: () => Promise<Publication[]> } };
    };
  };

  return {
    async byId(id: string): Promise<Publication | undefined> {
      const rows = await d
        .select()
        .from(publication)
        .where(eq(publication.id, id))
        .orderBy(desc(publication.createdAt))
        .limit(1);
      return rows[0];
    },
    async byPublicId(publicId: string): Promise<Publication | undefined> {
      const rows = await d
        .select()
        .from(publication)
        .where(eq(publication.publicId, publicId))
        .orderBy(desc(publication.createdAt))
        .limit(1);
      return rows[0];
    },
    async list(filters: ListPublications): Promise<Publication[]> {
      const clauses: SQL[] = [];
      if (filters.kind) clauses.push(eq(publication.kind, filters.kind));
      if (filters.status) clauses.push(eq(publication.status, filters.status));
      if (filters.eventId) clauses.push(eq(publication.eventId, filters.eventId));
      if (filters.cursor) clauses.push(lt(publication.createdAt, new Date(filters.cursor)));
      return d
        .select()
        .from(publication)
        .where(clauses.length ? and(...clauses) : undefined)
        .orderBy(desc(publication.createdAt))
        .limit(filters.limit);
    },
    async insert(values: Record<string, unknown>): Promise<Publication> {
      const rows = await d.insert(publication).values(values).returning();
      return rows[0]!;
    },
    async update(id: string, values: Record<string, unknown>): Promise<Publication> {
      const rows = await d.update(publication).set(values).where(eq(publication.id, id)).returning();
      return rows[0]!;
    },
    async linkItems(publicationId: string, itemIds: readonly string[]): Promise<void> {
      if (!itemIds.length) return;
      await (d as unknown as {
        insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<unknown[]> } };
      })
        .insert(publicationItem)
        .values(itemIds.map((itemId) => ({ publicationId, itemId })))
        .returning();
    },
  };
}
