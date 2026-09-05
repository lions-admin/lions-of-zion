import { NextRequest } from "next/server";
import { afterEach, describe, expect, it, vi } from "vitest";
import { GET as callbackRoute } from "@/app/auth/x/callback/route";
import { GET as beginRoute } from "@/app/auth/x/route";
import { GET as sessionRoute } from "@/app/api/public-auth/session/route";
import { publicSessionResponseSchema } from "@/server/contracts/public-session";
import {
  GOOGLE_SESSION_COOKIE,
  createGoogleSession,
  googlePublicAuthAvailability,
} from "@/server/core/auth/google-session";
import {
  X_OAUTH_STATE_COOKIE,
  X_PUBLIC_SESSION_COOKIE,
  beginPublicXAuthorization,
  createPublicSession,
  publicXAvailability,
} from "@/server/core/auth/public-x";

/**
 * No database. This is cookies, signatures and redirects — `freshDatabase()`
 * would add a Postgres-in-WASM instance to a file that never issues a query.
 */

const X_CLIENT_ID = "test-x-client-id";
const X_CLIENT_SECRET = "test-x-client-secret-never-leaves-the-server";
const X_SIGNING_SECRET = "x-session-signing-secret-for-tests-0123456789";
const GOOGLE_CLIENT_ID = "test-google-client-id.apps.googleusercontent.com";
const GOOGLE_SIGNING_SECRET = "google-session-signing-secret-for-tests-0123456789";

const X_KEYS = ["X_OAUTH_CLIENT_ID", "X_OAUTH_CLIENT_SECRET", "X_AUTH_SESSION_SECRET"] as const;
const ENVIRONMENT_KEYS = ["VERCEL_ENV", "APP_ENV"] as const;

const saved = { ...process.env };

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, saved);
  vi.restoreAllMocks();
  vi.unstubAllGlobals();
});

/** Credentials present and the deployment claiming production: `ready`. */
function configureX(): void {
  process.env.VERCEL_ENV = "production";
  process.env.X_OAUTH_CLIENT_ID = X_CLIENT_ID;
  process.env.X_OAUTH_CLIENT_SECRET = X_CLIENT_SECRET;
  process.env.X_AUTH_SESSION_SECRET = X_SIGNING_SECRET;
}

function unconfigureX(): void {
  for (const key of X_KEYS) delete process.env[key];
}

function configureGoogle(): void {
  process.env.NEXT_PUBLIC_GOOGLE_IDENTITY_CLIENT_ID = GOOGLE_CLIENT_ID;
  process.env.GOOGLE_AUTH_SESSION_SECRET = GOOGLE_SIGNING_SECRET;
}

function developmentEnvironment(): void {
  for (const key of ENVIRONMENT_KEYS) delete process.env[key];
}

/**
 * A request that carries a `Host`, the way every real one does.
 *
 * `new NextRequest(url)` sets no host header, and X availability is decided by
 * the request's origin rather than by an environment variable — so a test
 * request without one would report `production-only` and prove nothing about
 * the endpoint. The header is derived from the URL, so the two cannot drift.
 */
function liveRequest(url: string, headers: Record<string, string> = {}): NextRequest {
  const { host, protocol } = new URL(url);
  return new NextRequest(url, {
    headers: { host, "x-forwarded-proto": protocol.replace(":", ""), ...headers },
  });
}

function sessionRequest(
  cookies: Record<string, string> = {},
  origin = "https://lionsofzion.io",
): NextRequest {
  const cookie = Object.entries(cookies)
    .map(([name, value]) => `${name}=${value}`)
    .join("; ");
  return liveRequest(`${origin}/api/public-auth/session`, cookie ? { cookie } : {});
}

async function readSession(cookies: Record<string, string> = {}, origin?: string) {
  const response = await sessionRoute(sessionRequest(cookies, origin));
  expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
  return publicSessionResponseSchema.parse(await response.json());
}

const profile = {
  id: "1730000000000000000",
  username: "lionsofzion",
  name: "Lions of Zion",
  image: "https://pbs.twimg.com/profile_images/1/avatar.jpg",
};

