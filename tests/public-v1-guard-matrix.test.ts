/**
 * The `PUBLIC_V1` guard matrix.
 *
 * `accessFor` in `server/http/handler.ts` is the single decision that says
 * whether an `/api/v1/…` request runs as `app_public` — no session, no actor,
 * RLS-limited to published rows — or has to authenticate first and run as
 * `app_staff`. Everything downstream (RLS policies, capability grants, the
 * admin mutation origin check) is conditioned on getting that one answer
 * right, and until this file existed nothing exercised it at all.
 *
 * Two rules shape these tests:
 *
 *   1. Nothing is asserted against the *source* of the guard. Every case
 *      drives the real exported `handler()` and observes the role and identity
 *      that `withDatabaseRole` was actually asked for. A regex that reads
 *      correctly but classifies wrongly still fails here.
 *   2. The completeness check iterates the exported `PUBLIC_V1` array itself
 *      rather than a copy of it, so a tenth entry added to the guard with no
 *      test alongside it turns this file red instead of sliding through.
 *
 * Only two things are stubbed, both of them infrastructure rather than
 * policy: the database module (there is no Postgres in a unit run, and
 * `withDatabaseRole` is the observation point) and the Neon Auth session
 * provider (a network call). `accessFor`, `PUBLIC_V1`, `authenticateAdmin`,
 * `bucketFor` and the mutation-origin check are all the real thing.
 */

import { readdirSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const observed = vi.hoisted(() => ({ roles: [] as { role: string; identity: string }[] }));

/* The database is the observation point, not a thing under test: every
   classification `accessFor` makes is expressed as a `withDatabaseRole` call,
   so recording those calls records the decision. `db()` is stubbed to a
   counter that is always under the ceiling, because rate limiting is a
   different finding. */
vi.mock("@/server/db/client", () => ({
  db: () => ({ execute: async () => ({ rows: [{ n: 1 }] }) }),
  withDatabaseRole: async (role: string, identity: string, fn: () => Promise<unknown>) => {
    observed.roles.push({ role, identity });
    return fn();
  },
  databaseIdentity: () => "test:identity",
  closeDb: async () => {},
  schema: {},
}));

/* An unauthenticated caller, expressed at the identity provider rather than
   by stubbing `authenticateAdmin`: the real `authenticateAdmin` then runs and
   throws its real `UNAUTHENTICATED` ApiError, which is what the fail-closed
   assertions below are actually reading. */
vi.mock("@/server/core/auth/neon", () => ({
  neonAuth: () => ({ getSession: async () => ({ data: { user: null } }) }),
}));

const { PUBLIC_V1, handler } = await import("@/server/http/handler");

const ORIGIN = "https://lionsofzion.io";

type Classification = {
  status: number;
  code: string | null;
  /** Every role the request was run under, in the order it acquired them. */
  roles: { role: string; identity: string }[];
  /** The role the route body itself ran under — `null` means the ambient login. */
  effective: { role: string; identity: string } | null;
  /** Whether the wrapped route body was reached at all. */
  reached: boolean;
};

/** Drives one request through the real `handler()` wrapper and reports the
 *  access classification the runtime actually applied to it. */
async function classify(
  method: string,
  path: string,
  init: { headers?: Record<string, string> } = {},
): Promise<Classification> {
  observed.roles.length = 0;
  let reached = false;
  const route = handler(async () => {
    reached = true;
    return new Response(JSON.stringify({ ok: true }), { status: 200 });
  });
  const response = await route(
    new Request(`${ORIGIN}${path}`, { method, headers: init.headers }),
  );
  const code = response.ok
    ? null
    : ((await response.clone().json()) as { error?: { code?: string } }).error?.code ?? null;
  return {
    status: response.status,
    code,
    roles: [...observed.roles],
    effective: observed.roles.at(-1) ?? null,
    reached,
  };
}

beforeEach(() => {
  /* Deterministic regardless of the shell that started vitest. `development`
     keeps `appEnv()` off the production branches; the Google session secret is
     forced empty so `readGoogleSession` declines without a cookie. */
  vi.stubEnv("VERCEL_ENV", "development");
  vi.stubEnv("APP_ENV", "development");
  vi.stubEnv("GOOGLE_AUTH_SESSION_SECRET", "");
  vi.stubEnv("NEXT_PUBLIC_SITE_URL", ORIGIN);
  vi.stubEnv("RATE_LIMIT_HMAC_SECRET", "test-only-guard-matrix-key");
  observed.roles.length = 0;
});

afterEach(() => vi.unstubAllEnvs());

/* One concrete request per `PUBLIC_V1` entry. Deliberately hand-written URLs
   rather than generated ones: a generator that derives its samples from the
   same regexes it is testing can only ever agree with them. The completeness
   test below proves this list covers the exported array. */
const PUBLIC_SAMPLES: { method: string; path: string; query?: string; note: string }[] = [
  { method: "GET", path: "/api/v1/search", query: "?q=hamas", note: "public search" },
  { method: "GET", path: "/api/v1/published-items", note: "published item index" },
  { method: "GET", path: "/api/v1/published-publications", note: "publication index" },
  {
    method: "GET",
    path: "/api/v1/published-publications/2026-02-14-daily-brief",
    note: "one published publication (the optional id segment)",
  },
  { method: "POST", path: "/api/v1/reports", note: "anonymous report submission" },
  { method: "POST", path: "/api/v1/volunteer-interest", note: "volunteer interest submission" },
  { method: "GET", path: "/api/v1/chat/threads", note: "chat thread list" },
  { method: "POST", path: "/api/v1/chat/threads", note: "chat thread creation" },
  {
    method: "GET",
    path: "/api/v1/chat/threads/thr_01HZ/messages",
    note: "chat transcript read",
  },
  {
    method: "POST",
    path: "/api/v1/chat/threads/thr_01HZ/messages",
    note: "chat message send",
  },
];

describe("PUBLIC_V1 — the anonymous surface", () => {
  it.each(PUBLIC_SAMPLES)(
    "runs $method $path as app_public with an anonymous identity ($note)",
    async ({ method, path, query }) => {
      const result = await classify(method, `${path}${query ?? ""}`);

      expect(result.effective).not.toBeNull();
      expect(result.effective?.role).toBe("app_public");
      /* The identity is a salted bucket, never a raw address, and never a
         staff or service label. */
      expect(result.effective?.identity).toMatch(/^anonymous:[0-9a-f]{32}$/);
      /* No authentication bootstrap happened: a public request must never
         acquire app_service or app_staff on the way in. */
      expect(result.roles.map((entry) => entry.role)).toEqual(["app_public"]);
      expect(result.reached).toBe(true);
      expect(result.status).toBe(200);
    },
  );

  it("classifies on the pathname only, so a query string cannot change the role", async () => {
    const bare = await classify("GET", "/api/v1/search");
    const withQuery = await classify("GET", "/api/v1/search?q=%2Fapi%2Fv1%2Fitems&limit=5");

    expect(withQuery.effective?.role).toBe(bare.effective?.role);
    expect(withQuery.effective?.role).toBe("app_public");
  });

  it("gives two callers from different addresses different anonymous buckets", async () => {
    const one = await classify("GET", "/api/v1/search", {
      headers: { "x-forwarded-for": "203.0.113.10" },
    });
    const two = await classify("GET", "/api/v1/search", {
      headers: { "x-forwarded-for": "198.51.100.42" },
    });

    expect(one.effective?.identity).not.toBe(two.effective?.identity);
    expect(one.effective?.identity).toMatch(/^anonymous:/);
    expect(two.effective?.identity).toMatch(/^anonymous:/);
  });
});

describe("PUBLIC_V1 — coverage completeness", () => {
  /* Reads the exported array, not a transcription of it: every entry of the
     canonical `PUBLIC_V1` must be matched by at least one sample that the
     suite above actually drives through `handler()`. Add a tenth entry to the
     guard and this fails until a request for it is added here. */
  it("exercises every entry of the exported PUBLIC_V1 array", () => {
    const uncovered = PUBLIC_V1.filter(
      ([method, matcher]) =>
        !PUBLIC_SAMPLES.some(
          (sample) => sample.method === method && matcher.test(sample.path),
        ),
    ).map(([method, matcher]) => `${method} ${matcher.source}`);

    expect(uncovered).toEqual([]);
  });

  it("has no sample that no PUBLIC_V1 entry claims", () => {
    const orphaned = PUBLIC_SAMPLES.filter(
      (sample) =>
        !PUBLIC_V1.some(
          ([method, matcher]) => method === sample.method && matcher.test(sample.path),
        ),
    ).map((sample) => `${sample.method} ${sample.path}`);

    expect(orphaned).toEqual([]);
  });

  it("pins the size of the anonymous surface", () => {
    /* Not a restatement of the array — a review gate. Growing the anonymous
       surface is a security decision, so it has to be a deliberate edit here
       rather than a line that slipped through in a feature branch. */
    expect(PUBLIC_V1.length).toBe(9);
  });
});

describe("internal service prefixes", () => {
  const cases = [
    { path: "/api/internal/cron/briefing", identity: "service:cron" },
    { path: "/api/internal/cron/embed", identity: "service:cron" },
    { path: "/api/internal/queue/briefing/draft", identity: "service:queue" },
    { path: "/api/internal/codex/briefing-import", identity: "service:codex" },
  ];

  it.each(cases)("runs $path as app_service with $identity", async ({ path, identity }) => {
    const result = await classify("POST", path);

    expect(result.effective).toEqual({ role: "app_service", identity });
    expect(result.reached).toBe(true);
    /* A service prefix is a role grant, so it must be the *only* thing that
       matched — it must not also pick up the anonymous or staff paths. */
    expect(result.roles).toHaveLength(1);
  });

  it("does not extend the service role to an internal path outside the three prefixes", async () => {
    const result = await classify("GET", "/api/internal/health");

    expect(result.roles).toEqual([]);
    expect(result.effective).toBeNull();
  });

  it("does not treat a lookalike prefix as a service caller", async () => {
    /* `startsWith("/api/internal/cron/")` includes the trailing slash, so
       `/api/internal/cronies/…` and a bare `/api/internal/cron` are different
       paths. `/api/v1/internal/cron/run` is the interesting one: it is an
       `/api/v1/` path, so it does acquire `app_service` — but only as the
       `service:admin-auth-bootstrap` wrapper around authentication, and it
       must never arrive as a cron/queue/codex caller. */
    const serviceIdentities = ["service:cron", "service:queue", "service:codex"];
    for (const path of [
      "/api/internal/cronies/run",
      "/api/internal/cron",
      "/api/v1/internal/cron/run",
    ]) {
      const result = await classify("POST", path);
      for (const identity of serviceIdentities) {
        expect(result.roles.map((entry) => entry.identity)).not.toContain(identity);
      }
    }

    /* Outside `/api/v1/`, a lookalike gets no role at all. */
    expect((await classify("POST", "/api/internal/cronies/run")).roles).toEqual([]);
    expect((await classify("POST", "/api/internal/cron")).roles).toEqual([]);
    /* Inside it, the lookalike is simply an unlisted v1 path and fails closed. */
    const insideV1 = await classify("POST", "/api/v1/internal/cron/run");
    expect(insideV1.status).toBe(401);
    expect(insideV1.reached).toBe(false);
  });
});

describe("paths outside /api/v1", () => {
  it.each([
    "/api/auth/callback",
    "/api/public-auth/session",
    "/api/public-auth/google",
    "/",
    "/api/v1",
  ])("leaves %s to the ambient login with no role and no identity", async (path) => {
    const result = await classify("GET", path);

    expect(result.roles).toEqual([]);
    expect(result.effective).toBeNull();
    expect(result.reached).toBe(true);
  });
});

describe("fail-closed: an /api/v1 path that PUBLIC_V1 does not name", () => {
  const protectedPaths = [
    "/api/v1/items",
    "/api/v1/items/itm_1",
    "/api/v1/evidence",
    "/api/v1/admin/console/overview",
    "/api/v1/admin/console/users",
    /* A surface that does not exist yet. The guard has to refuse it on the
       strength of not being listed, not on the strength of 404ing. */
    "/api/v1/not-a-route-yet",
  ];

  it.each(protectedPaths)("refuses %s when the caller is unauthenticated", async (path) => {
    const result = await classify("GET", path);

    expect(result.status).toBe(401);
    expect(result.code).toBe("UNAUTHENTICATED");
    /* The two things that matter: the route body never ran, and the request
       was never handed the anonymous role as a fallback. */
    expect(result.reached).toBe(false);
    expect(result.roles.map((entry) => entry.role)).not.toContain("app_public");
    /* It went down the authenticated path — the bootstrap lookup is the
       fingerprint of that branch. */
    expect(result.roles).toEqual([
      { role: "app_service", identity: "service:admin-auth-bootstrap" },
    ]);
  });

  it.each([
    /* The method is half the key. Each of these paths is public for one verb
       and must not inherit that for another. */
    { method: "POST", path: "/api/v1/search" },
    { method: "DELETE", path: "/api/v1/published-items" },
    { method: "PATCH", path: "/api/v1/published-publications/2026-02-14" },
    { method: "GET", path: "/api/v1/reports" },
    { method: "GET", path: "/api/v1/volunteer-interest" },
    { method: "DELETE", path: "/api/v1/chat/threads" },
  ])("refuses $method $path even though the path is public for another verb", async ({ method, path }) => {
    const result = await classify(method, path);

    expect(result.roles.map((entry) => entry.role)).not.toContain("app_public");
    expect(result.reached).toBe(false);
    expect(result.status).toBe(401);
  });

  it.each([
    /* Shapes a too-loose anchor would let through. Each must fail closed. */
    "/api/v1/search/",
    "/api/v1/SEARCH",
    "/api/v1/search/admin",
    "/api/v1/published-publications/2026-02-14/versions",
    "/api/v1/chat/threads/thr_1/messages/msg_1",
    "/api/v1/chat/threads/thr_1",
  ])("does not let %s inherit a neighbouring public route's access", async (path) => {
    const result = await classify("GET", path);

    expect(result.roles.map((entry) => entry.role)).not.toContain("app_public");
    expect(result.reached).toBe(false);
    expect(result.status).toBe(401);
  });
});

describe("the authenticated branch", () => {
  /* `authenticateAdmin` accepts `x-actor-label` in development only; it is the
     supported local sign-in and lets these cases exercise the real staff
     branch without a session provider. */
  const asAdmin = { "x-actor-label": "qa-admin" };

  it("runs an authenticated protected read as app_staff, not app_public", async () => {
    const result = await classify("GET", "/api/v1/admin/console/overview", { headers: asAdmin });

    expect(result.roles).toEqual([
      { role: "app_service", identity: "service:admin-auth-bootstrap" },
      { role: "app_staff", identity: "qa-admin" },
    ]);
    expect(result.effective?.role).toBe("app_staff");
    expect(result.reached).toBe(true);
    expect(result.status).toBe(200);
  });

  it("still requires a same-origin request for a staff mutation", async () => {
    const result = await classify("POST", "/api/v1/admin/console/outbox/drain", {
      headers: asAdmin,
    });

    expect(result.status).toBe(403);
    expect(result.code).toBe("FORBIDDEN");
    expect(result.reached).toBe(false);
  });

  it("admits a same-origin staff mutation", async () => {
    const result = await classify("POST", "/api/v1/admin/console/outbox/drain", {
      headers: { ...asAdmin, origin: ORIGIN, "sec-fetch-site": "same-origin" },
    });

    expect(result.effective?.role).toBe("app_staff");
    expect(result.reached).toBe(true);
    expect(result.status).toBe(200);
  });

  it("does not put a public POST through the staff mutation origin check", async () => {
    /* The mirror of the case above: public submissions are anonymous and
       cross-origin by nature, so the admin CSRF check must not apply to them
       — and equally must not be the thing that was protecting them. */
    const result = await classify("POST", "/api/v1/reports");

    expect(result.effective?.role).toBe("app_public");
    expect(result.status).toBe(200);
  });
});

/* ------------------------------------------------------------------ */
/* Regression protection driven by what is actually on disk.           */
/* ------------------------------------------------------------------ */

const V1_ROUTE_ROOT = fileURLToPath(new URL("../app/api/v1", import.meta.url));

function routeFilesUnder(dir: string): string[] {
  const found: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) found.push(...routeFilesUnder(full));
    else if (entry.name === "route.ts") found.push(full);
  }
  return found.sort();
}

