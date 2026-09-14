import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

/**
 * The measurement warehouse's RLS policies, asserted from the migration text
 * rather than from a live database — because a live database is exactly where
 * this class of bug hides.
 *
 * On 2026-09-14 every public visit was being dropped in Production. Migration
 * 0067 gave `app_public` a SELECT *grant* and INSERT/UPDATE *policies* on the
 * measurement tables, but no SELECT *policy*. Under RLS a grant without a
 * policy shows the role nothing, and `INSERT ... ON CONFLICT` must read the
 * conflicting row through the arbiter index before it can choose between
 * inserting and updating — so the upsert was refused with
 * `42501 new row violates row-level security policy` even when no row
 * conflicted, and even for `ON CONFLICT DO NOTHING`. `upsertVisitor` is the
 * first write in the collect path, so the whole request failed.
 *
 * Nothing caught it for the same reason in every environment: RLS on these
 * tables is enabled but not forced, and a table's owner bypasses non-forced
 * RLS. The PGlite harness and a local database both connect as the owner, so
 * the upsert takes the bypass and passes. Writing this as a runtime test would
 * therefore reproduce the blind spot instead of closing it — only a connection
 * that genuinely switches to `app_public` can observe the policy, and that is
 * the deployed request, not the suite.
 *
 * So this reads the migrations as text and holds the one invariant that would
 * have failed: a measurement table the public path upserts into must declare a
 * SELECT policy for `app_public`.
 */

const MIGRATIONS = join(process.cwd(), "server/db/migrations");

const allMigrationSql = (): string =>
  readdirSync(MIGRATIONS)
    .filter((f) => f.endsWith(".sql"))
    .sort()
    .map((f) => readFileSync(join(MIGRATIONS, f), "utf8"))
    .join("\n");

/**
 * Written by the public collect path with `ON CONFLICT` (see
 * `server/modules/measurement/repo.ts`: `upsertVisitor`, `upsertVisit`,
 * `upsertPresence`). `measurement_events` is deliberately absent — it is
 * append-only, written with a plain INSERT and never read by the public path,
 * so INSERT stays its only public policy.
 */
const UPSERT_TABLES = [
  "measurement_visitors",
  "measurement_visits",
  "measurement_presence",
] as const;

describe("measurement RLS", () => {
  it("declares a SELECT policy for app_public on every table the public path upserts", () => {
    const sql = allMigrationSql();
    const missing = UPSERT_TABLES.filter((table) => {
      const pattern = new RegExp(
        `CREATE POLICY\\s+\\w+\\s+ON\\s+${table}\\s+FOR SELECT\\s+TO\\s+[^;]*\\bapp_public\\b`,
        "i",
      );
      return !pattern.test(sql);
    });
    expect(
      missing,
      `no SELECT policy for app_public on: ${missing.join(", ")}. ` +
        "INSERT ... ON CONFLICT cannot probe the arbiter index without one, so " +
        "every upsert from a public visitor fails with SQLSTATE 42501. The " +
        "test suite cannot catch this at runtime: it connects as the table " +
        "owner, which bypasses non-forced RLS.",
    ).toEqual([]);
  });

  it("keeps measurement_events append-only for the public role", () => {
    const sql = allMigrationSql();
    /* A SELECT or UPDATE policy here would be a widening nobody asked for:
       the public path only ever appends events. */
    for (const cmd of ["SELECT", "UPDATE", "DELETE"]) {
      const pattern = new RegExp(
        `CREATE POLICY\\s+\\w+\\s+ON\\s+measurement_events\\s+FOR ${cmd}\\s+TO\\s+[^;]*\\bapp_public\\b`,
        "i",
      );
      expect(pattern.test(sql), `unexpected public ${cmd} policy on measurement_events`).toBe(
        false,
      );
    }
  });
});
