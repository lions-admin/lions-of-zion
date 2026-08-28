import "server-only";

/**
 * Persistence for evidence and its provenance trail. Owns SQL; owns no policy.
 *
 * Nothing outside this file and `server/core/versioning.ts` may UPDATE
 * `evidence` — same rule as items, same reason.
 */

import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import { evidence, evidenceProvenance } from "@/server/db/schema";
import type { Evidence } from "@/server/db/schema";
import type { ListEvidence } from "@/server/contracts/evidence";

type AnyDb = Record<string, (...args: never[]) => never>;

export function evidenceRepo(db: unknown) {
  const d = db as AnyDb & {
    select: (f?: unknown) => {
      from: (t: unknown) => {
        where: (w: SQL | undefined) => { orderBy: (o: SQL) => { limit: (n: number) => Promise<Evidence[]> } };
      };
    };
    insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<Evidence[]> } };
    update: (t: unknown) => { set: (v: unknown) => { where: (w: SQL) => { returning: () => Promise<Evidence[]> } } };
  };

  return {
    async byId(id: string): Promise<Evidence | undefined> {
      const rows = await d
        .select()
        .from(evidence)
        .where(eq(evidence.id, id))
        .orderBy(desc(evidence.createdAt))
        .limit(1);
      return rows[0];
    },

    /** The dedup check a re-fetch runs before inserting: has this connector's
     *  id already become a row here? */
    async byExternalId(sourceId: string, externalId: string): Promise<Evidence | undefined> {
      const rows = await d
        .select()
        .from(evidence)
        .where(and(eq(evidence.sourceId, sourceId), eq(evidence.externalId, externalId)))
        .orderBy(desc(evidence.createdAt))
        .limit(1);
      return rows[0];
    },

    /** Discovery connectors may attribute the same canonical URL to different
     * publishers over time. A URL is therefore a second, cross-source dedup
     * key beside a feed's own identifier. */
    async byUrl(url: string): Promise<Evidence | undefined> {
      const rows = await d
        .select()
        .from(evidence)
        .where(eq(evidence.url, url))
        .orderBy(desc(evidence.createdAt))
        .limit(1);
      return rows[0];
    },

    async list(filters: ListEvidence): Promise<Evidence[]> {
      const clauses: SQL[] = [];
      if (filters.sourceId) clauses.push(eq(evidence.sourceId, filters.sourceId));
      if (filters.kind) clauses.push(eq(evidence.kind, filters.kind));
      if (filters.cursor) clauses.push(lt(evidence.createdAt, new Date(filters.cursor)));

      return d
        .select()
        .from(evidence)
        .where(clauses.length ? and(...clauses) : undefined)
        .orderBy(desc(evidence.createdAt))
        .limit(filters.limit);
    },

    async insert(values: Record<string, unknown>): Promise<Evidence> {
      const rows = await d.insert(evidence).values(values).returning();
      return rows[0]!;
    },

    async insertProvenance(values: Record<string, unknown>): Promise<void> {
      await d.insert(evidenceProvenance).values(values).returning();
    },
  };
}

export type EvidenceRepo = ReturnType<typeof evidenceRepo>;
