/**
 * The idempotency ledger for externally composed Daily Brief editions.
 *
 * One row per accepted submission to
 * `POST /api/internal/briefing/external-publish`. The row is inserted *inside*
 * the publish transaction, so the unique index on `run_id` is the concurrency
 * control as well as the replay check: a second request carrying the same
 * `run_id` blocks on the index until the first commits, then reads the stored
 * result instead of composing a second edition.
 *
 * The stored `result` is what a replay is answered with. It is kept here
 * rather than recomputed because the honest answer to "did my package
 * publish?" is the ids the *first* run created — re-deriving them from
 * `publication` would report whatever the latest edition happens to be, which
 * is a different question.
 *
 * `status` is `'published'` when the edition went live, or `'draft'` when it
 * was materialised and quality-checked but automatic publication was paused
 * (`briefing_control.automatic_publication_paused`) — the same kill switch
 * the internal pipeline honours. See `ExternalBriefingPublishStatus` in
 * `server/contracts/external-briefing.ts`.
 *
 * `package_hash` exists to catch the dangerous replay: the same `run_id`
 * carrying a *different* edition. That is a caller bug (a reused run id across
 * two compositions), and answering it with the first run's ids would tell the
 * caller its new content is live when it is not. The service refuses it.
 */

import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, uuid } from "drizzle-orm/pg-core";
import { briefingRun } from "./publications";
import { createdAt, isSha256, nonBlank, primaryId, sha256Col } from "./_shared";

export const externalBriefingSubmission = pgTable(
  "external_briefing_submission",
  {
    id: primaryId(),
    /** The caller's own submission identity. Unique — this is the whole of
     * requirement 6. Text, not uuid: the natural value upstream is
     * `${run_id}-${run_attempt}`. */
    runId: text("run_id").notNull().unique(),
    localDate: text("local_date").notNull(),
    contractVersion: text("contract_version").notNull(),
    /** Free-text label for the composing system. Audit only, never authz. */
    composer: text("composer").notNull(),
    /** sha256 of the canonical package body. Distinguishes a true replay from
     * a reused run id carrying different content. */
    packageHash: sha256Col("package_hash").notNull(),
    /** The `briefing_run` row whose quality checks gate this edition. */
    briefingRunId: uuid("briefing_run_id").references(() => briefingRun.id, { onDelete: "set null" }),
    status: text("status").notNull(),
    evidenceCreated: integer("evidence_created").notNull().default(0),
    /** The `ExternalBriefingPublishResult` returned to the first caller, and
     * replayed verbatim to every later one. */
    result: jsonb("result").notNull(),
    createdAt: createdAt(),
  },
  (t) => [
    index("external_briefing_submission_by_date").on(t.localDate, t.createdAt),
    check("external_briefing_submission_status_is_known", sql`${t.status} IN ('published', 'draft')`),
    isSha256(t.packageHash, "external_briefing_submission_hash_is_sha256"),
    nonBlank(t.runId, "external_briefing_submission_has_run_id"),
    nonBlank(t.localDate, "external_briefing_submission_has_local_date"),
    nonBlank(t.contractVersion, "external_briefing_submission_has_contract_version"),
    nonBlank(t.composer, "external_briefing_submission_has_composer"),
  ],
);

export type ExternalBriefingSubmission = typeof externalBriefingSubmission.$inferSelect;
export type NewExternalBriefingSubmission = typeof externalBriefingSubmission.$inferInsert;
