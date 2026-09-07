import { authorizeChatgptConnector } from "@/server/modules/chatgpt-mcp";

/**
 * The consent step, gated on the owner's own session.
 *
 * There is one identity behind this connector, so there is nothing for a user
 * to choose: the only question is whether the person completing the flow is
 * the owner. That check is `authenticateAdmin()`, the same one the admin
 * console uses — so an attacker who reached this URL without the owner's
 * session gets a 403 and no code.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const GET = (request: Request): Promise<Response> => authorizeChatgptConnector(request);
