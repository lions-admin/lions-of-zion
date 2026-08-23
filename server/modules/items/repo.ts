import "server-only";

/**
 * Persistence for information items. Owns SQL; owns no policy.
 *
 * Nothing outside this file and `server/core/versioning.ts` may UPDATE the
 * item table — that is what keeps every change versioned and audited.
 */

import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import { informationItem, informationItemTopic } from "@/server/db/schema";
import type { InformationItem } from "@/server/db/schema";
import type { ListItems } from "@/server/contracts/item";

/* Structural typing again: the same repository has to work against the Neon
   pool in production and PGlite in tests, and neither driver's concrete type
   belongs in this signature. */
type AnyDb = Record<string, (...args: never[]) => never>;

export function itemRepo(db: unknown) {
  const d = db as AnyDb & {
    select: (f?: unknown) => {
      from: (t: unknown) => {
        where: (w: SQL | undefined) => { orderBy: (o: SQL) => { limit: (n: number) => Promise<InformationItem[]> } };
      };
    };
    insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<InformationItem[]> } };
    update: (t: unknown) => { set: (v: unknown) => { where: (w: SQL) => { returning: () => Promise<InformationItem[]> } } };
  };

  return {
    async byId(id: string): Promise<InformationItem | undefined> {
      const rows = await d
        .select()
        .from(informationItem)
        .where(eq(informationItem.id, id))
        .orderBy(desc(informationItem.createdAt))
        .limit(1);
      return rows[0];
    },

    async byPublicId(publicId: string): Promise<InformationItem | undefined> {
      const rows = await d
        .select()
        .from(informationItem)
        .where(eq(informationItem.publicId, publicId))
        .orderBy(desc(informationItem.createdAt))
        .limit(1);
      return rows[0];
    },

    async list(filters: ListItems): Promise<InformationItem[]> {
      const clauses: SQL[] = [];
      if (filters.status) clauses.push(eq(informationItem.status, filters.status));
      if (filters.type) clauses.push(eq(informationItem.type, filters.type));
      if (filters.language) clauses.push(eq(informationItem.language, filters.language));
      if (filters.eventId) clauses.push(eq(informationItem.eventId, filters.eventId));
      /* Keyset pagination on created_at: an OFFSET walks rows it will discard,
         and shifts under you when something is inserted mid-scroll. */
      if (filters.cursor) clauses.push(lt(informationItem.createdAt, new Date(filters.cursor)));

      return d
        .select()
        .from(informationItem)
        .where(clauses.length ? and(...clauses) : undefined)
        .orderBy(desc(informationItem.createdAt))
        .limit(filters.limit);
    },

    async insert(values: Record<string, unknown>): Promise<InformationItem> {
      const rows = await d.insert(informationItem).values(values).returning();
      return rows[0]!;
    },

    async update(id: string, values: Record<string, unknown>): Promise<InformationItem> {
      const rows = await d
        .update(informationItem)
        .set(values)
        .where(eq(informationItem.id, id))
        .returning();
      return rows[0]!;
    },

    async setTopics(itemId: string, topicIds: readonly string[]): Promise<void> {
      if (!topicIds.length) return;
      await d
        .insert(informationItemTopic)
        .values(topicIds.map((topicId) => ({ itemId, topicId })))
        .returning();
    },
  };
}

export type ItemRepo = ReturnType<typeof itemRepo>;
