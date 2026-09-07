import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

/**
 * The scheduled ChatGPT editor's interface, at the boundary.
 *
 * Authentication first, because it is the whole reason this surface can exist:
 * a route that reads site state and operates on it, reachable by a scheduled
 * task with no human session. The guard must refuse before it parses, must
 * never echo the secret, and must file everything it does under an identity
 * that is neither the human admin nor the package delivery service.
 */

const mocks = vi.hoisted(() => ({
  editorialContext: vi.fn(),
  invoke: vi.fn(),
  opsView: vi.fn(),
  list: vi.fn(),
  resolveEditorialTarget: vi.fn(),
  registerActor: vi.fn(),
}));

vi.mock("@/server/modules/chatgpt-automation", () => ({
  chatgptAutomation: () => ({
    editorialContext: mocks.editorialContext,
    invoke: mocks.invoke,
    opsView: mocks.opsView,
  }),
}));
vi.mock("@/server/modules/publications", () => ({
  publications: () => ({ list: mocks.list, resolveEditorialTarget: mocks.resolveEditorialTarget }),
}));
/* Fully mocked, like the other internal-route suites: the real module reaches
   Neon Auth and `next/headers`, which a node-environment test cannot load. The
   property under test is that the guard registers the automation's own actor,
   so asserting the call is the assertion. */
vi.mock("@/server/core/auth/actor", () => ({
  authenticateAdmin: vi.fn(),
  registerActor: mocks.registerActor,
  requireActor: vi.fn(),
}));
vi.mock("@/server/db/client", async importOriginal => ({
  ...(await importOriginal<typeof import("@/server/db/client")>()),
  withDatabaseRole: (_role: string, _identity: string, fn: () => Promise<unknown>) => fn(),
}));

import { CHATGPT_ACTOR_LABEL } from "@/server/contracts/chatgpt-automation";
import { requireChatgptAutomationSecret } from "@/server/http/internal-guard";
import { GET as contextRoute } from "@/app/api/internal/chatgpt/editorial-context/route";
import { POST as actionsRoute } from "@/app/api/internal/chatgpt/actions/route";

const SECRET = "chatgpt-automation-test-secret";
const CONTEXT_URL = "https://lionsofzion.io/api/internal/chatgpt/editorial-context";
const ACTIONS_URL = "https://lionsofzion.io/api/internal/chatgpt/actions";

function authed(url: string, init: RequestInit = {}, supplied = SECRET): Request {
  return new Request(url, {
    ...init,
    headers: { "content-type": "application/json", "x-chatgpt-automation-secret": supplied },
  });
}

beforeEach(() => {
  process.env.CHATGPT_AUTOMATION_SECRET = SECRET;
  for (const mock of Object.values(mocks)) mock.mockReset();
  mocks.editorialContext.mockResolvedValue({ editionDate: "2026-09-07", publications: [], warnings: [] });
  mocks.invoke.mockResolvedValue({ tool: "get_overview", ranAs: null, substitutionNote: null, summary: "ok", result: {} });
});
afterEach(() => { delete process.env.CHATGPT_AUTOMATION_SECRET; });

describe("the ChatGPT automation guard", () => {
  it("refuses a request with no secret, and never echoes the expected one", async () => {
    const response = await contextRoute(new Request(CONTEXT_URL));
    expect(response.status).toBe(401);
    expect(response.headers.get("content-type")).toContain("application/problem+json");
    const body = await response.json();
    expect(body.error.code).toBe("UNAUTHENTICATED");
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(mocks.editorialContext).not.toHaveBeenCalled();
  });

  it("refuses a wrong secret without echoing either value", async () => {
    const response = await contextRoute(authed(CONTEXT_URL, {}, "not-the-secret"));
    expect(response.status).toBe(401);
    const body = await response.json();
    expect(JSON.stringify(body)).not.toContain(SECRET);
    expect(JSON.stringify(body)).not.toContain("not-the-secret");
  });

  /* Guard-before-parse. A body that cannot be parsed would surface as 422 if
     the order were wrong, which would tell an unauthenticated caller that its
     request reached the schema. */
  it("never parses the body when the secret is wrong", async () => {
    const response = await actionsRoute(
      new Request(ACTIONS_URL, {
        method: "POST",
        headers: { "content-type": "application/json", "x-chatgpt-automation-secret": "wrong" },
        body: "{ not json at all",
      }),
    );
    expect(response.status).toBe(401);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("is a configuration error, not an open door, when the secret is unset", async () => {
    delete process.env.CHATGPT_AUTOMATION_SECRET;
    const response = await contextRoute(authed(CONTEXT_URL));
    expect(response.status).toBe(500);
    expect(mocks.editorialContext).not.toHaveBeenCalled();
  });

  /* The label is fixed in the guard and never read from the request: a caller
     that could name its own actor could file its actions under someone else. */
  it("registers the automation's own actor, not a human and not the delivery service", () => {
    const request = authed(CONTEXT_URL, {}, SECRET);
    requireChatgptAutomationSecret(request);
    expect(mocks.registerActor).toHaveBeenCalledWith(request, { label: "service:chatgpt-editorial", userId: null });
    expect(CHATGPT_ACTOR_LABEL).toBe("service:chatgpt-editorial");
    expect(CHATGPT_ACTOR_LABEL).not.toBe("service:editorial-updates");
  });

  it("registers nothing when the secret is wrong", () => {
    expect(() => requireChatgptAutomationSecret(authed(CONTEXT_URL, {}, "wrong"))).toThrow();
    expect(mocks.registerActor).not.toHaveBeenCalled();
  });

  it("admits a correct secret and answers with the context", async () => {
    const response = await contextRoute(authed(`${CONTEXT_URL}?limit=5`));
    expect(response.status).toBe(200);
    await expect(response.json()).resolves.toMatchObject({ editionDate: "2026-09-07" });
    expect(mocks.editorialContext).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 5, include: [] }), expect.anything(),
    );
  });

  /* The expensive console reads fan out to six and eight queries; a default
     that included them would make the one cheap call the run depends on slow. */
  it("keeps the expensive console reads opt-in", async () => {
    await contextRoute(authed(`${CONTEXT_URL}?include=incidents,costs`));
    expect(mocks.editorialContext).toHaveBeenCalledWith(
      expect.objectContaining({ include: ["incidents", "costs"] }), expect.anything(),
    );
  });

  it("rejects an unknown tool name before it reaches the registry", async () => {
    const response = await actionsRoute(
      authed(ACTIONS_URL, { method: "POST", body: JSON.stringify({ tool: "drop_everything", args: {} }) }),
    );
    expect(response.status).toBe(422);
    expect(mocks.invoke).not.toHaveBeenCalled();
  });

  it("passes a named tool and its arguments through with the request id", async () => {
    const response = await actionsRoute(
      authed(ACTIONS_URL, { method: "POST", body: JSON.stringify({ tool: "get_overview", args: {} }) }),
    );
    expect(response.status).toBe(200);
    expect(mocks.invoke).toHaveBeenCalledWith("get_overview", {}, expect.any(String));
  });
});
