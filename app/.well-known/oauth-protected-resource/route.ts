import { generateProtectedResourceMetadata, getPublicOrigin, metadataCorsOptionsRequestHandler } from "mcp-handler";

/**
 * The document that tells an MCP client where to authenticate.
 *
 * A `401` from the MCP endpoint carries a `WWW-Authenticate` header pointing
 * here, and this names the authorization server. That indirection is the whole
 * of OAuth discovery: nothing is configured in the client but the endpoint URL.
 *
 * `getPublicOrigin` reads the forwarded headers rather than `request.url`,
 * because behind Vercel the latter is the internal origin — and a Preview
 * deployment must advertise its own origin, never Production's.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export function GET(request: Request): Response {
  const origin = getPublicOrigin(request);
  return Response.json(
    generateProtectedResourceMetadata({
      authServerUrls: [origin],
      resourceUrl: `${origin}/api/internal/chatgpt/mcp`,
      additionalMetadata: {
        resource_name: "Lions of Zion — Editorial & Operations",
        scopes_supported: ["editorial"],
      },
    }),
    { headers: { "cache-control": "no-store" } },
  );
}

export const OPTIONS = metadataCorsOptionsRequestHandler();
