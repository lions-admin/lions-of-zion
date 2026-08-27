import { beforeAll, describe, expect, it, vi } from "vitest";

/* `actor.ts` reaches Neon Auth at module scope, which wants `next/headers` —
   absent in the node test environment. Nothing here touches the session path,
   so the adapter is stubbed rather than the test skipped. */
vi.mock("@/server/core/auth/neon", () => ({
  neonAuth: () => ({ getSession: async () => ({ data: null }) }),
}));

type ActorModule = typeof import("@/server/core/auth/actor");
let mod: ActorModule;

beforeAll(async () => {
  /* The development branch of `authenticateAdmin` grants the same capability
     set as the production one, without needing a session or a database. */
  process.env.APP_ENV = "development";
  mod = await import("@/server/core/auth/actor");
});

/**
 * The single admin holds every capability, and must keep holding them.
 *
 * This is the project's deliberate position, not a stage on the way to
 * something finer. There is one account: `ADMIN_EMAIL` is the only address the
 * auth proxy accepts a signup for, `ensureAdminActor` is the only writer of
 * `app_user`, and `requireCapability` is called from nowhere on purpose.
 *
 * The risk pinned here is the reverse of the usual one. Not that someone gets
 * too much access — that a future tidy-up narrows the grant, or starts
 * enforcing it, and locks the owner out of their own admin area.
 *
 * If you are here because a second account now exists — an editor who may
 * write an assessment but not publish it — this is the file that should change
 * first, and `requireCapability` is what should start being called.
 */
describe("the single admin's capabilities", () => {
  it("covers every operation the system gates on", () => {
    expect([...mod.ADMIN_CAPABILITIES].sort()).toEqual([
      "approval.grant",
      "assessment.approve",
      "assessment.publish",
      "evidence.restricted.read",
      "policy.manage",
    ]);
  });

  it("are all granted to an authenticated admin, so no check can refuse the owner", async () => {
    const request = new Request("https://example.test/api/v1/items", {
      headers: { "x-actor-label": "owner" },
    });
    const actor = await mod.authenticateAdmin(request);
    for (const capability of mod.ADMIN_CAPABILITIES) {
      expect(() => mod.requireCapability(actor, capability), capability).not.toThrow();
    }
  });

  it("still fail closed for a capability nobody holds", async () => {
    /* The function is correct; it is simply not called. This is the behaviour
       it would bring if it ever were. */
    const request = new Request("https://example.test/api/v1/items", {
      headers: { "x-actor-label": "owner" },
    });
    const actor = await mod.authenticateAdmin(request);
    expect(() => mod.requireCapability(actor, "billing.refund")).toThrow(
      /Missing required capability/,
    );
  });

  it("are granted to nobody who merely arrived anonymously", () => {
    /* `registerActor` is the anonymous path and grants nothing — an anonymous
       visitor holds no capability at all, which is why the public surface is
       bounded by PUBLIC_V1 and RLS rather than by this. */
    const request = new Request("https://example.test/api/v1/search");
    const anon = { label: "anonymous:abc", userId: null };
    mod.registerActor(request, anon);
    expect(() => mod.requireCapability(anon, "assessment.publish")).toThrow(
      /Missing required capability/,
    );
  });
});
