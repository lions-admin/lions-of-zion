/**
 * Editorial images, as rows rather than as a checked-in registry.
 *
 * `content-packages/homepage/media.json` still holds the hand-curated assets
 * for the static site — Our Heroes, Israel's Story, the October 7 archive,
 * the Fake Resistance case files. That registry works because a human adds a
 * mapping in the same commit as the content it illustrates.
 *
 * A publication that arrives at 07:00 from an external composer has no such
 * commit. Its picture has to be part of the publication, so this pair of
 * tables carries what the registry carried: the asset and its rights on
 * `editorial_media`, and which publication wears it on `publication_media`.
 *
 * Two tables rather than a dozen image columns on `publication`, for the same
 * reason `homepage_feature` is not three columns on `publication`: an asset
 * outlives and is reusable across the records that show it, its rights change
 * independently of any article, and a second placement later is a row, not a
 * migration.
 *
 * ## What is enforced here rather than in TypeScript
 *
 * `rights_status = 'cleared'` requires a clearance date, and `src` must be
 * either a local path or an object in this project's own public Blob store.
 * Both are the sort of rule that gets bypassed by whichever write path is
 * added next, so they are CHECKs. `server/contracts/editorial-media.ts`
 * states the same two in Zod; they have to agree.
 */

import { sql } from "drizzle-orm";
import { boolean, check, date, index, integer, jsonb, pgTable, primaryKey, text, uniqueIndex, uuid } from "drizzle-orm/pg-core";
import { publication } from "./publications";
import { createdAt, nonBlank, primaryId, sha256Col, updatedAt } from "./_shared";

export const editorialMedia = pgTable(
  "editorial_media",
  {
    id: primaryId(),

    /** A local `/images/…` path, or a public Blob object URL we wrote. */
    src: text("src").notNull(),
    width: integer("width").notNull(),
    height: integer("height").notNull(),

    alt: text("alt").notNull(),
    caption: text("caption"),
    credit: text("credit").notNull(),
    /** The page the image was found on — provenance, and the attribution link. */
    sourceUrl: text("source_url"),
    /** The image URL actually fetched. Kept for provenance; never rendered. */
    originUrl: text("origin_url"),
    /** What the image is *not*: "Context image — not incident documentation". */
    disclosure: text("disclosure"),

    role: text("role").notNull(),
    /** Percentages. Integers because every asset on file uses whole numbers. */
    focalX: integer("focal_x").notNull().default(50),
    focalY: integer("focal_y").notNull().default(50),
    sensitivity: text("sensitivity").notNull().default("unknown"),

    rightsStatus: text("rights_status").notNull().default("unknown"),
    rightsBasis: text("rights_basis").notNull(),
    rightsReference: text("rights_reference").notNull(),
    rightsClearedAt: date("rights_cleared_at"),
    /** Subset of `homepage`, `article`. Empty means "nowhere public yet". */
    rightsSurfaces: text("rights_surfaces").array().notNull().default(sql`'{}'::text[]`),

    /** sha256 of the stored bytes. The dedup key, and the retry key. */
    contentHash: sha256Col("content_hash"),
    byteSize: integer("byte_size"),
    contentType: text("content_type"),

    /** True for an image made for the record because none existed. */
    generated: boolean("generated").notNull().default(false),
    /** How this asset came to exist: composer, run id, fetch time, model. */
    provenance: jsonb("provenance"),

    createdAt: createdAt(),
    updatedAt: updatedAt(),
  },
  (t) => [
    /* The same picture fetched twice is one asset. This is also what makes a
       retried briefing run idempotent without a second lookup path. */
    uniqueIndex("editorial_media_content_is_unique")
      .on(t.contentHash)
      .where(sql`${t.contentHash} IS NOT NULL`),
    index("editorial_media_by_rights").on(t.rightsStatus, t.createdAt),
    nonBlank(t.alt, "editorial_media_has_alt_text"),
    nonBlank(t.credit, "editorial_media_has_credit"),
    nonBlank(t.rightsBasis, "editorial_media_has_rights_basis"),
    nonBlank(t.rightsReference, "editorial_media_has_rights_reference"),
    check("editorial_media_has_positive_dimensions", sql`${t.width} > 0 AND ${t.height} > 0`),
    check("editorial_media_focal_point_is_a_percentage",
      sql`${t.focalX} BETWEEN 0 AND 100 AND ${t.focalY} BETWEEN 0 AND 100`),
    check("editorial_media_role_is_known",
      sql`${t.role} IN ('documentation', 'portrait', 'archival-context', 'editorial-illustration', 'safe-cover')`),
    check("editorial_media_sensitivity_is_known",
      sql`${t.sensitivity} IN ('safe', 'sensitive', 'unknown')`),
    check("editorial_media_rights_status_is_known",
      sql`${t.rightsStatus} IN ('cleared', 'unknown', 'withdrawn')`),
    check("editorial_media_surfaces_are_known",
      sql`${t.rightsSurfaces} <@ ARRAY['homepage', 'article']::text[]`),
    /* Clearance without a date is an assertion nobody can check later. */
    check("editorial_media_cleared_media_is_dated",
      sql`${t.rightsStatus} <> 'cleared' OR ${t.rightsClearedAt} IS NOT NULL`),
    /* We serve our own copies. A publisher's CDN is not an image host we get
       to borrow, and a hotlinked file can be swapped after publication. */
    check("editorial_media_is_self_hosted",
      sql`${t.src} ~ '^/[^/]' OR ${t.src} ~ '^https://[a-z0-9-]+\\.public\\.blob\\.vercel-storage\\.com/'`),
    /* A manufactured image may not wear a documentary role. */
    check("editorial_media_generated_is_an_illustration",
      sql`${t.generated} = false OR ${t.role} = 'editorial-illustration'`),
  ],
);

/**
 * Which asset a publication wears, and where.
 *
 * `hero` is the only placement in use. The key is (publication, placement,
 * position) rather than (publication, media) so a second hero can never exist
 * and an inline gallery is additive later.
 */
export const publicationMedia = pgTable(
  "publication_media",
  {
    publicationId: uuid("publication_id").notNull().references(() => publication.id, { onDelete: "cascade" }),
    mediaId: uuid("media_id").notNull().references(() => editorialMedia.id, { onDelete: "restrict" }),
    placement: text("placement").notNull().default("hero"),
    position: integer("position").notNull().default(1),
    createdAt: createdAt(),
  },
  (t) => [
    primaryKey({ columns: [t.publicationId, t.placement, t.position], name: "publication_media_pk" }),
    index("publication_media_by_media").on(t.mediaId),
    check("publication_media_placement_is_known", sql`${t.placement} IN ('hero', 'inline')`),
    check("publication_media_position_is_positive", sql`${t.position} >= 1`),
    /* One hero, decided at the database rather than by whoever writes next. */
    check("publication_media_hero_is_singular", sql`${t.placement} <> 'hero' OR ${t.position} = 1`),
  ],
);

export type EditorialMediaRow = typeof editorialMedia.$inferSelect;
export type NewEditorialMediaRow = typeof editorialMedia.$inferInsert;
export type PublicationMediaRow = typeof publicationMedia.$inferSelect;
