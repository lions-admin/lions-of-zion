/**
 * `withDatabaseRole()` — the wrapper every classified request runs inside.
 *
 * `tests/rls.test.ts` proves the *policies*, but it does so with
 * `SET LOCAL ROLE` inside a transaction on PGlite. Production uses none of
 * that: a dedicated pooled connection, session-scoped `SET ROLE`, a
 * session-scoped `set_config`, and a reset before the connection goes back to
 * the pool. CLAUDE.md names this as the one real gap in the authorization
 * story, and this file closes it.
 *
 * PGlite cannot stand in here — it has one connection and no pool, so the
 * behaviour under test (acquire, scope, reset, release) has nowhere to happen.
 * So the *pool* is faked and everything above it is real: the real
 * `withDatabaseRole`, the real drizzle driver, the real SQL it generates. What
 * is asserted is the exact statement text that reaches the wire, which is the
 * thing a reviewer of this function cannot otherwise see.
 *
 * The risk being pinned is not "the query fails". It is the silent one: a
 * connection returned to the pool still carrying `app_public` and a stale
 * `app.identity`, inherited by whichever request picks it up next.
 */
import { afterEach, describe, expect, it, vi } from "vitest";
import { sql } from "drizzle-orm";

type QueryConfig = string | { text: string; values?: unknown[] };

/** One pooled connection, recording everything sent to it. */
class FakeClient {
  readonly queries: { text: string; params: unknown[] }[] = [];
  /** Every `release()` argument, in order. `[undefined]` means "back to the
   *  pool"; a truthy argument means "destroy this connection instead". */
  readonly releases: unknown[] = [];
  readonly failOn = pools.failOn;

  async query(config: QueryConfig, params?: unknown[]) {
    const text = typeof config === "string" ? config : config.text;
    this.queries.push({ text, params: params ?? [] });
    if (this.failOn?.test(text)) throw new Error(`postgres refused: ${text}`);
    return { rows: [], fields: [], rowCount: 0, command: "SELECT" };
  }

  release(reason?: unknown) {
    this.releases.push(reason);
  }

  get statements(): string[] {
    return this.queries.map((entry) => entry.text);
  }
}

const pools = vi.hoisted(() => ({
  list: [] as { clients: FakeClient[] }[],
  /** Armed before a call to make a statement the connection receives fail. */
  failOn: undefined as RegExp | undefined,
}));

class FakePool {
  readonly clients: FakeClient[] = [];
  constructor() {
    pools.list.push(this);
  }
  async connect() {
    const client = new FakeClient();
    this.clients.push(client);
    return client;
  }
  async end() {}
}

/* Only `Pool` is replaced. `types` and `neonConfig` stay real, because the
   drizzle session imports them and its timestamp type parsers are part of the
   code path under test. */
vi.mock("@neondatabase/serverless", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@neondatabase/serverless")>()),
  Pool: FakePool,
}));
vi.mock("@/server/core/config", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/core/config")>()),
  databaseUrl: () => "postgres://fake/neondb",
  databasePoolConfig: () => ({}),
}));

const { withDatabaseRole, databaseIdentity, db, closeDb } = await import("@/server/db/client");

afterEach(async () => {
  await closeDb();
  pools.list.length = 0;
  pools.failOn = undefined;
});

/** The single connection the wrapper acquired for one call. */
const connection = (index = 0): FakeClient => {
  const client = pools.list.at(-1)?.clients[index];
  if (!client) throw new Error("The wrapper acquired no pooled connection.");
  return client;
};

describe("the boundary is set up before the work runs", () => {
  it("acquires one connection, sets the role, then the identity, then calls in", async () => {
    let seenInside: string[] = [];
    const result = await withDatabaseRole("app_service", "service:cron", async () => {
      seenInside = [...connection().statements];
      return "done";
    });

    expect(result).toBe("done");
    expect(pools.list).toHaveLength(1);
    expect(pools.list[0]!.clients).toHaveLength(1);
    /* Ordering matters and is the assertion: both statements are already on the
       wire by the time the handler is entered. A wrapper that set the role
       afterwards would still pass a test that only checked the final list. */
    expect(seenInside).toEqual([
      "SET ROLE app_service",
      "SELECT set_config('app.identity', $1, false)",
    ]);
  });

  it("scopes the identity to the session, not the transaction", async () => {
    /* The third argument to `set_config` is the whole difference between this
       and `tests/rls.test.ts`. `true` is transaction-local: correct inside a
       `BEGIN`, and a silent no-op here — every RLS policy reading
       `app.identity` would then see an empty string on a connection that
       issues no explicit transaction. */
    await withDatabaseRole("app_staff", "admin@lionsofzion.io", async () => {});
    const setConfig = connection().queries.find((entry) => entry.text.includes("set_config"))!;
    expect(setConfig.text).toContain(", false)");
    expect(setConfig.text).not.toContain(", true)");
    /* The identity travels as a bound parameter, so it cannot be interpolated
       into SQL however strange the label is. */
    expect(setConfig.params).toEqual(["admin@lionsofzion.io"]);
  });

  it("passes each of the three roles through verbatim", async () => {
    /* `SET ROLE` cannot take a parameter, so the role IS interpolated — which
       is safe only because `DatabaseRole` is a closed union of three literals
       that the compiler enforces at every call site. This test is what makes
       that reasoning checkable. */
    for (const role of ["app_public", "app_staff", "app_service"] as const) {
      await withDatabaseRole(role, "identity", async () => {});
      expect(connection().statements[0]).toBe(`SET ROLE ${role}`);
      await closeDb();
    }
  });
});

