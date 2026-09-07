import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

vi.mock("@/server/core/auth/actor", () => ({
  authenticateAdmin: vi.fn(), registerActor: vi.fn(), requireActor: vi.fn(),
}));

import { createHash, randomBytes } from "node:crypto";
import {
  ACCESS_TOKEN_TTL_MS,
  issueAccessToken,
  issueAuthorizationCode,
  issueRefreshToken,
  verifyAccessToken,
  verifyAuthorizationCode,
  verifyPkce,
  verifyRefreshToken,
} from "@/server/modules/chatgpt-mcp/tokens";

/**
 * The tokens that let a ChatGPT conversation reach production.
 *
 * ChatGPT supports OAuth, no authentication, or a mix — there is no static
 * header option — so these tokens are the entire boundary between a public
 * endpoint and a system that can archive a published article. Each test below
 * is one way that boundary could be walked through.
 */

const SECRET = "chatgpt-mcp-token-test-secret";

beforeEach(() => { process.env.CHATGPT_AUTOMATION_SECRET = SECRET; });
afterEach(() => { delete process.env.CHATGPT_AUTOMATION_SECRET; });

describe("connector tokens", () => {
  it("accepts a token it issued", () => {
    const { expiresAt } = verifyAccessToken(issueAccessToken());
    expect(expiresAt.getTime()).toBeGreaterThan(Date.now());
    expect(expiresAt.getTime()).toBeLessThanOrEqual(Date.now() + ACCESS_TOKEN_TTL_MS + 1_000);
  });

  it("refuses a forged token, a truncated one, and noise", () => {
    for (const token of ["", "not-a-token", "a.b", `${issueAccessToken()}x`]) {
      expect(() => verifyAccessToken(token)).toThrow();
    }
  });

  /* The kinds are signed under separate keys, so one cannot be presented as
     another. Without this, a refresh token — which lives thirty days — would
     be usable as an access token. */
  it("refuses a token of the wrong kind at every crossing", () => {
    expect(() => verifyAccessToken(issueRefreshToken())).toThrow();
    expect(() => verifyAccessToken(issueAuthorizationCode({ codeChallenge: "c", redirectUri: "https://chatgpt.com/cb" }))).toThrow();
    expect(() => verifyRefreshToken(issueAccessToken())).toThrow();
    expect(() => verifyAuthorizationCode(issueAccessToken())).toThrow();
  });

  it("refuses an expired token", () => {
    const past = new Date(Date.now() - ACCESS_TOKEN_TTL_MS - 60_000);
    expect(() => verifyAccessToken(issueAccessToken(past))).toThrow();
  });

  /* Rotating the secret is the documented revocation path, because the tokens
     are stateless and there is nothing to delete. This is what makes that
     claim true. */
  it("stops honouring every token once the secret is rotated", () => {
    const token = issueAccessToken();
    expect(() => verifyAccessToken(token)).not.toThrow();
    process.env.CHATGPT_AUTOMATION_SECRET = "a-different-secret";
    expect(() => verifyAccessToken(token)).toThrow();
  });

  it("never puts the signing secret in the token", () => {
    for (const token of [issueAccessToken(), issueRefreshToken()]) {
      expect(token).not.toContain(SECRET);
      expect(Buffer.from(token.split(".")[0]!, "base64url").toString("utf8")).not.toContain(SECRET);
    }
  });

  /* The token carries an expiry and an opaque id and nothing else. In
     particular there is no subject a client could set: a caller that could
     name its own actor could file its actions under someone else. */
  it("carries no identity a client could choose", () => {
    const body = JSON.parse(Buffer.from(issueAccessToken().split(".")[0]!, "base64url").toString("utf8"));
    expect(Object.keys(body).sort()).toEqual(["exp", "id", "kind"]);
    expect(JSON.stringify(body)).not.toContain("service:");
  });

  it("requires the PKCE verifier that produced the challenge", () => {
    const verifier = randomBytes(32).toString("base64url");
    const challenge = createHash("sha256").update(verifier).digest("base64url");
    expect(() => verifyPkce(verifier, challenge)).not.toThrow();
    expect(() => verifyPkce("a-different-verifier", challenge)).toThrow();
    expect(() => verifyPkce(verifier, "")).toThrow();
  });
});
