/**
 * R3-06 — the Production branch of `authenticateAdmin`, actually executed.
 *
 * Vitest runs with `NODE_ENV=test`, so `appEnv()` answers `development` and
 * the whole suite has, until now, only ever entered `authenticateAdmin`
 * through the `x-actor-label` shim. The production half of that function —
 * the session lookup, the allowlist comparison, the `auth.refused` audit and
 * the capability bootstrap — was never once run under the environment it
 * exists for.
 *
 * This file drives the REAL branch. Nothing about `appEnv()` is mocked:
 * `vi.stubEnv("VERCEL_ENV", …)` sets the variable the real accessor reads
 * (`server/core/config.ts`), the way `tests/public-mutation-guard.test.ts`
 * and `tests/briefing-environment-isolation.test.ts` already do.
 *
 * **How the conditional is proved to have been evaluated.** Every case here
 * sends `x-actor-label: admin:ghost`, the header the development bypass
 * honours. The two collaborators that live *past* the conditional —
 * `readGoogleSession` and `neonAuth().getSession()` — increment a counter
 * when called. Under `production` the counter moves and the header is
 * ignored; under `development`, in the same file with the same header and the
 * same mocks, the counter stays at zero and the header is honoured. That
 * difference has exactly one cause: `if (appEnv() === "development")` was
 * evaluated, and answered differently.
 *
 * The database is a real migrated PGlite, so the refusal audit row and the
 * capability grants are the rows Postgres actually wrote, not a mocked
 * return value.
 */
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { eq } from "drizzle-orm";
import { freshDatabase, type TestDatabase } from "@/server/db/testing";
import { appUser, auditLog, capabilityGrant } from "@/server/db/schema";

const state = vi.hoisted(() => ({
  db: undefined as unknown,
  googleUser: null as { id: string; email: string; name: string } | null,
  neonUser: null as { id: string; email: string; name: string } | null,
  /* Both are reached ONLY after `appEnv() === "development"` is evaluated and
     found false, or found true with no `x-actor-label` present. Every case in
     this file sends the header, so a non-zero count here is the production
     conditional having been taken. */
  lookups: { google: 0, neon: 0 },
}));

vi.mock("@/server/db/client", () => ({
  db: () => {
    if (!state.db) throw new Error("No test database registered for this test.");
    return state.db;
  },
  withDatabaseRole: (_role: string, _identity: string, fn: () => Promise<unknown>) => fn(),
  closeDb: async () => {},
}));
vi.mock("@/server/core/auth/google-session", () => ({
  readGoogleSession: async () => {
    state.lookups.google += 1;
    return state.googleUser;
  },
}));
vi.mock("@/server/core/auth/neon", () => ({
  neonAuth: () => ({
    getSession: async () => {
      state.lookups.neon += 1;
      return { data: state.neonUser ? { user: state.neonUser } : null };
    },
  }),
}));

/** The header the development bypass fabricates an all-capabilities admin
 *  from. Production must never honour it. */
const GHOST = "admin:ghost";
const OWNER_EMAIL = "owner@example.org";

const signedRequest = () =>
  new Request("http://localhost/api/v1/admin/console/overview", {
    headers: { "x-actor-label": GHOST },
  });

/**
 * A fresh module registry per test.
 *
 * `actor.ts` keeps `actors` (a WeakMap of Request → Actor) and `capabilities`
 * (a Map of label → grants) at module scope. Reloading means no test can pass
 * because an earlier one left a grant behind, and the file leaves no registry
 * state behind either.
 */
async function loadAuth() {
  vi.resetModules();
  return import("@/server/core/auth/actor");
}

/** Returns the ProblemCode and message of a refusal, or fails loudly if the
 *  call resolved — an `expect(...).rejects` that silently matched nothing is
 *  how a branch test stops testing the branch. */
