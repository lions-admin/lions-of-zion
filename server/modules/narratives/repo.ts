import "server-only";

/**
 * Persistence for narratives, actors and observations. Owns SQL; owns no
 * policy.
 *
 * There is no `update` for an observation — the table is append-only, and a
 * mistaken sighting is corrected by recording a new one, not by editing what
 * was seen.
 */

import { and, desc, eq, lt, sql, type SQL } from "drizzle-orm";
import { actor, narrative, narrativeItem, narrativeObservation } from "@/server/db/schema";
import type { Actor, Narrative, NarrativeObservation } from "@/server/db/schema";
import type { ListActors, ListNarratives } from "@/server/contracts/narrative";

type AnyDb = Record<string, (...args: never[]) => never>;
type Db = AnyDb & {
  select: (f?: unknown) => {
    from: (t: unknown) => {
      where: (w: SQL | undefined) => {
        orderBy: (...o: SQL[]) => { limit: (n: number) => Promise<Record<string, unknown>[]> };
      };
    };
  };
  insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<Record<string, unknown>[]> } };
  update: (t: unknown) => { set: (v: unknown) => { where: (w: SQL) => { returning: () => Promise<Record<string, unknown>[]> } } };
  execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }>;
};

export function narrativeRepo(db: unknown) {
  const d = db as Db;

  return {
    /* ── actors ── */
    async insertActor(values: Record<string, unknown>): Promise<Actor> {
      const rows = await d.insert(actor).values(values).returning();
      return rows[0] as unknown as Actor;
    },
    async actorById(id: string): Promise<Actor | undefined> {
      const rows = await d.select().from(actor).where(eq(actor.id, id))
        .orderBy(desc(actor.createdAt)).limit(1);
      return rows[0] as unknown as Actor | undefined;
    },
    async listActors(filters: ListActors): Promise<Actor[]> {
      const clauses: SQL[] = [];
      if (filters.kind) clauses.push(eq(actor.kind, filters.kind));
      if (filters.country) clauses.push(eq(actor.country, filters.country));
      const rows = await d.select().from(actor)
        .where(clauses.length ? and(...clauses) : undefined)
        .orderBy(desc(actor.createdAt)).limit(filters.limit);
      return rows as unknown as Actor[];
    },

    /* ── narratives ── */
    async insertNarrative(values: Record<string, unknown>): Promise<Narrative> {
      const rows = await d.insert(narrative).values(values).returning();
      return rows[0] as unknown as Narrative;
    },
    async narrativeById(id: string): Promise<Narrative | undefined> {
      const rows = await d.select().from(narrative).where(eq(narrative.id, id))
        .orderBy(desc(narrative.createdAt)).limit(1);
      return rows[0] as unknown as Narrative | undefined;
    },
    async listNarratives(filters: ListNarratives): Promise<Narrative[]> {
      const clauses: SQL[] = [];
      if (filters.status) clauses.push(eq(narrative.status, filters.status));
      if (filters.cursor) clauses.push(lt(narrative.createdAt, new Date(filters.cursor)));
      const rows = await d.select().from(narrative)
        .where(clauses.length ? and(...clauses) : undefined)
        .orderBy(desc(narrative.createdAt)).limit(filters.limit);
      return rows as unknown as Narrative[];
    },
    async updateNarrative(id: string, values: Record<string, unknown>): Promise<Narrative> {
      const rows = await d.update(narrative).set(values).where(eq(narrative.id, id)).returning();
      return rows[0] as unknown as Narrative;
    },

    async linkItem(values: Record<string, unknown>): Promise<void> {
      await d.insert(narrativeItem).values(values).returning();
    },
    async itemsFor(narrativeId: string): Promise<Record<string, unknown>[]> {
      const result = await d.execute(sql`
        SELECT ni.item_id, ni.rationale, ni.confirmed_by,
               i.public_id, i.title, i.status, i.assessment
        FROM narrative_item ni
        JOIN information_item i ON i.id = ni.item_id
        WHERE ni.narrative_id = ${narrativeId}
        ORDER BY ni.created_at DESC LIMIT 200`);
      return result.rows;
    },

    /* ── observations ── */
    async insertObservation(values: Record<string, unknown>): Promise<NarrativeObservation> {
      const rows = await d.insert(narrativeObservation).values(values).returning();
      return rows[0] as unknown as NarrativeObservation;
    },

    /** Who has been pushing this narrative, with how much of it confirmed. */
    async actorsFor(narrativeId: string, since: Date): Promise<Record<string, unknown>[]> {
      const result = await d.execute(sql`
        SELECT a.id, a.public_id, a.kind, a.name,
               COUNT(*)                                        AS observations,
               COUNT(*) FILTER (WHERE o.confirmed_by IS NOT NULL) AS confirmed,
               COUNT(DISTINCT s.source_family_id)              AS families,
               MAX(o.observed_at)                              AS last_seen
        FROM narrative_observation o
        JOIN actor a    ON a.id = o.actor_id
        JOIN evidence e ON e.id = o.evidence_id
        JOIN source s   ON s.id = e.source_id
        WHERE o.narrative_id = ${narrativeId} AND o.observed_at >= ${since}
        GROUP BY a.id, a.public_id, a.kind, a.name
        ORDER BY observations DESC LIMIT 100`);
      return result.rows;
    },

    /**
     * The monitoring answer. All the counting lives in `narrative_activity()`
     * so the rule about independent families exists in exactly one place.
     */
    async activity(since: Date, limit: number): Promise<Record<string, unknown>[]> {
      const result = await d.execute(sql`
        SELECT * FROM narrative_activity(${since}) LIMIT ${limit}`);
      return result.rows;
    },
  };
}

export type NarrativeRepo = ReturnType<typeof narrativeRepo>;
