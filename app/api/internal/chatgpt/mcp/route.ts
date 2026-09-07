import { handleMcpRequest } from "@/server/modules/chatgpt-mcp";

/**
 * The remote MCP endpoint ChatGPT connects to.
 *
 * Compatibility endpoint for connectors configured before `/api/mcp` became
 * canonical. `handleMcpRequest()` establishes `app_service` and the fixed
 * `service:chatgpt-editorial` identity itself, so both URLs share exactly the
 * same RLS boundary and transport implementation.
 *
 * The route itself does nothing but delegate. Authentication, the database
 * role and the transport all live in the module, because a route handler may
 * not import `@/server/db*` and should not be where a security decision is
 * made.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";
export const maxDuration = 300;

export const POST = (request: Request): Promise<Response> => handleMcpRequest(request);

/**
 * Streamable HTTP under the current specification is POST-only: the GET stream
 * and protocol-level sessions were removed, and a server that keeps them
 * invites a client to open one. `405` is the documented answer.
 */
export function GET(): Response {
  return new Response(null, { status: 405, headers: { allow: "POST" } });
}
export const DELETE = GET;