async function refusalOf(promise: Promise<unknown>): Promise<{ code: string; message: string }> {
  try {
    await promise;
  } catch (cause) {
    const error = cause as { code?: unknown; message?: unknown };
    return {
      code: typeof error.code === "string" ? error.code : "<no code>",
      message: typeof error.message === "string" ? error.message : "<no message>",
    };
  }
  throw new Error("Expected authenticateAdmin to refuse, but it resolved.");
}

const auditRows = async (db: TestDatabase) =>
  (await db.select().from(auditLog)).map((row) => ({
    action: row.action,
    entityType: row.entityType,
    entityId: row.entityId,
    actorLabel: row.actorLabel,
    afterState: row.afterState,
  }));

let db: TestDatabase;

beforeEach(async () => {
  db = await freshDatabase();
  state.db = db;
  state.googleUser = null;
  state.neonUser = null;
  state.lookups = { google: 0, neon: 0 };
  /* The real `adminEmail()` reads this; nothing about it is mocked. */
  vi.stubEnv("ADMIN_EMAIL", OWNER_EMAIL);
});

afterEach(() => {
  /* Restores VERCEL_ENV and ADMIN_EMAIL to whatever the process had before,
     including "not set at all". */
  vi.unstubAllEnvs();
  vi.resetModules();
  state.db = undefined;
  state.googleUser = null;
  state.neonUser = null;
});

