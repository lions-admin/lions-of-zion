import "server-only";

/**
 * The only file that opens a database connection.
 *
 * Two drivers, and the choice between them is a correctness matter rather
 * than a performance one:
 *
 *   - `neon-http` cannot hold an interactive transaction. `SET LOCAL ROLE` and
 *     `set_config('app.identity', …, true)` outside a transaction are SILENT
 *     NO-OPS — the statement succeeds, the role never changes, and every
 *     authorization test then runs as the table owner and passes for the wrong
 *     reason. A green authorization suite over a database with no
 *     authorization in effect is worse than having no tests at all.
 *   - `neon-serverless` speaks WebSocket and holds real transactions.
 *
 * So the WebSocket pool is the default for everything identity-scoped or
 * mutating. `neon-http` is deliberately not exported: there is no path here to
 * pick the fast, wrong one by accident.
 */

import { drizzle as drizzleNeon } from "drizzle-orm/neon-serverless";
import { AsyncLocalStorage } from "node:async_hooks";
import { sql } from "drizzle-orm";
import { Pool } from "@neondatabase/serverless";
import { databasePoolConfig, databaseUrl } from "@/server/core/config";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzleNeon<typeof schema>>;

let pool: Pool | undefined;
let cached: Database | undefined;
const requestDatabase = new AsyncLocalStorage<{ database: Database; identity: string }>();

/**
 * The application database.
 *
 * Lazily constructed so importing anything under `server/db` does not demand
 * a `DATABASE_URL`; the test suite never calls this at all.
 */
export function db(): Database {
  const scoped = requestDatabase.getStore();
  if (scoped) return scoped.database;
  if (cached) return cached;
  pool = new Pool({ connectionString: databaseUrl(), ...databasePoolConfig() });
  cached = drizzleNeon(pool, { schema, casing: "snake_case" });
  return cached;
}

export type DatabaseRole = "app_public" | "app_staff" | "app_service";

/**
 * Runs a request through one dedicated pooled connection with a database role
 * and identity. The connection is reset before release, so RLS state can never
 * bleed into the next Vercel invocation that receives it.
 */
export async function withDatabaseRole<T>(
  role: DatabaseRole,
  identity: string,
  fn: () => Promise<T>,
): Promise<T> {
  if (!pool) db();
  const client = await pool!.connect();
  const scoped = drizzleNeon(client, { schema, casing: "snake_case" }) as unknown as Database;
  try {
    await scoped.execute(sql.raw(`SET ROLE ${role}`));
    await scoped.execute(sql`SELECT set_config('app.identity', ${identity}, false)`);
    return await requestDatabase.run({ database: scoped, identity }, fn);
  } finally {
    try {
      await scoped.execute(sql.raw("RESET ROLE"));
      await scoped.execute(sql.raw("RESET ALL"));
    } finally {
      client.release();
    }
  }
}

export const databaseIdentity = (): string =>
  requestDatabase.getStore()?.identity ?? "service:embedding";

/** Closes the pool. For scripts and test teardown; serverless never needs it. */
export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  cached = undefined;
}

export { schema };
