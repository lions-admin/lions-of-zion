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
import { Pool } from "@neondatabase/serverless";
import { databaseUrl } from "@/server/core/config";
import * as schema from "./schema";

export type Database = ReturnType<typeof drizzleNeon<typeof schema>>;

let pool: Pool | undefined;
let cached: Database | undefined;

/**
 * The application database.
 *
 * Lazily constructed so importing anything under `server/db` does not demand
 * a `DATABASE_URL`; the test suite never calls this at all.
 */
export function db(): Database {
  if (cached) return cached;
  pool = new Pool({ connectionString: databaseUrl() });
  cached = drizzleNeon(pool, { schema, casing: "snake_case" });
  return cached;
}

/** Closes the pool. For scripts and test teardown; serverless never needs it. */
export async function closeDb(): Promise<void> {
  await pool?.end();
  pool = undefined;
  cached = undefined;
}

export { schema };
