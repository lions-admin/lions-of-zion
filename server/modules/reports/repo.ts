import "server-only";

/**
 * Persistence for user-submitted reports. Owns SQL; owns no policy.
 *
 * Extracted from `service.ts` 2026-08-27 to match the other modules — this one
 * and `publications` were the two that kept the repository inline, which made
 * the shape `CLAUDE.md` documents true of nine modules out of eleven. The code
 * is unchanged; only its address is.
 *
 * Note what is deliberately absent: there is no status-trail write here. That
 * is a database trigger, for the reason `service.ts` gives — a trail the
 * service has to remember to write is one that eventually is not written.
 */

import { and, desc, eq, lt, type SQL } from "drizzle-orm";
import { report } from "@/server/db/schema";
import type { Report } from "@/server/db/schema";
import type { ListReports } from "@/server/contracts/report";

/* Structural typing: the same repository runs against the Neon pool in
   production and PGlite in tests, and neither driver's concrete type belongs
   in this signature. */
type AnyDb = Record<string, (...args: never[]) => never>;

export function repo(db: unknown) {
  const d = db as AnyDb & {
    select: (f?: unknown) => {
      from: (t: unknown) => {
        where: (w: SQL | undefined) => {
          orderBy: (o: SQL) => { limit: (n: number) => Promise<Report[]> };
        };
      };
    };
    insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<Report[]> } };
    update: (t: unknown) => {
      set: (v: unknown) => { where: (w: SQL) => { returning: () => Promise<Report[]> } };
    };
  };

  return {
    async byId(id: string): Promise<Report | undefined> {
      const rows = await d
        .select()
        .from(report)
        .where(eq(report.id, id))
        .orderBy(desc(report.createdAt))
        .limit(1);
      return rows[0];
    },
    async list(filters: ListReports): Promise<Report[]> {
      const clauses: SQL[] = [];
      if (filters.status) clauses.push(eq(report.status, filters.status));
      if (filters.cursor) clauses.push(lt(report.createdAt, new Date(filters.cursor)));
      return d
        .select()
        .from(report)
        .where(clauses.length ? and(...clauses) : undefined)
        .orderBy(desc(report.createdAt))
        .limit(filters.limit);
    },
    async insert(values: Record<string, unknown>): Promise<Report> {
      const rows = await d.insert(report).values(values).returning();
      return rows[0]!;
    },
    async update(id: string, values: Record<string, unknown>): Promise<Report> {
      const rows = await d.update(report).set(values).where(eq(report.id, id)).returning();
      return rows[0]!;
    },
  };
}