describe("authenticateAdmin under a real production environment", () => {
  it("evaluates the development conditional and refuses to honour x-actor-label", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    const { authenticateAdmin, requireActor } = await loadAuth();
    const request = signedRequest();

    const refusal = await refusalOf(authenticateAdmin(request));

    /* THE assertion this finding exists for. `readGoogleSession` is only
       reachable past `if (appEnv() === "development") { if (label) return … }`.
       The request carries `x-actor-label`, so under the development branch
       the function returns before this line and the counter stays at 0.
       A non-zero count is the production conditional having been evaluated
       and answered false. */
    expect(state.lookups.google).toBe(1);
    /* And past that, the Neon session was consulted too — the header bought
       the caller nothing. */
    expect(state.lookups.neon).toBe(1);

    expect(refusal.code).toBe("UNAUTHENTICATED");
    expect(refusal.message).toMatch(/Please sign in/);
    /* No actor was cached for the request, so the route boundary refuses too. */
    expect(() => requireActor(request)).toThrowError(/Please sign in/);
    /* A 401 has no actor to record. */
    expect(await auditRows(db)).toEqual([]);
  });

  it("honours the same header, with the same mocks, under development", async () => {
    vi.stubEnv("VERCEL_ENV", "development");
    const { authenticateAdmin, requireActor, requireCapability } = await loadAuth();
    const request = signedRequest();

    const actor = await authenticateAdmin(request);

    expect(actor).toEqual({ label: GHOST, userId: null });
    /* The contrast that makes the previous test's counters mean something:
       neither session collaborator was reached, because the function returned
       inside the development branch. */
    expect(state.lookups).toEqual({ google: 0, neon: 0 });
    expect(requireActor(request)).toEqual({ label: GHOST, userId: null });
    expect(() => requireCapability(actor, "assessment.publish")).not.toThrow();
    /* The bypass writes nothing: no user row, no grant, no audit. */
    expect(await db.select().from(appUser)).toEqual([]);
    expect(await auditRows(db)).toEqual([]);
  });

  it("does not honour the header on a preview deployment either", async () => {
    vi.stubEnv("VERCEL_ENV", "preview");
    const { authenticateAdmin } = await loadAuth();

    const refusal = await refusalOf(authenticateAdmin(signedRequest()));

    expect(state.lookups.google).toBe(1);
    expect(refusal.code).toBe("UNAUTHENTICATED");
  });

  it("refuses a non-allowlisted production session with a real auth.refused row", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    /* Mixed case and padding on purpose: the allowlist compare normalises. */
    state.googleUser = { id: "google:intruder", email: "  Intruder@Example.ORG  ", name: "Intruder" };
    const { authenticateAdmin, requireActor } = await loadAuth();
    const request = signedRequest();

    const refusal = await refusalOf(authenticateAdmin(request));

    expect(state.lookups.google).toBe(1);
    expect(refusal.code).toBe("FORBIDDEN");
    expect(refusal.message).toMatch(/not authorized for the admin area/);
    /* The header did not become an actor on the way past the refusal. */
    expect(() => requireActor(request)).toThrowError(/Please sign in/);

    /* Written by `db().transaction` inside the production branch — a row
       Postgres actually holds, on the fresh database this test made. */
    const rows = await auditRows(db);
    expect(rows).toHaveLength(1);
    expect(rows[0]).toMatchObject({
      action: "auth.refused",
      entityType: "system",
      entityId: null,
      actorLabel: "intruder@example.org",
    });
    expect(rows[0]!.afterState).toEqual({ reason: "admin_email_mismatch" });
    expect(JSON.stringify(rows)).not.toContain(GHOST);
    /* A refused sign-in is telemetry, never a provisioned account. */
    expect(await db.select().from(appUser)).toEqual([]);
  });

  it("admits the allowlisted production session as a real actor with real grants", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    state.googleUser = { id: "google:owner", email: "Owner@Example.ORG", name: "  The Owner  " };
    const { authenticateAdmin, requireActor, requireCapability, ADMIN_CAPABILITIES } =
      await loadAuth();
    const request = signedRequest();

    const actor = await authenticateAdmin(request);

    expect(state.lookups.google).toBe(1);
    /* The label came from the database row, NOT from `x-actor-label`. If the
       development bypass had been taken this would read "admin:ghost". */
    expect(actor.label).toBe("The Owner");
    expect(actor.label).not.toBe(GHOST);

    const users = await db.select().from(appUser);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({
      externalId: "google:owner",
      email: OWNER_EMAIL,
      displayName: "The Owner",
      isAutomated: false,
    });
    expect(actor.userId).toBe(users[0]!.id);

    const grants = await db
      .select({ capability: capabilityGrant.capability })
      .from(capabilityGrant)
      .where(eq(capabilityGrant.userId, users[0]!.id));
    expect(grants.map((g) => g.capability).sort()).toEqual([...ADMIN_CAPABILITIES].sort());

    /* The grants read back from Postgres are the ones the capability check
       now answers from. */
    for (const capability of ADMIN_CAPABILITIES) {
      expect(() => requireCapability(actor, capability)).not.toThrow();
    }
    expect(() => requireCapability(actor, "assessment.invent")).toThrowError(
      /Missing required capability: assessment.invent/,
    );
    /* `admin:ghost` never entered the capability registry. */
    expect(() => requireCapability({ label: GHOST, userId: null }, "assessment.publish")).toThrow();

    expect(requireActor(request)).toEqual(actor);
    expect(await auditRows(db)).toEqual([]);
  });

  it("reaches the Neon session when no Google cookie is present, and admits the owner", async () => {
    vi.stubEnv("VERCEL_ENV", "production");
    state.neonUser = { id: "neon:owner", email: OWNER_EMAIL, name: "Neon Owner" };
    const { authenticateAdmin } = await loadAuth();

    const actor = await authenticateAdmin(signedRequest());

    /* Both collaborators past the conditional ran: Google returned nothing,
       so Neon was asked. */
    expect(state.lookups).toEqual({ google: 1, neon: 1 });
    expect(actor.label).toBe("Neon Owner");
    expect(actor.label).not.toBe(GHOST);
    const users = await db.select().from(appUser);
    expect(users).toHaveLength(1);
    expect(users[0]).toMatchObject({ externalId: "neon:owner", email: OWNER_EMAIL });
  });
});

describe("environment restoration", () => {
  it("leaves VERCEL_ENV as the process had it, so appEnv() is development again", async () => {
    /* Runs after every stubbed case above; `vi.unstubAllEnvs` in afterEach is
       what makes this pass. If a stub leaked, the suite's own default
       environment would be wrong for every file that follows. */
    const { appEnv } = await import("@/server/core/config");
    expect(process.env.VERCEL_ENV).toBeUndefined();
    expect(appEnv()).toBe("development");
  });
});
