import { neonAuth } from "@/server/core/auth/neon";
import { adminEmail } from "@/server/core/config";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

type Context = { params: Promise<{ path: string[] }> };
type Method = "GET" | "POST" | "PUT" | "DELETE" | "PATCH";

async function dispatch(method: Method, request: Request, context: Context): Promise<Response> {
  const { path } = await context.params;

  /* Neon Auth still exposes signup over its proxy route. Restrict that route,
     not only the UI, so a caller cannot create an unauthorized account with
     a hand-written request. */
  if (method === "POST" && path.join("/") === "sign-up/email") {
    let body: { email?: unknown };
    try {
      body = await request.clone().json();
    } catch {
      return Response.json({ error: "Invalid signup request." }, { status: 400 });
    }
    if (typeof body.email !== "string" || body.email.trim().toLowerCase() !== adminEmail()) {
      return Response.json({ error: "This email is not authorized." }, { status: 403 });
    }
  }

  const handlers = neonAuth().handler();
  return handlers[method](request, { params: Promise.resolve({ path }) });
}

export const GET = (request: Request, context: Context) => dispatch("GET", request, context);
export const POST = (request: Request, context: Context) => dispatch("POST", request, context);
export const PUT = (request: Request, context: Context) => dispatch("PUT", request, context);
export const DELETE = (request: Request, context: Context) => dispatch("DELETE", request, context);
export const PATCH = (request: Request, context: Context) => dispatch("PATCH", request, context);
