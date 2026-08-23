/**
 * Column shapes repeated across the schema.
 *
 * Two rules encoded here rather than restated forty times:
 *
 *   - Timestamps are always `timestamptz`. A `timestamp` column on a platform
 *     that reasons about when something was published, in three time zones,
 *     is a bug waiting for October.
 *   - A field that carries reasoning is `not null` AND non-blank. An empty
 *     `known_gaps` is an evasion, not a value, and the database is the only
 *     layer that can refuse it on every path.
 */

import { sql } from "drizzle-orm";
import { check, text, timestamp, uuid } from "drizzle-orm/pg-core";
import type { AnyPgColumn } from "drizzle-orm/pg-core";

export const primaryId = () => uuid("id").primaryKey().default(sql`gen_random_uuid()`);

export const createdAt = () => timestamp("created_at", { withTimezone: true }).notNull().defaultNow();
export const updatedAt = () => timestamp("updated_at", { withTimezone: true }).notNull().defaultNow();
export const tsCol = (name: string) => timestamp(name, { withTimezone: true });

/** sha256, lowercase hex. Written by the application, never generated —
 *  `convert_to()` is STABLE, so it cannot appear in a generated column. */
export const sha256Col = (name: string) => text(name);
export const isSha256 = (col: AnyPgColumn, name: string) =>
  check(name, sql`${col} IS NULL OR ${col} ~ '^[a-f0-9]{64}$'`);

/** A reasoning field that may not be whitespace. */
export const nonBlank = (col: AnyPgColumn, name: string) =>
  check(name, sql`length(btrim(${col})) > 0`);

/** BCP-47-ish. Loose on the subtag, strict on the shape. */
export const isLanguage = (col: AnyPgColumn, name: string) =>
  check(name, sql`${col} ~ '^[a-z]{2}(-[A-Za-z0-9-]+)*$'`);
