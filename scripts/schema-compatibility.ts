import { readMigrationFiles } from "drizzle-orm/migrator";
import { is } from "drizzle-orm";
import { getTableConfig, PgTable } from "drizzle-orm/pg-core";
import { join } from "node:path";
import * as schema from "../server/db/schema";

type Query = (sql: string) => Promise<{ rows: Record<string, unknown>[] }>;

/** Read-only proof against the target database, independent of application data. */
export async function assertSchemaCompatible(query: Query, root = process.cwd()) {
  const expected = readMigrationFiles({ migrationsFolder: join(root, "server/db/migrations") });
  const ledger = await query("SELECT hash, created_at FROM drizzle.__drizzle_migrations");
  const missing = expected.filter((migration) => !ledger.rows.some((row) =>
    row.hash === migration.hash && Number(row.created_at) === migration.folderMillis,
  ));
  if (missing.length) {
    throw new Error(`Schema preflight refused: ${missing.length} required migration(s) are missing or changed. Apply and verify migrations before promotion.`);
  }

  // A ledger is necessary but insufficient: detect a dropped column even when
  // somebody has left the migration receipt in place.
  const columns = await query("SELECT table_schema, table_name, column_name FROM information_schema.columns");
  const present = new Set(columns.rows.map((row) => `${row.table_schema}.${row.table_name}.${row.column_name}`));
  const absent: string[] = [];
  for (const table of Object.values(schema)) {
    if (!is(table, PgTable)) continue;
    const config = getTableConfig(table);
    for (const column of config.columns) {
      const key = `${config.schema ?? "public"}.${config.name}.${column.name}`;
      if (!present.has(key)) absent.push(key);
    }
  }
  if (absent.length) throw new Error(`Schema preflight refused: missing required columns: ${absent.join(", ")}`);
  return { migrations: expected.length };
}

export function requireSchemaTarget(target: string | undefined, env: Record<string, string | undefined>) {
  if (target !== "production" && target !== "preview") throw new Error("Expected schema target: preview or production.");
  if (env.DATABASE_RESOURCE_ENV !== target) throw new Error("Schema target does not match DATABASE_RESOURCE_ENV.");
  if (!env.DATABASE_URL || env.DATABASE_URL === "[SENSITIVE]") throw new Error("Schema preflight requires a database connection.");
  return env.DATABASE_URL;
}
