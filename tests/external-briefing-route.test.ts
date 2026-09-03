import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-level test for the guard/parsing layer only.
 *
 * `POST /api/internal/briefing/external-publish` never matches
 * `/api/internal/cron/`, `/api/internal/queue/` or `/api/v1/`, so
 * `server/http/handler.ts`'s `accessFor()` returns `null` for it and the real
 * `handler()` wrapper never touches `withDatabaseRole`/`db()` for this route.
 * That makes it safe to exercise the real `handler()`, `parseBody()`,
 * `requireExternalBriefingSecret()` and `externalBriefingPackageSchema`
 * end-to-end, with no PGlite database and no dev server — the same
 * `problem+json` shapes a live deployment would return.
 *
 * `server/modules/briefing/external-publish.ts` (the sibling agent's service)
 * is mocked out: these three cases never reach it, and the module doesn't
 * need to exist yet for this test to prove the guard/parse/schema layer is
 * correct.
 */

const mocks = vi.hoisted(() => ({
  publish: vi.fn(async () => {
    throw new Error("the route-level guard/parsing tests should never reach the service");
  }),
}));

vi.mock("@/server/modules/briefing", () => ({
  externalBriefingPublish: () => ({ publish: mocks.publish }),
}));

/* `server/http/handler.ts` statically imports `authenticateAdmin`/`registerActor`
 * from here, which pulls in Neon Auth's Next integration. This route's access
 * path never calls either (its path matches none of `accessFor()`'s guarded
 * prefixes), but the import still loads at module evaluation time — the same
 * reason `deep-health-route.test.ts` mocks this module rather than the real
 * one. */
vi.mock("@/server/core/auth/actor", () => ({
  authenticateAdmin: vi.fn(),
  registerActor: vi.fn(),
  requireActor: vi.fn(),
}));

import { POST } from "@/app/api/internal/briefing/external-publish/route";

const SECRET = "unit-test-external-briefing-secret";
const ENDPOINT = "https://lionsofzion.io/api/internal/briefing/external-publish";

function request(options: { secret?: string | null; body: string }): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.secret !== null) headers.set("x-external-briefing-secret", options.secret ?? "wrong-secret");
  return new Request(ENDPOINT, { method: "POST", headers, body: options.body });
}

describe("POST /api/internal/briefing/external-publish", () => {
  const previousSecret = process.env.EXTERNAL_BRIEFING_INGEST_SECRET;

  beforeEach(() => {
    process.env.EXTERNAL_BRIEFING_INGEST_SECRET = SECRET;
    mocks.publish.mockClear();
  });

  afterEach(() => {
    process.env.EXTERNAL_BRIEFING_INGEST_SECRET = previousSecret;
  });

  it("rejects a missing secret with a 401 problem+json body that leaks nothing", async () => {
    const response = await POST(request({ secret: null, body: "{}" }));
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/problem+json");

    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(mocks.publish).not.toHaveBeenCalled();

    // The secret value must never appear anywhere in the response.
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("rejects a wrong secret with a 401 problem+json body that leaks nothing", async () => {
    const response = await POST(request({ secret: "definitely-not-it", body: "{}" }));
    expect(response.status).toBe(401);

    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(mocks.publish).not.toHaveBeenCalled();
    expect(JSON.stringify(body)).not.toContain(SECRET);
  });

  it("never parses the body when the secret is wrong (validation failure never fires first)", async () => {
    // A body that would blow up JSON.parse if it were ever read.
    const response = await POST(request({ secret: "wrong", body: "{ this is not json" }));
    const body = await response.json();
    // If the guard ran after parsing, this would be a VALIDATION_ERROR for bad
    // JSON instead — the guard must win, per requirement 1.
    expect(body.error.code).toBe("UNAUTHENTICATED");
  });

  it("turns a malformed JSON body into a 4xx validation-style error, not a 500", async () => {
    const response = await POST(request({ secret: SECRET, body: "{ not valid json" }));
    expect(response.status).toBe(422);
    expect(response.headers.get("content-type")).toContain("application/problem+json");

    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(body.error.message).toBe("Request body is not valid JSON");
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("turns a well-formed but schema-invalid package into a 4xx with field-path detail", async () => {
    // Valid JSON, but missing runId (and everything else) — a real composer
    // mistake, not a malformed request.
    const response = await POST(request({ secret: SECRET, body: JSON.stringify({}) }));
    expect(response.status).toBe(422);

    const body = await response.json();
    expect(body.error.code).toBe("VALIDATION_ERROR");
    expect(Array.isArray(body.error.errors)).toBe(true);

    const paths = body.error.errors.map((issue: { path: unknown[] }) => issue.path.join("."));
    expect(paths).toContain("runId");
    expect(mocks.publish).not.toHaveBeenCalled();
  });

  it("surfaces every failing field path, not just the first", async () => {
    const response = await POST(request({
      secret: SECRET,
      body: JSON.stringify({ runId: "short" }), // fails min(8) AND everything else is still missing
    }));
    expect(response.status).toBe(422);

    const body = await response.json();
    const paths: string[] = body.error.errors.map((issue: { path: unknown[] }) => issue.path.join("."));
    expect(paths).toContain("runId");
    expect(paths).toContain("localDate");
    expect(paths).toContain("composer");
    expect(paths).toContain("publishers");
    expect(paths).toContain("citations");
    expect(paths).toContain("dailyBrief");
  });
});
