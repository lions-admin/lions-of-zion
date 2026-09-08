import { NextRequest } from "next/server";
import { afterEach, describe, expect, it } from "vitest";
import { GET as beginXAuthorization } from "@/app/auth/x/route";

const savedEnvironment = { ...process.env };

function configureX(): void {
  process.env.VERCEL_ENV = "production";
  process.env.X_OAUTH_CLIENT_ID = "test-x-client-id";
  process.env.X_OAUTH_CLIENT_SECRET = "test-x-client-secret-never-leaves-the-server";
  process.env.X_AUTH_SESSION_SECRET = "x-session-signing-secret-for-tests-0123456789";
}

function liveRequest(url: string): NextRequest {
  const { host, protocol } = new URL(url);
  return new NextRequest(url, {
    headers: { host, "x-forwarded-proto": protocol.replace(":", "") },
  });
}

afterEach(() => {
  for (const key of Object.keys(process.env)) delete process.env[key];
  Object.assign(process.env, savedEnvironment);
});

describe("archive social sharing authorization boundary", () => {
  it("ignores legacy intent=post and never requests X write/media/offline scopes", () => {
    configureX();
    const response = beginXAuthorization(
      liveRequest(
        "https://lionsofzion.io/auth/x?intent=post&return_to=%2Foctober-7%2Fdocumentation",
      ),
    );

    expect(response.status).toBe(302);
    const location = new URL(response.headers.get("location") ?? "");
    const scopes = (location.searchParams.get("scope") ?? "").split(/\s+/).filter(Boolean);

    expect(scopes).toEqual(["tweet.read", "users.read"]);
    expect(scopes).not.toContain("tweet.write");
    expect(scopes).not.toContain("media.write");
    expect(scopes).not.toContain("offline.access");
  });
});
