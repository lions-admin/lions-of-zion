import "server-only";

/**
 * Persistence for editorial media. Owns SQL; owns no policy.
 *
 * The two directions this file serves are deliberately different shapes:
 *
 *   - **Write** (`insertMedia`, `attachToPublication`) is called once inside
 *     the publish transaction, after the bytes are already stored. It is
 *     idempotent on `content_hash`, so the same picture arriving twice — a
 *     retried briefing run, two articles illustrated from one photograph — is
 *     one row and one blob, not two.
 *   - **Read** (`heroMediaByPublicationIds`) is called on the public list and
 *     detail paths, so it takes every publication id at once. A per-row read
 *     here would be N+1 on the news hub and on the homepage's own resolution.
 *
 * Rights are filtered *twice* on purpose. The `app_public` RLS policy on
 * `editorial_media` already hides anything not cleared — that is the boundary
 * a future read path cannot forget — and the projection filters again by
 * surface, because clearance for the article page is not clearance for the
 * homepage.
 */

import { sql } from "drizzle-orm";
import { editorialMedia } from "@/server/db/schema";
import type { EditorialMediaRow } from "@/server/db/schema";
import { editorialMediaSchema, type EditorialMedia } from "@/server/contracts/editorial-media";

/* Structural typing, matching `publications/repo.ts`: the same repository runs
   against the Neon pool in production and PGlite in tests. */
type AnyDb = {
  insert: (t: unknown) => { values: (v: unknown) => { returning: () => Promise<EditorialMediaRow[]> } };
  execute: <T>(query: unknown) => Promise<{ rows: T[] }>;
};

/** Everything the ingest path has established about one asset. */
export type EditorialMediaDraft = {
  src: string;
  width: number;
  height: number;
  alt: string;
  caption: string | null;
  credit: string;
  sourceUrl: string | null;
  originUrl: string | null;
  disclosure: string | null;
  role: EditorialMedia["role"];
  focalPoint: { x: number; y: number };
  sensitivity: EditorialMedia["sensitivity"];
  rights: {
    status: EditorialMedia["rights"]["status"];
    basis: string;
    reference: string;
    clearedAt: string | null;
    surfaces: EditorialMedia["rights"]["surfaces"];
  };
  contentHash: string | null;
  byteSize: number | null;
  contentType: string | null;
  generated: boolean;
  provenance: Record<string, unknown> | null;
};

/**
 * A stored row as the public contract sees it.
 *
 * The row's own columns are flat (`rights_status`, `focal_x`) because that is
 * what a CHECK constraint can read; the contract is nested because that is
 * what a component renders. This function is the only place the two shapes
 * meet, and it parses rather than casts — a row written before a field
 * existed, or by hand in a console, is refused here rather than rendered.
 */
export function toEditorialMedia(row: EditorialMediaRow): EditorialMedia | null {
  const parsed = editorialMediaSchema.safeParse({
    id: row.id,
    src: row.src,
    width: row.width,
    height: row.height,
    alt: row.alt,
    credit: row.credit,
    sourceUrl: row.sourceUrl ?? undefined,
    caption: row.caption ?? undefined,
    disclosure: row.disclosure ?? undefined,
    role: row.role,
    focalPoint: { x: row.focalX, y: row.focalY },
    sensitivity: row.sensitivity,
    rights: {
      status: row.rightsStatus,
      basis: row.rightsBasis,
      reference: row.rightsReference,
      clearedAt: row.rightsClearedAt ?? undefined,
      surfaces: row.rightsSurfaces,
    },
  });
  if (!parsed.success) {
    console.warn(`[media] editorial_media ${row.id} does not satisfy the contract and will not be rendered.`);
    return null;
  }
  return parsed.data;
}

/** The insert shape, from a draft. Kept beside `toEditorialMedia` so the two
 *  directions are edited together. */
function toRow(draft: EditorialMediaDraft) {
  return {
    src: draft.src,
    width: draft.width,
    height: draft.height,
    alt: draft.alt,
    caption: draft.caption,
    credit: draft.credit,
    sourceUrl: draft.sourceUrl,
    originUrl: draft.originUrl,
    disclosure: draft.disclosure,
    role: draft.role,
    focalX: Math.round(draft.focalPoint.x),
    focalY: Math.round(draft.focalPoint.y),
    sensitivity: draft.sensitivity,
    rightsStatus: draft.rights.status,
    rightsBasis: draft.rights.basis,
    rightsReference: draft.rights.reference,
    rightsClearedAt: draft.rights.clearedAt,
    rightsSurfaces: draft.rights.surfaces,
    contentHash: draft.contentHash,
    byteSize: draft.byteSize,
    contentType: draft.contentType,
    generated: draft.generated,
    provenance: draft.provenance,
  };
}