describe("the public session endpoint", () => {
  it("answers both providers as null when nothing is signed in", async () => {
    configureGoogle();
    configureX();
    const body = await readSession();
    expect(body).toEqual({
      user: null,
      x: null,
      availability: { google: "ready", x: "ready" },
    });
  });

  it("keeps the Google identity under its original `user` key and shape", async () => {
    configureGoogle();
    configureX();
    const token = await createGoogleSession({
      id: "google:118",
      email: "reader@example.com",
      name: "A Reader",
    });
    const body = await readSession({ [GOOGLE_SESSION_COOKIE]: token });
    expect(body.user).toEqual({ id: "google:118", email: "reader@example.com", name: "A Reader" });
    // The three keys callers that predate X already depend on — no more.
    expect(Object.keys(body.user ?? {}).sort()).toEqual(["email", "id", "name"]);
    expect(body.x).toBeNull();
  });

  it("returns the X identity without the profile image", async () => {
    configureGoogle();
    configureX();
    const body = await readSession({ [X_PUBLIC_SESSION_COOKIE]: createPublicSession(profile) });
    expect(body.x).toEqual({ id: profile.id, username: "lionsofzion", name: "Lions of Zion" });
    expect(JSON.stringify(body)).not.toContain("pbs.twimg.com");
    expect(body.user).toBeNull();
  });

  it("carries both identities side by side, neither merged into the other", async () => {
    configureGoogle();
    configureX();
    const token = await createGoogleSession({
      id: "google:118",
      email: "reader@example.com",
      name: "A Reader",
    });
    const body = await readSession({
      [GOOGLE_SESSION_COOKIE]: token,
      [X_PUBLIC_SESSION_COOKIE]: createPublicSession(profile),
    });
    expect(body.user?.email).toBe("reader@example.com");
    expect(body.x?.username).toBe("lionsofzion");
    expect(body.availability).toEqual({ google: "ready", x: "ready" });
  });

  it("refuses an expired X session cookie", async () => {
    configureX();
    const clock = vi.spyOn(Date, "now").mockReturnValue(Date.now() - 13 * 60 * 60 * 1000);
    const stale = createPublicSession(profile);
    clock.mockRestore();

    const body = await readSession({ [X_PUBLIC_SESSION_COOKIE]: stale });
    expect(body.x).toBeNull();
  });

  it("refuses an X session cookie whose signature has been edited", async () => {
    configureX();
    const valid = createPublicSession(profile);
    const tampered = `${valid.slice(0, -1)}${valid.endsWith("A") ? "B" : "A"}`;
    expect(tampered).not.toBe(valid);

    expect((await readSession({ [X_PUBLIC_SESSION_COOKIE]: tampered })).x).toBeNull();
    // And a payload edited under an unchanged signature fares no better.
    const [encoded, signature] = valid.split(".");
    const forged = `${Buffer.from(
      JSON.stringify({ version: 1, profile: { id: "1", username: "impostor" }, expiresAt: 4102444800 }),
      "utf8",
    ).toString("base64url")}.${signature}`;
    expect(forged).not.toBe(`${encoded}.${signature}`);
    expect((await readSession({ [X_PUBLIC_SESSION_COOKIE]: forged })).x).toBeNull();
  });

  it("ignores an X cookie that a deployment without X credentials could not have issued", async () => {
    configureX();
    const cookie = createPublicSession(profile);
    unconfigureX();
    developmentEnvironment();

    const body = await readSession({ [X_PUBLIC_SESSION_COOKIE]: cookie });
    expect(body.x).toBeNull();
    expect(body.availability.x).toBe("unconfigured");
  });

  /* A session cookie copied out of production onto a laptop is still a valid
     signature. What disqualifies it is the origin asking, not the cookie. */
  it("ignores an X cookie carried onto an origin that cannot complete the flow", async () => {
    configureX();
    const cookie = createPublicSession(profile);

    const body = await readSession({ [X_PUBLIC_SESSION_COOKIE]: cookie }, "http://localhost:3100");
    expect(body.x).toBeNull();
    expect(body.availability.x).toBe("production-only");
  });

  /* And the environment cannot talk it back into being ready. */
  it("ignores it even when the local environment calls itself production", async () => {
    configureX();
    const cookie = createPublicSession(profile);
    process.env.VERCEL_ENV = "production";

    const body = await readSession({ [X_PUBLIC_SESSION_COOKIE]: cookie }, "http://localhost:3100");
    expect(body.x).toBeNull();
    expect(body.availability.x).toBe("production-only");
  });
});

