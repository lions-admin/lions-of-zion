import "server-only";

/**
 * Persistence for AI runs, suggestions, prompts and translations. Owns SQL;
 * owns no policy.
 *
 * `ai_run` and `prompt_registry` are append-only in the database, so there is
 * deliberately no `update` for either here — activating a prompt version goes
 * through the `activate_prompt()` SQL function, which is the single sanctioned
 * bypass.
 */

import { and, desc, eq, sql, type SQL } from "drizzle-orm";
import { aiRun, aiSuggestion, promptRegistry, translation } from "@/server/db/schema";
import type { AiRun, AiSuggestion, PromptRegistryEntry, Translation } from "@/server/db/schema";
import type { ListSuggestions } from "@/server/contracts/ai";
import type { EntityType } from "@/server/contracts/enums";

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
  update: (t: unknown) => { set: (v: unknown) => { where: (w: SQL | undefined) => { returning: () => Promise<Record<string, unknown>[]> } } };
  execute: (q: unknown) => Promise<{ rows: Record<string, unknown>[] }>;
};

export function aiRepo(db: unknown) {
  const d = db as Db;

  return {
    async recordRun(values: Record<string, unknown>): Promise<AiRun> {
      const rows = await d.insert(aiRun).values(values).returning();
      return rows[0] as unknown as AiRun;
    },

    /** Recorded spend in a window, from the SQL function so the arithmetic
     *  lives in one place. Returns 0, never null, for an empty window. */
    async spendSince(since: Date): Promise<number> {
      const result = await d.execute(sql`SELECT ai_spend_since(${since}) AS spend`);
      return Number((result.rows[0] as { spend: string | number } | undefined)?.spend ?? 0);
    },

    /** The prompt version currently in use for a slug. */
    async activePrompt(slug: string): Promise<PromptRegistryEntry | undefined> {
      const rows = await d
        .select()
        .from(promptRegistry)
        .where(and(eq(promptRegistry.slug, slug), sql`${promptRegistry.activatedAt} IS NOT NULL`))
        .orderBy(desc(promptRegistry.version))
        .limit(1);
      return rows[0] as unknown as PromptRegistryEntry | undefined;
    },

    async insertPrompt(values: Record<string, unknown>): Promise<PromptRegistryEntry> {
      const rows = await d.insert(promptRegistry).values(values).returning();
      return rows[0] as unknown as PromptRegistryEntry;
    },

    async activatePrompt(slug: string, version: number): Promise<void> {
      await d.execute(sql`SELECT activate_prompt(${slug}, ${version})`);
    },

    async insertSuggestion(values: Record<string, unknown>): Promise<AiSuggestion> {
      const rows = await d.insert(aiSuggestion).values(values).returning();
      return rows[0] as unknown as AiSuggestion;
    },

    async suggestionById(id: string): Promise<AiSuggestion | undefined> {
      const rows = await d
        .select()
        .from(aiSuggestion)
        .where(eq(aiSuggestion.id, id))
        .orderBy(desc(aiSuggestion.createdAt))
        .limit(1);
      return rows[0] as unknown as AiSuggestion | undefined;
    },

    async listSuggestions(filters: ListSuggestions): Promise<AiSuggestion[]> {
      const clauses: SQL[] = [];
      if (filters.subjectId) clauses.push(eq(aiSuggestion.subjectId, filters.subjectId));
      if (filters.status) clauses.push(eq(aiSuggestion.status, filters.status));
      const rows = await d
        .select()
        .from(aiSuggestion)
        .where(clauses.length ? and(...clauses) : undefined)
        .orderBy(desc(aiSuggestion.createdAt))
        .limit(filters.limit);
      return rows as unknown as AiSuggestion[];
    },

    async decideSuggestion(
      id: string,
      status: "accepted" | "rejected",
      decidedBy: string,
      note: string | null,
    ): Promise<AiSuggestion> {
      const rows = await d
        .update(aiSuggestion)
        .set({ status, decidedBy, decidedAt: new Date(), decisionNote: note })
        .where(eq(aiSuggestion.id, id))
        .returning();
      return rows[0] as unknown as AiSuggestion;
    },

    /** Supersedes any older pending suggestion for the same target, so a
     *  reviewer is never shown two competing proposals for one field.
     *
     *  `decided_by` stays null on purpose — nobody decided this, the system
     *  retired it — which is why the CHECK exempts `superseded`. */
    async supersedePending(subjectType: EntityType, subjectId: string, field: string): Promise<void> {
      await d.execute(sql`
        UPDATE ai_suggestion
        SET status = 'superseded', decided_at = now()
        WHERE subject_type = ${subjectType}
          AND subject_id = ${subjectId}
          AND field = ${field}
          AND status = 'pending'
      `);
    },

    async upsertTranslation(values: Record<string, unknown>): Promise<Translation> {
      const rows = await d.insert(translation).values(values).returning();
      return rows[0] as unknown as Translation;
    },

    /** Translations whose source text has moved since they were produced —
     *  the same hash-comparison shape as the embedding backlog. */
    async staleTranslations(limit: number): Promise<Translation[]> {
      const result = await d.execute(sql`
        SELECT t.*
        FROM translation t
        JOIN information_item i ON i.id = t.subject_id AND t.subject_type = 'information_item'
        WHERE t.source_content_hash IS DISTINCT FROM i.content_hash
        ORDER BY t.updated_at ASC
        LIMIT ${limit}
      `);
      return result.rows as unknown as Translation[];
    },
  };
}

export type AiRepo = ReturnType<typeof aiRepo>;