export function mediaRepo(db: unknown) {
  const d = db as AnyDb;

  return {
    /**
     * Insert one asset, or return the existing row with the same bytes.
     *
     * `ON CONFLICT (content_hash) DO NOTHING` plus a follow-up read rather
     * than `DO UPDATE`: an asset's rights are a record of a decision someone
     * made, and a later submission repeating the same photograph must not
     * silently rewrite the clearance already on file.
     */
    async insertMedia(draft: EditorialMediaDraft): Promise<EditorialMediaRow> {
      if (draft.contentHash) {
        const existing = await d.execute<EditorialMediaRow>(sql`
          SELECT * FROM editorial_media WHERE content_hash = ${draft.contentHash} LIMIT 1
        `);
        if (existing.rows[0]) return normalizeRow(existing.rows[0]);
      }
      const inserted = await d.insert(editorialMedia).values(toRow(draft)).returning();
      return inserted[0]!;
    },

    /**
     * Give a publication its hero image.
     *
     * `ON CONFLICT DO NOTHING` on the (publication, placement, position) key:
     * promoting a paused draft resends the same edition, and re-attaching the
     * same hero must be a no-op rather than a constraint violation.
     */
    async attachToPublication(
      publicationId: string,
      mediaId: string,
      placement: "hero" | "inline" = "hero",
      position = 1,
    ): Promise<void> {
      await d.execute(sql`
        INSERT INTO publication_media (publication_id, media_id, placement, position)
        VALUES (${publicationId}, ${mediaId}, ${placement}, ${position})
        ON CONFLICT (publication_id, placement, position) DO NOTHING
      `);
    },

    /**
     * Hero media for many publications at once, keyed by publication id.
     *
     * Rows that fail the contract, or whose rights were withdrawn, are simply
     * absent from the map — the caller renders no image, which is the correct
     * outcome and never an error.
     */
    async heroMediaByPublicationIds(publicationIds: readonly string[]): Promise<Map<string, EditorialMedia>> {
      const result = new Map<string, EditorialMedia>();
      if (!publicationIds.length) return result;
      const rows = await d.execute<EditorialMediaRow & { publicationId: string }>(sql`
        SELECT em.*, pm.publication_id AS "publicationId"
        FROM publication_media pm
        JOIN editorial_media em ON em.id = pm.media_id
        WHERE pm.placement = 'hero'
          AND pm.publication_id IN (${sql.join(publicationIds.map((id) => sql`${id}`), sql`, `)})
      `);
      for (const row of rows.rows) {
        const media = toEditorialMedia(normalizeRow(row));
        if (media) result.set(row.publicationId, media);
      }
      return result;
    },

    /** One publication's hero, or null. */
    async heroMedia(publicationId: string): Promise<EditorialMedia | null> {
      const rows = await d.execute<EditorialMediaRow>(sql`
        SELECT em.* FROM publication_media pm
        JOIN editorial_media em ON em.id = pm.media_id
        WHERE pm.publication_id = ${publicationId} AND pm.placement = 'hero'
        LIMIT 1
      `);
      return rows.rows[0] ? toEditorialMedia(normalizeRow(rows.rows[0])) : null;
    },

    /** Detach an asset from a publication without deleting the asset. */
    async detach(publicationId: string, placement: "hero" | "inline" = "hero"): Promise<void> {
      await d.execute(sql`
        DELETE FROM publication_media WHERE publication_id = ${publicationId} AND placement = ${placement}
      `);
    },

    async byContentHash(contentHash: string): Promise<EditorialMediaRow | undefined> {
      const rows = await d.execute<EditorialMediaRow>(sql`
        SELECT * FROM editorial_media WHERE content_hash = ${contentHash} LIMIT 1
      `);
      return rows.rows[0] ? normalizeRow(rows.rows[0]) : undefined;
    },
  };
}

/**
 * Raw `execute` returns snake_case keys; the drizzle select returns camelCase.
 * Both paths land here so `toEditorialMedia` sees one shape.
 */
function normalizeRow(row: EditorialMediaRow | Record<string, unknown>): EditorialMediaRow {
  const raw = row as Record<string, unknown>;
  const pick = <T>(camel: string, snake: string): T => (raw[camel] ?? raw[snake]) as T;
  return {
    id: pick<string>("id", "id"),
    src: pick<string>("src", "src"),
    width: Number(pick<number>("width", "width")),
    height: Number(pick<number>("height", "height")),
    alt: pick<string>("alt", "alt"),
    caption: pick<string | null>("caption", "caption") ?? null,
    credit: pick<string>("credit", "credit"),
    sourceUrl: pick<string | null>("sourceUrl", "source_url") ?? null,
    originUrl: pick<string | null>("originUrl", "origin_url") ?? null,
    disclosure: pick<string | null>("disclosure", "disclosure") ?? null,
    role: pick<string>("role", "role"),
    focalX: Number(pick<number>("focalX", "focal_x") ?? 50),
    focalY: Number(pick<number>("focalY", "focal_y") ?? 50),
    sensitivity: pick<string>("sensitivity", "sensitivity"),
    rightsStatus: pick<string>("rightsStatus", "rights_status"),
    rightsBasis: pick<string>("rightsBasis", "rights_basis"),
    rightsReference: pick<string>("rightsReference", "rights_reference"),
    rightsClearedAt: pick<string | null>("rightsClearedAt", "rights_cleared_at") ?? null,
    rightsSurfaces: (pick<string[]>("rightsSurfaces", "rights_surfaces") ?? []) as string[],
    contentHash: pick<string | null>("contentHash", "content_hash") ?? null,
    byteSize: pick<number | null>("byteSize", "byte_size") ?? null,
    contentType: pick<string | null>("contentType", "content_type") ?? null,
    generated: Boolean(pick<boolean>("generated", "generated")),
    provenance: pick<unknown>("provenance", "provenance") ?? null,
    createdAt: pick<Date>("createdAt", "created_at"),
    updatedAt: pick<Date>("updatedAt", "updated_at"),
  } as EditorialMediaRow;
}

/** Convenience for callers that only need the read half against a live db. */
export async function heroMediaFor(db: unknown, publicationIds: readonly string[]) {
  return mediaRepo(db).heroMediaByPublicationIds(publicationIds);
}