/** The origin X was told to return to; the only one where the flow can finish. */
const liveOrigin = new Headers({ host: "lionsofzion.io", "x-forwarded-proto": "https" });

describe("provider availability", () => {
  it("reports X ready only when every credential is present on the live origin", () => {
    configureX();
    expect(publicXAvailability(liveOrigin)).toBe("ready");
    for (const key of X_KEYS) {
      configureX();
      delete process.env[key];
      expect(publicXAvailability(liveOrigin)).toBe("unconfigured");
    }
  });

  it("reports X production-only anywhere but the registered callback origin", () => {
    configureX();
    for (const headers of [
      new Headers({ host: "localhost:3000" }),
      new Headers({ host: "localhost:3000", "x-forwarded-proto": "http" }),
      new Headers({ host: "lions-of-zion-git-preview.vercel.app", "x-forwarded-proto": "https" }),
      new Headers({ host: "lionsofzion.io", "x-forwarded-proto": "http" }),
      new Headers({ host: "www.lionsofzion.io", "x-forwarded-proto": "https" }),
    ]) {
      expect(publicXAvailability(headers)).toBe("production-only");
    }
  });

  /* The regression this replaced a bug with. `.env.local` on the maintainer's
     machine declares VERCEL_ENV="production", so the old `isProduction()` gate
     was true on localhost and `/auth/x` really did start a flow that could not
     finish. An environment variable is a claim about where the code runs; the
     request's own origin is the fact. */
  it("is not fooled by a local environment that calls itself production", () => {
    configureX();
    process.env.VERCEL_ENV = "production";
    expect(publicXAvailability(new Headers({ host: "localhost:3100" }))).toBe("production-only");
  });

  /* Fails to the strict side: no headers is not a reason to unlock a flow. */
  it("refuses when there is no origin to check", () => {
    configureX();
    expect(publicXAvailability()).toBe("production-only");
    expect(publicXAvailability(new Headers())).toBe("production-only");
  });

  it("reads the proxied host ahead of the internal one", () => {
    configureX();
    const proxied = new Headers({
      host: "some-internal-deployment.vercel.app",
      "x-forwarded-host": "lionsofzion.io",
      "x-forwarded-proto": "https",
    });
    expect(publicXAvailability(proxied)).toBe("ready");
  });

  it("reports Google ready on both the client id and the signing secret", () => {
    configureGoogle();
    expect(googlePublicAuthAvailability()).toBe("ready");
    // Google needs no production: the local origin is authorised and the
    // session cookie is `__Secure-`, not `__Host-`.
    developmentEnvironment();
    expect(googlePublicAuthAvailability()).toBe("ready");

    configureGoogle();
    delete process.env.GOOGLE_AUTH_SESSION_SECRET;
    expect(googlePublicAuthAvailability()).toBe("unconfigured");

    configureGoogle();
    delete process.env.NEXT_PUBLIC_GOOGLE_IDENTITY_CLIENT_ID;
    expect(googlePublicAuthAvailability()).toBe("unconfigured");
  });
});

describe("beginning an X authorization", () => {
  it("redirects to X and plants the state cookie when the flow can complete", () => {
    configureX();
    const response = beginRoute(liveRequest("https://lionsofzion.io/auth/x"));
    expect(response.status).toBe(302);
    const location = response.headers.get("location") ?? "";
    expect(location.startsWith("https://x.com/i/oauth2/authorize")).toBe(true);
    expect(location).not.toContain(X_CLIENT_SECRET);
    expect(location).not.toContain(X_SIGNING_SECRET);
    expect(setCookie(response, X_OAUTH_STATE_COOKIE)).toMatch(/HttpOnly/i);
  });

  it("does not start a flow that cannot finish", () => {
    configureX();
    developmentEnvironment();
    const response = beginRoute(liveRequest("http://localhost:3000/auth/x"));
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("http://localhost:3000/account?x_error=unavailable");
    expect(response.headers.getSetCookie().join(";")).not.toContain(X_OAUTH_STATE_COOKIE);
  });
});

