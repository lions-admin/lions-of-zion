import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * Route-level test for the guard/parsing layer only.
 *
 * This exercises the real `handler()`, `parseBody()`,
 * `requireExternalBriefingSecret()` and `externalBriefingPackageSchema`
 * end-to-end with no dev server, returning the same `problem+json` shapes a
 * live deployment would.
 *
 * It used to need no database either: the route matched none of
 * `accessFor()`'s service prefixes, so `handler()` ran it with
 * `access === null`. That was the bug, not a feature — the route filed whole
 * editions outside RLS. Since 2026-09-05 it runs as `app_service`, and the
 * one pooled-connection dependency that introduces is stubbed below, with the
 * reasoning for why that stub is legitimate here.
 *
 * `server/modules/briefing/external-publish.ts` (the sibling agent's service)
 * is mocked out: these three cases never reach it, and the module doesn't
 * need to exist yet for this test to prove the guard/parse/schema layer is
 * correct.
 */

/* Typed as the service's own result so a case may override it with a real
   payload; the default still throws, because the guard/parsing cases must
   never reach the service. */
const mocks = vi.hoisted(() => ({
  publish: vi.fn(async (): Promise<unknown> => {
    throw new Error("the route-level guard/parsing tests should never reach the service");
  }),
}));

vi.mock("@/server/modules/briefing", () => ({
  externalBriefingPublish: () => ({ publish: mocks.publish }),
}));

/* `server/http/handler.ts` statically imports `authenticateAdmin`/`registerActor`
 * from here, which pulls in Neon Auth's Next integration. This route's access
 * path never calls either, but the import still loads at module evaluation
 * time — the same reason `deep-health-route.test.ts` mocks this module rather
 * than the real one. */
vi.mock("@/server/core/auth/actor", () => ({
  authenticateAdmin: vi.fn(),
  registerActor: vi.fn(),
  requireActor: vi.fn(),
}));

/* `withDatabaseRole` as a pass-through, and the reason matters.
 *
 * Until 2026-09-05 this route matched none of `accessFor()`'s service
 * prefixes, so `handler()` ran it with `access === null` and touched no
 * database at all — which is what made an end-to-end route test possible with
 * no PGlite and no dev server. Securing the route (it now runs as
 * `app_service`, like its `/api/internal/codex/` sibling) means `handler()`
 * opens a real pooled Neon connection, which no unit test can supply.
 *
 * This is deliberately NOT the same thing as the pass-through in
 * `admin-console-p2.test.ts` and `admin-console-drilldown.test.ts`. Those
 * mock the wrapper away from code whose behaviour depends on the role, so the
 * role goes untested. Everything asserted below — the secret guard, the
 * problem+json shapes, the schema field paths — runs inside `fn` and is
 * indifferent to which role holds the connection. What the wrapper actually
 * does is covered separately by `tests/rls.test.ts`.
 *
 * The property this file can no longer prove is that the route is wrapped at
 * all. That belongs in an `accessFor()` unit test — see the batch that adds
 * one for `PUBLIC_V1`. */
vi.mock("@/server/db/client", async (importOriginal) => ({
  ...(await importOriginal<typeof import("@/server/db/client")>()),
  withDatabaseRole: (_role: string, _identity: string, fn: () => Promise<unknown>) => fn(),
}));

import { POST } from "@/app/api/internal/briefing/external-publish/route";

const SECRET = "unit-test-external-briefing-secret";
const ENDPOINT = "https://lionsofzion.io/api/internal/briefing/external-publish";

function request(options: { secret?: string | null; body: string }): Request {
  const headers = new Headers({ "content-type": "application/json" });
  if (options.secret !== null) headers.set("x-external-briefing-secret", options.secret ?? "wrong-secret");
  return new Request(ENDPOINT, { method: "POST", headers, body: options.body });
}


/* A schema-valid package. The route parses the real
   `externalBriefingPackageSchema`, so reaching the service at all requires a
   structurally complete body; the content itself is irrelevant here because
   the service is mocked. */
function validPackageBody(): string {
  const excerpt =
    "The Israeli security cabinet convened on Sunday and confirmed that the armed forces maintain a heightened "
    + "readiness posture along the northern frontier in response to ongoing regional tensions and will continue "
    + "coordinated defensive preparations throughout the coming week.";
  return JSON.stringify({
    runId: "route-warning-run-0001",
    localDate: "2026-09-06",
    contractVersion: "external-briefing-v1",
    composer: "route-test",
    publishers: [{
      key: "jpost",
      name: "Jerusalem Post",
      homepageUrl: "https://www.jpost.com",
      language: "en",
      country: "IL",
      official: false,
    }],
    citations: [{
      key: "c-jpost",
      publisherKey: "jpost",
      title: "Jerusalem Post Details Continued Northern Frontier Preparations",
      url: "https://www.jpost.com/article/frontier-preparations",
      publishedAt: "2026-09-06T09:00:00Z",
      excerpt,
      language: "en",
    }],
    dailyBrief: {
      title: "Northern Frontier Readiness Posture Holds Steady Amid Regional Tensions",
      summary: "A summary of the northern frontier readiness posture amid continuing regional tensions.",
      citationKeys: ["c-jpost"],
      claims: [{
        title: "Reporting describes an elevated readiness posture",
        text: "Reporting describes an elevated readiness posture along the northern frontier amid regional tensions.",
        layer: "source_claim",
        assessment: "verified",
        attributedTo: "Jerusalem Post",
        uncertainty: "This rests on a single non-official publisher family.",
        citationLinks: [{
          citationKey: "c-jpost",
          relation: "supports",
          strength: "adequate",
          rationale: "The report directly describes this readiness posture.",
        }],
      }],
      situation: {
        label: "Situation",
        passages: [{
          text: "Forces along the northern frontier remain on a heightened readiness posture as regional tensions continue.",
          claimIndex: 0,
          citationKeys: ["c-jpost"],
        }],
      },
      keyEvents: {
        label: "Key Events",
        passages: [{
          text: "Military correspondents reported additional coordinated preparations along the northern frontier this week.",
          claimIndex: 0,
          citationKeys: ["c-jpost"],
        }],
      },
      israeliPosition: null,
      internationalResponses: null,
      watchPoints: {
        label: "Watch Points",
        passages: [{
          text: "Coordinated defensive preparations along the northern frontier are expected to continue this week.",
          claimIndex: 0,
          citationKeys: ["c-jpost"],
        }],
      },
    },
    articles: [],
  });
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

  /* Editorial warnings are not validation failures.
   *
   * `daily_brief_official_context` and `title_source_alignment` used to make
   * this route answer 422 VALIDATION_ERROR. They are advisory now: the service
   * publishes and reports them, and the route must pass that through as a 200
   * with the warnings in the body. 4xx is reserved for malformed or unsafe
   * input, which the cases above still cover. */
  it("returns 200 with warnings when the package publishes with editorial warnings", async () => {
    mocks.publish.mockImplementationOnce(async () => ({
      runId: "route-warning-run-0001",
      status: "draft",
      localDate: "2026-09-06",
      evidenceCreated: 1,
      publications: [],
      briefUrl: "https://lionsofzion.io/geopolitical-brief",
      warnings: [
        {
          candidateKey: "daily-brief",
          check: "daily_brief_official_context",
          detail: "The Daily Brief requires at least one official Israeli source.",
        },
        {
          candidateKey: "daily-brief",
          check: "title_source_alignment",
          detail: "The title is not sufficiently anchored in the cited source material.",
        },
      ],
    }));

    const response = await POST(request({ secret: SECRET, body: validPackageBody() }));

    expect(response.status).toBe(200);
    expect(mocks.publish).toHaveBeenCalledTimes(1);

    const body = await response.json();
    expect(body.error).toBeUndefined();
    expect(body.warnings.map((warning: { check: string }) => warning.check)).toEqual([
      "daily_brief_official_context",
      "title_source_alignment",
    ]);
  });
});
