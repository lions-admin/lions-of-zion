/**
 * A piece of evidence, and its chain of custody.
 *
 * `evidence` is a versioned entity — corrections to its title or excerpt go
 * through `recordVersion()`, same as an information item. `evidence_provenance`
 * is a different thing entirely: an append-only log of what was done to
 * establish or re-establish trust in this specific row (captured, archived,
 * hash-verified), which is not an edit and must never become one.
 *
 * The link to `information_item` (`item_evidence`, with its `supports` /
 * `contradicts` relation) is Phase 4. This phase only ships evidence existing
 * and being traceable to where it came from.
 */

import { sql } from "drizzle-orm";
import { check, index, integer, jsonb, pgTable, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { appUser } from "./identity";
import { dataClass, evidenceKind } from "./_enums";
import { source, sourceFetch } from "./sources";
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

export const evidence = pgTable(
  "evidence",
  {
    id: primaryId(),
    sourceId: uuid("source_id")
      .notNull()
      .references(() => source.id),
    /** Which fetch produced this row. Null for evidence entered by hand. */
    sourceFetchId: uuid("source_fetch_id").references(() => sourceFetch.id),
    kind: evidenceKind("kind").notNull(),
    dataClass: dataClass("data_class").notNull().default("public"),
    title: text("title").notNull(),
    excerpt: text("excerpt"),
    /** The connector's own id for this item (an RSS guid, a post id) — how a
     *  re-fetch recognises "already have this" instead of duplicating it. */
    externalId: text("external_id"),
    /** URL returned by the discovery layer, retained for audit only. */
    discoveryUrl: text("discovery_url"),
    /** Direct normalized publisher URL used for deduplication and readers. */
    canonicalUrl: text("canonical_url"),
    publisherDomain: text("publisher_domain"),
    url: text("url"),
    blobUrl: text("blob_url"),
    language: text("language").notNull(),
    capturedAt: tsCol("captured_at").notNull().defaultNow(),
    /** When the source claims the underlying content was published, which is
     *  not necessarily when we captured it. */
    publishedAt: tsCol("published_at"),
    integrityHash: sha256Col("integrity_hash"),
    normalizedContentHash: sha256Col("normalized_content_hash"),
    usableTextLength: integer("usable_text_length").notNull().default(0),
    retrievalStatus: text("retrieval_status").notNull().default("discovered"),
    accessState: text("access_state").notNull().default("open"),
    contentType: text("content_type"),
    discoveryMetadata: jsonb("discovery_metadata"),
    retentionClass: text("retention_class").notNull().default("metadata_excerpt"),
    currentVersionId: uuid("current_version_id").references(() => entityVersion.id),
    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    index("evidence_by_source").on(t.sourceId, t.capturedAt),
    index("evidence_by_captured_at").on(t.capturedAt),
    index("evidence_by_canonical_url").on(t.canonicalUrl),
    index("evidence_by_normalized_content_hash").on(t.normalizedContentHash),
    index("evidence_by_published_at").on(t.publishedAt),
    index("evidence_by_retrieval_status").on(t.retrievalStatus),
    uniqueIndex("evidence_canonical_url_is_unique")
      .on(t.canonicalUrl)
      .where(sql`${t.canonicalUrl} IS NOT NULL`),
    uniqueIndex("evidence_dedup_by_source")
      .on(t.sourceId, t.externalId)
      .where(sql`${t.externalId} IS NOT NULL`),
    nonBlank(t.title, "evidence_is_titled"),
    isLanguage(t.language, "evidence_language_is_a_tag"),
    isSha256(t.integrityHash, "evidence_integrity_hash_is_sha256"),
    isSha256(t.normalizedContentHash, "evidence_normalized_hash_is_sha256"),
    check("evidence_usable_text_length_is_valid", sql`${t.usableTextLength} >= 0`),
    check(
      "evidence_retrieval_status_is_valid",
      sql`${t.retrievalStatus} IN ('discovered', 'fetched', 'partial', 'failed')`,
    ),
    check(
      "evidence_access_state_is_valid",
      sql`${t.accessState} IN ('open', 'blocked', 'login_required', 'paywalled', 'unavailable')`,
    ),
    check(
      "evidence_retention_class_is_valid",
      sql`${t.retentionClass} IN ('metadata_only', 'metadata_excerpt', 'raw_permitted')`,
    ),
    /* Restricted and secret evidence may not carry a storage or source URL.
       Raw briefing captures are private as an additional boundary, but this
       CHECK remains the classification rule even if storage policy drifts. */
    check(
      "restricted_material_is_not_linked",
      sql`${t.dataClass} NOT IN ('restricted', 'secret')
          OR (${t.url} IS NULL AND ${t.blobUrl} IS NULL)`,
    ),
  ],
);

export const evidenceProvenance = pgTable(
  "evidence_provenance",
  {
    id: primaryId(),
    evidenceId: uuid("evidence_id")
      .notNull()
      .references(() => evidence.id, { onDelete: "cascade" }),
    occurredAt: createdAt(),
    /** Free text rather than an enum: the vocabulary of "how we came to trust
     *  this" grows with every new evidence kind and connector, and a fixed
     *  list would be a migration every time it does. */
    action: text("action").notNull(),
    actorUserId: uuid("actor_user_id").references(() => appUser.id),
    actorLabel: text("actor_label").notNull(),
    detail: jsonb("detail"),
    integrityHash: sha256Col("integrity_hash"),
  },
  (t) => [
    index("evidence_provenance_by_evidence").on(t.evidenceId, t.occurredAt),
    nonBlank(t.action, "evidence_provenance_names_an_action"),
    nonBlank(t.actorLabel, "evidence_provenance_names_an_actor"),
    isSha256(t.integrityHash, "evidence_provenance_hash_is_sha256"),
  ],
);

export type Evidence = typeof evidence.$inferSelect;
export type NewEvidence = typeof evidence.$inferInsert;
export type EvidenceProvenance = typeof evidenceProvenance.$inferSelect;
