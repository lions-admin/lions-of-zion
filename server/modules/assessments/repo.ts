import "server-only";

/**
 * Persistence for evidence links, assessments, and the review queue. Owns
 * SQL; owns no policy.
 *
 * Nothing outside this file and `server/db/migrations/0007_*` may UPDATE
 * `item_assessment` — the trigger enforces it regardless, this is just where
 * the two sanctioned updates (`supersede`, `approve`) live.
 */

import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { appUser, itemAssessment, itemEvidence, reviewQueue } from "@/server/db/schema";
import type { ItemAssessment, ItemEvidence, ReviewQueueEntry } from "@/server/db/schema";
import type { ListReviewQueue } from "@/server/contracts/assessment";
import type { EvidenceTally } from "./rules";

type AnyDb = Record<string, (...args: never[]) => never>;

export type Reviewer = { id: string; isAutomated: boolean };

/** Whether an actor's `userId` is a real, human app_user — what
 *  `assertHumanReviewer()` needs and cannot get from a label alone. Shared
 *  by the item and assessment approval paths. */
export async function findReviewer(db: unknown, userId: string): Promise<Reviewer | undefined> {
  const d = db as AnyDb & {
    select: (f?: unknown) => {
      from: (t: unknown) => { where: (w: SQL) => { limit: (n: number) => Promise<Reviewer[]> } };
    };
  };
  const rows = await d
    .select({ id: appUser.id, isAutomated: appUser.isAutomated })
    .from(appUser)
    .where(eq(appUser.id, userId))
    .limit(1);
  return rows[0];
}

export function itemEvidenceRepo(db: unknown) {
  const d = db as AnyDb & {
    select: (f?: unknown) => {
      from: (t: unknown) => { where: (w: SQL) => Promise<ItemEvidence[]> };
    };
    insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<ItemEvidence[]> } };
    update: (t: unknown) => { set: (v: unknown) => { where: (w: SQL | undefined) => { returning: () => Promise<ItemEvidence[]> } } };
    execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }>;
  };

  return {
    async list(itemId: string): Promise<ItemEvidence[]> {
      return d.select().from(itemEvidence).where(eq(itemEvidence.itemId, itemId));
    },

    async insert(values: Record<string, unknown>): Promise<ItemEvidence> {
      const rows = await d.insert(itemEvidence).values(values).returning();
      return rows[0]!;
    },

    async confirm(itemId: string, evidenceId: string, confirmedBy: string | null): Promise<ItemEvidence> {
      const rows = await d
        .update(itemEvidence)
        .set({ confirmedBy, confirmedAt: new Date() })
        .where(and(eq(itemEvidence.itemId, itemId), eq(itemEvidence.evidenceId, evidenceId)))
        .returning();
      return rows[0]!;
    },

    /** Confirmed edges only, grouped by whether they support or contradict,
     *  counting distinct source families at adequate-or-better strength —
     *  exactly what `canAssignVerdict()` reasons about. */
    async tally(itemId: string): Promise<EvidenceTally> {
      const result = await d.execute(sql`
        SELECT
          CASE WHEN ie.relation IN ('supports', 'partially_supports') THEN 'supporting'
               WHEN ie.relation = 'contradicts' THEN 'contradicting'
               ELSE 'other' END AS bucket,
          COUNT(DISTINCT s.source_family_id) FILTER (WHERE ie.strength IN ('strong', 'adequate')) AS families,
          COUNT(*) AS total
        FROM item_evidence ie
        JOIN evidence e ON e.id = ie.evidence_id
        JOIN source s ON s.id = e.source_id
        WHERE ie.item_id = ${itemId} AND ie.confirmed_by IS NOT NULL
        GROUP BY bucket
      `);
      const rows = result.rows as { bucket: string; families: string | number; total: string | number }[];
      const bucket = (name: string) => rows.find((r) => r.bucket === name);
      return {
        supportingFamilies: Number(bucket("supporting")?.families ?? 0),
        contradictingFamilies: Number(bucket("contradicting")?.families ?? 0),
        confirmedTotal: rows.reduce((sum, r) => sum + Number(r.total), 0),
      };
    },
  };
}

