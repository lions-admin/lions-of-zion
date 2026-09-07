import { exchangeChatgptConnectorToken } from "@/server/modules/chatgpt-mcp";

/**
 * Authorization-code and refresh-token exchange.
 *
 * Public client, no client secret: the client is ChatGPT and cannot keep one.
 * PKCE is what binds the code to the client that requested it, and it is
 * required rather than optional.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export const POST = (request: Request): Promise<Response> => exchangeChatgptConnectorToken(request);