/** `app/api/v1/chat/threads/[id]/messages/route.ts` → `/api/v1/chat/threads/sample-id/messages`.
 *  Dynamic segments become a single opaque placeholder, which is exactly what
 *  the `[^/]+` in the guard's regexes is meant to accept. */
function urlPathFor(file: string): string {
  const relative = file.slice(V1_ROUTE_ROOT.length + 1).replace(/(?:^|[\\/])route\.ts$/, "");
  const segments = relative === "" ? [] : relative.split(/[\\/]/);
  const rendered = segments
    .filter((segment) => !/^\(.*\)$/.test(segment))
    .map((segment) =>
      /^\[.+\]$/.test(segment)
        ? `sample-${segment.slice(1, -1).replace(/^\.{3}/, "")}`
        : segment,
    );
  return ["", "api", "v1", ...rendered].join("/");
}

function methodsFor(file: string): string[] {
  const source = readFileSync(file, "utf8");
  const methods = new Set<string>();
  for (const match of source.matchAll(
    /export\s+(?:async\s+function|function|const)\s+(GET|POST|PUT|PATCH|DELETE|HEAD|OPTIONS)\b/g,
  )) {
    methods.add(match[1]);
  }
  return [...methods].sort();
}

const DISK_ENDPOINTS = routeFilesUnder(V1_ROUTE_ROOT).flatMap((file) =>
  methodsFor(file).map((method) => ({ method, path: urlPathFor(file), file })),
);