describe("the X callback", () => {
  function pending(): { state: string; cookie: string } {
    const { authorizationUrl, stateCookie } = beginPublicXAuthorization();
    const state = new URL(authorizationUrl).searchParams.get("state");
    expect(state).toBeTruthy();
    return { state: state as string, cookie: stateCookie };
  }

  function callback(query: string, cookie?: string): Promise<Response> {
    return callbackRoute(
      liveRequest(
        `https://lionsofzion.io/auth/x/callback${query}`,
        cookie ? { cookie: `${X_OAUTH_STATE_COOKIE}=${cookie}` } : {},
      ),
    );
  }

  it("lands a completed sign-in on the account page with a session cookie", async () => {
    configureX();
    const accessToken = "x-access-token-that-must-never-be-persisted";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) => {
        const url = String(input instanceof Request ? input.url : input);
        return url.includes("oauth2/token")
          ? Response.json({ access_token: accessToken })
          : Response.json({ data: { ...profile, profile_image_url: profile.image } });
      }),
    );

    const { state, cookie } = pending();
    const response = await callback(`?code=an-authorization-code&state=${state}`, cookie);

    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://lionsofzion.io/account");
    expect(response.headers.get("Cache-Control")).toBe("no-store, max-age=0");
    expect(setCookie(response, X_PUBLIC_SESSION_COOKIE)).toMatch(/Secure/i);
    expect(setCookie(response, X_OAUTH_STATE_COOKIE)).toMatch(/Max-Age=0/i);
  });

  it("distinguishes a reader who pressed Cancel from a failure", async () => {
    configureX();
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);

    const response = await callback("?error=access_denied&state=irrelevant");
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://lionsofzion.io/account?x_error=cancelled");
    expect(setCookie(response, X_OAUTH_STATE_COOKIE)).toMatch(/Max-Age=0/i);
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it("reports any other provider error as a plain failure", async () => {
    configureX();
    const response = await callback("?error=temporarily_unavailable&state=irrelevant");
    expect(response.headers.get("location")).toBe("https://lionsofzion.io/account?x_error=failed");
  });

  it("fails closed when the state cookie is missing, and clears it anyway", async () => {
    configureX();
    const warn = vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const { state } = pending();

    const response = await callback(`?code=an-authorization-code&state=${state}`);
    expect(response.status).toBe(303);
    expect(response.headers.get("location")).toBe("https://lionsofzion.io/account?x_error=failed");
    expect(setCookie(response, X_OAUTH_STATE_COOKIE)).toMatch(/Max-Age=0/i);
    expect(warn).toHaveBeenCalledWith("[public-x-auth] callback failed", {
      stage: "invalid_callback",
      status: undefined,
    });
  });

  it("puts no code, state, token or secret into any redirect it issues", async () => {
    configureX();
    vi.spyOn(console, "warn").mockImplementation(() => undefined);
    const accessToken = "x-access-token-that-must-never-be-persisted";
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: unknown) =>
        String(input instanceof Request ? input.url : input).includes("oauth2/token")
          ? Response.json({ access_token: accessToken })
          : Response.json({ data: { ...profile, profile_image_url: profile.image } }),
      ),
    );

    const { state, cookie } = pending();
    const code = "an-authorization-code";
    const locations = [
      (await callback(`?code=${code}&state=${state}`, cookie)).headers.get("location") ?? "",
      (await callback(`?code=${code}&state=${state}`)).headers.get("location") ?? "",
      (await callback("?error=access_denied")).headers.get("location") ?? "",
      (await callback("")).headers.get("location") ?? "",
    ];

    for (const location of locations) {
      expect(location.startsWith("https://lionsofzion.io/account")).toBe(true);
      for (const secret of [code, state, cookie, accessToken, X_CLIENT_SECRET, X_SIGNING_SECRET, X_CLIENT_ID]) {
        expect(location).not.toContain(secret);
      }
      // Only our own three words ever appear.
      const marker = new URL(location).searchParams.get("x_error");
      expect(marker === null || ["cancelled", "failed", "unavailable"].includes(marker)).toBe(true);
    }
  });
});

function setCookie(response: Response, name: string): string {
  const header = response.headers.getSetCookie().find((value) => value.startsWith(`${name}=`));
  expect(header, `expected a ${name} cookie`).toBeTruthy();
  return header as string;
}
