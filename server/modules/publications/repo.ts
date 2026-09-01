import "server-only";

/**
 * Persistence for publications. Owns SQL; owns no policy.
 *
 * Extracted from `service.ts` 2026-08-27 to match the other modules — this one
 * and `reports` were the two that kept the repository inline, which made the
 * shape `CLAUDE.md` documents true of nine modules out of eleven. The code is
 * unchanged; only its address is.
 */

import { and, desc, eq, inArray, isNotNull, lt, sql, type SQL } from "drizzle-orm";
import {
  publication,
  publicationEvidence,
  publicationItem,
  publicationNarrative,
  publicationPassage,
  publicationPassageEvidence,
  publicationRelated,
} from "@/server/db/schema";
import type { Publication } from "@/server/db/schema";
import { decodePublicPublicationCursor, type ListPublicPublications, type ListPublications } from "@/server/contracts/publication";
import { REQUIRED_QUALITY_CHECKS } from "@/server/modules/briefing/quality";

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
    execute: <T>(query: unknown) => Promise<{ rows: T[] }>;
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
      if (filters.section) clauses.push(eq(publication.section, filters.section));
      if (filters.status) clauses.push(eq(publication.status, filters.status));
      if (filters.eventId) clauses.push(eq(publication.eventId, filters.eventId));
      if (filters.briefingOnly) clauses.push(isNotNull(publication.briefingRunId));
      if (filters.cursor) clauses.push(lt(publication.createdAt, new Date(filters.cursor)));
      return d
        .select()
        .from(publication)
        .where(clauses.length ? and(...clauses) : undefined)
        .orderBy(desc(publication.createdAt))
        .limit(filters.limit);
    },
    async listPublic(filters: ListPublicPublications, briefingOnly = false): Promise<Publication[]> {
      const clauses: SQL[] = [inArray(publication.status, ["published", "updated"])];
      /* Site reference pages share the publication table, but they must never
       * become news merely because the briefing section was introduced later.
       * A briefing run is the durable boundary for automated editorial output. */
      if (briefingOnly) clauses.push(isNotNull(publication.briefingRunId));
      if (filters.kind) clauses.push(eq(publication.kind, filters.kind));
      if (filters.section) clauses.push(eq(publication.section, filters.section));
      if (filters.topic) clauses.push(eq(publication.primaryTopicId, filters.topic));
      if (filters.topicLabel) clauses.push(sql`lower(${publication.editorialTopic}) = lower(${filters.topicLabel})`);
      if (filters.actor) clauses.push(sql`lower(${publication.primaryActor}) = lower(${filters.actor})`);
      if (filters.arena) clauses.push(sql`lower(${publication.arena}) = lower(${filters.arena})`);
      if (filters.date) {
        clauses.push(sql`(${publication.publishedAt} AT TIME ZONE 'Asia/Jerusalem')::date = ${filters.date}::date`);
      }
      if (filters.narrative) {
        clauses.push(sql`EXISTS (
          SELECT 1 FROM publication_narrative pn
          WHERE pn.publication_id = ${publication.id}
            AND pn.narrative_id = ${filters.narrative}
        )`);
      }
      if (filters.cursor) {
        const cursor = decodePublicPublicationCursor(filters.cursor);
        clauses.push(sql`(
          ${publication.publishedAt} < ${cursor.publishedAt}
          OR (${publication.publishedAt} = ${cursor.publishedAt} AND ${publication.publicId} < ${cursor.publicId})
        )`);
      }
      return d
        .select()
        .from(publication)
        .where(and(...clauses))
        .orderBy(sql`${publication.publishedAt} DESC, ${publication.publicId} DESC`)
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
    async remove(id: string): Promise<void> {
      await d.execute(sql`DELETE FROM publication WHERE id = ${id}`);
    },
    async qualityCandidatePassed(briefingRunId: string, candidateKey: string): Promise<boolean> {
      const result = await d.execute<{ passed: boolean; checks: string | number }>(sql`
        SELECT bool_and(status = 'pass') AS passed, count(*)::text AS checks
        FROM briefing_quality_check
        WHERE briefing_run_id = ${briefingRunId}
          AND candidate_key = ${candidateKey}
      `);
      const row = result.rows[0];
      return row?.passed === true && Number(row.checks) === REQUIRED_QUALITY_CHECKS.length;
    },
    async automaticCandidates(briefingRunId: string, candidateKeys: readonly string[]): Promise<Publication[]> {
      if (!candidateKeys.length) return [];
      return d
        .select()
        .from(publication)
        .where(and(
          eq(publication.briefingRunId, briefingRunId),
          inArray(publication.briefingCandidateKey, [...candidateKeys]),
        ))
        .orderBy(desc(publication.createdAt))
        .limit(candidateKeys.length);
    },
    async generatedDrafts(briefingRunId: string): Promise<Publication[]> {
      return d
        .select()
        .from(publication)
        .where(and(
          eq(publication.briefingRunId, briefingRunId),
          eq(publication.status, "draft"),
        ))
        .orderBy(desc(publication.createdAt))
        .limit(32);
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
    async linkNarratives(publicationId: string, narrativeIds: readonly string[]): Promise<void> {
      if (!narrativeIds.length) return;
      await (d as unknown as {
        insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<unknown[]> } };
      })
        .insert(publicationNarrative)
        .values(narrativeIds.map((narrativeId) => ({ publicationId, narrativeId })))
        .returning();
    },
    async linkEvidence(publicationId: string, evidenceIds: readonly string[]): Promise<void> {
      if (!evidenceIds.length) return;
      await (d as unknown as {
        insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<unknown[]> } };
      })
        .insert(publicationEvidence)
        .values(evidenceIds.map((evidenceId) => ({ publicationId, evidenceId })))
        .returning();
    },
    async linkPassages(
      publicationId: string,
      passages: readonly { text: string; itemId?: string; evidenceIds: readonly string[] }[],
    ): Promise<void> {
      if (!passages.length) return;
      const insert = d as unknown as {
        insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<Array<{ id: string }>> } };
      };
      for (const [index, passage] of passages.entries()) {
        const [row] = await insert.insert(publicationPassage).values({
          publicationId,
          position: index + 1,
          text: passage.text,
          itemId: passage.itemId ?? null,
        }).returning();
        if (passage.evidenceIds.length) {
          await insert.insert(publicationPassageEvidence).values(
            passage.evidenceIds.map((evidenceId) => ({ passageId: row!.id, evidenceId })),
          ).returning();
        }
      }
    },
    async linkRelated(publicationId: string, relatedPublicationIds: readonly string[]): Promise<void> {
      if (!relatedPublicationIds.length) return;
      await (d as unknown as {
        insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<unknown[]> } };
      }).insert(publicationRelated).values(
        relatedPublicationIds.map((relatedPublicationId, index) => ({
          publicationId,
          relatedPublicationId,
          position: index + 1,
        })),
      ).returning();
    },
    async setHomepageFeature(slot: number, publicationId: string | null): Promise<void> {
      if (publicationId === null) {
        await d.execute(sql`DELETE FROM homepage_feature WHERE slot = ${slot}`);
        return;
      }
      await d.execute(sql`DELETE FROM homepage_feature WHERE publication_id = ${publicationId}`);
      await d.execute(sql`
        INSERT INTO homepage_feature (slot, publication_id)
        VALUES (${slot}, ${publicationId})
        ON CONFLICT (slot) DO UPDATE
        SET publication_id = EXCLUDED.publication_id, updated_at = now()
      `);
    },
    async homepageFeatures(): Promise<Array<{ slot: number; publicationId: string }>> {
      const result = await d.execute<{ slot: number; publicationId: string }>(sql`
        SELECT slot, publication_id AS "publicationId" FROM homepage_feature ORDER BY slot
      `);
      return result.rows.map((row) => ({ ...row, slot: Number(row.slot) }));
    },
    async adminTraceability(publicationId: string): Promise<{
      briefingRun: { id: string; localDate: string; stage: string; status: string } | null;
      edition: { id: string; contractVersion: string; promptVersion: string; status: string } | null;
      modelRuns: Array<{ id: string; model: string; profile: string; stage: string; costUsd: number }>;
      claims: Array<{ id: string; title: string; assessment: string; aiRunId: string | null; evidenceCount: number }>;
      sources: Array<{ id: string; title: string; publisher: string; url: string | null; retrievalStatus: string }>;
    }> {
      const [run, edition, models, claims, sources] = await Promise.all([
        d.execute<{ id: string; localDate: string; stage: string; status: string }>(sql`
          SELECT br.id, br.local_date AS "localDate", br.stage, br.status
          FROM publication p JOIN briefing_run br ON br.id = p.briefing_run_id
          WHERE p.id = ${publicationId}
        `),
        d.execute<{ id: string; contractVersion: string; promptVersion: string; status: string }>(sql`
          SELECT be.id, be.contract_version AS "contractVersion",
                 be.prompt_version AS "promptVersion", be.status
          FROM publication p
          JOIN briefing_run br ON br.id = p.briefing_run_id
          JOIN briefing_edition be ON be.local_date = br.local_date
          WHERE p.id = ${publicationId}
        `),
        d.execute<{ id: string; model: string; profile: string; stage: string; costUsd: string | number }>(sql`
          SELECT DISTINCT ar.id, ar.model, ar.model_profile AS profile, bra.stage,
                 ar.cost_usd AS "costUsd", ar.created_at
          FROM publication p
          JOIN briefing_run publication_run ON publication_run.id = p.briefing_run_id
          JOIN briefing_run stage_run ON stage_run.local_date = publication_run.local_date
          JOIN briefing_run_ai bra ON bra.briefing_run_id = stage_run.id
          JOIN ai_run ar ON ar.id = bra.ai_run_id
          WHERE p.id = ${publicationId}
          ORDER BY ar.created_at
        `),
        d.execute<{ id: string; title: string; assessment: string; aiRunId: string | null; evidenceCount: string | number }>(sql`
          SELECT ii.id, ii.title, bc.machine_assessment AS assessment,
                 bc.ai_run_id AS "aiRunId", count(ie.evidence_id)::text AS "evidenceCount"
          FROM publication_item pi
          JOIN information_item ii ON ii.id = pi.item_id
          JOIN briefing_claim bc ON bc.item_id = ii.id
          LEFT JOIN item_evidence ie ON ie.item_id = ii.id
          WHERE pi.publication_id = ${publicationId}
          GROUP BY ii.id, ii.title, bc.machine_assessment, bc.ai_run_id
          ORDER BY ii.created_at
        `),
        d.execute<{ id: string; title: string; publisher: string; url: string | null; retrievalStatus: string }>(sql`
          SELECT e.id, e.title, s.name AS publisher, coalesce(e.canonical_url, e.url) AS url,
                 e.retrieval_status AS "retrievalStatus"
          FROM publication_evidence pe
          JOIN evidence e ON e.id = pe.evidence_id
          JOIN source s ON s.id = e.source_id
          WHERE pe.publication_id = ${publicationId}
          ORDER BY coalesce(e.published_at, e.captured_at) DESC
        `),
      ]);
      return {
        briefingRun: run.rows[0] ?? null,
        edition: edition.rows[0] ?? null,
        modelRuns: models.rows.map((entry) => ({ ...entry, costUsd: Number(entry.costUsd) })),
        claims: claims.rows.map((entry) => ({ ...entry, evidenceCount: Number(entry.evidenceCount) })),
        sources: sources.rows,
      };
    },
    async publicReferences(publicationId: string): Promise<{
      sources: Array<{ title: string; publisher: string; url: string | null; publishedAt: string | null }>;
      narratives: Array<{ publicId: string; title: string; status: string }>;
      passages: Array<{
        position: number;
        text: string;
        claim: { publicId: string; title: string; assessment: string | null } | null;
        sources: Array<{ title: string; publisher: string; url: string | null }>;
      }>;
      relatedArticles: Array<{ publicId: string; section: Publication["section"]; title: string; summary: string | null }>;
      corrections: Array<{ version: number; changedAt: string; summary: string }>;
    }> {
      const [sources, narratives, passages, passageSources, relatedArticles, corrections] = await Promise.all([
        d.execute<{ title: string; publisher: string; url: string | null; publishedAt: string | null }>(sql`
          SELECT e.title, s.name AS publisher, e.url, e.published_at::text AS "publishedAt"
          FROM publication_evidence pe
          JOIN evidence e ON e.id = pe.evidence_id
          JOIN source s ON s.id = e.source_id
          WHERE pe.publication_id = ${publicationId} AND e.data_class = 'public'
          ORDER BY coalesce(e.published_at, e.captured_at) DESC
        `),
        d.execute<{ publicId: string; title: string; status: string }>(sql`
          SELECT n.public_id AS "publicId", n.title, n.status
          FROM publication_narrative pn
          JOIN narrative n ON n.id = pn.narrative_id
          WHERE pn.publication_id = ${publicationId}
          ORDER BY n.updated_at DESC
        `),
        d.execute<{ id: string; position: number; text: string; claimPublicId: string | null; claimTitle: string | null; claimAssessment: string | null }>(sql`
          SELECT pp.id, pp.position, pp.text,
                 ii.public_id AS "claimPublicId", ii.title AS "claimTitle", ii.assessment AS "claimAssessment"
          FROM publication_passage pp
          LEFT JOIN information_item ii ON ii.id = pp.item_id
          WHERE pp.publication_id = ${publicationId}
          ORDER BY pp.position
        `),
        d.execute<{ passageId: string; title: string; publisher: string; url: string | null }>(sql`
          SELECT ppe.passage_id AS "passageId", e.title, s.name AS publisher, e.url
          FROM publication_passage_evidence ppe
          JOIN publication_passage pp ON pp.id = ppe.passage_id
          JOIN evidence e ON e.id = ppe.evidence_id
          JOIN source s ON s.id = e.source_id
          WHERE pp.publication_id = ${publicationId} AND e.data_class = 'public'
          ORDER BY pp.position, coalesce(e.published_at, e.captured_at) DESC
        `),
        d.execute<{ publicId: string; section: Publication["section"]; title: string; summary: string | null }>(sql`
          SELECT p.public_id AS "publicId", p.section, p.title, p.summary
          FROM publication_related pr
          JOIN publication p ON p.id = pr.related_publication_id
          WHERE pr.publication_id = ${publicationId}
            AND p.status IN ('published', 'updated')
          ORDER BY pr.position
        `),
        d.execute<{ version: number; changedAt: string; summary: string }>(sql`
          SELECT version, changed_at AS "changedAt", summary
          FROM public_publication_corrections(${publicationId})
          ORDER BY version DESC
        `),
      ]);
      return {
        sources: sources.rows,
        narratives: narratives.rows,
        passages: passages.rows.map((passage) => ({
          position: Number(passage.position),
          text: passage.text,
          claim: passage.claimPublicId && passage.claimTitle
            ? { publicId: passage.claimPublicId, title: passage.claimTitle, assessment: passage.claimAssessment }
            : null,
          sources: passageSources.rows
            .filter((source) => source.passageId === passage.id)
            .map((source) => ({
              title: source.title,
              publisher: source.publisher,
              url: source.url,
            })),
        })),
        relatedArticles: relatedArticles.rows,
        corrections: corrections.rows.map((entry) => ({ ...entry, version: Number(entry.version) })),
      };
    },
  };
}
