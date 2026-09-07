import { handleMcpRequest } from "@/server/modules/chatgpt-mcp";

/**
 * Canonical public endpoint for the Lions of Zion remote MCP server.
 *
 * The transport establishes its own `app_service` database role and fixed
 * ChatGPT actor before it constructs any domain service. Keeping this thin
 * route outside the internal HTTP namespace therefore does not weaken RLS;
 * it gives MCP clients the conventional, discoverable URL without creating a
 * second implementation. The existing internal URL remains a compatibility
 * alias for connectors that were configured before this endpoint existed.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = (request: Request): Promise<Response> => handleMcpRequest(request);

/** Streamable HTTP requests are POST-only. */
export function GET(): Response {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}

export const DELETE = GET;