describe("the work runs inside the boundary, not beside it", () => {
  it("db() inside the callback is the connection that carries the role", async () => {
    /* The one that would be a real breach if it broke: `db()` returning the
       ambient pool inside the callback means the request ran with the owner's
       privileges while every log line claimed otherwise. */
    await withDatabaseRole("app_public", "anonymous:abc", async () => {
      await db().execute(sql`select 1`);
    });
    expect(connection().statements).toEqual([
      "SET ROLE app_public",
      "SELECT set_config('app.identity', $1, false)",
      "select 1",
      "RESET ROLE",
      "RESET ALL",
    ]);
  });

  it("databaseIdentity() reports the caller's identity inside and falls back outside", async () => {
    await withDatabaseRole("app_service", "service:queue", async () => {
      expect(databaseIdentity()).toBe("service:queue");
    });
    expect(databaseIdentity()).toBe("service:embedding");
  });

  it("two calls do not bleed into each other", async () => {
    await withDatabaseRole("app_service", "service:cron", async () => {});
    await withDatabaseRole("app_public", "anonymous:xyz", async () => {
      expect(databaseIdentity()).toBe("anonymous:xyz");
    });
    /* Each call takes its own connection; the pool is shared, the scope is not. */
    expect(pools.list[0]!.clients).toHaveLength(2);
    expect(connection(0).statements[0]).toBe("SET ROLE app_service");
    expect(connection(1).statements[0]).toBe("SET ROLE app_public");
  });
});

describe("the connection is always cleaned before it goes back", () => {
  it("resets and releases on the happy path", async () => {
    await withDatabaseRole("app_staff", "admin", async () => {});
    expect(connection().statements.slice(-2)).toEqual(["RESET ROLE", "RESET ALL"]);
    expect(connection().releases).toEqual([undefined]);
  });

  it("resets and releases when the handler throws, and rethrows unchanged", async () => {
    /* The leak that matters. A handler that throws — a 404, a validation
       error, anything — is the common case, not the exceptional one. If the
       reset lived after the call instead of in a `finally`, this connection
       would rejoin the pool as `app_staff` with an admin identity attached. */
    const boom = new Error("handler exploded");
    await expect(
      withDatabaseRole("app_staff", "admin@lionsofzion.io", async () => {
        throw boom;
      }),
    ).rejects.toBe(boom);
    expect(connection().statements.slice(-2)).toEqual(["RESET ROLE", "RESET ALL"]);
    expect(connection().releases).toEqual([undefined]);
  });

  it("releases, and never enters the handler, when SET ROLE itself is refused", async () => {
    /* A revoked grant, or a role that does not exist on this database. The
       request must fail — and must fail *before* the handler runs, since a
       handler that ran here would run with the pool owner's privileges. */
    pools.failOn = /^SET ROLE/;
    const handler = vi.fn(async () => "unreachable");
    await expect(withDatabaseRole("app_service", "service:cron", handler)).rejects.toThrow(
      /Failed query: SET ROLE app_service/,
    );
    expect(handler).not.toHaveBeenCalled();
    expect(connection().releases).toEqual([undefined]);
  });

  it("destroys the connection instead of returning it when the reset is refused", async () => {
    /* The last line of defence. If `RESET ROLE` fails, a plain `release()`
       hands a connection still holding `app_staff` and a stale `app.identity`
       to whichever request draws it next — silently, with nothing in the logs
       tying the two together. `release(err)` destroys it instead, and the pool
       opens a clean one. */
    pools.failOn = /^RESET/;
    await expect(withDatabaseRole("app_staff", "admin", async () => "ok")).rejects.toThrow(
      /Failed query: RESET ROLE/,
    );
    expect(connection().releases).toHaveLength(1);
    expect(connection().releases[0]).toBeInstanceOf(Error);
  });
});
