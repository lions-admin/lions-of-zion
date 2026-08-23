/**
 * The test database.
 *
 * Deliberately NOT behind `server-only`: this is imported by vitest, which has
 * no Next.js runtime. It is also never imported by anything under `app/` —
 * the ESLint boundary rules make that a lint error rather than a convention.
 *
 * PGlite is a real Postgres 18 compiled to WASM, so constraints, triggers,
 * generated columns and roles all behave exactly as they will in Neon. Two
 * things it does NOT have, both confirmed by spike rather than assumed:
 *
 *   1. **pgvector.** Not bundled, and no package publishes it separately. So
 *      semantic-search tests need a real Postgres (`TEST_DATABASE_URL`) and
 *      skip when it is absent. Lexical search — `tsvector`, `pg_trgm` — works
 *      here in full.
 *   2. **Concurrency.** One connection. Fine, because every test gets its own
 *      database rather than sharing one.
 */

import { PGlite } from "@electric-sql/pglite";
import { pg_trgm } from "@electric-sql/pglite/contrib/pg_trgm";
import { citext } from "@electric-sql/pglite/contrib/citext";
import { drizzle } from "drizzle-orm/pglite";
import { sql } from "drizzle-orm";
import { readdir, readFile } from "node:fs/promises";
import { join } from "node:path";
import * as schema from "./schema";

export type TestDatabase = ReturnType<typeof drizzle<typeof schema>> & {
  $client: PGlite;
};

const MIGRATIONS_DIR = join(process.cwd(), "server", "db", "migrations");

/**
 * A fresh, migrated, in-memory database.
 *
 * Every caller gets its own, so tests cannot leak state into each other and
 * do not need teardown beyond letting it be garbage collected.
 */
export async function freshDatabase(): Promise<TestDatabase> {
  const client = await PGlite.create({ extensions: { pg_trgm, citext } });
  const db = drizzle(client, { schema, casing: "snake_case" }) as TestDatabase;
  await applyMigrations(client);
  return db;
}

/**
 * Applies migrations in filename order.
 *
 * Drizzle's own migrator reads its journal and tracks applied migrations,
 * which is right for a long-lived database and pure overhead for one that
 * exists for eleven milliseconds. Plain filename order also means the custom
 * SQL files carrying the triggers are applied identically here and in
 * production, rather than through a different code path.
 */
async function applyMigrations(client: PGlite): Promise<void> {
  let files: string[];
  try {
    files = (await readdir(MIGRATIONS_DIR)).filter((f) => f.endsWith(".sql")).sort();
  } catch {
    throw new Error(
      `No migrations at ${MIGRATIONS_DIR}. Run \`npm run db:generate\` before the tests.`,
    );
  }
  for (const file of files) {
    const text = await readFile(join(MIGRATIONS_DIR, file), "utf8");
    /* Drizzle separates statements with this marker; splitting on semicolons
       would tear apart the plpgsql function bodies the triggers live in. */
    const statements = text
      .split("--> statement-breakpoint")
      .map((s) => s.trim())
      .filter(Boolean);
    for (const statement of statements) {
      try {
        await client.exec(statement);
      } catch (cause) {
        throw new Error(`${file}: ${(cause as Error).message}\n${statement.slice(0, 300)}`, {
          cause,
        });
      }
    }
  }
}

/**
 * Runs `fn` as a Postgres role, inside a transaction, with an identity set.
 *
 * The transaction is not optional and not an optimisation. `SET LOCAL` outside
 * one is a silent no-op: it succeeds, changes nothing, and every assertion
 * afterwards runs with the owner's privileges. `assertRole` below exists
 * because that failure is invisible — the suite goes green while testing
 * nothing.
 *
 * Always rolls back. A policy test that leaves rows behind is a policy test
 * that passes once.
 */
export async function as<T>(
  db: TestDatabase,
  role: "app_public" | "app_staff" | "app_service",
  identity: string | null,
  fn: (tx: TestDatabase) => Promise<T>,
): Promise<T> {
  await db.execute(sql.raw("BEGIN"));
  try {
    await db.execute(sql.raw(`SET LOCAL ROLE ${role}`));
    if (identity !== null) {
      await db.execute(sql`SELECT set_config('app.identity', ${identity}, true)`);
    }
    await assertRole(db, role);
    return await fn(db);
  } finally {
    await db.execute(sql.raw("ROLLBACK"));
  }
}

/**
 * Refuses to continue unless the role actually took effect.
 *
 * This is the guard that makes the authorization suite mean something. Without
 * it, a harness bug produces a passing test over a database with no
 * authorization applied, which is the one test outcome worse than a failure.
 */
export async function assertRole(db: TestDatabase, expected: string): Promise<void> {
  const result = await db.execute<{ current_user: string }>(sql`SELECT current_user`);
  const actual = (result.rows[0] as { current_user: string } | undefined)?.current_user;
  if (actual !== expected) {
    throw new Error(
      `Expected to be running as "${expected}" but current_user is "${actual}". ` +
        `SET LOCAL ROLE is a silent no-op outside a transaction — every assertion ` +
        `after this point would run with owner privileges and pass for the wrong reason.`,
    );
  }
}

/** Whether a Postgres with pgvector is configured. Vector tests skip without it. */
export const hasVectorDatabase = (): boolean => Boolean(process.env.TEST_DATABASE_URL);

/**
 * The Postgres error behind a Drizzle failure.
 *
 * Drizzle wraps driver errors as `Failed query: …` and hangs the real one off
 * `cause`, so asserting on the outer message tests nothing useful. Worse, a
 * bare `.rejects.toThrow()` passes when the WRONG constraint fires — which is
 * the same class of false green as an authorization suite that runs as the
 * owner.
 *
 * So tests assert on `constraint` by name where Postgres gives one, and on the
 * message only for `RAISE EXCEPTION` in a trigger, which has no constraint.
 */
export type PgViolation = {
  code: string | undefined;
  constraint: string | undefined;
  message: string;
};

export async function violation(promise: Promise<unknown>): Promise<PgViolation> {
  try {
    await promise;
  } catch (error) {
    let current: unknown = error;
    /* Walk to the deepest cause: Drizzle wraps once, the migration runner
       twice, and the useful fields are always at the bottom. */
    while (
      current &&
      typeof current === "object" &&
      "cause" in current &&
      (current as { cause?: unknown }).cause
    ) {
      current = (current as { cause: unknown }).cause;
    }
    const pg = current as { code?: string; constraint?: string; message?: string };
    return {
      code: pg.code,
      constraint: pg.constraint,
      message: pg.message ?? String(current),
    };
  }
  throw new Error("Expected the statement to be refused, but it succeeded.");
}

/** Postgres SQLSTATEs the constraint tests care about. */
export const SQLSTATE = {
  checkViolation: "23514",
  restrictViolation: "23001",
  uniqueViolation: "23505",
  foreignKeyViolation: "23503",
  notNullViolation: "23502",
} as const;
