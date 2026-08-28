import "server-only";

import { sql } from "drizzle-orm";

export type BriefingEvidence = {
  id: string;
  title: string;
  excerpt: string | null;
  url: string | null;
  language: string;
  publishedAt: Date | null;
  capturedAt: Date;
  publisher: string;
  sourceFamilyId: string;
};

type Db = {
  execute: <T>(query: unknown) => Promise<{ rows: T[] }>;
};

export function briefingRepo(db: unknown) {
  const d = db as Db;

  return {
    async acquire(localDate: string, stage: string): Promise<string | null> {
      const result = await d.execute<{ id: string }>(sql`
        INSERT INTO briefing_run (local_date, stage, status, started_at)
        VALUES (${localDate}, ${stage}, 'running', now())
        ON CONFLICT (local_date, stage) DO NOTHING
        RETURNING id
      `);
      return result.rows[0]?.id ?? null;
    },

    async complete(id: string, inputCount: number, outputCount: number): Promise<void> {
      await d.execute(sql`
        UPDATE briefing_run
        SET status = 'completed',
            input_count = ${inputCount},
            output_count = ${outputCount},
            finished_at = now(),
            error_message = NULL
        WHERE id = ${id}
      `);
    },

    async fail(id: string, inputCount: number, errorMessage: string): Promise<void> {
      await d.execute(sql`
        UPDATE briefing_run
        SET status = 'failed',
            input_count = ${inputCount},
            finished_at = now(),
            error_message = ${errorMessage.slice(0, 1_000)}
        WHERE id = ${id}
      `);
    },

    async recentEvidence(since: Date, limit = 80): Promise<BriefingEvidence[]> {
      const result = await d.execute<BriefingEvidence>(sql`
        SELECT e.id,
               e.title,
               e.excerpt,
               e.url,
               e.language,
               e.published_at AS "publishedAt",
               e.captured_at AS "capturedAt",
               s.name AS publisher,
               s.source_family_id AS "sourceFamilyId"
        FROM evidence e
        JOIN source s ON s.id = e.source_id
        WHERE e.data_class = 'public'
          AND e.captured_at >= ${since}
        ORDER BY coalesce(e.published_at, e.captured_at) DESC
        LIMIT ${limit}
      `);
      return result.rows;
    },

    async summary(): Promise<{
      latestRunAt: string | null;
      failedRuns: number;
      unprocessedEvidence: number;
    }> {
      const result = await d.execute<{
        latestRunAt: string | null;
        failedRuns: string | number;
        unprocessedEvidence: string | number;
      }>(sql`
        SELECT
          (SELECT max(created_at)::text FROM briefing_run) AS "latestRunAt",
          (SELECT count(*) FROM briefing_run
             WHERE status = 'failed' AND created_at >= now() - interval '7 days') AS "failedRuns",
          (SELECT count(*) FROM evidence e
             WHERE e.data_class = 'public'
               AND e.captured_at >= now() - interval '48 hours'
               AND NOT EXISTS (
                 SELECT 1 FROM publication_evidence pe WHERE pe.evidence_id = e.id
               )) AS "unprocessedEvidence"
      `);
      const row = result.rows[0];
      return {
        latestRunAt: row?.latestRunAt ?? null,
        failedRuns: Number(row?.failedRuns ?? 0),
        unprocessedEvidence: Number(row?.unprocessedEvidence ?? 0),
      };
    },
  };
}

export type BriefingRepo = ReturnType<typeof briefingRepo>;
