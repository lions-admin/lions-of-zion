/**
 * Where evidence comes from, and the record of trying to fetch it.
 *
 * `source_family` is the addition to the brief that matters most: nothing
 * distinguishes five outlets republishing one wire report from five
 * independent corroborations unless independence is counted in families
 * rather than URLs. A `source` always belongs to exactly one family.
 *
 * `source_fetch` is append-only and insert-only: a connector run produces
 * exactly one row, written once it is known how the attempt ended. There is
 * no in-progress row to update, which is what lets the append-only trigger
 * cover it with no exception carved out for "the fetch that is still running".
 */

import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  index,
  integer,
  jsonb,
  pgTable,
  text,
  uuid,
} from "drizzle-orm/pg-core";
import { fetchStatus, sourceKind } from "./_enums";
import { entityVersion } from "./versioning";
import {
  createdAt,
  isLanguage,
  isSha256,
  nonBlank,
  primaryId,
  sha256Col,
  tsCol,
  updatedAt,
} from "./_shared";

export const sourceFamily = pgTable(
  "source_family",
  {
    id: primaryId(),
    slug: text("slug").notNull().unique(),
    label: text("label").notNull(),
    description: text("description"),
    createdAt: createdAt(),
  },
  (t) => [nonBlank(t.label, "source_family_is_labelled")],
);

export const source = pgTable(
  "source",
  {
    id: primaryId(),
    sourceFamilyId: uuid("source_family_id")
      .notNull()
      .references(() => sourceFamily.id),
    kind: sourceKind("kind").notNull(),
    slug: text("slug").notNull().unique(),
    name: text("name").notNull(),
    homepageUrl: text("homepage_url"),
    /** The connector endpoint: a feed URL for `rss`, a base URL for `api`. Not
     *  required by every kind — `manual` and `partner` sources have none — so
     *  this is enforced only for the kinds where it is unambiguous. */
    feedUrl: text("feed_url"),
    language: text("language").notNull(),
    country: text("country"),
    active: boolean("active").notNull().default(true),
    /** Connector-specific settings (poll interval, auth hints). Never
     *  credentials — those belong in the environment, not a row a query can
     *  return. */
    config: jsonb("config"),
    currentVersionId: uuid("current_version_id").references(() => entityVersion.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("source_by_family").on(t.sourceFamilyId),
    index("source_by_kind_active").on(t.kind, t.active),
    nonBlank(t.name, "source_is_named"),
    isLanguage(t.language, "source_language_is_a_tag"),
    check(
      "polled_sources_have_a_feed_url",
      sql`${t.kind} NOT IN ('rss', 'api') OR ${t.feedUrl} IS NOT NULL`,
    ),
  ],
);

export const sourceFetch = pgTable(
  "source_fetch",
  {
    id: primaryId(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => source.id, { onDelete: "cascade" }),
    status: fetchStatus("status").notNull(),
    startedAt: tsCol("started_at").notNull(),
    finishedAt: tsCol("finished_at").notNull(),
    httpStatus: integer("http_status"),
    itemsSeen: integer("items_seen").notNull().default(0),
    itemsNew: integer("items_new").notNull().default(0),
    errorMessage: text("error_message"),
    searchQuery: text("search_query"),
    /** Pointer to the raw fetched bytes in Blob, stored once per fetch rather
     *  than once per item — a feed's raw body is one object, not N. */
    rawBlobUrl: text("raw_blob_url"),
    rawContentHash: sha256Col("raw_content_hash"),
    createdAt: createdAt(),
  },
  (t) => [
    index("source_fetch_by_source").on(t.sourceId, t.startedAt),
    isSha256(t.rawContentHash, "source_fetch_raw_hash_is_sha256"),
    check(
      "failed_fetch_states_why",
      sql`${t.status} <> 'failed' OR length(btrim(coalesce(${t.errorMessage}, ''))) > 0`,
    ),
  ],
);

export type SourceFamily = typeof sourceFamily.$inferSelect;
export type Source = typeof source.$inferSelect;
export type NewSource = typeof source.$inferInsert;
export type SourceFetch = typeof sourceFetch.$inferSelect;
export type NewSourceFetch = typeof sourceFetch.$inferInsert;
