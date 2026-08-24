/**
 * Reports of suspected false information, submitted by the public.
 *
 * Brief §44. Worth restating because the design agent read it the other way:
 * these are **inbound submissions**, not generated PDF/CSV deliverables. A
 * member of the public sends a URL, some text, or a screenshot, and it moves
 * `received → triaged → investigating → linked_to_existing_item |
 * converted_to_item → closed | rejected`.
 *
 * This is the only table in the schema written by someone outside the
 * organisation, which drives two decisions:
 *
 *   - `reporter_email` is optional and nothing requires identifying oneself.
 *     Requiring identity on a misinformation report chills exactly the
 *     reports most worth having.
 *   - The submitted body is never rendered as HTML anywhere; it is stored as
 *     text and escaped at every surface. There is no `report.html` column and
 *     there should never be one.
 */

import { sql } from "drizzle-orm";
import { check, index, integer, pgTable, primaryKey, text, uuid } from "drizzle-orm/pg-core";
import { dataClass, reportStatus } from "./_enums";
import { appUser } from "./identity";
import { informationItem } from "./items";
import { createdAt, isSha256, nonBlank, primaryId, sha256Col, tsCol, updatedAt } from "./_shared";

export const report = pgTable(
  "report",
  {
    id: primaryId(),
    /** Short, URL-safe, given back to the reporter so they can follow it up
     *  without an account. */
    publicId: text("public_id").notNull().unique(),

    /** At least one of `url` or `body` — a report that says nothing is not a
     *  report. Enforced below. */
    url: text("url"),
    body: text("body"),

    reporterEmail: text("reporter_email"),
    /** What the reporter said about themselves, if anything. Never trusted,
     *  never used for authorization. */
    reporterNote: text("reporter_note"),

    status: reportStatus("status").notNull().default("received"),
    /** Required for `closed` and `rejected` — see the CHECK. Same argument as
     *  a rejected information item: an unexplained refusal is not a record. */
    resolutionNote: text("resolution_note"),

    /** Set when the report becomes, or is linked to, an item. */
    itemId: uuid("item_id").references(() => informationItem.id),

    assignedTo: uuid("assigned_to").references(() => appUser.id),

    /** Submissions are `internal` by default: they can contain personal
     *  details a reporter volunteered, and they have had no review. */
    dataClass: dataClass("data_class").notNull().default("internal"),

    /** Coarse, for rate limiting and abuse triage. Not an identity. */
    submittedFromHash: sha256Col("submitted_from_hash"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("report_by_status").on(t.status, t.createdAt),
    index("report_by_item").on(t.itemId),
    isSha256(t.submittedFromHash, "report_submitter_hash_is_sha256"),
    check(
      "report_says_something",
      sql`${t.url} IS NOT NULL OR length(btrim(coalesce(${t.body}, ''))) > 0`,
    ),
    check(
      "resolved_report_states_why",
      sql`${t.status} NOT IN ('closed', 'rejected')
          OR length(btrim(coalesce(${t.resolutionNote}, ''))) > 0`,
    ),
    /* A report that became an item has to name it — otherwise the status
       claims a link the data cannot show. */
    check(
      "converted_report_names_its_item",
      sql`${t.status} NOT IN ('linked_to_existing_item', 'converted_to_item')
          OR ${t.itemId} IS NOT NULL`,
    ),
  ],
);

/**
 * An attachment. Screenshots, mostly.
 *
 * Uploaded content from the public is the least trustworthy input the system
 * takes, so `content_type` is recorded as *declared* and is never what the
 * file is served as — nothing serves these to a browser directly.
 */
export const reportFile = pgTable(
  "report_file",
  {
    id: primaryId(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => report.id, { onDelete: "cascade" }),
    blobUrl: text("blob_url").notNull(),
    /** What the uploader claimed it was. Advisory only. */
    declaredContentType: text("declared_content_type"),
    byteSize: integer("byte_size"),
    integrityHash: sha256Col("integrity_hash"),
    createdAt: createdAt(),
  },
  (t) => [
    index("report_file_by_report").on(t.reportId),
    nonBlank(t.blobUrl, "report_file_has_a_blob_url"),
    isSha256(t.integrityHash, "report_file_hash_is_sha256"),
    check("report_file_size_is_sane", sql`${t.byteSize} IS NULL OR ${t.byteSize} > 0`),
  ],
);

/**
 * Every status change on a report, append-only.
 *
 * Same shape and same reason as `item_status_transition`: written by the
 * trigger rather than the service, so the trail cannot be skipped by
 * forgetting to call something.
 */
export const reportStatusHistory = pgTable(
  "report_status_history",
  {
    id: primaryId(),
    reportId: uuid("report_id")
      .notNull()
      .references(() => report.id, { onDelete: "cascade" }),
    fromStatus: reportStatus("from_status"),
    toStatus: reportStatus("to_status").notNull(),
    actorUserId: uuid("actor_user_id").references(() => appUser.id),
    actorLabel: text("actor_label").notNull(),
    note: text("note"),
    occurredAt: createdAt(),
  },
  (t) => [
    index("report_status_history_by_report").on(t.reportId, t.occurredAt),
    nonBlank(t.actorLabel, "report_status_history_names_an_actor"),
  ],
);

/**
 * Fixed-window rate limiting, in the database.
 *
 * In-memory counters do not work on Vercel: instances are per-region and
 * recycled, so a limit enforced in process memory is a limit per lambda, which
 * is no limit at all. A row per (bucket, window) is one round trip and is
 * correct across every instance.
 *
 * `bucket` is a hashed subject — never a raw IP, so the table is not itself a
 * log of who visited.
 */
export const rateLimit = pgTable(
  "rate_limit",
  {
    bucket: text("bucket").notNull(),
    windowStart: tsCol("window_start").notNull(),
    count: integer("count").notNull().default(0),
  },
  (t) => [
    primaryKey({ columns: [t.bucket, t.windowStart] }),
    index("rate_limit_window").on(t.windowStart),
    nonBlank(t.bucket, "rate_limit_has_a_bucket"),
  ],
);

export type Report = typeof report.$inferSelect;
export type NewReport = typeof report.$inferInsert;
export type ReportFile = typeof reportFile.$inferSelect;
export type ReportStatusHistoryRow = typeof reportStatusHistory.$inferSelect;
