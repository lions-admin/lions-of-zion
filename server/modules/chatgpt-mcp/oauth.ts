import "server-only";

/**
 * The smallest OAuth 2.1 flow that satisfies the MCP authorization spec.
 *
 * One client, one identity, one scope. There is no user directory behind this
 * and no consent to record: the only question the authorization step asks is
 * whether the person completing it is the owner, and `authenticateAdmin()`
 * already answers that. Everything else here exists because the protocol
 * requires it, not because this system has a use for it.
 *
 * What is deliberately *not* here: dynamic client registration (there is one
 * client), client secrets (a public client cannot keep one — PKCE is what
 * binds the code instead), refresh-token rotation with reuse detection (the
 * tokens are stateless, so there is nothing to detect against), and scopes
 * beyond `editorial` (the capability policy lives in the automation service
 * and is not negotiable per-token).
 */

import { getPublicOrigin } from "mcp-handler";
import { authenticateAdmin } from "@/server/core/auth/actor";
import { withDatabaseRole } from "@/server/db/client";
import { ApiError, problem } from "@/server/http/responses";
import { briefingLog } from "@/server/core/log";
import {
  ACCESS_TOKEN_TTL_MS,
  issueAccessToken,
  issueAuthorizationCode,
  issueRefreshToken,
  verifyAuthorizationCode,
  verifyPkce,
  verifyRefreshToken,
} from "./tokens";

/** OAuth's own error shape — not this project's problem+json. A client parses
 *  these by the spec, and handing it an unfamiliar body helps nobody. */
function oauthError(error: string, description: string, status = 400): Response {
  return Response.json({ error, error_description: description }, {
    status, headers: { "cache-control": "no-store" },
  });
}

/**
 * The redirect targets a code may be returned to.
 *
 * An open redirect on an authorization endpoint hands the code to whoever
 * asked, which defeats the whole exchange. Only ChatGPT's own callback hosts
 * are accepted, and the check is on the parsed origin rather than a prefix
 * match — `https://chatgpt.com.evil.test` starts with the right string.
 */
const ALLOWED_REDIRECT_HOSTS = new Set([
  "chatgpt.com",
  "chat.openai.com",
  "platform.openai.com",
]);

function isAllowedRedirect(redirectUri: string): boolean {
  try {
    const url = new URL(redirectUri);
    if (url.protocol !== "https:") return false;
    return ALLOWED_REDIRECT_HOSTS.has(url.hostname);
  } catch {
    return false;
  }
}

export async function authorizeChatgptConnector(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const redirectUri = url.searchParams.get("redirect_uri") ?? "";
  const state = url.searchParams.get("state") ?? "";
  const codeChallenge = url.searchParams.get("code_challenge") ?? "";
  const method = url.searchParams.get("code_challenge_method") ?? "";

  /* Validated before the redirect is ever used, because everything after this
     point sends something to it. */
  if (!isAllowedRedirect(redirectUri)) {
    return oauthError("invalid_request", "The redirect_uri is not a registered callback for this connector.");
  }
  if (url.searchParams.get("response_type") !== "code") {
    return oauthError("unsupported_response_type", "Only the authorization code flow is supported.");
  }
  if (method !== "S256" || !codeChallenge) {
    return oauthError("invalid_request", "PKCE with S256 is required.");
  }

  /* The gate. `authenticateAdmin` needs the service role to read the account,
     the same bootstrap the HTTP handler performs for an admin route. */
  try {
    await withDatabaseRole("app_service", "service:chatgpt-oauth", () => authenticateAdmin(request));
  } catch (cause) {
    briefingLog("warn", "mcp.oauth.refused", {}, {
      errorClass: cause instanceof ApiError ? cause.code : "UnknownError",
    });
    /* Deliberately not a redirect: an unauthenticated caller must not learn
       that the redirect target was otherwise acceptable, and the owner needs
       to see the sign-in failure rather than a silent bounce. */
    return problem(
      cause instanceof ApiError
        ? cause
        : new ApiError("UNAUTHENTICATED", "Sign in as the site owner to connect this app."),
      "mcp-oauth",
    );
  }

  const code = issueAuthorizationCode({ codeChallenge, redirectUri });
  const target = new URL(redirectUri);
  target.searchParams.set("code", code);
  if (state) target.searchParams.set("state", state);
  briefingLog("info", "mcp.oauth.authorized", {}, { transport: "mcp" });
  return Response.redirect(target.toString(), 302);
}

export async function exchangeChatgptConnectorToken(request: Request): Promise<Response> {
  const form = await request.formData().catch(() => null);
  if (!form) return oauthError("invalid_request", "Expected an application/x-www-form-urlencoded body.");

  const grantType = String(form.get("grant_type") ?? "");
  const issue = (): Response => Response.json({
    access_token: issueAccessToken(),
    token_type: "Bearer",
    expires_in: Math.floor(ACCESS_TOKEN_TTL_MS / 1000),
    refresh_token: issueRefreshToken(),
    scope: "editorial",
  }, { headers: { "cache-control": "no-store" } });

  try {
    if (grantType === "authorization_code") {
      const code = String(form.get("code") ?? "");
      const verifier = String(form.get("code_verifier") ?? "");
      const redirectUri = String(form.get("redirect_uri") ?? "");
      if (!code || !verifier) return oauthError("invalid_request", "code and code_verifier are required.");

      const payload = verifyAuthorizationCode(code);
      /* Both halves of the binding: the verifier proves the client is the one
         that started the flow, and the redirect_uri proves the code is being
         redeemed for the exchange it was issued for. */
      verifyPkce(verifier, payload.codeChallenge ?? "");
      if (payload.redirectUri && payload.redirectUri !== redirectUri) {
        return oauthError("invalid_grant", "This code was issued for a different redirect_uri.");
      }
      briefingLog("info", "mcp.oauth.token", {}, { transport: "mcp", grant: "authorization_code" });
      return issue();
    }

    if (grantType === "refresh_token") {
      const refresh = String(form.get("refresh_token") ?? "");
      if (!refresh) return oauthError("invalid_request", "refresh_token is required.");
      verifyRefreshToken(refresh);
      briefingLog("info", "mcp.oauth.token", {}, { transport: "mcp", grant: "refresh_token" });
      return issue();
    }

    return oauthError("unsupported_grant_type", "Supported grants: authorization_code, refresh_token.");
  } catch {
    /* One message for every failure mode. A caller learning whether a token
       was forged, expired or of the wrong kind learns something it has no
       business knowing. */
    return oauthError("invalid_grant", "This grant is not valid.", 400);
  }
}

/** Exposed for the metadata documents, so one definition serves both. */
export const connectorIssuer = (request: Request): string => getPublicOrigin(request);