/**
 * The complete anonymous surface as it stands, derived from the routes on
 * disk and reviewed as part of this finding. This is not a copy of
 * `PUBLIC_V1` — it is the *intersection* of the guard with the routes that
 * actually exist, so both a new guard entry and a new route file that happens
 * to fall under an existing regex will change it.
 */
const REVIEWED_PUBLIC_ENDPOINTS = [
  "GET /api/v1/chat/threads",
  "GET /api/v1/chat/threads/sample-id/messages",
  "GET /api/v1/published-items",
  "GET /api/v1/published-publications",
  "GET /api/v1/published-publications/sample-publicId",
  "GET /api/v1/search",
  "POST /api/v1/chat/threads",
  "POST /api/v1/chat/threads/sample-id/messages",
  "POST /api/v1/reports",
  "POST /api/v1/volunteer-interest",
];

describe("every route on disk under app/api/v1", () => {
  it("found routes to check", () => {
    expect(DISK_ENDPOINTS.length).toBeGreaterThan(50);
    /* A route file with no recognised method export would be silently
       skipped, which would be a hole in this sweep rather than a pass. */
    const methodless = routeFilesUnder(V1_ROUTE_ROOT).filter(
      (file) => methodsFor(file).length === 0,
    );
    expect(methodless).toEqual([]);
  });

  it("is either named by PUBLIC_V1 or fails closed when called unauthenticated", async () => {
    const wrong: string[] = [];
    for (const endpoint of DISK_ENDPOINTS) {
      const expectedPublic = PUBLIC_V1.some(
        ([method, matcher]) => method === endpoint.method && matcher.test(endpoint.path),
      );
      const result = await classify(endpoint.method, endpoint.path);
      const actuallyPublic = result.effective?.role === "app_public";

      if (actuallyPublic !== expectedPublic) {
        wrong.push(`${endpoint.method} ${endpoint.path} (expected public=${expectedPublic})`);
        continue;
      }
      if (!expectedPublic && !(result.status === 401 && result.reached === false)) {
        wrong.push(
          `${endpoint.method} ${endpoint.path} did not fail closed: status=${result.status} reached=${result.reached}`,
        );
      }
    }

    expect(wrong).toEqual([]);
  });

  it("exposes exactly the reviewed anonymous surface and nothing more", async () => {
    const publicNow: string[] = [];
    for (const endpoint of DISK_ENDPOINTS) {
      const result = await classify(endpoint.method, endpoint.path);
      if (result.effective?.role === "app_public") {
        publicNow.push(`${endpoint.method} ${endpoint.path}`);
      }
    }

    expect(publicNow.sort()).toEqual(REVIEWED_PUBLIC_ENDPOINTS);
  });

  it("has a real route file behind every PUBLIC_V1 entry", () => {
    /* A guard entry with no route behind it is either a typo or a leftover,
       and both are the kind of thing that only shows up when someone later
       adds a route at that path and inherits anonymous access by accident. */
    const dead = PUBLIC_V1.filter(
      ([method, matcher]) =>
        !DISK_ENDPOINTS.some(
          (endpoint) => endpoint.method === method && matcher.test(endpoint.path),
        ),
    ).map(([method, matcher]) => `${method} ${matcher.source}`);

    expect(dead).toEqual([]);
  });
});
