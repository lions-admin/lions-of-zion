import { getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";

/**
 * Authorization-server metadata (RFC 8414).
 *
 * One client, one identity, one scope. PKCE with S256 is advertised as the
 * only challenge method because OAuth 2.1 requires PKCE and drops `plain`, and
 * offering a method that proves nothing would be worse than offering none.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const issuer = getPublicOrigin(request);
  return Response.json({
    issuer,
    authorization_endpoint: `${issuer}/api/internal/chatgpt/oauth/authorize`,
    token_endpoint: `${issuer}/api/internal/chatgpt/oauth/token`,
    scopes_supported: ["editorial"],
    response_types_supported: ["code"],
    grant_types_supported: ["authorization_code", "refresh_token"],
    code_challenge_methods_supported: ["S256"],
    token_endpoint_auth_methods_supported: ["none"],
  }, { headers: { "cache-control": "no-store" } });
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
