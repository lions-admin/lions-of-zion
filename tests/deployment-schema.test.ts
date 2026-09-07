import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { readMigrationFiles } from "drizzle-orm/migrator";
import { join } from "node:path";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import { assertSchemaCompatible, requireSchemaTarget } from "../scripts/schema-compatibility";

describe("deployment schema preflight", () => {
  let db: TestDatabase;
  const query = async (sql: string) => db.$client.query<Record<string, unknown>>(sql);

  beforeAll(async () => {
    db = await freshDatabase();
    // freshDatabase applies the same SQL without Drizzle's receipts. Populate
    // its ledger here so the tests can independently remove a receipt or DDL.
    await db.$client.exec("CREATE SCHEMA drizzle; CREATE TABLE drizzle.__drizzle_migrations (hash text, created_at bigint)");
    for (const m of readMigrationFiles({ migrationsFolder: join(process.cwd(), "server/db/migrations") })) {
      await db.$client.query("INSERT INTO drizzle.__drizzle_migrations VALUES ($1, $2)", [m.hash, m.folderMillis]);
    }
  });
  afterAll(async () => { await db?.$client.close(); });

  it("accepts a database with all required migrations and columns", async () => {
    await expect(assertSchemaCompatible(query)).resolves.toMatchObject({ migrations: expect.any(Number) });
  });

  it("refuses promotion when the last required migration is not applied", async () => {
    await db.$client.exec("BEGIN; DELETE FROM drizzle.__drizzle_migrations WHERE created_at = (SELECT max(created_at) FROM drizzle.__drizzle_migrations)");
    try {
      await expect(assertSchemaCompatible(query)).rejects.toThrow("required migration(s) are missing");
    } finally { await db.$client.exec("ROLLBACK"); }
  });

  it("refuses schema drift even with a complete migration ledger", async () => {
    await db.$client.exec("BEGIN; ALTER TABLE publication DROP COLUMN editorial_run_id CASCADE");
    try {
      await expect(assertSchemaCompatible(query)).rejects.toThrow("public.publication.editorial_run_id");
    } finally { await db.$client.exec("ROLLBACK"); }
  });

  it("refuses migration contents changed after application", async () => {
    await db.$client.exec("BEGIN; UPDATE drizzle.__drizzle_migrations SET hash = 'changed' WHERE created_at = (SELECT max(created_at) FROM drizzle.__drizzle_migrations)");
    try {
      await expect(assertSchemaCompatible(query)).rejects.toThrow("missing or changed");
    } finally { await db.$client.exec("ROLLBACK"); }
  });

  it("requires an explicit matching environment and usable connection", () => {
    expect(() => requireSchemaTarget("production", { DATABASE_RESOURCE_ENV: "preview", DATABASE_URL: "postgres://example" })).toThrow("does not match");
    expect(() => requireSchemaTarget("production", { DATABASE_RESOURCE_ENV: "production" })).toThrow("requires a database connection");
    expect(() => requireSchemaTarget("preview", { DATABASE_RESOURCE_ENV: "preview", DATABASE_URL: "[SENSITIVE]" })).toThrow("requires a database connection");
  });
});
