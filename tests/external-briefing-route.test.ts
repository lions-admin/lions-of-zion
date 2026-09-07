import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/** The real request guard still protects the retired route; authenticated
 * clients receive a stable refusal, even for a formerly valid package. */
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
import { POST as codexPOST } from "@/app/api/internal/codex/briefing-import/route";

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

  it.each(["{ not valid json", "{}", validPackageBody()])("refuses authenticated legacy delivery without publishing", async (body) => {
    const response = await POST(request({ secret: SECRET, body }));
    expect(response.status).toBe(412);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    const result = await response.json();
    expect(result.error.code).toBe("PRECONDITION_FAILED");
    expect(result.error.message).toContain("Legacy editorial publishing is retired");
    expect(mocks.publish).not.toHaveBeenCalled();
  });
});


describe("retired Codex briefing import", () => {
  afterEach(() => vi.unstubAllEnvs());

  it("rejects unauthenticated delivery", async () => {
    vi.stubEnv("CODEX_BRIEFING_IMPORT_SECRET", SECRET);
    const response = await codexPOST(new Request("https://lionsofzion.io/api/internal/codex/briefing-import", { method: "POST", body: "{}" }));
    expect(response.status).toBe(401);
  });

  it("refuses authenticated delivery before reading its body", async () => {
    vi.stubEnv("CODEX_BRIEFING_IMPORT_SECRET", SECRET);
    const req = new Request("https://lionsofzion.io/api/internal/codex/briefing-import", { method: "POST", headers: { authorization: `Bearer ${SECRET}` }, body: "not-json" });
    const response = await codexPOST(req);
    expect(response.status).toBe(412);
    expect((await response.json()).error.message).toContain("Legacy editorial publishing is retired");
    expect(req.bodyUsed).toBe(false);
  });
});
