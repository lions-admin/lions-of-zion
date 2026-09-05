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

export type TestDatabaseRole = "app_public" | "app_staff" | "app_service";

const ROLES: readonly TestDatabaseRole[] = ["app_public", "app_staff", "app_service"];

/** Role scopes open on a given test database, so a nested one nests properly. */
const openRoleScopes = new WeakMap<object, number>();

/**
 * The stand-in for `withDatabaseRole` (`server/db/client.ts`) in a test that
 * runs against PGlite.
 *
 * The literal wrapper cannot run here: it connects a Neon WebSocket pool. What
 * it *does* is reproducible, and reproducing it is the whole point — a
 * pass-through `(role, identity, fn) => fn()` leaves the security boundary
 * untested while every route test still goes green.
 *
 * So this establishes the same two things production establishes — the
 * Postgres role and `app.identity` — runs `fn` inside them, and lets a failure
 * out. Two differences are forced by the harness rather than chosen:
 *
 *   1. **`SET LOCAL ROLE` in a transaction, not session-scope `SET ROLE`.**
 *      One PGlite connection is shared by the test and the code under test;
 *      a session-scope role would leak into the test's own assertions. The
 *      transaction is also what makes `SET LOCAL` anything but a silent no-op
 *      — hence `assertRole`, before and after `fn`.
 *   2. **`COMMIT`, not `ROLLBACK`.** Unlike `as()`, which proves a policy and
 *      must leave nothing behind, this stands in for a request that really
 *      wrote. Rolling back would delete the audit rows the caller then asserts
 *      on, and production commits. A statement error aborts the transaction
 *      and Postgres turns this `COMMIT` into a rollback by itself, which is
 *      the safe direction.
 *
 * The nested-transaction patch is not optional either. `db.transaction()` on
 * PGlite issues a bare `BEGIN`/`COMMIT` pair rather than a savepoint — proven
 * by spike, not assumed — so one `db().transaction(…)` inside `fn` (there is
 * one in `core/auth/actor.ts`) would COMMIT this scope early and drop the
 * role, and everything after it would run as the owner. Silently. While the
 * patch is installed those calls become savepoints; the `assertRole` after
 * `fn` is the second lock on the same door.
 */
export async function withTestDatabaseRole<T>(
  db: TestDatabase,
  role: TestDatabaseRole,
  identity: string,
  fn: () => Promise<T>,
): Promise<T> {
  /* The role is interpolated into SQL: it may only ever be one of the three. */
  if (!ROLES.includes(role)) throw new Error(`Not a database role: ${String(role)}`);

  const depth = openRoleScopes.get(db) ?? 0;
  const outermost = depth === 0;
  const enclosing = outermost ? null : await currentRoleScope(db);
  let restoreTransactions: (() => void) | undefined;

  if (outermost) {
    await db.execute(sql.raw("BEGIN"));
    restoreTransactions = redirectNestedTransactionsToSavepoints(db);
  }
  openRoleScopes.set(db, depth + 1);

  try {
    await enterRole(db, role, identity);
    await assertRole(db, role);
    const result = await fn();
    /* Still inside the scope we opened, and still that role. */
    await assertRole(db, role);
    return result;
  } finally {
    openRoleScopes.set(db, depth);
    if (outermost) {
      restoreTransactions?.();
      /* Production RESETs the role and releases the connection here. On one
         PGlite connection, ending the transaction is what does both. */
      await db.execute(sql.raw("COMMIT"));
    } else {
      /* Put the enclosing scope back, exactly as `RESET ALL` would. A failed
         statement leaves the transaction aborted, where this cannot run and
         the outer `COMMIT` cleans up instead. */
      try {
        await enterRole(db, enclosing!.role as TestDatabaseRole, enclosing!.identity);
      } catch {
        /* Aborted transaction: the outermost scope still ends it. */
      }
    }
  }
}

/** Assumes `role` with `identity`, from whatever role is current. */
async function enterRole(db: TestDatabase, role: string, identity: string): Promise<void> {
  /* Only the session user is a member of all three roles, so a nested scope
     has to step back to it before it can assume a different one. */
  await db.execute(sql.raw("RESET ROLE"));
  await db.execute(sql.raw(`SET LOCAL ROLE ${role}`));
  await db.execute(sql`SELECT set_config('app.identity', ${identity}, true)`);
}

async function currentRoleScope(db: TestDatabase): Promise<{ role: string; identity: string }> {
  const result = await db.execute<{ role: string; identity: string }>(
    sql`SELECT current_user AS role, COALESCE(current_setting('app.identity', true), '') AS identity`,
  );
  return result.rows[0] as { role: string; identity: string };
}

/**
 * Makes `db.transaction()` use savepoints while a role scope is open, and
 * returns the undo.
 *
 * Drizzle's PGlite driver delegates to `PGlite.transaction()`, which opens a
 * real `BEGIN` even when one is already open — Postgres warns and carries on,
 * and the inner `COMMIT` then ends the *outer* transaction. The replacement
 * hands the callback the same connection, which is what the non-transactional
 * session already uses, so nothing else changes.
 */
function redirectNestedTransactionsToSavepoints(db: TestDatabase): () => void {
  const client = db.$client as unknown as {
    transaction: unknown;
    query: (query: string) => Promise<unknown>;
  };
  const original = client.transaction;
  let sequence = 0;
  client.transaction = async <T>(callback: (tx: unknown) => Promise<T>): Promise<T> => {
    const savepoint = `role_scope_${(sequence += 1)}`;
    await client.query(`SAVEPOINT ${savepoint}`);
    try {
      const result = await callback(client);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      return result;
    } catch (cause) {
      await client.query(`ROLLBACK TO SAVEPOINT ${savepoint}`);
      await client.query(`RELEASE SAVEPOINT ${savepoint}`);
      throw cause;
    }
  };
  return () => {
    client.transaction = original;
  };
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