export function itemAssessmentRepo(db: unknown) {
  const d = db as AnyDb & {
    select: (f?: unknown) => {
      from: (t: unknown) => {
        where: (w: SQL | undefined) => { orderBy: (o: SQL) => { limit: (n: number) => Promise<ItemAssessment[]> } };
      };
    };
    insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<ItemAssessment[]> } };
    update: (t: unknown) => { set: (v: unknown) => { where: (w: SQL) => { returning: () => Promise<ItemAssessment[]> } } };
  };

  return {
    async byId(id: string): Promise<ItemAssessment | undefined> {
      const rows = await d
        .select()
        .from(itemAssessment)
        .where(eq(itemAssessment.id, id))
        .orderBy(desc(itemAssessment.createdAt))
        .limit(1);
      return rows[0];
    },

    async current(itemId: string): Promise<ItemAssessment | undefined> {
      const rows = await d
        .select()
        .from(itemAssessment)
        .where(and(eq(itemAssessment.itemId, itemId), sql`${itemAssessment.supersededByAssessmentId} IS NULL`))
        .orderBy(desc(itemAssessment.createdAt))
        .limit(1);
      return rows[0];
    },

    async history(itemId: string): Promise<ItemAssessment[]> {
      return d
        .select()
        .from(itemAssessment)
        .where(eq(itemAssessment.itemId, itemId))
        .orderBy(desc(itemAssessment.createdAt))
        .limit(200);
    },

    async insert(values: Record<string, unknown>): Promise<ItemAssessment> {
      const rows = await d.insert(itemAssessment).values(values).returning();
      return rows[0]!;
    },

    /** The one sanctioned way an existing assessment row changes: pointing it
     *  at the assessment that replaced it. */
    async supersede(id: string, byAssessmentId: string): Promise<void> {
      await d.update(itemAssessment).set({ supersededByAssessmentId: byAssessmentId }).where(eq(itemAssessment.id, id));
    },

    /** The other sanctioned change: recording who reviewed it. */
    async approve(id: string, approvedBy: string): Promise<ItemAssessment> {
      const rows = await d.update(itemAssessment).set({ approvedBy }).where(eq(itemAssessment.id, id)).returning();
      return rows[0]!;
    },
  };
}

export function reviewQueueRepo(db: unknown) {
  const d = db as AnyDb & {
    select: (f?: unknown) => {
      from: (t: unknown) => {
        where: (w: SQL | undefined) => { orderBy: (...o: SQL[]) => { limit: (n: number) => Promise<ReviewQueueEntry[]> } };
      };
    };
    insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<ReviewQueueEntry[]> } };
    update: (t: unknown) => { set: (v: unknown) => { where: (w: SQL) => { returning: () => Promise<ReviewQueueEntry[]> } } };
  };

  return {
    async byId(id: string): Promise<ReviewQueueEntry | undefined> {
      const rows = await d
        .select()
        .from(reviewQueue)
        .where(eq(reviewQueue.id, id))
        .orderBy(desc(reviewQueue.createdAt))
        .limit(1);
      return rows[0];
    },

    async list(filters: ListReviewQueue): Promise<ReviewQueueEntry[]> {
      const clauses: SQL[] = [];
      if (filters.state) clauses.push(eq(reviewQueue.state, filters.state));
      if (filters.kind) clauses.push(eq(reviewQueue.kind, filters.kind));

      return d
        .select()
        .from(reviewQueue)
        .where(clauses.length ? and(...clauses) : undefined)
        .orderBy(desc(reviewQueue.priority), desc(reviewQueue.createdAt))
        .limit(filters.limit);
    },

    async insert(values: Record<string, unknown>): Promise<ReviewQueueEntry> {
      const rows = await d.insert(reviewQueue).values(values).returning();
      return rows[0]!;
    },

    async claim(id: string, claimedBy: string): Promise<ReviewQueueEntry> {
      const rows = await d
        .update(reviewQueue)
        .set({ state: "claimed", claimedBy, claimedAt: new Date(), updatedAt: new Date() })
        .where(eq(reviewQueue.id, id))
        .returning();
      return rows[0]!;
    },

    async complete(
      id: string,
      state: "done" | "dropped",
      completedBy: string,
      note: string | null,
    ): Promise<ReviewQueueEntry> {
      const rows = await d
        .update(reviewQueue)
        .set({ state, completedBy, completedAt: new Date(), note, updatedAt: new Date() })
        .where(eq(reviewQueue.id, id))
        .returning();
      return rows[0]!;
    },
  };
}

export type ItemEvidenceRepo = ReturnType<typeof itemEvidenceRepo>;
export type ItemAssessmentRepo = ReturnType<typeof itemAssessmentRepo>;
export type ReviewQueueRepo = ReturnType<typeof reviewQueueRepo>;
