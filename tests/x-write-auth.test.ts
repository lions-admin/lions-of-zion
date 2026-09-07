import { afterEach, describe, expect, it } from "vitest";
import {
  beginPublicXAuthorization,
  createPublicSession,
  createPublicWriteSession,
  getPublicXWriteAccess,
  type PublicXAuthorization,
} from "@/server/core/auth/public-x";

const saved = { ...process.env };
const profile = { id: "1730000000000000000", username: "reader", name: "A Reader" };

function configureX() {
  process.env.X_OAUTH_CLIENT_ID = "test-client-id";
  process.env.X_OAUTH_CLIENT_SECRET = "test-client-secret";
  process.env.X_AUTH_SESSION_SECRET = "test-session-secret-with-enough-entropy-0123456789";
}

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, saved);
});

describe("X native-post authorization", () => {
  it("asks explicitly for post, media and refresh scopes", () => {
    configureX();
    const { authorizationUrl } = beginPublicXAuthorization("/october-7/documentation/category/record");
    const scopes = new Set(new URL(authorizationUrl).searchParams.get("scope")?.split(" ") ?? []);
    expect(scopes).toEqual(new Set([
      "tweet.read",
      "users.read",
      "tweet.write",
      "media.write",
      "offline.access",
    ]));
  });

  it("keeps user-context X credentials encrypted inside the HttpOnly-session value", async () => {
    configureX();
    const authorization: PublicXAuthorization = {
      profile,
      accessToken: "access-token-that-must-not-be-readable-in-the-cookie",
      refreshToken: "refresh-token-that-must-not-be-readable-in-the-cookie",
      accessExpiresAt: Math.floor(Date.now() / 1000) + 3600,
      scopes: ["tweet.read", "users.read", "tweet.write", "media.write", "offline.access"],
      returnTo: "/october-7/documentation/category/record",
    };
    const cookie = createPublicWriteSession(authorization);

    expect(cookie.startsWith("v2.")).toBe(true);
    expect(cookie).not.toContain(authorization.accessToken);
    expect(cookie).not.toContain(authorization.refreshToken!);
    expect(cookie).not.toContain(profile.username);

    const access = await getPublicXWriteAccess(cookie);
    expect(access).toEqual({ profile, accessToken: authorization.accessToken });
  });

  it("does not treat the older identity-only X cookie as permission to post", async () => {
    configureX();
    const legacy = createPublicSession(profile);
    expect(await getPublicXWriteAccess(legacy)).toBeNull();
  });
});
